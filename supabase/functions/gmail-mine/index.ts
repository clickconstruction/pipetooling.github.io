/**
 * gmail-mine: Messages → My email (punch list #230 PR 2, `to-dos/messages-my-email/README.md`). The tab on
 * `/messages?tab=my-email` (PR 3) reads the signed-in person's own Inbox and Sent through this function, live, and keeps
 * nothing until the person tags a Gmail conversation onto a job or a bid. It reads Gmail as that person under the
 * service account's domain-wide delegation, the one the bids@ reader holds (`gmail.modify`), as their own `users.email`
 * and no other address. The contract is `src/lib/myMail/contract.ts`; the pure half is `src/lib/myMail/mineFunction.ts`
 * over PR 1's kernels (`rows.ts`, `mailGuess.ts`, `tagPlan.ts`, `view.ts`), all through the edge copy.
 *
 * One POST, a `MyMailRequest`:
 * - `list` ({ view, q?, pageToken?, labels? }): one page of 50 of the Inbox and the Sent box, newest first (`myMailQuery`:
 *   never Drafts, Spam, Trash or Chats, never a label the person left out, their own search as one group), each mail read
 *   whole ten at a time into a row (`readMyMail`), then filled from the database: `tagged` (`email_tag_threads`, the
 *   job's chip), `inMessages` (a line already holding the mail's Message-ID) and the guess (`guessJob`, never acted on).
 *   The view (`viewRows`) decides the rows answered; `folded` counts the ones behind its fold line. Nothing is kept.
 * - `open` ({ gmailId }): one mail whole, its row filled as above, its addresses, words, HTML and files, and the rest of
 *   its conversation as rows (`format=metadata`). Nothing is kept.
 * - `tag` ({ threadId, job }): the conversation whole, planned by `planTag`, then step by step: a line the boxes or an
 *   earlier tag hold is tied through `tie_message` as the caller (it stamps `tied_by`); any other mail is placed
 *   (`email_place_address`), its files copied into `message-attachments` under `mine/`, its line written through
 *   `email_write_line` (the same Message-ID fence the boxes use, so nothing is written twice) and its raw mail kept as
 *   `mine/<line id>.eml`. Then the `email_tag_threads` row, and the Gmail label *Tagged in ClickTooling* on its mail. A
 *   step the database refuses stops the tag with its words; what was written stays, and a second tag finishes it.
 * - `untag` ({ threadId }): the person's own lines of the conversation go, with their files and raw copies; a line the
 *   boxes wrote stays, untied when the tag tied it; the `email_tag_threads` row goes, and the label comes off.
 *
 * The caller, as `messages-email` gates one: signed in (`auth.getUser()`), a real account (never a sample, a twin or the
 * walk tester, who has no mailbox), on the office team (`gc_office_team()` asked as them), with their switch on
 * (`users.my_mail_on`). A training account (`read_only`) may list and open, never tag or untag. Every answer is the
 * contract's, with the CORS headers; a refusal's status is its kind's (`MY_MAIL_REFUSAL_STATUS`), and a step the
 * database refused mid-way answers 500. Each call logs one line of counts, never a subject, an address or a body.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON (the reader's),
 * GMAIL_IMPERSONATE_USER (bids@, so a copy from the box reads as ours), EMAIL_FROM. config.toml keeps verify_jwt =
 * false: the caller's session is checked here.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import {
  GMAIL_SCOPES,
  GmailError,
  gmailAddLabel,
  gmailAttachment,
  gmailLabelId,
  gmailLabels,
  gmailMessage,
  gmailMessagePage,
  gmailMessageRaw,
  gmailRemoveLabel,
  gmailThreadFull,
  gmailThreadHeaders,
} from '../_shared/gmail.ts'
import { googleServiceToken } from '../_shared/googleToken.ts'
import { emailFileRows, KEEP_FILE_BYTES, rfcMessageId } from '../_shared/gcKernels/lib/emailIn/emailLine.ts'
import { base64UrlBytes, parseAddress, readGmailMessage, type EmailIn } from '../_shared/gcKernels/lib/emailIn/gmailMessage.ts'
import { invitation } from '../_shared/gcKernels/lib/emailIn/invitation.ts'
import { leftOutSenders, type LeftOutSenderRow } from '../_shared/gcKernels/lib/emailIn/leftOutSenders.ts'
import { readerBoxes } from '../_shared/gcKernels/lib/emailIn/readerBoxes.ts'
import { buildLedgerPrefixMap, type LedgerPrefixMap } from '../_shared/gcKernels/lib/ledgerDisplayPrefixes.ts'
import { BOXES_SETTINGS_KEY, parseBoxSettings } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { jobKey, jobKeyOfRow } from '../_shared/gcKernels/lib/messages/jobKeys.ts'
import { ownChannels } from '../_shared/gcKernels/lib/messages/ownChannels.ts'
import { isFixtureAccount } from '../_shared/gcKernels/lib/walk/kitDoor.ts'
import {
  MY_MAIL_GMAIL_LABEL,
  MY_MAIL_PAGE,
  myMailRefusal,
  type MyMailJobChip,
  type MyMailJobRef,
  type MyMailListOk,
  type MyMailListRequest,
  type MyMailOpenOk,
  type MyMailOpenRequest,
  type MyMailRefusal,
  type MyMailRow,
  type MyMailTagOk,
  type MyMailTagRequest,
  type MyMailUntagOk,
  type MyMailUntagRequest,
} from '../_shared/gcKernels/lib/myMail/contract.ts'
import { MY_MAIL_NOT_SIGN_IN_WORDS, imitationsSince, isSignInAddress, openedByImitation, sessionLinkAt } from '../_shared/gcKernels/lib/myMail/imitation.ts'
import { guessJob } from '../_shared/gcKernels/lib/myMail/mailGuess.ts'
import { MY_MAIL_METADATA_HEADERS, readMyMail, type MyMailGmailMessage, type MyMailRead, type MyMailReader } from '../_shared/gcKernels/lib/myMail/rows.ts'
import { MY_MAIL_MAILBOX, planTag } from '../_shared/gcKernels/lib/myMail/tagPlan.ts'
import { viewRows } from '../_shared/gcKernels/lib/myMail/view.ts'
import {
  MY_MAIL_BUCKET,
  MY_MAIL_EML_MIME,
  MY_MAIL_READ_CHUNK,
  MY_MAIL_REFUSAL_STATUS,
  MY_MAIL_STOPPED_STATUS,
  contactJobsOf,
  contactsByAddress,
  customerOpenJobs,
  domainCustomers,
  domainFilter,
  filledRow,
  gmailRefusal,
  knownLines,
  myMailAddressKey,
  myMailBodyHtml,
  myMailEmlPath,
  myMailFileList,
  myMailFilePath,
  myMailFileRow,
  myMailGuessAsks,
  myMailGuessFacts,
  myMailJobs,
  myMailLineRow,
  myMailOurDomains,
  myMailParties,
  myMailQuery,
  myMailTeam,
  neverRead,
  parseMyMailRequest,
  planUntag,
  stoppedRefusal,
  tokenRefusal,
  wantsGuess,
  type MyMailBidRow,
  type MyMailCustomerPersonRow,
  type MyMailCustomerRow,
  type MyMailHeldLine,
  type MyMailLine,
  type MyMailPageFacts,
  type MyMailPipelineRow,
  type MyMailProjectRow,
} from '../_shared/gcKernels/lib/myMail/mineFunction.ts'

/** The roles whose addresses are ours, as the bids@ reader's `loadTeam` reads them. A sub or a helper is someone we write to. */
const STAFF_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']
const USER_COLUMNS = 'id, name, email, read_only, is_sample, is_digital_twin, is_walk_tester, my_mail_on, my_mail_hidden_labels'
const LINE_COLUMNS = 'id, gmail_id, rfc_message_id, bid_id, project_id, jobs_ledger_id, mail_user_id'
const HELD_COLUMNS = 'id, contact_id, rfc_message_id, bid_id, project_id, jobs_ledger_id, mailbox, mail_user_id'
const BID_COLUMNS = 'id, bid_number, project_name, service_type_id, outcome'
const PIPELINE_COLUMNS = 'id, hcp_number, click_number, job_name, service_type_id, status, customer_id, gc_customer_id'
/** How many values one `in` filter carries: a page's Message-IDs run long. */
const IN_CHUNK = 40
/** How long a read waits before its one try again, when Gmail says the box is read too fast (429). */
const RETRY_MS = 1000

