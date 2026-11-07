import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'
import { saveAddressValidator } from '#validators/customer/address'
import { registerValidator } from '#validators/auth/register'

type ClientRule = (value: string) => string | null

const clientModule = new URL('../../inertia/lib/shared/validation.ts', import.meta.url).href

type Field = 'name' | 'phone' | 'address' | 'label' | 'recipient' | 'recipientPhone'

const client: Record<Field, ClientRule> = await import(clientModule).then(
  (rules: Record<string, ClientRule>) => ({
    name: rules.nameError,
    phone: rules.phoneError,
    address: rules.addressError,
    label: rules.labelError,
    recipient: rules.recipientError,
    recipientPhone: rules.phoneError,
  })
)

const ADDRESS_FIELDS = {
  address: 'addressText',
  label: 'label',
  recipient: 'recipientName',
  recipientPhone: 'recipientPhone',
} as const

const account = {
  name: 'Budi Santoso',
  phone: '81234567890',
  password: 'kata-sandi-aman',
  passwordConfirmation: 'kata-sandi-aman',
  terms: true,
}

const address = {
  label: 'Rumah',
  recipientName: 'Budi Santoso',
  recipientPhone: '81234567890',
  addressText: 'Jl. Dipati Ukur No. 35, Coblong, Bandung',
  point: { lat: -6.8848, lng: 107.6152 },
}

async function serverError(field: Field, value: string) {
  const input = value === '' ? null : value
  const name = field === 'name' || field === 'phone' ? field : ADDRESS_FIELDS[field]
  try {
    if (field === 'name' || field === 'phone') {
      await registerValidator.validate({ ...account, [field]: input })
    } else {
      await saveAddressValidator.validate({ ...address, [name]: input })
    }
    return null
  } catch (error) {
    if (!(error instanceof errors.E_VALIDATION_ERROR)) {
      throw error
    }
    const messages = error.messages as { field: string; message: string }[]
    return messages.find((message) => message.field === name)?.message ?? null
  }
}

test.group('Client and server validation agree', () => {
  test('{field} = "{value}"')
    .with([
      { field: 'name', value: '' },
      { field: 'name', value: ' A ' },
      { field: 'name', value: 'Al' },
      { field: 'name', value: 'x'.repeat(80) },
      { field: 'name', value: 'x'.repeat(81) },
      { field: 'phone', value: '' },
      { field: 'phone', value: '81234a67890' },
      { field: 'phone', value: '0812345678' },
      { field: 'phone', value: '0212345678' },
      { field: 'phone', value: '+62 812-3456-7890' },
      { field: 'phone', value: '6281234567890' },
      { field: 'phone', value: '81234567' },
      { field: 'phone', value: '812345678' },
      { field: 'phone', value: '8123456789012' },
      { field: 'phone', value: '81234567890123' },
      { field: 'address', value: '   ' },
      { field: 'address', value: 'Jl. Dago' },
      { field: 'address', value: 'Jl. Dago 1' },
      { field: 'address', value: 'x'.repeat(301) },
      { field: 'label', value: '' },
      { field: 'label', value: '   ' },
      { field: 'label', value: 'x'.repeat(30) },
      { field: 'label', value: 'x'.repeat(31) },
      { field: 'recipient', value: '' },
      { field: 'recipient', value: ' A ' },
      { field: 'recipient', value: 'x'.repeat(80) },
      { field: 'recipient', value: 'x'.repeat(81) },
      { field: 'recipientPhone', value: '' },
      { field: 'recipientPhone', value: '0212345678' },
      { field: 'recipientPhone', value: '81234567' },
    ] as const)
    .run(async ({ assert }, { field, value }) => {
      assert.equal(client[field](value), await serverError(field, value))
    })

  test('the server strips fields it does not know', async ({ assert }) => {
    const validated = await saveAddressValidator.validate({
      ...address,
      userId: 7,
      deletedAt: null,
    })
    assert.notProperty(validated, 'userId')
    assert.notProperty(validated, 'deletedAt')
  })
})
