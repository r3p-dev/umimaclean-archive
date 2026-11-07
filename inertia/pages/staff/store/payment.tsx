import { useId, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { IconCheck, IconPrinter, IconRefresh, IconWashMachine } from '@tabler/icons-react'
import { urlFor } from '~/client'
import { Button, LinkButton } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { FieldError } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import SourceTag from '~/components/atoms/source_tag'
import BillItems from '~/components/organisms/payment/bill_items'
import StaffMissingOrder from '~/components/organisms/staff_missing_order'
import StaffTopBar from '~/components/organisms/staff_top_bar'
import PaymentMethodPicker from '~/components/organisms/store/payment_method_picker'
import StaffLayout from '~/components/templates/staff_layout'
import { useCountdown } from '~/lib/shared/countdown'
import { formatDuration, formatRupiah } from '~/lib/shared/format'
import { useLiveReload } from '~/lib/shared/live'
import {
  PAYMENT_METHODS,
  formatRupiahInput,
  parseRupiah,
  type PaymentMethod,
} from '~/lib/store/payment'

type Receipt = Data.Receipt & { isSaved: boolean; isPaid: boolean }

type Qris = { qrUrl: string | null; expiresAt: string | null; status: string }

export default function StorePayment({
  id,
  number,
  order,
  methods: enabled,
  isQrisAvailable,
  qris,
}: {
  id: number
  number: string
  order: Receipt | null
  methods: Record<PaymentMethod, boolean>
  isQrisAvailable: boolean
  qris: Qris | null
}) {
  const methods = PAYMENT_METHODS.filter(
    (method) => enabled[method.key] && (method.key !== 'qris' || isQrisAvailable)
  )
  const [picked, setPicked] = useState<PaymentMethod | null>(null)
  const [received, setReceived] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setBusy] = useState(false)
  const fieldId = useId()
  const back = { href: urlFor('staff.process'), label: 'Kembali ke Proses' }
  const method = picked && methods.some((item) => item.key === picked) ? picked : methods[0]?.key
  const remaining = useCountdown(qris?.expiresAt ? new Date(qris.expiresAt).getTime() : null)
  useLiveReload(`orders/${id}`, ['order', 'qris'])

  if (!order) {
    return (
      <StaffLayout active="proses">
        <Head title="Pembayaran di toko" />
        <StaffTopBar title="Pembayaran di toko" subtitle={number} back={back} variant="detail" />
        <StaffMissingOrder number={number} backHref={back.href} backLabel={back.label} />
      </StaffLayout>
    )
  }

  const { total, payment } = order
  const change = received !== null ? received - total : null
  const busy = { onStart: () => setBusy(true), onFinish: () => setBusy(false) }

  function choose(next: PaymentMethod) {
    setPicked(next)
    setError(null)
  }

  function confirm() {
    if (!method || isBusy) {
      return
    }
    if (method === 'qris') {
      router.post(
        urlFor(
          qris && remaining > 0 ? 'staff.store_payment.qris_check' : 'staff.store_payment.qris',
          {
            id,
          }
        ),
        {},
        busy
      )
      return
    }
    if (method === 'cash' && (received === null || received < total)) {
      setError(
        received === null
          ? 'Isi jumlah uang yang diterima.'
          : `Uang diterima kurang ${formatRupiah(total - received)}.`
      )
      return
    }
    router.post(
      urlFor('staff.store_payment.record', { id }),
      { method: 'cash', cashReceived: received },
      {
        ...busy,
        preserveScroll: true,
        onError: (errors) => setError(errors.cashReceived ?? errors.method ?? null),
      }
    )
  }

  const rows = payment
    ? [
        ['Status', 'Lunas'],
        ['Metode', payment.method],
        ['Jumlah', formatRupiah(total)],
        ['Waktu', payment.paidAt],
        ...(payment.cashReceived !== null
          ? [
              ['Uang diterima', formatRupiah(payment.cashReceived)],
              ['Kembalian', formatRupiah(payment.change ?? 0)],
            ]
          : [['ID transaksi QRIS', payment.transactionId ?? '—']]),
      ]
    : []

  return (
    <StaffLayout active="proses">
      <Head title={`Pembayaran ${number}`} />
      <StaffTopBar
        title="Pembayaran di toko"
        subtitle={`${order.number} · ${order.customer}`}
        back={back}
        variant="detail"
        actions={<SourceTag isInStore shape="pill" />}
      />
      <div className="mx-auto flex w-full max-w-160 flex-col gap-3.5 p-4">
        <Card>
          <CardHeader className="border-b">
            <CardTitle as="h2">Tagihan</CardTitle>
          </CardHeader>
          <CardContent>
            <BillItems items={order.items} extras={order.extras} total={total} />
          </CardContent>
        </Card>

        {!order.isSaved ? (
          <Card>
            <CardHeader>
              <CardTitle as="h2">Pemeriksaan belum disimpan</CardTitle>
              <CardDescription>
                Tentukan layanan dan simpan pemeriksaan dulu agar tagihan bisa dibayar.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <LinkButton
                variant="outline"
                size="desktop"
                href={urlFor('staff.inspection', { id })}
              >
                Buka Pemeriksaan
              </LinkButton>
            </CardFooter>
          </Card>
        ) : payment ? (
          <Card>
            <CardHeader>
              <CardTitle as="h2" role="status">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                    <IconCheck className="size-6.5" />
                  </span>
                  Pembayaran lunas
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border rounded-md border border-border px-3.5">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="flex gap-2 text-sm text-foreground-secondary">
                <IconWashMachine className="mt-0.5 size-4.5 shrink-0 text-status-cuci-fg" />
                Pesanan langsung masuk Dalam Pencucian. Bila pelanggan minta diantar, pesanan masuk
                antrean Antar setelah selesai dicuci.
              </p>
            </CardContent>
            <CardFooter>
              <LinkButton className="w-full" href={urlFor('staff.print.receipt', { id })}>
                <IconPrinter />
                Cetak struk
              </LinkButton>
              <LinkButton variant="outline" className="w-full" href={back.href}>
                Selesai
              </LinkButton>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle as="h2">Metode pembayaran</CardTitle>
              <CardDescription>
                Khusus transaksi di toko. Pesanan online dibayar pelanggan dengan QRIS dari tagihan
                WhatsApp.
                {!isQrisAvailable &&
                  enabled.qris &&
                  ' QRIS belum tersedia: Midtrans belum dikonfigurasi.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {method ? (
                <>
                  <PaymentMethodPicker methods={methods} value={method} onChange={choose} />
                  {method === 'qris' && (
                    <div className="flex flex-col items-center gap-2.5 rounded-md bg-background p-3.5">
                      {qris?.qrUrl && remaining > 0 ? (
                        <>
                          <img
                            src={qris.qrUrl}
                            alt={`Kode QRIS ${number}`}
                            className="size-45 rounded-inner bg-card object-contain"
                          />
                          <span className="text-center text-note text-foreground-secondary">
                            Tunjukkan layar ke pelanggan. Status berubah otomatis setelah pembayaran
                            masuk · berlaku{' '}
                            <span className="font-mono font-semibold">
                              {formatDuration(remaining)}
                            </span>
                          </span>
                        </>
                      ) : (
                        <span className="text-center text-note text-foreground-secondary">
                          {qris
                            ? 'Kode QR kedaluwarsa. Buat kode baru.'
                            : 'Buat kode QRIS untuk ditunjukkan ke pelanggan.'}
                        </span>
                      )}
                    </div>
                  )}
                  {method === 'cash' && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={fieldId}>Uang diterima</Label>
                      <Input
                        id={fieldId}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Rp0"
                        value={formatRupiahInput(received)}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${fieldId}-error` : undefined}
                        onChange={(event) => {
                          setReceived(parseRupiah(event.target.value))
                          setError(null)
                        }}
                        className="text-lg font-semibold"
                      />
                      {error ? (
                        <FieldError id={`${fieldId}-error`}>{error}</FieldError>
                      ) : (
                        change !== null &&
                        change >= 0 && (
                          <div className="flex items-baseline justify-between rounded-md bg-success px-3 py-2.5 text-md font-semibold text-success-foreground">
                            <span>Kembalian</span>
                            <span>{formatRupiah(change)}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  <Button size="cta" onPress={confirm} isPending={isBusy}>
                    {method === 'qris' && <IconRefresh />}
                    {isBusy
                      ? 'Memproses…'
                      : method === 'qris'
                        ? qris && remaining > 0
                          ? 'Cek Pembayaran QRIS'
                          : 'Buat Kode QRIS'
                        : `Terima Tunai · ${formatRupiah(total)}`}
                  </Button>
                </>
              ) : (
                <p className="text-note text-destructive-text">
                  Tidak ada metode pembayaran toko yang aktif. Aktifkan di Pengaturan owner.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </StaffLayout>
  )
}
