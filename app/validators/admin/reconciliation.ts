import vine from '@vinejs/vine'

const note = () => vine.string().trim().minLength(3).maxLength(150)

export const reviewPaymentValidator = vine.create({ note: note() })

export const resolveMismatchValidator = vine.create({
  outcome: vine.enum(['refund', 'accept'] as const),
  note: note(),
})
