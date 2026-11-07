import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { displayPhone } from '#helpers/phone'
import OrderPolicy from '#policies/order_policy'
import OrderService from '#services/order_service'
import SettingService from '#services/setting_service'
import DeliveryLabelTransformer from '#transformers/delivery_label_transformer'
import ReceiptTransformer from '#transformers/receipt_transformer'

@inject()
export default class PrintsController {
  constructor(
    protected orders: OrderService,
    protected settings: SettingService
  ) {}

  async label({ bouncer, inertia, params }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const order = await this.#order(params.id)
    if (!order.canPrintLabel()) {
      throw new Exception('Label antar belum tersedia untuk pesanan ini', { status: 404 })
    }

    return inertia.render('staff/print/label', {
      label: new DeliveryLabelTransformer(order).toObject(),
      store: await this.#store(),
    })
  }

  async receipt({ bouncer, inertia, params }: HttpContext) {
    await bouncer.with(OrderPolicy).authorize('work')
    const order = await this.#order(params.id)
    if (!order.canPrintReceipt()) {
      throw new Exception('Struk tersedia setelah pesanan lunas', { status: 404 })
    }

    return inertia.render('staff/print/receipt', {
      receipt: new ReceiptTransformer(order).toObject(),
      store: await this.#store(),
    })
  }

  async #order(id: number) {
    const order = await this.orders.findOrderWithHistory(id)
    if (!order) {
      throw new Exception('Pesanan tidak ditemukan', { status: 404 })
    }
    return order
  }

  async #store() {
    const store = await this.settings.storeProfile()
    return { ...store, whatsapp: displayPhone(store.whatsapp) }
  }
}
