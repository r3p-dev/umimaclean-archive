import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OrderAddressFactory } from '#database/factories/order_address_factory'
import { OrderFactory } from '#database/factories/order_factory'
import {
  ItemKind,
  OrderAddressType,
  OrderSource,
  OrderStatus,
  ReturnMethod,
} from '#enums/order_enum'
import { PaymentChannel, PaymentMethod, PaymentStatus } from '#enums/payment_enum'
import Bill from '#models/bill'
import type Order from '#models/order'
import OrderEvent from '#models/order_event'
import OrderItem from '#models/order_item'
import Payment from '#models/payment'
import type User from '#models/user'
import OrderService from '#services/order_service'
import { createOrder, inertia, useApp } from '#tests/support/app'

const CUSTOMER_PHONE = '6281563290817'
const RECIPIENT_PHONE = '6281320574619'

async function walkIn(staff: User, overrides: Record<string, unknown> = {}) {
  const order = await OrderFactory.merge({
    source: OrderSource.STORE,
    returnMethod: ReturnMethod.STORE,
    status: OrderStatus.IN_INSPECTION,
    customerName: 'Wulan Sari',
    customerPhone: CUSTOMER_PHONE,
    itemsSepatu: 2,
    itemsTas: 1,
    note: 'Tali sepatu kiri lepas',
    pickupDate: null,
    pickupSlot: null,
    ...overrides,
  }).create()
  await OrderEvent.create({
    orderId: order.id,
    status: OrderStatus.IN_INSPECTION,
    actorId: staff.id,
  })
  return order
}

async function deliverTo(order: Order) {
  await order.merge({ returnMethod: ReturnMethod.DELIVERY }).save()
  await OrderAddressFactory.merge({
    orderId: order.id,
    type: OrderAddressType.DELIVERY,
    recipientName: 'Sri Wahyuni',
    recipientPhone: RECIPIENT_PHONE,
    addressText: 'Jl. Kopo Permai II Blok 3A No. 7, Margahayu, Kab. Bandung',
    landmark: 'Depan masjid',
  }).create()
}

async function bill(order: Order, staff: User, isPaid: boolean) {
  const item = await OrderItem.create({
    orderId: order.id,
    kind: ItemKind.SHOE,
    name: 'Sepatu putih',
    note: '',
    position: 1,
  })
  await Bill.create({ orderId: order.id, total: 55000, decidedBy: staff.id })
  if (isPaid) {
    await Payment.create({
      orderId: order.id,
      channel: PaymentChannel.COUNTER,
      method: PaymentMethod.CASH,
      status: PaymentStatus.PAID,
      amount: 55000,
      cashReceived: 100000,
      paidAt: DateTime.now(),
      recordedBy: staff.id,
    })
  }
  return item
}

