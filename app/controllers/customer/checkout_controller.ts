import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import OrderPolicy from '#policies/order_policy'
import AddressService from '#services/address_service'
import { MAX_ADDRESSES } from '#services/constants'
import OrderService from '#services/order_service'
import AddressTransformer from '#transformers/address_transformer'
import UserTransformer from '#transformers/user_transformer'
import { createOrderValidator, type OrderPayload } from '#validators/customer/order'

const DRAFT_KEY = 'order_draft'

@inject()
export default class CheckoutController {
  constructor(
    protected orders: OrderService,
    protected addresses: AddressService
  ) {}

  async create({ inertia, auth, request, session, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const addresses = await this.addresses.listAddresses(user)
    const draft = (session.get(DRAFT_KEY) as OrderPayload | undefined) ?? null
    const repeatId = Number(request.qs().ulang) || null
    const repeat = repeatId ? await this.orders.findOrderWithHistory(repeatId) : null
    const repeatItems =
      repeat && (await bouncer.with(OrderPolicy).allows('own', repeat))
        ? { sepatu: repeat.itemsSepatu, tas: repeat.itemsTas, helm: 0 }
        : null
    return inertia.render('customer/order/create', {
      addresses: addresses.map((address) => new AddressTransformer(address).toObject()),
      canAddAddress: addresses.length < MAX_ADDRESSES,
      draft: draft
        ? {
            key: draft.key,
            items: draft.items,
            note: draft.note ?? '',
            date: draft.date,
            slot: draft.slot,
            pickupAddressId: draft.pickupAddressId,
            deliveryAddressId: draft.deliveryAddressId ?? null,
          }
        : null,
      repeatItems,
      availability: await this.orders.upcomingSlotAvailability(),
    })
  }

  async review({ request, response, auth, session }: HttpContext) {
    const payload = await request.validateUsing(createOrderValidator)
    await this.orders.checkOrder(auth.getUserOrFail(), payload)
    session.put(DRAFT_KEY, payload)
    return response.redirect().toRoute('customer.order.confirm')
  }

  async confirm({ inertia, auth, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const draft = await this.#draft(session)
    if (!draft) {
      return response.redirect().toRoute('customer.order.create')
    }
    const pickup = await this.addresses.findAddress(user, draft.pickupAddressId)
    if (!pickup) {
      return response.redirect().toRoute('customer.order.create')
    }
    const delivery = draft.deliveryAddressId
      ? await this.addresses.findAddress(user, draft.deliveryAddressId)
      : null
    return inertia.render('customer/order/confirm', {
      draft: { items: draft.items, note: draft.note ?? '', date: draft.date, slot: draft.slot },
      pickupAddress: new AddressTransformer(pickup).toObject(),
      deliveryAddress: delivery ? new AddressTransformer(delivery).toObject() : null,
      customer: new UserTransformer(user).toObject(),
    })
  }

  async store({ auth, response, session }: HttpContext) {
    const draft = session.get(DRAFT_KEY)
    if (!draft) {
      return response.redirect().toRoute('customer.order.create')
    }
    const payload = await createOrderValidator.validate(draft)
    const order = await this.orders.placeOrder(auth.getUserOrFail(), payload)
    session.forget(DRAFT_KEY)
    session.flash('success', 'Pesanan dibuat. Kurir menghubungi via WhatsApp sebelum datang.')
    return response.redirect().toRoute('customer.orders.show', { id: order.id })
  }

  async #draft(session: HttpContext['session']) {
    const stored = session.get(DRAFT_KEY)
    if (!stored) {
      return null
    }
    try {
      return await createOrderValidator.validate(stored)
    } catch {
      session.forget(DRAFT_KEY)
      return null
    }
  }
}
