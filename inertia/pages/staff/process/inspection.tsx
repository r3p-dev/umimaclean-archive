import { useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { IconClipboardCheck, IconPlus } from '@tabler/icons-react'
import { urlFor } from '~/client'
import SourceTag from '~/components/atoms/source_tag'
import ToneBadge from '~/components/atoms/tone_badge'
import BarSteps from '~/components/molecules/bar_steps'
import BillSummaryCard from '~/components/organisms/processing/bill_summary_card'
import InspectionItemCard from '~/components/organisms/processing/inspection_item_card'
import StaffMissingOrder from '~/components/organisms/staff_missing_order'
import StaffTopBar from '~/components/organisms/staff_top_bar'
import StaffLayout from '~/components/templates/staff_layout'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import type { Catalog } from '~/lib/processing/catalog'
import {
  INSPECTION_FLOW,
  ITEM_KINDS,
  inspectionPayload,
  inspectionSummary,
  previewBill,
  type InspectionItem,
  type InspectionOrder,
} from '~/lib/processing/inspection'
import { formatRupiah } from '~/lib/shared/format'

export default function Inspection({
  id: orderId,
  number,
  order,
  catalog,
}: {
  id: number
  number: string
  order: InspectionOrder | null
  catalog: Catalog
}) {
  const [items, setItems] = useState<InspectionItem[]>(order?.items ?? [])
  const [isBusy, setBusy] = useState(false)
  const back = { href: urlFor('staff.process'), label: 'Kembali ke antrean Proses' }

  if (!order) {
    return (
      <StaffLayout active="proses">
        <Head title="Pemeriksaan & layanan" />
        <StaffTopBar title="Pemeriksaan & layanan" subtitle={number} back={back} variant="detail" />
        <StaffMissingOrder number={number} backHref={back.href} backLabel={back.label} />
      </StaffLayout>
    )
  }

  const summary = inspectionSummary(items, catalog)
  const isInStore = order.source === 'toko'
  const needsStart = order.status === 'Barang Kami Terima'
  const isLocked = order.isSaved || needsStart
  const total = formatRupiah(order.isSaved ? order.total : summary.total)
  const savedText = isInStore
    ? `Tersimpan · total ${total}. Lanjutkan ke pembayaran di kasir: QRIS atau tunai.`
    : `Tersimpan · total ${total}. Tagihan dikirim ke WhatsApp ${order.customer}. Pesanan masuk Dalam Pencucian setelah lunas.`
  const next = isInStore
    ? {
        href: urlFor('staff.store_payment', { id: orderId }),
        label: 'Lanjut ke Pembayaran di Kasir',
      }
    : back

  function update(id: string, change: (item: InspectionItem) => InspectionItem) {
    setItems((current) => current.map((item) => (item.id === id ? change(item) : item)))
  }

  function addItem(kind: InspectionItem['kind'], category: InspectionItem['category']) {
    setItems((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        kind,
        category,
        name: category,
        note: '',
        selection: { main: null, addons: [] },
      },
    ])
  }

  function save() {
    if (summary.missing || isBusy) {
      return
    }
    router.post(urlFor('staff.inspection.save', { id: orderId }), inspectionPayload(items), {
      preserveScroll: true,
      onStart: () => setBusy(true),
      onFinish: () => setBusy(false),
    })
  }

  return (
    <StaffLayout active="proses">
      <Head title={`Pemeriksaan ${number}`} />
      <StaffTopBar
        title="Pemeriksaan & layanan"
        subtitle={number}
        back={back}
        variant="detail"
        actions={
          <>
            <SourceTag isInStore={isInStore} shape="pill" className="max-sm:hidden" />
            <ToneBadge tone={order.isSaved ? 'ok' : 'periksa'} className="h-6.5 px-2.5">
              {order.isSaved ? 'Tersimpan' : 'Periksa barang'}
            </ToneBadge>
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-page flex-col gap-3.5 p-4">
        <BarSteps
          label="Tahap proses"
          steps={INSPECTION_FLOW}
          current={order.isSaved ? 5 : 2}
          currentClassName="bg-status-periksa-dot"
          className="grid-cols-5"
        />
        {needsStart && (
          <Button
            size="cta"
            className="self-start"
            onPress={() => router.post(urlFor('staff.inspection.start', { id: orderId }))}
          >
            <IconClipboardCheck />
            Mulai Periksa
          </Button>
        )}
        <div className="flex flex-col gap-x-5 gap-y-3.5 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-3.5">
            <Card>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {[
                    ['Pelanggan', `${order.customer} · ${order.phone}`],
                    ['Diterima', order.received],
                    [
                      'Jumlah barang',
                      <>
                        {items.length} barang{' '}
                        <span className="font-normal text-muted-foreground">
                          (perkiraan pelanggan: {order.estimate || '—'})
                        </span>
                      </>,
                    ],
                    [
                      'Catatan pelanggan',
                      <span key="note" className="font-normal">
                        {order.customerNote ? `“${order.customerNote}”` : '—'}
                      </span>,
                    ],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex flex-col gap-0.5">
                      <dt className="text-caption font-medium text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <p className="flex gap-2 rounded-md bg-status-periksa-bg px-3 py-2.5 text-note leading-[1.45] text-status-periksa-fg">
              <IconClipboardCheck className="mt-0.5 size-4.5 shrink-0" />
              Periksa setiap barang, tulis kondisinya, lalu pilih layanan. Harga diambil dari daftar
              Layanan & Harga owner saat disimpan.
            </p>
            {summary.items.map((item) => (
              <InspectionItemCard
                key={item.id}
                label={item.label}
                title={item.name}
                category={item.category}
                note={item.note}
                selection={item.selection}
                catalog={item.catalog}
                isMissing={item.missing && !isLocked}
                subtotal={item.subtotal}
                isLocked={isLocked}
                photo={order.pickupPhoto}
                onName={(name) => update(item.id, (current) => ({ ...current, name }))}
                onNote={(note) => update(item.id, (current) => ({ ...current, note }))}
                onBase={(id) =>
                  update(item.id, (current) => ({
                    ...current,
                    selection: { ...current.selection, main: id },
                  }))
                }
                onAddOn={(id) =>
                  update(item.id, (current) => ({
                    ...current,
                    selection: {
                      ...current.selection,
                      addons: current.selection.addons.includes(id)
                        ? current.selection.addons.filter((value) => value !== id)
                        : [...current.selection.addons, id],
                    },
                  }))
                }
                onRemove={
                  items.length > 1
                    ? () => setItems((current) => current.filter((entry) => entry.id !== item.id))
                    : undefined
                }
              />
            ))}
            {!isLocked && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-note font-semibold text-foreground-secondary">
                  Barang tidak sesuai perkiraan?
                </span>
                {ITEM_KINDS.filter(({ kind }) => kind !== 'helmet' || order.canAddHelmet).map(
                  ({ kind, label }) => (
                    <Button
                      key={kind}
                      variant="outline"
                      size="compact"
                      onPress={() => addItem(kind, label)}
                    >
                      <IconPlus className="size-4.5" />
                      {label}
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
          <BillSummaryCard
            bill={order.bill ?? previewBill(summary, order.extras)}
            missing={isLocked ? 0 : summary.missing}
            isSaved={order.isSaved}
            savedText={savedText}
            next={next}
            isSaving={isBusy}
            onSave={save}
          />
        </div>
      </div>
    </StaffLayout>
  )
}
