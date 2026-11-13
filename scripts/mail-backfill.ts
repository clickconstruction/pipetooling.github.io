#!/usr/bin/env vite-node
/**
 * Mail we already have, onto its jobs (punch list #332): the run. It walks the office's mailboxes through the dev
 * seat's own verbs, matches each conversation to a Pipeline job by `src/lib/myMail/backfillMatch.ts`, and files only
 * what that rule is sure of, always for the record (`for_record`), so nothing opens on Follow up.
 *
 *   npm run mail:backfill -- count                      every open job, read-only: what would be filed, held, left out
 *   npm run mail:backfill -- plan --job JP1077          the seat's dry run for each sure conversation of one job
 *   npm run mail:backfill -- apply --job JP1077 --approved   files the planned conversations of one job
 *   npm run mail:backfill -- undo --job JP1077          takes that job's filings back off, through the seat's untag
 *
 * It needs `PT_DEV_MCP_TOKEN` (a dev key, Settings → Your account → Dev MCP keys) and a folder OUTSIDE the repo for
 * what holds real names: the never-tag list, the sheets and the ledger (`--dir`, default ~/.pipetooling/mail-backfill).
 * The repo is public: nothing this writes may be committed. `count` and `plan` write nothing to the app. `apply` asks
 * for `--approved`, files at most `--max` conversations a run (25), pauses between calls, and stops at the first
 * refusal it does not expect. The runbook is `docs/MAIL_BACKFILL.md`.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { domainOf, OPEN_MAIL_DOMAINS } from '../src/lib/emailIn/leftOutSenders'
import { subjectJobs } from '../src/lib/emailIn/subjectJobs'
import { buildLedgerPrefixMap } from '../src/lib/ledgerDisplayPrefixes'
import {
  backfillTally,
  backfillVerdict,
  conversationsOf,
  holdCrowdedJobs,
  parseAddressList,
  streetOf,
  type BackfillConversation,
  type BackfillCustomer,
  type BackfillFacts,
  type BackfillJob,
  type BackfillVerdict,
} from '../src/lib/myMail/backfillMatch'
import { appliedOf, argOf, flagOf, ledgerLine, NEVER_TAG_HEAD, plannedOf, readLedger, sheetCsv, type LedgerEntry } from './lib/mailBackfillRun'

const SEAT = 'https://mcp.clicktooling.com/dev'
const OPEN_STATUSES = ['waiting', 'working', 'ready_to_bill', 'billed']
const argv = process.argv.slice(2)
const mode = argv[0] ?? ''
const dir = argOf(argv, '--dir') ?? join(homedir(), '.pipetooling', 'mail-backfill')
const token = process.env.PT_DEV_MCP_TOKEN ?? ''
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const chunk = <T>(xs: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const lower = (s: unknown): string => String(s ?? '').trim().toLowerCase()

/** One seat verb: the answer's JSON, or its words thrown. */
async function seat<T = Record<string, unknown>>(verb: string, args: Record<string, unknown>): Promise<T> {
  const send = () =>
    fetch(SEAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-Dev-Token': token },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: verb, arguments: args } }),
    })
  // A lost connection or a gateway's 5xx is tried again, for a read alone: a filing is never sent twice.
  const mayRetry = !verb.startsWith('apply_')
  let res: Response | null = null
  for (let attempt = 0; ; attempt++) {
    try {
      res = await send()
      if (res.status < 500 || !mayRetry || attempt >= 3) break
    } catch (e) {
      if (!mayRetry || attempt >= 3) throw new Error(`${verb}: the seat could not be reached (${String((e as Error).message)}).`)
    }
    await sleep(2000 * (attempt + 1))
  }
  if (!res) throw new Error(`${verb}: the seat could not be reached.`)
  const raw = await res.text()
  const m = /\{[\s\S]*\}/.exec(raw)
  if (!m) throw new Error(`${verb}: the seat gave an answer the run cannot read (${res.status}).`)
  const body = JSON.parse(m[0]) as { error?: { message?: string }; result?: { isError?: boolean; content?: { text?: string }[] } }
  const text = body.result?.content?.[0]?.text ?? ''
  if (body.error || body.result?.isError) throw new Error(`${verb}: ${body.error?.message ?? text}`.slice(0, 500))
  try {
    return JSON.parse(text) as T
  } catch {
    // Never the answer's own text: it may hold names. A reply cut short is the usual cause.
    throw new Error(`${verb}: the seat's answer did not read as JSON (${text.length} characters). A reply that is too large is cut short: ask for fewer rows.`)
  }
}

