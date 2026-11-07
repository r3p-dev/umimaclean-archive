import { useMemo, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { toast } from 'sonner'
import {
  IconBackpack,
  IconHelmet,
  IconInfoCircle,
  IconMapPinPlus,
  IconShoe,
} from '@tabler/icons-react'
import { urlFor } from '~/client'
import AddressSheet from '~/components/organisms/order/address_sheet'
import QuantityStepper from '~/components/molecules/quantity_stepper'
import OrderSummaryCard from '~/components/organisms/order/order_summary_card'
import PickupAddressCard from '~/components/organisms/order/pickup_address_card'
import PickupSchedulePicker from '~/components/organisms/order/pickup_schedule_picker'
import AccountLayout from '~/components/templates/account_layout'
import { Alert } from '~/components/ui/alert'
import { Button, LinkButton } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Field, FieldLabel } from '~/components/ui/field'
import { Textarea } from '~/components/ui/textarea'
import { shortStreet, type SavedAddress } from '~/lib/order/addresses'
import { draftPayload, initialDraft, type StoredDraft } from '~/lib/order/form'
import { itemsSummary, totalItems, type ItemCounts } from '~/lib/order/items'
import {
  firstOpenSlot,
  formatSchedule,
  pickupDays,
  type Availability,
  type PickupDay,
} from '~/lib/order/schedule'

const ITEMS = [
  { key: 'sepatu', label: 'Sepatu', icon: IconShoe },
  { key: 'tas', label: 'Tas', icon: IconBackpack },
] as const

