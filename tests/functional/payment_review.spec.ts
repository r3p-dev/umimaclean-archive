import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { ActivityAction } from '#enums/activity_enum'
import { OrderStatus } from '#enums/order_enum'
import { PaymentStatus } from '#enums/payment_enum'
import ActivityLog from '#models/activity_log'
import Bill from '#models/bill'
import Order from '#models/order'
import Payment from '#models/payment'
import type User from '#models/user'
import PaymentService from '#services/payment_service'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import { createOrder, inertia, post, useApp } from '#tests/support/app'

type Setup = {
  status: PaymentStatus
  amount?: number
  bill?: number
  orderStatus?: OrderStatus
  isOrderPaid?: boolean
  customer?: User
  paidAt?: DateTime
}

async function qrisIn(setup: Setup) {
  const staff = await UserFactory.apply('staff').create()
  const order = await createOrder(setup.customer ?? (await UserFactory.create()), {
    status: setup.orderStatus ?? OrderStatus.AWAITING_PAYMENT,
  })
  await Bill.create({ orderId: order.id, total: setup.bill ?? 45000, decidedBy: staff.id })
  if (setup.isOrderPaid) {
    await Payment.create({
      orderId: order.id,
      channel: 'counter',
      method: 'cash',
      status: PaymentStatus.PAID,
      amount: setup.bill ?? 45000,
      paidAt: setup.paidAt ?? DateTime.now(),
    })
  }
  const qris = await Payment.create({
    orderId: order.id,
    channel: 'online',
    method: 'qris',
    status: setup.status,
    amount: setup.amount ?? setup.bill ?? 45000,
    providerOrderId: `UMC-${order.id}-${Date.now()}`,
    paidAt: setup.status === PaymentStatus.CANCEL_FAILED ? null : (setup.paidAt ?? DateTime.now()),
    expiresAt: DateTime.now().minus({ minutes: 1 }),
  })
  return { order, qris }
}

async function rowOf(client: ApiClient, owner: User, id: number) {
  const page = await inertia(client, '/admin/rekonsiliasi').loginAs(owner)
  const { rows } = page.inertiaProps as {
    rows: { id: number; flag: string; needsReview: boolean; status: string; note: string | null }[]
  }
  return rows.find((row) => row.id === id)
}

async function done(client: ApiClient, owner: User, id: number, path: string, body = {}) {
  const response = await post(client, `/admin/rekonsiliasi/${id}/${path}`, body).loginAs(owner)
  response.assertStatus(302)
}

function reviewLogs() {
  return ActivityLog.query().where('action', ActivityAction.PAYMENT_REVIEWED).orderBy('id', 'asc')
}

