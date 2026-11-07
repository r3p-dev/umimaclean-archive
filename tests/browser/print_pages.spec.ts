import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { OrderSource, OrderStatus } from '#enums/order_enum'
import Order from '#models/order'
import User from '#models/user'
import IndexSeeder from '#database/seeders/main/index_seeder'
import { DEMO_STAFF_PHONE } from '#database/seeders/user_seeder'
import { useApp } from '#tests/support/app'

const MM_PER_POINT = 25.4 / 72

function pdfPages(pdf: Buffer) {
  return [...pdf.toString('latin1').matchAll(/MediaBox\s*\[\s*([\d.\s]+)\]/g)].map((match) => {
    const [, , width, height] = match[1].trim().split(/\s+/).map(Number)
    return { width: width * MM_PER_POINT, height: height * MM_PER_POINT }
  })
}

test.group('Print pages', (group) => {
  useApp(group)

  test('each document fits a 58 mm roll and a phone screen', async ({ browserContext, assert }) => {
    await new IndexSeeder(db.connection()).run()
    const staff = await User.findByOrFail('phone', DEMO_STAFF_PHONE)
    const order = await Order.query()
      .where('status', OrderStatus.READY_FOR_DELIVERY)
      .where('source', OrderSource.STORE)
      .firstOrFail()
    await browserContext.loginAs(staff)

    for (const path of ['label', 'struk']) {
      const page = await browserContext.newPage()
      await page.setViewportSize({ width: 360, height: 780 })
      await page.goto(`/staf/cetak/${order.id}/${path}`)
      await page.locator('h1').waitFor()
      await page.evaluate('document.fonts.ready')

      const fits = await page.evaluate(
        'document.documentElement.scrollWidth <= document.documentElement.clientWidth'
      )
      assert.isTrue(fits === true, `${path} scrolls sideways`)

      await page.emulateMedia({ media: 'print' })
      assert.isFalse(await page.getByRole('button', { name: 'Cetak' }).isVisible(), path)
      const pdf = await page.pdf({ preferCSSPageSize: true })
      const pages = pdfPages(pdf)
      assert.lengthOf(pages, 1, `${path} prints on one page`)
      assert.approximately(pages[0].width, 58, 0.5, path)
      await page.close()
    }
  }).timeout(120_000)
})