export default function OrderCreate({
  addresses,
  canAddAddress,
  draft: stored,
  repeatItems,
  availability,
}: {
  addresses: SavedAddress[]
  canAddAddress: boolean
  draft: StoredDraft | null
  repeatItems: ItemCounts | null
  availability: Availability
}) {
  const days = useMemo(() => pickupDays(availability), [availability])
  const [draft, setDraft] = useState(() => initialDraft(days, addresses, stored, repeatItems))
  const [isChoosing, setChoosing] = useState(false)
  const [isBusy, setBusy] = useState(false)
  const day = days.find((option) => option.iso === draft.date)!
  const pickup = addresses.find((address) => address.id === draft.pickupAddressId) ?? null
  const delivery = addresses.find((address) => address.id === draft.deliveryAddressId) ?? null
  const total = totalItems(draft.items)
  const hasSlot = draft.slot >= 0
  const schedule = hasSlot ? formatSchedule(draft.date, draft.slot, 'day') : 'Pilih jadwal lain'

  function update(patch: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function pickDay(next: PickupDay) {
    update({
      date: next.iso,
      slot: next.fullSlots.includes(draft.slot) ? firstOpenSlot(next) : draft.slot,
    })
  }

  function proceed() {
    if (isBusy || !pickup || total === 0 || !hasSlot) {
      return
    }
    router.post(urlFor('customer.order.review'), draftPayload(draft), {
      preserveScroll: true,
      onStart: () => setBusy(true),
      onError: (errors) => {
        toast.error(Object.values(errors)[0] ?? 'Periksa kembali pesanan Anda.')
      },
      onFinish: () => setBusy(false),
    })
  }

  const cta = (
    <Button
      size="cta"
      className="w-full"
      isDisabled={total === 0 || !pickup || !hasSlot}
      isPending={isBusy}
      onPress={proceed}
    >
      {isBusy
        ? 'Memeriksa…'
        : !hasSlot
          ? 'Jadwal penuh, pilih hari lain'
          : total
            ? 'Lanjut ke Konfirmasi'
            : 'Tambah minimal 1 barang'}
    </Button>
  )

  return (
    <>
      <Head title="Pesan Penjemputan" />
      <div className="mx-auto box-content max-w-page px-5 pt-6 lg:pt-10">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.02em] lg:text-[34px]">
          Pesan Penjemputan
        </h1>
        <p className="mt-2 text-[15px] leading-normal text-foreground-secondary max-sm:hidden">
          Data diri sudah tersimpan. Cukup pilih barang dan jadwal.
        </p>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:mt-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            {pickup ? (
              <PickupAddressCard
                pickup={pickup}
                delivery={delivery}
                action={
                  <Button
                    variant="link"
                    onPress={() => setChoosing(true)}
                    aria-label="Ganti alamat penjemputan"
                  >
                    Ganti
                  </Button>
                }
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle as="h2">Belum ada alamat tersimpan</CardTitle>
                  <CardDescription>Tambahkan alamat penjemputan dulu.</CardDescription>
                </CardHeader>
                <CardFooter>
                  <LinkButton
                    variant="outline"
                    href={`${urlFor('customer.addresses.create')}?dari=pesan`}
                    className="gap-2"
                  >
                    <IconMapPinPlus className="size-5" />
                    Tambah Alamat
                  </LinkButton>
                </CardFooter>
              </Card>
            )}
            <div className="grid items-start gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-5">
                <Card role="region" aria-labelledby="items-title">
                  <CardHeader>
                    <CardTitle as="h2" id="items-title">
                      Apa yang mau dijemput?
                    </CardTitle>
                    <CardDescription>Perkiraan saja. Kurir mencatat jumlah pasti.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div>
                      {ITEMS.map(({ key, label, icon }) => (
                        <QuantityStepper
                          key={key}
                          label={label}
                          icon={icon}
                          value={draft.items[key]}
                          onChange={(value) => update({ items: { ...draft.items, [key]: value } })}
                        />
                      ))}
                    </div>
                    <p className="flex gap-2 text-meta text-muted-foreground">
                      <IconHelmet className="size-4.5 shrink-0" />
                      Cuci helm hanya untuk helm yang dibawa langsung ke toko.
                    </p>
                  </CardContent>
                </Card>
                <Alert variant="info" role="note" className="p-3.5 text-accent-foreground">
                  <IconInfoCircle className="text-info-foreground" />
                  <p>
                    <strong className="font-semibold">Anda tidak perlu memilih layanan.</strong> Tim
                    kami memeriksa setiap barang, lalu menentukan layanan dan harganya.
                  </p>
                </Alert>
                <Field>
                  <FieldLabel htmlFor="order-note" className="gap-1">
                    Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
                  </FieldLabel>
                  <Textarea
                    id="order-note"
                    rows={3}
                    placeholder="mis. sepatu putih ada noda kopi di bagian depan"
                    className="min-h-18 p-3.5"
                    value={draft.note}
                    onChange={(event) => update({ note: event.target.value.slice(0, 300) })}
                  />
                </Field>
              </div>
              <PickupSchedulePicker
                days={days}
                day={day}
                slot={draft.slot}
                onPickDay={pickDay}
                onPickSlot={(slot) => update({ slot })}
              />
            </div>
            <div className="flex flex-col gap-2 lg:hidden">
              <p className="flex justify-between gap-4 text-note leading-[1.3] text-foreground-secondary">
                <span>{total ? itemsSummary(draft.items) : 'Belum ada barang'}</span>
                <span>{formatSchedule(draft.date, draft.slot, 'short')}</span>
              </p>
              {cta}
            </div>
          </div>
          <div className="sticky top-22 max-lg:hidden">
            <OrderSummaryCard
              where={
                pickup ? `${pickup.label} · ${shortStreet(pickup.addressText)}` : 'Belum ada alamat'
              }
              items={total ? itemsSummary(draft.items) : 'Belum ada barang'}
              schedule={schedule}
            >
              {cta}
            </OrderSummaryCard>
          </div>
        </div>
      </div>
      {pickup && (
        <AddressSheet
          isOpen={isChoosing}
          onOpenChange={setChoosing}
          addresses={addresses}
          canAdd={canAddAddress}
          initial={{ pickupId: pickup.id, deliveryId: draft.deliveryAddressId }}
          onConfirm={(selection) =>
            update({ pickupAddressId: selection.pickupId, deliveryAddressId: selection.deliveryId })
          }
        />
      )}
    </>
  )
}

OrderCreate.layout = [AccountLayout]
