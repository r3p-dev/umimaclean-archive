import db from '@adonisjs/lucid/services/db'
import { ActivityAction } from '#enums/activity_enum'
import ActivityLog from '#models/activity_log'
import { PHOTO_RETENTION_DAYS } from '#models/order_photo'
import Setting, { DEFAULT_SETTINGS, type SettingValues } from '#models/setting'
import type User from '#models/user'
import type { StoreSettingsPayload } from '#validators/admin/settings'

export default class SettingService {
  storeProfile() {
    return Setting.get('store')
  }

  async allSettings(): Promise<SettingValues> {
    const rows = await Setting.query()
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    return { ...DEFAULT_SETTINGS, ...stored } as SettingValues
  }

  async privacyPolicyInfo() {
    return { store: await Setting.get('store'), photoDays: PHOTO_RETENTION_DAYS }
  }

  async saveStoreSettings(owner: User, payload: StoreSettingsPayload) {
    await db.transaction(async (transaction) => {
      await Setting.put(
        'store',
        {
          name: payload.storeName,
          whatsapp: payload.whatsapp,
          address: payload.storeAddress,
          hours: payload.hours,
        },
        transaction
      )
      await Setting.put('pickup_slots', payload.slots, transaction)
      await Setting.put('payment_methods', payload.payments, transaction)
      await Setting.put('inactive_days', payload.inactiveDays, transaction)
      await ActivityLog.record(
        {
          actor: owner,
          action: ActivityAction.SETTINGS_CHANGED,
          detail: `Profil toko, slot (${payload.slots.map((slot) => (slot.on ? slot.capacity : 'tutup')).join('/')}), metode bayar`,
        },
        transaction
      )
    })
  }
}
