import { belongsTo, hasMany, hasOne, scope } from '@adonisjs/lucid/orm'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import { OrderSchema } from '#database/schema'
import {
  FINISHED_STATUSES,
  ORDER_TRANSITIONS,
  OrderAddressType,
  OrderSource,
  OrderStatus,
  OrderStatusStage,
  OWNER_BULK_MOVES,
  ReturnMethod,
  STORE_ONLY_ITEM_KINDS,
  type ItemKind,
} from '#enums/order_enum'
import { PaymentStatus } from '#enums/payment_enum'
import { orderNumber } from '#helpers/order'
import Bill from '#models/bill'
import OrderAddress from '#models/order_address'
import OrderEvent from '#models/order_event'
import OrderItem from '#models/order_item'
import OrderPhoto from '#models/order_photo'
import Payment from '#models/payment'
import User from '#models/user'

const PACKED_STATUSES: readonly OrderStatus[] = [
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.IN_DELIVERY,
  OrderStatus.COMPLETED,
]

export default class Order extends OrderSchema {
  static withDetails = scope((query: ModelQueryBuilderContract<typeof Order>) => {
    query.preload('user').preload('pickupAddress').preload('deliveryAddress')
  })

  static withHistory = scope((query: ModelQueryBuilderContract<typeof Order>) => {
    query
      .preload('events', (events) => events.preload('actor').orderBy('id', 'asc'))
      .preload('items', (items) => items.orderBy('position', 'asc'))
      .preload('bill', (bill) =>
        bill.preload('lines', (lines) => lines.preload('service').orderBy('id', 'asc'))
      )
      .preload('payments', (payments) => payments.orderBy('id', 'asc'))
      .preload('photos', (photos) => photos.preload('taker').orderBy('id', 'asc'))
  })

  static latestActiveFor(user: User) {
    return Order.query()
      .where('user_id', user.id)
      .whereNotIn('status', [...FINISHED_STATUSES])
      .withScopes((scopes) => {
        scopes.withDetails()
        scopes.withHistory()
      })
      .orderBy('created_at', 'desc')
      .first()
  }

  static recentCompletedFor(user: User, limit = 3) {
    return Order.query()
      .where('user_id', user.id)
      .where('status', OrderStatus.COMPLETED)
      .withScopes((scopes) => {
        scopes.withDetails()
        scopes.withHistory()
      })
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  static async hasAnyFor(user: User) {
    return !!(await Order.query().where('user_id', user.id).select('id').first())
  }

  static findForOwner(id: number) {
    return Order.query()
      .where('id', id)
      .preload('pickupAddress')
      .preload('deliveryAddress')
      .preload('items', (items) => items.orderBy('position', 'asc'))
      .preload('bill', (bill) =>
        bill
          .preload('lines', (lines) => lines.preload('service').orderBy('id', 'asc'))
          .preload('decider')
      )
      .preload('payments', (payments) => payments.preload('recorder').orderBy('id', 'asc'))
      .preload('photos', (photos) => photos.preload('taker').orderBy('id', 'asc'))
      .preload('events', (events) => events.preload('actor').orderBy('id', 'asc'))
      .first()
  }

  static async findActiveTrip(status: OrderStatus, transaction: TransactionClientContract) {
    await transaction.rawQuery('select pg_advisory_xact_lock(hashtext(?))', [`trip:${status}`])
    return Order.query({ client: transaction }).where('status', status).first()
  }

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => OrderAddress)
  declare addresses: HasMany<typeof OrderAddress>

  @hasOne(() => OrderAddress, { onQuery: (query) => query.where('type', OrderAddressType.PICKUP) })
  declare pickupAddress: HasOne<typeof OrderAddress>

  @hasOne(() => OrderAddress, {
    onQuery: (query) => query.where('type', OrderAddressType.DELIVERY),
  })
  declare deliveryAddress: HasOne<typeof OrderAddress>

  @hasMany(() => OrderEvent)
  declare events: HasMany<typeof OrderEvent>

  @hasMany(() => OrderItem)
  declare items: HasMany<typeof OrderItem>

  @hasOne(() => Bill)
  declare bill: HasOne<typeof Bill>

  @hasMany(() => Payment)
  declare payments: HasMany<typeof Payment>

  @hasMany(() => OrderPhoto)
  declare photos: HasMany<typeof OrderPhoto>

  number() {
    return orderNumber(this.id)
  }

  itemCount() {
    return this.itemsSepatu + this.itemsTas + this.itemsHelm
  }

  isPackedForDelivery() {
    return PACKED_STATUSES.includes(this.status)
  }

  canPrintLabel() {
    return !!this.deliveryAddress && this.isPackedForDelivery()
  }

  canPrintReceipt() {
    return this.payments.some((payment) => payment.status === PaymentStatus.PAID)
  }

  canTransitionTo(to: OrderStatus, isOwnerOverride = false) {
    if (isOwnerOverride && to === OrderStatus.CANCELLED) {
      return !FINISHED_STATUSES.includes(this.status)
    }
    return ORDER_TRANSITIONS[this.status].includes(to)
  }

  canHoldItem(kind: ItemKind) {
    return this.source === OrderSource.STORE || !STORE_ONLY_ITEM_KINDS.includes(kind)
  }

  readyStatus() {
    return this.returnMethod === ReturnMethod.STORE
      ? OrderStatus.READY_FOR_COLLECTION
      : OrderStatus.READY_FOR_DELIVERY
  }

  ownerMoves() {
    const next = OWNER_BULK_MOVES[this.status]
    return next ? [next] : []
  }

  ownerStages() {
    return [...new Set(this.ownerMoves().map((next) => OrderStatusStage[next]))]
  }
}
