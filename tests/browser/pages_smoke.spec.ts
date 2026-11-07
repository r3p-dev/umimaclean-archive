import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { OrderSource, OrderStatus } from '#enums/order_enum'
import { Role } from '#enums/role_enum'
import { displayPhone, lastFourDigits } from '#helpers/phone'
import Order from '#models/order'
import User from '#models/user'
import IndexSeeder from '#database/seeders/main/index_seeder'
import { DEMO_PHONE, DEMO_STAFF_PHONE } from '#database/seeders/user_seeder'
import { useApp } from '#tests/support/app'

async function code(status: OrderStatus, source?: OrderSource) {
  const query = Order.query().where('status', status)
  if (source) {
    query.where('source', source)
  }
  const order = await query.firstOrFail()
  return order.id
}

test.group('Every page renders with seeded data', (group) => {
  useApp(group)

  test('customer, staff and owner pages open without a client error', async ({
    browserContext,
    assert,
  }) => {
    await new IndexSeeder(db.connection()).run()

    const rina = await User.findByOrFail('phone', DEMO_PHONE)
    const staff = await User.findByOrFail('phone', DEMO_STAFF_PHONE)
    const owner = await User.query().where('role', Role.ADMIN).firstOrFail()
    const awaiting = await code(OrderStatus.AWAITING_PAYMENT, OrderSource.ONLINE)
    const completed = await Order.query()
      .where('user_id', rina.id)
      .where('status', OrderStatus.COMPLETED)
      .first()

    const roles: [User | null, string[]][] = [
      [null, ['/', '/syarat', '/privasi', '/masuk', '/staf/masuk', `/pesanan/${awaiting}`]],
      [
        rina,
        [
          '/beranda',
          '/pesan',
          '/pesanan',
          `/pesanan/${awaiting}`,
          `/pesanan/${awaiting}/bayar`,
          ...(completed ? [`/pesanan/${completed.id}/struk`] : []),
          '/profil',
          '/profil/alamat',
        ],
      ],
      [
        staff,
        [
          '/staf',
          '/staf/jemput',
          '/staf/jemput/tugas',
          '/staf/antar',
          '/staf/antar/tugas',
          '/staf/proses',
          `/staf/proses/${await code(OrderStatus.PICKED_UP)}/periksa`,
          `/staf/proses/${await code(OrderStatus.IN_CLEANING)}/cuci`,
          '/staf/transaksi',
          `/staf/transaksi/${await code(OrderStatus.AWAITING_PAYMENT, OrderSource.STORE)}/bayar`,
          `/staf/cetak/${await code(OrderStatus.READY_FOR_DELIVERY)}/label`,
          `/staf/cetak/${await code(OrderStatus.IN_CLEANING, OrderSource.STORE)}/struk`,
          '/staf/riwayat',
          '/staf/profil',
          '/staf/lainnya',
        ],
      ],
      [
        owner,
        [
          '/admin',
          '/admin/pesanan',
          `/admin/pesanan/${awaiting}`,
          '/admin/layanan',
          '/admin/pelanggan',
          '/admin/laporan',
          '/admin/aktivitas',
          '/admin/pengaturan',
          '/admin/pengaturan/toko',
          '/admin/pengaturan/area',
          '/admin/rekonsiliasi',
          '/admin/profil',
        ],
      ],
    ]

    const rinaRecipient = `Penerima: ${rina.name} · ${displayPhone(rina.phone)}`
    const shows: Record<string, string | RegExp> = {
      '/profil/alamat': rinaRecipient,
      [`/pesanan/${awaiting}`]: rinaRecipient,
      '/staf/jemput/tugas': /^Kontak: .+ · \+62 8[\d-]+$/,
      '/staf/antar/tugas': /^Penerima: .+ · \+62 8[\d-]+$/,
    }

    const failures: string[] = []
    for (const [user, urls] of roles) {
      await browserContext.clearCookies()
      if (user) {
        await browserContext.loginAs(user)
      }
      for (const url of urls) {
        const page = await browserContext.newPage()
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        const response = await page.goto(url)
        await page.waitForLoadState('domcontentloaded')
        await page
          .locator('h1')
          .first()
          .waitFor({ timeout: 10_000 })
          .catch(() => {
            errors.push('no h1 rendered')
          })
        if ((response?.status() ?? 500) >= 400) {
          errors.push(`HTTP ${response?.status()}`)
        }
        const expected = user ? shows[url] : undefined
        if (expected) {
          await page
            .getByText(expected)
            .first()
            .waitFor({ timeout: 10_000 })
            .catch(() => {
              errors.push(`missing ${expected}`)
            })
        }
        if (errors.length) {
          failures.push(`${url}: ${errors.join(' | ')}`)
        }
        await page.close()
      }
    }

    await browserContext.clearCookies()
    await browserContext.loginAs(staff)
    const packed = await code(OrderStatus.READY_FOR_DELIVERY)
    for (const url of [`/staf/proses/${packed}/cuci`, '/staf/antar/tugas']) {
      const page = await browserContext.newPage()
      await page.goto(url)
      for (const name of ['Label', 'Struk']) {
        await page
          .getByRole('link', { name, exact: true })
          .waitFor({ timeout: 10_000 })
          .catch(() => {
            failures.push(`${url}: missing ${name} print button`)
          })
      }
      await page.close()
    }

    await browserContext.clearCookies()
    const guest = await browserContext.newPage()
    await guest.goto(`/pesanan/${awaiting}`)
    await guest.getByLabel('Digit 1 dari 4').click()
    await guest.keyboard.type(lastFourDigits(rina.phone))
    await guest.getByText(`Penerima: ${rina.name}`).first().waitFor({ timeout: 10_000 })
    assert.notInclude(await guest.content(), displayPhone(rina.phone))
    await guest.close()

    assert.deepEqual(failures, [])
  }).timeout(240_000)
})
