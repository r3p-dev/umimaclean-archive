import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { itemsRule, pickupDateRule } from '#validators/shared/rules/pickup'

export const MAX_ITEMS_PER_KIND = 20
const PICKUP_SLOT_COUNT = 3

function itemCount() {
  return vine.number().withoutDecimals().range([0, MAX_ITEMS_PER_KIND])
}

function addressId() {
  return vine.number().withoutDecimals().min(1)
}

export const createOrderValidator = vine.create({
  key: vine.string().uuid(),
  items: vine
    .object({ sepatu: itemCount(), tas: itemCount(), helm: vine.number().in([0]) })
    .use(itemsRule()),
  note: vine.string().trim().maxLength(300).optional(),
  date: vine.string().trim().use(pickupDateRule()),
  slot: vine
    .number()
    .withoutDecimals()
    .in(Array.from({ length: PICKUP_SLOT_COUNT }, (_, index) => index)),
  pickupAddressId: addressId(),
  deliveryAddressId: addressId().optional(),
})

export type OrderPayload = Infer<typeof createOrderValidator>
