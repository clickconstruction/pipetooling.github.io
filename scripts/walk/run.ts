#!/usr/bin/env vite-node
/**
 * The walk (punch list #142 PR 8): `npm run walk` runs the Messages loop on prod end to end, on the company's own
 * inbox and number, prints what landed where with times, and cleans up after itself. The plan is
 * `to-dos/walk-kit/BUILD_PLAN.md` § PR 8 and `docs/WALK_KIT.md`.
 *
 *   npm run walk                       the whole loop, then cleanup
 *   npm run walk -- --keep             leave the kit's rows for a look
 *   npm run walk -- --owner-presses    the owner presses the two sends (BUILD_PLAN § 4)
 *   npm run walk -- --fallback-phone   the kit's phone is the owner's own; the owner texts the replies (§ 4)
 *   npm run walk -- --answer           the tester answers from the thread by email at the end
 *   npm run walk -- --cleanup-only     only clean up a kit left behind
 *
 * It reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEV_LOGIN_SECRET from the MAIN checkout's .env.local
 * and prints none of them; the tester's session lives in memory only; every line printed goes through `secretsOut`.
 * The sends are the tester's own presses through the app's doors (send-estimate-to-customer, quo-send,
 * messages-email) with its JWT; the `walk` function does what needs a server secret. The reads are the office's own
 * kernels on the tester's client, through RLS. Cleanup runs in a `finally` unless --keep.
 *
 * `runWalk` takes its io, so `src/lib/walk/walkDriver.run.test.ts` runs the whole script against fakes.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { parseWalkKit, type WalkKit } from '../../src/lib/walk/kit'
import { TESTER_EMAIL } from '../../src/lib/walk/walkFunction'
import {
  APP_FROM_ADDRESS,
  MAIL_WAIT_MS,
  OWNER_WAIT_MS,
  POLL_MS,
  STOP_WAIT_MS,
  TEXT_WAIT_MS,
  deliveredText,
  emptyReport,
  estimateTextWords,
  finishReport,
  inboundLine,
  openedLine,
  outboundCount,
  outboundLine,
  ownKeys,
  parseWalkFlags,
  reportKit,
  reportLines,
  secretsOut,
  stepHeld,
  stepSkipped,
  stepWent,
  stoppedForTeam,
  strayRows,
  stripDifference,
  tail4,
  waitUntil,
  waitedWords,
  WALK_FLAGS,
  type StrayContact,
  type ThreadLine,
  type WalkFlags,
  type WalkReport,
} from '../../src/lib/walk/walkRun'
import { MESSAGE_ROW_COLUMNS } from '../../src/lib/quo/rows'
import { BOXES_SETTINGS_KEY, parseBoxSettings, type BoxSettings } from '../../src/lib/messages/boxes'
import { supabaseFollowUpIo } from '../../src/lib/followUp/followUpIo'
import { followUpInputFromRows, followUpNewLane, type FollowUpRows } from '../../src/lib/followUp/followUpRows'
import { followUpQueue } from '../../src/lib/followUp/queue'
import { loadWaitingOnThem } from '../../src/lib/messages/waitingOnThemIo'
import { waitingOnThem, type WaitLine } from '../../src/lib/messages/waitingOnThem'
import { loadWentOut } from '../../src/lib/messages/wentOutIo'
import { wentOutRows, type WentOutLine } from '../../src/lib/messages/wentOut'
import { loadWeekStrip, type WeekStripRead } from '../../src/lib/messages/weekStripIo'
import { stripTiles } from '../../src/lib/messages/weekStrip'
import { todayYmdInAppTz } from '../../src/utils/dateUtils'

export const OWNER_EMAIL = 'robert@douglasmining.com'
export const PUBLIC_ORIGIN = 'https://clicktooling.com'
export const REPLY_WORDS = 'Can you do it Thursday?'
export const TEXT_WORDS = 'Thursday works'
export const ANSWER_WORDS = 'Thursday it is. We will be there at 9.'

// ---------------------------------------------------------------------------------------------------------------------
// The io the walk runs on: real below, fakes in the test
// ---------------------------------------------------------------------------------------------------------------------

export type Auth = 'anon' | 'secret' | { jwt: string }

export interface WalkChannel {
  id: string
  contact_id: string
  kind: string
  opted_out_at: string | null
  opted_out_by_box: Record<string, string | null> | null
}

/** The reads on the tester's client: the kit's rows, and the office's own loaders. */
export interface WalkReads {
  thread(contactId: string): Promise<ThreadLine[]>
  channel(id: string): Promise<WalkChannel | null>
  estimate(id: string): Promise<{ status: string | null; sent_at: string | null; title: string | null; estimate_number: number | null } | null>
  boxes(): Promise<BoxSettings | null>
  /** Contacts made since, with their channels; null when RLS refuses the read. */
  strays(sinceIso: string): Promise<StrayContact[] | null>
  loadQueue(todayYmd: string): Promise<FollowUpRows>
  loadWaiting(now: Date): Promise<WaitLine[]>
  loadWentOut(now: Date): Promise<WentOutLine[]>
  loadStrip(now: Date): Promise<WeekStripRead>
}

