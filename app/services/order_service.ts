import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { errors as limiterErrors } from '@adonisjs/limiter'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import transmit from '@adonisjs/transmit/services/main'
import { DateTime } from 'luxon'
import { ActivityAction } from '#enums/activity_enum'
import { MessageStatus } from '#enums/message_enum'
import {
  FINISHED_STATUSES,
  OrderAddressType,
  OrderSource,
  OrderStatus,
  OrderStatusLabel,
  OrderStatusStage,
  PhotoKind,
  ReturnMethod,
  type OrderStage,
} from '#enums/order_enum'
import { billBreakdown } from '#helpers/bill'
import { orderNumber } from '#helpers/order'
import { lastFourDigits } from '#helpers/phone'
import {
  billText,
  courierOnTheWayText,
  orderCancelledText,
  orderCreatedText,
  orderLink,
} from '#helpers/whatsapp_text'
import ActivityLog from '#models/activity_log'
import CustomerAddress from '#models/customer_address'
import Order from '#models/order'
import OrderAddress from '#models/order_address'
import OrderEvent from '#models/order_event'
import OrderPhoto, { proofPath } from '#models/order_photo'
import ServiceArea, { type Point } from '#models/service_area'
import Setting from '#models/setting'
import User from '#models/user'
import FonnteService from '#services/fonnte_service'
import type { OrderPayload } from '#validators/customer/order'
import { fieldError } from '#validators/shared/field_error'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import type { WalkInPayload } from '#validators/staff/store'

const TRACKING_KEY = 'unlocked_orders'

const TRACKING_TRIES = { requests: 5, duration: '15 mins', blockDuration: '15 mins' }

const TRACKING_DAILY_TRIES = { requests: 20, duration: '24 hours', blockDuration: '24 hours' }

const OUTSIDE_MESSAGES = {
  pickup: 'Alamat jemput ini sekarang di luar area layanan. Pilih alamat lain atau ubah titiknya.',
  delivery: 'Alamat antar ini sekarang di luar area layanan. Pilih alamat lain atau ubah titiknya.',
  saved: 'Alamat tersimpan pelanggan di luar area layanan. Pilih titik antar lain di peta.',
  point: 'Titik antar di luar area antar-jemput gratis.',
}

export const STAFF_QUEUES_CHANNEL = 'staff/queues'
export const ADMIN_ORDERS_CHANNEL = 'admin/orders'

function orderChannel(id: number) {
  return `orders/${id}`
}

export const ORDER_FILTERS = ['semua', 'berjalan', 'selesai', 'dibatalkan'] as const
const ORDERS_PER_PAGE = 10

export type OrderFilter = (typeof ORDER_FILTERS)[number]

export function orderFilterOf(value: unknown): OrderFilter {
  return ORDER_FILTERS.find((filter) => filter === value) ?? 'semua'
}

export function orderSearchTerm(value: unknown) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
    .slice(0, 9)
}

export function snapshotOf(address: CustomerAddress) {
  return {
    label: address.label,
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    addressText: address.addressText,
    landmark: address.landmark,
    lat: address.lat,
    lng: address.lng,
  }
}

const SLOT_FULL_MESSAGE = 'Jam penjemputan ini sudah penuh. Pilih jam atau tanggal lain.'

export type SlotAvailability = {
  slot: number
  label: string
  capacity: number
  booked: number
  isOpen: boolean
  isFull: boolean
}

type CustomerMessage = 'created' | 'courierOnTheWay' | 'bill' | 'cancelled'

type TransitionOptions = {
  actor: User | null
  note?: string | null
  action?: ActivityAction
  detail?: string
  isSensitive?: boolean
  isOwnerOverride?: boolean
}

@inject()
export default class OrderService {
  constructor(protected fonnte: FonnteService) {}

  async lockOrder(transaction: TransactionClientContract, id: number) {
    const order = await Order.query({ client: transaction }).where('id', id).forUpdate().first()
    if (!order) {
      throw fieldError('form', 'Pesanan tidak ditemukan.', 'order.missing')
    }
    return order
  }

