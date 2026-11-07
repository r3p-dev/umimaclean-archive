import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { errors as limiterErrors } from '@adonisjs/limiter'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { ActivityAction } from '#enums/activity_enum'
import { OrderStatus } from '#enums/order_enum'
import {
  PAYMENT_RECEIVED_STATUSES,
  PaymentChannel,
  PaymentMethod,
  PaymentMethodLabel,
  PaymentStatus,
  PaymentStatusLabel,
} from '#enums/payment_enum'
import Order from '#models/order'
import Payment from '#models/payment'
import type User from '#models/user'
import { formatRupiah } from '#helpers/money'
import ActivityLog from '#models/activity_log'
import Setting from '#models/setting'
import MidtransGateway, { type ProviderStatus } from '#services/midtrans_gateway'
import OrderService from '#services/order_service'
import { fieldError } from '#validators/shared/field_error'

const QR_LIFETIME_MINUTES = 15

const PAYMENT_UNAVAILABLE_MESSAGE =
  'Pembayaran QRIS belum tersedia. Bayar di toko atau hubungi kami via WhatsApp.'

const PROVIDER_STATUS: Record<string, PaymentStatus> = {
  capture: PaymentStatus.PAID,
  settlement: PaymentStatus.PAID,
  pending: PaymentStatus.PENDING,
  deny: PaymentStatus.FAILED,
  cancel: PaymentStatus.CANCELLED,
  expire: PaymentStatus.EXPIRED,
  failure: PaymentStatus.FAILED,
}

type PaymentCorrection = {
  method: PaymentMethod
  channel: PaymentChannel
  amount: number
  reason: string
}

type ReconciliationFlag =
  | 'ok'
  | 'paid_not_advanced'
  | 'expired_pending'
  | 'amount_mismatch'
  | 'waiting'
  | 'refund_due'
  | 'cancel_failed'
  | 'refunded'

const REVIEW_FLAGS: readonly ReconciliationFlag[] = [
  'refund_due',
  'cancel_failed',
  'amount_mismatch',
  'paid_not_advanced',
  'expired_pending',
]

type MismatchOutcome = 'refund' | 'accept'

type CounterPayment = {
  method: PaymentMethod
  cashReceived?: number | null
}

const PAID_PAYMENT_INDEX = 'payments_order_id_paid_unique'

function isSecondPaidPayment(error: unknown) {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === '23505' &&
    'constraint' in error &&
    error.constraint === PAID_PAYMENT_INDEX
  )
}

function alreadyPaid(error: unknown) {
  if (isSecondPaidPayment(error)) {
    return fieldError('form', 'Pesanan ini sudah dibayar.', 'payment.done')
  }
  return error
}

@inject()
export default class PaymentService {
  constructor(
    protected gateway: MidtransGateway,
    protected orders: OrderService
  ) {}

  async counterCheckout(id: number) {
    const order = await Order.query()
      .where('id', id)
      .preload('items', (items) => items.orderBy('position', 'asc'))
      .preload('bill', (bill) =>
        bill.preload('lines', (lines) => lines.preload('service').orderBy('id', 'asc'))
      )
      .preload('payments')
      .first()
    const methods = await Setting.get('payment_methods')
    const pending = order ? await this.currentQris(order) : null
    return { order, methods, pending }
  }

  findPaymentById(id: number) {
    return Payment.findOrFail(id)
  }

  async listQrisReconciliation() {
    // shortcut: shows the latest 300 QRIS charges; add date paging when volume grows
    const payments = await Payment.query()
      .whereNotNull('provider_order_id')
      .preload('order', (order) => order.preload('bill'))
      .orderBy('id', 'desc')
      .limit(300)
    const now = DateTime.now()

    return payments.map((payment) => {
      const flag = this.#reconciliationFlag(payment, now)
      return { payment, flag, needsReview: REVIEW_FLAGS.includes(flag) }
    })
  }

