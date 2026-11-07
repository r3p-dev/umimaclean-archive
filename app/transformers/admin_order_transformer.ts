import { BaseTransformer } from '@adonisjs/core/transformers'
import { OrderSource, OrderStatus, OrderStatusLabel, OrderStatusStage } from '#enums/order_enum'
import { PaymentMethodLabel, PaymentStatus } from '#enums/payment_enum'
import { Role } from '#enums/role_enum'
import type Order from '#models/order'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'

function areaOf(order: Order) {
  if (order.source === OrderSource.STORE && !order.deliveryAddress) {
    return 'Toko'
  }
  const address = order.pickupAddress ?? order.deliveryAddress
  const parts = (address?.addressText ?? '').split(',').map((part) => part.trim())
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || '—'
}

const HELD_STATUSES: PaymentStatus[] = [PaymentStatus.REFUND_DUE, PaymentStatus.AMOUNT_MISMATCH]

function paymentLabelOf(order: Order) {
  const label = paidLabelOf(order)
  const isHeld = order.payments?.some((payment) => HELD_STATUSES.includes(payment.status))
  return isHeld ? `${label} · QRIS perlu dicek` : label
}

function paidLabelOf(order: Order) {
  const paid = order.payments?.find((payment) => payment.status === PaymentStatus.PAID)
  if (order.status === OrderStatus.CANCELLED) {
    return paid ? `Lunas · ${PaymentMethodLabel[paid.method]} · perlu refund` : 'Tidak ada tagihan'
  }
  if (paid) {
    return `Lunas · ${PaymentMethodLabel[paid.method]}`
  }
  return order.status === OrderStatus.AWAITING_PAYMENT ? 'Belum dibayar' : 'Belum ditagih'
}

export default class AdminOrderTransformer extends BaseTransformer<Order> {
  toObject() {
    const order = this.resource
    const staff = order.events
      ?.filter((event) => event.actor && event.actor.role !== Role.CUSTOMER)
      .at(-1)?.actor

    return {
      id: String(order.id),
      label: `${order.number()} · ${order.customerName}`,
      number: order.number(),
      customer: order.customerName,
      area: areaOf(order),
      isInStore: order.source === OrderSource.STORE,
      status: OrderStatusLabel[order.status],
      stage: OrderStatusStage[order.status],
      total: order.bill?.total ?? 0,
      payment: paymentLabelOf(order),
      staff: staff?.firstName() ?? '—',
      date: order.createdAt.setZone(SERVICE_ZONE).toISODate()!,
      next: order.ownerStages(),
    }
  }
}
