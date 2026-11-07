import { BaseTransformer } from '@adonisjs/core/transformers'
import type { DateTime } from 'luxon'
import { ActivityActionLabel } from '#enums/activity_enum'
import { OrderSource, OrderStatus, OrderStatusLabel, PhotoKind } from '#enums/order_enum'
import {
  PAYMENT_RECEIVED_STATUSES,
  PaymentChannelLabel,
  PaymentMethodLabel,
  PaymentStatus,
  PaymentStatusLabel,
} from '#enums/payment_enum'
import { Role } from '#enums/role_enum'
import type ActivityLog from '#models/activity_log'
import type Order from '#models/order'
import { formatRupiah } from '#helpers/money'
import { displayPhone } from '#helpers/phone'
import { billBreakdown } from '#helpers/bill'
import { photoUrl } from '#transformers/order_transformer'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'

function stamp(date: DateTime) {
  return date.setZone(SERVICE_ZONE).setLocale('id').toFormat('d LLL HH.mm')
}

export default class AdminOrderDetailTransformer extends BaseTransformer<Order> {
  constructor(
    resource: Order,
    protected logs: ActivityLog[]
  ) {
    super(resource)
  }

  toObject() {
    const order = this.resource
    const created = order.createdAt
      .setZone(SERVICE_ZONE)
      .setLocale('id')
      .toFormat('ccc d LLL yyyy · HH.mm')
    const bill = order.bill
    const paid = order.payments.find((payment) => payment.status === PaymentStatus.PAID)
    const pending = order.payments
      .filter((payment) => payment.status === PaymentStatus.PENDING)
      .at(-1)
    const otherReceived = order.payments
      .filter(
        (payment) =>
          payment.status !== PaymentStatus.PAID &&
          PAYMENT_RECEIVED_STATUSES.includes(payment.status)
      )
      .map((payment) => ({
        label: 'QRIS lain diterima',
        value: `${formatRupiah(payment.amount)} · ${PaymentStatusLabel[payment.status]}${payment.paidAt ? ` · ${stamp(payment.paidAt)}` : ''}`,
      }))
    const address = order.deliveryAddress ?? order.pickupAddress
    const proof = (kind: PhotoKind) => order.photos.filter((photo) => photo.kind === kind).at(-1)

    const systemEvents = order.events
      .filter((event) => !event.actor || event.actor.role === Role.CUSTOMER)
      .map((event) => ({
        at: event.createdAt.toMillis(),
        time: stamp(event.createdAt),
        who: event.actor ? 'Pelanggan' : 'Sistem',
        what: `${OrderStatusLabel[event.status].toLowerCase()}${event.note ? ` · ${event.note}` : ''}`,
        sensitive: event.status === OrderStatus.CANCELLED,
      }))
    const staffEvents = this.logs.map((log) => ({
      at: log.createdAt.toMillis(),
      time: stamp(log.createdAt),
      who: log.actor?.firstName() ?? 'Staf',
      what: `${ActivityActionLabel[log.action].toLowerCase()}${log.detail ? ` · ${log.detail}` : ''}`,
      sensitive: log.isSensitive,
    }))

    return {
      createdText: `Dibuat ${created} · ${order.source === OrderSource.STORE ? 'transaksi di toko' : 'dari situs'}`,
      phone: order.customerPhone ? displayPhone(order.customerPhone) : '—',
      waNumber: order.customerPhone,
      address: address
        ? `${address.addressText}${address.landmark ? ` · patokan: ${address.landmark}` : ''}`
        : 'Diambil di toko',
      pricedBy: bill
        ? `ditentukan ${bill.decider?.firstName() ?? 'staf'} · ${stamp(bill.createdAt)}`
        : 'belum diperiksa',
      bill: billBreakdown(order),
      payRows: paid
        ? [
            {
              label: 'Metode',
              value: `${PaymentMethodLabel[paid.method]} (${PaymentChannelLabel[paid.channel].toLowerCase()})`,
            },
            { label: 'Jumlah', value: formatRupiah(paid.amount) },
            { label: 'Dibayar', value: paid.paidAt ? stamp(paid.paidAt) : '—' },
            { label: 'Dicatat oleh', value: paid.recorder?.name ?? 'Otomatis (Midtrans)' },
            ...(paid.note ? [{ label: 'Catatan', value: paid.note }] : []),
            ...otherReceived,
          ]
        : [
            {
              label: 'Tagihan',
              value: bill ? `${formatRupiah(bill.total)} · ${stamp(bill.createdAt)}` : '—',
            },
            {
              label: 'Status',
              value: pending
                ? `QR dibuat ${stamp(pending.createdAt)}, belum dibayar`
                : bill
                  ? 'Belum dibayar'
                  : 'Belum ditagih',
            },
            ...otherReceived,
          ],
      isPaid: !!paid,
      paidAmount: paid?.amount ?? bill?.total ?? 0,
      canCancel: order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED,
      canFixPayment: !!paid || order.status === OrderStatus.AWAITING_PAYMENT,
      cancelReason: order.cancelReason,
      audit: [...staffEvents, ...systemEvents]
        .sort((left, right) => right.at - left.at)
        .map(({ at: _at, ...entry }) => entry),
      proofs: [
        { label: 'Jemput', kind: PhotoKind.PICKUP },
        { label: 'Diterima', kind: PhotoKind.INTAKE },
        { label: 'Pencucian', kind: PhotoKind.WASHING },
        { label: 'Antar', kind: PhotoKind.DELIVERY },
      ].map(({ label, kind }) => {
        const photo = proof(kind)
        return {
          label,
          time: photo ? stamp(photo.createdAt) : null,
          url: photo ? photoUrl(photo) : null,
          by: photo?.taker?.firstName() ?? null,
        }
      }),
    }
  }
}
