import type { receivedMoney } from '~/lib/reports/period'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { formatRupiah } from '~/lib/shared/format'

export default function ReceivedMoneyCard({ money }: { money: ReturnType<typeof receivedMoney> }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle as="h2">Uang masuk</CardTitle>
        <CardDescription>
          Semua dana yang diterima, termasuk QRIS yang bukan omzet. Dihitung per tanggal dana masuk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {money.rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{row.label}</span>
                <span className="text-caption text-muted-foreground">{row.hint}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatRupiah(row.amount)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex-col items-stretch border-t">
        <p className="flex justify-between gap-3 text-sm">
          <span>Total diterima</span>
          <span className="font-semibold tabular-nums">{formatRupiah(money.total)}</span>
        </p>
        <p className="flex justify-between gap-3 text-md font-bold">
          <span>Bersih (diterima − dikembalikan)</span>
          <span className="tabular-nums">{formatRupiah(money.net)}</span>
        </p>
      </CardFooter>
    </Card>
  )
}
