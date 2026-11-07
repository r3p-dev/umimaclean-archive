import Photo from '~/components/atoms/photo'
import { Card, CardDescription, CardTitle } from '~/components/ui/card'

const ITEMS = [
  {
    name: 'Sepatu',
    description: 'Sneakers, kanvas, kulit',
    src: '/images/landing/shoes',
    alt: 'Foto sepatu',
  },
  {
    name: 'Tas',
    description: 'Ransel, tote, kulit',
    src: '/images/landing/bag',
    alt: 'Foto tas ransel',
  },
  {
    name: 'Helm',
    description: 'Half-face, full-face · bawa ke toko',
    src: '/images/landing/helmet',
    alt: 'Foto helm',
  },
]

export default function LaundryItems() {
  return (
    <section className="mx-auto box-content flex max-w-page flex-col gap-4 px-5 pt-8 pb-2">
      <h2 className="text-title">Yang kami cuci</h2>
      <ul className="grid grid-cols-3 gap-[clamp(10px,2vw,24px)]">
        {ITEMS.map((item) => (
          <li key={item.name}>
            <Card className="gap-2 border-0 bg-transparent p-0 shadow-none">
              <Photo
                src={item.src}
                widths={[360, 720]}
                ratio={1}
                sizes="min(357px, calc(33vw - 20px))"
                alt={item.alt}
                isLazy
                className="aspect-square w-full rounded-md object-cover shadow-sm"
              />
              <CardTitle className="text-md leading-[1.2] font-semibold">{item.name}</CardTitle>
              <CardDescription className="text-caption leading-[1.35] text-muted-foreground">
                {item.description}
              </CardDescription>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
