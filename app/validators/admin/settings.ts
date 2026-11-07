import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { SLOT_CAPACITY } from '#models/setting'
import { phoneField } from '#validators/shared/rules/phone'

export const saveStoreSettingsValidator = vine.create({
  storeName: vine.string().trim().minLength(2).maxLength(60),
  whatsapp: phoneField(),
  storeAddress: vine.string().trim().minLength(10).maxLength(200),
  hours: vine.string().trim().minLength(3).maxLength(80),
  slots: vine
    .array(
      vine.object({
        label: vine.string().trim().maxLength(20),
        capacity: vine.number().withoutDecimals().range([SLOT_CAPACITY.min, SLOT_CAPACITY.max]),
        on: vine.boolean(),
      })
    )
    .fixedLength(3),
  payments: vine.object({ qris: vine.boolean(), cash: vine.boolean() }),
  inactiveDays: vine.number().withoutDecimals().range([7, 365]),
})

export type StoreSettingsPayload = Infer<typeof saveStoreSettingsValidator>

export const searchAreasValidator = vine.create({
  q: vine.string().trim().maxLength(60).optional(),
})

export const toggleAreaValidator = vine.create({ isActive: vine.boolean() })
