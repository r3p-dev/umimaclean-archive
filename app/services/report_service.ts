import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { ActivityAction, ActivityActionLabel, ActivityCategoryOf } from '#enums/activity_enum'
import { type CostCategory, CostCategoryLabel } from '#enums/cost_enum'
import { ItemKindLabel, type ItemKind } from '#enums/order_enum'
import { PAYMENT_RECEIVED_STATUSES, PaymentStatus } from '#enums/payment_enum'
import { Role } from '#enums/role_enum'
import { maskPhone } from '#helpers/phone'
import { formatRupiah } from '#helpers/money'
import ActivityLog from '#models/activity_log'
import OperatingCost from '#models/operating_cost'
import Setting from '#models/setting'
import type User from '#models/user'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'

const REPORT_MAX_DAYS = 400

type DayRow = [
  date: string,
  revenue: number,
  transactions: number,
  items: number,
  online: number,
  storeQris: number,
  cash: number,
  refundDue: number,
  mismatch: number,
  refunded: number,
]

type ServiceRow = [date: string, name: string, category: string, items: number, revenue: number]

const LOCAL_DAY = `(p.paid_at at time zone '${SERVICE_ZONE}')::date`

type CustomerRow = {
  id: number
  name: string
  phone: string
  created_at: Date
  last_paid: Date | null
  first_paid: Date | null
  orders: string
  spend: string
  held: string
  address_text: string | null
}

function isoDate(value: Date) {
  return DateTime.fromJSDate(value).setZone(SERVICE_ZONE).toISODate()!
}

const CATEGORY_OF = Object.fromEntries(
  Object.entries(CostCategoryLabel).map(([key, label]) => [label, key])
) as Record<string, CostCategory>

export default class ReportService {
  reportToday() {
    return DateTime.now().setZone(SERVICE_ZONE).startOf('day')
  }

  async reportRange() {
    const today = this.reportToday()
    const earliest = await db
      .from('payments as p')
      .whereIn('p.status', [...PAYMENT_RECEIVED_STATUSES])
      .select(db.raw(`to_char(min(${LOCAL_DAY}), 'YYYY-MM-DD') as day`))
      .first()
    const first = earliest?.day ? DateTime.fromISO(earliest.day, { zone: SERVICE_ZONE }) : today
    const floor = today.minus({ days: REPORT_MAX_DAYS - 1 })
    const start = DateTime.min(first.startOf('day'), today.minus({ days: 29 }))
    return { start: DateTime.max(start, floor), end: today }
  }

  async dailyReport(): Promise<{ start: string; end: string; days: DayRow[] }> {
    const { start, end } = await this.reportRange()
    const result = await db.rawQuery<{ rows: Record<string, string>[] }>(
      `with series as (
        select generate_series(?::date, ?::date, interval '1 day')::date as day
      ), received as (
        select ${LOCAL_DAY} as day, p.amount, p.method, p.channel, p.order_id, p.status
        from payments p where p.status in (?, ?, ?, ?)
      ), paid as (
        select * from received where status = ?
      )
      select to_char(s.day, 'YYYY-MM-DD') as day,
        coalesce(sum(paid.amount), 0) as revenue,
        count(paid.order_id) as transactions,
        coalesce(sum((select count(*) from order_items i where i.order_id = paid.order_id)), 0) as items,
        coalesce(sum(paid.amount) filter (where paid.channel = 'online'), 0) as online,
        coalesce(sum(paid.amount) filter (where paid.channel = 'counter' and paid.method = 'qris'), 0) as store_qris,
        coalesce(sum(paid.amount) filter (where paid.method = 'cash'), 0) as cash,
        (select coalesce(sum(r.amount), 0) from received r where r.day = s.day and r.status = ?) as refund_due,
        (select coalesce(sum(r.amount), 0) from received r where r.day = s.day and r.status = ?) as mismatch,
        (select coalesce(sum(r.amount), 0) from received r where r.day = s.day and r.status = ?) as refunded
      from series s left join paid on paid.day = s.day
      group by s.day order by s.day`,
      [
        start.toISODate(),
        end.toISODate(),
        ...PAYMENT_RECEIVED_STATUSES,
        PaymentStatus.PAID,
        PaymentStatus.REFUND_DUE,
        PaymentStatus.AMOUNT_MISMATCH,
        PaymentStatus.REFUNDED,
      ]
    )
    return {
      start: start.toISODate()!,
      end: end.toISODate()!,
      days: result.rows.map((row) => [
        row.day,
        Number(row.revenue),
        Number(row.transactions),
        Number(row.items),
        Number(row.online),
        Number(row.store_qris),
        Number(row.cash),
        Number(row.refund_due),
        Number(row.mismatch),
        Number(row.refunded),
      ]),
    }
  }