type Row = Record<string, unknown>
/** A page of a read: the seat cuts a reply that is too large short, so the run reads a table a few rows at a time. */
const PAGE = 40
/** Every row a read matches, a page at a time by `id`, which every table the run reads carries. */
async function rows(table: string, select: string, filters: Row[] = []): Promise<Row[]> {
  const out: Row[] = []
  let after: string | null = null
  for (;;) {
    const page: Row[] = [...filters, ...(after ? [{ column: 'id', op: 'gt', value: after }] : [])]
    const got = await seat<{ data?: Row[] }>('read_rows', { table, select: /(^|,)id(,|$)/.test(select) ? select : `id,${select}`, filters: page, limit: PAGE, order: [{ column: 'id', ascending: true }] })
    const data = got.data ?? []
    out.push(...data)
    if (data.length < PAGE) return out
    after = String(data[data.length - 1]!.id)
  }
}
async function rowsIn(table: string, select: string, column: string, ids: readonly string[], size = 30): Promise<Row[]> {
  const out: Row[] = []
  for (const part of chunk(ids, size)) out.push(...(await rows(table, select, [{ column, op: 'in', value: part }])))
  return out
}

interface JobRow extends Row {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id: string | null
  gc_customer_id: string | null
  service_type_id: string | null
  created_at: string | null
  status: string | null
}
const JOB_COLUMNS = 'id,hcp_number,click_number,job_name,job_address,customer_id,gc_customer_id,service_type_id,created_at,status'

interface Loaded {
  facts: BackfillFacts
  targets: JobRow[]
  labelOf: Map<string, string>
  accounts: string[]
  skippedAccounts: number
}

