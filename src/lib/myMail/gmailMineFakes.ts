/**
 * Fakes for `gmail-mine`'s handler test (punch list #230 PR 2), after `src/lib/mail/mailRunFakes.ts`: a recording
 * in-memory database with the slice of the Supabase client the function uses (the caller's client and the service
 * role's told apart, so a test sees which one called `tie_message`), the four database functions it calls, a bucket,
 * and a Google behind `fetch`: the token exchange (whose `sub` names the box) and one Gmail box per person. Nothing here
 * reaches a network or a database. Test-only.
 */

export type Row = Record<string, unknown>
type Answer = { data: unknown; error: { message: string } | null }
export type Who = 'admin' | 'caller'

/** A thenable query answer, as the client's builders are. */
const settle = (answer: Answer) => ({
  then: (res: (v: Answer) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(answer).then(res, rej),
})

/** The commas of a PostgREST list that are not inside brackets or quotes. */
function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let quoted = false
  let cur = ''
  for (const ch of s) {
    if (ch === '"') quoted = !quoted
    if (!quoted && ch === '(') depth++
    if (!quoted && ch === ')') depth--
    if (ch === ',' && depth === 0 && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

const valueOf = (r: Row, column: string): unknown => {
  const [col, key] = column.split('->>')
  const v = r[col!]
  return key === undefined ? v : v && typeof v === 'object' ? (v as Row)[key] : undefined
}

const likeRegex = (pattern: string, caseBlind: boolean) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*').replace(/_/g, '.')}$`, caseBlind ? 'i' : '')

/** One PostgREST `or` filter (`a.eq.1,b.in.(x,y),c->>d.ilike.*@e`) as a predicate. */
export function orFilter(filter: string): (r: Row) => boolean {
  const terms = splitTop(filter).map((term) => {
    const m = /^([a-z_]+(?:->>[a-z_]+)?)\.(eq|neq|in|ilike|like|is)\.([\s\S]*)$/i.exec(term.trim())
    if (!m) throw new Error(`the fake cannot read the or filter ${term}`)
    const [, column, op, raw] = m as unknown as [string, string, string, string]
    switch (op) {
      case 'eq':
        return (r: Row) => String(valueOf(r, column)) === raw
      case 'neq':
        return (r: Row) => String(valueOf(r, column)) !== raw
      case 'is':
        return (r: Row) => (raw === 'null' ? valueOf(r, column) == null : String(valueOf(r, column)) === raw)
      case 'in': {
        const vals = splitTop(raw.replace(/^\(/, '').replace(/\)$/, '')).map((v) => v.trim().replace(/^"|"$/g, ''))
        return (r: Row) => vals.includes(String(valueOf(r, column)))
      }
      default: {
        const re = likeRegex(raw, op.toLowerCase() === 'ilike')
        return (r: Row) => {
          const v = valueOf(r, column)
          return typeof v === 'string' && re.test(v)
        }
      }
    }
  })
  return (r) => terms.some((t) => t(r))
}

export class FakeDb {
  tables: Record<string, Row[]> = {}
  /** Every finished query and call: `admin select messages`, `caller rpc tie_message`, `admin storage upload <path>`. */
  calls: string[] = []
  rpcCalls: Array<{ who: Who; fn: string; args: Row; uid: string | null }> = []
  /** Bearer token to user id. */
  sessions: Record<string, string> = {}
  /** The address a user signs in with, where it is not their `users` row's: what `auth.getUser()` answers as `email`. */
  authEmails: Record<string, string | null> = {}
  /** The users `gc_office_team()` answers true for. */
  office = new Set<string>()
  /** The bucket's objects, by `bucket/path`. */
  files: Record<string, { bytes: Uint8Array; contentType: string | undefined }> = {}
  /** A refusal to plant: `admin delete messages` → its words, once per call that matches. */
  refuse: Record<string, string> = {}
  nextId = 1

  reset() {
    this.tables = {}
    this.calls = []
    this.rpcCalls = []
    this.sessions = {}
    this.authEmails = {}
    this.office = new Set()
    this.files = {}
    this.refuse = {}
    this.nextId = 1
  }

  rows(table: string): Row[] {
    return (this.tables[table] ??= [])
  }

  /** A `createClient` stand-in: the service role's client, or the caller's with their bearer token. */
  client(who: Who, bearer: string | null) {
    const uid = who === 'caller' && bearer ? (this.sessions[bearer] ?? null) : null
    return {
      auth: {
        getUser: async () => {
          this.calls.push(`${who} auth.getUser`)
          if (!uid) return { data: { user: null }, error: { message: 'invalid JWT' } }
          const email = uid in this.authEmails ? this.authEmails[uid] : (this.rows('users').find((u) => u.id === uid)?.email ?? null)
          return { data: { user: { id: uid, email } }, error: null }
        },
      },
      from: (table: string) => this.table(table, who),
      rpc: (fn: string, args: Row = {}) => {
        this.calls.push(`${who} rpc ${fn}`)
        this.rpcCalls.push({ who, fn, args, uid })
        const answer = this.call(fn, args, uid)
        return {
          ...settle(answer),
          single: () => {
            const data = Array.isArray(answer.data) ? (answer.data[0] ?? null) : answer.data
            return settle(answer.error ? answer : data ? { data, error: null } : { data: null, error: { message: 'no row' } })
          },
        }
      },
      storage: { from: (bucket: string) => this.bucket(bucket, who) },
    }
  }

  private table(name: string, who: Who) {
    let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
    let values: Row | Row[] = {}
    let onConflict: string[] = []
    let limit = Infinity
    const where: Array<(r: Row) => boolean> = []
    const run = (): Answer => {
      const key = `${who} ${op} ${name}`
      this.calls.push(key)
      if (this.refuse[key]) return { data: null, error: { message: this.refuse[key]! } }
      const rows = this.rows(name)
      const matched = rows.filter((r) => where.every((w) => w(r)))
      switch (op) {
        case 'select':
          return { data: matched.slice(0, limit), error: null }
        case 'update':
          for (const r of matched) Object.assign(r, values)
          return { data: matched, error: null }
        case 'delete': {
          this.tables[name] = rows.filter((r) => !matched.includes(r))
          // message_attachments.message_id is ON DELETE CASCADE.
          if (name === 'messages') {
            const ids = new Set(matched.map((r) => r.id))
            this.tables.message_attachments = this.rows('message_attachments').filter((a) => !ids.has(a.message_id))
          }
          return { data: matched, error: null }
        }
        case 'insert': {
          const made = (Array.isArray(values) ? values : [values]).map((v) => ({ id: `${name}-${this.nextId++}`, ...v }))
          rows.push(...made)
          return { data: made, error: null }
        }
        case 'upsert': {
          const out: Row[] = []
          for (const v of Array.isArray(values) ? values : [values]) {
            const had = rows.find((r) => onConflict.length > 0 && onConflict.every((c) => r[c] === v[c]))
            if (had) out.push(Object.assign(had, v))
            else {
              const made = { id: `${name}-${this.nextId++}`, ...v }
              rows.push(made)
              out.push(made)
            }
          }
          return { data: out, error: null }
        }
      }
    }
    const chain = {
      select: () => chain,
      eq: (c: string, v: unknown) => (where.push((r) => r[c] === v), chain),
      neq: (c: string, v: unknown) => (where.push((r) => r[c] !== v), chain),
      in: (c: string, vs: unknown[]) => (where.push((r) => vs.includes(r[c])), chain),
      is: (c: string, v: unknown) => (where.push((r) => (r[c] ?? null) === v), chain),
      not: (c: string, operator: string, v: unknown) => (where.push((r) => (operator === 'is' ? (r[c] ?? null) !== v : r[c] !== v)), chain),
      // ISO times compare as text; a null is never at or past anything, as in Postgres.
      gte: (c: string, v: unknown) => (where.push((r) => r[c] != null && String(r[c]) >= String(v)), chain),
      or: (filter: string) => (where.push(orFilter(filter)), chain),
      order: () => chain,
      limit: (n: number) => ((limit = n), chain),
      insert: (v: Row | Row[]) => ((op = 'insert'), (values = v), chain),
      upsert: (v: Row | Row[], opts?: { onConflict?: string }) => ((op = 'upsert'), (values = v), (onConflict = (opts?.onConflict ?? '').split(',').map((c) => c.trim()).filter(Boolean)), chain),
      update: (v: Row) => ((op = 'update'), (values = v), chain),
      delete: () => ((op = 'delete'), chain),
      maybeSingle: () => {
        const a = run()
        return settle(a.error ? a : { data: (a.data as Row[])[0] ?? null, error: null })
      },
      single: () => {
        const a = run()
        const row = a.error ? null : ((a.data as Row[])[0] ?? null)
        return settle(a.error ? a : row ? { data: row, error: null } : { data: null, error: { message: 'no row' } })
      },
      then: (res: (v: Answer) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    }
    return chain
  }

  private bucket(bucket: string, who: Who) {
    return {
      upload: async (path: string, bytes: Uint8Array, opts?: { contentType?: string; upsert?: boolean }) => {
        this.calls.push(`${who} storage upload ${path}`)
        if (who !== 'admin') return { data: null, error: { message: 'new row violates row-level security policy' } }
        this.files[`${bucket}/${path}`] = { bytes, contentType: opts?.contentType }
        return { data: { path }, error: null }
      },
      remove: async (paths: string[]) => {
        this.calls.push(`${who} storage remove ${paths.length}`)
        for (const p of paths) delete this.files[`${bucket}/${p}`]
        return { data: paths.map((name) => ({ name })), error: null }
      },
      list: async (prefix: string, opts?: { search?: string; limit?: number }) => {
        this.calls.push(`${who} storage list ${prefix}`)
        const under = `${bucket}/${prefix}/`
        const names = Object.keys(this.files)
          .filter((k) => k.startsWith(under) && !k.slice(under.length).includes('/'))
          .map((k) => k.slice(under.length))
          .filter((n) => !opts?.search || n.includes(opts.search))
        return { data: names.slice(0, opts?.limit ?? 100).map((name) => ({ name })), error: null }
      },
    }
  }

  /** The database functions the function calls, as their migrations define them, far enough for the test. */
  private call(fn: string, args: Row, uid: string | null): Answer {
    switch (fn) {
      case 'gc_office_team':
        return { data: uid !== null && this.office.has(uid), error: null }
      case 'tie_message': {
        // SECURITY INVOKER: it stamps the caller as tied_by, and the job joins the person's jobs.
        const line = this.rows('messages').find((m) => m.id === args.p_message_id)
        if (!line) return { data: null, error: { message: 'notFound' } }
        const kind = args.p_job_kind as string | null
        const id = args.p_job_id as string | null
        Object.assign(line, { bid_id: kind === 'bid' ? id : null, project_id: kind === 'project' ? id : null, jobs_ledger_id: kind === 'pipeline' ? id : null, tied_by: uid })
        if (kind) {
          const column = kind === 'bid' ? 'bid_id' : kind === 'project' ? 'project_id' : 'jobs_ledger_id'
          if (!this.rows('contact_jobs').some((j) => j.contact_id === line.contact_id && j[column] === id)) {
            this.rows('contact_jobs').push({ contact_id: line.contact_id, bid_id: null, project_id: null, jobs_ledger_id: null, is_default: false, [column]: id })
          }
        }
        return { data: null, error: null }
      }
      case 'email_place_address': {
        const value = String(args.p_value ?? '').trim()
        const key = value.toLowerCase()
        const channel = this.rows('contact_channels').find((c) => c.kind === 'email' && c.key === key)
        if (channel) {
          const contact = this.rows('contacts').find((c) => c.id === channel.contact_id)
          return { data: [{ placed_contact: channel.contact_id, placed_channel: channel.id, made: false, placed_kind: contact?.kind ?? 'unknown', placed_name: contact?.name ?? value, placed_goes_by: null }], error: null }
        }
        const contactId = `c-new-${this.nextId++}`
        const channelId = `ch-new-${this.nextId++}`
        const name = String(args.p_name ?? '').trim() || value
        this.rows('contacts').push({ id: contactId, kind: 'unknown', name })
        this.rows('contact_channels').push({ id: channelId, contact_id: contactId, kind: 'email', value, key })
        return { data: [{ placed_contact: contactId, placed_channel: channelId, made: true, placed_kind: 'unknown', placed_name: name, placed_goes_by: null }], error: null }
      }
      case 'email_write_line': {
        // The one write of an email line: it stands back on the Gmail id or the Message-ID, else writes the line and its files.
        const row = args.p_row as Row
        const rfc = typeof row.rfc_message_id === 'string' && row.rfc_message_id.trim() ? row.rfc_message_id.trim() : null
        const had = this.rows('messages').find((m) => m.gmail_id === args.p_gmail_id || (rfc !== null && m.rfc_message_id === rfc))
        if (had) return { data: [{ written: false, id: had.id }], error: null }
        const id = `m-${this.nextId++}`
        this.rows('messages').push({ ...row, id, channel: 'email', gmail_id: args.p_gmail_id, mailbox: row.mailbox ?? 'bids', rfc_message_id: rfc, tied_by: null })
        ;((args.p_files as Row[] | null) ?? []).forEach((f, i) => this.rows('message_attachments').push({ ...f, id: `ma-${this.nextId++}`, message_id: id, sort_order: i }))
        return { data: [{ written: true, id }], error: null }
      }
      default:
        return { data: null, error: { message: `no function ${fn}` } }
    }
  }
}

// ---------- Google ----------

/** Bytes as Gmail sends them: base64url. */
export function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const utf8 = (text: string) => b64url(new TextEncoder().encode(text))

/** A file a fake mail carries. */
export interface FakeFile {
  partId: string
  name: string
  mime: string
  bytes: Uint8Array
  attachmentId: string
  inline?: boolean
}

/** One mail in a fake box, as a test writes it. */
export interface FakeMail {
  id: string
  threadId: string
  labelIds: string[]
  /** ISO. */
  at: string
  headers: Record<string, string>
  text: string
  html?: string
  snippet?: string
  files?: FakeFile[]
}

export interface FakeBox {
  mails: FakeMail[]
  labels: { id: string; name: string }[]
  /** What `messages.list` answers, by page token ('' for the first page); by default every Inbox and Sent mail. */
  pages?: Record<string, { ids: string[]; next?: string }>
}

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const NEVER = ['DRAFT', 'SPAM', 'TRASH', 'CHAT']

export class FakeGoogle {
  /** Each person's box, by their address: the token's `sub`. */
  boxes: Record<string, FakeBox> = {}
  /** Addresses the token exchange refuses, with Google's answer. */
  refuse: Record<string, { status: number; body: Row }> = {}
  /** Every token's `sub`, in order. */
  subs: string[] = []
  /** Every Gmail call: `<address> GET /messages/g-1?format=full`. */
  calls: string[] = []
  /** Every `messages.list` search. */
  queries: string[] = []
  nextLabel = 1

  reset() {
    this.boxes = {}
    this.refuse = {}
    this.subs = []
    this.calls = []
    this.queries = []
    this.nextLabel = 1
  }

  /** A mail as `users.messages.get` answers it, in the format asked. */
  message(m: FakeMail, format: string, metadataHeaders: string[] = []): Row {
    const headers = Object.entries(m.headers).map(([name, value]) => ({ name, value }))
    const base = { id: m.id, threadId: m.threadId, labelIds: [...m.labelIds], internalDate: String(Date.parse(m.at)), snippet: m.snippet ?? m.text.slice(0, 80), sizeEstimate: 1000 }
    if (format === 'metadata') {
      const asked = new Set(metadataHeaders.map((h) => h.toLowerCase()))
      return { ...base, payload: { mimeType: 'multipart/mixed', headers: headers.filter((h) => asked.has(h.name.toLowerCase())) } }
    }
    if (format === 'raw') {
      const text = `${headers.map((h) => `${h.name}: ${h.value}`).join('\r\n')}\r\n\r\n${m.text}\r\n`
      return { id: m.id, threadId: m.threadId, raw: utf8(text) }
    }
    const words = [{ partId: '0.0', mimeType: 'text/plain', headers: [{ name: 'Content-Type', value: 'text/plain; charset="UTF-8"' }], body: { size: m.text.length, data: utf8(m.text) } }]
    if (m.html) words.push({ partId: '0.1', mimeType: 'text/html', headers: [{ name: 'Content-Type', value: 'text/html; charset="UTF-8"' }], body: { size: m.html.length, data: utf8(m.html) } })
    const files = (m.files ?? []).map((f) => ({
      partId: f.partId,
      mimeType: f.mime,
      filename: f.name,
      headers: f.inline
        ? [{ name: 'Content-Disposition', value: `inline; filename="${f.name}"` }, { name: 'Content-ID', value: `<${f.attachmentId}>` }]
        : [{ name: 'Content-Disposition', value: `attachment; filename="${f.name}"` }],
      body: { attachmentId: f.attachmentId, size: f.bytes.length },
    }))
    return { ...base, payload: { mimeType: 'multipart/mixed', headers, parts: [{ partId: '0', mimeType: 'multipart/alternative', parts: words }, ...files] } }
  }

  fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    const method = init?.method ?? 'GET'
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (url.href === TOKEN_URI && method === 'POST') {
      const assertion = new URLSearchParams(String(init?.body ?? '')).get('assertion') ?? ''
      const claims = JSON.parse(atob((assertion.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string; scope?: string }
      const sub = claims.sub ?? ''
      this.subs.push(sub)
      const refused = this.refuse[sub]
      if (refused) return reply(refused.status, refused.body)
      return reply(200, { access_token: `tok:${sub}`, token_type: 'Bearer', expires_in: 3600, scope: claims.scope })
    }
    if (!url.href.startsWith(GMAIL)) throw new Error(`unexpected fetch ${url.href}`)
    const sub = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '').replace(/^Bearer tok:/, '')
    const box = this.boxes[sub]
    const path = url.href.slice(GMAIL.length).split('?')[0]!
    this.calls.push(`${sub} ${method} ${path}${url.search}`)
    if (!box) return reply(400, { error: { code: 400, message: 'Mail service not enabled' } })
    const notFound = () => reply(404, { error: { code: 404, message: 'Requested entity was not found.' } })
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Row) : {}
    let m: RegExpExecArray | null
    if (path === '/messages' && method === 'GET') {
      this.queries.push(url.searchParams.get('q') ?? '')
      const token = url.searchParams.get('pageToken') ?? ''
      const max = Number(url.searchParams.get('maxResults') ?? '100')
      const page = box.pages?.[token] ?? {
        ids: [...box.mails]
          .filter((x) => (x.labelIds.includes('INBOX') || x.labelIds.includes('SENT')) && !x.labelIds.some((l) => NEVER.includes(l)))
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((x) => x.id),
      }
      const ids = page.ids.slice(0, max)
      return reply(200, { messages: ids.map((id) => ({ id, threadId: box.mails.find((x) => x.id === id)?.threadId })), ...(page.next ? { nextPageToken: page.next } : {}), resultSizeEstimate: ids.length })
    }
    if ((m = /^\/messages\/([^/]+)$/.exec(path)) && method === 'GET') {
      const mail = box.mails.find((x) => x.id === decodeURIComponent(m![1]!))
      return mail ? reply(200, this.message(mail, url.searchParams.get('format') ?? 'full', url.searchParams.getAll('metadataHeaders'))) : notFound()
    }
    if ((m = /^\/messages\/([^/]+)\/attachments\/([^/]+)$/.exec(path)) && method === 'GET') {
      const mail = box.mails.find((x) => x.id === decodeURIComponent(m![1]!))
      const file = mail?.files?.find((f) => f.attachmentId === decodeURIComponent(m![2]!))
      return file ? reply(200, { size: file.bytes.length, data: b64url(file.bytes) }) : notFound()
    }
    if ((m = /^\/messages\/([^/]+)\/modify$/.exec(path)) && method === 'POST') {
      const mail = box.mails.find((x) => x.id === decodeURIComponent(m![1]!))
      if (!mail) return notFound()
      const add = (body.addLabelIds as string[] | undefined) ?? []
      const remove = new Set((body.removeLabelIds as string[] | undefined) ?? [])
      mail.labelIds = [...new Set([...mail.labelIds.filter((l) => !remove.has(l)), ...add])]
      return reply(200, { id: mail.id, threadId: mail.threadId, labelIds: mail.labelIds })
    }
    if ((m = /^\/threads\/([^/]+)$/.exec(path)) && method === 'GET') {
      const mails = box.mails.filter((x) => x.threadId === decodeURIComponent(m![1]!)).sort((a, b) => a.at.localeCompare(b.at))
      if (mails.length === 0) return notFound()
      const format = url.searchParams.get('format') ?? 'full'
      return reply(200, { id: decodeURIComponent(m[1]!), messages: mails.map((x) => this.message(x, format, url.searchParams.getAll('metadataHeaders'))) })
    }
    if (path === '/labels' && method === 'GET') return reply(200, { labels: box.labels })
    if (path === '/labels' && method === 'POST') {
      const made = { id: `Label_${this.nextLabel++}`, name: String(body.name) }
      box.labels.push(made)
      return reply(200, made)
    }
    return reply(400, { error: { code: 400, message: `the fake has no ${method} ${path}` } })
  }
}

/** A service account's key for the real token code to sign with: made once per run, never a real one. */
export async function fakeServiceAccountJson(): Promise<string> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  let bin = ''
  for (const b of der) bin += String.fromCharCode(b)
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(bin).replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`
  return JSON.stringify({ client_email: 'reader@zz-test.iam.gserviceaccount.example', private_key: pem, token_uri: TOKEN_URI })
}
