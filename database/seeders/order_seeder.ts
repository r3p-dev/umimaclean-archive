import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import logger from '@adonisjs/core/services/logger'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import { ActivityAction } from '#enums/activity_enum'
import {
  ItemKind,
  ItemKindLabel,
  ORDER_STATUS_SEQUENCE,
  OrderAddressType,
  OrderSource,
  OrderStatus,
  OrderStatusLabel,
  PhotoKind,
  ReturnMethod,
} from '#enums/order_enum'
import {
  PAYMENT_RECEIVED_STATUSES,
  PaymentChannel,
  PaymentMethod,
  PaymentMethodLabel,
  PaymentStatus,
  PaymentStatusLabel,
} from '#enums/payment_enum'
import { formatRupiah } from '#helpers/money'
import { Role } from '#enums/role_enum'
import { ServiceType } from '#enums/service_enum'
import ActivityLog from '#models/activity_log'
import Bill from '#models/bill'
import BillLine from '#models/bill_line'
import CustomerAddress from '#models/customer_address'
import Order from '#models/order'
import OrderAddress from '#models/order_address'
import OrderEvent from '#models/order_event'
import OrderItem from '#models/order_item'
import OrderPhoto, { proofPath } from '#models/order_photo'
import Payment from '#models/payment'
import Service from '#models/service'
import User from '#models/user'
import { snapshotOf } from '#services/order_service'
import { orderRoute } from '#transformers/order_transformer'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'
import { DEMO_CUSTOMERS, DEMO_PHONE } from '#database/seeders/user_seeder'

const PLACEHOLDER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

type Staff = { courier: User; owner: User }

type Spec = {
  customer: User | null
  walkIn?: { name: string; phone: string }
  source: OrderSource
  returnMethod: ReturnMethod
  status: OrderStatus
  items: [number, number, number]
  createdAt?: DateTime
  endsAt?: DateTime
  stepMinutes?: number
  pickupDate?: DateTime
  pickupSlot?: number
  method?: PaymentMethod
  note?: string
  cancelReason?: string
  ownerCancelsAt?: OrderStatus
  isMovedByOwner?: boolean
  deliveryLabel?: string
  manualAddress?: { addressText: string; lat: number; lng: number }
  extraQris?: { status: PaymentStatus; note?: string; delta?: number }
  acceptedQris?: { delta: number; note: string }
}

type Step = {
  actor: User | null
  note?: string | null
  action?: ActivityAction
  detail?: string
  isSensitive?: boolean
}