export interface WalkIo {
  /** POST a function: `walk` with the secret, a door with the tester's JWT, dev-login with the anon key and the secret. */
  call(name: string, body: unknown, auth: Auth): Promise<{ status: number; body: Record<string, unknown> | null }>
  /** dev-login + verifyOtp, in memory: the session's JWT and the reads on its client. */
  signIn(email: string): Promise<{ jwt: string; reads: WalkReads }>
  sleep(ms: number): Promise<void>
  now(): number
  log(line: string): void
  writeReport(report: WalkReport): string | null
  /** The values no printed line may carry: the keys, the secret, and what the walk learns (the JWT, the link). */
  secrets: string[]
}

// ---------------------------------------------------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------------------------------------------------

const iso = (ms: number) => new Date(ms).toISOString()

export async function runWalk(flags: WalkFlags, io: WalkIo): Promise<WalkReport> {
  const startedAt = iso(io.now())
  let report = emptyReport(startedAt, flags)
  const say = (line: string) => io.log(secretsOut(line, io.secrets))
  const held = new Set<string>()
  const step = (row: ReturnType<typeof stepWent>) => {
    report.steps.push(row)
    if (row.ok === false) held.add(row.key)
    say(`${row.ok === true ? '✓' : row.ok === false ? '✗' : '–'} ${row.name}${row.held ? ` — ${row.held}` : ''}${row.waitedFor ? ` (waited ${row.waitedFor})` : ''}`)
  }
  const walk = (action: string, body: Record<string, unknown> = {}) => io.call('walk', { action, ...body }, 'secret')
  const wait = <T>(check: () => Promise<T | null>, limitMs: number) => waitUntil(check, { limitMs, pollMs: POLL_MS, sleep: io.sleep, now: io.now })

  if (flags.cleanupOnly) {
    const res = await walk('cleanup')
    report.cleanup = res.body
    step(res.status === 200 ? stepWent('cleanup') : stepHeld('cleanup', String(res.body?.words ?? `walk cleanup answered ${res.status}`)))
    report = finishReport(report, iso(io.now()))
    for (const l of reportLines(report)) say(l)
    return report
  }

  let kit: WalkKit | null = null
  try {
    // 1. The kit.
    const setupBody: Record<string, unknown> = flags.fallbackPhone ? { fallback: true, ownerEmail: OWNER_EMAIL } : {}
    const setup = await walk('setup', setupBody)
    if (setup.status !== 200 || !setup.body?.kit) {
      step(stepHeld('setup', String(setup.body?.words ?? `walk setup answered ${setup.status}`)))
      return (report = finishReport(report, iso(io.now())))
    }
    kit = parseWalkKit(JSON.stringify(setup.body.kit))
    if (!kit) {
      step(stepHeld('setup', 'walk setup answered a kit this driver cannot read'))
      return (report = finishReport(report, iso(io.now())))
    }
    const tester = setup.body.tester as { id: string; email: string } | undefined
    report.kit = reportKit(kit)
    report.tester = tester ? { id: tester.id, email: tester.email } : null
    step(stepWent('setup', { where: `kit ${kit.contactId}, estimate ${kit.estimateId ?? 'none'}${(setup.body.kit as { made?: boolean }).made === false ? ' (kept from an earlier run)' : ''}` }))

    // 2. The session: the tester's, or the owner's when the owner presses.
    const who = flags.ownerPresses ? OWNER_EMAIL : TESTER_EMAIL
    let session: { jwt: string; reads: WalkReads }
    try {
      session = await io.signIn(who)
      io.secrets.push(session.jwt)
      step(stepWent('signIn', { where: `as ${who}` }))
    } catch (e) {
      step(stepHeld('signIn', e instanceof Error ? e.message : String(e)))
      return (report = finishReport(report, iso(io.now())))
    }
    const { reads } = session
    const asTester: Auth = { jwt: session.jwt }

    // 3. The seed: an older text of ours, so Waiting on them has a row to read today.
    const seed = await walk('seed-old')
    step(seed.status === 200 ? stepWent('seedOld', { where: `line ${String(seed.body?.id ?? '')} at ${String(seed.body?.at ?? '')}` }) : stepHeld('seedOld', String(seed.body?.words ?? `walk seed-old answered ${seed.status}`)))

    // 4 and 5. The two sends: the tester's presses, or the owner's.
    const sendsAt = iso(io.now())
    let estimateTextId: string | null = null
    if (flags.ownerPresses) {
      say('Press now, in the app: open the customer "ZZ Walk Messages Desk", open its draft estimate, press Send, and in the Tell the customer sheet press Send both.')
      const sent = await wait(async () => {
        const est = kit?.estimateId ? await reads.estimate(kit.estimateId) : null
        return est?.status === 'sent' ? est : null
      }, OWNER_WAIT_MS)
      step(sent.found ? stepWent('estimateEmail', { sentAt: sent.found.sent_at, where: 'the owner’s press', waitedFor: waitedWords(sent.waitedMs) }) : stepHeld('estimateEmail', 'the estimate did not turn sent', { waitedFor: waitedWords(sent.waitedMs), saw: 'still a draft' }))
      const text = await wait(async () => (kit ? outboundLine(await reads.thread(kit.contactId), 'text', sendsAt) : null), sent.found ? TEXT_WAIT_MS : 1)
      estimateTextId = text.found?.id ?? null
      step(text.found ? stepWent('estimateText', { sentAt: text.found.at, where: 'the owner’s press, a text out', waitedFor: waitedWords(text.waitedMs) }) : stepHeld('estimateText', 'no text line appeared', { waitedFor: waitedWords(text.waitedMs) }))
    } else {
      const est = kit.estimateId ? await reads.estimate(kit.estimateId) : null
      const email = await io.call('send-estimate-to-customer', { estimate_id: kit.estimateId, customer_email: kit.email, public_origin: PUBLIC_ORIGIN }, asTester)
      const acceptUrl = typeof email.body?.accept_url === 'string' ? email.body.accept_url : null
      if (acceptUrl) io.secrets.push(acceptUrl)
      if (email.status === 200 && email.body?.ok === true) {
        step(stepWent('estimateEmail', { sentAt: iso(io.now()), where: `to the kit’s address${email.body.emailed === false ? ' (the function says it was not emailed)' : ''}, link ${acceptUrl ? tail4(acceptUrl) : 'none'}` }))
      } else {
        step(stepHeld('estimateEmail', String(email.body?.error ?? `send-estimate-to-customer answered ${email.status}`)))
      }
      if (acceptUrl && kit.phoneChannelId && !held.has('estimateEmail')) {
        const words = estimateTextWords({ job: est?.title ?? 'your estimate', amount: '$1.00', link: acceptUrl })
        const text = await io.call('quo-send', { contactId: kit.contactId, channelId: kit.phoneChannelId, body: words.text }, asTester)
        estimateTextId = typeof text.body?.messageId === 'string' ? text.body.messageId : null
        report.quo.push({ step: 'estimateText', status: text.status, quoId: typeof text.body?.quoId === 'string' ? text.body.quoId : null })
        step(text.status === 200 && text.body?.ok === true ? stepWent('estimateText', { sentAt: iso(io.now()), where: `line ${estimateTextId ?? '?'} from box ${String(text.body.mailbox ?? '?')}` }) : stepHeld('estimateText', String(text.body?.words ?? `quo-send answered ${text.status}`)))
      } else {
        step(stepSkipped('estimateText', held.has('estimateEmail') ? 'the estimate email held' : 'no link or no phone channel'))
      }
    }

    // 6. The open: the email in bids@, its link opened, the 👀 line.
    if (!held.has('estimateEmail')) {
      const arrived = await wait(async () => {
        const res = await walk('open')
        return res.status === 200 && res.body?.arrived === true ? res.body : null
      }, MAIL_WAIT_MS)
      if (!arrived.found) {
        step(stepHeld('open', 'the estimate email never arrived in the bids inbox', { waitedFor: waitedWords(arrived.waitedMs), saw: 'bids@ had no email from the app’s sender for this estimate' }))
      } else {
        const eye = await wait(async () => (kit ? openedLine(await reads.thread(kit.contactId), kit.estimateId ?? '') : null), MAIL_WAIT_MS)
        const open = arrived.found.open as { status?: number; ok?: boolean } | null
        const where = `email arrived ${String(arrived.found.arrivedAt ?? '?')}, link ${String(arrived.found.linkTail ?? 'none')}, open ${open ? `${open.status}` : 'not tried'}`
        step(eye.found ? stepWent('open', { sentAt: String(arrived.found.arrivedAt ?? sendsAt), landedAt: eye.found.at, where: `${where}; 👀 line ${eye.found.id}`, waitedFor: waitedWords(arrived.waitedMs + eye.waitedMs) }) : stepHeld('open', 'no 👀 line on the thread', { waitedFor: waitedWords(arrived.waitedMs + eye.waitedMs), saw: where }))
      }
    } else step(stepSkipped('open', 'the estimate email held'))

    // 7. The email reply from bids@.
    if (!held.has('open') && !held.has('estimateEmail')) {
      const sentAt = iso(io.now())
      const reply = await walk('reply-email', { words: REPLY_WORDS })
      if (reply.status !== 200) step(stepHeld('replyEmail', String(reply.body?.words ?? `walk reply-email answered ${reply.status}`)))
      else {
        const landed = await wait(async () => (kit ? inboundLine(await reads.thread(kit.contactId), 'email', 'team', sentAt) : null), MAIL_WAIT_MS)
        step(landed.found ? stepWent('replyEmail', { sentAt, landedAt: landed.found.at, where: `email in, box ${landed.found.mailbox ?? '?'}, line ${landed.found.id}`, waitedFor: waitedWords(landed.waitedMs) }) : stepHeld('replyEmail', 'the reply never landed on the thread', { sentAt, waitedFor: waitedWords(landed.waitedMs), saw: 'no email line in on the kit’s thread, box team' }))
      }
    } else step(stepSkipped('replyEmail', 'the open held'))

    // 8. The text reply from the bids number, and the estimate text's ✓.
    if (flags.fallbackPhone) {
      say(`Text "${TEXT_WORDS}" now from your own phone to the company number.`)
    }
    const textSentAt = iso(io.now())
    const textReply = flags.fallbackPhone ? { status: 200, body: { ok: true } as Record<string, unknown> } : await walk('text', { words: TEXT_WORDS })
    if (!flags.fallbackPhone) report.quo.push({ step: 'replyText', status: textReply.status, quoId: typeof textReply.body?.quoId === 'string' ? textReply.body.quoId : null })
    if (textReply.status !== 200) step(stepHeld('replyText', String(textReply.body?.words ?? `walk text answered ${textReply.status}`)))
    else {
      const landed = await wait(async () => {
        if (!kit) return null
        const lines = await reads.thread(kit.contactId)
        const line = inboundLine(lines, 'text', null, textSentAt)
        if (!line) return null
        return { line, delivered: deliveredText(lines, estimateTextId) }
      }, flags.fallbackPhone ? OWNER_WAIT_MS : TEXT_WAIT_MS)
      if (!landed.found) step(stepHeld('replyText', 'the text never landed on the thread', { sentAt: textSentAt, waitedFor: waitedWords(landed.waitedMs), saw: 'no text line in on the kit’s thread' }))
      else {
        const delivered = landed.found.delivered ? 'the estimate text reads ✓ delivered' : estimateTextId ? 'the estimate text has no ✓ yet' : 'no estimate text to mark'
        step(stepWent('replyText', { sentAt: textSentAt, landedAt: landed.found.line.at, where: `text in, box ${landed.found.line.mailbox ?? '?'}, line ${landed.found.line.id}; ${delivered}`, waitedFor: waitedWords(landed.waitedMs) }))
      }
    }

    // 9. STOP, then START.
    const stopAndStart = async (word: 'STOP' | 'START', key: 'stop' | 'start') => {
      if (flags.fallbackPhone) say(`Text "${word}" now from your own phone to the company number.`)
      const sentAt = iso(io.now())
      const res = flags.fallbackPhone ? { status: 200, body: { ok: true } as Record<string, unknown> } : await walk('text', { words: word })
      if (!flags.fallbackPhone) report.quo.push({ step: key, status: res.status, quoId: typeof res.body?.quoId === 'string' ? res.body.quoId : null })
      if (res.status !== 200) return step(stepHeld(key, String(res.body?.words ?? `walk text answered ${res.status}`)))
      const want = word === 'STOP'
      const mark = await wait(async () => {
        const ch = kit?.phoneChannelId ? await reads.channel(kit.phoneChannelId) : null
        if (!ch) return null
        return stoppedForTeam(ch) === want ? ch : null
      }, flags.fallbackPhone ? OWNER_WAIT_MS : STOP_WAIT_MS)
      step(mark.found ? stepWent(key, { sentAt, landedAt: iso(io.now()), where: want ? 'the team box’s stop is set on the kit’s number' : 'the stop is cleared', waitedFor: waitedWords(mark.waitedMs) }) : stepHeld(key, want ? 'the stop was never set' : 'the stop never cleared', { sentAt, waitedFor: waitedWords(mark.waitedMs) }))
    }
    if (!held.has('replyText')) {
      await stopAndStart('STOP', 'stop')
      await stopAndStart('START', 'start')
    } else {
      step(stepSkipped('stop', 'the text reply held'))
      step(stepSkipped('start', 'the text reply held'))
    }

    // 10. Optional: the tester answers from the thread by email.
    if (flags.answer && !flags.ownerPresses && kit.emailChannelId) {
      const sentAt = iso(io.now())
      const res = await io.call('messages-email', { contactId: kit.contactId, channelId: kit.emailChannelId, subject: 'Re: your estimate', body: ANSWER_WORDS }, asTester)
      if (res.status !== 200) step(stepHeld('answer', String(res.body?.words ?? `messages-email answered ${res.status}`)))
      else {
        await io.sleep(Math.min(MAIL_WAIT_MS, 90_000))
        const lines = kit ? await reads.thread(kit.contactId) : []
        const n = outboundCount(lines, 'email', sentAt)
        step(n === 1 ? stepWent('answer', { sentAt, where: 'one email out, no second line', waitedFor: waitedWords(io.now() - Date.parse(sentAt)) }) : stepHeld('answer', `${n} email lines out since the answer, not one`, { sentAt }))
      }
    } else step(stepSkipped('answer', flags.answer ? 'the owner presses, so the tester does not answer' : 'not asked (--answer)'))

    // 11. The office's view, through the screens' own kernels.
    try {
      const now = new Date(io.now())
      const todayYmd = todayYmdInAppTz(now)
      const rows = await reads.loadQueue(todayYmd)
      const input = followUpInputFromRows(rows, todayYmd, {})
      const queue = followUpQueue(input, { newLane: followUpNewLane(input, rows.jobStates ?? {}, now.toISOString()) })
      const nameOf = (contactId: string) => input.contacts.find((c) => c.id === contactId)?.name ?? contactId
      const inReply = queue.needsReply.find((r) => r.contactId === kit?.contactId)
      const inNew = queue.newLane.find((r) => r.contactId === kit?.contactId)
      const holder = input.contacts.find((c) => c.id === kit?.contactId)?.has
      const kitIn = inNew ? `in New (${inNew.head})` : inReply ? `in Needs a reply${holder ? `, ${holder} has it` : ', nobody has it'}` : 'in no lane'
      const waits = waitingOnThem(await reads.loadWaiting(now), 'all', now)
      const went = wentOutRows(await reads.loadWentOut(now), 'all')
      const strip = await reads.loadStrip(now)
      const withKit = stripTiles({ lines: strip.lines, estimates: strip.estimates, waits: [], now, pill: 'all' })
      const without = stripTiles({
        lines: strip.lines.filter((l) => l.contactId !== kit?.contactId),
        estimates: strip.estimates.filter((e) => e.id !== kit?.estimateId),
        waits: [],
        now,
        pill: 'all',
      })
      report.lanes = {
        needsReply: queue.needsReply.map((r) => nameOf(r.contactId)),
        newLane: queue.newLane.map((r) => r.who),
        waitingOnThem: waits.map((w) => `${w.name} (${w.chip})`),
        wentOut: went.map((w) => `${w.name}: ${w.channel} ${w.when}${w.mark ? ` ${w.mark.words}` : ''}${w.chip ? ` · ${w.chip}` : ''}`),
        kitIn,
      }
      report.strip = stripDifference(withKit, without)
      step(stepWent('office', { where: `ZZ Walk ${kitIn}` }))
    } catch (e) {
      step(stepHeld('office', e instanceof Error ? e.message : String(e)))
    }

    // 12. The stray check.
    try {
      const boxes = await reads.boxes()
      const made = await reads.strays(startedAt)
      if (made === null) {
        report.strayNote = 'the contacts could not be read as the tester (RLS); run § 5’s query through the Supabase connector'
        step(stepWent('stray', { where: report.strayNote }))
      } else {
        report.strays = strayRows(made, ownKeys(boxes, kit, APP_FROM_ADDRESS), kit.contactId, startedAt)
        step(report.strays.length === 0 ? stepWent('stray', { where: 'no stray contact' }) : stepHeld('stray', `${report.strays.length} stray contact(s) carry an own address or number`))
      }
    } catch (e) {
      step(stepHeld('stray', e instanceof Error ? e.message : String(e)))
    }
  } finally {
    // 13. Cleanup, always, unless --keep.
    if (flags.keep) {
      report.steps.push(stepSkipped('cleanup', 'kept (--keep)'))
      say('– Clean up — kept (--keep)')
    } else {
      const res = await walk('cleanup')
      report.cleanup = res.body
      step(res.status === 200 ? stepWent('cleanup', { where: res.body?.nothing === true ? 'nothing to clean' : 'the kit’s rows deleted' }) : stepHeld('cleanup', String(res.body?.words ?? `walk cleanup answered ${res.status}`)))
    }
    report = finishReport(report, iso(io.now()))
    say('')
    for (const l of reportLines(report)) say(l)
    const path = io.writeReport(report)
    if (path) say(`Report written to ${path}`)
  }
  return report
}

