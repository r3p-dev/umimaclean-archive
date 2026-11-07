import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { orderNumber } from '#helpers/order'
import { OrderSource } from '#enums/order_enum'
import { PaymentChannel, PaymentStatus } from '#enums/payment_enum'
import OrderPolicy from '#policies/order_policy'
import OrderService from '#services/order_service'
import PaymentService from '#services/payment_service'
import { maskPhone, normalizePhone } from '#helpers/phone'
import { qrisOf } from '#transformers/order_transformer'
import ReceiptTransformer from '#transformers/receipt_transformer'
import { counterPaymentValidator, walkInValidator } from '#validators/staff/store'
import { fieldError } from '#validators/shared/field_error'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'

@inject()
export default class StoreController {
  constructor(
    protected orders: OrderService,
    protected payments: PaymentService
  ) {}

  async walkIn({ bouncer, inertia, request }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const phone = normalizePhone(String(request.qs().nomor ?? ''))
    const found = phone ? await this.orders.lookupWalkInCustomer(phone) : null
    let match = null
    if (found) {
      const { customer, address, orders } = found
      const last = orders[0]?.createdAt.setZone(SERVICE_ZONE).setLocale('id').toFormat('d LLL')
      match = {
        phone: phone!,
        name: customer.name,
        initial: customer.name[0] ?? '',
        masked: maskPhone(customer.phone),
        history: orders.length
          ? `${orders.length} pesanan · terakhir ${last}`
          : 'Belum ada pesanan',
        area: address
          ? `sekitar ${address.addressText.split(',').slice(-3, -1).join(',').trim()}`
          : null,
        address: address?.addressText ?? null,
        point: address ? { lat: address.lat, lng: address.lng } : null,
      }
    }
    return inertia.render('staff/store/walk_in', { lookup: phone ? { phone, match } : null })
  }

  async store({ auth, bouncer, request, response }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const payload = await request.validateUsing(walkInValidator)
    const order = await this.orders.createWalkInOrder(auth.getUserOrFail(), payload.phone, payload)
    return response.redirect().toRoute('staff.inspection', { id: order.id })
  }

  async payment({ bouncer, inertia, params }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const { order, methods, pending } = await this.payments.counterCheckout(params.id)

    return inertia.render('staff/store/payment', {
      id: Number(params.id),
      number: orderNumber(params.id),
      order:
        order && order.source === OrderSource.STORE
          ? {
              ...new ReceiptTransformer(order).toObject(),
              isSaved: !!order.bill,
              isPaid: order.payments.some((payment) => payment.status === PaymentStatus.PAID),
            }
          : null,
      methods,
      isQrisAvailable: this.payments.isQrisAvailable(),
      qris: pending ? qrisOf(pending) : null,
    })
  }

  async recordPayment({ auth, bouncer, params, request, response, session }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const order = await this.#order(params.id)
    const payload = await request.validateUsing(counterPaymentValidator)
    await this.payments.recordCounterPayment(auth.getUserOrFail(), order, payload)
    session.flash('success', 'Pembayaran dicatat. Pesanan masuk Dalam Pencucian.')
    return response.redirect().toRoute('staff.store_payment', { id: order.id })
  }

  async startQris({ bouncer, params, response }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const order = await this.#order(params.id)
    await this.payments.startQris(order, PaymentChannel.COUNTER)
    return response.redirect().toRoute('staff.store_payment', { id: order.id })
  }

  async checkQris({ bouncer, params, response }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const order = await this.#order(params.id)
    const pending = await this.payments.currentQris(order)
    if (pending) {
      await this.payments.refreshPayment(pending)
    }
    return response.redirect().toRoute('staff.store_payment', { id: order.id })
  }

  async #order(id: number) {
    const order = await this.orders.findOrderById(id)
    if (!order) {
      throw fieldError('form', 'Pesanan tidak ditemukan.', 'order.missing')
    }
    return order
  }
}