test.group('Staff print documents', (group) => {
  useApp(group)

  test('print pages are for staff only', async ({ client }) => {
    const staff = await UserFactory.apply('staff').create()
    const customer = await UserFactory.create()
    const order = await walkIn(staff, { status: OrderStatus.READY_FOR_DELIVERY })
    await deliverTo(order)
    await bill(order, staff, true)

    for (const path of ['label', 'struk']) {
      const url = `/staf/cetak/${order.id}/${path}`
      const asCustomer = await client.get(url).loginAs(customer).redirects(0)
      asCustomer.assertHeader('location', '/beranda')
      const asGuest = await client.get(url).redirects(0)
      asGuest.assertHeader('location', '/staf/masuk')
      const asStaff = await inertia(client, url).loginAs(staff)
      asStaff.assertStatus(200)
    }
  })

  test('there is no intake slip (tanda terima) any more', async ({ client }) => {
    const staff = await UserFactory.apply('staff').create()
    const order = await walkIn(staff)

    const response = await client.get(`/staf/cetak/${order.id}/tanda-terima`).loginAs(staff)
    response.assertStatus(404)
  })

  test('the delivery label uses the delivery snapshot recipient', async ({ client, assert }) => {
    const staff = await UserFactory.apply('staff').create()
    const order = await walkIn(staff, { status: OrderStatus.READY_FOR_DELIVERY })
    await deliverTo(order)
    await bill(order, staff, false)

    const response = await inertia(client, `/staf/cetak/${order.id}/label`).loginAs(staff)
    response.assertInertiaComponent('staff/print/label')
    const { label } = response.inertiaProps as { label: Record<string, unknown> }
    assert.equal(label.recipient, 'Sri Wahyuni')
    assert.equal(label.phone, '+62 813-2057-4619')
    assert.notEqual(label.phone, '+62 815-6329-0817')
    assert.equal(label.landmark, 'Depan masjid')
    assert.equal(label.itemCount, 1)
    assert.deepEqual(label.items, ['Sepatu putih'])
    assert.isFalse(label.isPaid)
    assert.equal(label.due, 55000)
  })

  test('the delivery label is refused before packing or without a delivery address', async ({
    client,
  }) => {
    const staff = await UserFactory.apply('staff').create()
    const atStore = await walkIn(staff, { status: OrderStatus.READY_FOR_COLLECTION })
    const washing = await walkIn(staff, { status: OrderStatus.IN_CLEANING })
    await deliverTo(washing)

    for (const order of [atStore, washing]) {
      const response = await inertia(client, `/staf/cetak/${order.id}/label`).loginAs(staff)
      response.assertStatus(404)
    }
  })

  test('the paid receipt opens once the order is paid', async ({ client, assert }) => {
    const staff = await UserFactory.apply('staff').create()
    const unpaid = await walkIn(staff, { status: OrderStatus.AWAITING_PAYMENT })
    await bill(unpaid, staff, false)
    const refused = await inertia(client, `/staf/cetak/${unpaid.id}/struk`).loginAs(staff)
    refused.assertStatus(404)

    const paid = await walkIn(staff, { status: OrderStatus.IN_CLEANING })
    await bill(paid, staff, true)
    const response = await inertia(client, `/staf/cetak/${paid.id}/struk`).loginAs(staff)
    response.assertInertiaComponent('staff/print/receipt')
    const { receipt } = response.inertiaProps as {
      receipt: { total: number; payment: { method: string; cashReceived: number; change: number } }
    }
    assert.equal(receipt.total, 55000)
    assert.equal(receipt.payment.method, 'Tunai')
    assert.equal(receipt.payment.cashReceived, 100000)
    assert.equal(receipt.payment.change, 45000)
  })

  test('staff pages only offer documents the print routes return', async ({ client, assert }) => {
    const staff = await UserFactory.apply('staff').create()
    const owner = await UserFactory.apply('admin').create()
    const flags = async (url: string, key: string) => {
      const response = await inertia(client, url).loginAs(staff)
      return (response.inertiaProps as Record<string, Record<string, unknown>>)[key]
    }
    const wash = (order: Order) => flags(`/staf/proses/${order.id}/cuci`, 'order')

    const online = await createOrder(await UserFactory.create(), {
      status: OrderStatus.READY_FOR_DELIVERY,
    })
    await Bill.create({ orderId: online.id, total: 45000, decidedBy: staff.id })
    await Payment.create({
      orderId: online.id,
      channel: PaymentChannel.ONLINE,
      method: PaymentMethod.QRIS,
      status: PaymentStatus.PAID,
      amount: 45000,
      providerOrderId: `UMC-${online.id}-1`,
      paidAt: DateTime.now(),
    })
    assert.include(await wash(online), { canPrintLabel: true, canPrintReceipt: true })
    const queue = await inertia(client, '/staf/antar').loginAs(staff)
    const [task] = (queue.inertiaProps as { tasks: Record<string, unknown>[] }).tasks
    assert.include(task, { ref: online.number(), canPrintLabel: true, canPrintReceipt: true })

    const collected = await walkIn(staff, { status: OrderStatus.COMPLETED })
    await bill(collected, staff, true)
    assert.include(await wash(collected), { canPrintLabel: false, canPrintReceipt: true })
    const unpaid = await walkIn(staff, { status: OrderStatus.AWAITING_PAYMENT })
    await bill(unpaid, staff, false)
    const counter = await inertia(client, `/staf/transaksi/${unpaid.id}/bayar`).loginAs(staff)
    assert.include((counter.inertiaProps as { order: Record<string, unknown> }).order, {
      isPaid: false,
    })

    const cancelled = await walkIn(staff, { status: OrderStatus.READY_FOR_DELIVERY })
    await deliverTo(cancelled)
    await bill(cancelled, staff, true)
    const orders = await app.container.make(OrderService)
    await orders.cancelOrdersByOwner(owner, [cancelled.id], 'Pelanggan minta batal')
    assert.include(await wash(cancelled), { canPrintLabel: false, canPrintReceipt: true })
    const refused = await inertia(client, `/staf/cetak/${cancelled.id}/label`).loginAs(staff)
    refused.assertStatus(404)
  })
})
