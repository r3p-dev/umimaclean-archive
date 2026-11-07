import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { SettingSchema } from '#database/schema'

type StoreInfo = { name: string; whatsapp: string; address: string; hours: string }

export type PickupSlotSetting = { label: string; capacity: number; on: boolean }

type PaymentMethodSettings = { qris: boolean; cash: boolean }

export type SettingValues = {
  store: StoreInfo
  pickup_slots: PickupSlotSetting[]
  payment_methods: PaymentMethodSettings
  inactive_days: number
}

export type SettingKey = keyof SettingValues

export const SLOT_CAPACITY = { min: 1, max: 20 } as const

export const STORE_POINT = { lat: -6.955631, lng: 107.6539748 }

export const DEFAULT_SETTINGS: SettingValues = {
  store: {
    name: 'Umima Clean',
    whatsapp: '6285157900974',
    address: 'Jl. Margacinta No. 132, Margasari, Buahbatu, Kota Bandung 40286',
    hours: 'Senin–Sabtu · 09.00–20.00',
  },
  pickup_slots: [
    { label: '09.00–12.00', capacity: 6, on: true },
    { label: '12.00–15.00', capacity: 6, on: true },
    { label: '15.00–18.00', capacity: 4, on: true },
  ],
  payment_methods: { qris: true, cash: true },
  inactive_days: 60,
}

export default class Setting extends SettingSchema {
  static override selfAssignPrimaryKey = true

  static async get<Key extends SettingKey>(
    key: Key,
    transaction?: TransactionClientContract
  ): Promise<SettingValues[Key]> {
    const row = await Setting.query({ client: transaction }).where('key', key).first()
    return (row?.value as SettingValues[Key] | undefined) ?? DEFAULT_SETTINGS[key]
  }

  static async put<Key extends SettingKey>(
    key: Key,
    value: SettingValues[Key],
    transaction?: TransactionClientContract
  ) {
    await Setting.updateOrCreate({ key }, { value }, { client: transaction })
  }
}
