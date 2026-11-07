import { useState } from 'react'
import { Head, router } from '@inertiajs/react'
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCircle,
  IconCircleCheck,
  IconCircleDot,
  IconCircleX,
  IconBan,
  IconMessage,
  IconQrcode,
  IconReceipt,
} from '@tabler/icons-react'
import { urlFor } from '~/client'
import StatusBadge from '~/components/atoms/status_badge'
import BackLink from '~/components/molecules/back_link'
import AccountLayout from '~/components/templates/account_layout'
import { Button, LinkButton } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { CancelDialog } from '~/components/organisms/orders/bulk_order_dialogs'
import BillItems from '~/components/organisms/payment/bill_items'
import { shortStreet } from '~/lib/order/addresses'
import { formatDate } from '~/lib/shared/date'
import type { OrderRecord } from '~/lib/tracking/orders'
import { buildTracking, CANCELLED, COMPLETED } from '~/lib/tracking/status'
import { helpLink, orderTimeline } from '~/lib/tracking/timeline'
import { useLiveReload } from '~/lib/shared/live'
import { cn } from '~/lib/shared/utils'

const CUSTOMER_CANCEL_REASONS = [
  'Salah jadwal',
  'Barang batal dicuci',
  'Ingin antar sendiri ke toko',
  'Lainnya',
]

