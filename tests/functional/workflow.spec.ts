import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OrderStatus, PhotoKind } from '#enums/order_enum'
import { PaymentStatus } from '#enums/payment_enum'
import ActivityLog from '#models/activity_log'
import Bill from '#models/bill'
import Order from '#models/order'
import OrderEvent from '#models/order_event'
import OrderPhoto from '#models/order_photo'
import Payment from '#models/payment'
import Service from '#models/service'
import type User from '#models/user'
import { DEFAULT_SETTINGS } from '#models/setting'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import {
  PNG_PIXEL,
  createOrder,
  inertia,
  orderPayload,
  post,
  postWalkIn,
  savedAddress,
  seedCatalogue,
  useApp,
} from '#tests/support/app'

const today = () => DateTime.now().setZone(SERVICE_ZONE).startOf('day')

function upload(client: ApiClient, url: string, user: User, fields: Record<string, string> = {}) {
  return client
    .post(url)
    .file('photo', PNG_PIXEL, { filename: 'bukti.png' })
    .fields(fields)
    .withCsrfToken()
    .header('accept', 'application/json')
    .loginAs(user)
    .redirects(0)
}

async function statusOf(order: Order) {
  await order.refresh()
  return order.status
}

test.group('Order workflow', (group) => {
  const state = useApp(group)

  test('a placed order reaches the staff pickup queue and the customer gets its link', async ({
    client,
    assert,
  }) => {
    const customer = await UserFactory.create()
    const staff = await UserFactory.apply('staff').create()
    const address = await savedAddress(customer, { isPrimary: true })

    const reviewed = await post(client, '/pesan/tinjau', orderPayload(address.id)).loginAs(customer)
    await post(client, '/pesan', {}, reviewed.session()).loginAs(customer)
    const order = await Order.firstOrFail()
    assert.equal(order.customerName, customer.name)
    assert.lengthOf(await OrderEvent.query().where('order_id', order.id), 1)
    assert.deepEqual(
      state.fonnte.messages.map((message) => message.target),
      [customer.phone]
    )
    assert.include(state.fonnte.messages[0].message, order.number())
    assert.include(state.fonnte.messages[0].message, `/pesanan/${order.id}`)

    await order.merge({ pickupDate: today() }).save()
    const queue = await inertia(client, '/staf/jemput').loginAs(staff)
    queue.assertInertiaComponent('staff/tasks/queue')
    const tasks = (queue.inertiaProps as { tasks: { ref: string }[] }).tasks
    assert.deepEqual(
      tasks.map((task) => task.ref),
      [order.number()]
    )

    const owner = await UserFactory.apply('admin').create()
    const list = await inertia(client, '/admin/pesanan').loginAs(owner)
    list.assertInertiaComponent('admin/orders/list')
  })

  test('a full slot is refused and a cancelled order frees it', async ({ client, assert }) => {
    const customer = await UserFactory.create()
    const address = await savedAddress(customer, { isPrimary: true })
    const payload = orderPayload(address.id)
    const capacity = DEFAULT_SETTINGS.pickup_slots[payload.slot].capacity
    const others = await UserFactory.createMany(capacity)
    for (const other of others) {
      await createOrder(other, {
        pickupDate: DateTime.fromISO(payload.date, { zone: SERVICE_ZONE }),
        pickupSlot: payload.slot,
      })
    }

    const refused = await post(client, '/pesan/tinjau', payload).loginAs(customer)
    refused.assertBodyContains({ errors: [{ field: 'slot', rule: 'slot.full' }] })

    await Order.query().limit(1).update({ status: OrderStatus.CANCELLED })
    const allowed = await post(client, '/pesan/tinjau', payload).loginAs(customer)
    allowed.assertHeader('location', '/pesan/konfirmasi')
    assert.lengthOf(others, capacity)
  })

  test('staff move an online order through every status to completed', async ({
    client,
    assert,
  }) => {
    const catalogue = await seedCatalogue()
    const customer = await UserFactory.create()
    const courier = await UserFactory.apply('staff').create()
    const order = await createOrder(customer, {
      pickupDate: today(),
      itemsSepatu: 1,
      itemsTas: 1,
      itemsHelm: 0,
    })
    const code = order.id

    await post(client, `/staf/jemput/${code}/mulai`).loginAs(courier)
    assert.equal(await statusOf(order), OrderStatus.COURIER_EN_ROUTE)

    await post(client, `/staf/jemput/${code}/tiba`).loginAs(courier)
    const done = await upload(client, `/staf/jemput/${code}/selesai`, courier)
    done.assertHeader('location', '/staf/jemput/tugas')
    assert.equal(await statusOf(order), OrderStatus.PICKED_UP)

    await post(client, `/staf/proses/${code}/periksa/mulai`).loginAs(courier)
    assert.equal(await statusOf(order), OrderStatus.IN_INSPECTION)

    const [deepClean, whitening, bagWash] = catalogue
    await post(client, `/staf/proses/${code}/periksa`, {
      items: [
        {
          kind: 'shoe',
          itemName: 'Sneakers putih',
          services: { main: deepClean.id, addons: [whitening.id] },
        },
        { kind: 'bag', itemName: 'Ransel', services: { main: bagWash.id, addons: [] } },
      ],
    }).loginAs(courier)
    assert.equal(await statusOf(order), OrderStatus.AWAITING_PAYMENT)
    const bill = await Bill.query().where('order_id', order.id).preload('lines').firstOrFail()
    assert.equal(bill.total, 45000 + 10000 + 40000)
    assert.lengthOf(bill.lines, 3)
    assert.isTrue(state.fonnte.messages.some((message) => message.message.includes('Rp95.000')))

    await Payment.create({
      orderId: order.id,
      channel: 'online',
      method: 'qris',
      status: PaymentStatus.PENDING,
      amount: bill.total,
      providerOrderId: `${code}-1`,
      expiresAt: DateTime.now().plus({ minutes: 15 }),
    })
    const webhook = await client.post('/webhooks/midtrans').json({
      order_id: `${code}-1`,
      transaction_status: 'settlement',
      status_code: '200',
      gross_amount: `${bill.total}.00`,
      signature_key: 'valid-signature',
    })
    webhook.assertStatus(200)
    assert.equal(await statusOf(order), OrderStatus.IN_CLEANING)

    await upload(client, `/staf/proses/${code}/cuci`, courier)
    assert.equal(await statusOf(order), OrderStatus.READY_FOR_DELIVERY)

    await post(client, `/staf/antar/${code}/mulai`).loginAs(courier)
    assert.equal(await statusOf(order), OrderStatus.IN_DELIVERY)
    await upload(client, `/staf/antar/${code}/selesai`, courier, { receiver: 'Rina' })
    assert.equal(await statusOf(order), OrderStatus.COMPLETED)
    assert.equal(order.receiverName, 'Rina')

    const events = await OrderEvent.query().where('order_id', order.id).orderBy('id')
    assert.deepEqual(
      events.map((event) => event.status),
      [
        OrderStatus.COURIER_EN_ROUTE,
        OrderStatus.PICKED_UP,
        OrderStatus.IN_INSPECTION,
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.IN_CLEANING,
        OrderStatus.READY_FOR_DELIVERY,
        OrderStatus.IN_DELIVERY,
        OrderStatus.COMPLETED,
      ]
    )
    const actions = await ActivityLog.query().where('actor_id', courier.id)
    assert.isAbove(actions.length, 6)

    const detail = await inertia(client, `/pesanan/${code}`).loginAs(customer)
    detail.assertInertiaPropsContains({ order: { number: order.number(), receiver: 'Rina' } })
  })

  test('two start requests on the same pickup cannot both succeed', async ({ client, assert }) => {
    const customer = await UserFactory.create()
    const courier = await UserFactory.apply('staff').create()
    const owner = await UserFactory.apply('admin').create()
    const order = await createOrder(customer, { pickupDate: today() })

    const responses = await Promise.all([
      post(client, `/staf/jemput/${order.id}/mulai`).loginAs(courier),
      post(client, `/staf/jemput/${order.id}/mulai`).loginAs(owner),
    ])

    const statuses = responses.map((response) => response.status()).sort()
    assert.deepEqual(statuses, [302, 422])
    const refused = responses.find((response) => response.status() === 422)!
    refused.assertBodyContains({ errors: [{ rule: 'order.transition' }] })
    assert.equal(await statusOf(order), OrderStatus.COURIER_EN_ROUTE)
    const started = await OrderEvent.query()
      .where('order_id', order.id)
      .where('status', OrderStatus.COURIER_EN_ROUTE)
    assert.lengthOf(started, 1)
    assert.lengthOf(
      state.fonnte.messages.filter((message) => message.target === customer.phone),
      1
    )
  })

  test('skipping a pickup records the reason and tells the customer', async ({
    client,
    assert,
  }) => {
    const customer = await UserFactory.create()
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(customer, { pickupDate: today() })

    await post(client, `/staf/jemput/${order.id}/mulai`).loginAs(staff)
    await post(client, `/staf/jemput/${order.id}/lewati`, {
      reason: 1,
      note: 'Sudah ditelepon 3 kali',
    }).loginAs(staff)

    assert.equal(await statusOf(order), OrderStatus.AWAITING_PICKUP)
    const event = await OrderEvent.query().where('order_id', order.id).orderBy('id', 'desc').first()
    assert.include(event!.note, 'Pelanggan tidak ada di lokasi')
    assert.isTrue(state.fonnte.messages.some((message) => message.target === customer.phone))
  })

  test('steps out of order are refused', async ({ client, assert }) => {
    const customer = await UserFactory.create()
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(customer, { pickupDate: today() })

    const wash = await upload(client, `/staf/proses/${order.id}/cuci`, staff)
    wash.assertBodyContains({ errors: [{ rule: 'order.status' }] })
    const deliver = await post(client, `/staf/antar/${order.id}/mulai`).loginAs(staff)
    deliver.assertBodyContains({ errors: [{ rule: 'order.transition' }] })
    assert.equal(await statusOf(order), OrderStatus.AWAITING_PICKUP)
  })

  test('inspection refuses inactive services and services for another item kind', async ({
    client,
    assert,
  }) => {
    const [deepClean, , bagWash] = await seedCatalogue()
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.PICKED_UP,
    })
    await post(client, `/staf/proses/${order.id}/periksa/mulai`).loginAs(staff)

    const wrongKind = await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [{ kind: 'shoe', itemName: 'Sepatu', services: { main: bagWash.id, addons: [] } }],
    }).loginAs(staff)
    wrongKind.assertBodyContains({ errors: [{ rule: 'service.main' }] })

    await Service.query().where('id', deepClean.id).update({ is_active: false })
    const inactive = await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [{ kind: 'shoe', itemName: 'Sepatu', services: { main: deepClean.id, addons: [] } }],
    }).loginAs(staff)
    inactive.assertBodyContains({ errors: [{ rule: 'service.main' }] })
    assert.equal(await statusOf(order), OrderStatus.IN_INSPECTION)
  })
})