  async transitionOrder(
    order: Order,
    to: OrderStatus,
    options: TransitionOptions,
    transaction: TransactionClientContract
  ) {
    if (!order.canTransitionTo(to, options.isOwnerOverride)) {
      throw fieldError(
        'form',
        `Pesanan ${order.number()} sedang "${OrderStatusLabel[order.status]}", jadi tidak bisa diubah ke "${OrderStatusLabel[to]}". Muat ulang halaman.`,
        'order.transition'
      )
    }

    const from = order.status
    order.useTransaction(transaction)
    order.status = to
    await order.save()

    await this.#record(order, to, options, transaction)
    await ActivityLog.record(
      {
        actor: options.actor,
        order,
        action: options.action ?? ActivityAction.STATUS_CHANGED,
        detail: options.detail ?? `${OrderStatusLabel[from]} → ${OrderStatusLabel[to]}`,
        isSensitive: options.isSensitive,
      },
      transaction
    )

    const message = this.#messageFor(order, to, options.actor)
    if (message) {
      transaction.after('commit', async () => {
        await this.#send(order, message, options.actor)
      })
    }
    return order
  }

  broadcastOrder(order: Order) {
    const payload = { id: order.id, status: order.status }
    transmit.broadcast(orderChannel(order.id), payload)
    transmit.broadcast(STAFF_QUEUES_CHANNEL, payload)
    transmit.broadcast(ADMIN_ORDERS_CHANNEL, payload)
  }

  async slotAvailability(from: string, to: string, transaction?: TransactionClientContract) {
    const slots = await Setting.get('pickup_slots', transaction)
    const rows = await (transaction ?? db)
      .from('orders')
      .whereBetween('pickup_date', [from, to])
      .whereNot('status', OrderStatus.CANCELLED)
      .whereNotNull('pickup_slot')
      .select(db.raw(`to_char(pickup_date, 'YYYY-MM-DD') as day`), 'pickup_slot')
      .count('* as total')
      .groupBy('pickup_date', 'pickup_slot')

    const booked = new Map<string, number>()
    for (const row of rows) {
      booked.set(`${row.day}:${row.pickup_slot}`, Number(row.total))
    }

    return (date: string): SlotAvailability[] =>
      slots.map((setting, slot) => {
        const count = booked.get(`${date}:${slot}`) ?? 0
        return {
          slot,
          label: setting.label,
          capacity: setting.capacity,
          booked: count,
          isOpen: setting.on,
          isFull: count >= setting.capacity,
        }
      })
  }

  async upcomingSlotAvailability(days = 7) {
    const today = DateTime.now().setZone(SERVICE_ZONE).startOf('day')
    const from = today.plus({ days: 1 }).toISODate()!
    const to = today.plus({ days }).toISODate()!
    const lookup = await this.slotAvailability(from, to)
    const result: Record<string, SlotAvailability[]> = {}
    for (let offset = 1; offset <= days; offset++) {
      const date = today.plus({ days: offset }).toISODate()!
      result[date] = lookup(date)
    }
    return result
  }

  isTrackingUnlocked(session: HttpContext['session'], order: Order) {
    const unlocked = (session.get(TRACKING_KEY) as number[] | undefined) ?? []
    return unlocked.includes(order.id)
  }

