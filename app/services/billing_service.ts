import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { ActivityAction } from '#enums/activity_enum'
import { ItemKind, OrderStatus } from '#enums/order_enum'
import { ServiceType } from '#enums/service_enum'
import { formatRupiah } from '#helpers/money'
import ActivityLog from '#models/activity_log'
import Bill from '#models/bill'
import BillLine from '#models/bill_line'
import OrderItem from '#models/order_item'
import Service from '#models/service'
import type User from '#models/user'
import OrderService from '#services/order_service'
import { fieldError } from '#validators/shared/field_error'

type ItemSelection = { main: number; addons: number[] }

type InspectedItem = {
  kind: ItemKind
  itemName: string
  note?: string | null
  services: ItemSelection
}

type ServiceInput = {
  serviceName: string
  type: 'utama' | 'tambahan'
  categories: ('Sepatu' | 'Tas' | 'Helm')[]
  price: number
  days: number
  description?: string
  active: boolean
}

const KIND_OF = { Sepatu: ItemKind.SHOE, Tas: ItemKind.BAG, Helm: ItemKind.HELMET } as const

@inject()
export default class BillingService {
  constructor(protected orders: OrderService) {}

  priceList() {
    return Service.query().withScopes((scopes) => {
      scopes.available()
      scopes.ordered()
    })
  }

  activePriceList() {
    return this.priceList().where('is_active', true)
  }

  async createBillFromInspection(user: User, id: number, items: InspectedItem[]) {
    return db.transaction(async (transaction) => {
      const order = await this.orders.lockOrder(transaction, id)
      if (order.status !== OrderStatus.IN_INSPECTION) {
        throw fieldError('form', 'Pemeriksaan pesanan ini sudah disimpan.', 'order.status')
      }
      for (const [index, item] of items.entries()) {
        if (!order.canHoldItem(item.kind)) {
          throw fieldError(
            `items.${index}.kind`,
            'Cuci helm hanya untuk barang yang dibawa langsung ke toko.',
            'item.store_only'
          )
        }
      }

      const priced = []
      for (const [index, item] of items.entries()) {
        priced.push({
          item,
          services: await this.#resolve(
            item.kind,
            item.services,
            `items.${index}.services`,
            transaction
          ),
        })
      }

      await OrderItem.query({ client: transaction }).where('order_id', order.id).delete()
      await Bill.query({ client: transaction }).where('order_id', order.id).delete()

      const total = priced.reduce(
        (sum, entry) =>
          sum + entry.services.reduce((lineSum, service) => lineSum + service.price, 0),
        0
      )
      const bill = await Bill.create(
        { orderId: order.id, total, decidedBy: user.id },
        { client: transaction }
      )

      for (const [index, entry] of priced.entries()) {
        const orderItem = await OrderItem.create(
          {
            orderId: order.id,
            kind: entry.item.kind,
            name: entry.item.itemName,
            note: entry.item.note ?? '',
            position: index + 1,
          },
          { client: transaction }
        )
        await BillLine.createMany(
          entry.services.map((service) => ({
            billId: bill.id,
            orderItemId: orderItem.id,
            serviceId: service.id,
            name: service.name,
            price: service.price,
          })),
          { client: transaction }
        )
      }

      await this.orders.transitionOrder(
        order,
        OrderStatus.AWAITING_PAYMENT,
        {
          actor: user,
          action: ActivityAction.BILL_CREATED,
          detail: `${items.length} barang · ${formatRupiah(bill.total)}`,
        },
        transaction
      )
      return { order, total: bill.total }
    })
  }

  async savePrice(owner: User, input: ServiceInput, id: number | null) {
    return db.transaction(async (transaction) => {
      const service = id
        ? await Service.query({ client: transaction })
            .where('id', id)
            .whereNull('deleted_at')
            .forUpdate()
            .firstOrFail()
        : new Service()
      const before = service.$isPersisted ? `${service.name} ${formatRupiah(service.price)}` : null
      service.useTransaction(transaction)
      service.merge({
        name: input.serviceName,
        type: input.type === 'utama' ? ServiceType.MAIN : ServiceType.ADDON,
        categories: input.categories.map((category) => KIND_OF[category]),
        price: input.price,
        days: input.days,
        description: input.description ?? '',
        isActive: input.active,
      })
      await service.save()
      await ActivityLog.record(
        {
          actor: owner,
          action: ActivityAction.PRICE_CHANGED,
          detail: before
            ? `${before} → ${service.name} ${formatRupiah(service.price)}`
            : `Menambah ${service.name} ${formatRupiah(service.price)}`,
          isSensitive: !!before,
        },
        transaction
      )
      return service
    })
  }

  async setPricesActive(owner: User, ids: number[], isActive: boolean) {
    return db.transaction(async (transaction) => {
      const services = await Service.query({ client: transaction })
        .whereIn('id', ids)
        .whereNull('deleted_at')
      await Service.query({ client: transaction })
        .whereIn('id', ids)
        .whereNull('deleted_at')
        .update({ is_active: isActive })
      await ActivityLog.record(
        {
          actor: owner,
          action: ActivityAction.PRICE_CHANGED,
          detail: `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} ${services.map((service) => service.name).join(', ')}`,
        },
        transaction
      )
      return services.length
    })
  }

  async removePrices(owner: User, ids: number[]) {
    return db.transaction(async (transaction) => {
      const services = await Service.query({ client: transaction })
        .whereIn('id', ids)
        .whereNull('deleted_at')
      await Service.query({ client: transaction })
        .whereIn('id', ids)
        .whereNull('deleted_at')
        .update({ deleted_at: DateTime.now().toJSDate(), is_active: false })
      await ActivityLog.record(
        {
          actor: owner,
          action: ActivityAction.PRICE_CHANGED,
          detail: `Menghapus ${services.map((service) => service.name).join(', ')}`,
          isSensitive: true,
        },
        transaction
      )
      return services.length
    })
  }

  async #resolve(
    kind: ItemKind,
    selection: ItemSelection,
    field: string,
    transaction: TransactionClientContract
  ) {
    const ids = [selection.main, ...new Set(selection.addons)]
    const services = await Service.query({ client: transaction })
      .whereIn('id', ids)
      .whereNull('deleted_at')
      .where('is_active', true)
    const byId = new Map(services.map((service) => [service.id, service]))

    const main = byId.get(selection.main)
    if (!main || main.type !== ServiceType.MAIN || !main.categories.includes(kind)) {
      throw fieldError(field, 'Pilih layanan utama yang tersedia.', 'service.main')
    }

    const addons = [...new Set(selection.addons)].map((id) => byId.get(id))
    if (
      addons.some(
        (addon) => !addon || addon.type !== ServiceType.ADDON || !addon.categories.includes(kind)
      )
    ) {
      throw fieldError(
        field,
        'Layanan tambahan tidak tersedia. Muat ulang halaman.',
        'service.addon'
      )
    }

    return [main, ...(addons as Service[])]
  }
}