test.group('Payments', (group) => {
  const state = useApp(group)

  async function billedOrder(total = 55000) {
    const customer = await UserFactory.create()
    const order = await createOrder(customer, { status: OrderStatus.AWAITING_PAYMENT })
    await Bill.create({ orderId: order.id, total, decidedBy: null })
    return { customer, order }
  }

  test('the customer gets a real QR, expired codes are replaced, and the webhook is checked', async ({
    client,
    assert,
  }) => {
    const { customer, order } = await billedOrder()

    await post(client, `/pesanan/${order.id}/bayar`).loginAs(customer)
    const first = await Payment.query().where('order_id', order.id).firstOrFail()
    assert.equal(first.status, PaymentStatus.PENDING)
    assert.equal(first.amount, 55000)
    assert.include(first.qrUrl ?? '', first.providerOrderId ?? 'missing')

    await post(client, `/pesanan/${order.id}/bayar`).loginAs(customer)
    assert.lengthOf(state.gateway.charges, 1)

    await first.merge({ expiresAt: DateTime.now().minus({ minutes: 1 }) }).save()
    await post(client, `/pesanan/${order.id}/bayar`).loginAs(customer)
    assert.lengthOf(state.gateway.charges, 2)
    await first.refresh()
    assert.equal(first.status, PaymentStatus.EXPIRED)

    const forged = await client.post('/webhooks/midtrans').json({
      order_id: first.providerOrderId,
      transaction_status: 'settlement',
      status_code: '200',
      gross_amount: '55000.00',
      signature_key: 'forged',
    })
    forged.assertStatus(403)
    assert.equal(await order.refresh().then(() => order.status), OrderStatus.AWAITING_PAYMENT)

    const current = await Payment.query()
      .where('order_id', order.id)
      .where('status', PaymentStatus.PENDING)
      .firstOrFail()
    const notification = {
      order_id: current.providerOrderId,
      transaction_status: 'settlement',
      status_code: '200',
      gross_amount: '55000.00',
      signature_key: 'valid-signature',
    }
    await client.post('/webhooks/midtrans').json(notification)
    await client.post('/webhooks/midtrans').json(notification)
    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_CLEANING)
    assert.lengthOf(
      await OrderEvent.query().where('order_id', order.id).where('status', OrderStatus.IN_CLEANING),
      1
    )
  })

  test('a paid amount that does not match the bill does not settle the order', async ({
    client,
    assert,
  }) => {
    const { order } = await billedOrder()
    await Payment.create({
      orderId: order.id,
      channel: 'online',
      method: 'qris',
      status: PaymentStatus.PENDING,
      amount: 55000,
      providerOrderId: `${order.id}-1`,
      expiresAt: DateTime.now().plus({ minutes: 15 }),
    })
    await client.post('/webhooks/midtrans').json({
      order_id: `${order.id}-1`,
      transaction_status: 'settlement',
      status_code: '200',
      gross_amount: '1000.00',
      signature_key: 'valid-signature',
    })
    await order.refresh()
    assert.equal(order.status, OrderStatus.AWAITING_PAYMENT)
  })

  test('without Midtrans keys the pay page says QRIS is unavailable', async ({ client }) => {
    state.gateway.isAvailable = false
    const { customer, order } = await billedOrder()
    const page = await inertia(client, `/pesanan/${order.id}/bayar`).loginAs(customer)
    page.assertInertiaPropsContains({ isAvailable: false, qris: null })
    const start = await post(client, `/pesanan/${order.id}/bayar`).loginAs(customer)
    start.assertBodyContains({ errors: [{ rule: 'payment.unavailable' }] })
  })

  test('cash at the counter records change and refuses too little money', async ({
    client,
    assert,
  }) => {
    const staff = await UserFactory.apply('staff').create()
    const { order } = await billedOrder(75000)
    await order.merge({ source: 'store' }).save()

    const short = await post(client, `/staf/transaksi/${order.id}/bayar`, {
      method: 'cash',
      cashReceived: 50000,
    }).loginAs(staff)
    short.assertBodyContains({ errors: [{ field: 'cashReceived' }] })

    await post(client, `/staf/transaksi/${order.id}/bayar`, {
      method: 'cash',
      cashReceived: 100000,
    }).loginAs(staff)
    const payment = await Payment.query().where('order_id', order.id).firstOrFail()
    assert.equal(payment.status, PaymentStatus.PAID)
    assert.equal(payment.cashReceived, 100000)
    assert.equal(payment.recordedBy, staff.id)
    assert.equal(await statusOf(order), OrderStatus.IN_CLEANING)

    const page = await inertia(client, `/staf/transaksi/${order.id}/bayar`).loginAs(staff)
    page.assertInertiaPropsContains({ order: { payment: { change: 25000 } } })
  })

  test('a walk-in is refused without item photos taken at intake', async ({ client, assert }) => {
    const staff = await UserFactory.apply('staff').create()
    const body = {
      phone: '0812 7777 8888',
      name: 'Andi Pratama',
      items: { sepatu: 1, tas: 0, helm: 0 },
      returnMethod: 'store',
    }

    const refused = await postWalkIn(client, body, 0).loginAs(staff)
    refused.assertStatus(422)
    refused.assertBodyContains({ errors: [{ field: 'photos' }] })
    const tooMany = await postWalkIn(client, body, 4).loginAs(staff)
    tooMany.assertStatus(422)
    assert.lengthOf(await Order.all(), 0)

    await postWalkIn(client, body, 3).loginAs(staff)
    const order = await Order.firstOrFail()
    assert.lengthOf(await OrderPhoto.query().where('order_id', order.id), 3)
    const log = await ActivityLog.query()
      .where('order_id', order.id)
      .where('action', 'items_photographed')
      .firstOrFail()
    assert.equal(log.detail, '3 foto barang diterima')
  })

  test('a walk-in becomes a real store order and gets its tracking link', async ({
    client,
    assert,
  }) => {
    const staff = await UserFactory.apply('staff').create()
    const created = await postWalkIn(
      client,
      {
        phone: '0812 7777 8888',
        name: 'Andi Pratama',
        items: { sepatu: 1, tas: 0, helm: 0 },
        returnMethod: 'store',
      },
      2
    ).loginAs(staff)
    const order = await Order.firstOrFail()
    created.assertHeader('location', `/staf/proses/${order.id}/periksa`)
    assert.equal(order.source, 'store')
    assert.equal(order.status, OrderStatus.IN_INSPECTION)
    assert.equal(order.customerPhone, '6281277778888')
    const photos = await OrderPhoto.query().where('order_id', order.id)
    assert.deepEqual(
      photos.map((photo) => photo.kind),
      [PhotoKind.INTAKE, PhotoKind.INTAKE]
    )

    await Bill.create({ orderId: order.id, total: 45000, decidedBy: staff.id })
    await order.merge({ status: OrderStatus.AWAITING_PAYMENT }).save()
    await post(client, `/staf/transaksi/${order.id}/bayar`, {
      method: 'cash',
      cashReceived: 50000,
    }).loginAs(staff)
    const sent = state.fonnte.messages.filter((message) => message.target === '6281277778888')
    assert.lengthOf(sent, 1)
    assert.include(sent[0].message, order.number())
    assert.include(sent[0].message, `/pesanan/${order.id}`)
    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_CLEANING)
  })
})