function rng(seed: number) {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

export default class extends BaseSeeder {
  #random = rng(20261021)

  override async run() {
    if (await Order.query().first()) {
      logger.info('Demo orders already exist, skipping')
      return
    }
    const staff = {
      courier: await User.query().where('role', Role.STAFF).firstOrFail(),
      owner: await User.query().where('role', Role.ADMIN).firstOrFail(),
    }
    const rina = await User.findByOrFail('phone', DEMO_PHONE)
    const customers = [rina]
    for (const [, phone] of DEMO_CUSTOMERS) {
      customers.push(await User.findByOrFail('phone', phone))
    }
    const services = await Service.query().where('is_active', true)
    const today = DateTime.now().setZone(SERVICE_ZONE).startOf('day')
    const pick = <T>(list: readonly T[]) => list[Math.floor(this.#random() * list.length)]

    for (let day = 120; day >= 1; day -= 1) {
      const count = day > 60 ? (day % 9 === 0 ? 1 : 0) : day % 3 === 0 ? 2 : 1
      for (let index = 0; index < count; index++) {
        const isWalkIn = this.#random() < 0.3
        const customer = day > 60 ? customers[1 + (day % 4)] : pick(customers.slice(0, 8))
        await this.#build(
          {
            customer: isWalkIn && this.#random() < 0.5 ? null : customer,
            walkIn: { name: 'Andi Pratama', phone: '6281910384627' },
            source: isWalkIn ? OrderSource.STORE : OrderSource.ONLINE,
            returnMethod:
              isWalkIn && this.#random() < 0.6 ? ReturnMethod.STORE : ReturnMethod.DELIVERY,
            status: OrderStatus.COMPLETED,
            items: [
              1 + Math.floor(this.#random() * 2),
              this.#random() < 0.3 ? 1 : 0,
              isWalkIn && this.#random() < 0.2 ? 1 : 0,
            ],
            createdAt: today.minus({ days: day }).plus({ hours: 9 + index * 3 }),
            pickupSlot: index % 3,
            method: isWalkIn ? pick([PaymentMethod.CASH, PaymentMethod.QRIS]) : PaymentMethod.QRIS,
          },
          staff,
          services
        )
      }
    }

    const [, laras, fajar, , dewi, hendra, , indra, rudi, nadia] = customers
    const now = DateTime.now().setZone(SERVICE_ZONE)
    let workDay = now.minus({ hours: 12, minutes: 5 }).startOf('day')
    if (workDay.weekday === 7) {
      workDay = workDay.minus({ days: 1 })
    }
    const clock = DateTime.min(now.minus({ minutes: 5 }), workDay.plus({ hours: 18 }))
    const pickupDay = today.weekday === 7 ? today.minus({ days: 1 }) : today
    const evenBefore = (day: DateTime) => day.minus({ days: 1 }).plus({ hours: 19 })
    const online = (
      customer: User,
      status: OrderStatus,
      items: Spec['items'],
      spec: Partial<Spec> = {}
    ): Spec => ({
      customer,
      source: OrderSource.ONLINE,
      returnMethod: ReturnMethod.DELIVERY,
      status,
      items,
      createdAt: evenBefore(workDay),
      endsAt: clock,
      pickupDate: workDay,
      stepMinutes: 20,
      method: PaymentMethod.QRIS,
      ...spec,
    })
    const store = (
      customer: User | null,
      status: OrderStatus,
      returnMethod: ReturnMethod,
      items: Spec['items'],
      spec: Partial<Spec> = {}
    ): Spec => ({
      customer,
      source: OrderSource.STORE,
      returnMethod,
      status,
      items,
      endsAt: clock,
      stepMinutes: 20,
      method: PaymentMethod.CASH,
      ...spec,
    })
    const upcoming = { createdAt: evenBefore(pickupDay), endsAt: undefined, pickupDate: pickupDay }

    const showcase: [string, Spec][] = [
      [
        'online, same pickup and delivery address',
        online(rina, OrderStatus.AWAITING_PICKUP, [2, 0, 0], { ...upcoming, pickupSlot: 0 }),
      ],
      [
        'online, delivery to another recipient',
        online(laras, OrderStatus.AWAITING_PICKUP, [1, 1, 0], {
          ...upcoming,
          pickupSlot: 1,
          deliveryLabel: 'Kos Adik',
        }),
      ],
      [
        'online, 09.00 slot, started by courier',
        online(rina, OrderStatus.COURIER_EN_ROUTE, [1, 0, 0], { pickupSlot: 0 }),
      ],
      [
        'online, 12.00 slot, moved by owner',
        online(hendra, OrderStatus.COURIER_EN_ROUTE, [2, 1, 0], {
          pickupSlot: 1,
          isMovedByOwner: true,
        }),
      ],
      ['online', online(rina, OrderStatus.PICKED_UP, [1, 1, 0])],
      [
        'online, with order note',
        online(fajar, OrderStatus.PICKED_UP, [2, 0, 0], {
          note: 'Sepatu putih ada noda kopi di bagian depan.',
        }),
      ],
      ['online', online(rina, OrderStatus.IN_INSPECTION, [2, 1, 0])],
      [
        'walk-in guest, return at store',
        store(null, OrderStatus.IN_INSPECTION, ReturnMethod.STORE, [1, 0, 1], {
          walkIn: { name: 'Yoga Firmansyah', phone: '6281277403158' },
        }),
      ],
      [
        'online, unpaid, no QRIS yet, 5 items',
        online(rina, OrderStatus.AWAITING_PAYMENT, [3, 2, 0]),
      ],
      [
        'walk-in guest, bill saved, unpaid',
        store(null, OrderStatus.AWAITING_PAYMENT, ReturnMethod.STORE, [2, 0, 0], {
          walkIn: { name: 'Putri Ayu', phone: '6285793160284' },
        }),
      ],
      ['online, paid with QRIS', online(rina, OrderStatus.IN_CLEANING, [1, 0, 0])],
      [
        'walk-in, paid cash with change, counter QRIS paid late (refund due)',
        store(dewi, OrderStatus.IN_CLEANING, ReturnMethod.STORE, [2, 1, 0], {
          extraQris: { status: PaymentStatus.REFUND_DUE },
        }),
      ],
      [
        'online, delivery to another recipient',
        online(rina, OrderStatus.READY_FOR_DELIVERY, [2, 1, 0], { deliveryLabel: 'Rumah Ibu' }),
      ],
      [
        'walk-in guest, typed address, paid cash',
        store(null, OrderStatus.READY_FOR_DELIVERY, ReturnMethod.DELIVERY, [4, 0, 0], {
          walkIn: { name: 'Wulan Sari', phone: '6281563290817' },
          manualAddress: {
            addressText: 'Jl. Riau No. 23, Citarum, Bandung Wetan, Kota Bandung',
            lat: -6.9056,
            lng: 107.6178,
          },
        }),
      ],
      [
        'walk-in, saved address, started by courier',
        store(indra, OrderStatus.IN_DELIVERY, ReturnMethod.DELIVERY, [1, 0, 0]),
      ],
      [
        'online, moved by owner',
        online(rina, OrderStatus.IN_DELIVERY, [1, 1, 0], {
          pickupSlot: 1,
          isMovedByOwner: true,
        }),
      ],
      [
        'walk-in, registered customer',
        store(rina, OrderStatus.READY_FOR_COLLECTION, ReturnMethod.STORE, [2, 0, 0]),
      ],
      [
        'walk-in, unregistered guest',
        store(null, OrderStatus.READY_FOR_COLLECTION, ReturnMethod.STORE, [1, 1, 1], {
          walkIn: { name: 'Agus Salim', phone: '6289520637741' },
        }),
      ],
      [
        'online, delivered, receiver and photo',
        online(rina, OrderStatus.COMPLETED, [2, 1, 0], { pickupSlot: 2 }),
      ],
      [
        'walk-in, collected, paid cash, counter QRIS cancel failed',
        store(rudi, OrderStatus.COMPLETED, ReturnMethod.STORE, [1, 0, 0], {
          extraQris: { status: PaymentStatus.CANCEL_FAILED },
        }),
      ],
      [
        'online, cancelled by customer',
        online(rina, OrderStatus.CANCELLED, [1, 0, 0], {
          ...upcoming,
          pickupSlot: 2,
          cancelReason: 'Salah jadwal, mau pesan ulang minggu depan',
        }),
      ],
      [
        'online, cancelled by owner in inspection',
        online(nadia, OrderStatus.CANCELLED, [2, 1, 0], {
          ownerCancelsAt: OrderStatus.IN_INSPECTION,
          cancelReason: 'Bahan tas sudah rapuh, tidak bisa dicuci',
        }),
      ],
      [
        'online, QRIS paid Rp5.000 short (amount mismatch)',
        online(nadia, OrderStatus.AWAITING_PAYMENT, [1, 0, 0], {
          extraQris: { status: PaymentStatus.AMOUNT_MISMATCH, delta: -5000 },
        }),
      ],
      [
        'online, QRIS overpaid, accepted by owner',
        online(fajar, OrderStatus.IN_CLEANING, [1, 0, 0], {
          acceptedQris: { delta: 5000, note: 'Pelanggan setuju kelebihan dianggap tip' },
        }),
      ],
      [
        'walk-in, paid cash, late counter QRIS refunded by owner',
        store(hendra, OrderStatus.COMPLETED, ReturnMethod.STORE, [1, 0, 0], {
          extraQris: {
            status: PaymentStatus.REFUNDED,
            note: 'Transfer BCA ke pelanggan, 3 Nov 14.20',
          },
        }),
      ],
      [
        'walk-in, paid cash, counter QRIS cancel failed, handled by owner',
        store(laras, OrderStatus.COMPLETED, ReturnMethod.STORE, [1, 0, 0], {
          extraQris: {
            status: PaymentStatus.CANCELLED,
            note: 'Dicek di dashboard Midtrans, transaksi sudah batal',
          },
        }),
      ],
    ]

    const table: string[] = []
    for (const [position, [variant, spec]] of showcase.entries()) {
      const order = await this.#build(
        {
          ...spec,
          createdAt: spec.createdAt?.plus({ minutes: position * 3 }),
          endsAt: spec.endsAt?.minus({ minutes: (showcase.length - 1 - position) * 3 }),
          pickupSlot: spec.pickupSlot ?? position % 3,
        },
        staff,
        services
      )
      table.push(
        [order.status.padEnd(20), order.number(), order.customerName.padEnd(16), variant].join('  ')
      )
    }
    logger.info(`Showcase orders:\n${table.join('\n')}`)

    logger.info(
      `Demo orders created: ${await Order.query()
        .count('* as total')
        .then((rows) => rows[0].$extras.total)}`
    )
  }

  async #build(spec: Spec, staff: Staff, services: Service[]) {
    const customer = spec.customer
    const name = customer?.name ?? spec.walkIn?.name ?? 'Pelanggan toko'
    const phone = customer?.phone ?? spec.walkIn?.phone ?? ''
    const isOnline = spec.source === OrderSource.ONLINE
    const primary = customer ? await CustomerAddress.findPrimaryFor(customer.id) : null
    const saved =
      customer && spec.deliveryLabel
        ? await CustomerAddress.query()
            .where('user_id', customer.id)
            .where('label', spec.deliveryLabel)
            .firstOrFail()
        : primary
    const delivery = spec.manualAddress
      ? {
          label: 'Alamat antar',
          recipientName: name,
          recipientPhone: phone,
          landmark: null,
          ...spec.manualAddress,
        }
      : saved && snapshotOf(saved)
    const returnMethod = delivery ? spec.returnMethod : ReturnMethod.STORE
    const route = orderRoute(spec.source, returnMethod).map((index) => ORDER_STATUS_SEQUENCE[index])
    const isCancelled = spec.status === OrderStatus.CANCELLED
    const last = isCancelled ? (spec.ownerCancelsAt ?? OrderStatus.AWAITING_PICKUP) : spec.status
    const steps = [
      ...route.slice(0, route.indexOf(last) + 1),
      ...(isCancelled ? [OrderStatus.CANCELLED] : []),
    ]
    const stepMinutes = spec.stepMinutes ?? 120
    const times: DateTime[] = []
    for (const [position, status] of steps.entries()) {
      times.push(
        position === 0 && spec.createdAt
          ? spec.createdAt
          : spec.endsAt
            ? spec.endsAt.minus({ minutes: (steps.length - 1 - position) * stepMinutes })
            : times[position - 1].plus(
                status === OrderStatus.COURIER_EN_ROUTE ? { hours: 13 } : { minutes: stepMinutes }
              )
      )
    }
    const order = await Order.create({
      userId: customer?.id ?? null,
      requestKey: randomUUID(),
      source: spec.source,
      returnMethod,
      customerName: name,
      customerPhone: phone,
      status: spec.status,
      itemsSepatu: spec.items[0],
      itemsTas: spec.items[1],
      itemsHelm: spec.items[2],
      note: spec.note ?? '',
      pickupDate: isOnline ? (spec.pickupDate ?? times[0].plus({ days: 1 }).startOf('day')) : null,
      pickupSlot: isOnline ? (spec.pickupSlot ?? 0) : null,
      cancelReason: spec.cancelReason ?? null,
      receiverName:
        spec.status === OrderStatus.COMPLETED && returnMethod === ReturnMethod.DELIVERY
          ? name.split(' ')[0]
          : null,
      createdAt: times[0],
      updatedAt: times[0],
    })

    if (isOnline && primary) {
      await OrderAddress.create({
        ...snapshotOf(primary),
        orderId: order.id,
        type: OrderAddressType.PICKUP,
      })
    }
    if (order.returnMethod === ReturnMethod.DELIVERY && delivery) {
      await OrderAddress.create({ ...delivery, orderId: order.id, type: OrderAddressType.DELIVERY })
    }

    const method = spec.method ?? PaymentMethod.QRIS
    const isCounter = !isOnline || method !== PaymentMethod.QRIS
    let total = 0

    for (const [position, status] of steps.entries()) {
      const at = times[position]

      if (status === OrderStatus.PICKED_UP) {
        await this.#photo(order, PhotoKind.PICKUP, staff.courier, at)
      }
      if (status === OrderStatus.AWAITING_PAYMENT) {
        total = await this.#bill(order, services, staff.courier, at)
      }
      if (
        (status === OrderStatus.AWAITING_PAYMENT &&
          spec.extraQris?.status === PaymentStatus.AMOUNT_MISMATCH) ||
        (status === OrderStatus.IN_CLEANING &&
          spec.extraQris &&
          spec.extraQris.status !== PaymentStatus.AMOUNT_MISMATCH)
      ) {
        await this.#extraQris(order, spec.extraQris!, total, at, staff.owner)
      }
      if (status === OrderStatus.IN_CLEANING) {
        const paid = await Payment.create({
          orderId: order.id,
          channel: isOnline ? PaymentChannel.ONLINE : PaymentChannel.COUNTER,
          method,
          status: PaymentStatus.PAID,
          amount: total + (spec.acceptedQris?.delta ?? 0),
          note: spec.acceptedQris ? `Diterima owner: ${spec.acceptedQris.note}` : null,
          cashReceived:
            method === PaymentMethod.CASH ? (Math.floor(total / 50000) + 1) * 50000 : null,
          providerOrderId: isOnline ? `UMC-${order.id}-${at.toMillis()}` : null,
          providerTransactionId: isOnline ? randomUUID() : null,
          expiresAt: isCounter ? null : at.plus({ minutes: 3 }),
          paidAt: at,
          recordedBy: isCounter ? staff.courier.id : null,
          createdAt: isCounter ? at : at.minus({ minutes: 12 }),
          updatedAt: at,
        })
        if (spec.acceptedQris) {
          await this.#log(
            staff.owner,
            order,
            ActivityAction.PAYMENT_REVIEWED,
            `${paid.providerOrderId} · ${formatRupiah(paid.amount)} · ${PaymentStatusLabel[PaymentStatus.AMOUNT_MISMATCH]} → ${PaymentStatusLabel[PaymentStatus.PAID]} · catatan: ${spec.acceptedQris.note}`,
            at,
            true
          )
        }
      }
      if (
        status === OrderStatus.READY_FOR_DELIVERY ||
        status === OrderStatus.READY_FOR_COLLECTION
      ) {
        await this.#photo(order, PhotoKind.WASHING, staff.courier, at)
        await OrderItem.query().where('order_id', order.id).update({ washed_at: at.toJSDate() })
      }
      if (status === OrderStatus.COMPLETED && order.returnMethod === ReturnMethod.DELIVERY) {
        await this.#photo(order, PhotoKind.DELIVERY, staff.courier, at)
      }

      const from = steps[position - 1]
      const step: Step =
        spec.isMovedByOwner && position === steps.length - 1
          ? { actor: staff.owner, note: 'Diubah owner', isSensitive: true }
          : this.#stepFor(order, status, spec, staff, { total, isCounter, method })
      await OrderEvent.create({
        orderId: order.id,
        status,
        actorId: step.actor?.id ?? null,
        note: step.note ?? null,
        createdAt: at,
      })
      if (step.actor && !step.actor.isCustomer()) {
        await this.#log(
          step.actor,
          order,
          step.action ?? ActivityAction.STATUS_CHANGED,
          step.detail ?? `${OrderStatusLabel[from]} → ${OrderStatusLabel[status]}`,
          at,
          step.isSensitive
        )
      }

      if (status === OrderStatus.IN_INSPECTION && !isOnline) {
        await this.#photo(order, PhotoKind.INTAKE, staff.courier, at)
        await this.#log(
          staff.courier,
          order,
          ActivityAction.ITEMS_PHOTOGRAPHED,
          '1 foto barang diterima',
          at
        )
      }
    }

    await Order.query()
      .where('id', order.id)
      .update({ updated_at: times[times.length - 1].toJSDate() })
    return order
  }

  #stepFor(
    order: Order,
    status: OrderStatus,
    spec: Spec,
    staff: Staff,
    payment: { total: number; isCounter: boolean; method: PaymentMethod }
  ): Step {
    const courier = staff.courier
    const count = order.itemCount()
    const label = PaymentMethodLabel[payment.method]
    switch (status) {
      case OrderStatus.AWAITING_PICKUP:
        return { actor: spec.customer }
      case OrderStatus.COURIER_EN_ROUTE:
        return { actor: courier, action: ActivityAction.TASK_STARTED, detail: 'Jemput dimulai' }
      case OrderStatus.PICKED_UP:
        return {
          actor: courier,
          action: ActivityAction.PICKUP_DONE,
          detail: `${count} barang dijemput · foto bukti`,
        }
      case OrderStatus.IN_INSPECTION:
        return order.source === OrderSource.ONLINE
          ? { actor: courier, action: ActivityAction.INSPECTION_STARTED }
          : {
              actor: courier,
              action: ActivityAction.WALK_IN_CREATED,
              detail: `${count} barang · ${order.customerName}`,
            }
      case OrderStatus.AWAITING_PAYMENT:
        return {
          actor: courier,
          action: ActivityAction.BILL_CREATED,
          detail: `${count} barang · ${formatRupiah(payment.total)}`,
        }
      case OrderStatus.IN_CLEANING:
        return {
          actor: payment.isCounter ? courier : null,
          note: `Lunas · ${label}`,
          action: ActivityAction.PAYMENT_RECORDED,
          detail: `${label} · ${formatRupiah(payment.total)}`,
        }
      case OrderStatus.READY_FOR_DELIVERY:
      case OrderStatus.READY_FOR_COLLECTION:
        return { actor: courier, action: ActivityAction.WASH_DONE, detail: 'Foto hasil cuci' }
      case OrderStatus.IN_DELIVERY:
        return { actor: courier, action: ActivityAction.TASK_STARTED, detail: 'Antar dimulai' }
      case OrderStatus.COMPLETED:
        return order.returnMethod === ReturnMethod.DELIVERY
          ? {
              actor: courier,
              action: ActivityAction.DELIVERY_DONE,
              note: `Diterima oleh ${order.receiverName}`,
              detail: `Foto bukti · diterima oleh “${order.receiverName}”`,
            }
          : { actor: courier, action: ActivityAction.COLLECTED, note: 'Diambil di toko' }
      case OrderStatus.CANCELLED:
        return spec.ownerCancelsAt
          ? {
              actor: staff.owner,
              note: spec.cancelReason,
              action: ActivityAction.ORDER_CANCELLED,
              detail: `${OrderStatusLabel[spec.ownerCancelsAt]} → Dibatalkan · ${spec.cancelReason}`,
              isSensitive: true,
            }
          : { actor: spec.customer, note: `Dibatalkan pelanggan: ${spec.cancelReason}` }
    }
  }

  async #bill(order: Order, services: Service[], staff: User, at: DateTime) {
    const kinds: ItemKind[] = [
      ...Array.from({ length: order.itemsSepatu }, () => ItemKind.SHOE),
      ...Array.from({ length: order.itemsTas }, () => ItemKind.BAG),
      ...Array.from({ length: order.itemsHelm }, () => ItemKind.HELMET),
    ]
    const bill = await Bill.create({
      orderId: order.id,
      total: 0,
      decidedBy: staff.id,
      createdAt: at,
      updatedAt: at,
    })
    let total = 0
    for (const [index, kind] of kinds.entries()) {
      const main = services.filter(
        (service) => service.type === ServiceType.MAIN && service.categories.includes(kind)
      )
      const addons = services.filter(
        (service) => service.type === ServiceType.ADDON && service.categories.includes(kind)
      )
      const chosen = [
        main[Math.floor(this.#random() * main.length)],
        ...(addons.length && this.#random() < 0.35 ? [addons[0]] : []),
      ].filter(Boolean)
      const item = await OrderItem.create({
        orderId: order.id,
        kind,
        name: `${ItemKindLabel[kind]} ${index + 1}`,
        note: '',
        position: index + 1,
      })
      for (const service of chosen) {
        await BillLine.create({
          billId: bill.id,
          orderItemId: item.id,
          serviceId: service.id,
          name: service.name,
          price: service.price,
        })
        total += service.price
      }
    }
    await Bill.query().where('id', bill.id).update({ total })
    return total
  }

  async #photo(order: Order, kind: PhotoKind, staff: User, at: DateTime) {
    const path = `${order.id}/${kind}-demo.png`
    await mkdir(dirname(proofPath(path)), { recursive: true })
    await writeFile(proofPath(path), PLACEHOLDER)
    await OrderPhoto.create({ orderId: order.id, kind, path, takenBy: staff.id, createdAt: at })
  }

  async #extraQris(
    order: Order,
    extra: NonNullable<Spec['extraQris']>,
    total: number,
    at: DateTime,
    owner: User
  ) {
    const amount = total + (extra.delta ?? 0)
    const isReceived = PAYMENT_RECEIVED_STATUSES.includes(extra.status)
    const prefix: Partial<Record<PaymentStatus, string>> = {
      [PaymentStatus.REFUNDED]: 'Dikembalikan',
      [PaymentStatus.CANCELLED]: 'Ditangani owner',
    }
    const note =
      extra.status === PaymentStatus.AMOUNT_MISMATCH
        ? `Ditagih ${formatRupiah(total)}, diterima ${formatRupiah(amount)}`
        : extra.note
          ? `${prefix[extra.status]}: ${extra.note}`
          : null
    const payment = await Payment.create({
      orderId: order.id,
      channel: order.source === OrderSource.ONLINE ? PaymentChannel.ONLINE : PaymentChannel.COUNTER,
      method: PaymentMethod.QRIS,
      status: extra.status,
      amount,
      providerOrderId: `UMC-${order.id}-${at.minus({ minutes: 5 }).toMillis()}`,
      providerTransactionId: randomUUID(),
      expiresAt: at.plus({ minutes: 10 }),
      paidAt: isReceived ? at.plus({ minutes: 2 }) : null,
      note,
      createdAt: at.minus({ minutes: 5 }),
      updatedAt: at,
    })
    if (extra.note) {
      const from =
        extra.status === PaymentStatus.REFUNDED
          ? PaymentStatus.REFUND_DUE
          : PaymentStatus.CANCEL_FAILED
      await this.#log(
        owner,
        order,
        ActivityAction.PAYMENT_REVIEWED,
        `${payment.providerOrderId} · ${formatRupiah(amount)} · ${PaymentStatusLabel[from]} → ${PaymentStatusLabel[extra.status]} · catatan: ${extra.note}`,
        DateTime.min(at.plus({ minutes: 30 }), DateTime.now()),
        true
      )
    }
  }

  async #log(
    actor: User,
    order: Order,
    action: ActivityAction,
    detail: string,
    at: DateTime,
    isSensitive = false
  ) {
    await ActivityLog.create({
      actorId: actor.id,
      orderId: order.id,
      action,
      detail,
      isSensitive,
      createdAt: at,
    })
  }
}