// deno-lint-ignore no-explicit-any
type Admin = any

interface Me {
  id: string
  name: string
  /** The person's own address, trimmed: the only mailbox the function ever reads as. */
  email: string
  readOnly: boolean
  hiddenLabels: string[]
}

interface Ctx {
  admin: Admin
  caller: Admin
  token: string
  me: Me
}

interface Box {
  reader: MyMailReader
  /** The boxes' addresses and the app's sender: a mail from one is a copy of ours. */
  boxes: string[]
}

// The tab calls from the browser: the preflight is answered, and every answer carries the CORS headers.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** One line per call: the event and its counts, never a subject, an address or a body. */
const log = (event: Record<string, unknown>) => console.log(JSON.stringify(event))

function refuse(r: MyMailRefusal, status: number = MY_MAIL_REFUSAL_STATUS[r.error], action: string | null = null): Response {
  log({ event: 'gmail_mine_refused', action, error: r.error, status })
  return json(r, status)
}

/** A step that cannot go on: the answer the call stops with. */
class Stop extends Error {
  refusal: MyMailRefusal
  status: number
  constructor(refusal: MyMailRefusal, status: number) {
    super(refusal.words)
    this.refusal = refusal
    this.status = status
  }
}

const stopped = (what: string, reason: string) => new Stop(stoppedRefusal(what, reason), MY_MAIL_STOPPED_STATUS)
const asGoogle = (e: GmailError, missing = false) => {
  const r = gmailRefusal(e, missing)
  return new Stop(r, MY_MAIL_REFUSAL_STATUS[r.error])
}
const words = (e: unknown): string => (e instanceof Error ? e.message : String(e))
const nowIso = () => new Date().toISOString()
const unique = (list: readonly (string | null | undefined)[]): string[] => [...new Set(list.filter((v): v is string => typeof v === 'string' && v !== ''))]
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms))

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query
  if (error) throw stopped(`Reading ${what} failed.`, error.message)
  return data ?? []
}

/** Rows whose column holds one of many values, read `IN_CHUNK` values at a time. */
async function rowsIn<T>(values: readonly string[], query: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < values.length; i += IN_CHUNK) out.push(...(await rows(query(values.slice(i, i + IN_CHUNK)), what)))
  return out
}

/** A Gmail call, a refusal of Google's when it fails. `missing`: the call names one mail or conversation, and a 404 is notFound. */
async function gmail<T>(call: () => Promise<T>, missing = false): Promise<T> {
  try {
    return await call()
  } catch (e) {
    if (e instanceof GmailError) throw asGoogle(e, missing)
    throw e
  }
}

// ---------- what every read needs ----------

