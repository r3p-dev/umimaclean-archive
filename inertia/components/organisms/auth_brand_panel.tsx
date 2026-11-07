import { type ComponentType, type SVGProps } from 'react'
import { Link } from '@adonisjs/inertia/react'
import {
  IconClipboardCheck,
  IconMessage,
  IconReceipt,
  IconRoute,
  IconTruckDelivery,
  IconWashMachine,
} from '@tabler/icons-react'
import Logo from '~/components/atoms/logo'
import { customerLinks } from '~/lib/navigation/customer_links'

type Benefit = { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; text: string }

const CUSTOMER: { headline: string; benefits: Benefit[] } = {
  headline: 'Sepatu dan tas bersih tanpa keluar rumah.',
  benefits: [
    {
      icon: IconTruckDelivery,
      title: 'Jemput & antar gratis',
      text: 'Kota Bandung, Cimahi, dan sebagian Kab. Bandung.',
    },
    {
      icon: IconClipboardCheck,
      title: 'Tidak perlu memilih layanan',
      text: 'Tim kami memeriksa barang lalu menentukan layanan dan harga.',
    },
    {
      icon: IconReceipt,
      title: 'Riwayat & alamat tersimpan',
      text: 'Pesan lagi tanpa mengisi data dari awal.',
    },
  ],
}

const STAFF: typeof CUSTOMER = {
  headline: 'Aplikasi staf dan dasbor owner Umima Clean.',
  benefits: [
    {
      icon: IconRoute,
      title: 'Jemput & antar',
      text: 'Antrean tugas, rute, dan foto bukti dalam satu tempat.',
    },
    {
      icon: IconWashMachine,
      title: 'Proses di workshop',
      text: 'Periksa barang, tentukan layanan, dan pantau pencucian.',
    },
    {
      icon: IconReceipt,
      title: 'Ringkasan bisnis',
      text: 'Owner memantau pesanan, omzet, dan aktivitas staf.',
    },
  ],
}

export default function AuthBrandPanel({ isStaff = false }: { isStaff?: boolean }) {
  const content = isStaff ? STAFF : CUSTOMER

  return (
    <aside
      data-surface="inverse"
      className="sticky top-0 hidden h-dvh flex-col justify-between bg-surface-inverse px-16 py-12 text-surface-inverse-foreground lg:flex"
    >
      <Link route="home" className="self-start rounded-xs">
        <Logo tone="inverse" />
      </Link>
      <div className="flex max-w-115 flex-col gap-9">
        <p className="text-[44px] leading-[1.05] font-bold tracking-[-0.03em]">
          {content.headline}
        </p>
        <ul className="flex flex-col gap-7">
          {content.benefits.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-card text-foreground">
                <Icon className="size-5.5" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[17px] leading-[1.3] font-semibold">{title}</span>
                <span className="text-[15px] leading-normal text-surface-inverse-muted">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <a
        href={customerLinks.whatsapp}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-icon-btn items-center gap-2 self-start text-sm text-surface-inverse-muted hover:text-surface-inverse-foreground"
      >
        <IconMessage className="size-4.5" />
        Butuh bantuan? Chat WhatsApp Umima Clean.
      </a>
    </aside>
  )
}