/** Everything the rule reads: the jobs, their customers' addresses, the company's own addresses, the never-tag list. */
async function load(counting = false): Promise<Loaded> {
  const neverPath = join(dir, 'never-tag.txt')
  if (!existsSync(neverPath)) throw new Error(`No never-tag list at ${neverPath}. Run "seed" first, then have the office add to it.`)
  const neverTag = parseAddressList(readFileSync(neverPath, 'utf8'))
  if (neverTag.addresses.size + neverTag.domains.size === 0) {
    // A count files nothing, so it may size the run before the office has named its list. Nothing else may.
    if (!counting) throw new Error(`The never-tag list at ${neverPath} is empty. The run does not start without one.`)
    console.warn('  NOTE: the never-tag list is empty, so this count leaves nothing out for it. A plan or a filing will not start until the office names it.')
  }

  const targets: JobRow[] = []
  for (const status of OPEN_STATUSES) targets.push(...((await rows('jobs_ledger', JOB_COLUMNS, [{ column: 'status', op: 'eq', value: status }])) as JobRow[]))
  const customerIds = [...new Set(targets.flatMap((j) => [j.customer_id, j.gc_customer_id]).filter((x): x is string => !!x))]
  // Every job of those customers, whatever its status: one open job is not the only job.
  const all = new Map<string, JobRow>(targets.map((j) => [j.id, j]))
  for (const column of ['customer_id', 'gc_customer_id']) for (const j of (await rowsIn('jobs_ledger', JOB_COLUMNS, column, customerIds, 15)) as JobRow[]) all.set(j.id, j)

  const customers = new Map<string, Set<string>>(customerIds.map((id) => [id, new Set<string>()]))
  for (const c of await rowsIn('customers', 'id,contact_info,billing_email', 'id', customerIds)) {
    const info = (c.contact_info ?? {}) as { email?: unknown }
    for (const a of [info.email, c.billing_email]) if (lower(a).includes('@')) customers.get(String(c.id))?.add(lower(a))
  }
  for (const p of await rowsIn('customer_contact_persons', 'customer_id,email', 'customer_id', customerIds)) if (lower(p.email).includes('@')) customers.get(String(p.customer_id))?.add(lower(p.email))

  const prefixes = buildLedgerPrefixMap((await rows('service_types', 'id,ledger_job_prefix,ledger_bid_prefix')) as { id: string }[])
  const labelled = subjectJobs({ bids: [], projects: [], pipeline: [...all.values()], prefixes }, new Set())
  const labels = new Map(labelled.map((j) => [j.key, j.labels]))
  const jobs: BackfillJob[] = [...all.values()].map((j) => ({
    key: `pipeline:${j.id}`,
    labels: labels.get(`pipeline:${j.id}`) ?? [],
    name: (j.job_name ?? '').trim(),
    address: j.job_address,
    customerIds: [j.customer_id, j.gc_customer_id].filter((x): x is string => !!x),
    startsAt: j.created_at,
  }))
  const labelOf = new Map(jobs.map((j) => [j.key, j.labels[0] ?? j.name ?? j.key]))

  // The company's own: every login, and each login's domain unless it is an open mail service.
  const users = await rows('users', 'email,archived_at,my_mail_on,role')
  const ours = { addresses: new Set(users.map((u) => lower(u.email)).filter(Boolean)), domains: new Set<string>() }
  for (const a of ours.addresses) if (domainOf(a) && !OPEN_MAIL_DOMAINS.has(domainOf(a))) ours.domains.add(domainOf(a))
  // Whose mailboxes: the logins the seat can read (one probe search names them, and the ones Google has no mailbox
  // for), kept only while the person is current and their My email switch is on. The seat would allow a switched-off
  // one; the run does not.
  const probe = await seat<{ accounts?: { account?: string }[]; refused?: { account?: string }[] }>('search_mail', { q: 'rfc822msgid:none-such-message', max: 1 })
  const gone = new Set((probe.refused ?? []).map((r) => lower(r.account)))
  const readable = (probe.accounts ?? []).map((a) => lower(a.account)).filter((a) => a && !gone.has(a))
  const on = new Set(users.filter((u) => !u.archived_at && u.my_mail_on === true).map((u) => lower(u.email)))
  const accounts = readable.filter((a) => on.has(a))

  // The customers who also have a bid or a GC project with us: their mail may be about that, not the job.
  const busyCustomers = new Set<string>()
  for (const table of ['bids', 'projects']) for (const r of await rowsIn(table, 'id,customer_id', 'customer_id', customerIds, 15)) if (r.customer_id) busyCustomers.add(String(r.customer_id))

  const facts: BackfillFacts = {
    jobs,
    busyCustomers,
    targets: new Set(targets.map((j) => `pipeline:${j.id}`)),
    customers: [...customers].map(([id, addresses]): BackfillCustomer => ({ id, addresses: [...addresses] })),
    ours,
    neverTag,
  }
  return { facts, targets, labelOf, accounts, skippedAccounts: readable.length - accounts.length }
}

interface Hit {
  account: string
  id: string
  thread_id: string
  date: string | null
  from: string
  to: string[] | string
  cc: string[] | string
  subject: string
  snippet: string
  labels: string[]
}
const list = (v: string[] | string | null | undefined): string[] => (Array.isArray(v) ? v : String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean))

/**
 * One search of the allowed mailboxes. The seat cuts a reply that is too large short, so the first call asks every
 * mailbox for a few hits, and a mailbox that has more is then read alone, a page at a time going back by date
 * (`until`). `capped` counts the mailboxes whose hits could not all be read.
 */
