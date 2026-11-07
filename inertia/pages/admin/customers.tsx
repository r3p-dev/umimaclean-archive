import { useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { IconListCheck } from '@tabler/icons-react'
import { Checkbox } from '~/components/ui/checkbox'
import { Card, CardContent } from '~/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import ExportButton from '~/components/molecules/export_button'
import { SelectMenu } from '~/components/molecules/filter_menu'
import SearchField from '~/components/molecules/search_field'
import SortHeader from '~/components/molecules/sort_header'
import TabList from '~/components/molecules/tab_list'
import TablePagination from '~/components/molecules/table_pagination'
import AdminPageHeader from '~/components/organisms/admin_page_header'
import {
  BulkBar,
  CHECK_CELL,
  FilterSummary,
  MobileSort,
  SelectAllRow,
  TABLE_HEAD_ROW,
  TableEmpty,
} from '~/components/organisms/data_table/table_parts'
import AdminLayout from '~/components/templates/admin_layout'
import {
  customersOf,
  SEGMENT_TABS,
  THRESHOLDS,
  inSegment,
  type CustomerRow,
  segmentLabel,
  type Customer,
  type Segment,
} from '~/lib/customers/segments'
import { useDataTable, type SortDirection } from '~/lib/shared/data_table'
import { formatDayMonth } from '~/lib/shared/date'
import { formatRupiah } from '~/lib/shared/format'
import { cn } from '~/lib/shared/utils'

const SORT_OPTIONS = [
  { value: 'spend:desc', label: 'Total belanja · tertinggi' },
  { value: 'days:desc', label: 'Paling lama tidak aktif' },
  { value: 'last:desc', label: 'Transaksi terakhir · terbaru' },
  { value: 'name:asc', label: 'Nama · A–Z' },
  { value: 'orders:desc', label: 'Total pesanan · terbanyak' },
]

export default function AdminCustomers({
  customers,
  inactiveDays,
}: {
  customers: CustomerRow[]
  inactiveDays: number
}) {
  const CUSTOMERS = useMemo(() => customersOf(customers), [customers])
  const [segment, setSegment] = useState<Segment>('inactive')
  const [threshold, setThreshold] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const days = threshold ?? inactiveDays
  const search = query.trim().toLowerCase()
  const rows = CUSTOMERS.filter(
    (customer) =>
      inSegment(customer, segment, days) &&
      (!search ||
        `${customer.name} ${customer.area} ${customer.phone}`.toLowerCase().includes(search))
  )
  const table = useDataTable<Customer>(
    rows,
    [
      { key: 'name', value: (row) => row.name },
      { key: 'area', value: (row) => row.area },
      { key: 'last', value: (row) => row.last.getTime(), direction: 'desc' },
      { key: 'days', value: (row) => row.days, direction: 'desc' },
      { key: 'orders', value: (row) => row.orders, direction: 'desc' },
      { key: 'spend', value: (row) => row.spend, direction: 'desc' },
    ],
    { unit: 'pelanggan', sortKey: 'spend', sortDirection: 'desc' }
  )
  const tabName = SEGMENT_TABS.find((tab) => tab.key === segment)?.label ?? ''

  function changeFilter(change: () => void) {
    change()
    table.resetPage()
  }

  const exportButton = (size: 'desktop' | 'compact') => (
    <ExportButton
      size={size}
      selectedCount={table.selectedCount}
      ariaLabel={`Unduh Excel — ${table.selectedCount ? `${table.selectedCount} pelanggan terpilih` : `${table.total} pelanggan di tab ini`}`}
      build={() => {
        const list = table.selectedCount ? table.selectedRows : table.sorted
        return {
          name: 'pelanggan',
          title: 'Pelanggan Umima',
          unit: 'pelanggan',
          count: list.length,
          sheets: [
            {
              name: 'Pelanggan',
              columns: [
                { label: 'Pelanggan', width: 22 },
                { label: 'No. HP', width: 16 },
                { label: 'Area', width: 14 },
                { label: 'Transaksi pertama', type: 'date', width: 16 },
                { label: 'Transaksi terakhir', type: 'date', width: 16 },
                { label: 'Hari tidak aktif', type: 'int', width: 14 },
                { label: 'Total pesanan', type: 'int', width: 13 },
                { label: 'Total belanja', type: 'rp', width: 14 },
                { label: 'Dana perlu dicek', type: 'rp', width: 16 },
                { label: 'Segmen', width: 22 },
              ],
              rows: list.map((row) => [
                row.name,
                row.phone,
                row.area,
                row.first,
                row.last,
                row.days,
                row.orders,
                row.spend,
                row.held,
                segmentLabel(row, days),
              ]),
            },
          ],
        }
      }}
    />
  )

  const headers: [string, string, 'left' | 'right', string?][] = [
    ['name', 'Pelanggan', 'left'],
    ['area', 'Area', 'left', 'max-lg:hidden'],
    ['last', 'Transaksi terakhir', 'left'],
    ['days', 'Tidak aktif', 'right'],
    ['orders', 'Total pesanan', 'right', 'max-lg:hidden'],
    ['spend', 'Total belanja', 'right'],
  ]

  return (
    <AdminLayout active="pelanggan" title="Pelanggan">
      <Head title="Pelanggan" />
      <AdminPageHeader title="Pelanggan" actions={exportButton('desktop')} />
      <TabList
        label="Segmen pelanggan"
        idPrefix="tab"
        panelId="cust-panel"
        value={segment}
        onChange={(value) => changeFilter(() => setSegment(value))}
        tabs={SEGMENT_TABS.map((tab) => ({
          value: tab.key,
          label: `${tab.label} · ${CUSTOMERS.filter((customer) => inSegment(customer, tab.key, days)).length}`,
        }))}
      />
      {segment !== 'new' && (
        <Card size="sm">
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <IconListCheck className="size-5 text-info-foreground" />
              <p className="flex-[1_1_260px]">
                <strong className="font-semibold">Definisi:</strong> pelanggan dianggap tidak aktif
                jika tidak ada transaksi lunas selama{' '}
                <strong className="font-semibold">{days} hari</strong> atau lebih (dihitung sampai 8
                Okt 2026).
              </p>
              <SelectMenu
                word="Batas"
                label="Batas hari tidak aktif"
                value={days}
                onChange={(value) => changeFilter(() => setThreshold(value))}
                options={THRESHOLDS.map((value) => ({ value, label: `${value} hari` }))}
              />
              <span className="text-caption text-muted-foreground">
                Bawaan diatur di Pengaturan
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchField
          label="Cari nama, area, atau nomor HP"
          placeholder="Cari nama / area / no. HP"
          value={query}
          onChange={(value) => changeFilter(() => setQuery(value))}
        />
      </div>
      {search && (
        <FilterSummary
          text={`${table.total} pelanggan cocok dengan “${query.trim()}” di tab ${tabName}`}
          onReset={() => changeFilter(() => setQuery(''))}
        />
      )}
      <Card id="cust-panel" role="tabpanel" aria-labelledby={`tab-${segment}`}>
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
              {exportButton('compact')}
            </BulkBar>
          )}
          <MobileSort
            value={`${table.sortKey}:${table.sortDirection}`}
            options={SORT_OPTIONS}
            onChange={(value) => {
              const [key, direction] = value.split(':')
              table.setSort({ key, direction: direction as SortDirection })
            }}
          />
          {table.total > 0 && <SelectAllRow state={table.allState} onToggle={table.toggleAll} />}
          {table.total > 0 && (
            <Table className="max-sm:hidden">
              <TableHeader>
                <tr className={TABLE_HEAD_ROW}>
                  <TableHead className={CHECK_CELL}>
                    <Checkbox
                      isSelected={table.allState === true}
                      isIndeterminate={table.allState === 'indeterminate'}
                      onChange={table.toggleAll}
                      aria-label="Pilih semua baris di halaman ini"
                    />
                  </TableHead>
                  {headers.map(([key, label, align, hide]) => (
                    <SortHeader
                      key={key}
                      sort={table.ariaSort(key)}
                      align={align}
                      onSort={() => table.sortBy(key)}
                      className={hide}
                    >
                      {label}
                    </SortHeader>
                  ))}
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
                      <TableCell className="py-2">
                        <div className="font-semibold">{row.name}</div>
                        <div className="font-mono text-caption leading-[1.3] text-muted-foreground">
                          {row.phone}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-foreground-secondary max-lg:hidden">
                        {row.area}
                      </TableCell>
                      <TableCell className="py-2">{formatDayMonth(row.last, true)}</TableCell>
                      <TableCell className="py-2 text-right font-semibold tabular-nums">
                        {row.days} hari
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums max-lg:hidden">
                        {row.orders}
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums">
                        {formatRupiah(row.spend)}
                        {row.held > 0 && (
                          <span className="block text-caption text-destructive-text">
                            {formatRupiah(row.held)} perlu dicek
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <ul className="sm:hidden">
            {table.rows.map((row) => {
              const isSelected = table.isSelected(row.id)
              return (
                <li
                  key={row.id}
                  data-selected={isSelected}
                  className={cn(
                    'flex items-center gap-0.5 border-t border-border py-1.5 pr-(--card-spacing) pl-2',
                    isSelected && 'bg-row-selected'
                  )}
                >
                  <Checkbox
                    isSelected={isSelected}
                    onChange={() => table.toggle(row.id)}
                    aria-label={`Pilih ${row.label}`}
                  />
                  <div className="min-w-0 flex-1 py-2">
                    <p className="text-[15px] leading-[1.3] font-semibold">{row.name}</p>
                    <p className="text-meta leading-[1.4] text-muted-foreground">
                      {row.days} hari tidak aktif · terakhir {formatDayMonth(row.last, true)}
                    </p>
                    <p className="text-meta leading-[1.4] text-foreground-secondary">
                      {row.orders} pesanan · {formatRupiah(row.spend)} · {row.area}
                    </p>
                    {row.held > 0 && (
                      <p className="text-meta leading-[1.4] text-destructive-text">
                        {formatRupiah(row.held)} perlu dicek di Rekonsiliasi
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {table.total === 0 && (
            <TableEmpty
              title={
                search
                  ? `Tidak ada pelanggan yang cocok di tab ${tabName}`
                  : 'Tidak ada pelanggan di segmen ini'
              }
              description={
                search
                  ? 'Coba tab lain atau ubah kata kunci pencarian.'
                  : segment === 'inactive'
                    ? 'Coba batas hari yang lebih pendek.'
                    : 'Coba tab lain.'
              }
              onReset={() => changeFilter(() => setQuery(''))}
            />
          )}
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
    </AdminLayout>
  )
}
