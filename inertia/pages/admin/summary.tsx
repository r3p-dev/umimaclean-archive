import { useState } from 'react'
import { Head } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { IconChevronRight } from '@tabler/icons-react'
import { urlFor } from '~/client'
import { LinkButton } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import ExportButton from '~/components/molecules/export_button'
import MetricCard from '~/components/molecules/metric_card'
import AdminPageHeader from '~/components/organisms/admin_page_header'
import PeriodTabs from '~/components/organisms/reports/period_tabs'
import ReceivedMoneyCard from '~/components/organisms/reports/received_money_card'
import RevenueChart from '~/components/organisms/reports/revenue_chart'
import TopServices from '~/components/organisms/reports/top_services'
import AdminLayout from '~/components/templates/admin_layout'
import type { ActivityRow } from '~/lib/activity/log'
import type { Sheet } from '~/lib/export/xlsx'
import { costShare, costTotal, costsForPeriod, type Cost } from '~/lib/reports/costs'
import {
  delta,
  moneyRows,
  paymentMix,
  receivedMoney,
  percentChange,
  dataRange,
  reportPeriod,
  type PeriodKey,
  type ReportData,
} from '~/lib/reports/period'
import {
  topServices,
  type ServiceDayRow,
  type ServiceRank,
  type ServiceRow,
} from '~/lib/reports/services'
import { useDataTable } from '~/lib/shared/data_table'
import { isWeekend } from '~/lib/shared/date'
import { formatRupiah } from '~/lib/shared/format'

