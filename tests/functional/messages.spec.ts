import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { OrderStatus } from '#enums/order_enum'
import { orderLink } from '#helpers/whatsapp_text'
import Order from '#models/order'
import type User from '#models/user'
import { DEFAULT_SETTINGS } from '#models/setting'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import {
  PNG_PIXEL,
  createOrder,
  orderPayload,
  post,
  postWalkIn,
  savedAddress,
  seedCatalogue,
  useApp,
} from '#tests/support/app'

function upload(client: ApiClient, url: string, user: User, fields: Record<string, string> = {}) {
  return client
    .post(url)
    .file('photo', PNG_PIXEL, { filename: 'bukti.png' })
    .fields(fields)
    .withCsrfToken()
    .header('accept', 'application/json')
    .loginAs(user)
    .redirects(0)
}

test.group('Customer WhatsApp messages', (group) => {
  const state = useApp(group)

  test('an online order gets created, courier and bill messages once, only to the customer', async ({
    client,
    assert,
  }) => {
    const [deepClean] = await seedCatalogue()
    const customer = await UserFactory.create()
    const courier = await UserFactory.apply('staff').merge({ name: 'Dedi Supriadi' }).create()
    const owner = await UserFactory.apply('admin').create()
    const address = await savedAddress(customer, { isPrimary: true })
    const sent = () => state.fonnte.messages.map((message) => message.message)

    const reviewed = await post(client, '/pesan/tinjau', orderPayload(address.id)).loginAs(customer)
    await post(client, '/pesan', {}, reviewed.session()).loginAs(customer)
    const order = await Order.firstOrFail()
    assert.lengthOf(sent(), 1)
    assert.include(sent()[0], `pesanan ${order.number()} sudah kami terima`)
    assert.include(sent()[0], `/pesanan/${order.id}`)

    await order.merge({ pickupDate: DateTime.now().setZone(SERVICE_ZONE) }).save()
    await post(client, `/staf/jemput/${order.id}/mulai`).loginAs(courier)
    assert.lengthOf(sent(), 2)
    assert.include(sent()[1], 'kurir Dedi sedang menuju lokasi Anda')

    await post(client, `/staf/jemput/${order.id}/tiba`).loginAs(courier)
    await upload(client, `/staf/jemput/${order.id}/selesai`, courier)
    await post(client, `/staf/proses/${order.id}/periksa/mulai`).loginAs(courier)
    assert.lengthOf(sent(), 2)

    await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [
        { kind: 'shoe', itemName: 'Sneakers putih', services: { main: deepClean.id, addons: [] } },
      ],
    }).loginAs(courier)
    assert.lengthOf(sent(), 3)
    assert.equal(
      sent()[2],
      [
        `Halo ${customer.name.split(' ')[0]}, barang pesanan ${order.number()} sudah diperiksa.`,
        '1. Sneakers putih (Sepatu)\n   Deep Clean: Rp45.000\n   Subtotal: Rp45.000',
        'Antar-jemput: Gratis\nTotal: Rp45.000',
        `Rincian dan pembayaran: ${orderLink(order.id)}`,
      ].join('\n\n')
    )

    await post(client, `/admin/pesanan/${order.id}/pembayaran`, {
      method: 'cash',
      amount: 45000,
      correctionReason: 'Dibayar tunai',
    }).loginAs(owner)
    await upload(client, `/staf/proses/${order.id}/cuci`, courier)
    await post(client, `/staf/antar/${order.id}/mulai`).loginAs(courier)
    await upload(client, `/staf/antar/${order.id}/selesai`, courier, { receiver: 'Rina' })
    await order.refresh()
    assert.equal(order.status, OrderStatus.COMPLETED)

    assert.lengthOf(sent(), 3)
    assert.deepEqual(
      [...new Set(state.fonnte.messages.map((message) => message.target))],
      [customer.phone]
    )
    assert.notInclude(
      state.fonnte.messages.map((message) => message.target),
      DEFAULT_SETTINGS.store.whatsapp
    )
  })

  test('an owner cancel sends one message, a customer cancel sends none', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const byCustomer = await createOrder(customer)
    const byOwner = await createOrder(customer)

    await post(client, `/pesanan/${byCustomer.id}/batal`, { reason: 'Salah jadwal' }).loginAs(
      customer
    )
    assert.lengthOf(state.fonnte.messages, 0)

    await post(client, '/admin/pesanan/batal', {
      ids: [byOwner.id],
      reason: 'Di luar area layanan',
    }).loginAs(owner)
    assert.lengthOf(state.fonnte.messages, 1)
    assert.include(state.fonnte.messages[0].message, `pesanan ${byOwner.number()} dibatalkan`)
    assert.include(state.fonnte.messages[0].message, 'Alasan: Di luar area layanan')
    assert.include(state.fonnte.messages[0].message, `/pesanan/${byOwner.id}`)
  })

  test('a walk-in gets the created and bill messages at its own number', async ({
    client,
    assert,
  }) => {
    const [deepClean] = await seedCatalogue()
    const staff = await UserFactory.apply('staff').create()

    await postWalkIn(client, {
      phone: '0812 7777 8888',
      name: 'Andi Pratama',
      items: { sepatu: 1, tas: 0, helm: 0 },
      returnMethod: 'store',
    }).loginAs(staff)
    const order = await Order.firstOrFail()
    await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [{ kind: 'shoe', itemName: 'Sepatu', services: { main: deepClean.id, addons: [] } }],
    }).loginAs(staff)

    assert.deepEqual(
      state.fonnte.messages.map((message) => message.target),
      ['6281277778888', '6281277778888']
    )
    assert.include(state.fonnte.messages[0].message, 'Halo Andi')
    assert.include(state.fonnte.messages[1].message, 'Total: Rp45.000')
    assert.isTrue(state.fonnte.messages[1].message.endsWith(`\nRincian: ${orderLink(order.id)}`))
  })

  test('a Fonnte crash never fails the order action', async ({ client, assert }) => {
    const customer = await UserFactory.create()
    const owner = await UserFactory.apply('admin').create()
    const address = await savedAddress(customer, { isPrimary: true })
    state.fonnte.shouldThrow = true

    const reviewed = await post(client, '/pesan/tinjau', orderPayload(address.id)).loginAs(customer)
    const placed = await post(client, '/pesan', {}, reviewed.session()).loginAs(customer)
    const order = await Order.firstOrFail()
    placed.assertHeader('location', `/pesanan/${order.id}`)

    const cancelled = await post(client, '/admin/pesanan/batal', {
      ids: [order.id],
      reason: 'Di luar area layanan',
    }).loginAs(owner)
    cancelled.assertStatus(302)
    await order.refresh()
    assert.equal(order.status, OrderStatus.CANCELLED)
    assert.lengthOf(state.fonnte.messages, 0)
  })
})
