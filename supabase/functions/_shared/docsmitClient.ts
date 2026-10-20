/**
 * Docsmit's HTTP, and only that (the Docsmit train, PR 3): the token, the three-call send, the
 * reads. Reference: https://secure.docsmit.com/api/v1/index.html (and the memory of it). No Deno
 * globals, so a test can hand it a fake `fetch`. The base URL decides which Docsmit it talks to:
 * Tracksmit (the sandbox) unless DOCSMIT_BASE_URL says the live site.
 */
import { mailChargeFromTransactions } from './mailSend.ts'

export type DocsmitConfig = { baseUrl: string; email: string; passwordSha512: string; softwareId: string }

export const DOCSMIT_LIVE_URL = 'https://secure.docsmit.com/api/v1'
export const TRACKSMIT_URL = 'https://secure.tracksmit.com/api/v1'

/** The secrets, as `supabase secrets set` holds them (Vault comes with the Developer-settings PR). Null when any is missing. */
export function docsmitConfigFromEnv(get: (k: string) => string | undefined): DocsmitConfig | null {
  const email = (get('DOCSMIT_EMAIL') ?? '').trim()
  const passwordSha512 = (get('DOCSMIT_PASSWORD_SHA512') ?? '').trim().toLowerCase()
  const softwareId = (get('DOCSMIT_SOFTWARE_ID') ?? '').trim()
  if (!email || !passwordSha512 || !softwareId) return null
  const baseUrl = ((get('DOCSMIT_BASE_URL') ?? '').trim() || TRACKSMIT_URL).replace(/\/+$/, '')
  return { baseUrl, email, passwordSha512, softwareId }
}

export function docsmitEnvOf(baseUrl: string): 'tracksmit' | 'prod' {
  return /tracksmit/i.test(baseUrl) ? 'tracksmit' : 'prod'
}

export class DocsmitError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, path: string) {
    super(`Docsmit ${path} answered ${status}${typeof body === 'object' && body && 'message' in body ? `: ${String((body as { message: unknown }).message)}` : ''}`)
    this.status = status
    this.body = body
  }
}

type CallOpts = { json?: unknown; form?: FormData; query?: Record<string, string>; raw?: boolean; allow?: number[] }
export type DocsmitAnswer = { status: number; data: unknown; bytes?: Uint8Array }

export type DocsmitParty = { USPSTrackingID?: string | null; DeliveryStatus?: string | null; DStatusao?: string | null; signedFor?: string | null; delivered?: string | null; mailed?: string | null; returned?: string | null; [k: string]: unknown }

export class DocsmitClient {
  private cfg: DocsmitConfig
  private fetchFn: typeof fetch
  private token: string | null = null

  constructor(cfg: DocsmitConfig, fetchFn: typeof fetch = fetch) {
    this.cfg = cfg
    this.fetchFn = fetchFn
  }

  env(): 'tracksmit' | 'prod' {
    return docsmitEnvOf(this.cfg.baseUrl)
  }

