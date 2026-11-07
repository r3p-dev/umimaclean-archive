import { useState } from 'react'
import { IconInfoCircle } from '@tabler/icons-react'
import { Alert } from '~/components/ui/alert'
import { Card, CardTitle } from '~/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { formatRupiah } from '~/lib/shared/format'

type PriceEntry = {
  name: string
  price: number
  isStartingPrice: boolean
  description: string
}

export type PriceGroup = {
  label: string
  isStoreOnly: boolean
  main: PriceEntry[]
  addons: PriceEntry[]
}

function PriceRow({ entry }: { entry: PriceEntry }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] content-start gap-x-4 gap-y-1 border-b border-border py-3.5">
      <span className="text-base leading-[1.3] font-semibold">{entry.name}</span>

      <span className="text-right text-base leading-[1.3] font-semibold whitespace-nowrap tabular-nums">
        {entry.isStartingPrice && (
          <span className="text-caption leading-none font-medium text-muted-foreground">
            mulai{' '}
          </span>
        )}
        {formatRupiah(entry.price)}
      </span>

      {entry.description && (
        <p className="col-span-full text-sm leading-normal text-pretty text-foreground-secondary">
          {entry.description}
        </p>
      )}
    </li>
  )
}

function GroupPrices({ group }: { group: PriceGroup }) {
  return (
    <ul className="grid gap-x-10 lg:grid-cols-2">
      {group.main.map((entry) => (
        <PriceRow key={entry.name} entry={entry} />
      ))}
      {group.addons.length > 0 && (
        <li className="mt-3.5 self-start">
          <Card className="gap-2 border-0 bg-background px-4 py-3.5 shadow-none">
            <CardTitle className="text-md font-semibold">Biaya tambahan</CardTitle>
            <dl className="flex flex-col gap-2">
              {group.addons.map((addon) => (
                <div
                  key={addon.name}
                  className="flex justify-between gap-3 text-[14.5px] leading-[1.4]"
                >
                  <dt>{addon.name}</dt>
                  <dd className="font-semibold whitespace-nowrap tabular-nums">
                    +{addon.isStartingPrice ? 'mulai ' : ''}
                    {formatRupiah(addon.price)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </li>
      )}
    </ul>
  )
}

export default function PriceListSection({ groups }: { groups: PriceGroup[] }) {
  const visible = groups.filter((group) => group.main.length > 0)
  const [tab, setTab] = useState(visible[0]?.label ?? '')

  return (
    <section
      id="harga"
      aria-labelledby="harga-heading"
      className="mx-auto box-content flex max-w-page flex-col gap-4 px-5 pt-10 pb-2"
    >
      <div className="flex flex-col gap-2">
        <h2 id="harga-heading" className="text-title">
          Daftar harga
        </h2>

        <p className="max-w-160 text-md leading-[1.55] text-pretty text-foreground-secondary">
          Gambaran biaya setiap layanan, supaya Anda tahu kisarannya sebelum memesan.
        </p>
      </div>

      <Alert variant="info" role="note" className="font-medium">
        <IconInfoCircle className="mt-px" />
        <span>
          Harga acuan. Anda tidak perlu memilih layanan: tim kami memeriksa setiap barang, lalu
          menentukan layanan dan harga akhirnya. Tagihan dikirim via WhatsApp sebelum pencucian
          dimulai.
        </span>
      </Alert>

      {visible.length ? (
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => setTab(String(key))}
          className="w-full gap-4"
        >
          <TabsList
            variant="line"
            aria-label="Kategori layanan"
            className="flex justify-start scrollbar-none"
          >
            {visible.map((group) => (
              <TabsTrigger
                key={group.label}
                id={group.label}
                className="h-btn-desktop px-3.5 text-md leading-none"
              >
                {group.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {visible.map((group) => (
            <TabsContent key={group.label} id={group.label} className="flex flex-col gap-3">
              {group.isStoreOnly && (
                <Alert variant="info" role="note" className="font-medium">
                  <IconInfoCircle className="mt-px" />
                  <span>
                    Khusus di toko: {group.label.toLowerCase()} tidak bisa dijemput kurir. Bawa
                    langsung ke toko kami untuk dicuci.
                  </span>
                </Alert>
              )}
              <GroupPrices group={group} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-sm leading-normal text-foreground-secondary">
          Daftar harga sedang diperbarui. Hubungi kami via WhatsApp untuk harga terbaru.
        </p>
      )}
    </section>
  )
}
