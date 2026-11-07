import { IconAlertCircle, IconClockOff, IconExternalLink, IconRefresh } from '@tabler/icons-react'
import { urlFor } from '~/client'
import BackLink from '~/components/molecules/back_link'
import { Alert } from '~/components/ui/alert'
import { Button, LinkButton } from '~/components/ui/button'
import { formatDuration } from '~/lib/shared/format'

export default function QrisPanel({
  id,
  number,
  total,
  qrUrl,
  isExpired,
  remaining,
  isWorking,
  onRenew,
  onCheck,
}: {
  id: number
  number: string
  total: string
  qrUrl: string | null
  isExpired: boolean
  remaining: number
  isWorking: boolean
  onRenew: () => void
  onCheck: () => void
}) {
  return (
    <div className="mx-auto box-content grid max-w-page items-center gap-x-8 px-5 pb-2 sm:grid-cols-2">
      <div>
        <div className="flex flex-col items-center gap-1.5 pt-6 text-center">
          <span className="text-sm leading-none font-medium text-muted-foreground">
            Total pembayaran
          </span>
          <span className="text-[32px] leading-[1.1] font-bold tracking-[-0.02em]">{total}</span>
          <span className="font-mono text-meta leading-none font-medium text-muted-foreground">
            {number}
          </span>
        </div>
        <div className="relative mx-auto mt-5.5 flex w-65 flex-col items-center gap-3 rounded-lg border border-border p-4">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`Kode QRIS pembayaran ${number}`}
              className="size-57 rounded-inner object-contain"
            />
          ) : (
            <div
              role="img"
              aria-label="Kode QRIS sedang dibuat"
              className="stripes flex size-57 items-center justify-center rounded-inner p-5 text-center [--stripe-angle:45deg] [--stripe:8px]"
            >
              <span className="rounded-xs bg-surface-glass px-1.75 py-1 font-mono text-2xs leading-[1.4] font-medium text-foreground-secondary">
                membuat kode QR…
              </span>
            </div>
          )}
          <span className="text-meta leading-none font-semibold tracking-[0.06em]">
            UMIMA CLEAN
          </span>
          {isExpired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-surface-glass p-5 text-center">
              <IconClockOff className="size-8.5 text-destructive-text" />
              <span className="text-[15px] leading-[1.3] font-semibold">Kode QR kedaluwarsa</span>
            </div>
          )}
        </div>
        {isExpired ? (
          <Alert variant="destructive" className="mt-4 text-sm leading-[1.45] font-medium">
            <IconAlertCircle className="size-4.5" />
            Kode berlaku 15 menit dan sudah habis. Tidak ada dana yang terpotong.
          </Alert>
        ) : (
          <p
            role="status"
            className="mt-4 flex h-12 items-center justify-center gap-2.5 rounded-md bg-status-bayar-bg text-sm leading-none font-medium text-attention-foreground"
          >
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-[2.5px] border-attention-border border-t-attention-foreground"
            />
            Menunggu pembayaran · berlaku{' '}
            <span className="font-mono font-semibold">{formatDuration(remaining)}</span>
          </p>
        )}
      </div>
      <div>
        <h2 className="mt-6 text-lg leading-[1.3] font-semibold max-sm:sr-only">Cara membayar</h2>
        <ol className="mt-5 flex list-decimal flex-col gap-2 pl-5 text-[14.5px] leading-normal">
          <li>Buka aplikasi pembayaran pilihan Anda yang mendukung QRIS.</li>
          <li>Pilih scan/bayar QRIS, lalu arahkan kamera ke kode di atas.</li>
          <li>Pastikan nama merchant UMIMA CLEAN dan nominal {total}, lalu konfirmasi.</li>
          <li>Halaman ini berubah otomatis setelah pembayaran masuk.</li>
        </ol>
        <div className="flex flex-col gap-2.5 pt-5.5 pb-6">
          {isExpired ? (
            <Button size="cta" className="w-full" onPress={onRenew} isPending={isWorking}>
              <IconRefresh />
              Buat Kode QR Baru
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="cta"
                className="w-full"
                onPress={onCheck}
                isPending={isWorking}
              >
                <IconRefresh />
                Sudah Bayar? Cek Status
              </Button>
              {qrUrl && (
                <LinkButton
                  variant="ghost"
                  size="desktop"
                  className="w-full text-primary"
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconExternalLink className="size-4.5" />
                  Buka Gambar QR (untuk disimpan)
                </LinkButton>
              )}
            </>
          )}
          <BackLink
            href={urlFor('customer.orders.show', { id })}
            label="Kembali ke Pesanan"
            className="ml-0 self-stretch"
          />
        </div>
      </div>
    </div>
  )
}
