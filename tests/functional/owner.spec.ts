import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { ActivityAction } from '#enums/activity_enum'
import { OrderSource, OrderStatus, ReturnMethod } from '#enums/order_enum'
import { PaymentStatus } from '#enums/payment_enum'
import ActivityLog from '#models/activity_log'
import Bill from '#models/bill'
import Order from '#models/order'
import Payment from '#models/payment'
import User from '#models/user'
import { DEFAULT_SETTINGS } from '#models/setting'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import {
  createOrder,
  inertia,
  orderPayload,
  post,
  savedAddress,
  seedCatalogue,
  send,
  TURNSTILE_TOKEN,
  useApp,
} from '#tests/support/app'

test.group('Owner tools', (group) => {
  const state = useApp(group)

  test('cancelling tells the customer, and a WhatsApp failure still cancels', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const order = await createOrder(customer, { status: OrderStatus.PICKED_UP })

    const response = await post(client, '/admin/pesanan/batal', {
      ids: [order.id],
      reason: 'Permintaan pelanggan',
    }).loginAs(owner)

    await order.refresh()
    assert.equal(order.status, OrderStatus.CANCELLED)
    assert.equal(order.cancelReason, 'Permintaan pelanggan')
    const sent = state.fonnte.messages.filter((message) => message.target === customer.phone)
    assert.lengthOf(sent, 1)
    assert.include(sent[0].message, 'Permintaan pelanggan')
    assert.include(sent[0].message, order.number())
    assert.equal(response.flashMessages().success, '1 pesanan dibatalkan.')
    const log = await ActivityLog.query().where('action', ActivityAction.ORDER_CANCELLED).first()
    assert.isTrue(log?.isSensitive)

    state.fonnte.shouldFail = true
    const second = await createOrder(customer)
    const failed = await post(client, '/admin/pesanan/batal', {
      ids: [second.id],
      reason: 'Di luar area layanan',
    }).loginAs(owner)
    assert.equal(failed.flashMessages().success, '1 pesanan dibatalkan.')
    await second.refresh()
    assert.equal(second.status, OrderStatus.CANCELLED)
  })

  test('a payment recorded by the owner moves the order to washing and is logged', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.AWAITING_PAYMENT,
    })
    await Bill.create({ orderId: order.id, total: 80000, decidedBy: null })

    await post(client, `/admin/pesanan/${order.id}/pembayaran`, {
      method: 'cash',
      amount: 80000,
      correctionReason: 'Dibayar tunai di toko',
    }).loginAs(owner)

    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_CLEANING)
    const payment = await Payment.query().where('order_id', order.id).firstOrFail()
    assert.equal(payment.status, PaymentStatus.PAID)
    assert.equal(payment.recordedBy, owner.id)
    const log = await ActivityLog.query()
      .where('action', ActivityAction.PAYMENT_CORRECTED)
      .firstOrFail()
    assert.isTrue(log.isSensitive)
  })

  test('the owner creates a staff login, resets it and deactivation ends every session', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()

    const created = await post(client, '/admin/pengaturan', {
      name: 'Agus Firmansyah',
      phone: '0857 1122 3344',
      role: 'staff',
    }).loginAs(owner)
    const staff = await User.findByOrFail('phone', '6285711223344')
    assert.equal(staff.role, 'staff')
    const notice = created.flashMessages().staff_password as { password: string }
    assert.isTrue(await staff.verifyPassword(notice.password))
    assert.isFalse(state.fonnte.messages.some((message) => message.target === staff.phone))
    assert.isNull(staff.passwordChangedAt)

    await staff.merge({ passwordChangedAt: DateTime.now() }).save()
    const reset = await post(client, `/admin/pengaturan/${staff.id}/reset`).loginAs(owner)
    const resetNotice = reset.flashMessages().staff_password as { password: string }
    await staff.refresh()
    assert.isTrue(await staff.verifyPassword(resetNotice.password))
    assert.isNull(staff.passwordChangedAt)

    await User.rememberMeTokens.create(staff, '180 days')
    await post(client, `/admin/pengaturan/${staff.id}/aktif`, { active: false }).loginAs(owner)
    await staff.refresh()
    assert.isFalse(staff.isActive)
    assert.lengthOf(await User.rememberMeTokens.all(staff), 0)

    const login = await send(client, 'post', '/staf/masuk', {
      phone: '085711223344',
      password: notice.password,
      turnstile: TURNSTILE_TOKEN,
    })
    login.assertBodyContains({ errors: [{ rule: 'login.invalid' }] })

    const blocked = await inertia(client, '/staf').loginAs(staff)
    blocked.assertHeader('location', '/staf/masuk')
  })

  test('a price edit is used by the next inspection and on the landing page', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const staff = await UserFactory.apply('staff').create()
    const [deepClean] = await seedCatalogue()

    await send(client, 'put', `/admin/layanan/${deepClean.id}`, {
      serviceName: 'Deep Clean',
      type: 'utama',
      categories: ['Sepatu'],
      price: 52000,
      days: 3,
      active: true,
    }).loginAs(owner)

    const landing = await inertia(client, '/')
    const prices = landing.inertiaProps as { prices: { main: { name: string; price: number }[] }[] }
    assert.isTrue(prices.prices[0].main.some((entry) => entry.price === 52000))

    const order = await createOrder(await UserFactory.create(), { status: OrderStatus.PICKED_UP })
    await post(client, `/staf/proses/${order.id}/periksa/mulai`).loginAs(staff)
    await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [{ kind: 'shoe', itemName: 'Sepatu', services: { main: deepClean.id, addons: [] } }],
    }).loginAs(staff)
    const bill = await Bill.findByOrFail('order_id', order.id)
    assert.equal(bill.total, 52000)
  })

  test('slot capacity and closed slots set in Toko are enforced at booking', async ({ client }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const address = await savedAddress(customer, { isPrimary: true })
    const payload = orderPayload(address.id, { slot: 0 })

    await send(client, 'put', '/admin/pengaturan/toko', {
      storeName: DEFAULT_SETTINGS.store.name,
      whatsapp: '085157900974',
      storeAddress: DEFAULT_SETTINGS.store.address,
      hours: DEFAULT_SETTINGS.store.hours,
      slots: [
        { label: '09.00–12.00', capacity: 1, on: true },
        { label: '12.00–15.00', capacity: 6, on: false },
        { label: '15.00–18.00', capacity: 4, on: true },
      ],
      payments: { qris: true, cash: true },
      inactiveDays: 60,
    }).loginAs(owner)

    await createOrder(await UserFactory.create(), {
      pickupDate: DateTime.fromISO(payload.date, { zone: SERVICE_ZONE }),
      pickupSlot: 0,
    })
    const full = await post(client, '/pesan/tinjau', payload).loginAs(customer)
    full.assertBodyContains({ errors: [{ rule: 'slot.full' }] })
    const closed = await post(client, '/pesan/tinjau', { ...payload, slot: 1 }).loginAs(customer)
    closed.assertBodyContains({ errors: [{ rule: 'slot.closed' }] })
  })

  test('owner bulk status changes only take the next legal step', async ({ client, assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const pickedUp = await createOrder(customer, { status: OrderStatus.PICKED_UP })
    const awaiting = await createOrder(customer, { status: OrderStatus.AWAITING_PAYMENT })

    await post(client, '/admin/pesanan/status', {
      ids: [pickedUp.id, awaiting.id],
      stage: 'periksa',
    }).loginAs(owner)
    await post(client, '/admin/pesanan/status', {
      ids: [awaiting.id],
      stage: 'cuci',
    }).loginAs(owner)

    await pickedUp.refresh()
    await awaiting.refresh()
    assert.equal(pickedUp.status, OrderStatus.IN_INSPECTION)
    assert.equal(awaiting.status, OrderStatus.AWAITING_PAYMENT)
  })

  test('owner bulk move only takes the two steps that need no staff proof', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const pickedUp = await createOrder(customer, { status: OrderStatus.PICKED_UP })
    const atShop = await createOrder(customer, {
      status: OrderStatus.READY_FOR_COLLECTION,
      source: OrderSource.STORE,
      returnMethod: ReturnMethod.STORE,
    })
    const enRoute = await createOrder(customer, { status: OrderStatus.COURIER_EN_ROUTE })

    const list = await inertia(client, '/admin/pesanan').loginAs(owner)
    const next = Object.fromEntries(
      (list.inertiaProps as { orders: { id: string; next: string[] }[] }).orders.map((row) => [
        row.id,
        row.next,
      ])
    )
    assert.deepEqual(next[String(pickedUp.id)], ['periksa'])
    assert.deepEqual(next[String(atShop.id)], ['selesai'])
    assert.deepEqual(next[String(enRoute.id)], [])

    const toInspection = await post(client, '/admin/pesanan/status', {
      ids: [pickedUp.id, enRoute.id],
      stage: 'periksa',
    }).loginAs(owner)
    const toDone = await post(client, '/admin/pesanan/status', {
      ids: [atShop.id],
      stage: 'selesai',
    }).loginAs(owner)

    await pickedUp.refresh()
    await atShop.refresh()
    await enRoute.refresh()
    assert.equal(pickedUp.status, OrderStatus.IN_INSPECTION)
    assert.equal(atShop.status, OrderStatus.COMPLETED)
    assert.equal(enRoute.status, OrderStatus.COURIER_EN_ROUTE)
    assert.equal(
      toInspection.flashMessages().success,
      `1 pesanan diubah dan tercatat di Aktivitas Staf. Tidak diubah: ${enRoute.number()} (tidak bisa diubah massal ke status ini).`
    )
    assert.equal(toDone.flashMessages().success, '1 pesanan diubah dan tercatat di Aktivitas Staf.')
  })

  test('owner bulk move refuses every transition that needs proof', async ({ client, assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const washing = await createOrder(customer, { status: OrderStatus.IN_CLEANING })
    const waiting = await createOrder(customer, { status: OrderStatus.AWAITING_PICKUP })
    const inspecting = await createOrder(customer, { status: OrderStatus.IN_INSPECTION })

    for (const stage of ['jemput', 'bayar', 'cuci', 'antar', 'batal']) {
      const refused = await post(client, '/admin/pesanan/status', {
        ids: [washing.id, waiting.id, inspecting.id],
        stage,
      }).loginAs(owner)
      refused.assertStatus(422)
      refused.assertBodyContains({ errors: [{ field: 'stage' }] })
    }

    for (const order of [washing, waiting, inspecting]) {
      const status = order.status
      await order.refresh()
      assert.equal(order.status, status)
    }
  })

  test('staff cannot use owner actions', async ({ client, assert }) => {
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(await UserFactory.create())
    const response = await post(client, '/admin/pesanan/batal', {
      ids: [order.id],
      reason: 'Coba-coba',
    }).loginAs(staff)
    response.assertHeader('location', '/staf')
    await order.refresh()
    assert.equal(order.status, OrderStatus.AWAITING_PICKUP)
    assert.isNull(await Order.query().where('status', OrderStatus.CANCELLED).first())
  })
})
