/**
 * gmail-sync: Messages, cut 6 (email in), the bids@ reader (`to-dos/gc-mode/messages/BUILD_PLAN.md` → Cut 6 and the
 * mock-up `email-in-mockups.html` on branch spike/gc-mode). Every email that reaches bids@ lands in its sender's thread:
 * read through the Gmail API as the bids@ mailbox under the service account's domain-wide delegation, taken once by its
 * Gmail id (`email_write_line`), and marked with the label "In ClickTooling". Nothing in Gmail is deleted, archived,
 * moved or marked read.
 *
 * Cron only, every minute (`20261021130000_gmail_sync_every_minute.sql`; every 3 before), with X-Cron-Secret. With the switch
 * (`app_settings` `gmail_sync_on_v1`) off, nothing.
 * - The first run after the switch keeps the mailbox's history point and reads nothing older (no backfill).
 * - Each run reads the Inbox's new messages since the last point, oldest first, up to 40.
 *   - A message already labelled is passed over.
 *   - A forwarded copy one of us sent on lands on its first sender, with the forwarder's note as a team note
 *     (`src/lib/emailIn/forwarded.ts`).
 *   - A teammate's own mail (v2.5722, the owner's call of 2026-10-21): to the box, with nobody outside named, it lands
 *     on their Our team thread, coming in; to a customer with the box copied, on the customer's thread as ours, going
 *     out, under the teammate's name (`emailLine.ts`'s `emailParty`). Before that every staff address was left out.
 *   - Mail the reader leaves out (`leftOut.ts`: bulk, no-reply, Gmail's other tabs, the box's own and the app's) stays
 *     with no label.
 * - The sender's address finds its contact or makes the Who is this? row (`email_place_address`).
 * - The subject's job number, or a job's name among the sender's own, ties the line (`jobInSubject.ts`). Else the
 *   person's star does, and with no star the line sits on the person.
 * - Each file up to 25 MB is copied into the private `message-attachments` bucket. A bigger one, or one that would
 *   not copy, stays in Gmail. A file host's link stays a link. A trade partner's W-9 or certificate is guessed for the
 *   thread's offer (`emailLine.ts`).
 * - The point moves only past records taken whole (`historyWalk.ts`): a message that fails stops the run, keeps the point
 *   at the last record taken whole and writes `last_error`, and the next run starts there; what was taken is passed
 *   over by its label. The run's health is on `gmail_sync_state` (`last_run_at`, `last_ok_at`, `last_error`,
 *   `last_taken`).
 *
 *
 * Two boxes since R6's reader (v2.5494, `src/lib/emailIn/readerBoxes.ts`): bids@ as above, and the team box once
 * `app_settings` `messages_boxes_v1.team.address` holds an address, read as that Workspace user under the same
 * delegation. Each box has its own token, its own `gmail_sync_state` row (by `mailbox`; the team row is made on its first
 * run, at its newest point), its own label and its own try, so a box that fails writes its own `last_error` and the other
 * still reads. Each line carries the box it came through (`messages.mailbox`).
 *
 * One email sent to both boxes is two Gmail messages with one Message-ID (v2.5504, `messages.rfc_message_id`). Each line
 * carries the mail's Message-ID, and the box that reads one second writes nothing: it finds the line the first box wrote,
 * puts its own label on, and counts it as taken before. `email_write_line` holds the same rule, so two runs at once
 * still write one line.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON, GMAIL_IMPERSONATE_USER
 * (bids@, never written in the repo), EMAIL_FROM. config.toml keeps verify_jwt = false: the cron sends no JWT.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { GMAIL_SCOPES, GmailError, gmailAddLabel, gmailAttachment, gmailHistory, gmailLabelId, gmailMessage, gmailProfile, gmailSearch } from '../_shared/gmail.ts'
import { googleServiceToken } from '../_shared/googleToken.ts'
import { emailFileRows, emailLine, emailParty, rfcMessageId } from '../_shared/gcKernels/lib/emailIn/emailLine.ts'
import { readerBoxes, type ReaderBox } from '../_shared/gcKernels/lib/emailIn/readerBoxes.ts'
import { BOXES_SETTINGS_KEY, parseBoxSettings, type BoxSettings, type Mailbox } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { isOwnAddress, ownChannels } from '../_shared/gcKernels/lib/messages/ownChannels.ts'
import { kitCarries, type WalkKit } from '../_shared/gcKernels/lib/walk/kit.ts'
import { loadWalkKit } from '../_shared/walkKit.ts'
import { readForwarded } from '../_shared/gcKernels/lib/emailIn/forwarded.ts'
import { walkHistory, type HistoryWalk, type Took } from '../_shared/gcKernels/lib/emailIn/historyWalk.ts'
import { base64UrlBytes, parseAddress, readGmailMessage } from '../_shared/gcKernels/lib/emailIn/gmailMessage.ts'
import { jobInSubject } from '../_shared/gcKernels/lib/emailIn/jobInSubject.ts'
import { leftOut, outsideInbox } from '../_shared/gcKernels/lib/emailIn/leftOut.ts'
import { subjectJobs, subjectNumbers, type SubjectBidRow, type SubjectPipelineRow, type SubjectProjectRow } from '../_shared/gcKernels/lib/emailIn/subjectJobs.ts'
import { buildLedgerPrefixMap, type LedgerPrefixMap } from '../_shared/gcKernels/lib/ledgerDisplayPrefixes.ts'

/** The label the reader adds to each email it took. */
const LABEL_NAME = 'In ClickTooling'
const SWITCH_KEY = 'gmail_sync_on_v1'
const BUCKET = 'message-attachments'
/** The most messages one run reads: the next run takes the rest. */
const MAX_PER_RUN = 40
/** The roles whose addresses are ours: the office and the field staff. A sub or a helper is someone we write to. */
const STAFF_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent']

