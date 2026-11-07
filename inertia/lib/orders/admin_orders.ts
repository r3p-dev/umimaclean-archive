import type { Data } from '@generated/data'
import { fromIso } from '~/lib/shared/date'
import type { StatusTone } from '~/lib/tracking/status'

export const STAGE_LABEL: Record<StatusTone, string> = {
  jemput: 'Menunggu Penjemputan',
  periksa: 'Sedang Diperiksa',
  bayar: 'Menunggu Pembayaran',
  cuci: 'Dalam Pencucian',
  antar: 'Siap Diantar',
  selesai: 'Selesai',
  batal: 'Dibatalkan',
}

export const STAGE_FILTERS: StatusTone[] = [
  'jemput',
  'periksa',
  'bayar',
  'cuci',
  'antar',
  'selesai',
  'batal',
]

const STAGE_ORDER: Record<StatusTone, number> = {
  jemput: 1,
  periksa: 2,
  bayar: 3,
  cuci: 4,
  antar: 5,
  selesai: 6,
  batal: 7,
}

export const CANCEL_REASONS = [
  'Pelanggan membatalkan',
  'Tidak bisa dihubungi',
  'Di luar area layanan',
  'Lainnya',
]

export const DETAIL_CANCEL_REASONS = [
  'Permintaan pelanggan',
  'Pelanggan tidak bisa dihubungi',
  'Di luar area layanan',
  'Lainnya',
]

export type FixMethod = 'qris_counter' | 'cash' | 'qris_online'

export const FIX_METHODS: { value: FixMethod; label: string }[] = [
  { value: 'qris_counter', label: 'QRIS (offline)' },
  { value: 'cash', label: 'Tunai di toko' },
  { value: 'qris_online', label: 'QRIS (online)' },
]

export type PaymentFix = { method: FixMethod; amount: number; correctionReason: string }

export type AdminOrderRow = Data.AdminOrder

export type AdminOrder = Omit<AdminOrderRow, 'date'> & { date: Date }

export function adminOrders(rows: AdminOrderRow[]): AdminOrder[] {
  return rows.map((row) => ({ ...row, date: fromIso(row.date) }))
}

export function stageRank(stage: StatusTone) {
  return STAGE_ORDER[stage]
}

export function statusEligible(selected: AdminOrder[], target: StatusTone) {
  return selected.filter((order) => order.next.includes(target))
}

export function bulkTargets(selected: AdminOrder[]) {
  return STAGE_FILTERS.filter((stage) => selected.some((order) => order.next.includes(stage)))
}

export function statusNote(selected: AdminOrder[], target: StatusTone | null) {
  if (!bulkTargets(selected).length) {
    return 'Tidak ada pesanan terpilih yang bisa diubah massal. Ubah status massal hanya untuk Barang Kami Terima → Sedang Diperiksa dan Siap Diambil → Selesai; langkah lain dikerjakan staf dengan buktinya.'
  }
  if (!target) {
    return 'Pilih status tujuan. Hanya langkah tanpa bukti staf yang tersedia, dan perubahan dicatat di Aktivitas Staf.'
  }
  const eligible = statusEligible(selected, target).length
  const skipped = selected.length - eligible
  return (
    `${eligible} dari ${selected.length} pesanan akan diubah ke “${STAGE_LABEL[target]}”.` +
    (skipped ? ` ${skipped} lainnya tidak bisa diubah massal ke status ini dan tidak dikirim.` : '')
  )
}

export function cancelable(selected: AdminOrder[]) {
  return selected.filter((order) => order.stage !== 'selesai' && order.stage !== 'batal')
}
