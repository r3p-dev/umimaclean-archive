import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OrderStatus } from '#enums/order_enum'
import { PaymentStatus } from '#enums/payment_enum'
import ActivityLog from '#models/activity_log'
import Bill from '#models/bill'
import Order from '#models/order'
import Payment from '#models/payment'
import Service from '#models/service'
import Setting, { DEFAULT_SETTINGS } from '#models/setting'
import User from '#models/user'
import AreaService from '#services/area_service'
import BillingService from '#services/billing_service'
import PaymentService from '#services/payment_service'
import SettingService from '#services/setting_service'
import StaffService from '#services/staff_service'
import TaskService from '#services/task_service'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import { createOrder, inertia, seedCatalogue, useApp } from '#tests/support/app'

async function withFailingLog(run: () => Promise<void>) {
  const record = ActivityLog.record
  ActivityLog.record = async () => {
    throw new Error('activity log is down')
  }
  try {
    await run()
  } finally {
    ActivityLog.record = record
  }
}

test.group('Consistency under failure and concurrency', (group) => {
  const state = useApp(group)

  test('two pickups started at the same time leave one trip running', async ({ assert }) => {
    const courier = await UserFactory.apply('staff').create()
    const customer = await UserFactory.create()
    const today = DateTime.now().setZone(SERVICE_ZONE).startOf('day')
    const first = await createOrder(customer, { pickupDate: today })
    const second = await createOrder(customer, { pickupDate: today })
    const tasks = await app.container.make(TaskService)

    const results = await Promise.allSettled([
      tasks.startTrip(courier, first.id, 'pickup'),
      tasks.startTrip(courier, second.id, 'pickup'),
    ])

    assert.lengthOf(
      results.filter((result) => result.status === 'fulfilled'),
      1
    )
    assert.lengthOf(await Order.query().where('status', OrderStatus.COURIER_EN_ROUTE), 1)
  })

  test('an owner change is rolled back when its activity log cannot be written', async ({
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const staff = await UserFactory.apply('staff').create()
    const [service] = await seedCatalogue()
    const settings = await app.container.make(SettingService)
    const billing = await app.container.make(BillingService)
    const areas = await app.container.make(AreaService)
    const accounts = await app.container.make(StaffService)

    await withFailingLog(async () => {
      await assert.rejects(() =>
        settings.saveStoreSettings(owner, {
          storeName: 'Toko Baru',
          whatsapp: '6285157900974',
          storeAddress: DEFAULT_SETTINGS.store.address,
          hours: DEFAULT_SETTINGS.store.hours,
          slots: DEFAULT_SETTINGS.pickup_slots,
          payments: { qris: false, cash: true },
          inactiveDays: 30,
        })
      )
      await assert.rejects(() => billing.setPricesActive(owner, [service.id], false))
      await assert.rejects(() => billing.removePrices(owner, [service.id]))
      await assert.rejects(() => areas.setAreaActive(owner, state.areas.covered.id, false))
      await assert.rejects(() =>
        accounts.createStaff(owner, { name: 'Staf Baru', phone: '6281200001111', role: 'staff' })
      )
      await assert.rejects(() =>
        accounts.updateStaff(owner, staff, {
          name: 'Nama Diubah',
          phone: staff.phone,
          role: 'staff',
        })
      )
      await assert.rejects(() => accounts.setStaffActive(owner, staff, false))
    })

    const store = await Setting.get('store')
    assert.equal(store.name, DEFAULT_SETTINGS.store.name)
    assert.equal(await Setting.get('inactive_days'), DEFAULT_SETTINGS.inactive_days)
    await service.refresh()
    assert.isTrue(service.isActive)
    assert.isNull(service.deletedAt)
    await state.areas.covered.refresh()
    assert.isTrue(state.areas.covered.isActive)
    assert.isNull(await User.findBy('phone', '6281200001111'))
    const unchanged = await User.findOrFail(staff.id)
    assert.notEqual(unchanged.name, 'Nama Diubah')
    assert.isTrue(unchanged.isActive)
    assert.lengthOf(await ActivityLog.all(), 0)
  })

  test('switching services on leaves deleted ones off', async ({ assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const [service] = await seedCatalogue()
    await service.merge({ isActive: false, deletedAt: DateTime.now() }).save()
    const billing = await app.container.make(BillingService)

    await billing.setPricesActive(owner, [service.id], true)

    const stored = await Service.findOrFail(service.id)
    assert.isFalse(stored.isActive)
  })

  test('the database refuses a second paid payment for one order', async ({ assert }) => {
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.IN_CLEANING,
    })
    const paid = {
      orderId: order.id,
      channel: 'counter' as const,
      method: 'cash' as const,
      status: PaymentStatus.PAID,
      amount: 45000,
      paidAt: DateTime.now(),
    }
    await Payment.create(paid)

    await assert.rejects(() => Payment.create(paid))
    assert.lengthOf(await Payment.query().where('status', PaymentStatus.PAID), 1)
  })
})

