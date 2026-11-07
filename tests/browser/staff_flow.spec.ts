import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OrderStatus, PhotoKind } from '#enums/order_enum'
import Order from '#models/order'
import OrderPhoto from '#models/order_photo'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import { createOrder, useApp } from '#tests/support/app'

test.group('Staff pickup in the browser', (group) => {
  useApp(group)

  test('a courier starts, arrives, photographs and finishes a real pickup', async ({
    browserContext,
    assert,
  }) => {
    const courier = await UserFactory.apply('staff').create()
    const order = await createOrder(await UserFactory.create(), {
      pickupDate: DateTime.now().setZone(SERVICE_ZONE).startOf('day'),
    })
    await browserContext.loginAs(courier)
    const page = await browserContext.newPage()

    await page.goto('/staf/jemput')
    await page.getByRole('button', { name: 'Mulai Tugas' }).click()
    await page.waitForURL(/\/staf\/jemput\/tugas$/)
    await page.getByRole('button', { name: 'Saya Sudah Sampai' }).click()
    await page.getByRole('button', { name: 'Ambil Foto Penjemputan' }).click()
    await page.getByRole('button', { name: 'Ambil foto' }).click()
    await page.getByRole('button', { name: 'Pakai Foto' }).click()
    await page.getByRole('button', { name: 'Selesaikan Penjemputan' }).click()
    await page.getByText('Penjemputan selesai').waitFor()

    await order.refresh()
    assert.equal(order.status, OrderStatus.PICKED_UP)
    const photo = await OrderPhoto.query().where('order_id', order.id).firstOrFail()
    assert.isNotNull(photo.path)
  }).timeout(60_000)
})

test.group('Walk-in intake in the browser', (group) => {
  useApp(group)

  test('staff photograph the items while creating the walk-in and land on the inspection', async ({
    browserContext,
    assert,
  }) => {
    const staff = await UserFactory.apply('staff').create()
    await browserContext.loginAs(staff)
    const page = await browserContext.newPage()

    await page.goto('/staf/transaksi')
    await page.getByLabel('Nomor HP / WhatsApp').fill('0812 7777 8888')
    await page.getByLabel('Nama').fill('Andi Pratama')
    await page.getByRole('button', { name: 'Tambah sepatu' }).click()
    await page.getByRole('radio', { name: /Diambil di toko/ }).click()
    await page.getByText('Ambil minimal 1 foto barang.').waitFor()

    await page.getByRole('button', { name: 'Ambil foto' }).click()
    await page.getByRole('button', { name: 'Ambil foto' }).click()
    await page.getByRole('button', { name: 'Pakai Foto' }).click()
    await page.getByRole('img', { name: 'Foto barang 1' }).waitFor()
    await page.getByRole('button', { name: /Buat Transaksi/ }).click()

    await page.waitForURL(/\/staf\/proses\/\d+\/periksa$/)
    const order = await Order.firstOrFail()
    assert.equal(order.status, OrderStatus.IN_INSPECTION)
    const photos = await OrderPhoto.query().where('order_id', order.id)
    assert.lengthOf(photos, 1)
    assert.equal(photos[0].kind, PhotoKind.INTAKE)
  }).timeout(60_000)
})