/** The boxes, the app's sender and the office's notice list: what a row folds by, as the bids@ reader leaves mail out. */
async function loadBox(admin: Admin, me: Me): Promise<Box> {
  const [{ data: setting }, notices] = await Promise.all([
    admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle(),
    rows<LeftOutSenderRow>(admin.from('email_left_out_senders').select('value, kind, mailbox'), 'the senders marked a notice'),
  ])
  const settings = parseBoxSettings(setting?.value_text)
  const appFrom = parseAddress(EMAIL_FROM)?.address ?? null
  const read = readerBoxes(settings, Deno.env.get('GMAIL_IMPERSONATE_USER')).map((b) => b.address)
  const boxes = [...ownChannels(settings, appFrom, read).addresses]
  return { reader: { address: me.email, boxes, isNotice: leftOutSenders(notices, MY_MAIL_MAILBOX) }, boxes }
}

async function loadPrefixes(admin: Admin): Promise<LedgerPrefixMap> {
  return buildLedgerPrefixMap(await rows(admin.from('service_types').select('id, ledger_job_prefix, ledger_bid_prefix'), 'the job prefixes'))
}

/** One message whole, once more after a pause when Gmail says the box is read too fast. Null when Gmail has it no more. */
async function readOne(token: string, id: string): Promise<MyMailGmailMessage | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await gmailMessage(token, id)) as MyMailGmailMessage
    } catch (e) {
      if (e instanceof GmailError && e.status === 404) return null
      if (e instanceof GmailError && e.status === 429 && attempt === 0) {
        await pause(RETRY_MS)
        continue
      }
      if (e instanceof GmailError) throw asGoogle(e)
      throw e
    }
  }
}

/** A page's messages whole, ten at a time, in the page's order. */
async function readAll(token: string, ids: readonly string[]): Promise<MyMailGmailMessage[]> {
  const out: MyMailGmailMessage[] = []
  for (let i = 0; i < ids.length; i += MY_MAIL_READ_CHUNK) {
    for (const m of await Promise.all(ids.slice(i, i + MY_MAIL_READ_CHUNK).map((id) => readOne(token, id)))) if (m) out.push(m)
  }
  return out
}

// ---------- the jobs: their chips, whether they are open ----------

interface JobAsk {
  bid: string[]
  project: string[]
  pipeline: string[]
}

const jobAsk = (keys: readonly (string | null)[]): JobAsk => {
  const ask: JobAsk = { bid: [], project: [], pipeline: [] }
  for (const key of unique(keys)) {
    const at = key.indexOf(':')
    const kind = key.slice(0, at)
    if (kind === 'bid' || kind === 'project' || kind === 'pipeline') ask[kind].push(key.slice(at + 1))
  }
  return ask
}

/**
 * The jobs by id, and the ones the subjects' numbers name, as `gmail-sync`'s `jobFor` reads them: a bid by its number, a
 * GC project by its number (only a project `gc_projects` holds), a Pipeline job by its HCP number or its Click number.
 */
async function loadJobs(admin: Admin, ask: JobAsk, numbers: readonly string[], more: readonly MyMailPipelineRow[] = []) {
  const nums = [...numbers]
  const inList = (vals: string[]) => vals.map((v) => `"${v}"`).join(',')
  const clicks = [...nums, ...nums.map((n) => `C${n}`)]
  const [bidsById, bidsByNum, projectsById, projectsByNum, jobsById, jobsByNum, prefixes] = await Promise.all([
    rowsIn<MyMailBidRow>(ask.bid, (c) => admin.from('bids').select(BID_COLUMNS).in('id', c), 'the bids'),
    nums.length ? rows<MyMailBidRow>(admin.from('bids').select(BID_COLUMNS).in('bid_number', nums).limit(200), 'the bids') : [],
    rowsIn<{ id: string; project_number: string | null; name: string | null }>(ask.project, (c) => admin.from('projects').select('id, project_number, name').in('id', c), 'the projects'),
    nums.length ? rows<{ id: string; project_number: string | null; name: string | null }>(admin.from('projects').select('id, project_number, name').in('project_number', nums).limit(200), 'the projects') : [],
    rowsIn<MyMailPipelineRow>(ask.pipeline, (c) => admin.from('jobs_ledger').select(PIPELINE_COLUMNS).in('id', c), 'the Pipeline jobs'),
    nums.length
      ? rows<MyMailPipelineRow>(admin.from('jobs_ledger').select(PIPELINE_COLUMNS).or(`hcp_number.in.(${inList(nums)}),click_number.in.(${inList(clicks)})`).limit(200), 'the Pipeline jobs')
      : [],
    loadPrefixes(admin),
  ])
  const projects = [...projectsById, ...projectsByNum]
  const gc = await rowsIn<{ project_id: string; stage: string | null; lost_on: string | null }>(
    unique(projects.map((p) => p.id)),
    (c) => admin.from('gc_projects').select('project_id, stage, lost_on').in('project_id', c),
    'the GC projects',
  )
  const gcById = new Map(gc.map((g) => [g.project_id, g]))
  const gcProjects: MyMailProjectRow[] = projects.flatMap((p) => {
    const g = gcById.get(p.id)
    return g ? [{ ...p, stage: g.stage, lost_on: g.lost_on }] : []
  })
  return myMailJobs({ bids: [...bidsById, ...bidsByNum], projects: gcProjects, pipeline: [...jobsById, ...jobsByNum, ...more], prefixes })
}

/** One job as the tag's chip, or null when there is no such job (a project must be a GC project, as `tie_message` checks). */
async function jobChip(admin: Admin, job: MyMailJobRef): Promise<MyMailJobChip | null> {
  const { chips } = await loadJobs(admin, { bid: job.kind === 'bid' ? [job.id] : [], project: job.kind === 'project' ? [job.id] : [], pipeline: job.kind === 'pipeline' ? [job.id] : [] }, [])
  return chips[jobKey(job)] ?? null
}

// ---------- a page of rows, filled from the database ----------