// deno-lint-ignore no-explicit-any
type Admin = any

interface TeamMember {
  id: string
  name: string
}

interface Ctx {
  admin: Admin
  token: string
  labelId: string
  /** The box it reads, which each line carries in `messages.mailbox`. */
  box: Mailbox
  /** How a line names the box: `bids@`. */
  mailbox: string
  /** The boxes, the app's sender and the staff's addresses. */
  isOurs: (address: string) => boolean
  /** The boxes and the app's sender alone: mail from these is a copy of ours and is left out. */
  isTheBox: (address: string) => boolean
  member: (address: string) => TeamMember | null
  /**
   * The walk kit (punch list #142), while one is set up: an address of our own the kit's contact carries is a person
   * writing in, so `isOurs` and `isTheBox` answer false for it, and `carried` says which it is.
   */
  kit: WalkKit | null
  carried: (address: string) => boolean
  prefixes: LedgerPrefixMap
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const nowIso = () => new Date().toISOString()

/**
 * A box's row, made when it is not there yet (the team box's first run). The old one-row key `id` stays true on the bids
 * row alone (`gmail_sync_state_id_is_bids`), so the team row is written with none.
 */
async function saveState(admin: Admin, box: Mailbox, fields: Record<string, unknown>): Promise<void> {
  const row = { mailbox: box, ...(box === 'bids' ? {} : { id: null }), ...fields, updated_at: nowIso() }
  const { error } = await admin.from('gmail_sync_state').upsert(row, { onConflict: 'mailbox' })
  if (error) throw new Error(`Saving the ${box} reader's state failed: ${error.message}`)
}

type Team = Pick<Ctx, 'isOurs' | 'isTheBox' | 'member' | 'kit' | 'carried'>

/**
 * Our addresses: the boxes, the app's sender and the staff's, each to its team member when one is. The walk kit's rule
 * (punch list #142 PR 1): an own address the kit's contact carries (the bids box's, while a walk is set up) is not ours
 * and not the box, so `leftOut` takes mail from it and `emailParty` reads it as a person writing in.
 */
async function loadTeam(admin: Admin, settings: BoxSettings | null, boxes: readonly string[]): Promise<Team> {
  const { data, error } = await admin.from('users').select('id, name, email, role').in('role', STAFF_ROLES).not('email', 'is', null).eq('is_walk_tester', false)
  if (error) throw new Error(`Reading the team failed: ${error.message}`)
  const byAddress = new Map<string, TeamMember>()
  for (const u of (data ?? []) as { id: string; name: string | null; email: string | null }[]) {
    const key = (u.email ?? '').trim().toLowerCase()
    if (key) byAddress.set(key, { id: u.id, name: (u.name ?? '').trim() || key })
  }
  const appFrom = parseAddress(EMAIL_FROM)?.address.trim().toLowerCase()
  const own = ownChannels(settings, appFrom, boxes)
  const theBox = new Set(own.addresses)
  const ours = new Set([...byAddress.keys(), ...theBox])
  const kit = await loadWalkKit(admin)
  const carried = (address: string) => isOwnAddress(own, address) && kitCarries(kit, 'email', address)
  return {
    isOurs: (address) => !carried(address) && ours.has(address.trim().toLowerCase()),
    isTheBox: (address) => !carried(address) && theBox.has(address.trim().toLowerCase()),
    member: (address) => byAddress.get(address.trim().toLowerCase()) ?? null,
    kit,
    carried,
  }
}

async function loadPrefixes(admin: Admin): Promise<LedgerPrefixMap> {
  const { data, error } = await admin.from('service_types').select('id, ledger_job_prefix, ledger_bid_prefix')
  if (error) throw new Error(`Reading the job prefixes failed: ${error.message}`)
  return buildLedgerPrefixMap(data ?? [])
}

const keyOf = (r: { bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null }): string | null =>
  r.bid_id ? `bid:${r.bid_id}` : r.project_id ? `project:${r.project_id}` : r.jobs_ledger_id ? `pipeline:${r.jobs_ledger_id}` : null

/** A job key (`messages/load.ts`'s `jobKey`) as the line's three job columns. */
const jobColumns = (key: string | null): { bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null } => {
  const [kind, id] = key ? [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)] : ['', '']
  return { bid_id: kind === 'bid' ? id : null, project_id: kind === 'project' ? id : null, jobs_ledger_id: kind === 'pipeline' ? id : null }
}

