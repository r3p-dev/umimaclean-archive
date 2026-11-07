import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import db from '@adonisjs/lucid/services/db'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import { ActivityAction } from '#enums/activity_enum'
import { OrderSource, OrderStatus, PhotoKind } from '#enums/order_enum'
import ActivityLog from '#models/activity_log'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import OrderPhoto from '#models/order_photo'
import type { Point } from '#models/service_area'
import Setting, { STORE_POINT } from '#models/setting'
import type User from '#models/user'
import OrderService from '#services/order_service'
import OsrmGateway from '#services/osrm_gateway'
import type { RoadLeg, TripLeg } from '#services/types'
import { estimateLeg } from '#helpers/route'
import { formatClock } from '#transformers/order_transformer'
import { shortName, tripPoint } from '#transformers/task_transformer'
import { fieldError } from '#validators/shared/field_error'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'

export type TripKind = 'pickup' | 'delivery'

export type StaffCounts = { jemput: number; proses: number; antar: number }

export const SKIP_REASONS = [
  'Pelanggan tidak bisa dihubungi (±15 menit)',
  'Pelanggan tidak ada di lokasi',
  'Jalan ditutup / masalah rute',
  'Lokasi tidak bisa diakses',
  'Kendaraan bermasalah',
  'Lainnya',
] as const

const WORKSHOP_STATUSES = [
  OrderStatus.PICKED_UP,
  OrderStatus.IN_INSPECTION,
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.IN_CLEANING,
  OrderStatus.READY_FOR_COLLECTION,
]

const TRIP = {
  pickup: {
    queued: OrderStatus.AWAITING_PICKUP,
    active: OrderStatus.COURIER_EN_ROUTE,
    done: OrderStatus.PICKED_UP,
    startDetail: 'Jemput dimulai',
    photo: PhotoKind.PICKUP,
    doneAction: ActivityAction.PICKUP_DONE,
    skipAction: ActivityAction.PICKUP_SKIPPED,
  },
  delivery: {
    queued: OrderStatus.READY_FOR_DELIVERY,
    active: OrderStatus.IN_DELIVERY,
    done: OrderStatus.COMPLETED,
    startDetail: 'Antar dimulai',
    photo: PhotoKind.DELIVERY,
    doneAction: ActivityAction.DELIVERY_DONE,
    skipAction: ActivityAction.DELIVERY_SKIPPED,
  },
} as const

const HISTORY_ICON: Partial<
  Record<ActivityAction, 'jemput' | 'antar' | 'proses' | 'toko' | 'skip'>
> = {
  [ActivityAction.PICKUP_DONE]: 'jemput',
  [ActivityAction.PICKUP_SKIPPED]: 'skip',
  [ActivityAction.DELIVERY_DONE]: 'antar',
  [ActivityAction.DELIVERY_SKIPPED]: 'skip',
  [ActivityAction.BILL_CREATED]: 'proses',
  [ActivityAction.WASH_DONE]: 'proses',
  [ActivityAction.COLLECTED]: 'proses',
  [ActivityAction.WALK_IN_CREATED]: 'toko',
  [ActivityAction.PAYMENT_RECORDED]: 'toko',
}

const HISTORY_TITLE: Partial<Record<ActivityAction, string>> = {
  [ActivityAction.PICKUP_DONE]: 'Jemput selesai',
  [ActivityAction.PICKUP_SKIPPED]: 'Jemput dilewati',
  [ActivityAction.DELIVERY_DONE]: 'Antar selesai',
  [ActivityAction.DELIVERY_SKIPPED]: 'Antar dilewati',
  [ActivityAction.BILL_CREATED]: 'Diperiksa · tagihan dibuat',
  [ActivityAction.WASH_DONE]: 'Selesai dicuci',
  [ActivityAction.COLLECTED]: 'Diserahkan di toko',
  [ActivityAction.WALK_IN_CREATED]: 'Transaksi toko dibuat',
  [ActivityAction.PAYMENT_RECORDED]: 'Pembayaran dicatat',
}

const LEG_CACHE_MS = 5 * 60 * 1000
const MAX_TABLE_LOCATIONS = 100
const UNOPTIMIZED_RETRY_MS = 60 * 1000
const OSRM_WARNING_MS = 60 * 1000
const legCache = new Map<string, { leg: RoadLeg; expiresAt: number }>()
const osrmWarning = { at: 0, failures: 0 }