const FIRST_MAX = 8
/** The seat takes a search of at most 500 characters. */
const QUERY_MAX = 480
const PAGE_MAX = 50
const PAGES = 12
type SearchAnswer = { hits?: Hit[]; accounts?: { account?: string; more?: boolean }[]; refused?: unknown[] }
async function search(q: string, accounts: readonly string[]): Promise<{ hits: Hit[]; capped: number; refused: number }> {
  const first = await seat<SearchAnswer>('search_mail', { q, max: FIRST_MAX, accounts })
  const hits = [...(first.hits ?? [])]
  let capped = 0
  for (const box of (first.accounts ?? []).filter((a) => a.more === true && a.account)) {
    let until: string | null = null
    let done = false
    for (let page = 0; page < PAGES && !done; page++) {
      const got: SearchAnswer = await seat<SearchAnswer>('search_mail', { q, max: PAGE_MAX, accounts: [box.account], ...(until ? { until } : {}) })
      const page_hits = got.hits ?? []
      hits.push(...page_hits)
      done = got.accounts?.[0]?.more !== true
      // The next page: everything before the day after this page's oldest mail. A page that does not go back ends it.
      const oldest = page_hits.map((h) => h.date ?? '').filter(Boolean).sort()[0]
      const next = oldest ? new Date(Date.parse(oldest) + 86_400_000).toISOString().slice(0, 10) : null
      if (!done && (!next || next === until)) break
      until = next
    }
    if (!done) capped += 1
  }
  return { hits, capped, refused: (first.refused ?? []).length }
}

/** The conversations that could be a set of jobs': by their customers' addresses, their streets and their numbers. */
async function gather(l: Loaded, only: ReadonlySet<string> | null): Promise<{ conversations: BackfillConversation[]; searches: number; capped: number; refused: number }> {
  const jobs = l.facts.jobs.filter((j) => l.facts.targets.has(j.key) && (!only || only.has(j.key)))
  const wanted = new Set(jobs.flatMap((j) => j.customerIds))
  // Each search, and the job whose street it looks for when it is one: such a hit names that street somewhere in its words.
  const queries: string[] = []
  const streetOfQuery = new Map<string, string>()
  // A customer's addresses, as many a search as its 500 characters take. Gmail reads `{a b}` as either.
  for (const c of l.facts.customers) {
    if (!wanted.has(c.id)) continue
    let q = ''
    for (const address of c.addresses) {
      const clause = `{from:${address} to:${address} cc:${address}}`
      if (q && q.length + clause.length + 4 > QUERY_MAX) {
        queries.push(q)
        q = ''
      }
      q = q ? `${q} OR ${clause}` : clause
    }
    if (q) queries.push(q)
  }
  for (const j of jobs) {
    const street = streetOf(j.address)
    if (street) {
      const q = `"${street.number} ${street.name}"`
      if (!streetOfQuery.has(q)) queries.push(q)
      // Two jobs at one street share the search; the rule tells them apart by their dates.
      streetOfQuery.set(q, streetOfQuery.has(q) ? `${streetOfQuery.get(q)}\n${j.key}` : j.key)
    }
    for (const label of j.labels) queries.push(`subject:"${label}"`)
  }
  const hits = new Map<string, Hit>()
  const streets = new Map<string, Set<string>>()
  let capped = 0
  let refused = 0
  let n = 0
  for (const q of queries) {
    const got = await search(q, l.accounts)
    capped += got.capped
    refused = Math.max(refused, got.refused)
    for (const h of got.hits) {
      const id = `${h.account}\n${h.id}`
      hits.set(id, h)
      for (const key of (streetOfQuery.get(q) ?? '').split('\n').filter(Boolean)) (streets.get(id) ?? streets.set(id, new Set()).get(id)!).add(key)
    }
    if (++n % 20 === 0) console.log(`  searched ${n} of ${queries.length}`)
    await sleep(250)
  }
  const conversations = conversationsOf(
    [...hits].map(([id, h]) => ({ account: lower(h.account), threadId: h.thread_id, from: h.from, to: list(h.to), cc: list(h.cc), subject: h.subject ?? '', snippet: h.snippet ?? '', date: h.date, labels: h.labels ?? [], streetJobs: [...(streets.get(id) ?? [])] })),
  )
  return { conversations, searches: queries.length, capped, refused }
}

/** The job a `--job` names: its number as the app shows it, or its id. */
function jobOf(l: Loaded, asked: string): BackfillJob {
  const want = asked.trim().toLowerCase()
  const found = l.facts.jobs.filter((j) => l.facts.targets.has(j.key) && (j.key === `pipeline:${want}` || j.labels.some((x) => x.toLowerCase() === want)))
  if (found.length !== 1) throw new Error(`"${asked}" names ${found.length} open jobs. Give a number the app shows, or the job's id.`)
  return found[0]!
}