export default function OrderDetail({ order, isOwner }: { order: OrderRecord; isOwner: boolean }) {
  useLiveReload(`orders/${order.id}`, ['order'])
  const [isCancelling, setCancelling] = useState(false)
  const view = buildTracking(order)
  const timeline = orderTimeline(order)
  const bill = order.bill && view.servicesKnown ? order.bill : null
  const pickup = order.pickupAddress
  const delivery = order.deliveryAddress
  const recipient = order.returnMethod === 'store' ? null : (delivery ?? pickup)

  const payCard = view.total && !view.cancelled && (
    <Card role="region" aria-labelledby="bill-total-title">
      <CardHeader>
        <CardTitle as="h2" id="bill-total-title">
          Total tagihan
        </CardTitle>
        <CardAction>
          <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">
            {view.total}
          </span>
        </CardAction>
      </CardHeader>
      {view.needsPay && isOwner && (
        <CardContent>
          <LinkButton
            href={urlFor('customer.orders.pay', { id: order.id })}
            size="cta"
            className="gap-2"
          >
            <IconQrcode className="size-5.5" />
            Bayar dengan QRIS
          </LinkButton>
        </CardContent>
      )}
      {view.needsPay && !isOwner && (
        <CardContent>
          <p className="text-foreground-secondary">
            {order.source === 'store'
              ? 'Pembayaran dilakukan di kasir toko.'
              : 'Bayar di toko, atau masuk ke akun pemesan untuk membayar dengan QRIS.'}
          </p>
        </CardContent>
      )}
      {!view.needsPay && (
        <CardContent>
          <p className="text-success-foreground">{view.payment.label}</p>
        </CardContent>
      )}
    </Card>
  )

  return (
    <>
      <Head title={order.number} />
      <div className="mx-auto box-content max-w-page px-5 pt-4 lg:pt-8">
        <BackLink href={urlFor('customer.orders.index')} label="Riwayat" />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-mono text-[28px] leading-none font-semibold tracking-[-0.01em] lg:text-[34px]">
            {order.number}
          </h1>
          <StatusBadge status={view.status} size="lg" />
          <span className="text-sm text-foreground-secondary">
            dibuat {formatDate(order.createdOn, 'full')}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:mt-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <div className="flex flex-col gap-4 max-lg:order-2">
            <Card role="region" aria-labelledby="items-title">
              <CardHeader>
                <CardTitle as="h2" id="items-title">
                  {bill ? 'Rincian tagihan' : 'Barang & layanan'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bill ? (
                  <BillItems items={bill.items} extras={bill.extras} total={bill.total} />
                ) : (
                  <div className="flex flex-col gap-1">
                    <p className="text-md font-medium">{view.itemsSummary}</p>
                    <p className="text-foreground-secondary">
                      {view.cancelled
                        ? 'Pesanan dibatalkan. Tidak ada tagihan.'
                        : 'Layanan dan harga ditentukan tim kami setelah barang diperiksa.'}
                    </p>
                  </div>
                )}
                {order.note && (
                  <p className="rounded-md bg-muted px-3 py-2.5 text-foreground-secondary">
                    Catatan: {order.note}
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <IconArrowUpRight className="mt-px size-5 shrink-0 text-foreground-secondary" />
                    <span className="flex flex-col gap-1">
                      <span className="text-md font-semibold">
                        {pickup ? `Dijemput dari ${pickup.label}` : 'Diterima di toko'}
                      </span>
                      <span className="text-foreground-secondary">
                        {pickup
                          ? shortStreet(pickup.addressText)
                          : 'Barang dibawa langsung ke toko'}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <IconArrowDownLeft className="mt-px size-5 shrink-0 text-foreground-secondary" />
                    <span className="flex flex-col gap-1">
                      <span className="text-md font-semibold">
                        {order.returnMethod === 'store'
                          ? 'Diambil di toko'
                          : `Diantar ke ${(delivery ?? pickup)?.label ?? 'alamat Anda'}`}
                      </span>
                      <span className="text-foreground-secondary">
                        {order.returnMethod === 'store'
                          ? 'Ambil di toko setelah selesai dicuci'
                          : delivery
                            ? shortStreet(delivery.addressText)
                            : 'Ke alamat yang sama'}
                      </span>
                      {recipient && (
                        <span className="text-meta text-muted-foreground">
                          Penerima: {recipient.recipientName}
                          {recipient.recipientPhone && ` · ${recipient.recipientPhone}`}
                        </span>
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <aside className="flex flex-col gap-4 max-lg:order-1">
            {payCard}
            <Card role="region" aria-labelledby="status-title">
              <CardHeader>
                <CardTitle as="h2" id="status-title">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col">
                  {timeline.map((step) => {
                    const Icon =
                      step.state === 'done'
                        ? IconCircleCheck
                        : step.state === 'current'
                          ? order.status === CANCELLED
                            ? IconCircleX
                            : IconCircleDot
                          : IconCircle
                    return (
                      <li
                        key={step.label}
                        aria-current={step.state === 'current' ? 'step' : undefined}
                        className="flex items-start gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <Icon
                          className={cn(
                            'mt-px size-5.5 shrink-0',
                            step.state === 'done' && 'text-success-foreground',
                            step.state === 'current' &&
                              (order.status === CANCELLED
                                ? 'text-destructive-text'
                                : 'text-primary'),
                            step.state === 'upcoming' && 'text-icon-muted'
                          )}
                        />
                        <span
                          className={cn(
                            'flex-1 text-md',
                            step.state === 'current' && 'font-semibold',
                            step.state === 'upcoming' && 'text-foreground-secondary'
                          )}
                        >
                          {step.label}
                        </span>
                        {step.time && (
                          <span className="text-meta text-muted-foreground">{step.time}</span>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>
            {order.status === COMPLETED && (
              <LinkButton
                href={urlFor('customer.orders.receipt', { id: order.id })}
                variant="outline"
                size="desktop"
                className="gap-2"
              >
                <IconReceipt className="size-5" />
                Lihat Struk
              </LinkButton>
            )}
            {isOwner && order.canCancel && (
              <Button
                variant="destructive-outline"
                size="desktop"
                className="gap-2"
                onPress={() => setCancelling(true)}
              >
                <IconBan className="size-5" />
                Batalkan Pesanan
              </Button>
            )}
            {order.cancelReason && (
              <p className="text-sm leading-[1.45] text-foreground-secondary">
                Alasan pembatalan: {order.cancelReason}
              </p>
            )}
            <a
              href={helpLink(order.number)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-icon-btn items-center justify-center gap-2 text-[15px] font-semibold text-primary hover:text-primary-hover"
            >
              <IconMessage className="size-5" />
              Butuh bantuan? Chat via WhatsApp
            </a>
          </aside>
        </div>
      </div>
      <CancelDialog
        key={isCancelling ? 'cancel-open' : 'cancel'}
        isOpen={isCancelling}
        onOpenChange={setCancelling}
        title={`Batalkan pesanan ${order.number}?`}
        description="Bisa dibatalkan selama kurir belum berangkat."
        reasons={CUSTOMER_CANCEL_REASONS}
        confirmLabel="Batalkan Pesanan"
        onConfirm={(reason) =>
          router.post(
            urlFor('customer.orders.cancel', { id: order.id }),
            { reason },
            { preserveScroll: true, onSuccess: () => setCancelling(false) }
          )
        }
      />
    </>
  )
}

OrderDetail.layout = [AccountLayout]