test.group('Owner resolves payments that need review', (group) => {
  const state = useApp(group)

  test('a refund due is marked refunded with a note and leaves "Perlu dicek"', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const { order, qris } = await qrisIn({
      status: PaymentStatus.REFUND_DUE,
      orderStatus: OrderStatus.IN_CLEANING,
      isOrderPaid: true,
    })

    const response = await post(client, `/admin/rekonsiliasi/${qris.id}/dikembalikan`, {
      note: 'Transfer BCA 6 Nov 14.20',
    }).loginAs(owner)
    response.assertStatus(302)

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.REFUNDED)
    assert.equal(qris.note, 'Dikembalikan: Transfer BCA 6 Nov 14.20')
    const logs = await reviewLogs()
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].actorId, owner.id)
    assert.equal(logs[0].orderId, order.id)
    assert.isTrue(logs[0].isSensitive)
    assert.include(logs[0].detail, 'Perlu refund → Sudah dikembalikan')
    assert.include(logs[0].detail, 'Transfer BCA 6 Nov 14.20')
    assert.containsSubset(await rowOf(client, owner, qris.id), {
      flag: 'refunded',
      needsReview: false,
      status: 'Sudah dikembalikan',
      note: 'Dikembalikan: Transfer BCA 6 Nov 14.20',
    })
  })

  test('every review action needs a note', async ({ client, assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const { qris } = await qrisIn({ status: PaymentStatus.REFUND_DUE, isOrderPaid: true })

    for (const [url, body] of [
      ['dikembalikan', { note: '' }],
      ['nominal', { outcome: 'refund', note: ' ' }],
      ['ditangani', {}],
    ] as const) {
      const response = await post(client, `/admin/rekonsiliasi/${qris.id}/${url}`, body).loginAs(
        owner
      )
      response.assertStatus(422)
      response.assertBodyContains({ errors: [{ field: 'note' }] })
    }
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.REFUND_DUE)
    assert.lengthOf(await reviewLogs(), 0)
  })

  test('each action refuses a payment in the wrong status', async ({ client, assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const cases = [
      ['dikembalikan', PaymentStatus.PAID, { note: 'Sudah transfer' }],
      ['dikembalikan', PaymentStatus.AMOUNT_MISMATCH, { note: 'Sudah transfer' }],
      ['nominal', PaymentStatus.REFUND_DUE, { outcome: 'accept', note: 'Terima saja' }],
      ['nominal', PaymentStatus.CANCEL_FAILED, { outcome: 'refund', note: 'Kembalikan' }],
      ['cek-ulang', PaymentStatus.REFUND_DUE, {}],
      ['ditangani', PaymentStatus.EXPIRED, { note: 'Sudah dicek' }],
      ['ditangani', PaymentStatus.REFUNDED, { note: 'Sudah dicek' }],
    ] as const

    for (const [url, status, body] of cases) {
      const { qris } = await qrisIn({ status })
      const response = await post(client, `/admin/rekonsiliasi/${qris.id}/${url}`, body).loginAs(
        owner
      )
      response.assertStatus(422)
      response.assertBodyContains({ errors: [{ field: 'form' }] })
      await qris.refresh()
      assert.equal(qris.status, status, `${url} on ${status}`)
    }
    assert.lengthOf(await reviewLogs(), 0)
    assert.isEmpty(state.gateway.statusChecks)
  })

  test('a second submission is refused and logged once', async ({ client, assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const { qris } = await qrisIn({ status: PaymentStatus.REFUND_DUE, isOrderPaid: true })
    const submit = () =>
      post(client, `/admin/rekonsiliasi/${qris.id}/dikembalikan`, { note: 'Transfer' }).loginAs(
        owner
      )

    const first = await submit()
    first.assertStatus(302)
    const again = await submit()
    again.assertStatus(422)
    again.assertBodyContains({ errors: [{ field: 'form' }] })
    assert.lengthOf(await reviewLogs(), 1)
  })

  test('two simultaneous submissions change the payment once', async ({ assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const { qris } = await qrisIn({ status: PaymentStatus.AMOUNT_MISMATCH, amount: 50000 })
    const payments = await app.container.make(PaymentService)

    const results = await Promise.allSettled([
      payments.resolveMismatch(owner, qris.id, 'accept', 'Kelebihan dianggap tip'),
      payments.resolveMismatch(owner, qris.id, 'refund', 'Kembalikan semua'),
    ])

    assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected'])
    assert.lengthOf(await reviewLogs(), 1)
    assert.lengthOf(await Payment.query().where('id', qris.id), 1)
  })

  test('staff, customers and guests cannot use the review actions', async ({ client, assert }) => {
    const staff = await UserFactory.apply('staff').create()
    const customer = await UserFactory.create()
    const { qris } = await qrisIn({ status: PaymentStatus.REFUND_DUE, isOrderPaid: true })

    for (const url of ['dikembalikan', 'nominal', 'cek-ulang', 'ditangani']) {
      const body = { outcome: 'refund', note: 'Coba-coba' }
      const asStaff = await post(client, `/admin/rekonsiliasi/${qris.id}/${url}`, body).loginAs(
        staff
      )
      asStaff.assertHeader('location', '/staf')
      const asCustomer = await post(client, `/admin/rekonsiliasi/${qris.id}/${url}`, body).loginAs(
        customer
      )
      assert.notEqual(asCustomer.status(), 200)
      assert.notEqual(asCustomer.header('location'), '/admin/rekonsiliasi')
      const asGuest = await post(client, `/admin/rekonsiliasi/${qris.id}/${url}`, body)
      assert.oneOf(asGuest.status(), [302, 401])
      assert.notEqual(asGuest.header('location'), '/admin/rekonsiliasi')
    }
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.REFUND_DUE)
    assert.lengthOf(await reviewLogs(), 0)
  })

  test('a mismatch refunded in full goes through "Perlu refund" to refunded', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const { order, qris } = await qrisIn({ status: PaymentStatus.AMOUNT_MISMATCH, amount: 30000 })

    await done(client, owner, qris.id, 'nominal', {
      outcome: 'refund',
      note: 'Kurang bayar, kembalikan',
    })
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.REFUND_DUE)
    assert.containsSubset(await rowOf(client, owner, qris.id), { needsReview: true })

    await done(client, owner, qris.id, 'dikembalikan', {
      note: 'Tunai di toko',
    })
    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.REFUNDED)
    assert.equal(qris.amount, 30000)
    assert.lengthOf(await reviewLogs(), 2)
    await order.refresh()
    assert.equal(order.status, OrderStatus.AWAITING_PAYMENT)
  })

  test('a mismatch of at least the bill can be accepted and advances the order', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const { order, qris } = await qrisIn({ status: PaymentStatus.AMOUNT_MISMATCH, amount: 50000 })

    await done(client, owner, qris.id, 'nominal', {
      outcome: 'accept',
      note: 'Pelanggan setuju kelebihan jadi tip',
    })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.PAID)
    assert.equal(qris.amount, 50000)
    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_CLEANING)
    const settled = await Order.query().where('id', order.id).preload('events').firstOrFail()
    assert.equal(settled.events.at(-1)?.note, 'Lunas · QRIS')
    assert.lengthOf(await reviewLogs(), 1)
    assert.containsSubset(await rowOf(client, owner, qris.id), { flag: 'ok', needsReview: false })
  })

  test('accepting a mismatch is refused below the bill or when the order is already paid', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const short = await qrisIn({ status: PaymentStatus.AMOUNT_MISMATCH, amount: 40000 })
    const paid = await qrisIn({
      status: PaymentStatus.AMOUNT_MISMATCH,
      amount: 60000,
      orderStatus: OrderStatus.IN_CLEANING,
      isOrderPaid: true,
    })

    for (const { qris, order } of [short, paid]) {
      const response = await post(client, `/admin/rekonsiliasi/${qris.id}/nominal`, {
        outcome: 'accept',
        note: 'Terima saja',
      }).loginAs(owner)
      response.assertStatus(422)
      response.assertBodyContains({ errors: [{ field: 'form' }] })
      await qris.refresh()
      assert.equal(qris.status, PaymentStatus.AMOUNT_MISMATCH)
      const status = order.status
      await order.refresh()
      assert.equal(order.status, status)
    }
    assert.lengthOf(await Payment.query().where('status', PaymentStatus.PAID), 1)
    assert.lengthOf(await reviewLogs(), 0)
  })

  test('"Cek ulang di Midtrans" applies the real transaction status', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const cases = [
      { midtrans: 'cancel', cancel: undefined, expected: PaymentStatus.CANCELLED, retried: false },
      { midtrans: 'expire', cancel: undefined, expected: PaymentStatus.EXPIRED, retried: false },
      {
        midtrans: 'settlement',
        cancel: undefined,
        expected: PaymentStatus.REFUND_DUE,
        retried: false,
      },
      {
        midtrans: 'pending',
        cancel: { statusCode: '200', transactionStatus: 'cancel' },
        expected: PaymentStatus.CANCELLED,
        retried: true,
      },
      {
        midtrans: 'pending',
        cancel: { statusCode: '412', transactionStatus: '' },
        expected: PaymentStatus.CANCEL_FAILED,
        retried: true,
      },
    ]

    for (const entry of cases) {
      const { qris } = await qrisIn({
        status: PaymentStatus.CANCEL_FAILED,
        orderStatus: OrderStatus.IN_CLEANING,
        isOrderPaid: true,
      })
      state.gateway.cancels = []
      state.gateway.providerStatus = {
        orderId: qris.providerOrderId!,
        transactionStatus: entry.midtrans,
        grossAmount: '45000.00',
        statusCode: '200',
      }
      if (entry.cancel) {
        state.gateway.cancelReply = entry.cancel
      }

      await done(client, owner, qris.id, 'cek-ulang')

      await qris.refresh()
      assert.equal(qris.status, entry.expected, `${entry.midtrans} → ${entry.expected}`)
      assert.deepEqual(state.gateway.cancels, entry.retried ? [qris.providerOrderId] : [])
    }
    assert.lengthOf(await reviewLogs(), cases.length)
    assert.lengthOf(await Payment.query().where('status', PaymentStatus.PAID), cases.length)
  })

  test('"Cek ulang" cancels locally when Midtrans has no such transaction', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const { qris } = await qrisIn({ status: PaymentStatus.CANCEL_FAILED, isOrderPaid: true })
    state.gateway.providerStatus = null

    await done(client, owner, qris.id, 'cek-ulang')

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCELLED)
    assert.equal(qris.note, 'Midtrans tidak mengenal transaksi ini')
  })

  test('"Cek ulang" changes nothing when Midtrans does not answer', async ({ client, assert }) => {
    const owner = await UserFactory.apply('admin').create()
    const { qris } = await qrisIn({ status: PaymentStatus.CANCEL_FAILED, isOrderPaid: true })
    state.gateway.isStatusUnreachable = true

    const response = await post(client, `/admin/rekonsiliasi/${qris.id}/cek-ulang`).loginAs(owner)
    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'form' }] })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCEL_FAILED)
    assert.lengthOf(await reviewLogs(), 0)
  })

  test('a cancel failure Midtrans cannot resolve is marked handled with a note', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const { qris } = await qrisIn({ status: PaymentStatus.CANCEL_FAILED, isOrderPaid: true })

    await done(client, owner, qris.id, 'ditangani', {
      note: 'Dicek di dashboard Midtrans, tidak ada',
    })

    await qris.refresh()
    assert.equal(qris.status, PaymentStatus.CANCELLED)
    assert.equal(qris.note, 'Ditangani owner: Dicek di dashboard Midtrans, tidak ada')
    assert.containsSubset(await rowOf(client, owner, qris.id), {
      flag: 'ok',
      needsReview: false,
      status: 'Dibatalkan',
    })
    assert.lengthOf(await reviewLogs(), 1)
  })
})

