import { fromIso } from '~/lib/shared/date'

export type Segment = 'inactive' | 'active' | 'new'

export const SEGMENT_TABS: { key: Segment; label: string }[] = [
  { key: 'inactive', label: 'Tidak aktif' },
  { key: 'active', label: 'Aktif' },
  { key: 'new', label: 'Baru (30 hari)' },
]

export const THRESHOLDS = [30, 60, 90, 180]

export type CustomerRow = {
  id: string
  label: string
  name: string
  phone: string
  area: string
  last: string
  first: string
  orders: number
  spend: number
  held: number
  days: number
  isNew: boolean
  hasPaid: boolean
}

export type Customer = Omit<CustomerRow, 'last' | 'first'> & { last: Date; first: Date }

export function customersOf(rows: CustomerRow[]): Customer[] {
  return rows.map((row) => ({ ...row, last: fromIso(row.last), first: fromIso(row.first) }))
}

export function inSegment(customer: Customer, segment: Segment, threshold: number) {
  if (segment === 'inactive') {
    return customer.hasPaid && customer.days >= threshold
  }
  if (segment === 'active') {
    return customer.hasPaid && customer.days < threshold
  }
  return customer.isNew
}

export function segmentLabel(customer: Customer, threshold: number) {
  if (customer.days >= threshold) {
    return `Tidak aktif (≥ ${threshold} hari)`
  }
  return customer.isNew ? 'Baru' : 'Aktif'
}
