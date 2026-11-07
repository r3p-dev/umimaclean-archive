import { useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { IconAlertTriangle, IconCheck, IconRefresh } from '@tabler/icons-react'
import { urlFor } from '~/client'
import ToneBadge from '~/components/atoms/tone_badge'
import { FilterMenu } from '~/components/molecules/filter_menu'
import AdminPageHeader from '~/components/organisms/admin_page_header'
import PaymentReviewDialog from '~/components/organisms/payment/payment_review_dialog'
import AdminLayout from '~/components/templates/admin_layout'
import { Alert } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { submitReview, type ReviewKind } from '~/lib/payment/review'
import { formatRupiah } from '~/lib/shared/format'
import { useLiveReload } from '~/lib/shared/live'

type Flag =
  | 'ok'
  | 'paid_not_advanced'
  | 'expired_pending'
  | 'amount_mismatch'
  | 'waiting'
  | 'refund_due'
  | 'cancel_failed'
  | 'refunded'

type Row = {
  id: number
  providerOrderId: string
  transactionId: string | null
  orderId: number
  number: string
  customer: string
  channel: string
  amount: number
  billTotal: number | null
  status: string
  orderStatus: string
  createdAt: string
  paidAt: string | null
  note: string | null
  flag: Flag
  needsReview: boolean
}

const FLAGS: Record<Flag, { label: string; tone: 'ok' | 'warn' | 'bayar' | 'off' | 'batal' }> = {
  refund_due: { label: 'Perlu refund manual', tone: 'batal' },
  cancel_failed: { label: 'QR gagal dibatalkan', tone: 'warn' },
  ok: { label: 'Cocok', tone: 'ok' },
  waiting: { label: 'Menunggu bayar', tone: 'bayar' },
  expired_pending: { label: 'Kedaluwarsa, belum dikonfirmasi', tone: 'off' },
  paid_not_advanced: { label: 'Lunas, pesanan belum maju', tone: 'warn' },
  amount_mismatch: { label: 'Nominal tidak cocok', tone: 'batal' },
  refunded: { label: 'Sudah dikembalikan', tone: 'off' },
}

const REVIEW_OF: Partial<Record<Flag, { kind: ReviewKind; label: string }>> = {
  refund_due: { kind: 'refunded', label: 'Tandai sudah dikembalikan' },
  amount_mismatch: { kind: 'mismatch', label: 'Selesaikan' },
  cancel_failed: { kind: 'handled', label: 'Tandai sudah ditangani' },
}

export default function AdminReconciliation({
  rows,
  isAvailable,
}: {
  rows: Row[]
  isAvailable: boolean
}) {
  const [flags, setFlags] = useState<Flag[]>([])
  const [isReviewOnly, setReviewOnly] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [review, setReview] = useState<{ row: Row; kind: ReviewKind } | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [reviewError, setReviewError] = useState<string>()
  const shown = rows.filter(
    (row) => (!flags.length || flags.includes(row.flag)) && (!isReviewOnly || row.needsReview)
  )
  const problems = rows.filter((row) => row.needsReview).length
  const owed = rows
    .filter((row) => row.flag === 'refund_due')
    .reduce((sum, row) => sum + row.amount, 0)
  useLiveReload('admin/orders', ['rows'])

  function openReview(row: Row, kind: ReviewKind) {
    setReviewError(undefined)
    setReview({ row, kind })
  }

  function refresh(row: Row) {
    router.post(
      urlFor(
        row.flag === 'cancel_failed'
          ? 'admin.reconciliation.recheck'
          : 'admin.reconciliation.refresh',
        { id: row.id }
      ),
      {},
      {
        preserveScroll: true,
        onStart: () => setBusyId(row.id),
        onFinish: () => setBusyId(null),
      }
    )
  }

  return (
    <AdminLayout active="rekonsiliasi" title="Rekonsiliasi">
      <Head title="Rekonsiliasi pembayaran" />
      <AdminPageHeader
        title="Rekonsiliasi pembayaran"
        status={`${rows.length} transaksi QRIS terakhir · ${problems} perlu dicek${owed ? ` · ${formatRupiah(owed)} perlu dikembalikan` : ''}`}
      />
      {!isAvailable && (
        <Alert variant="attention">
          <IconAlertTriangle className="size-5" />
          Midtrans belum dikonfigurasi (MIDTRANS_SERVER_KEY kosong). Kode QR tidak bisa dibuat dan
          status tidak bisa dicek ke penyedia.
        </Alert>
      )}
      <p className="text-sm leading-normal text-foreground-secondary">
        Mencocokkan setiap kode QRIS dari Midtrans dengan pesanannya. Pembayaran di luar QRIS
        (tunai, transfer) dicatat lewat “Koreksi pembayaran” di detail pesanan.
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterMenu
          word="Status"
          label="Filter status rekonsiliasi"
          values={flags}
          onChange={setFlags}
          options={(Object.keys(FLAGS) as Flag[]).map((flag) => ({
            value: flag,
            label: FLAGS[flag].label,
            count: rows.filter((row) => row.flag === flag).length,
          }))}
        />
        <Button
          variant="outline"
          data-active={isReviewOnly}
          aria-pressed={isReviewOnly}
          onPress={() => setReviewOnly((value) => !value)}
          className="h-btn-desktop px-3 text-[13.5px] font-medium data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
        >
          Perlu dicek ({problems})
        </Button>
      </div>
      <Card>
        <CardContent data-bleed>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>ID Midtrans</TableHead>
                <TableHead>Pesanan</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status bayar</TableHead>
                <TableHead>Status pesanan</TableHead>
                <TableHead>Hasil</TableHead>
                <TableHead>
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-foreground-secondary">
                    Belum ada transaksi QRIS{flags.length ? ' untuk filter ini' : ''}.
                  </TableCell>
                </TableRow>
              )}
              {shown.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="py-3">
                    <span className="block font-mono text-meta">{row.providerOrderId}</span>
                    <span className="block text-caption text-muted-foreground">
                      {row.createdAt} · {row.channel}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <Link
                      href={urlFor('admin.order', { id: row.orderId })}
                      className="inline-flex min-h-11 items-center font-mono font-semibold"
                    >
                      {row.number}
                    </Link>
                    <span className="block text-caption text-muted-foreground">{row.customer}</span>
                  </TableCell>
                  <TableCell className="py-3 tabular-nums">
                    {formatRupiah(row.amount)}
                    {row.billTotal !== null && row.billTotal !== row.amount && (
                      <span className="block text-caption text-destructive-text">
                        tagihan {formatRupiah(row.billTotal)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {row.status}
                    {row.paidAt && (
                      <span className="block text-caption text-muted-foreground">{row.paidAt}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">{row.orderStatus}</TableCell>
                  <TableCell className="py-3">
                    <ToneBadge tone={FLAGS[row.flag].tone}>{FLAGS[row.flag].label}</ToneBadge>
                    {row.flag === 'refund_due' && (
                      <span className="mt-1 block text-caption text-destructive-text">
                        Pesanan sudah lunas dengan cara lain. Kembalikan dana ini ke pelanggan
                        secara manual.
                      </span>
                    )}
                    {row.flag === 'cancel_failed' && (
                      <span className="mt-1 block text-caption text-muted-foreground">
                        Pesanan sudah lunas, tetapi kode QR ini gagal dibatalkan di Midtrans. Cek
                        statusnya.
                      </span>
                    )}
                    {row.note && (
                      <span className="mt-1 block text-caption text-muted-foreground">
                        {row.note}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="flex flex-col items-start gap-2">
                      {REVIEW_OF[row.flag] && (
                        <Button
                          size="compact"
                          onPress={() => openReview(row, REVIEW_OF[row.flag]!.kind)}
                        >
                          <IconCheck className="size-4.5" />
                          {REVIEW_OF[row.flag]!.label}
                        </Button>
                      )}
                      {row.flag !== 'refund_due' &&
                        row.flag !== 'amount_mismatch' &&
                        row.flag !== 'refunded' && (
                          <Button
                            variant="outline"
                            size="compact"
                            isDisabled={!isAvailable}
                            isPending={busyId === row.id}
                            onPress={() => refresh(row)}
                          >
                            <IconRefresh className="size-4.5" />
                            {row.flag === 'cancel_failed'
                              ? 'Cek ulang di Midtrans'
                              : 'Cek ke Midtrans'}
                          </Button>
                        )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {review && (
        <PaymentReviewDialog
          kind={review.kind}
          reference={review.row.providerOrderId}
          amount={review.row.amount}
          billTotal={review.row.billTotal}
          isSaving={isSaving}
          serverError={reviewError}
          onOpenChange={(isOpen) => !isOpen && setReview(null)}
          onSave={(input) =>
            submitReview(review.row.id, input, {
              onStart: () => setSaving(true),
              onSuccess: () => setReview(null),
              onError: (errors) =>
                setReviewError(Object.values(errors)[0] ?? 'Periksa kembali isian.'),
              onFinish: () => setSaving(false),
            })
          }
        />
      )}
    </AdminLayout>
  )
}
