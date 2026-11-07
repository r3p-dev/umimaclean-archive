export const PaymentChannel = {
  ONLINE: 'online',
  COUNTER: 'counter',
} as const

export const PaymentChannelLabel = {
  [PaymentChannel.ONLINE]: 'Online',
  [PaymentChannel.COUNTER]: 'Di toko',
} as const

export const PaymentMethod = {
  QRIS: 'qris',
  CASH: 'cash',
} as const

export const PaymentMethodLabel = {
  [PaymentMethod.QRIS]: 'QRIS',
  [PaymentMethod.CASH]: 'Tunai',
} as const

export const PaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  CANCEL_FAILED: 'cancel_failed',
  REFUND_DUE: 'refund_due',
  AMOUNT_MISMATCH: 'amount_mismatch',
  REFUNDED: 'refunded',
} as const

export const PAYMENT_RECEIVED_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.REFUND_DUE,
  PaymentStatus.AMOUNT_MISMATCH,
  PaymentStatus.REFUNDED,
]

export const PaymentStatusLabel = {
  [PaymentStatus.PENDING]: 'Menunggu',
  [PaymentStatus.PAID]: 'Lunas',
  [PaymentStatus.EXPIRED]: 'Kedaluwarsa',
  [PaymentStatus.CANCELLED]: 'Dibatalkan',
  [PaymentStatus.FAILED]: 'Gagal',
  [PaymentStatus.CANCEL_FAILED]: 'Gagal dibatalkan',
  [PaymentStatus.REFUND_DUE]: 'Perlu refund',
  [PaymentStatus.AMOUNT_MISMATCH]: 'Nominal tidak cocok',
  [PaymentStatus.REFUNDED]: 'Sudah dikembalikan',
} as const

export type PaymentChannel = (typeof PaymentChannel)[keyof typeof PaymentChannel]
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]