async function rows<T>(query: Promise<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(`Reading ${what} failed: ${error.message}`)
  return data ?? []
}

/** The job a line ties to: the one its subject names, else the person's star, else none. */
async function jobFor(ctx: Ctx, contactId: string, subject: string): Promise<string | null> {
  const ties = await rows<{ bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null; is_default: boolean }>(
    ctx.admin.from('contact_jobs').select('bid_id, project_id, jobs_ledger_id, is_default').eq('contact_id', contactId),
    "the person's jobs",
  )
  const star = keyOf(ties.find((t) => t.is_default) ?? { bid_id: null, project_id: null, jobs_ledger_id: null })
  const mine = new Set(ties.map(keyOf).filter((k): k is string => k !== null))
  const nums = subjectNumbers(subject)
  if (!subject.trim() || (nums.length === 0 && mine.size === 0)) return star
  const ids = (kind: string) => [...mine].filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1))
  const inList = (vals: string[]) => vals.map((v) => `"${v}"`).join(',')
  const clicks = [...nums, ...nums.map((n) => `C${n}`)]
  const [bidsByNum, bidsMine, projectsByNum, projectsMine, jobsByNum, jobsMine] = await Promise.all([
    nums.length ? rows<SubjectBidRow>(ctx.admin.from('bids').select('id, bid_number, project_name, service_type_id').in('bid_number', nums).limit(50), 'the bids') : [],
    ids('bid').length ? rows<SubjectBidRow>(ctx.admin.from('bids').select('id, bid_number, project_name, service_type_id').in('id', ids('bid')), 'the bids') : [],
    nums.length ? rows<SubjectProjectRow>(ctx.admin.from('projects').select('id, project_number, name').in('project_number', nums).limit(50), 'the projects') : [],
    ids('project').length ? rows<SubjectProjectRow>(ctx.admin.from('projects').select('id, project_number, name').in('id', ids('project')), 'the projects') : [],
    nums.length
      ? rows<SubjectPipelineRow>(ctx.admin.from('jobs_ledger').select('id, hcp_number, click_number, job_name, service_type_id').or(`hcp_number.in.(${inList(nums)}),click_number.in.(${inList(clicks)})`).limit(50), 'the Pipeline jobs')
      : [],
    ids('pipeline').length ? rows<SubjectPipelineRow>(ctx.admin.from('jobs_ledger').select('id, hcp_number, click_number, job_name, service_type_id').in('id', ids('pipeline')), 'the Pipeline jobs') : [],
  ])
  // A project the subject names by number is a GC project only when gc_projects has it.
  const projectIds = [...new Set([...projectsByNum, ...projectsMine].map((p) => p.id))]
  const gc = projectIds.length
    ? new Set((await rows<{ project_id: string }>(ctx.admin.from('gc_projects').select('project_id').in('project_id', projectIds), 'the GC projects')).map((g) => g.project_id))
    : new Set<string>()
  const jobs = subjectJobs(
    {
      bids: [...bidsMine, ...bidsByNum],
      projects: [...projectsMine, ...projectsByNum].filter((p) => gc.has(p.id)),
      pipeline: [...jobsMine, ...jobsByNum],
      prefixes: ctx.prefixes,
    },
    mine,
  )
  return jobInSubject(subject, jobs) ?? star
}

