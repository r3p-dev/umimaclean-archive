/*
 * settings: store settings the owner edits, one JSON value per key.
 *
 * Keys: store (name, WhatsApp, address, hours), pickup_slots (label, capacity, on),
 * payment_methods (qris, cash) and inactive_days. A key/value table because each
 * setting is a small object read whole; a missing key falls back to the default in code.
 */
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'settings'

  override async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('key', 40).primary()
      table.jsonb('value').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  override async down() {
    this.schema.dropTable(this.tableName)
  }
}
