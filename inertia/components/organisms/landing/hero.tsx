import { IconArrowRight, IconTruckDelivery } from '@tabler/icons-react'
import Photo from '~/components/atoms/photo'
import { Badge } from '~/components/ui/badge'
import CompareSlider from '~/components/molecules/compare_slider'
import { LinkButton } from '~/components/ui/button'
import { urlFor } from '~/client'

const PHOTO = {
  widths: [640, 1100],
  ratio: 16 / 11,
  sizes: '(min-width: 600px) min(546px, calc(50vw - 34px)), calc(100vw - 40px)',
  className: 'absolute inset-0 size-full object-cover',
}

export default function Hero() {
  return (
    <section className="mx-auto box-content grid max-w-page items-center gap-7 px-5 pt-7 pb-6 sm:grid-cols-2">
      <div className="flex flex-col gap-4.5">
        <Badge variant="info" size="lg" className="self-start">
          <IconTruckDelivery />
          Antar-jemput · Bandung Raya
        </Badge>

        <h1 className="text-display text-balance">Sepatu dan tas bersih tanpa keluar rumah.</h1>

        <p className="max-w-130 text-lead text-pretty text-foreground-secondary">
          Kami jemput barang Anda, periksa kondisinya, lalu cuci dengan layanan yang paling sesuai.
          Setelah bersih, kami antar kembali.
        </p>

        <div className="flex flex-col gap-2.5 sm:items-start">
          <LinkButton
            size="cta"
            className="sm:w-auto sm:min-w-74 sm:px-7"
            href={urlFor('customer.order.create')}
          >
            Pesan Penjemputan
            <IconArrowRight />
          </LinkButton>

          <p className="text-center text-meta text-muted-foreground sm:text-left">
            Tanpa daftar akun. Cukup nama, nomor WhatsApp, dan alamat.
          </p>
        </div>
      </div>

      <div className="relative box-content aspect-16/11 p-3">
        <CompareSlider
          before={
            <Photo {...PHOTO} src="/images/landing/shoes-before" alt="Foto sepatu sebelum dicuci" />
          }
          after={
            <Photo {...PHOTO} src="/images/landing/shoes-after" alt="Foto sepatu sesudah dicuci" />
          }
          className="absolute inset-0 shadow-lg"
        />
      </div>
    </section>
  )
}
