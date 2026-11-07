import { useRef, useState, type SubmitEvent } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { urlFor } from '~/client'
import BackLink from '~/components/molecules/back_link'
import PasswordInput from '~/components/molecules/password_input'
import PhoneInput from '~/components/molecules/phone_input'
import TurnstileWidget from '~/components/molecules/turnstile_widget'
import AuthLayout from '~/components/templates/auth_layout'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { customerLinks } from '~/lib/navigation/customer_links'
import { useTurnstile } from '~/lib/shared/turnstile'
import { nameError, passwordError, phoneError } from '~/lib/shared/validation'

type Field = 'name' | 'phone' | 'password' | 'passwordConfirmation' | 'terms' | 'turnstile'
type Errors = Partial<Record<Field, string>>

const ORDER = ['name', 'phone', 'password', 'passwordConfirmation', 'terms'] as const

export default function Register() {
  const turnstile = useTurnstile()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [hasAcceptedTerms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [isBusy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)

  function clear(field: Field) {
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined })
    }
  }

  function focusFirst(found: Errors) {
    const first = ORDER.find((field) => found[field])
    if (first === 'name') {
      nameRef.current?.focus()
    } else if (first === 'phone') {
      phoneRef.current?.focus()
    } else if (first === 'password') {
      passwordRef.current?.focus()
    } else if (first === 'passwordConfirmation') {
      confirmationRef.current?.focus()
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (isBusy) {
      return
    }
    const found: Errors = {}
    const problems = {
      name: nameError(name),
      phone: phoneError(phone),
      password: passwordError(password),
    }
    for (const [field, problem] of Object.entries(problems)) {
      if (problem) {
        found[field as Field] = problem
      }
    }
    if (!found.password && confirmation !== password) {
      found.passwordConfirmation = 'Kata sandi tidak sama.'
    }
    if (!hasAcceptedTerms) {
      found.terms = 'Setujui syarat & ketentuan untuk mendaftar.'
    }
    if (turnstile.isEnabled && !turnstile.token) {
      found.turnstile = 'Selesaikan verifikasi keamanan, lalu coba lagi.'
    }
    setErrors(found)
    if (Object.keys(found).length) {
      return focusFirst(found)
    }

    router.post(
      urlFor('auth.register.store'),
      {
        name,
        phone,
        password,
        passwordConfirmation: confirmation,
        terms: hasAcceptedTerms,
        turnstile: turnstile.token,
      },
      {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onError: (serverErrors) => {
          setErrors(serverErrors)
          focusFirst(serverErrors)
        },
        onFinish: () => {
          setBusy(false)
          turnstile.reset()
        },
      }
    )
  }

  return (
    <>
      <Head title="Daftar" />
      <form onSubmit={submit} noValidate aria-busy={isBusy} className="flex flex-col">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">Buat akun</h1>
        <p className="mt-2 text-[15px] leading-normal text-foreground-secondary">
          Sekali daftar, pesan berikutnya tinggal pilih barang dan jadwal.
        </p>
        <Field className="mt-6">
          <FieldLabel htmlFor="register-name">Nama</FieldLabel>
          <Input
            ref={nameRef}
            id="register-name"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value.slice(0, 80))
              clear('name')
            }}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'register-name-error' : undefined}
          />
          {errors.name && <FieldError id="register-name-error">{errors.name}</FieldError>}
        </Field>
        <Field className="mt-4.5">
          <FieldLabel htmlFor="register-phone">Nomor WhatsApp</FieldLabel>
          <PhoneInput
            ref={phoneRef}
            id="register-phone"
            value={phone}
            onChange={(value) => {
              setPhone(value)
              clear('phone')
            }}
            isInvalid={!!errors.phone}
            describedBy={errors.phone ? 'register-phone-error' : 'register-phone-help'}
          />
          {errors.phone ? (
            <FieldError id="register-phone-error">{errors.phone}</FieldError>
          ) : (
            <FieldDescription id="register-phone-help">
              Kode verifikasi dikirim ke nomor ini via WhatsApp.
            </FieldDescription>
          )}
        </Field>
        <Field className="mt-4.5">
          <FieldLabel htmlFor="register-password">Kata sandi</FieldLabel>
          <PasswordInput
            ref={passwordRef}
            id="register-password"
            autoComplete="new-password"
            value={password}
            onChange={(value) => {
              setPassword(value)
              clear('password')
            }}
            isInvalid={!!errors.password}
            describedBy={errors.password ? 'register-password-error' : 'register-password-help'}
          />
          {errors.password ? (
            <FieldError id="register-password-error">{errors.password}</FieldError>
          ) : (
            <FieldDescription id="register-password-help">Minimal 8 karakter.</FieldDescription>
          )}
        </Field>
        <Field className="mt-4.5">
          <FieldLabel htmlFor="register-confirmation">Ulangi kata sandi</FieldLabel>
          <PasswordInput
            ref={confirmationRef}
            id="register-confirmation"
            autoComplete="new-password"
            value={confirmation}
            onChange={(value) => {
              setConfirmation(value)
              clear('passwordConfirmation')
            }}
            isInvalid={!!errors.passwordConfirmation}
            describedBy={errors.passwordConfirmation ? 'register-confirmation-error' : undefined}
          />
          {errors.passwordConfirmation && (
            <FieldError id="register-confirmation-error">{errors.passwordConfirmation}</FieldError>
          )}
        </Field>
        <div className="mt-3">
          <Checkbox
            isSelected={hasAcceptedTerms}
            onChange={(isAccepted) => {
              setTerms(isAccepted)
              clear('terms')
            }}
            aria-describedby={errors.terms ? 'register-terms-error' : undefined}
            buttonClassName="size-auto min-h-icon-btn justify-start gap-2.5 text-left text-sm leading-[1.45] font-normal"
          >
            <span>
              Saya setuju dengan{' '}
              <a href={customerLinks.terms} className="font-semibold text-primary">
                Syarat Layanan
              </a>{' '}
              dan{' '}
              <a href={customerLinks.privacy} className="font-semibold text-primary">
                Kebijakan Privasi
              </a>
              .
            </span>
          </Checkbox>
          {errors.terms && <FieldError id="register-terms-error">{errors.terms}</FieldError>}
        </div>
        {turnstile.isEnabled && (
          <div className="mt-3">
            <TurnstileWidget container={turnstile.container} isEnabled={turnstile.isEnabled} />
            {errors.turnstile && <FieldError className="mt-2">{errors.turnstile}</FieldError>}
          </div>
        )}
        <Button type="submit" size="cta" className="mt-5 w-full" isPending={isBusy}>
          {isBusy ? 'Mengirim kode…' : 'Daftar'}
        </Button>
        <p className="mt-4 text-center text-[15px] leading-normal text-foreground-secondary">
          Sudah punya akun?{' '}
          <Link
            href={urlFor('auth.login')}
            className="inline-flex min-h-icon-btn items-center font-semibold text-primary hover:text-primary-hover"
          >
            Masuk
          </Link>
        </p>
      </form>
      <BackLink href={urlFor('home')} label="Kembali ke beranda" className="mt-2" />
    </>
  )
}

Register.layout = [AuthLayout]
