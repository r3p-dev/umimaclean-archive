import { test } from '@japa/runner'
import { UserFactory, USER_PASSWORD } from '#database/factories/user_factory'
import Order from '#models/order'
import User from '#models/user'
import { savedAddress, useApp } from '#tests/support/app'

const TURNSTILE_TOKEN_ISSUED = `document.querySelector('input[name="cf-turnstile-response"]')?.value`

test.group('Customer account in the browser', (group) => {
  const state = useApp(group)
  group.each.setup(() => {
    state.turnstile.hasWidget = false
  })

  test('signs in, orders from P-06, confirms on P-07 and lands on the order', async ({
    visit,
    assert,
  }) => {
    const user = await UserFactory.merge({ phone: '6281234567890', name: 'Rina Kartika' }).create()
    await savedAddress(user, {
      label: 'Rumah',
      isPrimary: true,
      addressText: 'Jl. Cisitu Indah III No. 12, Dago, Coblong, Kota Bandung',
    })

    const page = await visit('/pesan')
    await page.waitForURL(/\/masuk$/)
    await page.getByLabel('Nomor WhatsApp').fill('812 3456 7890')
    await page.getByLabel('Kata sandi', { exact: true }).fill(USER_PASSWORD)
    await page.waitForFunction(TURNSTILE_TOKEN_ISSUED)
    await page.getByRole('button', { name: 'Masuk' }).click()

    await page.waitForURL(/\/pesan$/)
    await page.assertTextContains('body', 'Jl. Cisitu Indah III No. 12')
    await page.getByRole('button', { name: 'Tambah Sepatu' }).click()
    await page.getByRole('button', { name: 'Tambah Sepatu' }).click()
    await page.getByRole('button', { name: 'Lanjut ke Konfirmasi' }).first().click()

    await page.waitForURL(/\/pesan\/konfirmasi$/)
    await page.assertTextContains('body', 'Sepatu ×2')
    await page.getByRole('button', { name: 'Buat Pesanan' }).first().click()

    await page.waitForURL(/\/pesanan\/\d+$/, { timeout: 15_000 })
    const order = await Order.query().preload('addresses').firstOrFail()
    assert.equal(order.itemsSepatu, 2)
    assert.equal(
      order.addresses[0].addressText,
      'Jl. Cisitu Indah III No. 12, Dago, Coblong, Kota Bandung'
    )
    await page.assertTextContains('h1', order.number())
  })

  test('signs up with a WhatsApp code and lands on the new-account home', async ({
    visit,
    assert,
  }) => {
    const page = await visit('/daftar')
    await page.getByLabel('Nama').fill('Budi Santoso')
    await page.getByLabel('Nomor WhatsApp').fill('812 9999 0000')
    await page.getByLabel('Kata sandi', { exact: true }).fill('kata-sandi-aman')
    await page.getByLabel('Ulangi kata sandi').fill('kata-sandi-lain')
    await page.getByRole('checkbox', { name: /Saya setuju/ }).check({ force: true })
    await page.waitForFunction(TURNSTILE_TOKEN_ISSUED)
    await page.getByRole('button', { name: 'Daftar' }).click()
    await page.locator('#register-confirmation-error').getByText('Kata sandi tidak sama.').waitFor()
    await page.getByLabel('Ulangi kata sandi').fill('kata-sandi-aman')
    await page.getByRole('button', { name: 'Daftar' }).click()

    await page.waitForURL(/\/verifikasi$/)
    assert.lengthOf(await User.all(), 0)
    await page.assertTextContains('body', '+62 812-••••-0000')
    const code = state.fonnte.lastCode('6281299990000')
    await page.getByLabel('Digit 1 dari 6').fill(code)

    await page.waitForURL(/\/beranda$/, { timeout: 15_000 })
    await page.getByRole('heading', { name: 'Selamat datang, Budi' }).waitFor()
    const user = await User.findByOrFail('phone', '6281299990000')
    assert.equal(user.name, 'Budi Santoso')
  })
})