/** A file's name as a path part: the bucket takes letters, digits, dots, dashes, underscores and spaces. */
const safeName = (name: string): string => name.replace(/[^A-Za-z0-9._ -]+/g, '_').slice(0, 120) || 'file'

/** A line already holding this Message-ID: the same mail, read first in the other box. */
async function heldLine(ctx: Ctx, rfc: string | null): Promise<boolean> {
  if (!rfc) return false
  const { data, error } = await ctx.admin.from('messages').select('id').eq('rfc_message_id', rfc).limit(1)
  if (error) throw new Error(`Reading the line for ${rfc} failed: ${error.message}`)
  return (data ?? []).length > 0
}

/** One message: read, placed, tied, its files copied, written once, then labelled. */
async function takeOne(ctx: Ctx, id: string): Promise<Took> {
  let m
  try {
    m = await gmailMessage(ctx.token, id)
  } catch (e) {
    if (e instanceof GmailError && e.status === 404) return 'gone'
    throw e
  }
  if (m.labelIds?.includes(ctx.labelId)) return 'already'
  const email = readGmailMessage(m)
  const fwd = readForwarded(email, ctx.isOurs)
  if (fwd ? outsideInbox(email) : leftOut(email, ctx.isTheBox)) return 'left'
  const party = emailParty(email, fwd, { isOurs: ctx.isOurs, isTheBox: ctx.isTheBox })
  if (!party) return 'left'
  // The same mail, read first in the other box: no address placed, no file copied, no line. Only this box's label.
  if (await heldLine(ctx, rfcMessageId(email))) {
    await gmailAddLabel(ctx.token, email.gmailId, ctx.labelId)
    return 'already'
  }

  const placed = await ctx.admin.rpc('email_place_address', { p_value: party.address.address, p_name: party.address.name }).single()
  if (placed.error) throw new Error(`Placing ${email.gmailId}'s address failed: ${placed.error.message}`)
  const contactId = placed.data.placed_contact as string
  // Our own address the walk kit carries lands on the kit's contact alone (punch list #142). Placed anywhere else (a
  // record that carries the same address with a newer line), the mail is passed over with no label: it stays in Gmail,
  // and the week's fallback search would offer it again.
  if (ctx.carried(party.address.address) && contactId !== ctx.kit?.contactId) {
    console.warn(`gmail-sync: ${email.gmailId} from ${party.address.address}, our own address the walk kit carries, was placed on ${contactId}, not the kit's contact ${ctx.kit?.contactId}: passed over`)
    return 'left'
  }

  const by = fwd ? ctx.member(fwd.by.address) : null
  const line = emailLine(email, fwd, party, ctx.mailbox, by?.name ?? null)
  const jobKey = await jobFor(ctx, contactId, line.subject ?? '')

  const files: Record<string, unknown>[] = []
  for (const f of emailFileRows(email, placed.data.placed_kind as string)) {
    if (f.kind === 'link') {
      files.push({ kind: 'link', name: f.name, url: f.url, host: f.host })
      continue
    }
    const base = { kind: 'file', name: f.name, mime: f.mime, size_bytes: f.size, gmail_attachment_id: f.attachmentId, paper: f.paper }
    if (f.keep === 'tooBig') {
      files.push({ ...base, left_in_gmail: 'too_big' })
      continue
    }
    const path = `${email.gmailId}/${f.partId || files.length}-${safeName(f.name)}`
    try {
      const data = f.attachmentId ? (await gmailAttachment(ctx.token, email.gmailId, f.attachmentId)).data : email.files.find((x) => x.partId === f.partId)?.data
      const bytes = base64UrlBytes(data ?? '')
      if (bytes.length === 0 && f.size > 0) throw new Error('no bytes')
      const up = await ctx.admin.storage.from(BUCKET).upload(path, bytes, { contentType: f.mime, upsert: true })
      if (up.error) throw new Error(up.error.message)
      files.push({ ...base, bucket_path: path })
    } catch (e) {
      console.warn('gmail-sync: a file was not copied', email.gmailId, f.partId, e instanceof Error ? e.message : e)
      files.push({ ...base, left_in_gmail: 'not_copied' })
    }
  }

  // Our line going out: the forwarded copy's first sender, or the teammate who copied the box (v2.5722).
  const ourSender = party.direction === 'out' ? ctx.member((fwd ? fwd.from : email.from)?.address ?? '') : null
  const row = {
    contact_id: contactId,
    channel_id: placed.data.placed_channel,
    direction: line.direction,
    who_user_id: ourSender?.id ?? null,
    who_text: line.whoText,
    at: line.at,
    subject: line.subject,
    body: line.body,
    gmail_thread_id: line.gmailThreadId,
    mailbox: ctx.box,
    rfc_message_id: line.rfcMessageId,
    ...jobColumns(jobKey),
  }
  const note = fwd?.note ? { who_user_id: by?.id ?? null, who_text: by ? '' : fwd.by.name || fwd.by.address, at: email.at, body: fwd.note } : null
  // Written or not (a line written before the label went on, or the same mail's line from the other box, answers written
  // false and writes nothing), the label goes on only once the write has answered: a crash in between leaves no label,
  // and the next run's write is a repeat.
  const wrote = await ctx.admin.rpc('email_write_line', { p_gmail_id: email.gmailId, p_row: row, p_files: files, p_note: note })
  if (wrote.error) throw new Error(`Writing ${email.gmailId} failed: ${wrote.error.message}`)
  await gmailAddLabel(ctx.token, email.gmailId, ctx.labelId)
  return (wrote.data as { written: boolean }[] | null)?.[0]?.written === false ? 'already' : 'taken'
}