/**
 * What the database knows of the rows: the tagged conversations, the lines that hold the mails, and, for the rows that
 * want one (`wantsGuess`; all of them, or only the ids in `guessFor`), the facts the guess reads. Rows in, rows out.
 */
async function fillRows(ctx: Ctx, box: Box, reads: readonly MyMailRead[], guessFor: ReadonlySet<string> | 'all'): Promise<MyMailRow[]> {
  if (reads.length === 0) return []
  const { admin, me } = ctx
  const [tags, byRfc, byId] = await Promise.all([
    rowsIn<{ gmail_thread_id: string; bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null }>(
      unique(reads.map((r) => r.row.threadId)),
      (c) => admin.from('email_tag_threads').select('gmail_thread_id, bid_id, project_id, jobs_ledger_id').eq('user_id', me.id).in('gmail_thread_id', c),
      'your tagged conversations',
    ),
    rowsIn<MyMailLine & { gmail_id: string | null; rfc_message_id: string | null }>(unique(reads.map((r) => r.rfcMessageId)), (c) => admin.from('messages').select(LINE_COLUMNS).in('rfc_message_id', c), 'the lines'),
    // A line an earlier tag wrote for a mail with no Message-ID is found by its Gmail id, in this person's box alone.
    rowsIn<MyMailLine & { gmail_id: string | null; rfc_message_id: string | null }>(
      unique(reads.filter((r) => !r.rfcMessageId).map((r) => r.row.gmailId)),
      (c) => admin.from('messages').select(LINE_COLUMNS).eq('mail_user_id', me.id).in('gmail_id', c),
      'the lines',
    ),
  ])
  const tagKey = new Map(tags.map((t) => [t.gmail_thread_id, jobKeyOfRow(t)]))
  const lineByRfc = new Map(byRfc.map((l) => [l.rfc_message_id ?? '', l]))
  const lineById = new Map(byId.map((l) => [l.gmail_id ?? '', l]))
  const held = reads.map((read) => {
    const line = (read.rfcMessageId ? lineByRfc.get(read.rfcMessageId) : lineById.get(read.row.gmailId)) ?? null
    const key = tagKey.get(read.row.threadId) ?? null
    const guess = (guessFor === 'all' || guessFor.has(read.row.gmailId)) && wantsGuess(read.row, { tagKey: key, line })
    return { read, line, tagKey: key, guess }
  })
  const facts = await loadFacts(admin, box, held.filter((h) => h.guess).map((h) => h.read.row), unique(held.map((h) => h.tagKey)))
  return held.map((h) =>
    filledRow(h.read.row, {
      tagged: h.tagKey ? (facts.chips[h.tagKey] ?? null) : null,
      line: h.line,
      guess: h.guess ? guessJob(h.read.row, myMailGuessFacts(h.read.row, facts)) : null,
    }, me.id),
  )
}

/**
 * The facts the rows' guesses read, and the chips of the tagged jobs: the other parties' contacts (`contact_channels`)
 * and their jobs (`contact_jobs`, the star `is_default`), the jobs the subjects' numbers name, and the customers on the
 * parties' domains (their own emails and their contact persons') with their open Pipeline jobs.
 */
async function loadFacts(admin: Admin, box: Box, guessed: readonly MyMailRow[], tagKeys: readonly string[]): Promise<MyMailPageFacts> {
  if (guessed.length === 0 && tagKeys.length === 0) return { jobs: [], chips: {}, open: {}, contactsByAddress: {}, contactJobs: {}, domainCustomers: {}, customerOpenJobs: {} }
  const ask = myMailGuessAsks(guessed, myMailOurDomains([box.reader.address, ...box.boxes]))
  const [channels, domains] = await Promise.all([
    rowsIn<{ contact_id: string; key: string | null; value: string | null }>(ask.addresses, (c) => admin.from('contact_channels').select('contact_id, key, value').eq('kind', 'email').in('key', c), "the people's addresses"),
    loadDomains(admin, ask.domains),
  ])
  const byAddress = contactsByAddress(channels)
  // A party's contact counts only when their address is on one contact alone (`myMailGuessFacts`).
  const ties = await rowsIn<{ contact_id: string; bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null; is_default: boolean | null }>(
    unique(Object.values(byAddress).flatMap((ids) => (ids.length === 1 ? ids : []))),
    (c) => admin.from('contact_jobs').select('contact_id, bid_id, project_id, jobs_ledger_id, is_default').in('contact_id', c),
    "the people's jobs",
  )
  const contactJobs = contactJobsOf(ties)
  const partyKeys = Object.values(contactJobs).flatMap((list) => list.map((t) => t.key))
  const jobs = await loadJobs(admin, jobAsk([...tagKeys, ...partyKeys]), ask.numbers, domains.jobs)
  return { ...jobs, contactsByAddress: byAddress, contactJobs, domainCustomers: domains.customers, customerOpenJobs: customerOpenJobs(domains.jobs) }
}

/**
 * The customers on the parties' domains, by their own emails and their contact persons', with their open Pipeline jobs.
 * A guess is never more than an offer, so a read that fails here leaves the domain step out of this page and says so in
 * the log; the page still answers.
 */