type RoutePlan = {
  day: string
  stops: string[]
  isOptimized: boolean
  isStale: boolean
  anchor: Point | null
  lastStop: Point | null
  retryAt: number | null
}

export type Courier = { id: number; position: Point | null }

const routePlans = new Map<string, RoutePlan>()

export function clearRouteCaches() {
  legCache.clear()
  routePlans.clear()
  osrmWarning.at = 0
  osrmWarning.failures = 0
}

function warnOsrmFailure(error: unknown, fallback: string) {
  osrmWarning.failures++
  const now = Date.now()
  if (now - osrmWarning.at < OSRM_WARNING_MS) {
    return
  }
  logger.warn(
    { err: error, failures: osrmWarning.failures },
    `OSRM request failed, ${fallback} (further failures muted for a minute)`
  )
  osrmWarning.at = now
  osrmWarning.failures = 0
}

function pointKey(point: Point) {
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
}

function stopKey(order: Order, kind: TripKind) {
  const point = tripPoint(order, kind)
  const slot = kind === 'pickup' ? `${order.pickupDate?.toISODate()}/${order.pickupSlot}` : ''
  return `${order.id}@${slot}@${pointKey(point)}`
}

function slotGroups(waiting: Order[], kind: TripKind) {
  const groups = new Map<string, number[]>()
  for (const [index, order] of waiting.entries()) {
    const slot = kind === 'pickup' ? `${order.pickupDate?.toISODate()}/${order.pickupSlot}` : ''
    groups.set(slot, [...(groups.get(slot) ?? []), index])
  }
  return [...groups.values()]
}

function startOfToday() {
  return DateTime.now().setZone(SERVICE_ZONE).startOf('day')
}

@inject()
export default class TaskService {
  constructor(
    protected orders: OrderService,
    protected osrm: OsrmGateway
  ) {}

  async findRoute(from: Point, to: Point) {
    try {
      const route = await this.osrm.findRoute(from, to)
      if (route) {
        return { source: 'osrm' as const, ...route }
      }
    } catch (error) {
      warnOsrmFailure(error, 'using an estimate for the route')
    }
    return { source: 'estimate' as const, ...estimateLeg(from, to), path: [from, to] }
  }

  async findTripLegs(orders: Order[], kind: TripKind, position: Point | null) {
    const now = Date.now()
    for (const [key, entry] of legCache) {
      if (entry.expiresAt <= now) {
        legCache.delete(key)
      }
    }

    const start = position ?? STORE_POINT
    const points = orders.map((order) => tripPoint(order, kind))
    const pairs = points.map((point, index) => [index ? points[index - 1] : start, point] as const)
    const legKey = ([from, to]: readonly [Point, Point]) => `${pointKey(from)}>${pointKey(to)}`
    const missing = [...new Map(pairs.map((pair) => [legKey(pair), pair])).entries()].filter(
      ([key]) => !legCache.has(key)
    )
    if (missing.length && missing.length <= MAX_TABLE_LOCATIONS) {
      try {
        const legs = await this.osrm.findLegs(missing.map(([, [from, to]]) => [from, to]))
        for (const [index, leg] of (legs ?? []).entries()) {
          if (leg) {
            legCache.set(missing[index][0], { leg, expiresAt: now + LEG_CACHE_MS })
          }
        }
      } catch (error) {
        warnOsrmFailure(error, 'using estimates for the board')
      }
    }

    const legs = new Map<number, TripLeg>()
    const total: TripLeg = { source: 'osrm', meters: 0, seconds: 0 }
    for (const [index, order] of orders.entries()) {
      const cached = legCache.get(legKey(pairs[index]))
      const leg: TripLeg = cached
        ? { source: 'osrm', ...cached.leg }
        : { source: 'estimate', ...estimateLeg(...pairs[index]) }
      legs.set(order.id, leg)
      total.meters += leg.meters
      total.seconds += leg.seconds
      if (leg.source === 'estimate') {
        total.source = 'estimate'
      }
    }
    return { legs, total, start: position ? ('courier' as const) : ('store' as const) }
  }

  async tripBoard(kind: TripKind, courier: Courier) {
    const [active, { queue, isOptimized }, slots] = await Promise.all([
      this.#activeTrip(kind),
      this.#tripQueue(kind, courier),
      Setting.get('pickup_slots'),
    ])
    return { active, queue, slots, isOptimized }
  }