  async serviceReport(start: string): Promise<ServiceRow[]> {
    const result = await db.rawQuery<{ rows: Record<string, string>[] }>(
      `select to_char(${LOCAL_DAY}, 'YYYY-MM-DD') as day, l.name, i.kind,
        count(*) as items, sum(l.price) as revenue
      from payments p
      join bills b on b.order_id = p.order_id
      join bill_lines l on l.bill_id = b.id
      join order_items i on i.id = l.order_item_id
      where p.status = 'paid' and ${LOCAL_DAY} >= ?::date
      group by 1, 2, 3`,
      [start]
    )
    return result.rows.map((row) => [
      row.day,
      row.name,
      ItemKindLabel[row.kind as ItemKind] ?? row.kind,
      Number(row.items),
      Number(row.revenue),
    ])
  }

  async listCosts() {
    const costs = await OperatingCost.query().orderBy('spent_on', 'desc').orderBy('id', 'desc')
    return costs.map((cost) => ({
      id: String(cost.id),
      category: CostCategoryLabel[cost.category],
      note: cost.note,
      amount: cost.amount,
      date: cost.spentOn.toISODate()!,
    }))
  }

  async listActivity(limit?: number) {
    const query = ActivityLog.query()
      .where('created_at', '>=', this.reportToday().minus({ days: 90 }).toJSDate())
      .preload('actor')
      .preload('order')
      .orderBy('id', 'desc')
    if (limit) {
      query.limit(limit)
    }
    const logs = await query
    return logs.map((log) => {
      const local = log.createdAt.setZone(SERVICE_ZONE)
      return {
        id: String(log.id),
        date: local.toISODate()!,
        time: local.toFormat('HH.mm'),
        staff: log.actor?.name ?? 'Sistem',
        action: ActivityActionLabel[log.action],
        category: ActivityCategoryOf[log.action],
        ref: log.order?.number() ?? '—',
        detail: log.detail,
        isSensitive: log.isSensitive,
      }
    })
  }

  async customerOverview() {
    const [customers, inactiveDays] = await Promise.all([
      this.#listCustomers(),
      Setting.get('inactive_days'),
    ])
    return { customers, inactiveDays }
  }

  async #listCustomers() {
    const result = await db.rawQuery<{ rows: CustomerRow[] }>(
      `select u.id, u.name, u.phone, u.created_at,
        max(p.paid_at) as last_paid, min(p.paid_at) as first_paid,
        count(distinct p.order_id) as orders, coalesce(sum(p.amount), 0) as spend,
        (select coalesce(sum(h.amount), 0) from payments h join orders ho on ho.id = h.order_id
          where ho.user_id = u.id and h.status in (?, ?)) as held,
        (select a.address_text from customer_addresses a
          where a.user_id = u.id and a.is_primary limit 1) as address_text
      from users u
      left join orders o on o.user_id = u.id
      left join payments p on p.order_id = o.id and p.status = ?
      where u.role = ?
      group by u.id
      order by last_paid desc nulls last`,
      [PaymentStatus.REFUND_DUE, PaymentStatus.AMOUNT_MISMATCH, PaymentStatus.PAID, Role.CUSTOMER]
    )
    const today = DateTime.now().setZone(SERVICE_ZONE).startOf('day')

    return result.rows.map((row) => {
      const last = row.last_paid ?? row.created_at
      const first = row.first_paid ?? row.created_at
      const parts = (row.address_text ?? '').split(',').map((part) => part.trim())
      return {
        id: String(row.id),
        label: row.name,
        name: row.name,
        phone: maskPhone(row.phone),
        area: parts.length >= 2 ? parts[parts.length - 2] : '—',
        last: isoDate(last),
        first: isoDate(first),
        orders: Number(row.orders),
        spend: Number(row.spend),
        held: Number(row.held),
        days: Math.max(
          0,
          Math.floor(
            today.diff(DateTime.fromJSDate(last).setZone(SERVICE_ZONE).startOf('day'), 'days').days
          )
        ),
        isNew: today.diff(DateTime.fromJSDate(first), 'days').days <= 30,
        hasPaid: row.last_paid !== null,
      }
    })
  }

  findCostById(id: number) {
    return OperatingCost.findOrFail(id)
  }

  async saveCost(
    owner: User,
    input: { category: string; detail: string; amount: number; spentOn: DateTime },
    existing: OperatingCost | null
  ) {
    const cost = existing ?? new OperatingCost()
    const before = existing ? `${cost.note} ${formatRupiah(cost.amount)}` : null
    cost.merge({
      category: CATEGORY_OF[input.category],
      note: input.detail,
      amount: input.amount,
      spentOn: input.spentOn,
    })
    if (!existing) {
      cost.createdBy = owner.id
    }
    await cost.save()
    await ActivityLog.record({
      actor: owner,
      action: ActivityAction.COST_CHANGED,
      detail: before
        ? `${before} → ${cost.note} ${formatRupiah(cost.amount)}`
        : `Menambah biaya ${cost.note} ${formatRupiah(cost.amount)}`,
      isSensitive: !!before,
    })
    return cost
  }

  async removeCost(owner: User, id: number) {
    const cost = await OperatingCost.findOrFail(id)
    await cost.delete()
    await ActivityLog.record({
      actor: owner,
      action: ActivityAction.COST_CHANGED,
      detail: `Menghapus biaya ${cost.note} ${formatRupiah(cost.amount)}`,
      isSensitive: true,
    })
    return cost
  }
}
