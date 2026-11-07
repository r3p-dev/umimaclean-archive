import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import ServiceAreaSeeder from '#database/seeders/service_area_seeder'
import { ActivityAction } from '#enums/activity_enum'
import { OrderStatus } from '#enums/order_enum'
import ActivityLog from '#models/activity_log'
import CustomerAddress from '#models/customer_address'
import Order from '#models/order'
import ServiceArea from '#models/service_area'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import {
  AREA_POINTS,
  addressPayload,
  createOrder,
  inertia,
  orderPayload,
  post,
  postWalkIn,
  savedAddress,
  send,
  useApp,
} from '#tests/support/app'

test.group('Service areas', (group) => {
  const state = useApp(group)

  test('a pin in an active area is accepted, inactive or outside is refused', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    const covered = await post(
      client,
      '/profil/alamat',
      addressPayload({ point: AREA_POINTS.covered })
    ).loginAs(user)
    covered.assertStatus(302)

    for (const point of [AREA_POINTS.inactive, AREA_POINTS.outside]) {
      const refused = await post(client, '/profil/alamat', addressPayload({ point })).loginAs(user)
      refused.assertStatus(422)
      refused.assertBodyContains({ errors: [{ field: 'point', rule: 'area.outside' }] })
    }
    assert.lengthOf(await CustomerAddress.all(), 1)
  })

  test('deactivating an area refuses new addresses and orders there at once', async ({
    client,
  }) => {
    const owner = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()
    const address = await savedAddress(customer, { isPrimary: true })

    await send(client, 'put', `/admin/pengaturan/area/${state.areas.covered.id}`, {
      isActive: false,
    }).loginAs(owner)

    const created = await post(client, '/profil/alamat', addressPayload()).loginAs(customer)
    created.assertBodyContains({ errors: [{ field: 'point', rule: 'area.outside' }] })

    const reviewed = await post(client, '/pesan/tinjau', orderPayload(address.id)).loginAs(customer)
    reviewed.assertStatus(422)
  })

  test('a saved address in a deactivated area is refused at checkout', async ({
    client,
    assert,
  }) => {
    const customer = await UserFactory.create()
    const pickup = await savedAddress(customer, { isPrimary: true })
    const delivery = await savedAddress(customer, { label: 'Kantor' })
    const payload = orderPayload(pickup.id, { deliveryAddressId: delivery.id })

    const reviewed = await post(client, '/pesan/tinjau', payload).loginAs(customer)
    await delivery.merge(AREA_POINTS.inactive).save()

    const placed = await post(client, '/pesan', {}, reviewed.session()).loginAs(customer)
    placed.assertBodyContains({
      errors: [
        {
          field: 'deliveryAddressId',
          rule: 'area.outside',
          message:
            'Alamat antar ini sekarang di luar area layanan. Pilih alamat lain atau ubah titiknya.',
        },
      ],
    })

    await state.areas.covered.merge({ isActive: false }).save()
    const again = await post(client, '/pesan/tinjau', payload).loginAs(customer)
    again.assertBodyContains({
      errors: [
        {
          field: 'pickupAddressId',
          rule: 'area.outside',
          message:
            'Alamat jemput ini sekarang di luar area layanan. Pilih alamat lain atau ubah titiknya.',
        },
      ],
    })
    assert.lengthOf(await Order.all(), 0)
  })

  test('an order already in progress is not affected', async ({ client, assert }) => {
    const courier = await UserFactory.apply('staff').create()
    const order = await createOrder(await UserFactory.create(), {
      status: OrderStatus.AWAITING_PICKUP,
      pickupDate: DateTime.now().setZone(SERVICE_ZONE),
    })

    await state.areas.covered.merge({ isActive: false }).save()
    await post(client, `/staf/jemput/${order.id}/mulai`).loginAs(courier)

    await order.refresh()
    assert.equal(order.status, OrderStatus.COURIER_EN_ROUTE)
  })

  test('a walk-in delivery point must be in an active area', async ({ client, assert }) => {
    const staff = await UserFactory.apply('staff').create()
    const walkIn = (point: { lat: number; lng: number }) =>
      postWalkIn(client, {
        phone: '0812 7777 8888',
        name: 'Andi Pratama',
        items: { sepatu: 1, tas: 0, helm: 0 },
        returnMethod: 'delivery',
        address: 'Jl. Sukaraja No. 5, Sukaraja',
        point,
      }).loginAs(staff)

    const refused = await walkIn(AREA_POINTS.inactive)
    refused.assertBodyContains({
      errors: [{ field: 'address', message: 'Titik antar di luar area antar-jemput gratis.' }],
    })
    assert.lengthOf(await Order.all(), 0)

    const accepted = await walkIn(AREA_POINTS.covered)
    accepted.assertStatus(302)
    assert.lengthOf(await Order.all(), 1)
  })

  test('the owner finds a kecamatan by name and switches it on, with a log entry', async ({
    client,
    assert,
  }) => {
    const owner = await UserFactory.apply('admin').create()

    const page = await inertia(client, '/admin/pengaturan/area?q=sukar').loginAs(owner)
    page.assertInertiaComponent('admin/settings/areas')
    page.assertInertiaPropsContains({
      active: [{ name: 'Sukamaju', city: 'Kota Contoh', isActive: true }],
      results: [{ id: state.areas.inactive.id, name: 'Sukaraja', isActive: false }],
    })
    const byCity = await inertia(client, '/admin/pengaturan/area?q=kabupaten').loginAs(owner)
    assert.deepEqual(
      (byCity.inertiaProps.results as { name: string }[]).map((area) => area.name),
      ['Sukaraja']
    )

    await send(client, 'put', `/admin/pengaturan/area/${state.areas.inactive.id}`, {
      isActive: true,
    }).loginAs(owner)

    await state.areas.inactive.refresh()
    assert.isTrue(state.areas.inactive.isActive)
    const log = await ActivityLog.query().where('actor_id', owner.id).firstOrFail()
    assert.equal(log.action, ActivityAction.SETTINGS_CHANGED)
    assert.equal(log.detail, 'Area layanan: Kec. Sukaraja, Kabupaten Contoh diaktifkan')
  })

  test('GET /area answers covered and name for a pin', async ({ client }) => {
    const covered = await client.get('/area').qs(AREA_POINTS.covered)
    covered.assertStatus(200)
    covered.assertBody({ covered: true, name: 'Sukamaju, Kota Contoh' })

    for (const point of [AREA_POINTS.inactive, AREA_POINTS.outside]) {
      const refused = await client.get('/area').qs(point)
      refused.assertBody({ covered: false, name: null })
    }

    const invalid = await client.get('/area').qs({ lat: 'x' }).header('accept', 'application/json')
    invalid.assertStatus(422)
  })

  test('GET /area is limited per IP', async ({ client }) => {
    for (let request = 0; request < 60; request++) {
      const response = await client.get('/area').qs(AREA_POINTS.covered)
      response.assertStatus(200)
    }

    const limited = await client
      .get('/area')
      .qs(AREA_POINTS.covered)
      .header('accept', 'application/json')
    limited.assertStatus(429)
  })

  test('the seeder loads every kecamatan and switches on the starting list', async ({ assert }) => {
    await ServiceArea.query().delete()
    await new ServiceAreaSeeder(db.connection()).run()

    const counts = await ServiceArea.query()
      .select('city')
      .count('* as total')
      .groupBy('city')
      .orderBy('city', 'asc')
    assert.deepEqual(
      counts.map((row) => [row.city, Number(row.$extras.total)]),
      [
        ['Kabupaten Bandung', 31],
        ['Kabupaten Bandung Barat', 16],
        ['Kota Bandung', 30],
        ['Kota Cimahi', 3],
      ]
    )

    const active = await ServiceArea.active()
    const activeIn = (city: string) =>
      active.filter((area) => area.city === city).map((area) => area.name)
    assert.deepEqual(activeIn('Kabupaten Bandung'), [
      'Baleendah',
      'Banjaran',
      'Bojongsoang',
      'Cangkuang',
      'Dayeuhkolot',
      'Katapang',
      'Margaasih',
      'Margahayu',
      'Pameungpeuk',
      'Soreang',
    ])
    assert.lengthOf(activeIn('Kota Bandung'), 30)
    assert.lengthOf(activeIn('Kota Cimahi'), 3)
    assert.lengthOf(activeIn('Kabupaten Bandung Barat'), 0)
    assert.lengthOf(active, 43)

    const coblong = await ServiceArea.contains({ lat: -6.8848, lng: 107.6152 })
    assert.equal(coblong?.name, 'Coblong')
    const cileunyi = await ServiceArea.contains({ lat: -6.9387, lng: 107.7495 })
    assert.isNull(cileunyi)
  })

  test('resetting the database between tests keeps PostGIS spatial_ref_sys', async ({ assert }) => {
    const [row] = await db.from('spatial_ref_sys').count('* as total')
    assert.isAbove(Number(row.total), 0)

    const result = await db.rawQuery(
      'select round(ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(107.61, -6.89), 4326), 32748))) as x'
    )
    assert.equal(Number(result.rows[0].x), 788442)
  })
})
