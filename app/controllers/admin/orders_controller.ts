import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { orderNumber } from '#helpers/order'
import { PaymentChannel, PaymentMethod } from '#enums/payment_enum'
import OrderPolicy from '#policies/order_policy'
import OrderService from '#services/order_service'
import PaymentService from '#services/payment_service'
import AdminOrderDetailTransformer from '#transformers/admin_order_detail_transformer'
import AdminOrderTransformer from '#transformers/admin_order_transformer'
import {
  cancelOrdersValidator,
  correctPaymentValidator,
  moveOrdersValidator,
} from '#validators/admin/order'

const FIX_METHOD = {
  qris_counter: { method: PaymentMethod.QRIS, channel: PaymentChannel.COUNTER },
  cash: { method: PaymentMethod.CASH, channel: PaymentChannel.COUNTER },
  qris_online: { method: PaymentMethod.QRIS, channel: PaymentChannel.ONLINE },
} as const

@inject()
export default class OrdersController {
  constructor(
    protected orders: OrderService,
    protected payments: PaymentService
  ) {}

  async index({ bouncer, inertia }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('manage')
    // shortcut: loads every order for client-side filtering; page on the server past a few thousand orders
    const orders = await this.orders.listOrdersForOwner()
    return inertia.render('admin/orders/list', {
      orders: orders.map((order) => new AdminOrderTransformer(order).toObject()),
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('manage')
    const detail = await this.orders.findOrderDetailForOwner(params.id)
    if (!detail) {
      return inertia.render('admin/orders/detail', {
        id: Number(params.id),
        number: orderNumber(params.id),
        order: null,
      })
    }
    const { order, logs, history } = detail
    return inertia.render('admin/orders/detail', {
      id: order.id,
      number: order.number(),
      order: {
        ...new AdminOrderTransformer(order).toObject(),
        detail: new AdminOrderDetailTransformer(order, logs).toObject(),
        history: history.map((entry) => new AdminOrderTransformer(entry).toObject()),
      },
    })
  }

  async move({ auth, bouncer, request, response, session }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('manage')
    const payload = await request.validateUsing(moveOrdersValidator)
    const result = await this.orders.moveOrdersToStage(
      auth.getUserOrFail(),
      payload.ids,
      payload.stage
    )
    const failed = result.failed.map((entry) => `${entry.number} (${entry.reason})`).join(', ')
    session.flash(
      result.moved.length ? 'success' : 'error',
      [
        `${result.moved.length} pesanan diubah${result.moved.length ? ' dan tercatat di Aktivitas Staf' : ''}.`,
        ...(failed ? [`Tidak diubah: ${failed}.`] : []),
      ].join(' ')
    )
    return response.redirect().back()
  }

  async cancel({ auth, bouncer, request, response, session }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('manage')
    const payload = await request.validateUsing(cancelOrdersValidator)
    const result = await this.orders.cancelOrdersByOwner(
      auth.getUserOrFail(),
      payload.ids,
      payload.reason
    )
    session.flash(
      result.cancelled ? 'success' : 'error',
      `${result.cancelled} pesanan dibatalkan${result.skipped ? `, ${result.skipped} dilewati` : ''}.`
    )
    return response.redirect().back()
  }

  async correctPayment({ auth, bouncer, params, request, response, session }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('manage')
    const payload = await request.validateUsing(correctPaymentValidator)
    await this.payments.correctPayment(auth.getUserOrFail(), params.id, {
      ...FIX_METHOD[payload.method],
      amount: payload.amount,
      reason: payload.correctionReason,
    })
    session.flash('success', 'Koreksi pembayaran disimpan dan tercatat di log aktivitas.')
    return response.redirect().back()
  }
}
