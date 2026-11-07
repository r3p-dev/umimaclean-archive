import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { OrderStatus } from '#enums/order_enum'
import { PaymentMethod } from '#enums/payment_enum'
import Bill from '#models/bill'
import Order from '#models/order'
import Payment from '#models/payment'
import Service from '#models/service'
import { createOrder, inertia, post, postWalkIn, seedCatalogue, useApp } from '#tests/support/app'

const SHOE_LINE = {
  name: 'Sneakers putih',
  kind: 'Sepatu',
  note: '',
  main: { name: 'Deep Clean', price: 45000 },
  addons: [{ name: 'Whitening', price: 10000 }],
  subtotal: 55000,
}

const BAG_LINE = {
  name: 'Ransel',
  kind: 'Tas',
  note: '',
  main: { name: 'Cuci Tas', price: 40000 },
  addons: [],
  subtotal: 40000,
}

test.group('Bill breakdown', (group) => {
  const state = useApp(group)

  async function inspect(
    client: Parameters<typeof post>[0],
    order: Order,
    staff: Awaited<ReturnType<typeof UserFactory.create>>
  ) {
    const [deepClean, whitening, bagWash] = await seedCatalogue()
    await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [
        {
          kind: 'shoe',
          itemName: 'Sneakers putih',
          services: { main: deepClean.id, addons: [whitening.id] },
        },
        { kind: 'bag', itemName: 'Ransel', services: { main: bagWash.id, addons: [] } },
      ],
    }).loginAs(staff)
  }

  test('an online order awaiting payment shows each service on its own line and the stored total', async ({
    client,
    assert,
  }) => {
    const customer = await UserFactory.create()
    const staff = await UserFactory.apply('staff').create()
    const owner = await UserFactory.apply('admin').create()
    const order = await createOrder(customer, { status: OrderStatus.IN_INSPECTION })
    await inspect(client, order, staff)

    const page = await inertia(client, `/pesanan/${order.id}`).loginAs(customer)
    page.assertInertiaComponent('customer/orders/show')
    const { bill } = (page.inertiaProps as { order: { status: number; bill: unknown } }).order
    assert.deepInclude(bill, {
      items: [SHOE_LINE, BAG_LINE],
      extras: [{ label: 'Antar-jemput', amount: 0 }],
      total: 95000,
    })
    const stored = await Bill.findByOrFail('order_id', order.id)
    assert.equal(stored.total, 95000)

    await post(client, `/pesanan/${order.id}/bayar`).loginAs(customer)
    assert.equal(state.gateway.charges[0].amount, 95000)

    const detail = await inertia(client, `/admin/pesanan/${order.id}`).loginAs(owner)
    const ownerBill = (detail.inertiaProps as { order: { detail: { bill: unknown } } }).order.detail
      .bill
    assert.deepInclude(ownerBill, { items: [SHOE_LINE, BAG_LINE], total: 95000 })

    const old = await client.get(`/pesanan/${order.id}/tagihan`).loginAs(customer).redirects(0)
    old.assertStatus(302)
    old.assertHeader('location', `/pesanan/${order.id}`)
  })

  test('the WhatsApp bill lists the same lines and total as the order page', async ({
    client,
    assert,
  }) => {
    const customer = await UserFactory.create()
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(customer, { status: OrderStatus.IN_INSPECTION })
    await inspect(client, order, staff)

    const message = state.fonnte.messages.at(-1)!.message
    assert.include(
      message,
      [
        '1. Sneakers putih (Sepatu)',
        '   Deep Clean: Rp45.000',
        '   + Whitening: Rp10.000',
        '   Subtotal: Rp55.000',
        '',
        '2. Ransel (Tas)',
        '   Cuci Tas: Rp40.000',
        '   Subtotal: Rp40.000',
        '',
        'Antar-jemput: Gratis',
        'Total: Rp95.000',
      ].join('\n')
    )
  })

  test('the saved inspection keeps showing the stored prices after a price change', async ({
    client,
    assert,
  }) => {
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.IN_INSPECTION,
    })
    await inspect(client, order, staff)
    const deepClean = await Service.findByOrFail('name', 'Deep Clean')
    await deepClean.merge({ price: 99000 }).save()

    const page = await inertia(client, `/staf/proses/${order.id}/periksa`).loginAs(staff)
    const inspection = (page.inertiaProps as { order: { bill: unknown; total: number } }).order
    assert.deepInclude(inspection.bill, { items: [SHOE_LINE, BAG_LINE], total: 95000 })
    assert.equal(inspection.total, 95000)
  })

  test('the walk-in counter, the paid receipt and the struk use the same lines', async ({
    client,
    assert,
  }) => {
    const staff = await UserFactory.apply('staff').create()
    await postWalkIn(client, {
      phone: '0812 7777 8888',
      name: 'Andi Pratama',
      items: { sepatu: 1, tas: 1, helm: 0 },
      returnMethod: 'store',
    }).loginAs(staff)
    const order = await Order.firstOrFail()
    await inspect(client, order, staff)

    const counter = await inertia(client, `/staf/transaksi/${order.id}/bayar`).loginAs(staff)
    assert.deepInclude((counter.inertiaProps as { order: object }).order, {
      items: [SHOE_LINE, BAG_LINE],
      extras: [],
      total: 95000,
    })

    await post(client, `/staf/transaksi/${order.id}/bayar`, {
      method: 'cash',
      cashReceived: 100000,
    }).loginAs(staff)
    const payment = await Payment.findByOrFail('order_id', order.id)
    assert.equal(payment.amount, 95000)

    const struk = await inertia(client, `/staf/cetak/${order.id}/struk`).loginAs(staff)
    assert.deepInclude((struk.inertiaProps as { receipt: object }).receipt, {
      items: [SHOE_LINE, BAG_LINE],
      total: 95000,
    })
  })
})

test.group('EDC is not a payment method', (group) => {
  useApp(group)

  test('the counter and the owner correction refuse a card payment', async ({ client, assert }) => {
    assert.notInclude(Object.values(PaymentMethod), 'card')
    const staff = await UserFactory.apply('staff').create()
    const owner = await UserFactory.apply('admin').create()
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.AWAITING_PAYMENT,
    })
    await Bill.create({ orderId: order.id, total: 45000, decidedBy: staff.id })

    const counter = await post(client, `/staf/transaksi/${order.id}/bayar`, {
      method: 'card',
    }).loginAs(staff)
    counter.assertStatus(422)
    counter.assertBodyContains({ errors: [{ field: 'method' }] })

    const correction = await post(client, `/admin/pesanan/${order.id}/pembayaran`, {
      method: 'card',
      amount: 45000,
      correctionReason: 'Bayar pakai kartu',
    }).loginAs(owner)
    correction.assertStatus(422)

    assert.lengthOf(await Payment.all(), 0)
    await order.refresh()
    assert.equal(order.status, OrderStatus.AWAITING_PAYMENT)
  })
})