async function loadDomains(admin: Admin, domains: readonly string[]): Promise<{ customers: MyMailPageFacts['domainCustomers']; jobs: MyMailPipelineRow[] }> {
  if (domains.length === 0) return { customers: {}, jobs: [] }
  try {
    const [persons, own] = await Promise.all([
      rows<MyMailCustomerPersonRow>(admin.from('customer_contact_persons').select('customer_id, email').or(domainFilter(['email'], domains)).limit(500), "the customers' people"),
      rows<MyMailCustomerRow>(admin.from('customers').select('id, name, contact_info, billing_email').is('archived_at', null).or(domainFilter(['contact_info->>email', 'billing_email'], domains)).limit(500), 'the customers'),
    ])
    const known = new Set(own.map((c) => c.id))
    const theirs = await rowsIn<MyMailCustomerRow>(
      unique(persons.map((p) => p.customer_id).filter((id) => !known.has(id))),
      (c) => admin.from('customers').select('id, name, contact_info, billing_email').is('archived_at', null).in('id', c),
      'the customers',
    )
    const customers = domainCustomers(domains, [...own, ...theirs], persons)
    const ids = unique(Object.values(customers).flatMap((list) => list.map((c) => c.customerId)))
    const jobs = ids.length
      ? await rows<MyMailPipelineRow>(
          admin.from('jobs_ledger').select(PIPELINE_COLUMNS).or(`customer_id.in.(${ids.join(',')}),gc_customer_id.in.(${ids.join(',')})`).neq('status', 'paid').limit(500),
          "the customers' jobs",
        )
      : []
    return { customers, jobs }
  } catch (e) {
    console.warn(JSON.stringify({ event: 'gmail_mine_guess_missed', step: 'domain', reason: (e instanceof Stop ? e.refusal.words : words(e)).slice(0, 300) }))
    return { customers: {}, jobs: [] }
  }
}

// ---------- list ----------

async function list(ctx: Ctx, ask: MyMailListRequest): Promise<Response> {
  const query = myMailQuery({ view: ask.view, labels: ask.labels, hidden: ctx.me.hiddenLabels, q: ask.q })
  const [page, box] = await Promise.all([gmail(() => gmailMessagePage(ctx.token, query, MY_MAIL_PAGE, ask.pageToken ?? undefined)), loadBox(ctx.admin, ctx.me)])
  const messages = await readAll(ctx.token, unique((page.messages ?? []).map((m) => m.id)))
  // The search keeps Drafts, Spam, Trash and Chats out; a mail that reached the page anyway is never drawn.
  const reads = messages.filter((m) => !neverRead(m.labelIds)).map((m) => readMyMail(m, box.reader))
  const filled = await fillRows(ctx, box, reads, 'all')
  const view = viewRows(filled, ask.view)
  const answer: MyMailListOk = { ok: true, address: ctx.me.email, rows: view.rows, nextPageToken: page.nextPageToken ?? null, folded: view.folded.length }
  log({
    event: 'gmail_mine_list',
    user: ctx.me.id,
    view: ask.view,
    searched: Boolean(ask.q),
    listed: (page.messages ?? []).length,
    read: reads.length,
    rows: view.rows.length,
    folded: view.folded.length,
    tagged: filled.filter((r) => r.tagged).length,
    held: filled.filter((r) => r.inMessages).length,
    guessed: filled.filter((r) => r.guess).length,
    more: Boolean(page.nextPageToken),
  })
  return json(answer)
}

// ---------- open ----------

async function open(ctx: Ctx, ask: MyMailOpenRequest): Promise<Response> {
  const [m, box] = await Promise.all([gmail(() => gmailMessage(ctx.token, ask.gmailId), true), loadBox(ctx.admin, ctx.me)])
  const message = m as MyMailGmailMessage
  if (neverRead(message.labelIds)) return refuse(myMailRefusal('notFound'), MY_MAIL_REFUSAL_STATUS.notFound, 'open')
  const read = readMyMail(message, box.reader)
  let others: MyMailGmailMessage[] = []
  if (read.row.threadId) {
    try {
      const thread = await gmailThreadHeaders(ctx.token, read.row.threadId, MY_MAIL_METADATA_HEADERS)
      others = (thread.messages ?? []).filter((x) => x.id !== message.id && !neverRead(x.labelIds))
    } catch (e) {
      if (!(e instanceof GmailError && e.status === 404)) throw e instanceof GmailError ? asGoogle(e) : e
    }
  }
  const [row, ...threadRows] = await fillRows(ctx, box, [read, ...others.map((x) => readMyMail(x, box.reader))], new Set([message.id]))
  const answer: MyMailOpenOk = {
    ok: true,
    mail: {
      ...row!,
      to: myMailParties(read.email.to),
      cc: myMailParties(read.email.cc),
      bodyText: read.email.text,
      bodyHtml: myMailBodyHtml(message),
      fileList: myMailFileList(read.email),
      threadCount: 1 + others.length,
      threadRows,
    },
  }
  log({ event: 'gmail_mine_open', user: ctx.me.id, files: answer.mail.fileList.length, thread: answer.mail.threadCount, tagged: Boolean(row?.tagged), held: Boolean(row?.inMessages), guessed: Boolean(row?.guess) })
  return json(answer)
}

// ---------- tag ----------

interface TagCounts {
  lines: number
  tied: number
  files: number
  notCopied: number
  already: number
  skipped: number
  emlKept: number
  emlMissed: number
}

/** A mail's raw copy as received, beside its line: the court-ready record. A miss is logged, and a later tag keeps it. */
async function keepRaw(ctx: Ctx, gmailId: string, lineId: string, done: TagCounts): Promise<void> {
  try {
    const raw = await gmailMessageRaw(ctx.token, gmailId)
    const bytes = base64UrlBytes(raw.raw ?? '')
    if (bytes.length === 0) throw new Error('Gmail sent no raw mail')
    if (bytes.length > KEEP_FILE_BYTES) throw new Error(`the raw mail is ${bytes.length} bytes, over the bucket's 25 MB`)
    const up = await ctx.admin.storage.from(MY_MAIL_BUCKET).upload(myMailEmlPath(lineId), bytes, { contentType: MY_MAIL_EML_MIME, upsert: true })
    if (up.error) throw new Error(up.error.message)
    done.emlKept++
  } catch (e) {
    done.emlMissed++
    console.warn(JSON.stringify({ event: 'gmail_mine_eml_missed', user: ctx.me.id, line: lineId, reason: words(e).slice(0, 300) }))
  }
}

