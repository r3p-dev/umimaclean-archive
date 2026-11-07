import { BaseTransformer } from '@adonisjs/core/transformers'
import { PaymentMethod, PaymentMethodLabel, PaymentStatus } from '#enums/payment_enum'
import type Order from '#models/order'
import { billBreakdown } from '#helpers/bill'
import { formatEvent } from '#transformers/order_transformer'

export default class ReceiptTransformer extends BaseTransformer<Order> {
  toObject() {
    const order = this.resource
    const payment = order.payments.find((entry) => entry.status === PaymentStatus.PAID) ?? null
    const bill = billBreakdown(order)
    const cashReceived =
      payment?.method === PaymentMethod.CASH ? (payment.cashReceived ?? null) : null

    return {
      id: order.id,
      number: order.number(),
      customer: order.customerName,
      createdAt: formatEvent(order.createdAt),
      items: bill?.items ?? [],
      extras: bill?.extras ?? [],
      total: bill?.total ?? 0,
      payment: payment
        ? {
            method: PaymentMethodLabel[payment.method],
            paidAt: payment.paidAt ? formatEvent(payment.paidAt) : '',
            transactionId: payment.providerTransactionId,
            cashReceived,
            change: cashReceived !== null ? cashReceived - payment.amount : null,
          }
        : null,
    }
  }
}
