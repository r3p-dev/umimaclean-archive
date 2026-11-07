import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import {
  IconArchive,
  IconCheck,
  IconChevronRight,
  IconTag,
  IconTruckDelivery,
} from '@tabler/icons-react'
import { urlFor } from '~/client'
import EmptyState from '~/components/molecules/empty_state'
import AccountLayout from '~/components/templates/account_layout'
import { LinkButton } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import type { Data } from '@generated/data'
import type { SavedAddress } from '~/lib/order/addresses'
import { cn } from '~/lib/shared/utils'

export default function CustomerWelcome({
  user,
  primaryAddress,
}: {
  user: Data.User
  primaryAddress: SavedAddress | null
}) {
  const steps = [
    {
      title: 'Simpan alamat jemput',
      text: 'Isi sekali, dipakai otomatis setiap pesan.',
      done: !!primaryAddress,
      action: { label: 'Tambah alamat', href: urlFor('customer.addresses.create') },
    },
    {
      title: 'Pesan penjemputan pertama',
      text: 'Pilih barang dan jadwal, kurir datang ke alamat Anda.',
      done: false,
      action: { label: 'Pesan sekarang', href: urlFor('customer.order.create') },
    },
    {
      title: 'Bayar setelah tahu harganya',
      text: 'Tagihan muncul di sini dan via WhatsApp setelah barang diperiksa.',
      done: false,
      action: null,
    },
  ]

  return (
    <>
      <Head title="Beranda" />
      <div className="mx-auto box-content max-w-page px-5 pt-6 lg:pt-10">
        <p className="text-sm leading-none font-semibold text-success-foreground lg:hidden">
          Akun Anda siap
        </p>
        <h1 className="mt-2 text-[28px] leading-[1.15] font-bold tracking-[-0.02em] lg:mt-0 lg:text-[34px]">
          Selamat datang, {user.firstName}
        </h1>
        <p className="mt-2 text-[15px] leading-normal text-foreground-secondary max-lg:hidden">
          Akun Anda siap. Berikut cara memulai.
        </p>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:mt-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <div className="flex flex-col gap-4 lg:gap-6">
            <Card
              role="region"
              aria-labelledby="first-order-title"
              className="sm:flex-row sm:items-center"
            >
              <CardHeader className="sm:flex-1 sm:grid-cols-[auto_1fr]">
                <span className="mb-3 flex size-14 items-center justify-center rounded-lg bg-accent text-info-foreground sm:row-span-2 sm:mr-5 sm:mb-0 sm:size-16 sm:self-center">
                  <IconTruckDelivery className="size-7" />
                </span>
                <CardTitle as="h2" id="first-order-title" className="text-xl font-bold">
                  Pesan penjemputan pertama Anda
                </CardTitle>
                <CardDescription className="text-md leading-normal text-foreground-secondary">
                  Kurir menjemput sepatu atau tas Anda. Bayar setelah tahu harganya.
                </CardDescription>
              </CardHeader>
              {/* Slots stack vertically by design; in this sm: row their side padding doubles, so pull the button back to the reference 24px gap. */}
              <CardFooter className="sm:-ml-7.5">
                <LinkButton
                  href={urlFor('customer.order.create')}
                  className="w-full px-6 max-sm:h-cta sm:w-auto"
                >
                  Pesan Penjemputan
                </LinkButton>
              </CardFooter>
            </Card>
            <Card role="region" aria-labelledby="start-steps-title">
              <CardHeader>
                <CardTitle as="h2" id="start-steps-title">
                  Mulai dalam 3 langkah
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="divide-y divide-border">
                  {steps.map((step, index) => (
                    <li
                      key={step.title}
                      className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-full border text-sm leading-none font-semibold',
                          step.done
                            ? 'border-success-solid bg-success-solid text-success-solid-foreground'
                            : 'border-border-strong text-foreground-secondary'
                        )}
                      >
                        {step.done ? <IconCheck className="size-5" /> : index + 1}
                        <span className="sr-only">{step.done ? ' (selesai)' : ''}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-md font-semibold">{step.title}</span>
                        <span className="text-meta text-muted-foreground">{step.text}</span>
                      </span>
                      {step.action && !step.done && (
                        <LinkButton
                          href={step.action.href}
                          variant="outline"
                          size="compact"
                          className="shrink-0"
                        >
                          {step.action.label}
                        </LinkButton>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
          <aside className="flex flex-col gap-4">
            <Card>
              <CardContent>
                <EmptyState
                  icon={IconArchive}
                  title="Belum ada pesanan"
                  description="Pesanan aktif dan riwayat akan muncul di sini setelah Anda memesan."
                />
              </CardContent>
            </Card>
            <Link
              href="/#harga"
              className="flex min-h-14 items-center gap-3 rounded-lg bg-muted px-5 text-[15px] leading-none font-medium text-foreground no-underline hover:bg-accent hover:text-foreground hover:no-underline"
            >
              <IconTag className="size-5.5 text-foreground-secondary" />
              <span className="flex-1">Lihat kisaran harga layanan</span>
              <IconChevronRight className="size-5 text-foreground-secondary" />
            </Link>
          </aside>
        </div>
      </div>
    </>
  )
}

CustomerWelcome.layout = [AccountLayout]