export default function AdminSummary({
  report,
  services: serviceDays,
  costs,
  inactiveDays,
  inactiveCount,
  recent,
}: {
  report: ReportData
  services: ServiceDayRow[]
  costs: Cost[]
  inactiveDays: number
  inactiveCount: number
  recent: ActivityRow[]
}) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30')
  const [customFrom, setCustomFrom] = useState<string>()
  const [customTo, setCustomTo] = useState<string>()
  const [rank, setRank] = useState<ServiceRank>('items')
  const period = reportPeriod(report, periodKey, customFrom, customTo)
  const costList = costsForPeriod(costs, period.to)
  const current = period.current
  const previous = period.previous
  const mix = paymentMix(current)
  const money = receivedMoney(current)
  const previousMoney = receivedMoney(previous)
  const services = topServices(serviceDays, period.from, period.to, rank)
  const table = useDataTable(
    services.rows,
    [
      { key: 'items', value: (row) => row.items, direction: 'desc' },
      { key: 'revenue', value: (row) => row.revenue, direction: 'desc' },
    ],
    { unit: 'layanan', sortKey: rank, sortDirection: 'desc' }
  )
  const cost = costShare(costTotal(costList), period.length)
  const transactionsDelta = delta(current.transactions, previous.transactions)

  const serviceSheet = (list: ServiceRow[]): Sheet => ({
    name: 'Layanan terpopuler',
    columns: [
      { label: 'Layanan', width: 26 },
      { label: 'Kategori', width: 12 },
      { label: 'Barang', type: 'int', width: 10 },
      { label: 'Porsi barang (%)', type: 'int', width: 16 },
      { label: 'Omzet', type: 'rp', width: 14 },
    ],
    rows: list.map((row) => [row.name, row.category, row.items, row.share, row.revenue]),
  })

  function changePeriod(key: PeriodKey) {
    if (key === 'custom') {
      setCustomFrom((value) => value ?? period.fromIso)
      setCustomTo((value) => value ?? period.toIso)
    }
    setPeriodKey(key)
    table.resetPage()
  }

  return (
    <AdminLayout active="ringkasan" title="Ringkasan">
      <Head title="Ringkasan" />
      <AdminPageHeader
        title="Ringkasan"
        status={period.label}
        actions={
          <ExportButton
            ariaLabel={`Unduh Excel — ringkasan ${period.range}`}
            build={() => ({
              name: 'ringkasan',
              title: `Ringkasan Umima ${period.range}`,
              unit: 'hari',
              count: period.days.length,
              sheets: [
                {
                  name: 'Ringkasan',
                  columns: [
                    { label: 'Metrik', width: 26 },
                    { label: `Periode ${period.range}`, type: 'rp', width: 26 },
                    { label: `Pembanding ${period.compareRange}`, type: 'rp', width: 26 },
                    { label: 'Perubahan (%)', type: 'pct', width: 14 },
                  ],
                  rows: [
                    [
                      'Omzet (pendapatan kotor)',
                      current.revenue,
                      previous.revenue,
                      percentChange(current.revenue, previous.revenue),
                    ],
                    [
                      'Rata-rata per pesanan',
                      current.average,
                      previous.average,
                      percentChange(current.average, previous.average),
                    ],
                    ...moneyRows(money, previousMoney).map(([label, now, before]) => [
                      label,
                      now,
                      before,
                      percentChange(now, before),
                    ]),
                  ],
                },
                {
                  name: 'Volume',
                  columns: [
                    { label: 'Metrik', width: 26 },
                    { label: `Periode ${period.range}`, type: 'int', width: 26 },
                    { label: `Pembanding ${period.compareRange}`, type: 'int', width: 26 },
                  ],
                  rows: [
                    ['Transaksi lunas', current.transactions, previous.transactions],
                    ['Barang dicuci', current.items, previous.items],
                  ],
                },
                {
                  name: 'Omzet harian',
                  columns: [
                    { label: 'Tanggal', type: 'date', width: 13 },
                    { label: 'Omzet', type: 'rp', width: 14 },
                    { label: 'Transaksi', type: 'int', width: 11 },
                    { label: 'Barang', type: 'int', width: 9 },
                    { label: 'Online (QRIS)', type: 'rp', width: 14 },
                    { label: 'Toko', type: 'rp', width: 13 },
                    { label: 'Hari', width: 12 },
                  ],
                  rows: period.days.map((day) => [
                    day.date,
                    day.revenue,
                    day.transactions,
                    day.items,
                    day.online,
                    day.store,
                    isWeekend(day.date) ? 'Akhir pekan' : 'Hari kerja',
                  ]),
                },
                {
                  name: 'Metode pembayaran',
                  columns: [
                    { label: 'Metode', width: 18 },
                    { label: 'Asal', width: 16 },
                    { label: 'Jumlah', type: 'rp', width: 14 },
                    { label: 'Porsi (%)', type: 'int', width: 10 },
                  ],
                  rows: mix.map((row) => [row.label, row.tag, row.amount, row.share]),
                },
                serviceSheet(table.sorted),
              ],
            })}
          />
        }
      />
      <PeriodTabs
        value={periodKey}
        onChange={changePeriod}
        from={customFrom ?? period.fromIso}
        to={customTo ?? period.toIso}
        onFrom={setCustomFrom}
        onTo={setCustomTo}
        warning={period.warning}
        range={dataRange(report)}
      />
      <div
        id="period-panel"
        role="tabpanel"
        aria-labelledby={`per-${periodKey}`}
        className="flex min-w-0 flex-col gap-4.5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Omzet (pendapatan kotor)"
            value={formatRupiah(current.revenue)}
            delta={delta(current.revenue, previous.revenue, true)}
          />
          <MetricCard
            label="Transaksi lunas"
            value={current.transactions.toLocaleString('id-ID')}
            delta={{
              ...transactionsDelta,
              sub: `dari ${previous.transactions} · ${current.items} barang`,
            }}
          />
          <MetricCard
            label="Rata-rata per pesanan"
            value={formatRupiah(current.average)}
            delta={delta(current.average, previous.average, true)}
          />
          {costList.length ? (
            <MetricCard
              label="Laba bersih"
              value={formatRupiah(current.revenue - cost.amount)}
              note={`Omzet − biaya operasional ${formatRupiah(cost.amount)}`}
            />
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-border-strong px-4.5 py-4">
              <span className="text-meta leading-[1.3] font-semibold text-foreground-secondary">
                Laba bersih
              </span>
              <span className="text-[15px] leading-[1.35] font-semibold">Belum bisa dihitung</span>
              <span className="text-meta leading-[1.4] text-muted-foreground">
                Belum ada data biaya operasional. Omzet bukan laba.
              </span>
              <LinkButton
                variant="link"
                className="self-start py-1.5 text-[13.5px]"
                href={urlFor('admin.reports')}
              >
                Catat biaya →
              </LinkButton>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <RevenueChart
            days={period.days}
            mix={mix}
            label={`Grafik omzet harian ${period.range}, total ${formatRupiah(current.revenue)}`}
          />
          <div className="flex min-w-0 flex-col gap-4 sm:max-lg:grid sm:max-lg:grid-cols-2 sm:max-lg:items-start">
            <Link
              href={urlFor('admin.customers')}
              className="box-content flex min-h-11 flex-col gap-2 rounded-lg border border-border bg-card px-4.5 py-4 text-foreground no-underline hover:border-primary hover:bg-accent hover:text-foreground hover:no-underline"
            >
              <span className="flex items-center justify-between">
                <span className="text-[15px] leading-none font-semibold">
                  Pelanggan tidak aktif
                </span>
                <IconChevronRight className="size-5 text-muted-foreground" />
              </span>
              <span className="text-[26px] leading-[1.1] font-bold">{inactiveCount}</span>
              <span className="text-meta leading-[1.45] text-foreground-secondary">
                Tidak ada transaksi lunas ≥{' '}
                <strong className="font-semibold text-foreground">{inactiveDays} hari</strong>.
                Definisi bisa diubah.
              </span>
            </Link>
            <Card>
              <CardHeader className="border-b">
                <CardTitle as="h2">Aktivitas staf terbaru</CardTitle>
                <CardAction>
                  <LinkButton variant="link" href={urlFor('admin.activity')}>
                    Lihat semua
                  </LinkButton>
                </CardAction>
              </CardHeader>
              <CardContent>
                {' '}
                <ul className="divide-y divide-border">
                  {recent.length === 0 && (
                    <li className="text-meta text-muted-foreground">
                      Belum ada aktivitas tercatat.
                    </li>
                  )}
                  {recent.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-[13.5px] leading-[1.35] font-medium">
                        <strong className="font-semibold">{item.staff.split(' ')[0]}</strong>{' '}
                        {item.action.toLowerCase()}
                        {item.detail ? ` · ${item.detail}` : ''}
                      </span>
                      <span className="font-mono text-xs leading-[1.35] font-medium text-muted-foreground">
                        {item.time}
                      </span>
                      <span className="font-mono text-caption leading-[1.3] text-muted-foreground">
                        {item.ref}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <ReceivedMoneyCard money={money} />
          </div>
        </div>
        <TopServices
          table={table}
          rank={rank}
          onRank={(next, shouldToggle) => {
            if (shouldToggle) {
              table.sortBy(next)
            } else {
              setRank(next)
              table.setSort({ key: next, direction: 'desc' })
            }
          }}
          footer={`${table.total} dari ${services.total} layanan · diurutkan menurut ${rank === 'revenue' ? 'omzet' : 'jumlah barang'} · ${period.range}`}
          exportButton={
            <ExportButton
              size="compact"
              selectedCount={table.selectedCount}
              ariaLabel={`Unduh Excel — ${table.selectedCount ? `${table.selectedCount} layanan terpilih` : `${table.total} layanan`}`}
              build={() => {
                const list = table.selectedCount ? table.selectedRows : table.sorted
                return {
                  name: 'layanan-terpopuler',
                  title: `Layanan terpopuler ${period.range}`,
                  unit: 'layanan',
                  count: list.length,
                  sheets: [serviceSheet(list)],
                }
              }}
            />
          }
        />
      </div>
    </AdminLayout>
  )
}