// ---------------------------------------------------------------------------------------------------------------------
// The real io
// ---------------------------------------------------------------------------------------------------------------------

/** The main checkout's root: a worktree resolves there through its common git dir, as claim-version.ts does. */
export function mainCheckoutRoot(): string {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()
  return dirname(isAbsolute(common) ? common : resolve(process.cwd(), common))
}

export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) throw new Error(`${path} not found`)
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
  return out
}

export function realIo(env: Record<string, string>, root: string): WalkIo {
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  const secret = env.VITE_DEV_LOGIN_SECRET
  if (!url || !anon || !secret) throw new Error('.env.local needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEV_LOGIN_SECRET')
  const secrets = [anon, secret]
  const headers = (auth: Auth): Record<string, string> => ({
    'Content-Type': 'application/json',
    apikey: anon,
    Authorization: `Bearer ${auth === 'anon' || auth === 'secret' ? anon : auth.jwt}`,
    ...(auth === 'secret' ? { 'X-Dev-Login-Secret': secret } : {}),
  })
  const call: WalkIo['call'] = async (name, body, auth) => {
    const res = await fetch(`${url}/functions/v1/${name}`, { method: 'POST', headers: headers(auth), body: JSON.stringify(body) })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return { status: res.status, body: json }
  }
  const signIn: WalkIo['signIn'] = async (email) => {
    const login = await call('dev-login', { email, redirectTo: 'http://localhost:5173/' }, 'secret')
    const link = typeof login.body?.action_link === 'string' ? login.body.action_link : null
    const tokenHash = link ? new URL(link).searchParams.get('token') : null
    if (login.status !== 200 || !tokenHash) throw new Error(`dev-login refused (${login.status}): ${String(login.body?.error ?? 'no link')}`)
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await client.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (error || !data.session) throw new Error(`verifyOtp: ${error?.message ?? 'no session'}`)
    return { jwt: data.session.access_token, reads: realReads(client) }
  }
  const dir = join(root, 'tmp', 'walk')
  return {
    call,
    signIn,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
    log: (line) => console.log(line),
    writeReport: (report) => {
      mkdirSync(dir, { recursive: true })
      const path = join(dir, `${report.startedAt.replace(/[:.]/g, '-')}.json`)
      writeFileSync(path, secretsOut(JSON.stringify(report, null, 2), secrets))
      return path
    },
    secrets,
  }
}

