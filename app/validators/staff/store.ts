import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { ReturnMethod } from '#enums/order_enum'
import { PaymentMethod } from '#enums/payment_enum'
import { MAX_ITEMS_PER_KIND } from '#validators/customer/order'
import { phoneField } from '#validators/shared/rules/phone'
import { itemsRule } from '#validators/shared/rules/pickup'
import { proofPhoto } from '#validators/staff/task'

const MAX_INTAKE_PHOTOS = 3

const itemCount = () => vine.number().withoutDecimals().range([0, MAX_ITEMS_PER_KIND])

export const walkInValidator = vine.create({
  phone: phoneField(),
  name: vine.string().trim().minLength(2).maxLength(80).optional(),
  items: vine.object({ sepatu: itemCount(), tas: itemCount(), helm: itemCount() }).use(itemsRule()),
  returnMethod: vine.enum(Object.values(ReturnMethod)),
  useSavedAddress: vine.boolean().optional(),
  address: vine.string().trim().minLength(10).maxLength(300).optional(),
  point: vine
    .object({ lat: vine.number().range([-90, 90]), lng: vine.number().range([-180, 180]) })
    .optional(),
  note: vine.string().trim().maxLength(300).optional(),
  photos: vine.array(proofPhoto()).minLength(1).maxLength(MAX_INTAKE_PHOTOS),
})

export type WalkInPayload = Infer<typeof walkInValidator>

export const counterPaymentValidator = vine.create({
  method: vine.enum([PaymentMethod.CASH]),
  cashReceived: vine.number().withoutDecimals().min(0).max(100_000_000).optional(),
})