  #reconciliationFlag(payment: Payment, now: DateTime): ReconciliationFlag {
    const byStatus: Partial<Record<PaymentStatus, ReconciliationFlag>> = {
      [PaymentStatus.REFUND_DUE]: 'refund_due',
      [PaymentStatus.CANCEL_FAILED]: 'cancel_failed',
      [PaymentStatus.AMOUNT_MISMATCH]: 'amount_mismatch',
      [PaymentStatus.REFUNDED]: 'refunded',
    }
    const flag = byStatus[payment.status]
    if (flag) {
      return flag
    }
    if (
      payment.status === PaymentStatus.PAID &&
      payment.order.status === OrderStatus.AWAITING_PAYMENT
    ) {
      return 'paid_not_advanced'
    }
    if (payment.status === PaymentStatus.PENDING) {
      return payment.expiresAt && payment.expiresAt < now ? 'expired_pending' : 'waiting'
    }
    return 'ok'
  }

  isQrisAvailable() {
    return this.gateway.isConfigured()
  }

  async currentQris(order: Order) {
    return Payment.query()
      .where('order_id', order.id)
      .where('method', PaymentMethod.QRIS)
      .where('status', PaymentStatus.PENDING)
      .where('expires_at', '>', DateTime.now().toJSDate())
      .orderBy('id', 'desc')
      .first()
  }

  async startQris(order: Order, channel: PaymentChannel) {
    await order.load('bill')
    this.#assertPayable(order)
    if (!this.isQrisAvailable()) {
      throw fieldError('form', PAYMENT_UNAVAILABLE_MESSAGE, 'payment.unavailable')
    }

    const current = await this.currentQris(order)
    if (current?.qrUrl) {
      return current
    }

    try {
      await limiter
        .use({ requests: 5, duration: '15 mins', blockDuration: '15 mins' })
        .consume(`qris_charge_${order.id}`)
    } catch (error) {
      if (!(error instanceof limiterErrors.E_TOO_MANY_REQUESTS)) {
        throw error
      }
      throw fieldError(
        'form',
        'Terlalu banyak permintaan kode QR untuk pesanan ini. Coba lagi dalam 15 menit.',
        'payment.throttled'
      )
    }

    const providerOrderId = `UMC-${order.id}-${Date.now()}`
    const amount = order.bill.total

    let charge
    try {
      charge = await this.gateway.chargeQris({
        orderId: providerOrderId,
        amount,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        expiryMinutes: QR_LIFETIME_MINUTES,
      })
    } catch (error) {
      logger.error({ err: error, order: order.id }, 'QRIS charge failed')
      throw fieldError(
        'form',
        'Layanan pembayaran sedang tidak tersedia. Coba lagi sebentar.',
        'payment.provider'
      )
    }

    return db.transaction(async (transaction) => {
      await Payment.query({ client: transaction })
        .where('order_id', order.id)
        .where('status', PaymentStatus.PENDING)
        .update({ status: PaymentStatus.EXPIRED })
      return Payment.create(
        {
          orderId: order.id,
          channel,
          method: PaymentMethod.QRIS,
          status: PaymentStatus.PENDING,
          amount,
          providerOrderId,
          providerTransactionId: charge.transactionId,
          qrUrl: charge.qrUrl,
          expiresAt: DateTime.now().plus({ minutes: QR_LIFETIME_MINUTES }),
        },
        { client: transaction }
      )
    })
  }

  async handlePaymentNotification(notification: ProviderStatus) {
    const payment = await Payment.findBy('provider_order_id', notification.orderId)
    if (!payment) {
      logger.warn({ orderId: notification.orderId }, 'Payment notification for an unknown order')
      return null
    }
    return this.#apply(payment, notification)
  }

  async refreshPayment(payment: Payment) {
    if (!payment.providerOrderId || !this.isQrisAvailable()) {
      return payment
    }
    const status = await this.#askProvider(payment.providerOrderId)
    if (!status) {
      return payment
    }
    return this.#apply(payment, status)
  }

  async markRefunded(owner: User, id: number, note: string) {
    return db.transaction(async (transaction) => {
      const { order, payment } = await this.#lockForReview(transaction, id, [
        PaymentStatus.REFUND_DUE,
      ])
      return this.#resolve(owner, order, payment, PaymentStatus.REFUNDED, {
        note: `Dikembalikan: ${note}`,
        reason: note,
        transaction,
      })
    })
  }

  async resolveMismatch(owner: User, id: number, outcome: MismatchOutcome, note: string) {
    return db
      .transaction(async (transaction) => {
        const { order, payment } = await this.#lockForReview(transaction, id, [
          PaymentStatus.AMOUNT_MISMATCH,
        ])
        if (outcome === 'refund') {
          return this.#resolve(owner, order, payment, PaymentStatus.REFUND_DUE, {
            note: `Akan dikembalikan: ${note}`,
            reason: note,
            transaction,
          })
        }
        await order.load('bill')
        const paid = await Payment.query({ client: transaction })
          .where('order_id', order.id)
          .where('status', PaymentStatus.PAID)
          .first()
        if (paid) {
          throw fieldError(
            'form',
            'Pesanan ini sudah punya pembayaran lunas. Kembalikan dana ini.',
            'payment.done'
          )
        }
        if (!order.bill || payment.amount < order.bill.total) {
          throw fieldError(
            'form',
            order.bill
              ? `Dana diterima ${formatRupiah(payment.amount)} kurang dari tagihan ${formatRupiah(order.bill.total)}. Kembalikan dana ini.`
              : 'Pesanan ini belum punya tagihan. Kembalikan dana ini.',
            'payment.short'
          )
        }
        const accepted = await this.#resolve(owner, order, payment, PaymentStatus.PAID, {
          note: `Diterima owner: ${note}`,
          reason: note,
          transaction,
        })
        if (order.status === OrderStatus.AWAITING_PAYMENT) {
          await this.#settle(order, accepted, null, transaction)
        }
        return accepted
      })
      .catch((error) => {
        throw alreadyPaid(error)
      })
  }

  async markCancelHandled(owner: User, id: number, note: string) {
    return db.transaction(async (transaction) => {
      const { order, payment } = await this.#lockForReview(transaction, id, [
        PaymentStatus.CANCEL_FAILED,
      ])
      return this.#resolve(owner, order, payment, PaymentStatus.CANCELLED, {
        note: `Ditangani owner: ${note}`,
        reason: note,
        transaction,
      })
    })
  }

  async recheckCancel(owner: User, id: number) {
    return db.transaction(async (transaction) => {
      const { order, payment } = await this.#lockForReview(transaction, id, [
        PaymentStatus.CANCEL_FAILED,
      ])
      const status = await this.#askProvider(payment.providerOrderId!)
      const before = payment.status
      let result: Payment
      if (!status) {
        result = await this.#markCancelOutcome(payment, PaymentStatus.CANCELLED, transaction)
      } else if (this.#statusOf(status) === PaymentStatus.PENDING) {
        result = await this.#cancelAtProvider(payment, transaction)
      } else {
        result = await this.#apply(payment, status, transaction)
      }
      await this.#logReview(owner, order, result, before, 'cek ulang di Midtrans', transaction)
      return result
    })
  }

  async #askProvider(providerOrderId: string) {
    try {
      return await this.gateway.fetchTransactionStatus(providerOrderId)
    } catch (error) {
      logger.error({ err: error, providerOrderId }, 'Midtrans status check failed')
      throw fieldError('form', 'Midtrans tidak menjawab. Coba lagi sebentar.', 'payment.provider')
    }
  }

  async #lockForReview(
    transaction: TransactionClientContract,
    id: number,
    expected: PaymentStatus[]
  ) {
    const found = await Payment.query({ client: transaction }).where('id', id).first()
    if (!found) {
      throw new Exception('Pembayaran tidak ditemukan', { status: 404 })
    }
    const order = await this.orders.lockOrder(transaction, found.orderId)
    const payment = await Payment.query({ client: transaction })
      .where('id', id)
      .forUpdate()
      .firstOrFail()
    if (!expected.includes(payment.status)) {
      throw fieldError(
        'form',
        `Pembayaran ${payment.providerOrderId ?? payment.id} sudah berstatus "${PaymentStatusLabel[payment.status]}". Muat ulang halaman.`,
        'payment.reviewed'
      )
    }
    return { order, payment }
  }

  async #resolve(
    owner: User,
    order: Order,
    payment: Payment,
    status: PaymentStatus,
    options: { note: string; reason: string; transaction: TransactionClientContract }
  ) {
    const before = payment.status
    payment.useTransaction(options.transaction)
    payment.merge({ status, note: options.note })
    await payment.save()
    await this.#logReview(owner, order, payment, before, options.reason, options.transaction)
    if (status !== PaymentStatus.PAID) {
      options.transaction.after('commit', () => this.orders.broadcastOrder(order))
    }
    return payment
  }

  async #logReview(
    owner: User,
    order: Order,
    payment: Payment,
    before: PaymentStatus,
    reason: string,
    transaction: TransactionClientContract
  ) {
    const detail = `${payment.providerOrderId ?? `#${payment.id}`} · ${formatRupiah(payment.amount)} · ${PaymentStatusLabel[before]} → ${PaymentStatusLabel[payment.status]} · catatan: ${reason}`
    await ActivityLog.record(
      {
        actor: owner,
        order,
        action: ActivityAction.PAYMENT_REVIEWED,
        detail: detail.slice(0, 300),
        isSensitive: true,
      },
      transaction
    )
  }

  async recordCounterPayment(user: User, order: Order, input: CounterPayment) {
    await order.load('bill')
    this.#assertPayable(order)
    const methods = await Setting.get('payment_methods')
    if (!methods[input.method]) {
      throw fieldError('method', 'Metode ini sedang dinonaktifkan owner.', 'method.disabled')
    }
    const amount = order.bill.total
    if (input.method === PaymentMethod.CASH && (input.cashReceived ?? 0) < amount) {
      throw fieldError(
        'cashReceived',
        `Uang diterima kurang ${formatRupiah(amount - (input.cashReceived ?? 0))}.`,
        'cash.short'
      )
    }

    const { payment, charges } = await db
      .transaction(async (transaction) => {
        const locked = await this.orders.lockOrder(transaction, order.id)
        if (locked.status !== OrderStatus.AWAITING_PAYMENT) {
          throw fieldError('form', 'Pesanan ini sudah dibayar.', 'payment.done')
        }
        const pending = await this.#cancelPendingPayments(order.id, transaction)
        const created = await Payment.create(
          {
            orderId: order.id,
            channel: PaymentChannel.COUNTER,
            method: input.method,
            status: PaymentStatus.PAID,
            amount,
            cashReceived: input.cashReceived ?? null,
            paidAt: DateTime.now(),
            recordedBy: user.id,
          },
          { client: transaction }
        )
        await this.#settle(locked, created, user, transaction)
        return { payment: created, charges: pending }
      })
      .catch((error) => {
        throw alreadyPaid(error)
      })
    await this.#cancelCharges(charges)
    return payment
  }

  async correctPayment(owner: User, id: number, correction: PaymentCorrection) {
    let charges: Payment[] = []
    const corrected = await db
      .transaction(async (transaction) => {
        const order = await this.orders.lockOrder(transaction, id)
        const paid = await Payment.query({ client: transaction })
          .where('order_id', order.id)
          .where('status', PaymentStatus.PAID)
          .first()
        const label = `${PaymentMethodLabel[correction.method]} ${formatRupiah(correction.amount)}`

        if (paid) {
          const before = `${PaymentMethodLabel[paid.method]} ${formatRupiah(paid.amount)}`
          paid.useTransaction(transaction)
          paid.merge({
            method: correction.method,
            channel: correction.channel,
            amount: correction.amount,
            note: `Koreksi owner: ${correction.reason}`,
          })
          await paid.save()
          await ActivityLog.record(
            {
              actor: owner,
              order,
              action: ActivityAction.PAYMENT_CORRECTED,
              detail: `${before} → ${label} · alasan: ${correction.reason}`,
              isSensitive: true,
            },
            transaction
          )
          return order
        }

        if (order.status !== OrderStatus.AWAITING_PAYMENT) {
          throw fieldError(
            'form',
            'Pesanan ini belum punya tagihan atau sudah dibatalkan.',
            'payment.not_payable'
          )
        }
        charges = await this.#cancelPendingPayments(order.id, transaction)
        await Payment.create(
          {
            orderId: order.id,
            channel: correction.channel,
            method: correction.method,
            status: PaymentStatus.PAID,
            amount: correction.amount,
            paidAt: DateTime.now(),
            recordedBy: owner.id,
            note: `Dicatat owner: ${correction.reason}`,
          },
          { client: transaction }
        )
        await this.orders.transitionOrder(
          order,
          OrderStatus.IN_CLEANING,
          {
            actor: owner,
            note: `Lunas · ${PaymentMethodLabel[correction.method]} (dicatat owner)`,
            action: ActivityAction.PAYMENT_CORRECTED,
            detail: `Belum dibayar → ${label} · alasan: ${correction.reason}`,
            isSensitive: true,
          },
          transaction
        )
        return order
      })
      .catch((error) => {
        throw alreadyPaid(error)
      })
    await this.#cancelCharges(charges)
    return corrected
  }

  async #cancelPendingPayments(orderId: number, transaction: TransactionClientContract) {
    const pending = await Payment.query({ client: transaction })
      .where('order_id', orderId)
      .where('status', PaymentStatus.PENDING)
    await Payment.query({ client: transaction })
      .where('order_id', orderId)
      .where('status', PaymentStatus.PENDING)
      .update({ status: PaymentStatus.CANCELLED })
    const now = DateTime.now()
    return pending.filter(
      (payment) =>
        payment.method === PaymentMethod.QRIS &&
        payment.providerOrderId &&
        (!payment.expiresAt || payment.expiresAt > now)
    )
  }

  async #cancelCharges(charges: Payment[]) {
    for (const charge of charges) {
      try {
        await this.#cancelAtProvider(charge)
      } catch (error) {
        logger.error(
          { err: error, payment: charge.id },
          'Midtrans QRIS cancel could not be recorded'
        )
      }
    }
  }

  async #cancelAtProvider(payment: Payment, transaction?: TransactionClientContract) {
    const providerOrderId = payment.providerOrderId!
    let status: ProviderStatus | null
    try {
      status = await this.#cancelReply(providerOrderId)
    } catch (error) {
      logger.error(
        { err: error, payment: payment.id },
        'Midtrans QRIS cancel could not be confirmed'
      )
      return this.#markCancelOutcome(payment, PaymentStatus.CANCEL_FAILED, transaction)
    }
    if (!status) {
      logger.warn({ payment: payment.id, providerOrderId }, 'Midtrans has no such transaction')
      return this.#markCancelOutcome(payment, PaymentStatus.CANCELLED, transaction)
    }
    if (this.#statusOf(status) === PaymentStatus.PENDING) {
      return this.#markCancelOutcome(payment, PaymentStatus.CANCEL_FAILED, transaction)
    }
    return this.#apply(payment, status, transaction)
  }

  async #cancelReply(providerOrderId: string) {
    try {
      const reply = await this.gateway.cancelTransaction(providerOrderId)
      if (reply.transactionStatus === 'cancel') {
        return reply
      }
    } catch (error) {
      logger.warn({ err: error, providerOrderId }, 'Midtrans cancel did not answer')
    }
    return this.gateway.fetchTransactionStatus(providerOrderId)
  }

  async #markCancelOutcome(
    payment: Payment,
    status: PaymentStatus,
    transaction?: TransactionClientContract
  ) {
    const client = transaction ?? db.connection()
    await Payment.query({ client })
      .where('id', payment.id)
      .whereIn('status', [PaymentStatus.CANCELLED, PaymentStatus.CANCEL_FAILED])
      .update({
        status,
        ...(status === PaymentStatus.CANCELLED
          ? { note: 'Midtrans tidak mengenal transaksi ini' }
          : {}),
        updated_at: new Date(),
      })
    return Payment.query({ client }).where('id', payment.id).firstOrFail()
  }

  #statusOf(notification: ProviderStatus) {
    const status = PROVIDER_STATUS[notification.transactionStatus] ?? PaymentStatus.FAILED
    return status === PaymentStatus.PAID && notification.fraudStatus === 'challenge'
      ? PaymentStatus.PENDING
      : status
  }

  async #apply(
    payment: Payment,
    notification: ProviderStatus,
    transaction?: TransactionClientContract
  ): Promise<Payment> {
    if (!transaction) {
      return db.transaction((client) => this.#apply(payment, notification, client))
    }
    const status = this.#statusOf(notification)
    const order =
      status === PaymentStatus.PAID
        ? await this.orders.lockOrder(transaction, payment.orderId)
        : null
    const locked = await Payment.query({ client: transaction })
      .where('id', payment.id)
      .forUpdate()
      .firstOrFail()
    const broadcast = () =>
      transaction.after('commit', async () => {
        this.orders.broadcastOrder(order ?? (await Order.findOrFail(locked.orderId)))
      })

    if (PAYMENT_RECEIVED_STATUSES.includes(locked.status)) {
      if (locked.status === PaymentStatus.PAID && order?.status === OrderStatus.AWAITING_PAYMENT) {
        await this.#settle(order, locked, null, transaction)
      }
      return locked
    }
    if (
      locked.status === status ||
      (locked.status === PaymentStatus.CANCEL_FAILED && status === PaymentStatus.PENDING)
    ) {
      return locked
    }
    const transactionId = notification.transactionId ?? locked.providerTransactionId
    if (!order) {
      locked.merge({ status, providerTransactionId: transactionId })
      await locked.save()
      broadcast()
      return locked
    }

    const otherPaid = await Payment.query({ client: transaction })
      .where('order_id', order.id)
      .where('status', PaymentStatus.PAID)
      .first()
    const gross = Number(notification.grossAmount)
    const isReadable = notification.grossAmount !== '' && Number.isFinite(gross) && gross > 0
    const received = isReadable ? Math.round(gross) : locked.amount
    const isExact = isReadable && gross === locked.amount
    const outcome = otherPaid
      ? PaymentStatus.REFUND_DUE
      : isExact
        ? PaymentStatus.PAID
        : PaymentStatus.AMOUNT_MISMATCH
    if (outcome !== PaymentStatus.PAID) {
      logger.error(
        { payment: locked.id, order: order.id, gross: notification.grossAmount, outcome },
        'QRIS settlement needs review'
      )
    }
    locked.merge({
      status: outcome,
      amount: received,
      note: isExact
        ? locked.note
        : isReadable
          ? `Ditagih ${formatRupiah(locked.amount)}, diterima ${formatRupiah(received)}`
          : 'Nominal dari Midtrans tidak terbaca',
      providerTransactionId: transactionId,
      paidAt: DateTime.now(),
    })
    await locked.save()
    if (outcome === PaymentStatus.PAID && order.status === OrderStatus.AWAITING_PAYMENT) {
      await this.#settle(order, locked, null, transaction)
    } else {
      broadcast()
    }
    return locked
  }

  async #settle(
    order: Order,
    payment: Payment,
    user: User | null,
    transaction: TransactionClientContract
  ) {
    const label = PaymentMethodLabel[payment.method]
    await this.orders.transitionOrder(
      order,
      OrderStatus.IN_CLEANING,
      {
        actor: user,
        note: `Lunas · ${label}`,
        action: ActivityAction.PAYMENT_RECORDED,
        detail: `${label} · ${formatRupiah(payment.amount)}`,
      },
      transaction
    )
  }

  #assertPayable(order: Order) {
    if (order.status !== OrderStatus.AWAITING_PAYMENT || !order.bill) {
      throw fieldError(
        'form',
        order.status === OrderStatus.AWAITING_PAYMENT
          ? 'Tagihan pesanan ini belum dibuat.'
          : 'Pesanan ini tidak menunggu pembayaran.',
        'payment.not_payable'
      )
    }
  }
}