/** The raw copy of a line an earlier tag wrote, kept now when that tag missed it. */
async function keepRawIfMissing(ctx: Ctx, gmailId: string, lineId: string, done: TagCounts): Promise<void> {
  const name = `${lineId}.eml`
  const { data, error } = await ctx.admin.storage.from(MY_MAIL_BUCKET).list('mine', { limit: 2, search: name })
  if (!error && ((data ?? []) as { name: string }[]).some((f) => f.name === name)) return
  await keepRaw(ctx, gmailId, lineId, done)
}

/** A written mail's files, copied into the bucket as `takeOne` copies them; one that will not copy stays in Gmail, named. */
async function copyFiles(ctx: Ctx, email: EmailIn, senderKind: string | null, done: TagCounts): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (const f of emailFileRows(email, senderKind)) {
    if (f.kind === 'link' || f.keep === 'tooBig') {
      out.push(myMailFileRow(f))
      continue
    }
    const path = myMailFilePath(ctx.me.id, email.gmailId, f.partId, out.length, f.name)
    try {
      const data = f.attachmentId ? (await gmailAttachment(ctx.token, email.gmailId, f.attachmentId)).data : email.files.find((x) => x.partId === f.partId)?.data
      const bytes = base64UrlBytes(data ?? '')
      if (bytes.length === 0 && f.size > 0) throw new Error('no bytes')
      const up = await ctx.admin.storage.from(MY_MAIL_BUCKET).upload(path, bytes, { contentType: f.mime, upsert: true })
      if (up.error) throw new Error(up.error.message)
      out.push(myMailFileRow(f, { path }))
    } catch (e) {
      done.notCopied++
      console.warn(JSON.stringify({ event: 'gmail_mine_file_not_copied', user: ctx.me.id, reason: words(e).slice(0, 300) }))
      out.push(myMailFileRow(f, { left: 'not_copied' }))
    }
  }
  return out
}

/** The tag's label on each mail of the conversation that is on the job now; one that will not take it is logged. */
async function labelMails(ctx: Ctx, ids: readonly string[]): Promise<{ labelled: number; missed: number }> {
  if (ids.length === 0) return { labelled: 0, missed: 0 }
  let labelId: string
  try {
    labelId = await gmailLabelId(ctx.token, MY_MAIL_GMAIL_LABEL)
  } catch (e) {
    console.warn(JSON.stringify({ event: 'gmail_mine_label_missed', user: ctx.me.id, reason: words(e).slice(0, 300) }))
    return { labelled: 0, missed: ids.length }
  }
  let labelled = 0
  let missed = 0
  for (const id of ids) {
    try {
      await gmailAddLabel(ctx.token, id, labelId)
      labelled++
    } catch (e) {
      missed++
      console.warn(JSON.stringify({ event: 'gmail_mine_label_missed', user: ctx.me.id, reason: words(e).slice(0, 300) }))
    }
  }
  return { labelled, missed }
}

async function tag(ctx: Ctx, ask: MyMailTagRequest): Promise<Response> {
  const { admin, caller, me } = ctx
  const chip = await jobChip(admin, ask.job)
  if (!chip) return refuse(myMailRefusal('notFound'), MY_MAIL_REFUSAL_STATUS.notFound, 'tag')
  const thread = await gmail(() => gmailThreadFull(ctx.token, ask.threadId), true)
  const emails = (thread.messages ?? []).map((m) => readGmailMessage(m))
  if (emails.length === 0) return refuse(myMailRefusal('notFound'), MY_MAIL_REFUSAL_STATUS.notFound, 'tag')
  const [held, team, box] = await Promise.all([
    rowsIn<MyMailHeldLine>(unique(emails.map((e) => rfcMessageId(e))), (c) => admin.from('messages').select(HELD_COLUMNS).in('rfc_message_id', c), 'the lines'),
    rows<{ id: string; name: string | null; email: string | null }>(admin.from('users').select('id, name, email').in('role', STAFF_ROLES).not('email', 'is', null).eq('is_walk_tester', false), 'the team'),
    loadBox(admin, me),
  ])
  const plan = planTag({ threadId: ask.threadId, messages: emails }, { userId: me.id, address: me.email, name: me.name }, chip, {
    byMessageId: knownLines(held, me.id),
    team: myMailTeam(team),
    boxes: box.boxes,
  })
  const heldById = new Map(held.map((l) => [l.id, l]))
  const emailById = new Map(emails.map((e) => [e.gmailId, e]))
  const done: TagCounts = { lines: 0, tied: 0, files: 0, notCopied: 0, already: 0, skipped: 0, emlKept: 0, emlMissed: 0 }
  let contactId: string | null = null
  let unknownSender: MyMailTagOk['unknownSender'] = null

  for (const step of plan.steps) {
    if (step.kind === 'skip') {
      done.skipped++
      continue
    }
    if (step.kind === 'tie') {
      if (step.tie) {
        // As the caller: tie_message is SECURITY INVOKER, stamps tied_by with them, and adds the job to the person's jobs.
        const { error } = await caller.rpc('tie_message', { p_message_id: step.messageId, p_job_kind: chip.kind, p_job_id: chip.id })
        if (error) throw stopped('The tag stopped partway. A line could not be tied to the job.', error.message)
        done.tied++
      }
      const line = heldById.get(step.messageId)
      contactId = contactId ?? line?.contact_id ?? null
      if (line && line.mail_user_id === me.id) await keepRawIfMissing(ctx, step.gmailId, line.id, done)
      continue
    }
    const email = emailById.get(step.gmailId)
    if (!email) continue
    const placed = await admin.rpc('email_place_address', { p_value: step.party.address, p_name: step.party.name }).single()
    if (placed.error || !placed.data) throw stopped("The tag stopped partway. A sender's address could not be placed.", placed.error?.message ?? 'no answer')
    const placedContact = String(placed.data.placed_contact)
    contactId = contactId ?? placedContact
    if (placed.data.made === true && placed.data.placed_kind === 'unknown' && !unknownSender) {
      unknownSender = { contactId: placedContact, address: step.party.address, name: step.party.name?.trim() ?? '' }
    }
    const files = await copyFiles(ctx, email, typeof placed.data.placed_kind === 'string' ? placed.data.placed_kind : null, done)
    // An invitation to bid (v2.6222) rides on a line in, as the bids@ reader writes it.
    const invite = step.direction === 'in' ? invitation({ subject: step.subject ?? '', text: step.body, links: email.links, at: step.at ?? email.at ?? nowIso() }) : null
    const row = myMailLineRow(step, plan, { contactId: placedContact, channelId: placed.data.placed_channel ?? null }, invite)
    const wrote = await admin.rpc('email_write_line', { p_gmail_id: step.gmailId, p_row: row, p_files: files, p_note: null })
    if (wrote.error) throw stopped('The tag stopped partway. A line could not be written.', wrote.error.message)
    const answer = (wrote.data as { written: boolean; id: string }[] | null)?.[0]
    if (answer?.written === false) {
      // The same mail, written a moment ago by another tag or a box: nothing twice.
      done.already++
      continue
    }
    done.lines++
    done.files += files.filter((f) => f.kind === 'file').length
    if (answer?.id) await keepRaw(ctx, step.gmailId, answer.id, done)
  }

  // A second tag onto another job moves the row with it; its own lines moved with their tie steps above.
  const saved = await admin.from('email_tag_threads').upsert({ ...plan.threadRow, tagged_at: nowIso() }, { onConflict: 'user_id,gmail_thread_id' })
  if (saved.error) throw stopped('The tag stopped before it was kept. Its lines are written.', saved.error.message)
  const label = await labelMails(ctx, unique(plan.steps.filter((s) => s.kind !== 'skip').map((s) => s.gmailId)))
  const answer: MyMailTagOk = { ok: true, jobKey: plan.jobKey, lines: done.lines, tied: done.tied, files: done.files, contactId, unknownSender }
  log({ event: 'gmail_mine_tag', user: me.id, job_kind: chip.kind, mails: plan.steps.length, ...done, unknown_sender: Boolean(unknownSender), ...label })
  return json(answer)
}