test.group('Reports show money received outside revenue', (group) => {
  useApp(group)

  test('paid, refund due, mismatch and refunded money are reported separately', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const today = DateTime.now().setZone(SERVICE_ZONE).set({ hour: 12, minute: 0 })
    const longAgo = today.minus({ days: 40 })
    await qrisIn({
      customer,
      status: PaymentStatus.REFUND_DUE,
      bill: 100000,
      amount: 45000,
      orderStatus: OrderStatus.IN_CLEANING,
      isOrderPaid: true,
      paidAt: today,
    })
    await qrisIn({ customer, status: PaymentStatus.AMOUNT_MISMATCH, amount: 30000, paidAt: today })
    await qrisIn({ customer, status: PaymentStatus.REFUNDED, amount: 20000, paidAt: longAgo })
    await qrisIn({ customer, status: PaymentStatus.CANCEL_FAILED, amount: 99000 })

    for (const url of ['/admin', '/admin/laporan']) {
      const page = await inertia(client, url).loginAs(owner)
      const { report } = page.inertiaProps as {
        report: { start: string; days: [string, ...number[]][] }
      }
      assert.isTrue(report.start <= longAgo.toISODate()!, `${url} starts ${report.start}`)
      const day = (date: DateTime) => report.days.find((row) => row[0] === date.toISODate())!
      const sums = report.days.reduce(
        (total, row) => total.map((value, index) => value + Number(row[index + 1])),
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      )
      assert.deepEqual(day(today).slice(1, 2), [100000], `${url} revenue`)
      assert.deepEqual(day(today).slice(7), [45000, 30000, 0], `${url} today`)
      assert.deepEqual(day(longAgo).slice(7), [0, 0, 20000], `${url} 40 days ago`)
      assert.deepEqual(
        [sums[0], sums[1], sums[6], sums[7], sums[8]],
        [100000, 1, 45000, 30000, 20000],
        `${url} period`
      )
    }

    const customers = await inertia(client, '/admin/pelanggan').loginAs(owner)
    const row = (
      customers.inertiaProps as { customers: { id: string; spend: number; held: number }[] }
    ).customers.find((entry) => entry.id === String(customer.id))
    assert.containsSubset(row, { spend: 100000, held: 75000 })

    const orders = await inertia(client, '/admin/pesanan').loginAs(owner)
    const labels = (orders.inertiaProps as { orders: { payment: string }[] }).orders.map(
      (order) => order.payment
    )
    assert.includeMembers(labels, [
      'Lunas · Tunai · QRIS perlu dicek',
      'Belum dibayar · QRIS perlu dicek',
    ])
  })

  test('the order detail lists QRIS money received beside the paid payment', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const { order } = await qrisIn({
      status: PaymentStatus.REFUND_DUE,
      orderStatus: OrderStatus.IN_CLEANING,
      isOrderPaid: true,
    })

    const page = await inertia(client, `/admin/pesanan/${order.id}`).loginAs(owner)
    const { detail } = (
      page.inertiaProps as {
        order: { detail: { payRows: { label: string; value: string }[]; isPaid: boolean } }
      }
    ).order
    assert.isTrue(detail.isPaid)
    const extra = detail.payRows.find((entry) => entry.label === 'QRIS lain diterima')
    assert.match(extra?.value ?? '', /^Rp\s?45\.000 · Perlu refund/)
  })
})