/** One box's run: its token, its row, its label, and its walk. A failure here is this box's alone. */
async function runBox(admin: Admin, saJson: string, b: ReaderBox, team: Team, prefixes: LedgerPrefixMap): Promise<Record<string, unknown>> {
  const startedAt = nowIso()
  await saveState(admin, b.mailbox, { last_run_at: startedAt })
  try {
    const token = await googleServiceToken(saJson, GMAIL_SCOPES, b.address)
    const { data: state, error } = await admin.from('gmail_sync_state').select('history_id').eq('mailbox', b.mailbox).maybeSingle()
    if (error) throw new Error(`Reading the ${b.mailbox} reader's state failed: ${error.message}`)
    // Found by its name each run, and made again if someone took it off the box.
    const labelId = await gmailLabelId(token, LABEL_NAME)

    // The first run: keep the box's history point and read nothing older.
    if (!state?.history_id) {
      const profile = await gmailProfile(token)
      await saveState(admin, b.mailbox, { history_id: profile.historyId, label_id: labelId, last_ok_at: nowIso(), last_error: null, last_taken: 0 })
      return { ok: true, started: true }
    }

    const ctx: Ctx = { admin, token, labelId, box: b.mailbox, mailbox: b.words, ...team, prefixes }
    let walk: HistoryWalk
    try {
      walk = await walkHistory(state.history_id, (pageToken) => gmailHistory(token, state.history_id, pageToken), (id) => takeOne(ctx, id), MAX_PER_RUN)
    } catch (e) {
      if (!(e instanceof GmailError && e.status === 404)) throw e
      // Gmail no longer keeps that history point: the Inbox's untaken mail of the last week, then the box's newest point.
      const counts: Record<Took, number> = { taken: 0, already: 0, left: 0, gone: 0 }
      const found = await gmailSearch(token, `in:inbox -label:"${LABEL_NAME}" newer_than:7d`)
      for (const m of (found.messages ?? []).slice(0, MAX_PER_RUN).reverse()) counts[await takeOne(ctx, m.id)]++
      walk = { cursor: (await gmailProfile(token)).historyId, counts, full: false, error: null }
    }
    if (walk.error) {
      // A message failed: keep the point at the last record taken whole, and say why. The next run starts there.
      const message = walk.error instanceof Error ? walk.error.message : String(walk.error)
      await saveState(admin, b.mailbox, { history_id: walk.cursor, label_id: labelId, last_error: message.slice(0, 1000), last_taken: walk.counts.taken })
      throw walk.error
    }
    await saveState(admin, b.mailbox, { history_id: walk.cursor, label_id: labelId, last_ok_at: nowIso(), last_error: null, last_taken: walk.counts.taken })
    return { ok: true, full: walk.full, ...walk.counts }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await saveState(admin, b.mailbox, { last_error: message.slice(0, 1000) }).catch(() => undefined)
    throw e
  }
}