/** The reads on a signed-in client: the kit's rows by id, and the office's own loaders. */
export function realReads(client: SupabaseClient): WalkReads {
  const db = client as unknown as SupabaseClient
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`)
  }
  return {
    async thread(contactId) {
      const { data, error } = await db.from('messages').select(MESSAGE_ROW_COLUMNS).eq('contact_id', contactId).order('at', { ascending: true })
      fail('messages', error)
      return (data ?? []) as unknown as ThreadLine[]
    },
    async channel(id) {
      const { data, error } = await db.from('contact_channels').select('id, contact_id, kind, opted_out_at, opted_out_by_box').eq('id', id).maybeSingle()
      fail('contact_channels', error)
      return (data as WalkChannel | null) ?? null
    },
    async estimate(id) {
      const { data, error } = await db.from('estimates').select('status, sent_at, title, estimate_number').eq('id', id).maybeSingle()
      fail('estimates', error)
      return (data as { status: string | null; sent_at: string | null; title: string | null; estimate_number: number | null } | null) ?? null
    },
    async boxes() {
      const { data } = await db.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
      return parseBoxSettings((data as { value_text: string | null } | null)?.value_text)
    },
    async strays(sinceIso) {
      const { data, error } = await db.from('contacts').select('id, kind, created_at, channels:contact_channels(kind, key)').gte('created_at', sinceIso)
      if (error) return null
      return (data ?? []) as unknown as StrayContact[]
    },
    loadQueue: (todayYmd) => supabaseFollowUpIo(db).loadQueue(todayYmd),
    loadWaiting: (now) => loadWaitingOnThem(now, db),
    loadWentOut: (now) => loadWentOut(now, db),
    loadStrip: (now) => loadWeekStrip(now, db),
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const { flags, unknown } = parseWalkFlags(argv)
  if (unknown.length) {
    console.error(`Unknown: ${unknown.join(' ')}. The flags are ${WALK_FLAGS.map((f) => f.flag).join(', ')}.`)
    return 2
  }
  const root = mainCheckoutRoot()
  const env = readEnvFile(resolve(root, '.env.local'))
  const io = realIo(env, root)
  const report = await runWalk(flags, io)
  return report.ok ? 0 : 1
}

const entry = process.argv[1] ?? ''
if (/scripts[\\/]walk[\\/]run\.ts$/.test(entry)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof Error ? e.message : String(e))
      process.exit(1)
    },
  )
}