const stamp = () => new Date().toISOString()
const ledgerPath = () => join(dir, 'ledger.jsonl')
const record = (entry: LedgerEntry) => appendFileSync(ledgerPath(), ledgerLine(entry))

async function count(): Promise<void> {
  const l = await load(true)
  console.log(`open jobs: ${l.targets.length} · every job of their customers: ${l.facts.jobs.length} · customers: ${l.facts.customers.length}, of whom ${l.facts.busyCustomers?.size ?? 0} also have a bid or a project · mailboxes searched: ${l.accounts.length} (${l.skippedAccounts} left out: My email switched off, or no longer a current login)`)
  const g = await gather(l, null)
  const judged = holdCrowdedJobs(g.conversations.map((c) => backfillVerdict(c, l.facts)))
  const verdicts = g.conversations.map((c, i): [BackfillConversation, BackfillVerdict] => [c, judged[i]!])
  const tally = backfillTally(verdicts.map(([, v]) => v))
  // One conversation in two mailboxes is planned once for each; say how many distinct threads the sure ones are.
  const sure = verdicts.filter(([, v]) => v.kind === 'sure')
  const perJob = new Map<string, { conversations: number; mails: number; accounts: Set<string>; rules: Record<string, number> }>()
  for (const [c, v] of sure) {
    if (v.kind !== 'sure') continue
    const row = perJob.get(v.jobKey) ?? { conversations: 0, mails: 0, accounts: new Set<string>(), rules: {} }
    row.conversations += 1
    row.mails += c.mails.length
    row.accounts.add(c.account)
    row.rules[v.rule] = (row.rules[v.rule] ?? 0) + 1
    perJob.set(v.jobKey, row)
  }
  // The senders a filing would make unnamed: outside addresses on a sure conversation that no contact holds yet.
  const outside = new Set<string>()
  for (const [c] of sure) for (const m of c.mails) for (const a of [m.from, ...m.to, ...m.cc]) {
    const address = lower(/<([^<>]+)>\s*$/.exec(a)?.[1] ?? a)
    if (address.includes('@') && !l.facts.ours.addresses.has(address) && !l.facts.ours.domains.has(domainOf(address))) outside.add(address)
  }
  const held = new Set<string>()
  for (const part of chunk([...outside], 30)) for (const ch of await rows('contact_channels', 'key', [{ column: 'kind', op: 'eq', value: 'email' }, { column: 'key', op: 'in', value: part }])) held.add(lower(ch.key))
  const years: Record<string, number> = {}
  for (const [c] of sure) {
    const y = (c.mails[c.mails.length - 1]?.date ?? '').slice(0, 4) || 'no date'
    years[y] = (years[y] ?? 0) + 1
  }
  const sizes = [...perJob.values()].map((r) => r.conversations).sort((a, b) => a - b)
  console.log(`searches: ${g.searches} · mailboxes whose hits could not all be read, summed over searches: ${g.capped} · logins Google has no mailbox for: ${g.refused}`)
  console.log(`conversations found: ${g.conversations.length}`)
  console.log(`  sure: ${tally.sure} · held for a person: ${tally.held} · left out: ${tally.out}`)
  console.log(`  by rule or reason: ${JSON.stringify(tally.by)}`)
  console.log(`  distinct threads among the sure ones: ${new Set(sure.map(([c]) => c.threadId)).size} · mails in them: ${sure.reduce((n, [c]) => n + c.mails.length, 0)}`)
  console.log(`  sure conversations by the year of their newest mail: ${JSON.stringify(years)}`)
  console.log(`open jobs with at least one sure conversation: ${perJob.size} of ${l.targets.length}` + (sizes.length ? ` · conversations a job, least/middle/most: ${sizes[0]}/${sizes[Math.floor(sizes.length / 2)]}/${sizes[sizes.length - 1]}` : ''))
  console.log(`outside addresses on sure conversations: ${outside.size} · with no contact yet (a filing would make each an unnamed sender): ${outside.size - held.size}`)
  const sheet = join(dir, 'sheets', `count-${stamp().slice(0, 10)}.csv`)
  mkdirSync(join(dir, 'sheets'), { recursive: true })
  writeFileSync(
    sheet,
    sheetCsv(
      ['kind', 'rule or reason', 'job', 'other jobs it could be', 'mailbox', 'thread', 'mails', 'newest mail', 'subject'],
      verdicts.map(([c, v]) => [
        v.kind,
        v.kind === 'sure' ? v.rule : v.reason,
        v.kind === 'sure' ? (l.labelOf.get(v.jobKey) ?? v.jobKey) : v.kind === 'out' && v.jobKey ? (l.labelOf.get(v.jobKey) ?? v.jobKey) : '',
        v.kind === 'held' ? v.jobKeys.map((k) => l.labelOf.get(k) ?? k).join(' / ') : '',
        c.account,
        c.threadId,
        String(c.mails.length),
        (c.mails[c.mails.length - 1]?.date ?? '').slice(0, 10),
        c.mails[c.mails.length - 1]?.subject ?? '',
      ]),
    ),
  )
  console.log(`the sheet, with real names, outside the repo: ${sheet}`)
}

