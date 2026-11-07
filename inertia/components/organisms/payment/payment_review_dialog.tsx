import { useId, useState } from 'react'
import { Alert } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Dialog, DialogClose, DialogDescription } from '~/components/ui/dialog'
import { FieldError } from '~/components/ui/field'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import ChoicePills from '~/components/molecules/choice_pills'
import DialogTitleBar from '~/components/molecules/dialog_title_bar'
import {
  MISMATCH_OUTCOMES,
  REVIEW_COPY,
  canAcceptAmount,
  type MismatchOutcome,
  type Review,
  type ReviewKind,
} from '~/lib/payment/review'
import { formatRupiah } from '~/lib/shared/format'

export default function PaymentReviewDialog({
  kind,
  reference,
  amount,
  billTotal,
  isSaving = false,
  serverError,
  onOpenChange,
  onSave,
}: {
  kind: ReviewKind
  reference: string
  amount: number
  billTotal: number | null
  isSaving?: boolean
  serverError?: string
  onOpenChange: (open: boolean) => void
  onSave: (review: Review) => void
}) {
  const copy = REVIEW_COPY[kind]
  const [outcome, setOutcome] = useState<MismatchOutcome>('refund')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const noteId = useId()
  const outcomeId = useId()
  const canAccept = canAcceptAmount(amount, billTotal)

  function save() {
    if (note.trim().length < 3) {
      setError('Catatan minimal 3 karakter.')
      return
    }
    setError(undefined)
    onSave({ kind, outcome, note })
  }

  return (
    <Dialog isOpen onOpenChange={onOpenChange} variant="panel">
      <DialogTitleBar>{copy.title}</DialogTitleBar>
      <DialogDescription className="text-note leading-normal">
        <span className="font-mono">{reference}</span> · diterima {formatRupiah(amount)}
        {billTotal !== null && ` · tagihan ${formatRupiah(billTotal)}`}. {copy.description}
      </DialogDescription>
      {serverError && <Alert variant="destructive">{serverError}</Alert>}
      {kind === 'mismatch' && (
        <div className="flex flex-col gap-1.5">
          <span id={outcomeId} className="text-note leading-[1.2] font-semibold">
            Keputusan
          </span>
          <ChoicePills
            labelledBy={outcomeId}
            value={outcome}
            onChange={setOutcome}
            options={MISMATCH_OUTCOMES.filter((option) => canAccept || option.value === 'refund')}
          />
          {!canAccept && (
            <span className="text-meta text-muted-foreground">
              Dana kurang dari tagihan, jadi hanya bisa dikembalikan.
            </span>
          )}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={noteId} className="text-note leading-[1.2]">
          {copy.noteLabel}
        </Label>
        <Textarea
          id={noteId}
          maxLength={150}
          placeholder={copy.placeholder}
          value={note}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${noteId}-error` : undefined}
          onChange={(event) => setNote(event.target.value)}
        />
        {error && (
          <FieldError id={`${noteId}-error`} className="text-meta">
            {error}
          </FieldError>
        )}
      </div>
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row sm:items-center">
        <DialogClose variant="outline" size="desktop">
          Batal
        </DialogClose>
        <Button size="desktop" onPress={save} isPending={isSaving}>
          {copy.action}
        </Button>
      </div>
    </Dialog>
  )
}
