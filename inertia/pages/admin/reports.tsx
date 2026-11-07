import { useState } from 'react'
import { Head } from '@inertiajs/react'
import { toast } from 'sonner'
import { formatDate, toIso } from '~/lib/shared/date'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import ExportButton from '~/components/molecules/export_button'
import MetricCard from '~/components/molecules/metric_card'
import TablePagination from '~/components/molecules/table_pagination'
import AdminPageHeader from '~/components/organisms/admin_page_header'
import { BulkBar, CHECK_CELL, SelectAllRow } from '~/components/organisms/data_table/table_parts'
import { CostFormDialog, DeleteCostDialog } from '~/components/organisms/reports/cost_dialogs'
import PaymentMixCard from '~/components/organisms/reports/payment_mix_card'
import PeriodTabs from '~/components/organisms/reports/period_tabs'
import ReceivedMoneyCard from '~/components/organisms/reports/received_money_card'
import AdminLayout from '~/components/templates/admin_layout'
import type { Sheet } from '~/lib/export/xlsx'
import {
  costShare,
  costTotal,
  costsForPeriod,
  deleteCost,
  saveCost,
  type Cost,
} from '~/lib/reports/costs'
import {
  changeText,
  delta,
  detailRows,
  dataRange,
  moneyRows,
  paymentMix,
  receivedMoney,
  reportPeriod,
  type PeriodKey,
  type ReportData,
} from '~/lib/reports/period'
import { useDataTable } from '~/lib/shared/data_table'
import { formatRupiah } from '~/lib/shared/format'
import { cn } from '~/lib/shared/utils'

type DetailRow = ReturnType<typeof detailRows>['rows'][number]

type DialogState =
  | { kind: 'form'; id: string | null; initial: Omit<Cost, 'id'> }
  | { kind: 'delete'; id: string }
  | null

