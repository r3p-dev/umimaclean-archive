import { router } from '@inertiajs/react'
import { urlFor } from '~/client'

export type ReviewKind = 'refunded' | 'mismatch' | 'handled'

export type MismatchOutcome = 'refund' | 'accept'

export type Review = { kind: ReviewKind; outcome: MismatchOutcome; note: string }

export const REVIEW_COPY: Record<
  ReviewKind,
  { title: string; description: string; noteLabel: string; placeholder: string; action: string }
> = {
  refunded: {
    title: 'Tandai sudah dikembalikan',
    description:
      'Kembalikan dana ke pelanggan di luar aplikasi dulu (transfer, tunai), lalu catat caranya di sini. Tercatat di log aktivitas.',
    noteLabel: 'Cara dan waktu pengembalian (wajib)',
    placeholder: 'mis. transfer BCA ke pelanggan 6 Nov 14.20',
    action: 'Tandai dikembalikan',
  },
  mismatch: {
    title: 'Selesaikan nominal tidak cocok',
    description:
      'Midtrans menerima nominal yang berbeda dari tagihan. Kembalikan seluruh dana, atau terima sebagai pembayaran bila nominalnya cukup dan pesanan belum lunas.',
    noteLabel: 'Catatan keputusan (wajib)',
    placeholder: 'mis. pelanggan setuju kelebihan dianggap tip',
    action: 'Simpan keputusan',
  },
  handled: {
    title: 'Tandai sudah ditangani',
    description:
      'Untuk kode QR yang tidak bisa dipastikan lewat Midtrans. Kode QR ini dianggap batal; bila nanti ternyata dibayar, statusnya berubah ke “Perlu refund”.',
    noteLabel: 'Apa yang sudah dicek (wajib)',
    placeholder: 'mis. dicek di dashboard Midtrans, transaksi tidak ada',
    action: 'Tandai ditangani',
  },
}

export const MISMATCH_OUTCOMES: { value: MismatchOutcome; label: string }[] = [
  { value: 'refund', label: 'Kembalikan seluruh dana' },
  { value: 'accept', label: 'Terima sebagai pembayaran' },
]

export function canAcceptAmount(amount: number, billTotal: number | null) {
  return billTotal !== null && amount >= billTotal
}

type Callbacks = {
  onStart?: () => void
  onSuccess?: () => void
  onError?: (errors: Record<string, string>) => void
  onFinish?: () => void
}

export function submitReview(id: number, review: Review, callbacks: Callbacks = {}) {
  const options = { preserveScroll: true, ...callbacks }
  const note = review.note.trim()
  if (review.kind === 'refunded') {
    router.post(urlFor('admin.reconciliation.refunded', { id }), { note }, options)
  } else if (review.kind === 'mismatch') {
    router.post(
      urlFor('admin.reconciliation.mismatch', { id }),
      { outcome: review.outcome, note },
      options
    )
  } else {
    router.post(urlFor('admin.reconciliation.handled', { id }), { note }, options)
  }
}
