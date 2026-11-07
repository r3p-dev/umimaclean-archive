import { type ComponentType, type ReactNode, type SVGProps } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { IconBrandInstagram, IconBrandWhatsapp, IconClock, IconMapPin } from '@tabler/icons-react'
import Logo from '~/components/atoms/logo'
import Overline from '~/components/atoms/overline'
import { customerContact, customerLinks } from '~/lib/navigation/customer_links'

const LINK =
  'inline-flex min-h-icon-btn items-center text-foreground-secondary hover:text-foreground hover:underline'

function FooterColumn({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-1">
      <Overline as="h2" id={id} className="text-xs">
        {title}
      </Overline>
      <ul className="flex flex-col text-sm leading-[1.4] font-medium">{children}</ul>
    </nav>
  )
}

function ContactLine({
  icon: Icon,
  label,
  href,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  href?: string
  children: ReactNode
}) {
  const content = (
    <>
      <Icon className="size-4.5 shrink-0 text-icon-muted" />
      <span className="sr-only">{label}: </span>
      {children}
    </>
  )

  return (
    <li>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-icon-btn items-center gap-2 hover:text-foreground hover:underline"
        >
          {content}
        </a>
      ) : (
        <span className="inline-flex min-h-icon-btn items-center gap-2">{content}</span>
      )}
    </li>
  )
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto box-content max-w-page px-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 pt-10 pb-8 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:gap-x-10">
          <div className="col-span-2 flex flex-col items-start gap-4 sm:col-span-3 lg:col-span-1">
            <Link route="home" className="rounded-xs">
              <Logo />
            </Link>
            <p className="max-w-80 text-sm leading-normal text-pretty text-foreground-secondary">
              Cuci sepatu dan tas dengan antar-jemput di Bandung Raya. Helm dicuci langsung di toko.
            </p>
            <ul className="flex flex-col text-meta text-foreground-secondary">
              <ContactLine
                icon={IconMapPin}
                label="Alamat di Google Maps"
                href={customerLinks.maps}
              >
                {customerContact.address}
              </ContactLine>
              <ContactLine icon={IconClock} label="Jam buka">
                {customerContact.hours}
              </ContactLine>
              <ContactLine icon={IconBrandWhatsapp} label="WhatsApp" href={customerLinks.whatsapp}>
                {customerContact.whatsapp}
              </ContactLine>
              <ContactLine
                icon={IconBrandInstagram}
                label="Instagram"
                href={customerLinks.instagram}
              >
                {customerContact.instagram}
              </ContactLine>
            </ul>
          </div>
          <FooterColumn id="footer-layanan" title="Layanan">
            <li>
              <a href="/#cara-kerja" className={LINK}>
                Cara Kerja
              </a>
            </li>
            <li>
              <a href="/#harga" className={LINK}>
                Daftar Harga
              </a>
            </li>
            <li>
              <a href="/#area-layanan" className={LINK}>
                Area Layanan
              </a>
            </li>
            <li>
              <a href="/#faq" className={LINK}>
                Pertanyaan Umum
              </a>
            </li>
          </FooterColumn>
          <FooterColumn id="footer-pelanggan" title="Pelanggan">
            <li>
              <Link route="customer.order.create" className={LINK}>
                Pesan Penjemputan
              </Link>
            </li>
            <li>
              <Link route="customer.orders.index" className={LINK}>
                Riwayat Pesanan
              </Link>
            </li>
            <li>
              <Link route="auth.register" className={LINK}>
                Daftar Akun
              </Link>
            </li>
            <li>
              <Link route="legal.terms" className={LINK}>
                Syarat Layanan
              </Link>
            </li>
            <li>
              <Link route="legal.privacy" className={LINK}>
                Kebijakan Privasi
              </Link>
            </li>
          </FooterColumn>
          <FooterColumn id="footer-tim" title="Tim Umima">
            <li>
              <Link route="auth.staff_login" className={LINK}>
                Masuk Staf & Owner
              </Link>
            </li>
          </FooterColumn>
        </div>
        <div className="flex flex-col gap-1 border-t border-border py-5 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Umima Clean · Bandung Raya</p>
          <p>
            Dibuat oleh{' '}
            <a
              href={customerLinks.creator}
              target="_blank"
              rel="noreferrer"
              className="hit-area font-semibold text-foreground-secondary hover:text-foreground hover:underline"
            >
              r3p.dev
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
