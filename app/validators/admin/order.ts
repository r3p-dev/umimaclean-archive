import vine from '@vinejs/vine'
import { OWNER_BULK_STAGES } from '#enums/order_enum'

export const FIX_METHODS = ['qris_counter', 'cash', 'qris_online'] as const

const ids = () => vine.array(vine.number().withoutDecimals().min(1)).minLength(1).maxLength(200)

const reason = () => vine.string().trim().minLength(3).maxLength(200)

export const moveOrdersValidator = vine.create({ ids: ids(), stage: vine.enum(OWNER_BULK_STAGES) })

export const cancelOrdersValidator = vine.create({ ids: ids(), reason: reason() })

export const correctPaymentValidator = vine.create({
  method: vine.enum(FIX_METHODS),
  amount: vine.number().withoutDecimals().min(1).max(100_000_000),
  correctionReason: reason(),
})
