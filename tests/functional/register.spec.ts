import { test } from '@japa/runner'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OtpPurpose } from '#enums/otp_enum'
import { Role } from '#enums/role_enum'
import OtpCode from '#models/otp_code'
import User from '#models/user'
import { OTP_INVALID_MESSAGE, OTP_LOCKED_MESSAGE } from '#services/constants'
import { post, TURNSTILE_TOKEN, useApp } from '#tests/support/app'

const PHONE = '6281234567890'

function register(client: Parameters<typeof post>[0], overrides: Record<string, unknown> = {}) {
  return post(client, '/daftar', {
    name: 'Rina Kartika',
    phone: '0812 3456 7890',
    password: 'kata-sandi-aman',
    passwordConfirmation: 'kata-sandi-aman',
    terms: true,
    turnstile: TURNSTILE_TOKEN,
    ...overrides,
  })
}

test.group('Sign up with WhatsApp OTP', (group) => {
  const state = useApp(group)

  test('creates the account only after the code is verified', async ({ client, assert }) => {
    const started = await register(client)
    started.assertHeader('location', '/verifikasi')

    assert.lengthOf(await User.all(), 0)
    const session = started.session()
    assert.notProperty(session.otp_flow, 'password')
    assert.notInclude(JSON.stringify(session), 'kata-sandi-aman')
    const otp = await OtpCode.firstOrFail()
    assert.equal(otp.purpose, OtpPurpose.REGISTER)
    assert.notInclude(otp.codeHash, state.fonnte.lastCode(PHONE))
    assert.match(
      state.fonnte.messages[0].message,
      /^Kode verifikasi Umima Clean: \d{6}\. Berlaku 5 menit\./
    )

    const done = await post(client, '/verifikasi', { code: state.fonnte.lastCode(PHONE) }, session)

    done.assertHeader('location', '/beranda')
    const user = await User.findByOrFail('phone', PHONE)
    assert.equal(user.role, Role.CUSTOMER)
    assert.equal(user.name, 'Rina Kartika')
    assert.isTrue(await user.verifyPassword('kata-sandi-aman'))
    assert.isNotNull(user.phoneVerifiedAt)
    const consumed = await OtpCode.firstOrFail()
    assert.isNotNull(consumed.consumedAt)
  })

  test('a wrong code does not create the account', async ({ client, assert }) => {
    const started = await register(client)
    const wrong = state.fonnte.lastCode(PHONE) === '000000' ? '111111' : '000000'

    const response = await post(client, '/verifikasi', { code: wrong }, started.session())

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'code', message: OTP_INVALID_MESSAGE }] })
    assert.lengthOf(await User.all(), 0)
  })

  test('a failed Turnstile check sends no code', async ({ client, assert }) => {
    state.turnstile.shouldPass = false

    const response = await register(client)

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'turnstile' }] })
    assert.lengthOf(state.fonnte.messages, 0)
    assert.lengthOf(await OtpCode.all(), 0)
  })

  test('a registered number is refused', async ({ client, assert }) => {
    await UserFactory.merge({ phone: PHONE }).create()

    const response = await register(client)

    response.assertBodyContains({ errors: [{ field: 'phone', rule: 'phone.taken' }] })
    assert.lengthOf(state.fonnte.messages, 0)
  })

  test('validates name, password length and terms', async ({ client }) => {
    const response = await register(client, { name: '', password: 'pendek', terms: false })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [{ field: 'name' }, { field: 'password' }, { field: 'terms' }],
    })
  })

  test('refuses a confirmation that does not match, on the confirmation field', async ({
    client,
    assert,
  }) => {
    const response = await register(client, { passwordConfirmation: 'kata-sandi-lain' })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'passwordConfirmation',
          rule: 'confirmed',
          message: 'Konfirmasi kata sandi tidak sama.',
        },
      ],
    })
    assert.lengthOf(state.fonnte.messages, 0)
    assert.lengthOf(await OtpCode.all(), 0)
  })
})

test.group('OTP rules', (group) => {
  const state = useApp(group)

  test('an expired code is refused', async ({ client, assert }) => {
    const started = await register(client)
    await OtpCode.query().update({ expires_at: DateTime.now().minus({ seconds: 1 }).toJSDate() })

    const response = await post(
      client,
      '/verifikasi',
      { code: state.fonnte.lastCode(PHONE) },
      started.session()
    )

    response.assertStatus(422)
    assert.lengthOf(await User.all(), 0)
  })

  test('the code dies after 5 wrong attempts, even if the right one comes next', async ({
    client,
    assert,
  }) => {
    const started = await register(client)
    const right = state.fonnte.lastCode(PHONE)
    const wrong = right === '000000' ? '111111' : '000000'
    let session = started.session()
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await post(client, '/verifikasi', { code: wrong }, session)
      session = response.session()
    }
    const otp = await OtpCode.firstOrFail()
    assert.equal(otp.attempts, 5)

    const response = await post(client, '/verifikasi', { code: right }, session)

    response.assertBodyContains({ errors: [{ message: OTP_LOCKED_MESSAGE }] })
    assert.lengthOf(await User.all(), 0)
  })

  test('resending waits 60 seconds, then replaces the old code', async ({ client, assert }) => {
    const started = await register(client)
    const first = state.fonnte.lastCode(PHONE)

    const early = await post(
      client,
      '/verifikasi/kirim-ulang',
      { turnstile: TURNSTILE_TOKEN },
      started.session()
    )
    early.assertStatus(422)
    early.assertBodyContains({ errors: [{ rule: 'otp.cooldown' }] })
    assert.lengthOf(state.fonnte.messages, 1)

    await limiter
      .use({ requests: 1, duration: 60, blockDuration: 60 })
      .delete(`otp_cooldown_${PHONE}`)
    const resent = await post(
      client,
      '/verifikasi/kirim-ulang',
      { turnstile: TURNSTILE_TOKEN },
      started.session()
    )
    resent.assertHeader('location', '/verifikasi')
    assert.lengthOf(state.fonnte.messages, 2)

    const second = state.fonnte.lastCode(PHONE)
    if (first !== second) {
      const old = await post(client, '/verifikasi', { code: first }, resent.session())
      old.assertStatus(422)
    }
    const done = await post(client, '/verifikasi', { code: second }, resent.session())
    done.assertHeader('location', '/beranda')
  })

  test('resending requires Turnstile', async ({ client, assert }) => {
    const started = await register(client)
    state.turnstile.shouldPass = false

    const response = await post(client, '/verifikasi/kirim-ulang', {}, started.session())

    response.assertBodyContains({ errors: [{ field: 'turnstile' }] })
    assert.lengthOf(state.fonnte.messages, 1)
  })

  test('at most 5 codes per number per hour', async ({ client, assert }) => {
    const started = await register(client)
    let session = started.session()
    for (let send = 0; send < 5; send++) {
      await limiter
        .use({ requests: 1, duration: 60, blockDuration: 60 })
        .delete(`otp_cooldown_${PHONE}`)
      const response = await post(
        client,
        '/verifikasi/kirim-ulang',
        { turnstile: TURNSTILE_TOKEN },
        session
      )
      session = response.session()
      if (send === 4) {
        response.assertBodyContains({ errors: [{ rule: 'otp.limited' }] })
      }
    }
    assert.lengthOf(state.fonnte.messages, 5)
  })
})
