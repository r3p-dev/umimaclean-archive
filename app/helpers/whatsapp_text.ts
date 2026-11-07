import type { BillBreakdown } from '#helpers/bill'
import { formatRupiah } from '#helpers/money'
import env from '#start/env'

function greeting(customerName: string) {
  return `Halo ${customerName.split(' ')[0] || 'Kak'},`
}

export function orderLink(orderId: number) {
  return `${env.get('APP_URL')}/pesanan/${orderId}`
}

export function orderCreatedText(values: { customerName: string; number: string; link: string }) {
  return `${greeting(values.customerName)} pesanan ${values.number} sudah kami terima. Pantau statusnya di ${values.link}`
}

export function courierOnTheWayText(values: {
  customerName: string
  number: string
  courier: string
  link: string
}) {
  return `${greeting(values.customerName)} kurir ${values.courier} sedang menuju lokasi Anda untuk menjemput pesanan ${values.number}. Pantau di ${values.link}`
}

export function billText(values: {
  customerName: string
  number: string
  bill: BillBreakdown
  link: string
  isWalkIn: boolean
}) {
  const items = values.bill.items.map((item, index) =>
    [
      `${index + 1}. ${item.name} (${item.kind})`,
      ...(item.main ? [`   ${item.main.name}: ${formatRupiah(item.main.price)}`] : []),
      ...item.addons.map((addon) => `   + ${addon.name}: ${formatRupiah(addon.price)}`),
      `   Subtotal: ${formatRupiah(item.subtotal)}`,
    ].join('\n')
  )
  const extras = values.bill.extras.map(
    (extra) => `${extra.label}: ${extra.amount ? formatRupiah(extra.amount) : 'Gratis'}`
  )
  const footer = values.isWalkIn
    ? `Rincian: ${values.link}`
    : `Rincian dan pembayaran: ${values.link}`
  return [
    `${greeting(values.customerName)} barang pesanan ${values.number} sudah diperiksa.`,
    items.join('\n\n'),
    [...extras, `Total: ${formatRupiah(values.bill.total)}`].join('\n'),
    footer,
  ].join('\n\n')
}

export function paymentReminderText(values: {
  customerName: string
  number: string
  total: number
  link: string
}) {
  return `${greeting(values.customerName)} tagihan pesanan ${values.number} sebesar ${formatRupiah(values.total)} belum dibayar. Lihat rincian dan bayar di ${values.link}`
}

export function orderCancelledText(values: {
  customerName: string
  number: string
  store: string
  reason: string
  link: string
}) {
  return `${greeting(values.customerName)} pesanan ${values.number} dibatalkan oleh ${values.store}. Alasan: ${values.reason}. Detail di ${values.link}`
}