async function plan(): Promise<void> {
  const l = await load()
  const job = jobOf(l, argOf(argv, '--job') ?? '')
  const g = await gather(l, new Set([job.key]))
  const judged = holdCrowdedJobs(g.conversations.map((c) => backfillVerdict(c, l.facts)))
  const sure = g.conversations.filter((_, i) => {
    const v = judged[i]!
    return v.kind === 'sure' && v.jobKey === job.key
  })
  console.log(`${l.labelOf.get(job.key)}: ${sure.length} sure conversations of ${g.conversations.length} found. Planning each, nothing is written.`)
  const lines: string[][] = []
  for (const c of sure) {
    const v = backfillVerdict(c, l.facts)
    const tag = { account: c.account, thread_id: c.threadId, job: { jobs_ledger_id: job.key.slice('pipeline:'.length) }, for_record: true }
    try {
      const p = await seat<{ plan_hash: string; counts: Record<string, number>; reading: string; moving_from: string | null }>('plan_mail_tag', { tag })
      record({ at: stamp(), kind: 'plan', jobKey: job.key, account: c.account, threadId: c.threadId, planHash: p.plan_hash, counts: p.counts, rule: v.kind === 'sure' ? v.rule : '' })
      lines.push([c.account, c.threadId, v.kind === 'sure' ? v.rule : '', String(p.counts.lines ?? 0), String(p.counts.tied ?? 0), String(p.counts.files ?? 0), String(p.counts.filed ?? 0), p.moving_from ?? '', c.mails[c.mails.length - 1]?.subject ?? '', ''])
    } catch (e) {
      record({ at: stamp(), kind: 'refused', jobKey: job.key, account: c.account, threadId: c.threadId, words: String((e as Error).message) })
      lines.push([c.account, c.threadId, '', '', '', '', '', '', c.mails[c.mails.length - 1]?.subject ?? '', String((e as Error).message)])
    }
    await sleep(400)
  }
  const sheet = join(dir, 'sheets', `plan-${(l.labelOf.get(job.key) ?? 'job').replace(/[^A-Za-z0-9]+/g, '-')}-${stamp().slice(0, 10)}.csv`)
  mkdirSync(join(dir, 'sheets'), { recursive: true })
  writeFileSync(sheet, sheetCsv(['mailbox', 'thread', 'rule', 'lines to write', 'lines to tie', 'files', 'filed for the record', 'moves off', 'subject', 'refused'], lines))
  const totals = lines.reduce((t, r) => ({ write: t.write + Number(r[3] || 0), tie: t.tie + Number(r[4] || 0), files: t.files + Number(r[5] || 0), refused: t.refused + (r[9] ? 1 : 0) }), { write: 0, tie: 0, files: 0, refused: 0 })
  console.log(`planned: ${lines.length - totals.refused} · refused: ${totals.refused} · lines to write: ${totals.write} · to tie: ${totals.tie} · files: ${totals.files}`)
  console.log(`the sheet for a person to approve, outside the repo: ${sheet}`)
}

