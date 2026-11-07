import { BaseTransformer } from '@adonisjs/core/transformers'
import { ItemKind, ItemKindLabel, OrderSource, OrderStatus, PhotoKind } from '#enums/order_enum'
import { ServiceType } from '#enums/service_enum'
import type Order from '#models/order'
import { billBreakdown, billExtras } from '#helpers/bill'
import { maskPhone } from '#helpers/phone'
import { formatEvent, orderStatusLabel, photoUrl } from '#transformers/order_transformer'
import { countLines, shortName } from '#transformers/task_transformer'

const KIND_COUNTS: [ItemKind, 'itemsSepatu' | 'itemsTas' | 'itemsHelm'][] = [
  [ItemKind.SHOE, 'itemsSepatu'],
  [ItemKind.BAG, 'itemsTas'],
  [ItemKind.HELMET, 'itemsHelm'],
]

export default class InspectionTransformer extends BaseTransformer<Order> {
  toObject() {
    const order = this.resource
    const received = order.events.find(
      (event) =>
        event.status === OrderStatus.PICKED_UP || event.status === OrderStatus.IN_INSPECTION
    )
    const pickupPhoto = order.photos
      .filter((photo) => photo.kind === PhotoKind.PICKUP || photo.kind === PhotoKind.INTAKE)
      .at(-1)
    const isSaved =
      order.status !== OrderStatus.IN_INSPECTION && order.status !== OrderStatus.PICKED_UP

    const items = order.items.length
      ? order.items.map((item) => {
          const lines = order.bill?.lines.filter((line) => line.orderItemId === item.id) ?? []
          return {
            id: String(item.position),
            kind: item.kind,
            category: ItemKindLabel[item.kind],
            name: item.name,
            note: item.note,
            selection: {
              main:
                lines.find((line) => line.service?.type === ServiceType.MAIN)?.serviceId ?? null,
              addons: lines
                .filter((line) => line.service?.type === ServiceType.ADDON)
                .map((line) => line.serviceId)
                .filter((id): id is number => id !== null),
            },
          }
        })
      : KIND_COUNTS.flatMap(([kind, key]) =>
          Array.from({ length: order[key] }, (_, index) => ({
            id: `${kind}-${index + 1}`,
            kind,
            category: ItemKindLabel[kind],
            name: order[key] > 1 ? `${ItemKindLabel[kind]} ${index + 1}` : ItemKindLabel[kind],
            note: '',
            selection: { main: null as number | null, addons: [] as number[] },
          }))
        )

    const by = received?.actor
      ? ` · ${order.source === OrderSource.STORE ? 'diterima' : 'dijemput'} ${received.actor.firstName()}`
      : ''

    return {
      id: order.id,
      number: order.number(),
      customer: shortName(order.customerName),
      customerFull: order.customerName,
      phone: order.customerPhone ? maskPhone(order.customerPhone) : '—',
      source: order.source === OrderSource.STORE ? ('toko' as const) : ('online' as const),
      status: orderStatusLabel(order.status),
      received: received ? `${formatEvent(received.createdAt)}${by}` : formatEvent(order.createdAt),
      estimate: countLines(order).join(', '),
      itemCount: order.itemCount(),
      customerNote: order.note || null,
      canAddHelmet: order.canHoldItem(ItemKind.HELMET),
      isSaved,
      total: order.bill?.total ?? 0,
      bill: isSaved ? billBreakdown(order) : null,
      extras: billExtras(order),
      pickupPhoto: pickupPhoto ? photoUrl(pickupPhoto) : null,
      items,
    }
  }
}
