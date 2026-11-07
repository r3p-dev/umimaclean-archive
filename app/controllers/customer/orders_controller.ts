import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { OrderStatus } from '#enums/order_enum'
import { PaymentChannel } from '#enums/payment_enum'
import OrderPolicy from '#policies/order_policy'
import OrderService, { orderFilterOf, orderSearchTerm } from '#services/order_service'
import PaymentService from '#services/payment_service'
import SettingService from '#services/setting_service'
import OrderTransformer, { qrisOf } from '#transformers/order_transformer'
import ReceiptTransformer from '#transformers/receipt_transformer'
import { cancelOrderValidator } from '#validators/customer/cancel'
import { unlockTrackingValidator } from '#validators/customer/tracking'

@inject()
export default class OrdersController {
  constructor(
    protected orders: OrderService,
    protected payments: PaymentService,
    protected settings: SettingService
  ) {}

  async index({ inertia, auth, request }: HttpContext) {
    const { status, q: query, page } = request.qs()
    const filter = orderFilterOf(status)
    const search = orderSearchTerm(query)

    const result = await this.orders.listOrdersForCustomer(auth.getUserOrFail(), {
      filter,
      search,
      page: Math.max(1, Number(page) || 1),
    })

    return inertia.render('customer/orders/index', {
      orders: result.orders.map((order) => new OrderTransformer(order).toObject()),
      meta: result.meta,
      filter,
      search,
      counts: result.counts,
    })
  }

  async show(ctx: HttpContext) {
    const { order, canView } = await this.#viewable(ctx)
    if (!canView) {
      return this.#unlockPage(ctx, order)
    }

    const isOwner = await ctx.bouncer.with(OrderPolicy).allows('own', order)
    return ctx.inertia.render('customer/orders/show', {
      order: new OrderTransformer(order, isOwner).toObject(),
      isOwner,
    })
  }

  async oldBill({ params, response }: HttpContext) {
    return response.redirect().toRoute('customer.orders.show', { id: params.id })
  }

  async receipt(ctx: HttpContext) {
    const { order, canView } = await this.#viewable(ctx)
    if (!canView) {
      return this.#unlockPage(ctx, order)
    }
    if (order.status !== OrderStatus.COMPLETED) {
      return ctx.response.redirect().toRoute('customer.orders.show', { id: order.id })
    }

    return ctx.inertia.render('customer/orders/receipt', {
      receipt: new ReceiptTransformer(order).toObject(),
      store: await this.settings.storeProfile(),
    })
  }

  async unlock({ params, request, response, session }: HttpContext) {
    const order = await this.#find(params.id)
    const { digits } = await request.validateUsing(unlockTrackingValidator)
    await this.orders.unlockTracking(session, order, digits, request.ip())
    return response.redirect().back()
  }

  async pay({ bouncer, inertia, params }: HttpContext) {
    const order = await this.#owned(bouncer, params.id)
    const payment = await this.payments.currentQris(order)

    return inertia.render('customer/payment/qris', {
      id: order.id,
      number: order.number(),
      order: new OrderTransformer(order).toObject(),
      qris: payment ? qrisOf(payment) : null,
      isAvailable: this.payments.isQrisAvailable(),
    })
  }

  async cancel({ auth, bouncer, params, request, response, session }: HttpContext) {
    const order = await this.#owned(bouncer, params.id)
    await bouncer.with(OrderPolicy).authorize('cancel', order)
    const { reason } = await request.validateUsing(cancelOrderValidator)
    await this.orders.cancelOrderByCustomer(auth.getUserOrFail(), order, reason)
    session.flash('success', 'Pesanan dibatalkan.')
    return response.redirect().toRoute('customer.orders.show', { id: order.id })
  }

  async startPayment({ bouncer, params, response }: HttpContext) {
    const order = await this.#owned(bouncer, params.id)
    await bouncer.with(OrderPolicy).authorize('pay', order)
    await this.payments.startQris(order, PaymentChannel.ONLINE)
    return response.redirect().toRoute('customer.orders.pay', { id: order.id })
  }

  async checkPayment({ bouncer, params, response }: HttpContext) {
    const order = await this.#owned(bouncer, params.id)
    const payment = await this.payments.currentQris(order)
    if (payment) {
      await this.payments.refreshPayment(payment)
    }
    return response.redirect().toRoute('customer.orders.pay', { id: order.id })
  }

  async #find(id: number) {
    const order = await this.orders.findOrderWithHistory(id)
    if (!order) {
      throw new Exception('Pesanan tidak ditemukan', { status: 404 })
    }
    return order
  }

  async #owned(bouncer: HttpContext['bouncer'], id: number) {
    const order = await this.#find(id)
    if (!(await bouncer.with(OrderPolicy).allows('own', order))) {
      throw new Exception('Pesanan tidak ditemukan', { status: 404 })
    }
    return order
  }

  async #viewable({ bouncer, params, session }: HttpContext) {
    const order = await this.#find(params.id)
    const canView = await bouncer
      .with(OrderPolicy)
      .allows('view', order, this.orders.isTrackingUnlocked(session, order))
    return { order, canView }
  }

  #unlockPage({ inertia }: HttpContext, order: { id: number; number(): string }) {
    return inertia.render('customer/orders/unlock', { id: order.id, number: order.number() })
  }
}
