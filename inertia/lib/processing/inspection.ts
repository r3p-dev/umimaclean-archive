import type { Data } from '@generated/data'
import type { BillExtra } from '~/lib/payment/bill'
import { formatRupiah } from '~/lib/shared/format'
import { selectionLines, selectionTotal, type Catalog } from '~/lib/processing/catalog'

export type InspectionOrder = Data.Inspection

export type InspectionItem = InspectionOrder['items'][number]

export const INSPECTION_FLOW = [
  'Barang diterima',
  'Periksa barang',
  'Tentukan layanan',
  'Set harga',
  'Simpan',
]

export const ITEM_KINDS: { kind: InspectionItem['kind']; label: InspectionItem['category'] }[] = [
  { kind: 'shoe', label: 'Sepatu' },
  { kind: 'bag', label: 'Tas' },
  { kind: 'helmet', label: 'Helm' },
]

export function inspectionSummary(items: InspectionItem[], catalog: Catalog) {
  const rows = items.map((item, index) => {
    const options = catalog[item.category]
    const lines = selectionLines(options, item.selection)
    const subtotal = selectionTotal(options, item.selection)
    return {
      ...item,
      label: `Barang ${String(index + 1).padStart(2, '0')}`,
      catalog: options ?? { base: [], adds: [] },
      lines,
      subtotal,
      missing: !item.selection.main || item.name.trim().length < 2,
    }
  })
  const total = rows.reduce((sum, item) => sum + item.subtotal, 0)
  const missing = rows.filter((item) => item.missing).length
  return { items: rows, total, totalText: formatRupiah(total), missing }
}

export function inspectionPayload(items: InspectionItem[]) {
  return {
    items: items.map((item) => ({
      kind: item.kind,
      itemName: item.name.trim(),
      ...(item.note.trim() ? { note: item.note.trim() } : {}),
      services: { main: item.selection.main, addons: item.selection.addons },
    })),
  }
}

export function previewBill(summary: ReturnType<typeof inspectionSummary>, extras: BillExtra[]) {
  return {
    items: summary.items.map((item) => {
      const main = item.lines.find((line) => line.id === item.selection.main) ?? null
      return {
        name: item.name.trim() || item.category,
        kind: item.category,
        note: item.note,
        main: main ? { name: main.name, price: main.price } : null,
        addons: item.lines
          .filter((line) => line !== main)
          .map((line) => ({ name: line.name, price: line.price })),
        subtotal: item.subtotal,
      }
    }),
    extras,
    total: summary.total,
  }
}
