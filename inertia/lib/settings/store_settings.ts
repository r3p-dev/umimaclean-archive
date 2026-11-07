import { router } from '@inertiajs/react'
import { urlFor } from '~/client'

export type StorePayKey = 'qris' | 'cash'

export const STORE_PAY_METHODS: { key: StorePayKey; label: string }[] = [
  { key: 'qris', label: 'QRIS (dari Midtrans)' },
  { key: 'cash', label: 'Tunai di toko' },
]

export type PickupSlotSetting = { label: string; capacity: number; on: boolean }

export type StoreSettings = {
  name: string
  whatsapp: string
  address: string
  hours: string
  slots: PickupSlotSetting[]
  payments: Record<StorePayKey, boolean>
  inactiveDays: number
}

export const SLOT_CAPACITY = { min: 1, max: 20 }

export function saveStoreSettings(
  settings: StoreSettings,
  callbacks: { onError?: (errors: Record<string, string>) => void; onFinish?: () => void } = {}
) {
  const { name, address, ...rest } = settings
  router.put(
    urlFor('admin.store.update'),
    { ...rest, storeName: name, storeAddress: address },
    { preserveScroll: true, ...callbacks }
  )
}