// ---------- untag ----------

async function untag(ctx: Ctx, ask: MyMailUntagRequest): Promise<Response> {
  const { admin, caller, me } = ctx
  // The conversation's mails, by their Message-IDs, for the boxes' lines and the label. Gone from Gmail: the lines still go.
  let mails: MyMailGmailMessage[] = []
  try {
    mails = (await gmailThreadHeaders(ctx.token, ask.threadId, ['Message-ID'])).messages ?? []
  } catch (e) {
    if (!(e instanceof GmailError && e.status === 404)) throw e instanceof GmailError ? asGoogle(e) : e
  }
  const [{ data: tagRow, error: tagError }, own] = await Promise.all([
    admin.from('email_tag_threads').select('id, bid_id, project_id, jobs_ledger_id').eq('user_id', me.id).eq('gmail_thread_id', ask.threadId).maybeSingle(),
    rows<{ id: string }>(admin.from('messages').select('id').eq('mail_user_id', me.id).eq('gmail_thread_id', ask.threadId), 'your lines'),
  ])
  if (tagError) throw stopped('Reading the tag failed.', tagError.message)
  const rfcs = unique(mails.map((m) => rfcMessageId(readGmailMessage(m))))
  const box = await rowsIn<MyMailLine>(rfcs, (c) => admin.from('messages').select('id, bid_id, project_id, jobs_ledger_id, mail_user_id, tied_by').in('rfc_message_id', c).is('mail_user_id', null), "the boxes' lines")
  const plan = planUntag({ userId: me.id, tagJobKey: tagRow ? jobKeyOfRow(tagRow) : null, own, box })
  const files = await rowsIn<{ message_id: string; bucket_path: string | null }>(plan.remove, (c) => admin.from('message_attachments').select('message_id, bucket_path').in('message_id', c), 'the files')

  let removed = 0
  let held = 0
  let orphaned = 0
  for (const id of plan.remove) {
    // Its message_attachments rows go with it (ON DELETE CASCADE). A line the office has since made the record of
    // something (a promise kept by it, contact_owed) cannot go: it stays, and so do its files.
    const gone = await admin.from('messages').delete().eq('id', id).eq('mail_user_id', me.id)
    if (gone.error) {
      held++
      console.warn(JSON.stringify({ event: 'gmail_mine_line_held', user: me.id, line: id, reason: String(gone.error.message).slice(0, 300) }))
      continue
    }
    removed++
    const paths = [...unique(files.filter((f) => f.message_id === id).map((f) => f.bucket_path)), myMailEmlPath(id)]
    const taken = await admin.storage.from(MY_MAIL_BUCKET).remove(paths)
    if (taken.error) {
      orphaned += paths.length
      console.warn(JSON.stringify({ event: 'gmail_mine_files_left', user: me.id, line: id, files: paths.length, reason: String(taken.error.message).slice(0, 300) }))
    }
  }
  let untied = 0
  for (const id of plan.untie) {
    // As the caller, the way a person unties a line on the thread: no job, tied_by stamped.
    const { error } = await caller.rpc('tie_message', { p_message_id: id, p_job_kind: null, p_job_id: null })
    if (error) throw stopped('The untag stopped partway. A line could not be untied.', error.message)
    untied++
  }
  // The row goes last, so an untag that stopped before here finds the tag again and finishes.
  if (tagRow) {
    const gone = await admin.from('email_tag_threads').delete().eq('id', tagRow.id)
    if (gone.error) throw stopped('The untag stopped before the tag came off.', gone.error.message)
  }
  // The label comes off the mail that carries it. A box that never had it has nothing to take off, and nothing is made.
  let unlabelled = 0
  const labelId = mails.length ? ((await gmailLabels(ctx.token).catch(() => ({ labels: [] }))).labels ?? []).find((l) => l.name === MY_MAIL_GMAIL_LABEL)?.id : undefined
  for (const m of labelId ? mails.filter((x) => (x.labelIds ?? []).includes(labelId)) : []) {
    try {
      await gmailRemoveLabel(ctx.token, m.id, labelId!)
      unlabelled++
    } catch (e) {
      console.warn(JSON.stringify({ event: 'gmail_mine_label_left', user: me.id, reason: words(e).slice(0, 300) }))
    }
  }
  const answer: MyMailUntagOk = { ok: true, removed, keptForMatter: false }
  log({ event: 'gmail_mine_untag', user: me.id, had_tag: Boolean(tagRow), removed, held, orphaned, untied, unlabelled })
  return json(answer)
}

