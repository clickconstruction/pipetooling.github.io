/**
 * A mail conversation onto an HR file (punch list #289): what the dev seat's mail tag writes when its target is a person,
 * mail by mail. The unit is the Gmail conversation, as the job tag's is (`tagPlan.ts`), but the landing is a dated
 * entry on `person_file_entries` and not a line in Messages: one entry per mail, on the day the mail was sent in the
 * app's calendar, its content a fixed shape — From, To, Cc, Subject, Sent, the files by name and size, then the body as
 * plain text — so the Timeline reads it the way it reads any conversation entry. A mail the file already holds by its
 * Gmail id is left (`already`); a draft, Spam, Trash, a chat or a mail under a label the box's person leaves out is
 * skipped as the job tag skips it. Nothing is tied: entries are append-only and belong to the file alone. Pure; the
 * function (`gmail-mine`) reads the thread and the file and executes the plan, and its follow runs the same plan on
 * later mail.
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { EmailAddress, EmailIn } from '../emailIn/gmailMessage'
import { MY_MAIL_NO_SUBJECT, type MyMailPersonTagCounts } from './contract'
import { MY_MAIL_NEVER_LABELS, type MyMailTagSkip, type MyMailThread } from './tagPlan'

/** What an entry made from a mail says in `person_file_entries.source`: a conversation, as the Timeline lanes it. */
export const MY_MAIL_ENTRY_SOURCE = 'conversation'

/** The most of a mail's words one entry keeps; the rest stays in Gmail and the entry says so. */
export const MY_MAIL_ENTRY_BODY_MAX = 30_000

/** What the file already knows, read by the function before the plan. */
export interface MyMailPersonKnown {
  /** The entries the file holds for the conversation's mails, by Gmail id, to the entry's id. */
  byGmailId: Readonly<Record<string, string>>
  /** Gmail's ids of the labels the box's person leaves out (`users.my_mail_hidden_labels`, by name): a mail under one is never written. */
  hidden?: readonly string[]
}

/** One mail's part of the plan. */
export type MyMailPersonTagStep =
  | {
      /** No entry holds this mail: write one. */
      kind: 'entry'
      gmailId: string
      threadId: string
      /** The day the entry lands on: the mail's day in the app's calendar, or the day of the plan when Gmail gave no time. */
      entryDate: string
      content: string
      /** How many files the entry names. */
      files: number
      at: string | null
    }
  | { kind: 'already'; gmailId: string; entryId: string }
  | { kind: 'skip'; gmailId: string; why: MyMailTagSkip }

/** The whole plan for one person tag. */
export interface MyMailPersonTagPlan {
  threadId: string
  steps: MyMailPersonTagStep[]
  counts: MyMailPersonTagCounts
}

const display = (a: EmailAddress): string => (a.name?.trim() ? `${a.name.trim()} <${a.address}>` : a.address)

const list = (addresses: readonly EmailAddress[]): string => addresses.map(display).join('; ')

/** A file's size as the entry names it: whole kilobytes, at least 1. */
export function fileSizeWords(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 KB'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

/** The mail's time as the entry names it: the app's calendar, to the minute. '' when Gmail gave none. */
export function mailSentWords(at: string | null): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')} ${g('dayPeriod')} Central`.replace(/\s+/g, ' ').trim()
}

/** The day an entry made from a mail lands on: the mail's day in the app's calendar, else `fallbackYmd` (the day of the plan). */
export function mailEntryDate(at: string | null, fallbackYmd: string): string {
  return (at ? calendarYmdInAppTzFromIso(at) : '') || fallbackYmd
}

/**
 * The entry's content, a fixed shape: From, To, Cc (when any), Subject, Sent, Files (when any, by name and size, a
 * picture placed in the body left out), a blank line, then the body as plain text, cut at `MY_MAIL_ENTRY_BODY_MAX` with a
 * line saying how much stays in Gmail.
 */
