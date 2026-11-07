import { randomUUID } from 'node:crypto'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import type { SessionData } from '@adonisjs/session/types'
import type { Group } from '@japa/runner/core'
import { DateTime } from 'luxon'
import { MessageStatus } from '#enums/message_enum'
import { ItemKind, OrderAddressType } from '#enums/order_enum'
import { ServiceType } from '#enums/service_enum'
import Service from '#models/service'
import ServiceArea, { type Point } from '#models/service_area'
import MidtransGateway, { type ChargeInput, type ProviderStatus } from '#services/midtrans_gateway'
import { CustomerAddressFactory } from '#database/factories/customer_address_factory'
import { OrderAddressFactory } from '#database/factories/order_address_factory'
import { OrderFactory } from '#database/factories/order_factory'
import type User from '#models/user'
import FonnteService from '#services/fonnte_service'
import { clearRouteCaches } from '#services/task_service'
import TurnstileService from '#services/turnstile_service'
import { SERVICE_ZONE } from '#validators/shared/rules/pickup'

export const AREA_POINTS = {
  covered: { lat: -6.89, lng: 107.61 },
  inactive: { lat: -6.93, lng: 107.75 },
  outside: { lat: -7.2, lng: 107.9 },
} satisfies Record<string, Point>

function box(west: number, south: number, east: number, north: number) {
  return `SRID=4326;MULTIPOLYGON(((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south})))`
}

export async function serviceAreaFixtures() {
  const [covered, inactive] = await ServiceArea.createMany([
    {
      city: 'Kota Contoh',
      name: 'Sukamaju',
      code: 'TEST01',
      isActive: true,
      boundary: box(107.55, -6.95, 107.66, -6.85),
    },
    {
      city: 'Kabupaten Contoh',
      name: 'Sukaraja',
      code: 'TEST02',
      isActive: false,
      boundary: box(107.7, -6.98, 107.8, -6.88),
    },
  ])
  return { covered, inactive }
}

export class FakeFonnte extends FonnteService {
  messages: { target: string; message: string }[] = []
  shouldFail = false
  shouldThrow = false

  override async sendMessage(target: string, message: string) {
    if (this.shouldThrow) {
      throw new Error('Fonnte is down')
    }
    if (this.shouldFail) {
      return MessageStatus.FAILED
    }
    this.messages.push({ target, message })
    return MessageStatus.SENT
  }

  lastCode(target: string) {
    const sent = this.messages.filter((message) => message.target === target).at(-1)
    const code = sent?.message.match(/\b(\d{6})\b/)?.[1]
    if (!code) {
      throw new Error(`No OTP sent to ${target}`)
    }
    return code
  }
}

export class FakeTurnstile extends TurnstileService {
  shouldPass = true
  hasWidget = true

  override async verifyToken(token: unknown) {
    if (!this.hasWidget) {
      return this.shouldPass
    }

    return this.shouldPass && typeof token === 'string' && token.length > 0
  }
}

export class FakeMidtrans extends MidtransGateway {
  isAvailable = true
  charges: ChargeInput[] = []
  cancels: string[] = []
  statusChecks: string[] = []
  cancelReply: (Partial<ProviderStatus> & { statusMessage?: string }) | 'unreachable' = {
    statusCode: '200',
    transactionStatus: 'cancel',
  }
  providerStatus: ProviderStatus | null = null
  isStatusUnreachable = false

  override isConfigured() {
    return this.isAvailable
  }

  override async chargeQris(input: ChargeInput) {
    this.charges.push(input)
    return { transactionId: `tx-${input.orderId}`, qrUrl: `https://qr.test/${input.orderId}.png` }
  }

  override async fetchTransactionStatus(orderId: string) {
    this.statusChecks.push(orderId)
    if (this.isStatusUnreachable) {
      throw new Error('Midtrans status unreachable')
    }
    return this.providerStatus
  }

  override async cancelTransaction(orderId: string) {
    this.cancels.push(orderId)
    if (this.cancelReply === 'unreachable') {
      throw new Error('Midtrans cancel unreachable')
    }
    return { orderId, grossAmount: '', statusCode: '', transactionStatus: '', ...this.cancelReply }
  }

  override verifySignature(notification: ProviderStatus) {
    return notification.signatureKey === 'valid-signature'
  }
}

const KEPT_TABLES = ['adonis_schema', 'adonis_schema_versions', 'spatial_ref_sys']

function truncate() {
  return db.connection().truncateAllTables(KEPT_TABLES)
}

export const TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

export const PNG_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