async function apply(): Promise<void> {
  if (!flagOf(argv, '--approved')) throw new Error('apply files mail onto a job. A person reads the plan sheet first, then the run is given --approved.')
  const l = await load()
  const job = jobOf(l, argOf(argv, '--job') ?? '')
  const max = Number(argOf(argv, '--max') ?? 25)
  const todo = plannedOf(readLedger(ledgerPath()), job.key).slice(0, max)
  console.log(`${l.labelOf.get(job.key)}: filing ${todo.length} planned conversations (at most ${max} a run).`)
  let filed = 0
  for (const p of todo) {
    const tag = { account: p.account, thread_id: p.threadId, job: { jobs_ledger_id: job.key.slice('pipeline:'.length) }, for_record: true }
    try {
      const done = await seat<Record<string, unknown>>('apply_mail_tag', { tag, plan_hash: p.planHash })
      record({ at: stamp(), kind: 'applied', jobKey: job.key, account: p.account, threadId: p.threadId, planHash: p.planHash, words: String(done.tagged ?? '') })
      filed += 1
    } catch (e) {
      // A plan that no longer holds is planned again by a person's next `plan`; anything else stops the run.
      const words = String((e as Error).message)
      record({ at: stamp(), kind: 'refused', jobKey: job.key, account: p.account, threadId: p.threadId, planHash: p.planHash, words })
      if (!/plan again|changed since|no longer/i.test(words)) {
        console.error(`stopped at a refusal the run does not expect: ${words}`)
        break
      }
    }
    await sleep(1500)
  }
  console.log(`filed: ${filed} of ${todo.length}. The ledger: ${ledgerPath()}`)
}

async function undo(): Promise<void> {
  const l = await load()
  const job = jobOf(l, argOf(argv, '--job') ?? '')
  const todo = appliedOf(readLedger(ledgerPath()), job.key)
  console.log(`${l.labelOf.get(job.key)}: taking back ${todo.length} filings through the seat's untag.`)
  let back = 0
  for (const a of todo) {
    const untag = { account: a.account, thread_id: a.threadId }
    try {
      const p = await seat<{ plan_hash: string }>('plan_mail_untag', { untag })
      await seat('apply_mail_untag', { untag, plan_hash: p.plan_hash })
      record({ at: stamp(), kind: 'untagged', jobKey: job.key, account: a.account, threadId: a.threadId })
      back += 1
    } catch (e) {
      record({ at: stamp(), kind: 'refused', jobKey: job.key, account: a.account, threadId: a.threadId, words: String((e as Error).message) })
      console.error(`  not taken back: ${String((e as Error).message).slice(0, 200)}`)
    }
    await sleep(1500)
  }
  console.log(`taken back: ${back} of ${todo.length}.`)
}

/** The never-tag list's first lines: the law firm's people the app already knows. The office adds the rest. */
async function seed(): Promise<void> {
  const path = join(dir, 'never-tag.txt')
  if (existsSync(path)) throw new Error(`${path} is there already. Edit it by hand.`)
  const firm = await rows('legal_firm_recipients', 'email')
  const addresses = [...new Set(firm.map((r) => lower(r.email)).filter((a) => a.includes('@')))]
  const domains = [...new Set(addresses.map(domainOf).filter((d) => d && !OPEN_MAIL_DOMAINS.has(d)))]
  mkdirSync(dir, { recursive: true })
  writeFileSync(path, `${NEVER_TAG_HEAD}\n${domains.map((d) => `@${d}`).join('\n')}\n${addresses.filter((a) => OPEN_MAIL_DOMAINS.has(domainOf(a))).join('\n')}\n`)
  console.log(`seeded ${path} with ${domains.length} domain(s) from the law firm's people. The office adds the accountant, payroll, the bank and anyone else.`)
}

const MODES: Record<string, () => Promise<void>> = { seed, count, plan, apply, undo }
if (!MODES[mode]) {
  console.error('usage: npm run mail:backfill -- seed | count | plan --job <number> | apply --job <number> --approved [--max 25] | undo --job <number>   [--dir <folder outside the repo>]')
  process.exit(2)
}
if (!token) {
  console.error('PT_DEV_MCP_TOKEN is not set. Issue a dev key in Settings → Your account → Dev MCP keys.')
  process.exit(2)
}
mkdirSync(dir, { recursive: true })
MODES[mode]!().catch((e: unknown) => {
  console.error(String((e as Error).message ?? e))
  process.exit(1)
})
