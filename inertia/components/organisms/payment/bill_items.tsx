import type { BillExtra, BillItem } from '~/lib/payment/bill'
import { formatRupiah } from '~/lib/shared/format'
import { cn } from '~/lib/shared/utils'

function BillRow({
  label,
  amount,
  className,
}: {
  label: string
  amount: string
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{amount}</span>
    </div>
  )
}

export default function BillItems({
  items,
  extras,
  total,
}: {
  items: BillItem[]
  extras: BillExtra[]
  total: number
}) {
  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((item, index) => (
          <li
            key={`${item.name}-${index}`}
            className="flex flex-col gap-1.5 py-3 text-sm first:pt-0 last:pb-0"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-md font-semibold">{item.name}</span>
              <span className="text-caption text-muted-foreground">{item.kind}</span>
            </span>
            {item.main && <BillRow label={item.main.name} amount={formatRupiah(item.main.price)} />}
            {item.addons.map((addon) => (
              <BillRow
                key={addon.name}
                label={`+ ${addon.name}`}
                amount={formatRupiah(addon.price)}
                className="pl-4 text-foreground-secondary"
              />
            ))}
            <BillRow
              label="Subtotal"
              amount={formatRupiah(item.subtotal)}
              className="border-t border-dashed border-border-strong pt-1.5 font-semibold"
            />
          </li>
        ))}
      </ul>
      {extras.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
          {extras.map((extra) => (
            <BillRow
              key={extra.label}
              label={extra.label}
              amount={extra.amount ? formatRupiah(extra.amount) : 'Gratis'}
            />
          ))}
        </div>
      )}
      <p className="flex items-baseline justify-between border-t border-border-strong pt-3 text-lg leading-none font-bold">
        <span>Total</span>
        <span className="tabular-nums">{formatRupiah(total)}</span>
      </p>
    </>
  )
}
