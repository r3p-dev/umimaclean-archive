import { type ComponentType, type SVGProps } from 'react'
import { IconCash, IconQrcode } from '@tabler/icons-react'
import type { PaymentMethod } from '~/lib/store/payment'
import { cn } from '~/lib/shared/utils'

const ICONS: Record<PaymentMethod, ComponentType<SVGProps<SVGSVGElement>>> = {
  qris: IconQrcode,
  cash: IconCash,
}

const COLUMNS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }

export default function PaymentMethodPicker({
  methods,
  value,
  onChange,
}: {
  methods: { key: PaymentMethod; label: string }[]
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Metode pembayaran"
      className={cn('grid gap-2', COLUMNS[methods.length] ?? 'grid-cols-3')}
    >
      {methods.map((method) => {
        const isSelected = method.key === value
        const Icon = ICONS[method.key]
        return (
          <button
            key={method.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(method.key)}
            className={cn(
              'flex min-h-19 w-full flex-col items-center justify-center gap-1.5 rounded-md border text-[14.5px] leading-none text-foreground',
              isSelected
                ? 'border-primary bg-accent font-bold shadow-[inset_0_0_0_1px_var(--primary)]'
                : 'border-border-strong bg-card font-semibold hover:border-primary hover:bg-accent'
            )}
          >
            <Icon
              className={cn('size-6.5', isSelected ? 'text-primary' : 'text-foreground-secondary')}
            />
            {method.label}
          </button>
        )
      })}
    </div>
  )
}