  async unlockTracking(session: HttpContext['session'], order: Order, digits: string, ip: string) {
    const dailyKey = `tracking_order_day_${order.id}`
    try {
      const [throttled] = await limiter
        .multi([
          { key: `tracking_ip_${ip}`, ...TRACKING_TRIES },
          { key: `tracking_order_${order.id}`, ...TRACKING_TRIES },
          { key: dailyKey, ...TRACKING_DAILY_TRIES },
        ])
        .penalize(async () => {
          if (lastFourDigits(order.customerPhone) !== digits) {
            throw fieldError(
              'digits',
              'Nomor tidak cocok. Periksa 4 digit terakhir nomor WhatsApp pemesan.',
              'tracking.mismatch'
            )
          }
        })
      if (throttled) {
        throw throttled
      }
    } catch (error) {
      if (!(error instanceof limiterErrors.ThrottleException)) {
        throw error
      }
      if (await limiter.use({ ...TRACKING_DAILY_TRIES }).isBlocked(dailyKey)) {
        throw fieldError(
          'digits',
          'Terlalu banyak percobaan untuk pesanan ini. Coba lagi besok atau masuk ke akun pemesan.',
          'tracking.daily_limit'
        )
      }
      const minutes = Math.max(1, Math.ceil(error.response.availableIn / 60))
      throw fieldError(
        'digits',
        `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`,
        'tracking.throttled'
      )
    }

    const unlocked = (session.get(TRACKING_KEY) as number[] | undefined) ?? []
    session.put(TRACKING_KEY, [...new Set([...unlocked, order.id])])
  }

  async listOrdersForCustomer(
    user: User,
    options: { filter: OrderFilter; search: string; page: number }
  ) {
    const query = Order.query()
      .where('user_id', user.id)
      .withScopes((scopes) => {
        scopes.withDetails()
        scopes.withHistory()
      })
      .orderBy('created_at', 'desc')
    if (options.filter === 'berjalan') {
      query.whereNotIn('status', [...FINISHED_STATUSES])
    }
    if (options.filter === 'selesai') {
      query.where('status', OrderStatus.COMPLETED)
    }
    if (options.filter === 'dibatalkan') {
      query.where('status', OrderStatus.CANCELLED)
    }
    if (options.search) {
      query.whereRaw('cast(id as text) like ?', [`%${options.search}%`])
    }
    const result = await query.paginate(options.page, ORDERS_PER_PAGE)
    return {
      orders: result.all(),
      meta: { currentPage: result.currentPage, lastPage: result.lastPage, total: result.total },
      counts: await this.#filterCounts(user),
    }
  }

  listOrdersForOwner() {
    return Order.query()
      .preload('pickupAddress')
      .preload('deliveryAddress')
      .preload('bill')
      .preload('payments')
      .preload('events', (events) => events.preload('actor').orderBy('id', 'asc'))
      .orderBy('created_at', 'desc')
  }

