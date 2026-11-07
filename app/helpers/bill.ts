import { ItemKindLabel, OrderSource, ReturnMethod } from '#enums/order_enum'
import { ServiceType } from '#enums/service_enum'
import type Order from '#models/order'

export function billExtras(order: Order) {
  if (order.source === OrderSource.ONLINE) {
    return [{ label: 'Antar-jemput', amount: 0 }]
  }
  return order.returnMethod === ReturnMethod.DELIVERY ? [{ label: 'Pengantaran', amount: 0 }] : []
}

export function billBreakdown(order: Order) {
  const bill = order.bill
  if (!bill) {
    return null
  }
  const items = order.items.map((item) => {
    const lines = bill.lines.filter((line) => line.orderItemId === item.id)
    const main = lines.find((line) => line.service?.type === ServiceType.MAIN) ?? lines[0]
    return {
      name: item.name,
      kind: ItemKindLabel[item.kind],
      note: item.note,
      main: main ? { name: main.name, price: main.price } : null,
      addons: lines
        .filter((line) => line !== main)
        .map((line) => ({ name: line.name, price: line.price })),
      subtotal: lines.reduce((sum, line) => sum + line.price, 0),
    }
  })
  return { items, extras: billExtras(order), total: bill.total }
}

export type BillBreakdown = NonNullable<ReturnType<typeof billBreakdown>>
