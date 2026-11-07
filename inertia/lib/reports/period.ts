import { addDays, dayDiff, formatDayMonth, fromIso, toIso } from '~/lib/shared/date'
import { formatRupiah } from '~/lib/shared/format'

export type Day = {
  date: Date
  revenue: number
  transactions: number
  items: number
  online: number
  storeQris: number
  cash: number
  store: number
  refundDue: number
  mismatch: number
  refunded: number
}

export type PeriodKey = '7' | '30' | 'bulan' | 'custom'

export const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: '7', label: '7 hari' },
  { key: '30', label: '30 hari' },
  { key: 'bulan', label: 'Bulan ini' },
  { key: 'custom', label: 'Pilih tanggal' },
]

export type DayRow = [
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

export type ReportData = { start: string; end: string; days: DayRow[] }

function reportDays(data: ReportData): Day[] {
  return data.days.map(
    ([
      date,
      revenue,
      transactions,
      items,
      online,
      storeQris,
      cash,
      refundDue,
      mismatch,
      refunded,
    ]) => ({
      date: fromIso(date),
      revenue,
      transactions,
      items,
      online,
      storeQris,
      cash,
      store: storeQris + cash,
      refundDue,
      mismatch,
      refunded,
    })
  )
}

export function dataRange(data: ReportData) {
  const start = fromIso(data.start)
  const end = fromIso(data.end)
  return {
    start,
    end,
    minIso: data.start,
    maxIso: data.end,
    text: `Data tersedia ${formatDayMonth(start, true)} – ${formatDayMonth(end, true)}`,
  }
}

type Totals = Omit<Day, 'date'> & { average: number }

function totals(days: Day[]): Totals {
  const sum = (key: keyof Omit<Day, 'date'>) => days.reduce((total, day) => total + day[key], 0)
  const revenue = sum('revenue')
  const transactions = sum('transactions')
  return {
    revenue,
    transactions,
    items: sum('items'),
    online: sum('online'),
    storeQris: sum('storeQris'),
    cash: sum('cash'),
    store: sum('store'),
    refundDue: sum('refundDue'),
    mismatch: sum('mismatch'),
    refunded: sum('refunded'),
    average: transactions ? Math.round(revenue / transactions) : 0,
  }
}

export function reportPeriod(
  data: ReportData,
  key: PeriodKey,
  customFrom?: string,
  customTo?: string
) {
  const DAYS = reportDays(data)
  const { start: DATA_START, end: DATA_END } = dataRange(data)
  const clampDate = (date: Date) =>
    date < DATA_START ? DATA_START : date > DATA_END ? DATA_END : date
  let from = clampDate(addDays(DATA_END, -29))
  let to = DATA_END
  let warning = ''
  if (key === '7') {
    from = clampDate(addDays(DATA_END, -6))
  } else if (key === 'bulan') {
    from = new Date(DATA_END.getFullYear(), DATA_END.getMonth(), 1)
  } else if (key === 'custom') {
    from = clampDate(customFrom ? fromIso(customFrom) : addDays(DATA_END, -13))
    to = clampDate(customTo ? fromIso(customTo) : DATA_END)
    if (from > to) {
      warning = 'Tanggal awal setelah tanggal akhir — urutan ditukar.'
      ;[from, to] = [to, from]
    }
  }
  const length = dayDiff(from, to) + 1
  let compareFrom: Date
  let compareTo: Date
  if (key === 'bulan') {
    compareFrom = new Date(from.getFullYear(), from.getMonth() - 1, 1)
    compareTo = addDays(compareFrom, length - 1)
  } else {
    compareTo = addDays(from, -1)
    compareFrom = addDays(compareTo, -(length - 1))
  }
  const within = (date: Date, start: Date, end: Date) => date >= start && date <= end
  const days = DAYS.filter((day) => within(day.date, from, to))
  const previous = DAYS.filter((day) => within(day.date, compareFrom, compareTo))
  const isSameYear = from.getFullYear() === to.getFullYear()

  return {
    key,
    from,
    to,
    length,
    days,
    current: totals(days),
    previous: totals(previous),
    warning,
    label: `${formatDayMonth(from, !isSameYear)} – ${formatDayMonth(to, true)} · dibanding ${formatDayMonth(compareFrom)} – ${formatDayMonth(compareTo, compareTo.getFullYear() !== to.getFullYear())}`,
    range: `${formatDayMonth(from, true)} – ${formatDayMonth(to, true)}`,
    compareRange: `${formatDayMonth(compareFrom, true)} – ${formatDayMonth(compareTo, true)}`,
    fromIso: toIso(from),
    toIso: toIso(to),
  }
}

export type Delta = { trend: 'up' | 'down' | 'none'; text: string; sub: string }

export function delta(current: number, previous: number, isMoney = false): Delta {
  if (!previous) {
    return { trend: 'none', text: '—', sub: 'tidak ada data pembanding' }
  }
  const change = ((current - previous) / previous) * 100
  const isUp = change >= 0
  return {
    trend: isUp ? 'up' : 'down',
    text: `${isUp ? '+' : '−'}${Math.abs(change).toFixed(1).replace('.', ',')}%`,
    sub: `dari ${isMoney ? formatRupiah(previous) : previous.toLocaleString('id-ID')}`,
  }
}

export function percentChange(current: number, previous: number) {
  return previous ? ((current - previous) / previous) * 100 : null
}

export function paymentMix(current: Totals) {
  const base = current.revenue || 1
  return (
    [
      ['QRIS (online)', 'ONLINE', current.online, false],
      ['QRIS (offline)', 'OFFLINE · TOKO', current.storeQris, true],
      ['Tunai di toko', 'OFFLINE · TOKO', current.cash, true],
    ] as const
  ).map(([label, tag, amount, isInStore]) => {
    const share = Math.round((amount / base) * 100)
    return {
      label,
      tag,
      amount,
      share,
      store: isInStore,
      valueText: `${formatRupiah(amount)} · ${share}%`,
    }
  })
}

export type MixRow = ReturnType<typeof paymentMix>[number]

export function receivedMoney(current: Totals) {
  const total = current.revenue + current.refundDue + current.mismatch + current.refunded
  return {
    rows: [
      { label: 'Lunas (omzet)', hint: 'pembayaran pesanan', amount: current.revenue },
      {
        label: 'Perlu dikembalikan',
        hint: 'QRIS masuk setelah pesanan lunas',
        amount: current.refundDue,
      },
      {
        label: 'Nominal tidak cocok',
        hint: 'belum diputuskan di Rekonsiliasi',
        amount: current.mismatch,
      },
      { label: 'Sudah dikembalikan', hint: 'dana keluar lagi', amount: current.refunded },
    ],
    total,
    net: total - current.refunded,
  }
}

type Money = ReturnType<typeof receivedMoney>

export function moneyRows(current: Money, previous: Money): [string, number, number][] {
  return [
    ...current.rows
      .slice(1)
      .map((row, index): [string, number, number] => [
        row.label,
        row.amount,
        previous.rows[index + 1].amount,
      ]),
    ['Total uang masuk', current.total, previous.total],
    ['Bersih (diterima − dikembalikan)', current.net, previous.net],
  ]
}

export function revenueAxis(days: Day[]) {
  const max = Math.max(1, ...days.map((day) => day.revenue))
  const step = max > 900000 ? 400000 : max > 450000 ? 200000 : 100000
  const top = Math.ceil(max / step) * step
  const label = (value: number) =>
    value >= 1000000
      ? `${(value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
      : value
        ? `${(value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
        : '0'
  const count = days.length
  const xIndexes =
    count <= 5
      ? days.map((_, index) => index)
      : [
          0,
          Math.round((count - 1) / 4),
          Math.round((count - 1) / 2),
          Math.round(((count - 1) * 3) / 4),
          count - 1,
        ]
  return {
    top,
    yTicks: [label(top), label((top * 2) / 3), label(top / 3), '0'],
    xTicks: xIndexes.map((index) => formatDayMonth(days[index].date)),
  }
}

export function detailRows(days: Day[]) {
  const isDaily = days.length <= 13
  const chunks: Day[][] = []
  if (isDaily) {
    for (const day of days) {
      chunks.push([day])
    }
  } else {
    for (let index = 0; index < days.length; index += 7) {
      chunks.push(days.slice(index, index + 7))
    }
    const last = chunks[chunks.length - 1]
    if (chunks.length > 1 && last.length <= 2) {
      chunks.pop()
      chunks[chunks.length - 1] = [...chunks[chunks.length - 1], ...last]
    }
  }
  const rows = chunks.map((group, index) => {
    const first = group[0].date
    const last = group[group.length - 1].date
    const sum = (key: 'transactions' | 'online' | 'store' | 'revenue') =>
      group.reduce((total, day) => total + day[key], 0)
    return {
      id: `r${index}`,
      index,
      label: isDaily
        ? formatDayMonth(first)
        : first.getMonth() === last.getMonth()
          ? `${first.getDate()}–${formatDayMonth(last)}`
          : `${formatDayMonth(first)}–${formatDayMonth(last)}`,
      from: first,
      to: last,
      transactions: sum('transactions'),
      online: sum('online'),
      store: sum('store'),
      revenue: sum('revenue'),
      change: null as number | null,
    }
  })
  for (const [index, row] of rows.entries()) {
    if (index > 0) {
      row.change = percentChange(row.revenue, rows[index - 1].revenue)
    }
  }
  return { isDaily, rows }
}

export function changeText(change: number | null) {
  if (change === null) {
    return '—'
  }
  return `${change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(change))}%`
}