export function mailEntryContent(email: EmailIn): string {
  const lines: string[] = []
  lines.push(`From: ${email.from ? display(email.from) : '(unknown)'}`)
  lines.push(`To: ${email.to.length > 0 ? list(email.to) : '(none)'}`)
  if (email.cc.length > 0) lines.push(`Cc: ${list(email.cc)}`)
  lines.push(`Subject: ${email.subject.trim() || MY_MAIL_NO_SUBJECT}`)
  const sent = mailSentWords(email.at)
  if (sent) lines.push(`Sent: ${sent}`)
  const files = email.files.filter((f) => !f.inline)
  if (files.length > 0) lines.push(`Files: ${files.map((f) => `${f.name} (${fileSizeWords(f.size)})`).join(', ')}`)
  const body = email.text.replace(/\r\n/g, '\n').trim()
  const kept = body.length > MY_MAIL_ENTRY_BODY_MAX ? `${body.slice(0, MY_MAIL_ENTRY_BODY_MAX).trimEnd()}\n\n[${body.length - MY_MAIL_ENTRY_BODY_MAX} more characters stay in Gmail]` : body
  return `${lines.join('\n')}\n\n${kept || '(no words)'}`
}

/** Why a mail is never written, by its labels, or null. */
function neverWritten(email: Pick<EmailIn, 'labels'>): MyMailTagSkip | null {
  const labels = new Set(email.labels)
  for (const [label, why] of Object.entries(MY_MAIL_NEVER_LABELS)) if (labels.has(label)) return why
  return null
}

/**
 * The plan for tagging one conversation onto a person's file over what the file already holds (`known`). The mails
 * keep the conversation's order; one Gmail id is planned once. `todayYmd` is the day a mail with no time lands on.
 */
export function planPersonTag(thread: MyMailThread, known: MyMailPersonKnown, todayYmd: string): MyMailPersonTagPlan {
  const hidden = new Set(known.hidden ?? [])
  const seen = new Set<string>()
  const steps: MyMailPersonTagStep[] = []
  for (const email of thread.messages) {
    const never = neverWritten(email)
    if (never) {
      steps.push({ kind: 'skip', gmailId: email.gmailId, why: never })
      continue
    }
    if (email.labels.some((l) => hidden.has(l))) {
      steps.push({ kind: 'skip', gmailId: email.gmailId, why: 'hidden' })
      continue
    }
    if (seen.has(email.gmailId)) {
      steps.push({ kind: 'skip', gmailId: email.gmailId, why: 'twice' })
      continue
    }
    seen.add(email.gmailId)
    const entryId = known.byGmailId[email.gmailId]
    if (entryId) {
      steps.push({ kind: 'already', gmailId: email.gmailId, entryId })
      continue
    }
    steps.push({
      kind: 'entry',
      gmailId: email.gmailId,
      threadId: email.threadId ?? thread.threadId,
      entryDate: mailEntryDate(email.at, todayYmd),
      content: mailEntryContent(email),
      files: email.files.filter((f) => !f.inline).length,
      at: email.at,
    })
  }
  return {
    threadId: thread.threadId,
    steps,
    counts: {
      entries: steps.filter((s) => s.kind === 'entry').length,
      already: steps.filter((s) => s.kind === 'already').length,
      skipped: steps.filter((s) => s.kind === 'skip').length,
    },
  }
}

/** The `person_file_entries` row one entry step writes, as the dev who tagged (`createdBy`, `authorLabel`). */
export function personEntryRow(step: Extract<MyMailPersonTagStep, { kind: 'entry' }>, who: { personId: string; createdBy: string | null; authorLabel: string }): Record<string, unknown> {
  return {
    person_id: who.personId,
    entry_date: step.entryDate,
    content: step.content,
    source: MY_MAIL_ENTRY_SOURCE,
    created_by: who.createdBy,
    author_label: who.authorLabel,
    gmail_message_id: step.gmailId,
    gmail_thread_id: step.threadId,
  }
}