// ---------- the door ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return refuse(myMailRefusal('badRequest', 'Ask with POST.'), 405)
  let action: string | null = null
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!supabaseUrl || !serviceRoleKey || !anonKey || !saJson) return refuse(stoppedRefusal('Reading mail is not set up yet.', 'a secret is missing', 'The reason'), MY_MAIL_STOPPED_STATUS)
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })

    const { data: u } = await caller.auth.getUser()
    if (!u?.user) return refuse(myMailRefusal('signIn'))
    const { data: who, error: whoError } = await admin.from('users').select(USER_COLUMNS).eq('id', u.user.id).maybeSingle()
    if (whoError) return refuse(stoppedRefusal('Reading your account failed.', whoError.message), MY_MAIL_STOPPED_STATUS)
    // A sample (a dev's View as), a twin and the walk tester have no mailbox of their own.
    if (!who || isFixtureAccount(who) || who.is_walk_tester === true) return refuse(myMailRefusal('readOnly'))
    const { data: office, error: officeError } = await caller.rpc('gc_office_team')
    if (officeError || office !== true) return refuse(myMailRefusal('officeOnly'))
    if (who.my_mail_on !== true) return refuse(myMailRefusal('off'))

    const ask = parseMyMailRequest(await req.json().catch(() => null))
    if (!ask) return refuse(myMailRefusal('badRequest'))
    action = ask.action
    // Training mode reads, and never writes.
    if ((ask.action === 'tag' || ask.action === 'untag') && who.read_only === true) return refuse(myMailRefusal('readOnly'), MY_MAIL_REFUSAL_STATUS.readOnly, action)
    const email = String(who.email ?? '').trim()
    if (!myMailAddressKey(email)) return refuse(myMailRefusal('offWorkspace', 'Your account has no email address for Google to read.'), MY_MAIL_REFUSAL_STATUS.offWorkspace, action)
    // The address they sign in with and no other, so a users.email changed by hand never points the read at another box.
    if (!isSignInAddress(email, u.user.email)) return refuse(myMailRefusal('offWorkspace', MY_MAIL_NOT_SIGN_IN_WORDS), MY_MAIL_REFUSAL_STATUS.offWorkspace, action)
    // Never a session Imitate or View as opened (v2.6290): its JWT is the person's own, so nothing above tells it apart.
    // login-as-user records each imitation before it hands out the link, and a magic-link sign-in that follows an
    // imitation of this person is refused (`myMail/imitation.ts`). A read of the record that fails refuses too.
    const linkAt = sessionLinkAt((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''))
    if (linkAt !== null) {
      const { data: imitations, error: imitationsError } = await admin.from('user_imitations').select('created_at').eq('target_id', who.id).gte('created_at', imitationsSince(linkAt))
      if (imitationsError) console.warn(JSON.stringify({ event: 'gmail_mine_imitations_unread', user: who.id, reason: String(imitationsError.message).slice(0, 300) }))
      if (imitationsError || openedByImitation(linkAt, imitations ?? [])) return refuse(myMailRefusal('imitated'), MY_MAIL_REFUSAL_STATUS.imitated, action)
    }

    // The person's own address and no other: the delegation reads as them, and refuses an address off the Workspace.
    let token: string
    try {
      token = await googleServiceToken(saJson, GMAIL_SCOPES, email)
    } catch (e) {
      return refuse(tokenRefusal(words(e)), undefined, action)
    }
    const hidden = Array.isArray(who.my_mail_hidden_labels) ? (who.my_mail_hidden_labels as unknown[]).filter((l): l is string => typeof l === 'string') : []
    const ctx: Ctx = { admin, caller, token, me: { id: String(who.id), name: String(who.name ?? '').trim(), email, readOnly: who.read_only === true, hiddenLabels: hidden } }
    switch (ask.action) {
      case 'list':
        return await list(ctx, ask)
      case 'open':
        return await open(ctx, ask)
      case 'tag':
        return await tag(ctx, ask)
      case 'untag':
        return await untag(ctx, ask)
    }
  } catch (e) {
    if (e instanceof Stop) return refuse(e.refusal, e.status, action)
    if (e instanceof GmailError) return refuse(gmailRefusal(e), undefined, action)
    console.error('gmail-mine', words(e))
    return refuse(stoppedRefusal('The app could not finish that.', words(e), 'The reason'), MY_MAIL_STOPPED_STATUS, action)
  }
})
