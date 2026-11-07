import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { OrderAddressType, OrderStatus } from '#enums/order_enum'
import Order from '#models/order'
import OrderAddress from '#models/order_address'
import {
  addressPayload,
  createOrder,
  inertia,
  orderPayload,
  post,
  postWalkIn,
  savedAddress,
  seedCatalogue,
  send,
  useApp,
} from '#tests/support/app'

async function placeOrder(
  client: Parameters<typeof post>[0],
  user: Awaited<ReturnType<typeof UserFactory.create>>,
  payload: Record<string, unknown>
) {
  const reviewed = await post(client, '/pesan/tinjau', payload).loginAs(user)
  reviewed.assertHeader('location', '/pesan/konfirmasi')
  return post(client, '/pesan', {}, reviewed.session()).loginAs(user)
}

test.group('Orders', (group) => {
  useApp(group)

  test('creates an order from the reviewed draft and copies the address', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const address = await savedAddress(user, { isPrimary: true, landmark: 'Pagar hitam' })

    const response = await placeOrder(client, user, orderPayload(address.id))

    const order = await Order.query().preload('addresses').firstOrFail()
    response.assertHeader('location', `/pesanan/${order.id}`)
    assert.match(order.number(), /^UMC-\d{5}$/)
    assert.equal(order.status, OrderStatus.AWAITING_PICKUP)
    assert.equal(order.userId, user.id)
    assert.lengthOf(order.addresses, 2)
    for (const snapshot of order.addresses) {
      assert.equal(snapshot.addressText, address.addressText)
      assert.equal(snapshot.landmark, 'Pagar hitam')
      assert.equal(snapshot.recipientPhone, user.phone)
    }
  })

  test('a different delivery address is snapshotted separately', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const home = await savedAddress(user, { isPrimary: true })
    const office = await savedAddress(user, {
      label: 'Kantor',
      addressText: 'Jl. Braga No. 1, Bandung',
      recipientPhone: '6281399990000',
    })

    await placeOrder(client, user, orderPayload(home.id, { deliveryAddressId: office.id }))

    const order = await Order.firstOrFail()
    const pickup = await OrderAddress.findByOrFail('type', OrderAddressType.PICKUP)
    const delivery = await OrderAddress.findByOrFail('type', OrderAddressType.DELIVERY)
    assert.equal(delivery.addressText, 'Jl. Braga No. 1, Bandung')
    assert.equal(delivery.recipientPhone, '6281399990000')
    assert.equal(pickup.recipientPhone, user.phone)
    assert.equal(order.customerPhone, user.phone)
  })

  test('editing or deleting a saved address never changes past orders', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const address = await savedAddress(user, {
      isPrimary: true,
      addressText: 'Jl. Lama No. 1, Coblong, Bandung',
    })
    await placeOrder(client, user, orderPayload(address.id))

    await send(
      client,
      'put',
      `/profil/alamat/${address.id}`,
      addressPayload({ addressText: 'Jl. Baru No. 99, Coblong, Bandung' })
    ).loginAs(user)
    await send(client, 'delete', `/profil/alamat/${address.id}`).loginAs(user)

    const snapshots = await OrderAddress.all()
    assert.lengthOf(snapshots, 2)
    for (const snapshot of snapshots) {
      assert.equal(snapshot.addressText, 'Jl. Lama No. 1, Coblong, Bandung')
    }
  })

  test('another customer’s address cannot be used', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const other = await UserFactory.create()
    const foreign = await savedAddress(other, { isPrimary: true })

    const response = await post(client, '/pesan/tinjau', orderPayload(foreign.id)).loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'pickupAddressId', rule: 'address.missing' }] })
    assert.lengthOf(await Order.all(), 0)
  })

  test('re-validates the draft server-side', async ({ client }) => {
    const user = await UserFactory.create()
    const address = await savedAddress(user, { isPrimary: true })

    const response = await post(
      client,
      '/pesan/tinjau',
      orderPayload(address.id, { items: { sepatu: 0, tas: 0, helm: 0 }, slot: 7 })
    ).loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'items' }, { field: 'slot' }] })
  })

  test('submitting the same draft twice creates one order', async ({ client, assert }) => {
    const user = await UserFactory.create()
    const address = await savedAddress(user, { isPrimary: true })
    const reviewed = await post(client, '/pesan/tinjau', orderPayload(address.id)).loginAs(user)

    await post(client, '/pesan', {}, reviewed.session()).loginAs(user)
    await post(client, '/pesan', {}, reviewed.session()).loginAs(user)

    assert.lengthOf(await Order.all(), 1)
  })

  test('a customer cannot read another customer’s order', async ({ client, assert }) => {
    const owner = await UserFactory.create()
    const intruder = await UserFactory.create()
    const order = await createOrder(owner)

    const response = await inertia(client, `/pesanan/${order.id}`).loginAs(intruder)
    response.assertInertiaComponent('customer/orders/unlock')
    assert.notProperty(response.inertiaProps, 'order')
    const pay = await client.get(`/pesanan/${order.id}/bayar`).loginAs(intruder)
    pay.assertStatus(404)
    const own = await inertia(client, `/pesanan/${order.id}`).loginAs(owner)
    own.assertInertiaComponent('customer/orders/show')
    own.assertInertiaPropsContains({ order: { number: order.number(), status: 0 } })
  })

  test('history only lists the customer’s own orders and filters by status', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const other = await UserFactory.create()
    await createOrder(user)
    await createOrder(user, { status: OrderStatus.COMPLETED })
    await createOrder(user, { status: OrderStatus.CANCELLED })
    await createOrder(other)

    const all = await inertia(client, '/pesanan').loginAs(user)
    const done = await inertia(client, '/pesanan?status=selesai').loginAs(user)

    const allProps = all.inertiaProps as { orders: unknown[]; counts: Record<string, number> }
    assert.lengthOf(allProps.orders, 3)
    assert.deepEqual(allProps.counts, { semua: 3, berjalan: 1, selesai: 1, dibatalkan: 1 })
    assert.lengthOf((done.inertiaProps as { orders: unknown[] }).orders, 1)
  })

  test('Beranda shows P-05b without orders and P-05 once there is one', async ({ client }) => {
    const user = await UserFactory.create()

    const fresh = await inertia(client, '/beranda').loginAs(user)
    fresh.assertInertiaComponent('customer/home/welcome')

    await createOrder(user)
    const returning = await inertia(client, '/beranda').loginAs(user)
    returning.assertInertiaComponent('customer/home/index')
  })
})