test.group('A pending QRIS when the order is paid another way', (group) => {
  const state = useApp(group)

  async function orderWithQris() {
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.AWAITING_PAYMENT,
    })
    await Bill.create({ orderId: order.id, total: 45000, decidedBy: staff.id })
    const qris = await Payment.create({
      orderId: order.id,
      channel: 'online',
      method: 'qris',
      status: PaymentStatus.PENDING,
      amount: 45000,
      providerOrderId: `UMC-${order.id}-1`,
      expiresAt: DateTime.now().plus({ minutes: 15 }),
    })
    return { staff, order, qris }
  }

  async function reviewOf(client: ApiClient, id: number) {
    const owner = await UserFactory.apply('admin').create()
    const page = await inertia(client, '/admin/rekonsiliasi').loginAs(owner)
    const { rows } = page.inertiaProps as {
      rows: { id: number; flag: string; needsReview: boolean }[]
    }
    const row = rows.find((entry) => entry.id === id)
    return row && { flag: row.flag, needsReview: row.needsReview }
  }

  test('a cash payment cancels the live QR at Midtrans after it is saved', async ({ assert }) => {
    const { staff, order, qris } = await orderWithQris()
    const payments = await app.container.make(PaymentService)

    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })

    assert.deepEqual(state.gateway.cancels, [qris.providerOrderId])
    assert.isEmpty(state.gateway.statusChecks)
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCELLED)
    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_CLEANING)
  })

  test('an owner-recorded payment also cancels the live QR', async ({ assert }) => {
    const { order, qris } = await orderWithQris()
    const owner = await UserFactory.apply('admin').create()
    const payments = await app.container.make(PaymentService)

    await payments.correctPayment(owner, order.id, {
      method: 'cash',
      channel: 'counter',
      amount: 45000,
      reason: 'Bayar tunai di toko',
    })

    assert.deepEqual(state.gateway.cancels, [qris.providerOrderId])
  })

  test('a refused cancel is checked against Midtrans: expired there means expired here', async ({
    client,
    assert,
  }) => {
    const { staff, order, qris } = await orderWithQris()
    state.gateway.cancelReply = { statusCode: '412', statusMessage: 'Merchant cannot modify' }
    state.gateway.providerStatus = {
      orderId: qris.providerOrderId!,
      transactionStatus: 'expire',
      grossAmount: '45000.00',
      statusCode: '407',
    }
    const payments = await app.container.make(PaymentService)

    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })

    assert.deepEqual(state.gateway.statusChecks, [qris.providerOrderId])
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.EXPIRED)
    assert.deepEqual(await reviewOf(client, qris.id), { flag: 'ok', needsReview: false })
  })

  test('a cancel that does not answer while the QR was paid becomes a refund', async ({
    client,
    assert,
  }) => {
    const { staff, order, qris } = await orderWithQris()
    state.gateway.cancelReply = 'unreachable'
    state.gateway.providerStatus = {
      orderId: qris.providerOrderId!,
      transactionStatus: 'settlement',
      grossAmount: '45000.00',
      transactionId: 'tx-late',
      statusCode: '200',
    }
    const payments = await app.container.make(PaymentService)

    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.REFUND_DUE)
    assert.equal(qris.providerTransactionId, 'tx-late')
    assert.isNotNull(qris.paidAt)
    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_CLEANING)
    const paid = await Payment.query().where('status', PaymentStatus.PAID)
    assert.lengthOf(paid, 1)
    assert.equal(paid[0].method, 'cash')
    assert.deepEqual(await reviewOf(client, qris.id), { flag: 'refund_due', needsReview: true })
  })

  test('a QR still pending after the cancel is flagged cancel_failed', async ({
    client,
    assert,
  }) => {
    const { staff, order, qris } = await orderWithQris()
    state.gateway.cancelReply = { statusCode: '500', statusMessage: 'Internal error' }
    state.gateway.providerStatus = {
      orderId: qris.providerOrderId!,
      transactionStatus: 'pending',
      grossAmount: '45000.00',
      statusCode: '201',
    }
    const payments = await app.container.make(PaymentService)

    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCEL_FAILED)
    assert.deepEqual(await reviewOf(client, qris.id), {
      flag: 'cancel_failed',
      needsReview: true,
    })
  })

  test('a QR Midtrans does not know is cancelled here with a note', async ({ assert }) => {
    const { staff, order, qris } = await orderWithQris()
    state.gateway.cancelReply = { statusCode: '404', statusMessage: "Transaction doesn't exist." }
    state.gateway.providerStatus = null
    const payments = await app.container.make(PaymentService)

    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCELLED)
    assert.equal(qris.note, 'Midtrans tidak mengenal transaksi ini')
  })

  test('when cancel and status both fail the cash payment stays and the QR is flagged', async ({
    client,
    assert,
  }) => {
    const { staff, order, qris } = await orderWithQris()
    state.gateway.cancelReply = 'unreachable'
    state.gateway.isStatusUnreachable = true
    const payments = await app.container.make(PaymentService)

    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCEL_FAILED)
    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_CLEANING)
    assert.lengthOf(await Payment.query().where('status', PaymentStatus.PAID), 1)
    assert.deepEqual(await reviewOf(client, qris.id), {
      flag: 'cancel_failed',
      needsReview: true,
    })
  })

  test('a Midtrans cancel notification marks the QR cancelled', async ({ client, assert }) => {
    const { staff, order, qris } = await orderWithQris()
    state.gateway.cancelReply = 'unreachable'
    state.gateway.isStatusUnreachable = true
    const payments = await app.container.make(PaymentService)
    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })
    const notify = (status: string) =>
      client.post('/webhooks/midtrans').json({
        order_id: qris.providerOrderId,
        transaction_status: status,
        status_code: '200',
        gross_amount: '45000.00',
        signature_key: 'valid-signature',
      })

    await notify('pending')
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCEL_FAILED)

    await notify('cancel')
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCELLED)
  })

  test('a settlement after the order was paid becomes a refund to handle and needs review', async ({
    client,
    assert,
  }) => {
    const { staff, order, qris } = await orderWithQris()
    const payments = await app.container.make(PaymentService)
    await payments.recordCounterPayment(staff, order, { method: 'cash', cashReceived: 50000 })

    await payments.handlePaymentNotification({
      orderId: qris.providerOrderId!,
      transactionStatus: 'settlement',
      grossAmount: '45000.00',
      statusCode: '200',
    })

    const paid = await Payment.query().where('order_id', order.id).where('status', 'paid')
    assert.lengthOf(paid, 1)
    assert.equal(paid[0].method, 'cash')
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.REFUND_DUE)
    assert.isNull(qris.note)
    assert.deepEqual(await reviewOf(client, qris.id), {
      flag: 'refund_due',
      needsReview: true,
    })
  })

  test('a paid amount that differs from the charge is flagged by status, not by note text', async ({
    client,
    assert,
  }) => {
    const { qris } = await orderWithQris()
    const payments = await app.container.make(PaymentService)

    await payments.handlePaymentNotification({
      orderId: qris.providerOrderId!,
      transactionStatus: 'settlement',
      grossAmount: '1000.00',
      statusCode: '200',
    })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.AMOUNT_MISMATCH)
    assert.equal(qris.amount, 1000)
    assert.isNotNull(qris.paidAt)
    await qris.merge({ note: null }).save()
    assert.deepEqual(await reviewOf(client, qris.id), {
      flag: 'amount_mismatch',
      needsReview: true,
    })
  })
})