/** Every box Settings and the secret name (`readerBoxes`), each on its own: one that fails leaves the other reading. */
async function run(admin: Admin): Promise<{ ok: boolean; boxes: Record<string, unknown> }> {
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  const { data: boxesSetting } = await admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
  const settings = parseBoxSettings(boxesSetting?.value_text)
  const boxes = readerBoxes(settings, Deno.env.get('GMAIL_IMPERSONATE_USER'))
  if (!saJson || boxes.length === 0) {
    const message = 'GOOGLE_SERVICE_ACCOUNT_JSON and GMAIL_IMPERSONATE_USER must be set.'
    await saveState(admin, 'bids', { last_run_at: nowIso(), last_error: message }).catch(() => undefined)
    throw new Error(message)
  }
  const team = await loadTeam(admin, settings, boxes.map((b) => b.address))
  const prefixes = await loadPrefixes(admin)
  const out: Record<string, unknown> = {}
  let ok = true
  for (const b of boxes) {
    try {
      out[b.mailbox] = await runBox(admin, saJson, b, team, prefixes)
    } catch (e) {
      ok = false
      console.error(`gmail-sync ${b.mailbox}`, e)
      out[b.mailbox] = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { ok, boxes: out }
}

serve(async (req) => {
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    if (!cronSecret || headerSecret !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', SWITCH_KEY).maybeSingle()
    if (setting?.value_text !== 'true') return jsonResponse({ ok: true, off: true })
    const result = await run(admin)
    return jsonResponse(result, result.ok ? 200 : 500)
  } catch (e) {
    console.error('gmail-sync', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
