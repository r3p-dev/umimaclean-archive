import { formatRupiah } from '~/lib/shared/format'

export type PaymentMethod = 'qris' | 'cash'

export const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'qris', label: 'QRIS' },
  { key: 'cash', label: 'Tunai' },
]

export function parseRupiah(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits ? Number(digits) : null
}

export function formatRupiahInput(value: number | null) {
  return value === null ? '' : formatRupiah(value)
}