  #activeTrip(kind: TripKind) {
    return this.#tripQuery().where('status', TRIP[kind].active).orderBy('updated_at', 'asc').first()
  }

  async #tripQueue(kind: TripKind, courier: Courier) {
    const query = this.#tripQuery().where('status', TRIP[kind].queued)
    if (kind === 'pickup') {
      query
        .where('pickup_date', '<=', startOfToday().toISODate()!)
        .orderBy('pickup_date', 'asc')
        .orderBy('pickup_slot', 'asc')
    } else {
      query.orderBy('updated_at', 'asc')
    }
    const orders = await query.orderBy('id', 'asc')
    const skipped = await this.#skippedToday(kind)
    const waiting = orders.filter((order) => !skipped.has(order.id))
    const plan = await this.#planRoute(kind, courier, waiting)
    return {
      queue: [...plan.orders, ...orders.filter((order) => skipped.has(order.id))],
      isOptimized: plan.isOptimized,
    }
  }

  async #planRoute(kind: TripKind, courier: Courier, waiting: Order[]) {
    const day = startOfToday().toISODate()!
    for (const [key, plan] of routePlans) {
      if (plan.day !== day) {
        routePlans.delete(key)
      }
    }

    const key = `${courier.id}:${kind}`
    const cached = routePlans.get(key)
    const byStop = new Map(waiting.map((order) => [stopKey(order, kind), order]))
    const isReusable =
      cached &&
      !cached.isStale &&
      [...byStop.keys()].every((stop) => cached.stops.includes(stop)) &&
      (cached.isOptimized || (cached.retryAt ?? 0) > Date.now())
    if (isReusable) {
      return {
        orders: cached.stops.flatMap((stop) => byStop.get(stop) ?? []),
        isOptimized: cached.isOptimized,
      }
    }

    const start = cached?.anchor ?? courier.position ?? cached?.lastStop ?? STORE_POINT
    const ordered = await this.#nearestFirst(kind, start, waiting)
    routePlans.set(key, {
      day,
      stops: (ordered ?? waiting).map((order) => stopKey(order, kind)),
      isOptimized: ordered !== null,
      isStale: false,
      anchor: ordered ? null : (cached?.anchor ?? null),
      lastStop: cached?.lastStop ?? null,
      retryAt: ordered ? null : Date.now() + UNOPTIMIZED_RETRY_MS,
    })
    return { orders: ordered ?? waiting, isOptimized: ordered !== null }
  }

  async #nearestFirst(kind: TripKind, start: Point, waiting: Order[]) {
    if (waiting.length < 2) {
      return waiting
    }
    if (waiting.length + 1 > MAX_TABLE_LOCATIONS) {
      return null
    }
    let durations
    try {
      durations = await this.osrm.findDurations([
        start,
        ...waiting.map((order) => tripPoint(order, kind)),
      ])
    } catch (error) {
      warnOsrmFailure(error, 'keeping the scheduled queue order')
      return null
    }
    if (!durations) {
      return null
    }

    const cost = (from: number, to: number) => durations[from]?.[to + 1] ?? Infinity
    const ordered: Order[] = []
    let current = 0
    for (const group of slotGroups(waiting, kind)) {
      const remaining = [...group]
      while (remaining.length) {
        let best = 0
        for (const [position, index] of remaining.entries()) {
          if (cost(current, index) < cost(current, remaining[best])) {
            best = position
          }
        }
        const [next] = remaining.splice(best, 1)
        ordered.push(waiting[next])
        current = next + 1
      }
    }
    return ordered
  }

  async #replanAfterTrip(user: User, order: Order, kind: TripKind, isCompleted: boolean) {
    await order.load((loader) => loader.load('pickupAddress').load('deliveryAddress'))
    const stop = tripPoint(order, kind)
    const key = `${user.id}:${kind}`
    const cached = routePlans.get(key)
    routePlans.set(key, {
      day: startOfToday().toISODate()!,
      stops: cached?.stops ?? [],
      isOptimized: cached?.isOptimized ?? false,
      isStale: true,
      anchor: isCompleted ? stop : null,
      lastStop: stop,
      retryAt: null,
    })
  }

  tripsHandledToday(user: User, kind: TripKind) {
    return ActivityLog.query()
      .where('actor_id', user.id)
      .whereIn('action', [TRIP[kind].doneAction, TRIP[kind].skipAction])
      .where('created_at', '>=', startOfToday().toJSDate())
      .whereNotNull('order_id')
      .preload('order', (order) => {
        order
          .preload('pickupAddress')
          .preload('deliveryAddress')
          .preload('items')
          .preload('payments')
      })
      .orderBy('id', 'desc')
  }

  async hasArrived(order: Order) {
    const started = await ActivityLog.query()
      .where('order_id', order.id)
      .where('action', ActivityAction.TASK_STARTED)
      .orderBy('id', 'desc')
      .first()
    if (!started) {
      return false
    }
    const arrival = await ActivityLog.query()
      .where('order_id', order.id)
      .where('action', ActivityAction.ARRIVED)
      .where('id', '>', started.id)
      .first()
    return !!arrival
  }

  async startTrip(user: User, id: number, kind: TripKind) {
    const trip = TRIP[kind]
    return db.transaction(async (transaction) => {
      const current = await Order.findActiveTrip(trip.active, transaction)
      if (current && current.id !== id) {
        throw fieldError(
          'form',
          `Selesaikan atau lewati dulu tugas ${current.number()}.`,
          'task.busy'
        )
      }
      const locked = await this.orders.lockOrder(transaction, id)
      await this.orders.transitionOrder(
        locked,
        trip.active,
        { actor: user, action: ActivityAction.TASK_STARTED, detail: trip.startDetail },
        transaction
      )
      return locked
    })
  }

  async arriveAtTrip(user: User, id: number, kind: TripKind) {
    const order = await Order.find(id)
    if (!order) {
      throw fieldError('form', 'Pesanan tidak ditemukan.', 'order.missing')
    }
    this.#assertActive(order, kind)
    await ActivityLog.record({ actor: user, order, action: ActivityAction.ARRIVED })
  }

  async completeTrip(
    user: User,
    id: number,
    kind: TripKind,
    photo: MultipartFile,
    receiver?: string
  ) {
    const trip = TRIP[kind]
    const order = await db.transaction(async (transaction) => {
      const locked = await this.orders.lockOrder(transaction, id)
      this.#assertActive(locked, kind)
      await OrderPhoto.storePhoto(photo, locked, trip.photo, user, transaction)
      if (receiver) {
        locked.receiverName = receiver
      }
      await this.orders.transitionOrder(
        locked,
        trip.done,
        {
          actor: user,
          action: trip.doneAction,
          note: receiver ? `Diterima oleh ${receiver}` : null,
          detail:
            kind === 'pickup'
              ? `${locked.itemCount()} barang dijemput · foto bukti`
              : `Foto bukti · diterima oleh “${receiver}”`,
        },
        transaction
      )
      return locked
    })
    await this.#replanAfterTrip(user, order, kind, true)
    return order
  }

  async skipTrip(user: User, id: number, kind: TripKind, reason: string, note?: string | null) {
    const trip = TRIP[kind]
    const text = note ? `${reason} · ${note}` : reason
    const order = await db.transaction(async (transaction) => {
      const locked = await this.orders.lockOrder(transaction, id)
      this.#assertActive(locked, kind)
      await this.orders.transitionOrder(
        locked,
        trip.queued,
        { actor: user, action: trip.skipAction, note: text, detail: text },
        transaction
      )
      return locked
    })
    await this.#replanAfterTrip(user, order, kind, false)
    return order
  }

  workshopQueue() {
    return Order.query()
      .whereIn('status', WORKSHOP_STATUSES)
      .preload('items', (items) => items.orderBy('position', 'asc'))
      .preload('bill')
      .preload('payments')
      .preload('events', (events) => events.preload('actor').orderBy('id', 'asc'))
      .orderBy('updated_at', 'asc')
  }

  findOrderForWorkshop(id: number) {
    return Order.query()
      .where('id', id)
      .preload('items', (items) => items.orderBy('position', 'asc'))
      .preload('bill', (bill) => bill.preload('lines', (lines) => lines.preload('service')))
      .preload('payments')
      .preload('photos', (photos) => photos.preload('taker').orderBy('id', 'asc'))
      .preload('events', (events) => events.preload('actor').orderBy('id', 'asc'))
      .preload('deliveryAddress')
      .first()
  }

  async startInspection(user: User, id: number) {
    return db.transaction(async (transaction) => {
      const order = await this.orders.lockOrder(transaction, id)
      if (order.status === OrderStatus.PICKED_UP) {
        await this.orders.transitionOrder(
          order,
          OrderStatus.IN_INSPECTION,
          { actor: user, action: ActivityAction.INSPECTION_STARTED },
          transaction
        )
      } else if (order.status !== OrderStatus.IN_INSPECTION) {
        throw fieldError('form', 'Pesanan ini tidak menunggu pemeriksaan.', 'order.status')
      }
      return order
    })
  }

  async completeWash(user: User, id: number, photo: MultipartFile) {
    return db.transaction(async (transaction) => {
      const locked = await this.orders.lockOrder(transaction, id)
      if (locked.status !== OrderStatus.IN_CLEANING) {
        throw fieldError('form', 'Pesanan ini tidak sedang dicuci.', 'order.status')
      }
      await OrderPhoto.storePhoto(photo, locked, PhotoKind.WASHING, user, transaction)
      await OrderItem.markWashed(locked.id, transaction)
      await this.orders.transitionOrder(
        locked,
        locked.readyStatus(),
        { actor: user, action: ActivityAction.WASH_DONE, detail: 'Foto hasil cuci' },
        transaction
      )
      return locked
    })
  }

  async collectOrder(user: User, id: number) {
    return db.transaction(async (transaction) => {
      const order = await this.orders.lockOrder(transaction, id)
      await this.orders.transitionOrder(
        order,
        OrderStatus.COMPLETED,
        { actor: user, action: ActivityAction.COLLECTED, note: 'Diambil di toko' },
        transaction
      )
      return order
    })
  }

  async staffCounts(): Promise<StaffCounts> {
    const [jemput, antar, proses] = await Promise.all([
      this.#count(
        Order.query().where((query) => {
          query
            .where((waiting) => {
              waiting
                .where('status', OrderStatus.AWAITING_PICKUP)
                .where('pickup_date', '<=', startOfToday().toISODate()!)
            })
            .orWhere('status', OrderStatus.COURIER_EN_ROUTE)
        })
      ),
      this.#count(
        Order.query().whereIn('status', [OrderStatus.READY_FOR_DELIVERY, OrderStatus.IN_DELIVERY])
      ),
      this.#count(
        Order.query()
          .whereIn('status', WORKSHOP_STATUSES)
          .whereNot((query) => {
            query.where('status', OrderStatus.AWAITING_PAYMENT).where('source', OrderSource.ONLINE)
          })
      ),
    ])
    return { jemput, antar, proses }
  }

  async staffHistory(user: User, days = 7) {
    const since = startOfToday().minus({ days: days - 1 })
    const logs = await ActivityLog.query()
      .where('actor_id', user.id)
      .whereIn('action', Object.keys(HISTORY_ICON))
      .where('created_at', '>=', since.toJSDate())
      .whereNotNull('order_id')
      .preload('order')
      .orderBy('id', 'desc')

    return logs.map((log) => {
      const isSkip = HISTORY_ICON[log.action] === 'skip'
      return {
        id: log.id,
        date: log.createdAt.setZone(SERVICE_ZONE).toISODate()!,
        time: formatClock(log.createdAt),
        icon: HISTORY_ICON[log.action]!,
        title: isSkip ? HISTORY_TITLE[log.action]! : `${HISTORY_TITLE[log.action]} · ${log.detail}`,
        who: shortName(log.order.customerName),
        ref: log.order.number(),
        isInStore: log.order.source === OrderSource.STORE,
        note: isSkip ? log.detail : '',
      }
    })
  }

  #tripQuery() {
    return Order.query()
      .preload('pickupAddress')
      .preload('deliveryAddress')
      .preload('items', (items) => items.orderBy('position', 'asc'))
      .preload('bill', (bill) => bill.preload('lines'))
      .preload('payments')
  }

  async #skippedToday(kind: TripKind) {
    const rows = await ActivityLog.query()
      .where('action', TRIP[kind].skipAction)
      .where('created_at', '>=', startOfToday().toJSDate())
      .select('order_id')
    return new Set(rows.map((row) => row.orderId))
  }

  async #count(query: ModelQueryBuilderContract<typeof Order>) {
    const [row] = await query.count('* as total')
    return Number(row.$extras.total)
  }

  #assertActive(order: Order, kind: TripKind) {
    if (order.status !== TRIP[kind].active) {
      throw fieldError(
        'form',
        'Tugas ini tidak sedang berjalan. Buka lagi dari antrean.',
        'task.not_active'
      )
    }
  }
}
