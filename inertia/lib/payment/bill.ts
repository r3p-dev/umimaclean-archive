import type { Data } from '@generated/data'

export type Bill = NonNullable<Data.Order['bill']>

export type BillItem = Bill['items'][number]

export type BillExtra = Bill['extras'][number]

export function billTotal(bill: Bill) {
  return bill.total
}