export default function AdminReports({ report, costs }: { report: ReportData; costs: Cost[] }) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30')
  const [customFrom, setCustomFrom] = useState<string>()
  const [customTo, setCustomTo] = useState<string>()
  const [dialog, setDialog] = useState<DialogState>(null)
  const period = reportPeriod(report, periodKey, customFrom, customTo)
  const costList = costsForPeriod(costs, period.to)
  const current = period.current
  const previous = period.previous
  const mix = paymentMix(current)
  const money = receivedMoney(current)
  const previousMoney = receivedMoney(previous)
  const detail = detailRows(period.days)
  const unit = detail.isDaily ? 'hari' : 'minggu'
  const table = useDataTable<DetailRow>(
    detail.rows,
    [{ key: 'index', value: (row) => row.index }],
    { unit, sortKey: 'index' }
  )
  const total = costTotal(costList)
  const cost = costShare(total, period.length)
  const hasCost = costList.length > 0
  const transactionsDelta = delta(current.transactions, previous.transactions)
  const moneySheetRows = moneyRows(money, previousMoney)
  const detailTitle = detail.isDaily ? 'Rincian per hari' : 'Rincian per minggu'

  const detailSheet = (rows: DetailRow[]): Sheet => ({
    name: detailTitle,
    columns: [
      { label: detail.isDaily ? 'Tanggal' : 'Minggu', width: 18 },
      { label: 'Dari', type: 'date', width: 12 },
      { label: 'Sampai', type: 'date', width: 12 },
      { label: 'Transaksi', type: 'int', width: 11 },
      { label: 'Online', type: 'rp', width: 14 },
      { label: 'Toko', type: 'rp', width: 14 },
      { label: 'Omzet', type: 'rp', width: 14 },
      { label: 'Δ vs sebelumnya (%)', type: 'pct', width: 18 },
    ],
    rows: rows.map((row) => [
      row.label,
      row.from,
      row.to,
      row.transactions,
      row.online,
      row.store,
      row.revenue,
      row.change === null ? null : Math.round(row.change * 10) / 10,
    ]),
  })

  function changePeriod(key: PeriodKey) {
    if (key === 'custom') {
      setCustomFrom((value) => value ?? period.fromIso)
      setCustomTo((value) => value ?? period.toIso)
    }
    setPeriodKey(key)
    table.resetPage()
  }

  const detailExport = (size: 'desktop' | 'compact') => (
    <ExportButton
      size={size}
      selectedCount={table.selectedCount}
      ariaLabel={`Unduh Excel — ${table.selectedCount ? `${table.selectedCount} baris rincian terpilih` : `semua rincian ${period.range}`}`}
      build={() => {
        const rows = table.selectedCount ? table.selectedRows : table.sorted
        return {
          name: 'laporan-rincian',
          title: `Rincian ${period.range}`,
          unit,
          count: rows.length,
          sheets: [detailSheet(rows)],
        }
      }}
    />
  )

  const deleting = dialog?.kind === 'delete' ? costList.find((item) => item.id === dialog.id) : null

  return (
    <AdminLayout active="laporan" title="Laporan">
      <Head title="Laporan" />
      <AdminPageHeader
        title="Laporan"
        actions={
          <ExportButton
            ariaLabel={`Unduh Excel — laporan lengkap ${period.range}`}
            build={() => ({
              name: 'laporan',
              title: `Laporan Umima ${period.range}`,
              unit,
              count: detail.rows.length,
              sheets: [
                {
                  name: 'Ringkasan',
                  columns: [
                    { label: 'Metrik', width: 30 },
                    { label: `Periode ${period.range}`, type: 'rp', width: 26 },
                    { label: `Pembanding ${period.compareRange}`, type: 'rp', width: 26 },
                  ],
                  rows: [
                    ['Omzet (pendapatan kotor)', current.revenue, previous.revenue],
                    ['Rata-rata per pesanan', current.average, previous.average],
                    [`Biaya operasional (porsi ${cost.share}/30 hari)`, cost.amount, null],
                    ['Laba bersih', hasCost ? current.revenue - cost.amount : null, null],
                    ...moneySheetRows,
                  ],
                },
                {
                  name: 'Per metode',
                  columns: [
                    { label: 'Metode', width: 18 },
                    { label: 'Asal', width: 16 },
                    { label: 'Jumlah', type: 'rp', width: 14 },
                    { label: 'Porsi (%)', type: 'int', width: 10 },
                  ],
                  rows: mix.map((row) => [row.label, row.tag, row.amount, row.share]),
                },
                detailSheet(detail.rows),
                {
                  name: 'Biaya operasional',
                  columns: [
                    { label: 'Kategori', width: 14 },
                    { label: 'Keterangan', width: 30 },
                    { label: 'Tanggal', width: 10 },
                    { label: 'Jumlah', type: 'rp', width: 14 },
                  ],
                  rows: costList.map((item) => [
                    item.category,
                    item.note,
                    formatDate(item.date, 'full'),
                    item.amount,
                  ]),
                },
              ],
            })}
          />
        }
      />
      <p role="status" className="-mt-2 text-sm leading-[1.4] text-foreground-secondary">
        {period.label}
      </p>
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
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
          {hasCost ? (
            <MetricCard
              label="Laba bersih"
              value={formatRupiah(current.revenue - cost.amount)}
              note={`Omzet − biaya ${formatRupiah(cost.amount)}${cost.share < 30 ? ` (porsi ${cost.share} dari 30 hari)` : ''}`}
            />
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border-[1.5px] border-dashed border-border-strong bg-background px-4.5 py-4">
              <span className="text-meta leading-[1.3] font-semibold text-foreground-secondary">
                Laba bersih
              </span>
              <span className="text-[17px] leading-[1.2] font-bold">Belum bisa dihitung</span>
              <span className="text-caption leading-[1.4] text-foreground-secondary">
                Belum ada biaya operasional. Omzet bukan laba.
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <PaymentMixCard mix={mix} />
            <ReceivedMoneyCard money={money} />
            <Card>
              <CardHeader className="border-b">
                <CardTitle as="h2">{detailTitle}</CardTitle>
                <CardAction>{detailExport('desktop')}</CardAction>
              </CardHeader>
              <CardContent data-bleed>
                {table.selectedCount > 0 && (
                  <BulkBar
                    label="Aksi untuk baris terpilih"
                    count={table.selectedCount}
                    total={table.total}
                    canSelectAll={table.canSelectAll}
                    onSelectAll={table.selectAll}
                    onClear={table.clear}
                  >
                    {detailExport('compact')}
                  </BulkBar>
                )}
                {table.total > 0 && (
                  <SelectAllRow state={table.allState} onToggle={table.toggleAll} />
                )}
                <Table className="max-sm:hidden">
                  <TableHeader>
                    <tr>
                      <TableHead className={CHECK_CELL}>
                        <Checkbox
                          isSelected={table.allState === true}
                          isIndeterminate={table.allState === 'indeterminate'}
                          onChange={table.toggleAll}
                          aria-label="Pilih semua baris di halaman ini"
                        />
                      </TableHead>
                      <TableHead>{detail.isDaily ? 'Tanggal' : 'Minggu'}</TableHead>
                      <TableHead className="text-right">Transaksi</TableHead>
                      <TableHead className="text-right">Online</TableHead>
                      <TableHead className="text-right">Toko</TableHead>
                      <TableHead className="text-right">Omzet</TableHead>
                      <TableHead className="pr-4.5 text-right">Δ</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {table.rows.map((row) => {
                      const isSelected = table.isSelected(row.id)
                      return (
                        <TableRow key={row.id} data-selected={isSelected}>
                          <TableCell className={CHECK_CELL}>
                            <Checkbox
                              isSelected={isSelected}
                              onChange={() => table.toggle(row.id)}
                              aria-label={`Pilih ${row.label}`}
                            />
                          </TableCell>
                          <TableCell className="py-2 font-semibold whitespace-nowrap">
                            {row.label}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">
                            {row.transactions}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">
                            {formatRupiah(row.online)}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">
                            {formatRupiah(row.store)}
                          </TableCell>
                          <TableCell className="py-2 text-right font-semibold tabular-nums">
                            {formatRupiah(row.revenue)}
                          </TableCell>
                          <TableCell className="py-2 text-right whitespace-nowrap text-foreground-secondary">
                            {changeText(row.change)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <ul className="sm:hidden">
                  {table.rows.map((row) => {
                    const isSelected = table.isSelected(row.id)
                    return (
                      <li
                        key={row.id}
                        data-selected={isSelected}
                        className={cn(
                          'flex items-center gap-0.5 border-t border-border py-1 pr-(--card-spacing) pl-2',
                          isSelected && 'bg-row-selected'
                        )}
                      >
                        <Checkbox
                          isSelected={isSelected}
                          onChange={() => table.toggle(row.id)}
                          aria-label={`Pilih ${row.label}`}
                        />
                        <div className="min-w-0 flex-1 py-2.5">
                          <div className="flex justify-between gap-2 text-[14.5px] leading-[1.3] font-semibold">
                            <span>{row.label}</span>
                            <span>{formatRupiah(row.revenue)}</span>
                          </div>
                          <p className="text-meta leading-[1.4] text-foreground-secondary">
                            {row.transactions} transaksi · online {formatRupiah(row.online)} · toko{' '}
                            {formatRupiah(row.store)} · {changeText(row.change)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <TablePagination
                  rangeText={table.rangeText}
                  page={table.page}
                  pages={table.pages}
                  pageNumbers={table.pageNumbers}
                  size={table.size}
                  onPage={table.setPage}
                  onSize={table.setSize}
                />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="border-b">
              <CardTitle as="h2">Biaya operasional · Okt 2026</CardTitle>
              <CardAction>
                <Button
                  size="desktop"
                  className="gap-1.5"
                  onPress={() =>
                    setDialog({
                      kind: 'form',
                      id: null,
                      initial: {
                        category: 'Listrik & air',
                        amount: 0,
                        note: '',
                        date: toIso(new Date()),
                      },
                    })
                  }
                >
                  <IconPlus className="size-4.5" />
                  Tambah biaya
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {costList.length ? (
                <ul className="divide-y divide-border">
                  {costList.map((item) => (
                    <li
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.category}</p>
                        <p className="text-caption text-muted-foreground">
                          {item.note} · {formatDate(item.date, 'full')}
                        </p>
                      </div>
                      <span className="text-sm leading-none font-semibold tabular-nums">
                        {formatRupiah(item.amount)}
                      </span>
                      <span className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Ubah biaya ${item.note}`}
                          onPress={() =>
                            setDialog({
                              kind: 'form',
                              id: item.id,
                              initial: {
                                category: item.category,
                                amount: item.amount,
                                note: item.note,
                                date: item.date,
                              },
                            })
                          }
                        >
                          <IconPencil className="size-4.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Hapus biaya ${item.note}`}
                          onPress={() => setDialog({ kind: 'delete', id: item.id })}
                          className="text-destructive-text"
                        >
                          <IconTrash className="size-4.5" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md bg-background p-4 text-center text-note text-foreground-secondary">
                  Belum ada biaya bulan ini. Tambahkan sewa, gaji, bahan, dan listrik agar laba bisa
                  dihitung.
                </p>
              )}
              <div className="flex justify-between border-t border-input pt-3 text-md font-bold">
                <span>Total biaya</span>
                <span>{formatRupiah(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {dialog?.kind === 'form' && (
        <CostFormDialog
          isOpen
          onOpenChange={(isOpen) => !isOpen && setDialog(null)}
          initial={dialog.initial}
          isEditing={dialog.id !== null}
          onSave={(item) => {
            saveCost(item, dialog.id, {
              onSuccess: () => setDialog(null),
              onError: (errors) =>
                toast.error(Object.values(errors)[0] ?? 'Periksa kembali isian biaya.'),
            })
          }}
        />
      )}
      <DeleteCostDialog
        isOpen={dialog?.kind === 'delete'}
        onOpenChange={(isOpen) => !isOpen && setDialog(null)}
        name={deleting?.note ?? ''}
        onDelete={() => {
          if (deleting) {
            deleteCost(deleting.id, { onSuccess: () => setDialog(null) })
          }
        }}
      />
    </AdminLayout>
  )
}