test.group('Helmets are washed only at the shop', (group) => {
  useApp(group)

  test('an online order with helmets is refused even when crafted by hand', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const address = await savedAddress(user, { isPrimary: true })

    const response = await post(
      client,
      '/pesan/tinjau',
      orderPayload(address.id, { items: { sepatu: 1, tas: 0, helm: 1 } })
    ).loginAs(user)

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'items.helm',
          message: 'Cuci helm hanya untuk barang yang dibawa langsung ke toko.',
        },
      ],
    })
    assert.lengthOf(await Order.all(), 0)
  })

  test('helmets cannot be added while inspecting an online order', async ({ client, assert }) => {
    const [, , , helmetSpa] = await seedCatalogue()
    const staff = await UserFactory.apply('staff').create()
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.IN_INSPECTION,
    })

    const response = await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [{ kind: 'helmet', itemName: 'Helm', services: { main: helmetSpa.id, addons: [] } }],
    }).loginAs(staff)

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'items.0.kind', rule: 'item.store_only' }] })
    await order.refresh()
    assert.equal(order.status, OrderStatus.IN_INSPECTION)
  })

  test('a walk-in can still bring and bill helmets', async ({ client, assert }) => {
    const [, , , helmetSpa] = await seedCatalogue()
    const staff = await UserFactory.apply('staff').create()

    await postWalkIn(client, {
      phone: '0812 7777 8888',
      name: 'Andi Pratama',
      items: { sepatu: 0, tas: 0, helm: 1 },
      returnMethod: 'store',
    }).loginAs(staff)
    const order = await Order.firstOrFail()
    assert.equal(order.itemsHelm, 1)

    const billed = await post(client, `/staf/proses/${order.id}/periksa`, {
      items: [{ kind: 'helmet', itemName: 'Helm', services: { main: helmetSpa.id, addons: [] } }],
    }).loginAs(staff)
    billed.assertStatus(302)
    await order.refresh()
    assert.equal(order.status, OrderStatus.AWAITING_PAYMENT)
  })

  test('the landing price list marks the helmet tab as shop-only', async ({ client }) => {
    await seedCatalogue()

    const page = await inertia(client, '/')

    page.assertInertiaPropsContains({
      prices: [
        { label: 'Sepatu', isStoreOnly: false },
        { label: 'Tas', isStoreOnly: false },
        { label: 'Helm', isStoreOnly: true },
      ],
    })
  })
})