  /** `POST /token`: the SHA-512 hex of the password and the software id; the token rides as the Basic username. */
  async getToken(): Promise<string> {
    const res = await this.fetchFn(`${this.cfg.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: this.cfg.email, password: this.cfg.passwordSha512, softwareID: this.cfg.softwareId }),
    })
    const data = await res.json().catch(() => null)
    const token = typeof (data as { token?: unknown } | null)?.token === 'string' ? (data as { token: string }).token : ''
    if (!res.ok || !token) throw new DocsmitError(res.status, data, '/token')
    this.token = token
    return token
  }

  private async call(method: string, path: string, opts: CallOpts = {}, retried = false): Promise<DocsmitAnswer> {
    const token = this.token ?? (await this.getToken())
    const url = new URL(`${this.cfg.baseUrl}${path}`)
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
    const headers: Record<string, string> = { Authorization: `Basic ${btoa(`${token}:`)}`, Accept: opts.raw ? 'application/pdf' : 'application/json' }
    let body: BodyInit | undefined
    if (opts.form) body = opts.form
    else if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.json)
    }
    const res = await this.fetchFn(url.toString(), { method, headers, body })
    if (res.status === 401 && !retried) {
      this.token = null
      return this.call(method, path, opts, true)
    }
    if (opts.raw) {
      if (!res.ok) throw new DocsmitError(res.status, await res.text().catch(() => ''), path)
      return { status: res.status, data: null, bytes: new Uint8Array(await res.arrayBuffer()) }
    }
    const text = await res.text()
    let data: unknown = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!res.ok && !(opts.allow ?? []).includes(res.status)) throw new DocsmitError(res.status, data, path)
    return { status: res.status, data }
  }

  /** `GET /account/info`: the balance and the account's name; nothing secret. */
  async accountInfo(): Promise<{ creditBalance: number | null; name: string | null; raw: unknown }> {
    const { data } = await this.call('GET', '/account/info')
    const d = (data ?? {}) as Record<string, unknown>
    const bal = Number(d.creditBalance ?? d.credit_balance ?? d.balance)
    const name = [d.firstName, d.lastName].filter((x) => typeof x === 'string' && x).join(' ') || (typeof d.organization === 'string' ? d.organization : null)
    return { creditBalance: Number.isFinite(bal) ? bal : null, name: name || null, raw: data }
  }

  /** `POST /utils/multiCASS`: the address check. The caller reads `nonMailable` and `coarseCorrectionMsg`. */
  async multiCass(addresses: Array<Record<string, string>>): Promise<unknown> {
    const { data } = await this.call('POST', '/utils/multiCASS', { json: { addresses } })
    return data
  }

  /** `POST /messages/new` → the message id (the docs spell it messageID, MessageID or id). */
  async newMessage(body: Record<string, unknown>): Promise<string> {
    const { data } = await this.call('POST', '/messages/new', { json: body })
    const d = (data ?? {}) as Record<string, unknown>
    const id = d.messageID ?? d.MessageID ?? d.id ?? d.messageId
    if (id === undefined || id === null || id === '') throw new DocsmitError(200, data, '/messages/new (no id)')
    return String(id)
  }

  /** `POST /messages/{id}/upload`: the US-Letter PDF, multipart `file`. */
  async upload(messageId: string, bytes: Uint8Array, filename: string): Promise<void> {
    const form = new FormData()
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    form.append('file', new Blob([copy.buffer as ArrayBuffer], { type: 'application/pdf' }), filename)
    await this.call('POST', `/messages/${encodeURIComponent(messageId)}/upload`, { form })
  }

  /**
   * `GET /messages/{id}/priceCheck`: the cost. The doc's only example is the e-delivery price and wants `certify`,
   * `months` and `sendType` (SR | NSR) or it answers 400, so those ride along; the answer is `netPrice` or
   * `details.total` ("$ 2.49"). A 400 or a shape the reader does not know gives null: the run says "not priced yet"
   * and the send still goes (402 says when credit is short).
   */
  async priceCheck(messageId: string): Promise<{ price: number | null; raw: unknown }> {
    const { status, data } = await this.call('GET', `/messages/${encodeURIComponent(messageId)}/priceCheck`, { query: { certify: 'false', months: '12', sendType: 'SR' }, allow: [400] })
    if (status === 400) return { price: null, raw: data }
    const d = (data ?? {}) as Record<string, unknown>
    const details = (d.details ?? {}) as Record<string, unknown>
    for (const v of [d.netPrice, d.price, d.cost, d.total, d.amount, details.total, details.netPrice]) {
      if (v === undefined || v === null) continue
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''))
      if (Number.isFinite(n)) return { price: n, raw: data }
    }
    return { price: null, raw: data }
  }

  /**
   * `GET /messages/{id}/transactions`: what Docsmit charged for the message (the Docsmit train, 6b, the cost line),
   * summed by `mailChargeFromTransactions`. A 400 or 404, or an answer with no priced row, gives null.
   */
  async transactions(messageId: string): Promise<{ charge: number | null; raw: unknown }> {
    const { status, data } = await this.call('GET', `/messages/${encodeURIComponent(messageId)}/transactions`, { allow: [400, 404] })
    if (status === 400 || status === 404) return { charge: null, raw: data }
    return { charge: mailChargeFromTransactions(data), raw: data }
  }

  /** `POST /messages/{id}/send`: 201 sent; 402 credit short with `shortfall`; 403 no party or no PDF. */
  async send(messageId: string): Promise<{ sent: boolean; status: number; shortfall: number | null; raw: unknown }> {
    const { status, data } = await this.call('POST', `/messages/${encodeURIComponent(messageId)}/send`, { allow: [402] })
    const d = (data ?? {}) as Record<string, unknown>
    const shortfall = Number(d.shortfall)
    return { sent: status >= 200 && status < 300, status, shortfall: status === 402 && Number.isFinite(shortfall) ? shortfall : status === 402 ? 0 : null, raw: data }
  }

  /** `GET /messages/{id}/parties`: the physical parties with USPS's words on each. */
  async parties(messageId: string): Promise<DocsmitParty[]> {
    const { data } = await this.call('GET', `/messages/${encodeURIComponent(messageId)}/parties`)
    const d = data as { physicalParties?: unknown } | unknown[] | null
    const list = Array.isArray(d) ? d : Array.isArray((d as { physicalParties?: unknown })?.physicalParties) ? ((d as { physicalParties: unknown[] }).physicalParties) : []
    return list.filter((p): p is DocsmitParty => p != null && typeof p === 'object')
  }

  /** `GET /messages/{id}/documentation`: the Certification PDF, or null when Docsmit has none yet. */
  async documentation(messageId: string): Promise<Uint8Array | null> {
    try {
      const { bytes } = await this.call('GET', `/messages/${encodeURIComponent(messageId)}/documentation`, { raw: true })
      return bytes && bytes.byteLength > 0 ? bytes : null
    } catch (e) {
      if (e instanceof DocsmitError && (e.status === 404 || e.status === 409 || e.status === 425)) return null
      throw e
    }
  }

  /** `GET /messages/sent`: the account's sent messages; `turnOffSoftwareID=true` lists the ones sent by hand too. */
  async sentList(query: Record<string, string> = {}): Promise<Array<Record<string, unknown>>> {
    const { data } = await this.call('GET', '/messages/sent', { query })
    const d = data as { messages?: unknown } | unknown[] | null
    const list = Array.isArray(d) ? d : Array.isArray((d as { messages?: unknown })?.messages) ? (d as { messages: unknown[] }).messages : []
    return list.filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
  }
}