export async function seedCatalogue() {
  return Service.createMany([
    { name: 'Deep Clean', type: ServiceType.MAIN, categories: [ItemKind.SHOE], price: 45000 },
    { name: 'Whitening', type: ServiceType.ADDON, categories: [ItemKind.SHOE], price: 10000 },
    { name: 'Cuci Tas', type: ServiceType.MAIN, categories: [ItemKind.BAG], price: 40000 },
    { name: 'Helmet Spa', type: ServiceType.MAIN, categories: [ItemKind.HELMET], price: 35000 },
  ])
}

export function useApp(group: Group) {
  const state = {
    areas: {} as Awaited<ReturnType<typeof serviceAreaFixtures>>,
    fonnte: new FakeFonnte(),
    turnstile: new FakeTurnstile(),
    gateway: new FakeMidtrans(),
  }
  group.each.setup(async () => {
    state.fonnte = new FakeFonnte()
    state.turnstile = new FakeTurnstile()
    state.gateway = new FakeMidtrans()
    app.container.swap(FonnteService, () => state.fonnte)
    app.container.swap(TurnstileService, () => state.turnstile)
    app.container.swap(MidtransGateway, () => state.gateway)
    await limiter.clear()
    clearRouteCaches()
    await truncate()
    state.areas = await serviceAreaFixtures()
    return truncate
  })
  group.each.teardown(() => {
    app.container.restore(FonnteService)
    app.container.restore(TurnstileService)
    app.container.restore(MidtransGateway)
  })
  return state
}

export function send(
  client: ApiClient,
  method: 'post' | 'put' | 'delete',
  url: string,
  body: object = {},
  session: SessionData = {}
) {
  return client[method](url)
    .json(body)
    .withSession(session)
    .withCsrfToken()
    .header('accept', 'application/json')
    .redirects(0)
}

export function post(client: ApiClient, url: string, body: object = {}, session: SessionData = {}) {
  return send(client, 'post', url, body, session)
}

function formFields(value: unknown, prefix: string): [string, string][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      formFields(nested, prefix ? `${prefix}[${key}]` : key)
    )
  }
  return [[prefix, typeof value === 'boolean' ? (value ? '1' : '0') : String(value)]]
}

export function postWalkIn(client: ApiClient, body: object, photos = 1) {
  const request = client
    .post('/staf/transaksi')
    .withCsrfToken()
    .header('accept', 'application/json')
    .redirects(0)
  for (const [name, value] of formFields(body, '')) {
    request.field(name, value)
  }
  for (let index = 0; index < photos; index++) {
    request.file(`photos[${index}]`, PNG_PIXEL, { filename: `barang-${index + 1}.png` })
  }
  return request
}

export function inertia(client: ApiClient, url: string, session: SessionData = {}) {
  return client.get(url).withSession(session).withInertia().redirects(0)
}

export function nextPickupDate() {
  let date = DateTime.now().setZone(SERVICE_ZONE).plus({ days: 1 })
  if (date.weekday === 7) {
    date = date.plus({ days: 1 })
  }
  return date.toISODate()!
}

export function orderPayload(pickupAddressId: number, overrides: Record<string, unknown> = {}) {
  return {
    key: randomUUID(),
    items: { sepatu: 2, tas: 1, helm: 0 },
    note: 'Noda kopi',
    date: nextPickupDate(),
    slot: 1,
    pickupAddressId,
    ...overrides,
  }
}

export function addressPayload(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Kantor',
    recipientName: 'Budi Santoso',
    recipientPhone: '81234567890',
    addressText: 'Jl. Asia Afrika No. 8, Lt. 3, Braga, Sumur Bandung',
    landmark: 'Resepsionis',
    point: { lat: -6.9215, lng: 107.6094 },
    ...overrides,
  }
}

export function savedAddress(user: User, overrides: Record<string, unknown> = {}) {
  return CustomerAddressFactory.merge({
    userId: user.id,
    recipientName: user.name,
    recipientPhone: user.phone,
    ...overrides,
  }).create()
}

export async function createOrder(
  user: User,
  overrides: Record<string, unknown> = {},
  address = 'Jl. Dipati Ukur No. 35, Coblong, Bandung'
) {
  const order = await OrderFactory.merge({
    userId: user.id,
    customerName: user.name,
    customerPhone: user.phone,
    ...overrides,
  }).create()
  for (const type of Object.values(OrderAddressType)) {
    await OrderAddressFactory.merge({
      orderId: order.id,
      type,
      addressText: address,
      recipientName: user.name,
      recipientPhone: user.phone,
    }).create()
  }
  return order
}
