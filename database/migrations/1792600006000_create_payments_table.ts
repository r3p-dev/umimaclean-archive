/*
 * payments: every payment attempt for an order, QRIS (Midtrans) or at the counter.
 *
 * An order can have several rows (an expired QR code, then a new one); at most one ends
 * up 'paid', guaranteed by a partial unique index.
 * - channel: where the payment was started, online or counter (PaymentChannel enum).
 * - method: qris or cash (PaymentMethod enum).
 * - status: pending, paid, expired, failed or cancelled (PaymentStatus enum).
 * - amount: what was charged, copied from the bill; the owner can correct it later.
 * - cash_received: cash handed over, to print the change on the receipt.
 * - provider_order_id: the id sent to Midtrans; unique so a webhook finds exactly one row.
 * - provider_transaction_id, qr_url, expires_at: Midtrans transaction, QR image and expiry.
 * - recorded_by: the staff member or owner who recorded a counter payment.
 * - note: why the owner corrected the payment, or a mismatch warning.
 *
 * Indexes: status (reconciliation list), paid_at (revenue reports by day),
 * (order_id, status) (find the paid or pending payment of one order).
 * Partial unique index payments_order_id_paid_unique on order_id where status = 'paid':
 * a second paid row for the same order is rejected by the database.
 */
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('order_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('orders')
        .onDelete('CASCADE')
      table.string('channel').notNullable()
      table.string('method').notNullable()
      table.string('status').notNullable().index()
      table.integer('amount').notNullable()
      table.integer('cash_received').nullable()
      table.string('provider_order_id', 60).nullable().unique()
      table.string('provider_transaction_id', 80).nullable()
      table.text('qr_url').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamp('paid_at').nullable().index()
      table
        .integer('recorded_by')
        .nullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('note', 200).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.index(['order_id', 'status'])
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX payments_order_id_paid_unique
      ON ${this.tableName} (order_id)
      WHERE status = 'paid'
    `)
  }

  override async down() {
    this.schema.dropTable(this.tableName)
  }
}
