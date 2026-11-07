import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { enterAdminArea } from '#abilities/main'
import { OrderStatusLabel } from '#enums/order_enum'
import { PaymentChannelLabel, PaymentStatusLabel } from '#enums/payment_enum'
import PaymentService from '#services/payment_service'
import { resolveMismatchValidator, reviewPaymentValidator } from '#validators/admin/reconciliation'
import { formatEvent } from '#transformers/order_transformer'

@inject()
export default class ReconciliationController {
  constructor(protected payments: PaymentService) {}

  async index({ inertia }: HttpContext) {
    const rows = await this.payments.listQrisReconciliation()

    return inertia.render('admin/reconciliation', {
      isAvailable: this.payments.isQrisAvailable(),
      rows: rows.map(({ payment, flag, needsReview }) => {
        const order = payment.order
        return {
          id: payment.id,
          providerOrderId: payment.providerOrderId!,
          transactionId: payment.providerTransactionId,
          orderId: order.id,
          number: order.number(),
          customer: order.customerName,
          channel: PaymentChannelLabel[payment.channel],
          amount: payment.amount,
          billTotal: order.bill?.total ?? null,
          status: PaymentStatusLabel[payment.status],
          orderStatus: OrderStatusLabel[order.status],
          createdAt: formatEvent(payment.createdAt),
          paidAt: payment.paidAt ? formatEvent(payment.paidAt) : null,
          note: payment.note,
          flag,
          needsReview,
        }
      }),
    })
  }

  async refresh({ bouncer, params, response, session }: HttpContext) {
    await bouncer.authorize(enterAdminArea)
    const payment = await this.payments.findPaymentById(params.id)
    if (!this.payments.isQrisAvailable()) {
      session.flash('error', 'Midtrans belum dikonfigurasi, status tidak bisa dicek.')
      return response.redirect().toRoute('admin.reconciliation')
    }
    const updated = await this.payments.refreshPayment(payment)
    session.flash(
      'success',
      `Status ${updated.providerOrderId}: ${PaymentStatusLabel[updated.status]}.`
    )
    return response.redirect().toRoute('admin.reconciliation')
  }

  async refunded({ auth, bouncer, params, request, response, session }: HttpContext) {
    await bouncer.authorize(enterAdminArea)
    const { note } = await request.validateUsing(reviewPaymentValidator)
    const payment = await this.payments.markRefunded(auth.getUserOrFail(), params.id, note)
    session.flash('success', `${payment.providerOrderId} ditandai sudah dikembalikan.`)
    return response.redirect().toRoute('admin.reconciliation')
  }

  async mismatch({ auth, bouncer, params, request, response, session }: HttpContext) {
    await bouncer.authorize(enterAdminArea)
    const { outcome, note } = await request.validateUsing(resolveMismatchValidator)
    const payment = await this.payments.resolveMismatch(
      auth.getUserOrFail(),
      params.id,
      outcome,
      note
    )
    session.flash(
      'success',
      outcome === 'accept'
        ? `${payment.providerOrderId} diterima sebagai pembayaran pesanan.`
        : `${payment.providerOrderId} dipindah ke “Perlu refund”.`
    )
    return response.redirect().toRoute('admin.reconciliation')
  }

  async recheck({ auth, bouncer, params, response, session }: HttpContext) {
    await bouncer.authorize(enterAdminArea)
    if (!this.payments.isQrisAvailable()) {
      session.flash('error', 'Midtrans belum dikonfigurasi, status tidak bisa dicek.')
      return response.redirect().toRoute('admin.reconciliation')
    }
    const payment = await this.payments.recheckCancel(auth.getUserOrFail(), params.id)
    session.flash(
      'success',
      `Status ${payment.providerOrderId}: ${PaymentStatusLabel[payment.status]}.`
    )
    return response.redirect().toRoute('admin.reconciliation')
  }

  async handled({ auth, bouncer, params, request, response, session }: HttpContext) {
    await bouncer.authorize(enterAdminArea)
    const { note } = await request.validateUsing(reviewPaymentValidator)
    const payment = await this.payments.markCancelHandled(auth.getUserOrFail(), params.id, note)
    session.flash('success', `${payment.providerOrderId} ditandai sudah ditangani.`)
    return response.redirect().toRoute('admin.reconciliation')
  }
}
