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
 *   The view (`viewRows`) decides the rows answered: the ones it draws, then the ones behind its fold line, each
 *   flagged with its `folded` kind, so the tab draws its fold line; `folded` counts them. Nothing is kept.
 * - `open` ({ gmailId }): one mail whole, its row filled as above, its addresses, words, HTML and files, and the rest of
 *   its conversation as rows (`format=metadata`). Nothing is kept.
 * - `tag` ({ threadId, job }): the conversation whole, planned by `planTag` over the lines that hold its mail (by
 *   Message-ID in any box, a mail with none by its Gmail id in this person's box) and the labels the person leaves out
 *   (their names to Gmail's ids, read once; a mail under one is skipped). The `email_tag_threads` row is kept first: the
 *   job, its follow's place cleared (the next run reads it first), the conversation's newest mail as `last_mail_at`
 *   (the follow's window keys on it), no untag under way, and `tied_line_ids`, the lines of the boxes the tag ties,
 *   recorded before it ties them. Then step by step: a line the boxes or an earlier tag hold is tied through
 *   `tie_message` as the caller (it stamps `tied_by`), the person's own lines and the tag's recorded ties moving with a
 *   tag onto another job; any other mail lands through `landMail`, the one place that knows how a mail becomes a line:
 *   placed (`email_place_address`), its files copied into `message-attachments` under `mine/`, its line written through
 *   `email_write_line` (the same Message-ID fence the boxes use, so nothing is written twice; a line written first by
 *   someone else leaves the copies no line names removed), its person put on the job's people (`contact_jobs`, as
 *   `tie_message` puts them) and its raw mail kept as `mine/<line id>.eml`. Then the grey line in the other party's
 *   thread (the app's own event, keyed `mytag:<row id>`, moved with a tag onto another job), and the Gmail label
 *   *Tagged in ClickTooling* on its mail. A step the database refuses stops the tag with its words; what was written
 *   stays, the row with it, and the follow or a second tag finishes it.
 * - `untag` ({ threadId }): the row is marked `untagging_at` first, so the follow passes it by and lands nothing back,
 *   and an untag that stops leaves it for the next to find. The person's own lines of the conversation go, with their
 *   files and raw copies, once the live documents a legal matter made from them are counted (`keptForMatter`: the
 *   matter keeps its own copy); a line the office keeps something on (a promise, a highlight, what we owe) stays with
 *   its files, counted as `held`. A line the boxes wrote stays, untied only when the row records it as the tag's own
 *   tie. The grey line and the `email_tag_threads` row go, and the label comes off, each mail it would not leave counted
 *   as `labelLeft`.
 *
 * The caller, as `messages-email` gates one: signed in (`auth.getUser()`), a real account (never a sample, a twin or the
 * walk tester, who has no mailbox), on the office team (`gc_office_team()` asked as them), with their switch on
 * (`users.my_mail_on`). A training account (`read_only`) may list and open, never tag or untag. Every answer is the
 * contract's, with the CORS headers; a refusal's status is its kind's (`MY_MAIL_REFUSAL_STATUS`), and a step the
 * database refused mid-way answers 500. Each call logs one line of counts, never a subject, an address or a body.
 *
 * The cron's door (PR 4): `gmail-mine-follow`, every five minutes, posts `{ action: 'follow' }` with `X-Cron-Secret`
 * equal to CRON_SECRET, as `gmail-count` checks it; no signed-in caller may ask for it. The follow reads the tagged
 * conversations of each person whose switch is on and who is a real account on the office team, while the newest mail
 * of each, or its tag when that is later, is younger than 60 days (`followWindow`), never one an untag is taking off
 * (`untagging_at`, asked again before each row), the least recently read first, a failed read included, 100 a run, as
 * that person with one Google token each: a mail no line holds yet lands through `landMail` as a tag lands it, a mail
 * under a label the person leaves out is skipped, a box's line on no job that nobody placed by hand is recorded on the
 * row and tied to the tag's job as the service role with the tagger stamped, and what landed or was tied gets the
 * label. Then the row's `last_read_at` is now and its `last_mail_at` the newest mail the read found (`newestMailAt`,
 * never earlier than the row's own), or its `last_read_at` now and its `last_error` the reason with its `last_mail_at`
 * left as it was, so every row takes its turn, and the next row still runs; a person whose token fails has their rows
 * marked so and is skipped for the run.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON (the reader's),
 * GMAIL_IMPERSONATE_USER (bids@, so a copy from the box reads as ours), EMAIL_FROM, CRON_SECRET (the follow's door).
 * config.toml keeps verify_jwt = false: the caller's session is checked here, and the cron sends none.
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
import { guessJob } from '../_shared/gcKernels/lib/myMail/mailGuess.ts'
import { MY_MAIL_METADATA_HEADERS, readMyMail, type MyMailGmailMessage, type MyMailRead, type MyMailReader } from '../_shared/gcKernels/lib/myMail/rows.ts'
import { MY_MAIL_MAILBOX, planTag, type MyMailKnown, type MyMailTagPlan, type MyMailTagStep } from '../_shared/gcKernels/lib/myMail/tagPlan.ts'
import { viewRows } from '../_shared/gcKernels/lib/myMail/view.ts'
import {
  FOLLOW_ROWS_PER_RUN,
  MY_MAIL_BUCKET,
  MY_MAIL_EML_MIME,
  MY_MAIL_FOLLOW_GONE,
  MY_MAIL_OFFICE_ROLES,
  MY_MAIL_READ_CHUNK,
  MY_MAIL_REFUSAL_STATUS,
  MY_MAIL_STOPPED_STATUS,
  columnNotPushed,
  contactJobsOf,
  contactsByAddress,
  customerOpenJobs,
  domainCustomers,
  domainFilter,
  filledRow,
  followPeople,
  followSince,
  followWindow,
  gmailRefusal,
  isDuplicateKey,
  isFollowRequest,
  knownLines,
  knownOwnLines,
  myMailAddressKey,
  myMailBodyHtml,
  myMailEmlPath,
  myMailFileList,
  myMailFilePath,
  myMailFileRow,
  myMailGuessAsks,
  myMailGuessFacts,
  myMailHiddenLabelIds,
  myMailHiddenLabels,
  myMailJobs,
  myMailLineRow,
  myMailOurDomains,
  myMailParties,
  myMailQuery,
  myMailTagEventKey,
  myMailTagEventRow,
  myMailTagRecord,
  myMailTeam,
  neverRead,
  newestMailAt,
  orphanCopies,
  parseMyMailRequest,
  planFollow,
  planUntag,
  stoppedRefusal,
  tagRowJob,
  tokenRefusal,
  wantsGuess,
  withTies,
  type MyMailBidRow,
  type MyMailCustomerPersonRow,
  type MyMailCustomerRow,
  type MyMailFollowLine,
  type MyMailFollowOk,
  type MyMailFollowPerson,
  type MyMailFollowUserRow,
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
const HELD_COLUMNS = 'id, contact_id, gmail_id, rfc_message_id, bid_id, project_id, jobs_ledger_id, mailbox, mail_user_id, tied_by'
/** A conversation's row as the tag and the untag read it: its job, who tagged it, and the lines its tag tied. */
const TAG_ROW_COLUMNS = 'id, bid_id, project_id, jobs_ledger_id, tagged_by, tied_line_ids'
/** A line the row records as the tag's own tie, as the untag reads it before it unties one. */
const TIED_COLUMNS = 'id, bid_id, project_id, jobs_ledger_id, mail_user_id, tied_by'
const BID_COLUMNS = 'id, bid_number, project_name, service_type_id, outcome'
const FOLLOW_USER_COLUMNS = 'id, name, email, role, read_only, is_sample, is_digital_twin, is_walk_tester, my_mail_on, archived_at, my_mail_hidden_labels'
const FOLLOW_TAG_COLUMNS = 'id, user_id, gmail_thread_id, bid_id, project_id, jobs_ledger_id, tagged_by, last_mail_at'
const FOLLOW_LINE_COLUMNS = 'id, gmail_id, rfc_message_id, bid_id, project_id, jobs_ledger_id, mail_user_id, tied_by'
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

/** Whose box a write reads and lands as: the service role's client, that person's own Gmail token, and the person. */
interface AsPerson {
  admin: Admin
  token: string
  me: Pick<Me, 'id' | 'name' | 'email'>
}

/** A signed-in call: the person as `AsPerson`, with their own client for what runs as them (`tie_message`). */
interface Ctx extends AsPerson {
  caller: Admin
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

/** The boxes' own addresses and the app's sender: a mail from one is a copy of ours, never a line of its own. */
async function loadOurBoxes(admin: Admin): Promise<string[]> {
  const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
  const settings = parseBoxSettings(setting?.value_text)
  const appFrom = parseAddress(EMAIL_FROM)?.address ?? null
  const read = readerBoxes(settings, Deno.env.get('GMAIL_IMPERSONATE_USER')).map((b) => b.address)
  return [...ownChannels(settings, appFrom, read).addresses]
}

/** The boxes, the app's sender and the office's notice list: what a row folds by, as the bids@ reader leaves mail out. */
async function loadBox(admin: Admin, me: Me): Promise<Box> {
  const [boxes, notices] = await Promise.all([
    loadOurBoxes(admin),
    rows<LeftOutSenderRow>(admin.from('email_left_out_senders').select('value, kind, mailbox'), 'the senders marked a notice'),
  ])
  return { reader: { address: me.email, boxes, isNotice: leftOutSenders(notices, MY_MAIL_MAILBOX) }, boxes }
}

/** The team's addresses, as the bids@ reader's `loadTeam` reads them: a teammate's mail on a conversation is ours. */
async function loadTeam(admin: Admin): Promise<NonNullable<MyMailKnown['team']>> {
  return myMailTeam(
    await rows<{ id: string; name: string | null; email: string | null }>(admin.from('users').select('id, name, email').in('role', STAFF_ROLES).not('email', 'is', null).eq('is_walk_tester', false), 'the team'),
  )
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
  // The rows the view draws, then the ones behind its fold line, each part newest first as `viewRows` sorts it and each
  // folded row flagged with its kind: the tab sorts them into its list and its fold line again (v2.6292; until then the
  // folded rows never left the function, and the tab's fold line never drew). Tagged has none.
  const answer: MyMailListOk = { ok: true, address: ctx.me.email, rows: [...view.rows, ...view.folded], nextPageToken: page.nextPageToken ?? null, folded: view.folded.length }
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
  /** People put on the job's people (`contact_jobs`) for a line written, and the ones that would not go on. */
  listed: number
  unlisted: number
  /** Copies taken back out of the bucket when another write's line stood first, and the ones left there. */
  copiesRemoved: number
  copiesLeft: number
}

const newCounts = (): TagCounts => ({ lines: 0, tied: 0, files: 0, notCopied: 0, already: 0, skipped: 0, emlKept: 0, emlMissed: 0, listed: 0, unlisted: 0, copiesRemoved: 0, copiesLeft: 0 })

/** One call's tally, and what it does once a call: each person it put on a job's people, by the person and the job. */
interface Run {
  done: TagCounts
  listed: Set<string>
}

const newRun = (): Run => ({ done: newCounts(), listed: new Set() })

/**
 * Gmail's ids of the labels the person leaves out (`users.my_mail_hidden_labels`, by name), read once a call from their
 * box's labels (`myMailHiddenLabelIds`: the name whole, case-blind). None, and no read, when they named none. Gmail's
 * failure stops the call, so a mail under a hidden label is never copied for want of knowing it.
 */
async function hiddenLabelIds(token: string, hidden: readonly string[]): Promise<string[]> {
  if (hidden.length === 0) return []
  const { labels } = await gmail(() => gmailLabels(token))
  return myMailHiddenLabelIds(labels, hidden)
}

/**
 * A line onto a job, or off every job (`job` null), through `tie_message`, the door a person's own tie goes through:
 * as the caller when there is one (SECURITY INVOKER: it stamps them as `tied_by`, and a job joins the line's person's
 * jobs), and with none (the cron's follow) as the service role, then stamped with who tagged the conversation, as the
 * caller's tie would have stamped them. `say` is what stopped, when it fails.
 */
async function tieLine(as: { admin: Admin; caller?: Admin | null }, lineId: string, job: MyMailJobRef | null, taggedBy: string | null, say: { tie: string; stamp: string }): Promise<void> {
  const args = { p_message_id: lineId, p_job_kind: job?.kind ?? null, p_job_id: job?.id ?? null }
  if (as.caller) {
    const { error } = await as.caller.rpc('tie_message', args)
    if (error) throw stopped(say.tie, error.message)
    return
  }
  const { error } = await as.admin.rpc('tie_message', args)
  if (error) throw stopped(say.tie, error.message)
  if (!taggedBy) return
  const stamp = await as.admin.from('messages').update({ tied_by: taggedBy }).eq('id', lineId)
  if (stamp.error) throw stopped(say.stamp, stamp.error.message)
}

/**
 * A written line's person onto the job's people (`contact_jobs`), as `tie_message` puts them there for a line it ties,
 * so their thread draws the job's tile and the picker lists it among their jobs: the contact with the job in its one
 * column, as the service role, once a call per person and job (a run of the follow reads conversations on many jobs).
 * A row already there stays as it is (the unique violation `23505`, which `ON CONFLICT DO NOTHING` would have stood
 * back on). Best effort: a miss is logged and counted, and the line stands on the job without it.
 */
async function listOnJob(as: AsPerson, contactId: string, jobColumns: MyMailTagPlan['jobColumns'], run: Run): Promise<void> {
  const once = `${contactId} ${jobKeyOfRow(jobColumns)}`
  if (run.listed.has(once)) return
  run.listed.add(once)
  const { error } = await as.admin.from('contact_jobs').insert({ contact_id: contactId, ...jobColumns })
  if (!error) {
    run.done.listed++
    return
  }
  if (isDuplicateKey(error.code)) return
  run.done.unlisted++
  console.warn(JSON.stringify({ event: 'gmail_mine_job_unlisted', user: as.me.id, code: typeof error.code === 'string' ? error.code : null, reason: String(error.message).slice(0, 300) }))
}

/**
 * The copies `copyFiles` made for a mail whose line this write did not make (`email_write_line` stood back on a line
 * another reader, another person or this person's own last tag wrote first, or refused the write): every one no
 * `message_attachments` row names goes (`orphanCopies`), so the line that stood keeps its own files and the bucket keeps
 * none that no line shows. Best effort: a miss is logged and counted.
 */
async function dropCopies(as: AsPerson, files: readonly Record<string, unknown>[], done: TagCounts): Promise<void> {
  const uploaded = unique(files.map((f) => (typeof f.bucket_path === 'string' ? f.bucket_path : null)))
  if (uploaded.length === 0) return
  let orphans: string[] = uploaded
  try {
    const named = await rowsIn<{ bucket_path: string | null }>(uploaded, (c) => as.admin.from('message_attachments').select('bucket_path').in('bucket_path', c), "the lines' files")
    orphans = orphanCopies(uploaded, named.map((r) => r.bucket_path))
    if (orphans.length === 0) return
    const taken = await as.admin.storage.from(MY_MAIL_BUCKET).remove(orphans)
    if (taken.error) throw new Error(taken.error.message)
    done.copiesRemoved += orphans.length
  } catch (e) {
    done.copiesLeft += orphans.length
    console.warn(JSON.stringify({ event: 'gmail_mine_copies_left', user: as.me.id, files: orphans.length, reason: (e instanceof Stop ? e.refusal.words : words(e)).slice(0, 300) }))
  }
}

/** A mail's raw copy as received, beside its line: the court-ready record. A miss is logged, and a later tag keeps it. */
async function keepRaw(ctx: AsPerson, gmailId: string, lineId: string, done: TagCounts): Promise<void> {
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
async function keepRawIfMissing(ctx: AsPerson, gmailId: string, lineId: string, done: TagCounts): Promise<void> {
  const name = `${lineId}.eml`
  const { data, error } = await ctx.admin.storage.from(MY_MAIL_BUCKET).list('mine', { limit: 2, search: name })
  if (!error && ((data ?? []) as { name: string }[]).some((f) => f.name === name)) return
  await keepRaw(ctx, gmailId, lineId, done)
}

/** A written mail's files, copied into the bucket as `takeOne` copies them; one that will not copy stays in Gmail, named. */
async function copyFiles(ctx: AsPerson, email: EmailIn, senderKind: string | null, done: TagCounts): Promise<Record<string, unknown>[]> {
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
async function labelMails(ctx: AsPerson, ids: readonly string[]): Promise<{ labelled: number; missed: number }> {
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

type WriteStep = Extract<MyMailTagStep, { kind: 'write' }>

/** What landing one mail did: its line, whether it was written now, the contact it went on, and whether that contact was made for it. */
interface Landed {
  lineId: string | null
  written: boolean
  contactId: string
  /** `email_place_address` made the contact now, of kind unknown: the tab asks *Who is this?*. */
  madeUnknown: boolean
}

/**
 * One mail of a tagged conversation onto the job: the one place that knows how a mail becomes a line, which `tag` and
 * `follow` both call, as the service role with the person's own token. Its party is placed (`email_place_address`), its
 * files copied, its line written through `email_write_line` with the row `takeOne` builds plus `mailbox` mine,
 * `mail_user_id` and the job (the Message-ID fence the boxes use, so a mail a box, a tag or a run wrote a moment ago is
 * never doubled, and the copies no line names come back out, `dropCopies`), its person put on the job's people
 * (`listOnJob`), and its raw mail kept as `mine/<line id>.eml`. A step the database refuses stops with `who`'s words
 * (`The tag`, `Reading later mail`); what was written stays.
 */
async function landMail(as: AsPerson, email: EmailIn, step: WriteStep, plan: Pick<MyMailTagPlan, 'mailbox' | 'mailUserId' | 'jobColumns'>, run: Run, who: string): Promise<Landed> {
  const { admin } = as
  const { done } = run
  const placed = await admin.rpc('email_place_address', { p_value: step.party.address, p_name: step.party.name }).single()
  if (placed.error || !placed.data) throw stopped(`${who} stopped partway. A sender's address could not be placed.`, placed.error?.message ?? 'no answer')
  const contactId = String(placed.data.placed_contact)
  const kind = typeof placed.data.placed_kind === 'string' ? placed.data.placed_kind : null
  const madeUnknown = placed.data.made === true && kind === 'unknown'
  const files = await copyFiles(as, email, kind, done)
  // An invitation to bid (v2.6222) rides on a line in, as the bids@ reader writes it.
  const invite = step.direction === 'in' ? invitation({ subject: step.subject ?? '', text: step.body, links: email.links, at: step.at ?? email.at ?? nowIso() }) : null
  const row = myMailLineRow(step, plan, { contactId, channelId: placed.data.placed_channel ?? null }, invite)
  const wrote = await admin.rpc('email_write_line', { p_gmail_id: step.gmailId, p_row: row, p_files: files, p_note: null })
  if (wrote.error) {
    await dropCopies(as, files, done)
    throw stopped(`${who} stopped partway. A line could not be written.`, wrote.error.message)
  }
  const answer = (wrote.data as { written: boolean; id: string }[] | null)?.[0]
  if (answer?.written === false) {
    // The same mail, written a moment ago by another tag, a run of the follow or a box: nothing twice, and no copy kept
    // that the line which stood does not name.
    done.already++
    await dropCopies(as, files, done)
    return { lineId: answer.id ?? null, written: false, contactId, madeUnknown }
  }
  done.lines++
  done.files += files.filter((f) => f.kind === 'file').length
  await listOnJob(as, contactId, plan.jobColumns, run)
  if (answer?.id) await keepRaw(as, step.gmailId, answer.id, done)
  return { lineId: answer?.id ?? null, written: true, contactId, madeUnknown }
}

/**
 * The tag's grey line in the other party's thread (`myMailTagEventRow`): written once, `ignoreDuplicates` on its key as
 * `_shared/estimateThreadLine.ts` writes one, and moved onto the new job when a second tag moved the conversation. Best
 * effort: a miss is logged and the tag stands.
 */
async function writeTagEvent(ctx: AsPerson, input: { tagRowId: string; contactId: string; jobColumns: MyMailTagPlan['jobColumns']; moved: boolean }): Promise<boolean> {
  try {
    const row = myMailTagEventRow({ tagRowId: input.tagRowId, who: ctx.me, contactId: input.contactId, jobColumns: input.jobColumns })
    const { error } = await ctx.admin.from('messages').upsert(row, { onConflict: 'quo_id', ignoreDuplicates: !input.moved })
    if (error) throw new Error(error.message)
    return true
  } catch (e) {
    console.warn(JSON.stringify({ event: 'gmail_mine_event_line_missed', user: ctx.me.id, reason: words(e).slice(0, 300) }))
    return false
  }
}

async function tag(ctx: Ctx, ask: MyMailTagRequest): Promise<Response> {
  const { admin, me } = ctx
  const chip = await jobChip(admin, ask.job)
  if (!chip) return refuse(myMailRefusal('notFound'), MY_MAIL_REFUSAL_STATUS.notFound, 'tag')
  const thread = await gmail(() => gmailThreadFull(ctx.token, ask.threadId), true)
  const emails = (thread.messages ?? []).map((m) => readGmailMessage(m))
  if (emails.length === 0) return refuse(myMailRefusal('notFound'), MY_MAIL_REFUSAL_STATUS.notFound, 'tag')
  const [held, own, team, box, before, hidden] = await Promise.all([
    rowsIn<MyMailHeldLine>(unique(emails.map((e) => rfcMessageId(e))), (c) => admin.from('messages').select(HELD_COLUMNS).in('rfc_message_id', c), 'the lines'),
    // A line an earlier tag wrote for a mail with no Message-ID is found by its Gmail id, in this person's box alone.
    rowsIn<MyMailHeldLine>(
      unique(emails.filter((e) => !rfcMessageId(e)).map((e) => e.gmailId)),
      (c) => admin.from('messages').select(HELD_COLUMNS).eq('mail_user_id', me.id).in('gmail_id', c),
      'the lines',
    ),
    loadTeam(admin),
    loadBox(admin, me),
    admin.from('email_tag_threads').select(TAG_ROW_COLUMNS).eq('user_id', me.id).eq('gmail_thread_id', ask.threadId).maybeSingle(),
    hiddenLabelIds(ctx.token, me.hiddenLabels),
  ])
  if (before.error) throw stopped('Reading the tag failed.', before.error.message)
  // The job the conversation was on before this tag: a tag onto another job moves the grey line with it, and the lines
  // the tag tied there (the row's record) with the person's own.
  const wasOn: string | null = before.data ? jobKeyOfRow(before.data) : null
  const record = myMailTagRecord(before.data)
  const plan = planTag({ threadId: ask.threadId, messages: emails }, { userId: me.id, address: me.email, name: me.name }, chip, {
    byMessageId: knownLines(held, me.id, record),
    byGmailId: knownOwnLines(own, me.id),
    team,
    boxes: box.boxes,
    hidden,
  })
  const heldById = new Map([...held, ...own].map((l) => [l.id, l]))
  const emailById = new Map(emails.map((e) => [e.gmailId, e]))
  const run = newRun()
  const { done } = run
  let contactId: string | null = null
  let unknownSender: MyMailTagOk['unknownSender'] = null

  // The row first, so whatever the steps do is the tag's: the job (a tag onto another job moves the row with it), the
  // follow's place cleared so its next run reads the conversation first, the window running 60 days from the tag and on
  // from the conversation's newest mail while mail keeps coming (`newestMailAt`; the tag's own time when no mail has
  // one), no untag under way, and the lines of the boxes this tag ties recorded before it ties them, beside the ones an
  // earlier tag or the follow tied (`tied_line_ids`), so an untag unties those and no line placed by hand.
  const ties = plan.steps.flatMap((s) => (s.kind === 'tie' && s.tie && heldById.get(s.messageId)?.mail_user_id !== me.id ? [s.messageId] : []))
  const taggedAt = nowIso()
  const saved = await admin
    .from('email_tag_threads')
    .upsert(
      { ...plan.threadRow, tagged_at: taggedAt, last_mail_at: newestMailAt(emails) ?? taggedAt, last_read_at: null, last_error: null, untagging_at: null, tied_line_ids: withTies(record?.tied, ties) },
      { onConflict: 'user_id,gmail_thread_id' },
    )
    .select('id')
    .single()
  if (saved.error) throw stopped('The tag stopped before it began.', saved.error.message)
  const tagRowId = (saved.data as { id?: string } | null)?.id ?? null

  for (const step of plan.steps) {
    if (step.kind === 'skip') {
      done.skipped++
      continue
    }
    if (step.kind === 'tie') {
      if (step.tie) {
        await tieLine(ctx, step.messageId, chip, me.id, { tie: 'The tag stopped partway. A line could not be tied to the job.', stamp: 'The tag stopped partway. A tied line could not name who tagged it.' })
        done.tied++
      }
      const line = heldById.get(step.messageId)
      contactId = contactId ?? line?.contact_id ?? null
      if (line && line.mail_user_id === me.id) await keepRawIfMissing(ctx, step.gmailId, line.id, done)
      continue
    }
    const email = emailById.get(step.gmailId)
    if (!email) continue
    const landed = await landMail(ctx, email, step, plan, run, 'The tag')
    contactId = contactId ?? landed.contactId
    if (landed.madeUnknown && !unknownSender) unknownSender = { contactId: landed.contactId, address: step.party.address, name: step.party.name?.trim() ?? '' }
  }

  const moved = wasOn !== null && wasOn !== plan.jobKey
  const eventLine = contactId && tagRowId ? await writeTagEvent(ctx, { tagRowId, contactId, jobColumns: plan.jobColumns, moved }) : false
  const label = await labelMails(ctx, unique(plan.steps.filter((s) => s.kind !== 'skip').map((s) => s.gmailId)))
  const answer: MyMailTagOk = { ok: true, jobKey: plan.jobKey, lines: done.lines, tied: done.tied, files: done.files, contactId, unknownSender }
  log({ event: 'gmail_mine_tag', user: me.id, job_kind: chip.kind, mails: plan.steps.length, ...done, unknown_sender: Boolean(unknownSender), event_line: eventLine, moved, ...label })
  return json(answer)
}

// ---------- untag ----------

/**
 * How many live documents on a legal matter the Legal desk made from these lines (`legal_matter_documents
 * .source_message_id`, PR 5): the matter keeps its own copy when the lines go (`ON DELETE SET NULL`). Read as the service
 * role, before the lines are deleted. Fail-soft: before PR 5's column is pushed (`columnNotPushed`) or on any other
 * failure it reads none and the untag goes on, logged.
 */
async function mattersHolding(admin: Admin, me: Pick<Me, 'id'>, lineIds: readonly string[]): Promise<number> {
  let n = 0
  for (let i = 0; i < lineIds.length; i += IN_CHUNK) {
    const { data, error } = await admin.from('legal_matter_documents').select('id').in('source_message_id', lineIds.slice(i, i + IN_CHUNK)).is('voided_at', null)
    if (error) {
      const code = typeof error.code === 'string' ? error.code : null
      console.warn(JSON.stringify({ event: 'gmail_mine_matters_unread', user: me.id, code, reason: columnNotPushed(code) ? 'the column is not pushed yet' : String(error.message).slice(0, 300) }))
      return 0
    }
    n += ((data ?? []) as unknown[]).length
  }
  return n
}

async function untag(ctx: Ctx, ask: MyMailUntagRequest): Promise<Response> {
  const { admin, me } = ctx
  // The conversation's mails, for the label. Gone from Gmail: the lines still go.
  let mails: MyMailGmailMessage[] = []
  try {
    mails = (await gmailThreadHeaders(ctx.token, ask.threadId, ['Message-ID'])).messages ?? []
  } catch (e) {
    if (!(e instanceof GmailError && e.status === 404)) throw e instanceof GmailError ? asGoogle(e) : e
  }
  const { data: tagRow, error: tagError } = await admin.from('email_tag_threads').select(TAG_ROW_COLUMNS).eq('user_id', me.id).eq('gmail_thread_id', ask.threadId).maybeSingle()
  if (tagError) throw stopped('Reading the tag failed.', tagError.message)
  // The mark first: from here the follow passes the conversation by, so no run lands back what this untag takes off,
  // and an untag that stops leaves the row, marked, for the next untag to find and finish.
  if (tagRow) {
    const marked = await admin.from('email_tag_threads').update({ untagging_at: nowIso() }).eq('id', tagRow.id)
    if (marked.error) throw stopped('The untag stopped before it began.', marked.error.message)
  }
  const record = myMailTagRecord(tagRow)
  const own = await rows<{ id: string }>(admin.from('messages').select('id').eq('mail_user_id', me.id).eq('gmail_thread_id', ask.threadId), 'your lines')
  const ownIds = unique(own.map((l) => l.id))
  // What the office keeps on a line goes with it (ON DELETE CASCADE), so such a line stays: a promise written down on it,
  // or a highlight. And the lines the row records as the tag's own ties, as they are now.
  const [promised, highlighted, tied] = await Promise.all([
    rowsIn<{ message_id: string }>(ownIds, (c) => admin.from('message_promises').select('message_id').in('message_id', c), 'the promises on your lines'),
    rowsIn<{ message_id: string }>(ownIds, (c) => admin.from('message_highlights').select('message_id').in('message_id', c), 'the highlights on your lines'),
    rowsIn<MyMailLine>(record?.tied ?? [], (c) => admin.from('messages').select(TIED_COLUMNS).in('id', c), 'the lines the tag tied'),
  ])
  const plan = planUntag({ userId: me.id, record, own, kept: unique([...promised, ...highlighted].map((r) => r.message_id)), tied })
  const [files, kept] = await Promise.all([
    rowsIn<{ message_id: string; bucket_path: string | null }>(plan.remove, (c) => admin.from('message_attachments').select('message_id, bucket_path').in('message_id', c), 'the files'),
    mattersHolding(admin, me, plan.remove),
  ])

  let removed = 0
  let held = plan.keep.length
  let orphaned = 0
  for (const id of plan.remove) {
    // Its message_attachments rows go with it (ON DELETE CASCADE). A line the office has since made the record of
    // something by (contact_owed, ON DELETE RESTRICT) cannot go: it stays, and so do its files.
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
    // The way a person unties a line on the thread, as the caller: no job, tied_by stamped.
    await tieLine(ctx, id, null, record?.taggedBy ?? me.id, { tie: 'The untag stopped partway. A line could not be untied.', stamp: 'The untag stopped partway. An untied line could not name who untied it.' })
    untied++
  }
  // The tag's grey line goes with it, before the row whose id keys it. One that will not go is logged and left.
  let eventGone = false
  if (tagRow) {
    const event = await admin.from('messages').delete().eq('quo_id', myMailTagEventKey(tagRow.id)).eq('channel', 'event')
    if (event.error) console.warn(JSON.stringify({ event: 'gmail_mine_event_line_left', user: me.id, reason: String(event.error.message).slice(0, 300) }))
    else eventGone = true
  }
  // The row goes last, so an untag that stopped before here finds the tag again and finishes.
  if (tagRow) {
    const gone = await admin.from('email_tag_threads').delete().eq('id', tagRow.id)
    if (gone.error) throw stopped('The untag stopped before the tag came off.', gone.error.message)
  }
  // The label comes off the mail that carries it. A box that never had it has nothing to take off, and nothing is made.
  // A mail it will not leave is counted in the answer (`labelLeft`), never swallowed; when the box's labels cannot be
  // read, every mail a tag could have labelled (never a draft, Spam, Trash or a chat) may still carry it.
  let unlabelled = 0
  let labelLeft = 0
  let labelId: string | undefined
  if (mails.length > 0) {
    try {
      labelId = ((await gmailLabels(ctx.token)).labels ?? []).find((l) => l.name === MY_MAIL_GMAIL_LABEL)?.id
    } catch {
      labelLeft = mails.filter((m) => !neverRead(m.labelIds)).length
    }
  }
  for (const m of labelId ? mails.filter((x) => (x.labelIds ?? []).includes(labelId!)) : []) {
    try {
      await gmailRemoveLabel(ctx.token, m.id, labelId!)
      unlabelled++
    } catch {
      labelLeft++
    }
  }
  if (labelLeft > 0) console.warn(JSON.stringify({ event: 'gmail_mine_label_left', user: me.id, left: labelLeft, mails: mails.length }))
  const answer: MyMailUntagOk = { ok: true, removed, keptForMatter: kept > 0, held, labelLeft }
  log({ event: 'gmail_mine_untag', user: me.id, had_tag: Boolean(tagRow), removed, held, kept_for_office: plan.keep.length, orphaned, untied, unlabelled, label_left: labelLeft, kept_for_matter: kept, event_line: eventGone })
  return json(answer)
}

// ---------- follow: later mail in a tagged conversation, the cron's ----------

/** A tagged conversation as the follow reads its row. */
interface FollowTag {
  id: string
  user_id: string
  gmail_thread_id: string
  bid_id: string | null
  project_id: string | null
  jobs_ledger_id: string | null
  tagged_by: string | null
  /** The conversation's newest mail as the tag or the last good read found it; null until one has. */
  last_mail_at: string | null
}

/**
 * The run's marks on the rows it read: the read's time, then no error and the conversation's newest mail when the read
 * found one (`lastMailAt`), or the reason with the newest mail left where it was. A failed read moves `last_read_at`
 * too, so the row goes to the back and is read again in its turn: never starved behind a run's worth of healthy rows,
 * never read ahead of them run after run. Its `last_mail_at` stands, so it ages out of the window like any other.
 */
async function markFollowed(admin: Admin, ids: readonly string[], error: string | null, lastMailAt: string | null = null): Promise<void> {
  const readAt = nowIso()
  const patch = error === null ? { last_read_at: readAt, last_error: null, ...(lastMailAt ? { last_mail_at: lastMailAt } : {}) } : { last_read_at: readAt, last_error: error.slice(0, 1000) }
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const { error: failed } = await admin.from('email_tag_threads').update(patch).in('id', chunk)
    if (failed) console.warn(JSON.stringify({ event: 'gmail_mine_follow_unmarked', rows: chunk.length, reason: String(failed.message).slice(0, 300) }))
  }
}

/** Why a row's read failed, in the words its `last_error` keeps. */
function followReason(e: unknown): string {
  if (e instanceof Stop) return e.refusal.words
  if (e instanceof GmailError) return e.status === 404 ? MY_MAIL_FOLLOW_GONE : gmailRefusal(e).words
  return stoppedRefusal('Reading later mail stopped.', words(e), 'The reason').words
}

/** The follow met a conversation an untag is taking off (`untagging_at`), or one gone since: it stops there and marks nothing. */
class Untagging extends Error {}

/**
 * The row as the follow may still land mail on it: there, and marked by no untag (`untagging_at`), with the lines it
 * records as the tag's own ties. Null when an untag has marked it or taken it off since the run picked its rows.
 */
async function stillFollowed(admin: Admin, tagId: string): Promise<{ tied_line_ids?: string[] | null } | null> {
  const { data, error } = await admin.from('email_tag_threads').select('id, tied_line_ids').eq('id', tagId).is('untagging_at', null).maybeSingle()
  if (error) throw stopped('Reading later mail stopped. The tag could not be read.', error.message)
  return (data as { tied_line_ids?: string[] | null } | null) ?? null
}

/**
 * The lines the follow is about to tie, recorded on the row first (`tied_line_ids`, beside the tag's), so the untag
 * unties them and no line placed by hand. The record is read again right before, since a tag may have grown it since
 * the run began, and an untag that has marked the row since stops the follow there (`Untagging`).
 */
async function recordTies(admin: Admin, tagId: string, ids: readonly string[]): Promise<void> {
  const live = await stillFollowed(admin, tagId)
  if (!live) throw new Untagging()
  const saved = await admin.from('email_tag_threads').update({ tied_line_ids: withTies(live.tied_line_ids, ids) }).eq('id', tagId)
  if (saved.error) throw stopped('Reading later mail stopped partway. The lines it ties could not be kept on the tag.', saved.error.message)
}

/**
 * One tagged conversation, read as its person: its mail by the headers (`threads.get`, `format=metadata`), the lines that
 * hold it, then `planFollow`: a box's loose line is recorded on the row and tied, as the service role with the tagger
 * stamped (`tieLine`), each mail no line holds is read whole and lands through `landMail` as a tag lands it (the row
 * asked once more first: an untag that began since stops it, `Untagging`), a mail under a label the person leaves out is
 * skipped, and what landed or was tied gets the label. Answers the conversation's newest mail (`newestMailAt` over the
 * headers' `internalDate`, never earlier than the row's own). Throws what stopped it; what was done stays.
 */
async function followOne(as: AsPerson, tag: FollowTag, job: MyMailJobChip, known: Pick<MyMailKnown, 'team' | 'boxes' | 'hidden'>, run: Run, labels: { labelled: number; missed: number }): Promise<string | null> {
  const { admin, me } = as
  const { done } = run
  const person = { userId: me.id, address: me.email, name: me.name }
  const thread = await gmailThreadHeaders(as.token, tag.gmail_thread_id, MY_MAIL_METADATA_HEADERS)
  const mails = (thread.messages ?? []).map((m) => readGmailMessage(m))
  const [byRfc, byId] = await Promise.all([
    rowsIn<MyMailFollowLine>(unique(mails.map((m) => rfcMessageId(m))), (c) => admin.from('messages').select(FOLLOW_LINE_COLUMNS).in('rfc_message_id', c), 'the lines'),
    // A line a tag wrote for a mail with no Message-ID is found by its Gmail id, in this person's box alone.
    rowsIn<MyMailFollowLine>(
      unique(mails.filter((m) => !rfcMessageId(m)).map((m) => m.gmailId)),
      (c) => admin.from('messages').select(FOLLOW_LINE_COLUMNS).eq('mail_user_id', me.id).in('gmail_id', c),
      'the lines',
    ),
  ])
  const steps = planFollow({ threadId: tag.gmail_thread_id, messages: mails }, person, job, { lines: [...byRfc, ...byId], ...known })
  const landed: string[] = []
  const ties = steps.flatMap((s) => (s.kind === 'tie' ? [s] : []))
  if (ties.length > 0) await recordTies(admin, tag.id, ties.map((s) => s.messageId))
  for (const step of ties) {
    await tieLine({ admin }, step.messageId, job, tag.tagged_by, {
      tie: 'Reading later mail stopped partway. A line could not be tied to the job.',
      stamp: 'Reading later mail stopped partway. A tied line could not name who tagged it.',
    })
    done.tied++
    landed.push(step.gmailId)
  }
  const fresh = steps.filter((s) => s.kind === 'write').map((s) => s.gmailId)
  if (fresh.length > 0) {
    const emails = (await readAll(as.token, fresh)).map((m) => readGmailMessage(m))
    const emailById = new Map(emails.map((e) => [e.gmailId, e]))
    const plan = planTag({ threadId: tag.gmail_thread_id, messages: emails }, person, job, { byMessageId: {}, ...known })
    // Asked once more before anything lands: an untag that marked the row while its mail was read stops the follow here.
    if (!(await stillFollowed(admin, tag.id))) throw new Untagging()
    for (const step of plan.steps) {
      const email = step.kind === 'write' ? emailById.get(step.gmailId) : undefined
      if (step.kind !== 'write' || !email) {
        done.skipped++
        continue
      }
      const line = await landMail(as, email, step, plan, run, 'Reading later mail')
      if (line.written) landed.push(step.gmailId)
    }
  }
  const label = await labelMails(as, landed)
  labels.labelled += label.labelled
  labels.missed += label.missed
  return newestMailAt(mails, tag.last_mail_at)
}

/**
 * The follow: the tagged conversations in the window (`followWindow`: the newest mail, or the tag when that is later,
 * younger than 60 days), in turn: the least recently read first (one never read before any), then the oldest tag, at
 * most `FOLLOW_ROWS_PER_RUN`, each read as its person with one Google token per person per run. A row read in full moves
 * its `last_read_at`, clears its `last_error` and moves its `last_mail_at` up to the newest mail it found; a row that
 * failed moves its `last_read_at` too and records the reason, keeping its `last_mail_at`, and the next row still runs. A
 * person whose token fails (off the Workspace, or switched off at Google since) has their rows marked so and is skipped
 * for the run, and so is one whose box's labels cannot be read while they leave a label out. A row an untag has marked
 * (`untagging_at`) is never picked, and a row an untag marks after the run picked it is passed by when its turn comes.
 * One line of counts, never a subject or an address.
 */
async function follow(admin: Admin, saJson: string): Promise<Response> {
  const users = await rows<MyMailFollowUserRow>(admin.from('users').select(FOLLOW_USER_COLUMNS).eq('my_mail_on', true).in('role', [...MY_MAIL_OFFICE_ROLES]), 'the people who tag')
  const people = new Map<string, MyMailFollowPerson>(followPeople(users).map((p) => [p.id, p]))
  const hiddenOf = new Map(users.map((u) => [u.id, myMailHiddenLabels(u.my_mail_hidden_labels)]))
  const tags =
    people.size === 0
      ? []
      : await rows<FollowTag>(
          admin
            .from('email_tag_threads')
            .select(FOLLOW_TAG_COLUMNS)
            .in('user_id', [...people.keys()])
            .is('untagging_at', null)
            .or(followWindow(followSince(Date.now())))
            .order('last_read_at', { ascending: true, nullsFirst: true })
            .order('tagged_at', { ascending: true })
            .limit(FOLLOW_ROWS_PER_RUN),
          'the tagged conversations',
        )
  const byPerson = new Map<string, FollowTag[]>()
  for (const t of tags) {
    const list = byPerson.get(t.user_id) ?? []
    list.push(t)
    byPerson.set(t.user_id, list)
  }
  const run = newRun()
  const { done } = run
  const labels = { labelled: 0, missed: 0 }
  let failed = 0
  let refusedPeople = 0
  let labelsUnread = 0
  let untagging = 0
  if (tags.length > 0) {
    const [team, boxes] = await Promise.all([loadTeam(admin), loadOurBoxes(admin)])
    for (const [userId, theirs] of byPerson) {
      const me = people.get(userId)
      if (!me) continue
      let token: string
      try {
        token = await googleServiceToken(saJson, GMAIL_SCOPES, me.email)
      } catch (e) {
        failed += theirs.length
        refusedPeople++
        await markFollowed(admin, theirs.map((t) => t.id), tokenRefusal(words(e)).words)
        continue
      }
      // The labels they leave out, by Gmail's ids, once for the run: a mail under one is never copied onto a job.
      let hidden: string[]
      try {
        hidden = await hiddenLabelIds(token, hiddenOf.get(userId) ?? [])
      } catch (e) {
        failed += theirs.length
        labelsUnread++
        await markFollowed(admin, theirs.map((t) => t.id), followReason(e))
        continue
      }
      const as: AsPerson = { admin, token, me }
      for (const tag of theirs) {
        try {
          const job = tagRowJob(tag)
          if (!job) throw stopped('Reading later mail stopped. The tag names no job.', 'no job column is set')
          // Asked again when its turn comes: an untag that marked the row since the run picked it is passed by.
          if (!(await stillFollowed(admin, tag.id))) throw new Untagging()
          const newest = await followOne(as, tag, job, { team, boxes, hidden }, run, labels)
          await markFollowed(admin, [tag.id], null, newest)
        } catch (e) {
          if (e instanceof Untagging) {
            untagging++
            continue
          }
          failed++
          await markFollowed(admin, [tag.id], followReason(e))
        }
      }
    }
  }
  const answer: MyMailFollowOk = { ok: true, rows: tags.length, lines: done.lines, tied: done.tied, failed }
  log({
    event: 'gmail_mine_follow',
    rows: tags.length,
    people: byPerson.size,
    lines: done.lines,
    tied: done.tied,
    failed,
    refused_people: refusedPeople,
    labels_unread: labelsUnread,
    untagging,
    files: done.files,
    not_copied: done.notCopied,
    already: done.already,
    skipped: done.skipped,
    eml_missed: done.emlMissed,
    listed: done.listed,
    unlisted: done.unlisted,
    copies_removed: done.copiesRemoved,
    copies_left: done.copiesLeft,
    ...labels,
  })
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

    // The cron's door (`gmail-mine-follow`): its secret, and the follow alone. A wrong or missing secret is no secret, so
    // the call is a person's, and the signed-in door below never runs the follow (`parseMyMailRequest` refuses it).
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (cronSecret && req.headers.get('X-Cron-Secret') === cronSecret) {
      action = 'follow'
      if (!isFollowRequest(await req.json().catch(() => null))) return refuse(myMailRefusal('badRequest'), MY_MAIL_REFUSAL_STATUS.badRequest, action)
      return await follow(admin, saJson)
    }

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
