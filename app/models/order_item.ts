import { hasMany } from '@adonisjs/lucid/orm'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import { OrderItemSchema } from '#database/schema'
import BillLine from '#models/bill_line'

export default class OrderItem extends OrderItemSchema {
  @hasMany(() => BillLine)
  declare lines: HasMany<typeof BillLine>

  static async markWashed(orderId: number, transaction: TransactionClientContract) {
    await OrderItem.query({ client: transaction })
      .where('order_id', orderId)
      .whereNull('washed_at')
      .update({ washed_at: DateTime.now().toJSDate() })
  }
}