  #customerOrderHistory(order: Order) {
    return this.listOrdersForOwner()
      .where((query) => {
        query.where('customer_phone', order.customerPhone)
        if (order.userId) {
          query.orWhere('user_id', order.userId)
        }
      })
      .limit(20)
  }

  findOrderById(id: number) {
    return Order.find(id)
  }

  findOrderWithHistory(id: number) {
    return Order.query()
      .where('id', id)
      .withScopes((scopes) => {
        scopes.withDetails()
        scopes.withHistory()
      })
      .first()
  }

  async findOrderDetailForOwner(id: number) {
    const order = await Order.findForOwner(id)
    if (!order) {
      return null
    }

    const [logs, history] = await Promise.all([
      ActivityLog.forOrder(order),
      this.#customerOrderHistory(order),
    ])
    return { order, logs, history }
  }

  async customerHomeOrders(user: User) {
    if (!(await Order.hasAnyFor(user))) {
      return null
    }

    const [active, completed] = await Promise.all([
      Order.latestActiveFor(user),
      Order.recentCompletedFor(user),
    ])
    return { active, completed }
  }

  async lookupWalkInCustomer(phone: string) {
    const customer = await User.findCustomerByPhone(phone)
    if (!customer) {
      return null
    }

    const [address, orders] = await Promise.all([
      CustomerAddress.findPrimaryFor(customer.id),
      Order.query().where('user_id', customer.id).orderBy('created_at', 'desc'),
    ])
    return { customer, address, orders }
  }

  findProofPhoto(id: number) {
    return OrderPhoto.query().where('id', id).preload('order').first()
  }

  proofPhotoPath(relative: string) {
    return proofPath(relative)
  }

  async checkOrder(user: User, payload: OrderPayload) {
    await this.#assertSlotOpen(payload)
    const pickup = await this.#resolveAddress(user, payload.pickupAddressId, 'pickupAddressId')
    await this.#assertServiceable(pickup, 'pickupAddressId', OUTSIDE_MESSAGES.pickup)
    const delivery = payload.deliveryAddressId
      ? await this.#resolveAddress(user, payload.deliveryAddressId, 'deliveryAddressId')
      : null
    if (delivery) {
      await this.#assertServiceable(delivery, 'deliveryAddressId', OUTSIDE_MESSAGES.delivery)
    }
    return { pickup, delivery }
  }

  async placeOrder(user: User, payload: OrderPayload) {
    await this.checkOrder(user, payload)
    const result = await db.transaction(async (transaction) => {
      const existing = await Order.query({ client: transaction })
        .where('user_id', user.id)
        .where('request_key', payload.key)
        .first()
      if (existing) {
        return { order: existing, isNew: false }
      }

      await transaction.rawQuery('select pg_advisory_xact_lock(hashtext(?))', [
        `pickup-slot:${payload.date}:${payload.slot}`,
      ])
      await this.#assertSlotOpen(payload, transaction)

      const pickup = await this.#resolveAddress(
        user,
        payload.pickupAddressId,
        'pickupAddressId',
        transaction
      )
      const delivery = payload.deliveryAddressId
        ? await this.#resolveAddress(
            user,
            payload.deliveryAddressId,
            'deliveryAddressId',
            transaction
          )
        : pickup

      const order = await Order.create(
        {
          userId: user.id,
          customerName: user.name,
          customerPhone: user.phone,
          requestKey: payload.key,
          status: OrderStatus.AWAITING_PICKUP,
          itemsSepatu: payload.items.sepatu,
          itemsTas: payload.items.tas,
          itemsHelm: payload.items.helm,
          note: payload.note ?? '',
          pickupDate: DateTime.fromISO(payload.date, { zone: SERVICE_ZONE }),
          pickupSlot: payload.slot,
        },
        { client: transaction }
      )
      await OrderAddress.createMany(
        [
          { ...snapshotOf(pickup), orderId: order.id, type: OrderAddressType.PICKUP },
          { ...snapshotOf(delivery), orderId: order.id, type: OrderAddressType.DELIVERY },
        ],
        { client: transaction }
      )
      await this.#record(order, OrderStatus.AWAITING_PICKUP, { actor: user }, transaction)
      return { order, isNew: true }
    })

    if (result.isNew) {
      await this.#send(result.order, 'created')
    }
    return result.order
  }

  async cancelOrderByCustomer(user: User, order: Order, reason: string) {
    return db.transaction(async (transaction) => {
      const locked = await this.lockOrder(transaction, order.id)
      if (locked.status !== OrderStatus.AWAITING_PICKUP) {
        throw fieldError(
          'form',
          'Pesanan sudah diproses kurir dan tidak bisa dibatalkan di sini. Hubungi kami via WhatsApp.',
          'order.not_cancellable'
        )
      }
      locked.cancelReason = reason
      await this.transitionOrder(
        locked,
        OrderStatus.CANCELLED,
        { actor: user, note: `Dibatalkan pelanggan: ${reason}` },
        transaction
      )
      return locked
    })
  }

  async createWalkInOrder(staff: User, phone: string, payload: WalkInPayload) {
    const customer = await User.findCustomerByPhone(phone)
    const name = customer?.name ?? payload.name?.trim()
    if (!name) {
      throw fieldError('name', 'Isi nama pelanggan.', 'name.required')
    }

    let delivery = null
    if (payload.returnMethod === ReturnMethod.DELIVERY) {
      const saved =
        customer && payload.useSavedAddress
          ? await CustomerAddress.findPrimaryFor(customer.id)
          : null
      if (saved) {
        await this.#assertServiceable(saved, 'address', OUTSIDE_MESSAGES.saved)
        delivery = snapshotOf(saved)
      } else {
        if (!payload.address || !payload.point) {
          throw fieldError('address', 'Isi alamat dan titik antar di peta.', 'address.required')
        }
        await this.#assertServiceable(payload.point, 'address', OUTSIDE_MESSAGES.point)
        delivery = {
          label: 'Alamat antar',
          recipientName: name,
          recipientPhone: phone,
          addressText: payload.address,
          landmark: null,
          lat: payload.point.lat,
          lng: payload.point.lng,
        }
      }
    }

    const created = await db.transaction(async (transaction) => {
      const order = await Order.create(
        {
          userId: customer?.id ?? null,
          requestKey: randomUUID(),
          source: OrderSource.STORE,
          returnMethod: payload.returnMethod,
          customerName: name,
          customerPhone: phone,
          status: OrderStatus.IN_INSPECTION,
          itemsSepatu: payload.items.sepatu,
          itemsTas: payload.items.tas,
          itemsHelm: payload.items.helm,
          note: payload.note ?? '',
          pickupDate: null,
          pickupSlot: null,
        },
        { client: transaction }
      )

      if (delivery) {
        await OrderAddress.create(
          { ...delivery, orderId: order.id, type: OrderAddressType.DELIVERY },
          { client: transaction }
        )
      }
      await this.#record(order, OrderStatus.IN_INSPECTION, { actor: staff }, transaction)
      await ActivityLog.record(
        {
          actor: staff,
          order,
          action: ActivityAction.WALK_IN_CREATED,
          detail: `${order.itemCount()} barang · ${name}`,
        },
        transaction
      )
      for (const photo of payload.photos) {
        await OrderPhoto.storePhoto(photo, order, PhotoKind.INTAKE, staff, transaction)
      }
      await ActivityLog.record(
        {
          actor: staff,
          order,
          action: ActivityAction.ITEMS_PHOTOGRAPHED,
          detail: `${payload.photos.length} foto barang diterima`,
        },
        transaction
      )
      return order
    })

    await this.#send(created, 'created')
    return created
  }

  async moveOrdersToStage(owner: User, ids: number[], stage: OrderStage) {
    const moved: string[] = []
    const failed: { number: string; reason: string }[] = []
    for (const id of ids) {
      const reason = await db.transaction(async (transaction) => {
        const order = await Order.query({ client: transaction }).where('id', id).forUpdate().first()
        if (!order) {
          return 'tidak ditemukan'
        }
        const next = order.ownerMoves().find((status) => OrderStatusStage[status] === stage)
        if (!next) {
          return 'tidak bisa diubah massal ke status ini'
        }
        await this.transitionOrder(
          order,
          next,
          { actor: owner, note: 'Diubah owner', isSensitive: true },
          transaction
        )
        return null
      })
      if (reason) {
        failed.push({ number: orderNumber(id), reason })
      } else {
        moved.push(orderNumber(id))
      }
    }
    return { moved, failed }
  }

  async cancelOrdersByOwner(owner: User, ids: number[], reason: string) {
    let cancelled = 0
    for (const id of ids) {
      const isCancelled = await db.transaction(async (transaction) => {
        const locked = await Order.query({ client: transaction })
          .where('id', id)
          .forUpdate()
          .first()
        if (!locked || FINISHED_STATUSES.includes(locked.status)) {
          return false
        }
        locked.cancelReason = reason
        await this.transitionOrder(
          locked,
          OrderStatus.CANCELLED,
          {
            actor: owner,
            note: reason,
            action: ActivityAction.ORDER_CANCELLED,
            detail: `${OrderStatusLabel[locked.status]} → Dibatalkan · ${reason}`,
            isSensitive: true,
            isOwnerOverride: true,
          },
          transaction
        )
        return true
      })
      cancelled += isCancelled ? 1 : 0
    }
    return { cancelled, skipped: ids.length - cancelled }
  }

  async #record(
    order: Order,
    status: OrderStatus,
    options: { actor: User | null; note?: string | null },
    transaction: TransactionClientContract
  ) {
    await OrderEvent.create(
      { orderId: order.id, status, actorId: options.actor?.id ?? null, note: options.note ?? null },
      { client: transaction }
    )
    transaction.after('commit', async () => {
      this.broadcastOrder(order)
    })
  }

  async #filterCounts(user: User): Promise<Record<OrderFilter, number>> {
    const rows = await Order.query()
      .where('user_id', user.id)
      .select('status')
      .count('* as total')
      .groupBy('status')
    const totals = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.$extras.total)])
    ) as Partial<Record<OrderStatus, number>>
    const all = Object.values(totals).reduce((sum, count) => sum + count, 0)
    const completed = totals[OrderStatus.COMPLETED] ?? 0
    const cancelled = totals[OrderStatus.CANCELLED] ?? 0
    return {
      semua: all,
      berjalan: all - completed - cancelled,
      selesai: completed,
      dibatalkan: cancelled,
    }
  }

  async #resolveAddress(
    user: User,
    id: number,
    field: string,
    transaction?: TransactionClientContract
  ) {
    const address = await CustomerAddress.query({ client: transaction })
      .where('user_id', user.id)
      .where('id', id)
      .first()
    if (!address) {
      throw fieldError(field, 'Alamat tidak ditemukan. Pilih alamat lain.', 'address.missing')
    }
    return address
  }

  async #assertServiceable(point: Point, field: string, message: string) {
    if (!(await ServiceArea.contains(point))) {
      throw fieldError(field, message, 'area.outside')
    }
  }

  async #assertSlotOpen(payload: OrderPayload, transaction?: TransactionClientContract) {
    const lookup = await this.slotAvailability(payload.date, payload.date, transaction)
    const slot = lookup(payload.date)[payload.slot]
    if (!slot || !slot.isOpen) {
      throw fieldError('slot', 'Jam ini tidak tersedia. Pilih jam lain.', 'slot.closed')
    }
    if (slot.isFull) {
      throw fieldError('slot', SLOT_FULL_MESSAGE, 'slot.full')
    }
  }

  #messageFor(order: Order, to: OrderStatus, actor: User | null): CustomerMessage | null {
    if (to === OrderStatus.COURIER_EN_ROUTE) {
      return 'courierOnTheWay'
    }
    if (to === OrderStatus.AWAITING_PAYMENT) {
      return 'bill'
    }
    if (to === OrderStatus.CANCELLED && !(actor && actor.id === order.userId)) {
      return 'cancelled'
    }
    return null
  }

  async #send(order: Order, message: CustomerMessage, actor: User | null = null) {
    if (!order.customerPhone) {
      return MessageStatus.FAILED
    }
    try {
      const status = await this.fonnte.sendMessage(
        order.customerPhone,
        await this.#text(order, message, actor)
      )
      if (status === MessageStatus.FAILED) {
        logger.warn({ order: order.id, message }, 'Customer WhatsApp was not sent')
      }
      return status
    } catch (error) {
      logger.error({ err: error, order: order.id, message }, 'Customer WhatsApp failed')
      return MessageStatus.FAILED
    }
  }

  async #text(order: Order, message: CustomerMessage, actor: User | null) {
    const customerName = order.customerName
    const number = order.number()
    const link = orderLink(order.id)

    switch (message) {
      case 'created':
        return orderCreatedText({ customerName, number, link })
      case 'courierOnTheWay':
        return courierOnTheWayText({
          customerName,
          number,
          courier: actor?.firstName() || 'kami',
          link,
        })
      case 'bill': {
        const billed = await Order.query()
          .where('id', order.id)
          .withScopes((scopes) => scopes.withHistory())
          .firstOrFail()
        return billText({
          customerName,
          number,
          bill: billBreakdown(billed)!,
          link,
          isWalkIn: order.source === OrderSource.STORE,
        })
      }
      case 'cancelled': {
        const store = await Setting.get('store')
        return orderCancelledText({
          customerName,
          number,
          store: store.name,
          reason: order.cancelReason ?? '-',
          link,
        })
      }
    }
  }
}
