import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime, Settings } from 'luxon'
import { ActivityAction } from '#enums/activity_enum'
import { OrderStatus } from '#enums/order_enum'
import { Role } from '#enums/role_enum'
import ActivityLog from '#models/activity_log'
import Order from '#models/order'
import OrderEvent from '#models/order_event'
import Setting from '#models/setting'
import User from '#models/user'
import IndexSeeder from '#database/seeders/main/index_seeder'
import { DEMO_PHONE, DEMO_STAFF_PHONE } from '#database/seeders/user_seeder'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import { inertia, useApp } from '#tests/support/app'

const STATUSES = Object.values(OrderStatus)

const PAYMENT_REVIEW_ORDERS = 4

const TIMESTAMPS = [
  ['orders', 'id', ['created_at', 'updated_at']],
  ['order_events', 'order_id', ['created_at']],
  ['activity_logs', 'order_id', ['created_at']],
  ['payments', 'order_id', ['created_at', 'updated_at', 'paid_at', 'expires_at']],
  ['bills', 'order_id', ['created_at', 'updated_at']],
  ['order_photos', 'order_id', ['created_at']],
  ['order_items', 'order_id', ['washed_at']],
] as const

const SEEDED_AT = [
  null,
  '2026-10-28T00:30',
  '2026-10-28T08:00',
  '2026-10-28T13:00',
  '2026-11-01T15:00',
  '2026-11-02T10:00',
]

test.group('Demo seed', (group) => {
  useApp(group)
  group.each.teardown(() => {
    Settings.now = () => Date.now()
  })

  test('the showcase covers every status twice (seeded at {$self})')
    .with(SEEDED_AT)
    .run(async ({ assert, client }, seededAt) => {
      if (seededAt) {
        const fixed = DateTime.fromISO(seededAt, { zone: SERVICE_ZONE }).toMillis()
        const offset = fixed - Date.now()
        Settings.now = () => Date.now() + offset
      }
      const ranAt = DateTime.now()
      await new IndexSeeder(db.connection()).run()

      const showcase = await Order.query()
        .preload('deliveryAddress')
        .orderBy('id', 'desc')
        .limit(STATUSES.length * 2 + PAYMENT_REVIEW_ORDERS)
      const ids = showcase.map((order) => order.id)
      for (const status of STATUSES) {
        assert.isAtLeast(showcase.filter((order) => order.status === status).length, 2, status)
      }
      assert.isTrue(
        showcase.some(
          (order) =>
            order.status === OrderStatus.READY_FOR_DELIVERY &&
            order.deliveryAddress.recipientPhone !== order.customerPhone
        )
      )

      for (const [table, key, columns] of TIMESTAMPS) {
        for (const column of columns) {
          const late = await db
            .from(table)
            .whereIn(key, ids)
            .where(column, '>', ranAt.toJSDate())
            .select(key, column)
          assert.deepEqual(late, [], `${table}.${column}`)
        }
      }

      const today = DateTime.now().setZone(SERVICE_ZONE).startOf('day')
      const pickupDay = today.weekday === 7 ? today.minus({ days: 1 }) : today
      const awaiting = showcase
        .filter((order) => order.status === OrderStatus.AWAITING_PICKUP)
        .sort((first, second) => first.id - second.id)
      for (const order of awaiting) {
        assert.equal(order.pickupDate?.toISODate(), pickupDay.toISODate())
        assert.isBelow(
          order.createdAt.setZone(SERVICE_ZONE).startOf('day').toMillis(),
          pickupDay.toMillis()
        )
      }

      const courierEvents = await OrderEvent.query()
        .whereIn('order_id', ids)
        .whereIn('status', [OrderStatus.COURIER_EN_ROUTE, OrderStatus.PICKED_UP])
      for (const event of courierEvents) {
        const order = showcase.find((item) => item.id === event.orderId)!
        const at = event.createdAt.setZone(SERVICE_ZONE)
        assert.equal(at.toISODate(), order.pickupDate?.toISODate(), order.number())
        assert.isAtLeast(at.hour, 9, order.number())
        assert.isBelow(at.hour, 18, order.number())
        assert.isBelow(order.createdAt.toMillis(), at.startOf('day').toMillis(), order.number())
        assert.notEqual(order.pickupDate?.weekday, 7, order.number())
      }

      const slots = await Setting.get('pickup_slots')
      const booked = await db
        .from('orders')
        .whereNot('status', OrderStatus.CANCELLED)
        .whereNotNull('pickup_slot')
        .select('pickup_date', 'pickup_slot')
        .count('* as total')
        .groupBy('pickup_date', 'pickup_slot')
      for (const row of booked) {
        assert.isAtMost(Number(row.total), slots[row.pickup_slot].capacity)
      }

      const rina = await User.findByOrFail('phone', DEMO_PHONE)
      const trip = showcase.find(
        (order) => order.status === OrderStatus.COURIER_EN_ROUTE && order.userId === rina.id
      )!
      const staff = await User.findByOrFail('phone', DEMO_STAFF_PHONE)
      const queue = await inertia(client, '/staf/jemput').loginAs(staff)
      queue.assertInertiaComponent('staff/tasks/queue')
      assert.deepEqual(
        (queue.inertiaProps as { tasks: { ref: string }[] }).tasks.map((task) => task.ref),
        [trip, ...awaiting].map((order) => order.number())
      )

      const owner = await User.query().where('role', Role.ADMIN).firstOrFail()
      const cancelled = showcase.filter((order) => order.status === OrderStatus.CANCELLED)
      const event = await OrderEvent.query()
        .whereIn(
          'order_id',
          cancelled.map((order) => order.id)
        )
        .where('status', OrderStatus.CANCELLED)
        .where('actor_id', owner.id)
        .firstOrFail()
      const order = cancelled.find((item) => item.id === event.orderId)!
      assert.equal(event.note, order.cancelReason)
      const log = await ActivityLog.query()
        .where('order_id', order.id)
        .where('action', ActivityAction.ORDER_CANCELLED)
        .firstOrFail()
      assert.isTrue(log.isSensitive)
      assert.equal(log.actorId, owner.id)
    })
    .timeout(60_000)
})
