/**
 * One push to a person's phone, through their **Push me** hours (punch list #141 PR 5, v2.6217). `messages-notify`
 * held a reply's push for whoever is off since PR 3 (`_shared/messagesReplyPush.ts` over the planner); every other
 * sender pushed through its own loop and read no hours. This is the one door the thirteen go through now: it reads
 * every row of `user_push_hours` (`loadPushHours`, fail-soft), splits one push's people at `now` with `pushDecision`
 * (the mirrored `messages/pushHours.ts`), sends to the people on through the sender the caller hands in, and writes a
 * `notification_history` row with `channel = 'held'` and no push for each person off: the row the push would have
 * written, so the Dashboard's **While you were off** line (`whatWaited.ts`, `heldKind`) can name what waited by its
 * `template_type`. A person with no row is pushed; nobody is ever pushed later (the card's decision 5).
 *
 * The caller keeps its own record of what went: by default the helper writes one `channel = 'push'` row per person at
 * least one device took (`record: 'sent'`); a sender whose row says more than push, the email that went beside it or
 * instead of it, passes `record: 'none'` and writes its own from the result. The Settings test push never comes here:
 * the person pressed it to see a push.
 *
 * Pure kernel first (`splitPush`, `heldRows`, `sentRows`), tested from `src/lib/messages/pushHoursSend.test.ts`; the
 * sender is `_shared/webPushSend.ts`, which this file does not import, so the test needs no `web-push`.
 */
// deno-lint-ignore-file no-explicit-any
import { parsePushHours, pushDecision, type PushHoursByUser } from './gcKernels/lib/messages/pushHours.ts'

/** One push as a sender names it: who, the words, where the tap lands, the template its history rows carry. */
export interface HoursPush {
  userIds: readonly string[]
  title: string
  body: string
  url: string
  tag: string
  /** `notification_history.template_type` on every row this push writes, sent or held. */
  templateType: string
  /** Columns beside the five on every row (a checklist's `checklist_instance_id`, a work order's `step_id`). */
  extra?: Record<string, unknown>
  /** The payload one person's devices get, when it differs by person (Ready to Bill's dollars for the detailed roles). */
  payloadFor?: (userId: string) => string
}

/** Sends one payload to every device of one person; resolves to how many took it. `webPushSender` in `webPushSend.ts`. */
export type PushToPerson = (userId: string, payload: string) => Promise<number>

/** A person held for their hours: off until `backAt` (ISO), or `null` when the hours never open again this week's read. */
export interface HeldPerson {
  userId: string
  backAt: string | null
}

/** A `notification_history` row as the senders write one. */
export interface HistoryRow extends Record<string, unknown> {
  recipient_user_id: string
  template_type: string
  title: string
  body_preview: string
  channel: 'push' | 'held'
}

export interface HoursSendResult {
  /** The people on whose devices took the push, at least one each. */
  sent: string[]
  /** The people on with no device that took it: the caller's email fallback, where it has one, is theirs. */
  noDevice: string[]
  /** The people held, each with when they are back. A row each is written, no push. */
  held: HeldPerson[]
  /** Pushes delivered, one a device. */
  devices: number
}

/** The payload a push's devices get: the four fields the service worker reads. */
export function pushPayload(push: Pick<HoursPush, 'title' | 'body' | 'url' | 'tag'>): string {
  return JSON.stringify({ title: push.title, body: push.body, url: push.url, tag: push.tag })
}

/** The people split at `now`: those pushed now, those held with when they are back. Pure; `pushDecision` over the rows. */
export function splitPush(push: Pick<HoursPush, 'userIds'>, hours: PushHoursByUser, now: string): { send: string[]; held: HeldPerson[] } {
  return pushDecision(push, hours, now)
}

const rowOf = (push: HoursPush, userId: string, channel: HistoryRow['channel']): HistoryRow => ({
  ...(push.extra ?? {}),
  recipient_user_id: userId,
  template_type: push.templateType,
  title: push.title,
  body_preview: push.body.slice(0, 200),
  channel,
})

/** The rows the held people get: the push as it would have gone, `channel = 'held'`, so the Dashboard can list it. */
export function heldRows(push: HoursPush, held: readonly HeldPerson[]): HistoryRow[] {
  return held.map((h) => rowOf(push, h.userId, 'held'))
}

/** The rows the people reached get, one each, `channel = 'push'`. */
export function sentRows(push: HoursPush, reached: readonly string[]): HistoryRow[] {
  return reached.map((id) => rowOf(push, id, 'push'))
}

/**
 * Every person's push hours (`user_push_hours`, one row a person who set them), by user id; a row that does not read,
 * or none, is any time. Fail-soft: a read that fails (the table not there yet) holds nobody, and says so in the log.
 */
export async function loadPushHours(admin: any, log: (message: string) => void = console.error): Promise<PushHoursByUser> {
  const out = new Map<string, ReturnType<typeof parsePushHours>>()
  try {
    const { data, error } = await admin.from('user_push_hours').select('user_id, days, opens, closes')
    if (error) {
      log(`user_push_hours read error: ${error.message}`)
      return out
    }
    for (const r of (data ?? []) as any[]) if (typeof r.user_id === 'string') out.set(r.user_id, parsePushHours(r))
  } catch (e) {
    log(`user_push_hours read error: ${e instanceof Error ? e.message : String(e)}`)
  }
  return out
}

export interface HoursSendOptions {
  /** The instant the hours are read at; now when not given. */
  now?: string
  /** The hours, when the caller read them once for several pushes; else read here. */
  hours?: PushHoursByUser
  /** `'sent'` (the default) writes one `channel = 'push'` row per person reached; `'none'` leaves the sent record to the caller. Held rows are always written. */
  record?: 'sent' | 'none'
  /** Where a refused write or a failed read is said; `console.error` when not given. */
  log?: (message: string) => void
}

/**
 * One push through a person's hours: the people on are pushed through `sendTo`, the people off get a held row and no
 * push. A sender with no VAPID keys passes `null` for `sendTo`: nobody is pushed, the held rows still go, so the
 * Dashboard reads the same whether or not the keys are set.
 */
export async function sendPushHonouringHours(admin: any, push: HoursPush, sendTo: PushToPerson | null, opts: HoursSendOptions = {}): Promise<HoursSendResult> {
  const log = opts.log ?? console.error
  const now = opts.now ?? new Date().toISOString()
  const hours = opts.hours ?? (await loadPushHours(admin, log))
  const { send, held } = splitPush(push, hours, now)

  const sent: string[] = []
  const noDevice: string[] = []
  let devices = 0
  if (sendTo) {
    for (const userId of send) {
      const payload = push.payloadFor ? push.payloadFor(userId) : pushPayload(push)
      const took = await sendTo(userId, payload)
      if (took > 0) {
        sent.push(userId)
        devices += took
      } else noDevice.push(userId)
    }
  } else noDevice.push(...send)

  const rows: HistoryRow[] = [...(opts.record === 'none' ? [] : sentRows(push, sent)), ...heldRows(push, held)]
  if (rows.length > 0) {
    try {
      const { error } = await admin.from('notification_history').insert(rows)
      if (error) log(`notification_history write error (${push.templateType}): ${error.message}`)
    } catch (e) {
      log(`notification_history write error (${push.templateType}): ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { sent, noDevice, held, devices }
}
