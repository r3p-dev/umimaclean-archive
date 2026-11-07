import { createHash } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

export type ChargeInput = {
  orderId: string
  amount: number
  customerName: string
  customerPhone: string
  expiryMinutes: number
}

type ChargeResult = { transactionId: string | null; qrUrl: string | null }

export type ProviderStatus = {
  orderId: string
  transactionStatus: string
  fraudStatus?: string
  grossAmount: string
  transactionId?: string
  statusCode: string
  signatureKey?: string
}

type MidtransResponse = {
  status_code?: string
  status_message?: string
  order_id?: string
  transaction_id?: string
  transaction_status?: string
  fraud_status?: string
  gross_amount?: string
  signature_key?: string
  actions?: { name: string; url: string }[]
}

export function midtransStatus(body: MidtransResponse): ProviderStatus {
  return {
    orderId: String(body.order_id ?? ''),
    transactionStatus: String(body.transaction_status ?? ''),
    fraudStatus: body.fraud_status,
    grossAmount: String(body.gross_amount ?? ''),
    transactionId: body.transaction_id,
    statusCode: String(body.status_code ?? ''),
    signatureKey: body.signature_key,
  }
}

export default class MidtransGateway {
  #serverKey() {
    return env.get('MIDTRANS_SERVER_KEY')?.release() ?? ''
  }

  #baseUrl() {
    return env.get('MIDTRANS_IS_PRODUCTION')
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'
  }

  #headers() {
    return {
      'accept': 'application/json',
      'content-type': 'application/json',
      'authorization': `Basic ${Buffer.from(`${this.#serverKey()}:`).toString('base64')}`,
    }
  }

  isConfigured() {
    return this.#serverKey().length > 0
  }

  async chargeQris(input: ChargeInput): Promise<ChargeResult> {
    const response = await fetch(`${this.#baseUrl()}/v2/charge`, {
      method: 'POST',
      headers: this.#headers(),
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: { order_id: input.orderId, gross_amount: input.amount },
        qris: { acquirer: 'gopay' },
        customer_details: { first_name: input.customerName, phone: input.customerPhone },
        custom_expiry: { expiry_duration: input.expiryMinutes, unit: 'minute' },
      }),
      signal: AbortSignal.timeout(10000),
    })
    const body = (await response.json()) as MidtransResponse
    if (!['200', '201'].includes(String(body.status_code))) {
      logger.error({ body }, 'Midtrans charge rejected')
      throw new Error(`Midtrans charge failed: ${body.status_message ?? response.status}`)
    }
    return {
      transactionId: body.transaction_id ?? null,
      qrUrl: body.actions?.find((action) => action.name === 'generate-qr-code')?.url ?? null,
    }
  }

  async fetchTransactionStatus(orderId: string): Promise<ProviderStatus | null> {
    const response = await fetch(`${this.#baseUrl()}/v2/${encodeURIComponent(orderId)}/status`, {
      headers: this.#headers(),
      signal: AbortSignal.timeout(10000),
    })
    const body = (await response.json()) as MidtransResponse
    logger.info(this.#reply('status', orderId, response, body), 'Midtrans status reply')
    if (String(body.status_code) === '404') {
      return null
    }
    if (!body.transaction_status) {
      throw new Error(`Midtrans status failed: ${body.status_message ?? response.status}`)
    }
    return midtransStatus(body)
  }

  async cancelTransaction(orderId: string): Promise<ProviderStatus> {
    const response = await fetch(`${this.#baseUrl()}/v2/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      headers: this.#headers(),
      signal: AbortSignal.timeout(10000),
    })
    const body = (await response.json()) as MidtransResponse
    logger.info(this.#reply('cancel', orderId, response, body), 'Midtrans cancel reply')
    return midtransStatus({ ...body, order_id: body.order_id ?? orderId })
  }

  #reply(call: string, orderId: string, response: Response, body: MidtransResponse) {
    return {
      call,
      orderId,
      httpStatus: response.status,
      statusCode: body.status_code,
      statusMessage: body.status_message,
      transactionStatus: body.transaction_status,
    }
  }

  verifySignature(notification: ProviderStatus) {
    if (!this.isConfigured() || !notification.signatureKey) {
      return false
    }
    const expected = createHash('sha512')
      .update(
        `${notification.orderId}${notification.statusCode}${notification.grossAmount}${this.#serverKey()}`
      )
      .digest('hex')
    return expected === notification.signatureKey
  }
}
