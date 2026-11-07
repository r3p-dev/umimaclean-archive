import { totalItems, type ItemCounts } from '~/lib/order/items'
import type { PickupPoint } from '~/lib/location/point'
import { createSharedStore } from '~/lib/shared/shared_store'
import { STORE_LOCATION } from '~/lib/staff/profile'

export type ReturnMethod = 'toko' | 'antar'

export type KnownCustomer = {
  phone: string
  name: string
  initial: string
  masked: string
  history: string
  area: string | null
  address: string | null
  point: PickupPoint | null
}

export type CustomerLookup = { phone: string; match: KnownCustomer | null } | null

export type IntakeShot = { photo: string; stamp: string }

export const MAX_INTAKE_PHOTOS = 3

export const WALK_IN_STEPS = [
  { label: '1 Pelanggan', done: true },
  { label: '2 Barang & foto', done: true },
  { label: '3 Pengembalian', done: true },
  { label: '4 Periksa & layanan', done: false },
  { label: '5 Bayar (QRIS · Tunai)', done: false },
]

export const RETURN_OPTIONS: {
  key: ReturnMethod
  label: string
  description: string
}[] = [
  {
    key: 'toko',
    label: 'Diambil di toko',
    description: 'Pelanggan mengambil sendiri setelah dikabari',
  },
  {
    key: 'antar',
    label: 'Diantar ke alamat',
    description: 'Masuk antrean Antar setelah selesai dicuci',
  },
]

export function sanitizePhone(value: string) {
  return value.replace(/[^\d+ ]/g, '').slice(0, 16)
}

function phoneKey(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^(62|0)/, '')
  return digits.length >= 9 ? `62${digits}` : null
}

export function lookupCustomer(value: string, lookup: CustomerLookup) {
  const key = phoneKey(value)
  return {
    key,
    complete: key !== null,
    isChecked: key !== null && lookup?.phone === key,
    match: key && lookup?.phone === key ? lookup.match : null,
  }
}

type WalkInDraft = {
  phone: string
  name: string
  customer: KnownCustomer | null
  items: ItemCounts
  returnMethod: ReturnMethod
  useSaved: boolean
  address: string
  point: PickupPoint | null
  photoCount: number
}

export function walkInBlocker(draft: WalkInDraft, lookup: CustomerLookup) {
  const result = lookupCustomer(draft.phone, lookup)
  if (!result.complete) {
    return 'Masukkan nomor HP pelanggan.'
  }
  if (!result.isChecked) {
    return 'Mencari pelanggan…'
  }
  if (result.match && !draft.customer) {
    return 'Pilih pelanggan yang disarankan.'
  }
  if (!result.match && !draft.name.trim()) {
    return 'Isi nama pelanggan.'
  }
  if (!result.match && draft.name.trim().length < 2) {
    return 'Nama minimal 2 karakter.'
  }
  if (totalItems(draft.items) === 0) {
    return 'Tambahkan minimal 1 barang.'
  }
  if (draft.photoCount === 0) {
    return 'Ambil minimal 1 foto barang.'
  }
  if (draft.returnMethod === 'antar' && !draft.useSaved && !draft.address.trim()) {
    return 'Isi alamat dan titik antar di peta.'
  }
  if (draft.returnMethod === 'antar' && !draft.useSaved && draft.address.trim().length < 10) {
    return 'Alamat minimal 10 karakter.'
  }
  return null
}

export function walkInPayload(draft: WalkInDraft) {
  const isDelivery = draft.returnMethod === 'antar'
  return {
    phone: draft.phone,
    ...(draft.customer ? {} : { name: draft.name.trim() }),
    items: draft.items,
    returnMethod: isDelivery ? 'delivery' : 'store',
    ...(isDelivery && draft.useSaved ? { useSavedAddress: true } : {}),
    ...(isDelivery && !draft.useSaved && draft.point
      ? { address: draft.address.trim(), point: draft.point }
      : {}),
  }
}

type WalkInForm = {
  phone: string
  name: string
  isPicked: boolean
  items: ItemCounts
  returnMethod: ReturnMethod
  shouldUseSaved: boolean
  point: PickupPoint
  typedAddress: string | null
}

export const walkInForm = createSharedStore<WalkInForm>('session', 'umima:walk-in-form', () => ({
  phone: '',
  name: '',
  isPicked: false,
  items: { sepatu: 0, tas: 0, helm: 0 },
  returnMethod: 'antar',
  shouldUseSaved: true,
  point: STORE_LOCATION,
  typedAddress: null,
}))

export function updateWalkInForm(patch: Partial<WalkInForm>) {
  walkInForm.set((form) => ({ ...form, ...patch }))
}
