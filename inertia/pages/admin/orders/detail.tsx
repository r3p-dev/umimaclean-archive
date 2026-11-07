import { useMemo, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import type { Data } from '@generated/data'
import {
  IconArrowLeft,
  IconBan,
  IconClock,
  IconExternalLink,
  IconMessage,
  IconPencil,
  IconPhoto,
  IconSearchOff,
} from '@tabler/icons-react'
import { urlFor } from '~/client'
import { Button, LinkButton } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import SourceTag from '~/components/atoms/source_tag'
import ToneBadge from '~/components/atoms/tone_badge'
import EmptyState from '~/components/molecules/empty_state'
import AdminPageHeader from '~/components/organisms/admin_page_header'
import { CancelDialog } from '~/components/organisms/orders/bulk_order_dialogs'
import CustomerHistoryDialog from '~/components/organisms/orders/customer_history_dialog'
import PaymentFixDialog from '~/components/organisms/orders/payment_fix_dialog'
import BillItems from '~/components/organisms/payment/bill_items'
import AdminLayout from '~/components/templates/admin_layout'
import { DETAIL_CANCEL_REASONS, adminOrders, type AdminOrderRow } from '~/lib/orders/admin_orders'
import { MONTH_SHORT } from '~/lib/shared/date'
import { formatRupiah } from '~/lib/shared/format'
import { useLiveReload } from '~/lib/shared/live'
import { cn } from '~/lib/shared/utils'

type DetailOrder = AdminOrderRow & {
  detail: Data.AdminOrderDetail
  history: AdminOrderRow[]
}

export default function AdminOrderDetail({
  id,
  number,
  order,
}: {
  id: number
  number: string
  order: DetailOrder | null
}) {
  const [dialog, setDialog] = useState<'fix' | 'cancel' | 'history' | null>(null)
  const [isBusy, setBusy] = useState(false)
  const history = useMemo(() => adminOrders(order?.history ?? []), [order])
  useLiveReload(`orders/${id}`, ['order'])
  const backLink = (
    <LinkButton
      variant="link"
      className="self-start text-sm leading-none"
      href={urlFor('admin.orders')}
    >
      <IconArrowLeft className="size-4.5" />
      Pesanan
    </LinkButton>
  )

  if (!order) {
    return (
      <AdminLayout active="pesanan" title="Detail pesanan">
        <Head title="Detail pesanan" />
        <AdminPageHeader title="Detail pesanan" />
        <Card>
          <CardContent>
            <EmptyState
              icon={IconSearchOff}
              title={`Pesanan ${number} tidak ditemukan`}
              description="Periksa kembali nomor pesanan atau cari di daftar pesanan."
              action={backLink}
            />
          </CardContent>
        </Card>
      </AdminLayout>
    )
  }

  const detail = order.detail
  const isCancelled = order.stage === 'batal'
  const since = history.at(-1)?.date
  const historySummary = `${since ? `Pelanggan sejak ${MONTH_SHORT[since.getMonth()]} ${since.getFullYear()} · ` : ''}${history.length} pesanan · ${formatRupiah(history.reduce((sum, item) => sum + item.total, 0))} total tagihan.`
  const paymentTone = isCancelled ? 'batal' : detail.isPaid ? 'ok' : order.total ? 'bayar' : 'off'
  const busy = {
    preserveScroll: true,
    onStart: () => setBusy(true),
    onFinish: () => setBusy(false),
    onSuccess: () => setDialog(null),
  }

  return (
    <AdminLayout active="pesanan" title="Detail pesanan">
      <Head title={`Pesanan ${order.number}`} />
      <AdminPageHeader title="Detail pesanan" />
      <Card role="region" aria-labelledby="order-number">
        <CardContent>
          <div className="flex flex-col gap-2.5">
            {backLink}
            <div className="flex flex-wrap items-center gap-2.5">
              <CardTitle as="h2" id="order-number" className="font-mono text-2xl font-bold">
                {order.number}
              </CardTitle>
              <ToneBadge tone={order.stage} hasDot>
                {order.status}
              </ToneBadge>
              <SourceTag isInStore={order.isInStore} />
            </div>
            <p className="text-sm text-foreground-secondary">{detail.createdText}</p>
            {detail.cancelReason && (
              <p className="text-sm text-destructive-text">
                Alasan pembatalan: {detail.cancelReason}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="desktop"
                isDisabled={!detail.canFixPayment}
                onPress={() => setDialog('fix')}
              >
                <IconPencil className="size-4.5" />
                Koreksi pembayaran
              </Button>
              <Button
                variant="destructive-outline"
                size="desktop"
                isDisabled={!detail.canCancel}
                onPress={() => setDialog('cancel')}
                className="border-destructive-border-soft"
              >
                <IconBan className="size-4.5" />
                Batalkan pesanan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle as="h2">Barang & layanan</CardTitle>
              <CardAction>
                <span className="text-caption text-muted-foreground">{detail.pricedBy}</span>
              </CardAction>
            </CardHeader>
            <CardContent>
              {detail.bill ? (
                <BillItems
                  items={detail.bill.items}
                  extras={detail.bill.extras}
                  total={detail.bill.total}
                />
              ) : (
                <p className="text-foreground-secondary">
                  {order.total
                    ? `Total tagihan ${formatRupiah(order.total)}.`
                    : 'Layanan dan harga ditentukan saat pemeriksaan barang.'}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Pembayaran</CardTitle>
              <CardAction>
                <ToneBadge tone={paymentTone} hasDot>
                  {order.payment}
                </ToneBadge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3">
                {detail.payRows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Jejak audit pesanan ini</CardTitle>
              <CardAction>
                <span className="text-caption leading-none text-muted-foreground">
                  tidak bisa diedit
                </span>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {detail.audit.map((entry, index) => (
                  <li
                    key={`${entry.time}-${index}`}
                    className="grid grid-cols-[84px_minmax(0,1fr)] gap-2.5 text-note"
                  >
                    <span className="font-mono text-caption font-medium text-muted-foreground">
                      {entry.time}
                    </span>
                    <span>
                      <strong className="font-semibold">{entry.who}</strong> {entry.what}
                      {entry.sensitive && (
                        <>
                          {' '}
                          <ToneBadge tone="warn">sensitif</ToneBadge>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Pelanggan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-md font-semibold">{order.customer}</p>
              <p className="font-mono text-sm font-medium">{detail.phone}</p>
              <p className="text-sm text-foreground-secondary">{detail.address}</p>
              <div className="flex flex-wrap gap-2">
                {detail.waNumber && (
                  <LinkButton
                    variant="outline"
                    size="desktop"
                    href={`https://wa.me/${detail.waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp ${order.customer} (membuka tab baru)`}
                  >
                    <IconMessage className="size-4.5" />
                    WhatsApp
                    <IconExternalLink className="size-4 text-icon-muted" />
                  </LinkButton>
                )}
                <Button
                  variant="ghost"
                  size="desktop"
                  aria-haspopup="dialog"
                  onPress={() => setDialog('history')}
                  className="px-2 text-primary"
                >
                  Riwayat pelanggan
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Bukti foto</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-3 gap-2">
                {detail.proofs.map((proof) => (
                  <li key={proof.label} className="flex flex-col gap-1">
                    {proof.url ? (
                      <a href={proof.url} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={proof.url}
                          alt={`Bukti ${proof.label.toLowerCase()}`}
                          className="aspect-square w-full rounded-md object-cover"
                        />
                      </a>
                    ) : (
                      <div
                        className={cn(
                          'flex aspect-square items-center justify-center rounded-md text-muted-foreground',
                          proof.time
                            ? 'stripes [--stripe:8px]'
                            : 'border border-dashed border-input bg-background'
                        )}
                      >
                        {proof.time ? (
                          <IconPhoto className="size-5.5" />
                        ) : (
                          <IconClock className="size-5.5" />
                        )}
                      </div>
                    )}
                    <span className="text-caption font-semibold">{proof.label}</span>
                    <span className="text-2xs text-muted-foreground">
                      {proof.time
                        ? proof.url
                          ? proof.time
                          : `${proof.time} · dihapus (90 hari)`
                        : 'belum ada'}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <PaymentFixDialog
        key={dialog === 'fix' ? 'fix-open' : 'fix'}
        isOpen={dialog === 'fix'}
        onOpenChange={(isOpen) => !isOpen && setDialog(null)}
        defaultAmount={detail.paidAmount}
        isSaving={isBusy}
        onSave={(fix) => {
          router.post(urlFor('admin.order.payment', { id }), fix, busy)
        }}
      />
      <CancelDialog
        key={dialog === 'cancel' ? 'cancel-open' : 'cancel'}
        isOpen={dialog === 'cancel'}
        onOpenChange={(isOpen) => !isOpen && setDialog(null)}
        title={`Batalkan pesanan ${order.number}?`}
        description="Pesanan tidak dihapus — statusnya menjadi Dibatalkan dan tetap ada di riwayat & laporan. Pelanggan dikirimi WhatsApp berisi alasan pembatalan."
        reasons={DETAIL_CANCEL_REASONS}
        confirmLabel="Batalkan Pesanan"
        onConfirm={(reason) => {
          router.post(urlFor('admin.orders.cancel'), { ids: [id], reason }, busy)
        }}
      />
      <CustomerHistoryDialog
        isOpen={dialog === 'history'}
        onOpenChange={(isOpen) => !isOpen && setDialog(null)}
        customer={order.customer}
        summary={historySummary}
        orders={history}
      />
    </AdminLayout>
  )
}
