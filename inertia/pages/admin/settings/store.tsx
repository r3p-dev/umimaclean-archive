import { useId, useState, type ComponentType, type SVGProps } from 'react'
import { Head } from '@inertiajs/react'
import { toast } from 'sonner'
import { IconCash, IconDeviceFloppy, IconMinus, IconPlus, IconQrcode } from '@tabler/icons-react'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import ChoicePills from '~/components/molecules/choice_pills'
import AdminPageHeader from '~/components/organisms/admin_page_header'
import SettingsTabs from '~/components/organisms/settings/settings_tabs'
import AdminLayout from '~/components/templates/admin_layout'
import { THRESHOLDS } from '~/lib/customers/segments'
import {
  SLOT_CAPACITY,
  STORE_PAY_METHODS,
  saveStoreSettings,
  type StorePayKey,
  type StoreSettings,
} from '~/lib/settings/store_settings'

const PAY_ICONS: Record<StorePayKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  qris: IconQrcode,
  cash: IconCash,
}

export default function AdminStoreSettings({
  settings: saved,
  isQrisAvailable,
}: {
  settings: StoreSettings
  isQrisAvailable: boolean
}) {
  const [draft, setDraft] = useState<StoreSettings>(saved)
  const nameId = useId()
  const whatsappId = useId()
  const addressId = useId()
  const hoursId = useId()
  const [isSaving, setSaving] = useState(false)
  const [showPayWarning, setPayWarning] = useState(false)
  const update = (patch: Partial<StoreSettings>) =>
    setDraft((current) => ({ ...current, ...patch }))

  function togglePay(key: StorePayKey) {
    const next = { ...draft.payments, [key]: !draft.payments[key] }
    if (!next.qris && !next.cash) {
      setPayWarning(true)
      return
    }
    setPayWarning(false)
    update({ payments: next })
  }

  return (
    <AdminLayout active="pengaturan" title="Pengaturan">
      <Head title="Toko & pembayaran" />
      <AdminPageHeader
        title="Pengaturan"
        actions={
          <Button
            size="desktop"
            className="gap-1.5"
            isPending={isSaving}
            onPress={() => {
              setSaving(true)
              saveStoreSettings(draft, {
                onError: (errors) =>
                  toast.error(Object.values(errors)[0] ?? 'Periksa kembali isian.'),
                onFinish: () => setSaving(false),
              })
            }}
          >
            <IconDeviceFloppy className="size-4.5" />
            {isSaving ? 'Menyimpan…' : 'Simpan perubahan'}
          </Button>
        }
      />
      <SettingsTabs active="store" />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Profil toko</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field className="min-w-0 gap-1.5">
                  <FieldLabel htmlFor={nameId} className="text-note">
                    Nama toko
                  </FieldLabel>
                  <Input
                    id={nameId}
                    type="text"
                    autoComplete="off"
                    value={draft.name}
                    onChange={(event) => update({ name: event.target.value })}
                    className="px-3"
                  />
                </Field>
                <Field className="min-w-0 gap-1.5">
                  <FieldLabel htmlFor={whatsappId} className="text-note">
                    WhatsApp bisnis
                  </FieldLabel>
                  <Input
                    id={whatsappId}
                    type="tel"
                    autoComplete="off"
                    value={draft.whatsapp}
                    onChange={(event) => update({ whatsapp: event.target.value })}
                    className="px-3"
                  />
                </Field>
                <Field className="min-w-0 gap-1.5">
                  <FieldLabel htmlFor={addressId} className="text-note">
                    Alamat toko
                  </FieldLabel>
                  <Input
                    id={addressId}
                    type="text"
                    autoComplete="off"
                    value={draft.address}
                    onChange={(event) => update({ address: event.target.value })}
                    className="px-3"
                  />
                </Field>
                <Field className="min-w-0 gap-1.5">
                  <FieldLabel htmlFor={hoursId} className="text-note">
                    Jam buka
                  </FieldLabel>
                  <Input
                    id={hoursId}
                    type="text"
                    autoComplete="off"
                    value={draft.hours}
                    aria-describedby={`${hoursId}-hint`}
                    onChange={(event) => update({ hours: event.target.value })}
                    className="px-3"
                  />
                  <FieldDescription id={`${hoursId}-hint`} className="text-caption">
                    Ditampilkan di struk dan pesan WhatsApp.
                  </FieldDescription>
                </Field>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-b">
              <CardTitle as="h2">Slot penjemputan</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {draft.slots.map((slot, index) => {
                  const setSlot = (patch: Partial<typeof slot>) =>
                    update({
                      slots: draft.slots.map((item, position) =>
                        position === index ? { ...item, ...patch } : item
                      ),
                    })
                  return (
                    <li
                      key={slot.label}
                      className="flex flex-wrap items-center gap-2.5 py-3 first:pt-0 last:pb-0"
                    >
                      <Switch
                        isSelected={slot.on}
                        onChange={(isOn) => setSlot({ on: isOn })}
                        aria-label={`Aktifkan slot ${slot.label}`}
                      />
                      <span className="flex-1 font-mono text-sm font-semibold">{slot.label}</span>
                      <span className="text-meta leading-none text-foreground-secondary">
                        kapasitas
                      </span>
                      <span
                        role="group"
                        aria-label={`Kapasitas ${slot.label}`}
                        className="inline-flex items-center overflow-hidden rounded-md border border-input"
                      >
                        <button
                          type="button"
                          aria-label={`Kurangi kapasitas ${slot.label}`}
                          disabled={slot.capacity <= SLOT_CAPACITY.min}
                          onClick={() =>
                            setSlot({ capacity: Math.max(SLOT_CAPACITY.min, slot.capacity - 1) })
                          }
                          className="flex size-11 items-center justify-center bg-card hover:bg-accent disabled:text-disabled-foreground"
                        >
                          <IconMinus className="size-5" />
                        </button>
                        <output
                          aria-live="polite"
                          className="min-w-8.5 text-center text-md leading-none font-semibold"
                        >
                          {slot.capacity}
                        </output>
                        <button
                          type="button"
                          aria-label={`Tambah kapasitas ${slot.label}`}
                          disabled={slot.capacity >= SLOT_CAPACITY.max}
                          onClick={() =>
                            setSlot({ capacity: Math.min(SLOT_CAPACITY.max, slot.capacity + 1) })
                          }
                          className="flex size-11 items-center justify-center bg-card hover:bg-accent disabled:text-disabled-foreground"
                        >
                          <IconPlus className="size-5" />
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-note text-foreground-secondary">
                Kapasitas = jumlah penjemputan per slot per hari. Slot penuh tetap terlihat tapi
                tidak bisa dipilih pelanggan; slot nonaktif disembunyikan.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2.5 rounded-md bg-accent p-3">
                <IconQrcode className="size-6 shrink-0 text-info-foreground" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">
                    {isQrisAvailable
                      ? 'QRIS online · Midtrans terhubung'
                      : 'QRIS online · belum aktif'}
                  </span>
                  <span className="block text-caption text-foreground-secondary">
                    {isQrisAvailable
                      ? 'Satu-satunya metode untuk pesanan online'
                      : 'Isi MIDTRANS_SERVER_KEY di server agar pelanggan bisa membayar QRIS'}
                  </span>
                </span>
              </div>
              <h3 className="text-meta leading-none font-semibold tracking-wider text-muted-foreground uppercase">
                Metode di toko
              </h3>
              {STORE_PAY_METHODS.map((method) => {
                const Icon = PAY_ICONS[method.key]
                return (
                  <div key={method.key} className="flex min-h-11 items-center gap-2.5">
                    <Icon className="size-5 text-foreground-secondary" />
                    <span className="flex-1 text-sm font-medium">{method.label}</span>
                    <Switch
                      isSelected={draft.payments[method.key]}
                      onChange={() => togglePay(method.key)}
                      aria-label={`Aktifkan ${method.label}`}
                    />
                  </div>
                )
              })}
              {showPayWarning && (
                <FieldError className="text-meta">Minimal satu metode toko harus aktif.</FieldError>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Pelanggan tidak aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-note text-foreground-secondary">
                Batas bawaan yang dipakai di halaman Pelanggan. Owner tetap bisa mengubahnya
                sementara di sana.
              </p>
              <ChoicePills
                label="Batas hari"
                value={draft.inactiveDays}
                onChange={(inactiveDays) => update({ inactiveDays })}
                options={THRESHOLDS.map((days) => ({ value: days, label: `${days} hari` }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
