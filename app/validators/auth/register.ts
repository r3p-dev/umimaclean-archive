import vine from '@vinejs/vine'
import { passwordField } from '#validators/shared/rules/password'
import { phoneField } from '#validators/shared/rules/phone'

export const registerValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(80),
  phone: phoneField(),
  password: passwordField().confirmed({ confirmationField: 'passwordConfirmation' }),
  terms: vine.accepted(),
  turnstile: vine.string().optional(),
})
