/**
 * Sent copies — the ratchet for email (docs/SENT_COPIES.md, step 2). The owner's rule: every
 * time we send someone something a copy is kept, and the email itself is kept. This test reads
 * every edge function (and shared helper) that hands a message to Resend and holds each one to
 * one of three answers:
 *
 *   1. it files the email (`fileSentEmailBestEffort`, or `file: { kind: … }` on `sendEmailViaResend`), or
 *   2. it is on `EMAILS_OWED` — it writes to someone outside and does not file yet, or
 *   3. it is on `NOT_OUTSIDE`, with the reason.
 *
 * A new function that sends mail fails here until it has an answer. `EMAILS_OWED` only
 * shrinks: wire the function and remove its row.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUNCTIONS = join(__dirname, '..', '..', '..', 'supabase', 'functions')

/** Hands a message to Resend, directly or through the shared sender. */
const SENDS = /api\.resend\.com\/emails|sendEmailViaResend\(/
const FILES_A_COPY = /fileSentEmailBestEffort\(|file: \{ kind: '/

/** Writes to someone outside the company and keeps no copy yet. Remove a row when the function is wired. */
const EMAILS_OWED: ReadonlyArray<string> = [
  '_shared/testReportSend.ts',
  'gc-statement-email-dispatch',
  'legal-notify-dispatch',
  'remind-job-contracts',
  'send-bid-room-link',
  'send-contract-for-signature',
  'send-estimate-to-customer',
  'send-gc-statement-email',
  'send-hazmat-notice-email',
  'send-job-contract',
  'send-lien-filing-email',
  'send-lien-release-email',
  'send-report-email',
  'send-rfq-email',
  'send-submittal-reply-email',
  'send-supply-house-job-account',
  'send-test-report',
  'send-workflow-notification',
  'share-job-contract',
  'sign-bid-room',
  'sign-job-contract',
  'submit-legal-portal',
  'submit-portal-request',
]

/** Sends mail that is not a paper to someone outside, each with why. */
const NOT_OUTSIDE: Readonly<Record<string, string>> = {
  '_shared/resendSendEmail.ts': 'the shared sender itself: it files when its caller says what the email is',
  '_shared/jobWatchers.ts': 'a notice to our own people who watch a job',
  '_shared/recurringJobReportCore.ts': 'a recurring report to our own subscribers',
  '_shared/signedAgreementNotify.ts': 'a notice to our own staff that something was signed',
  'billed-report-email': 'a report to our own staff',
  'crew-day-email-dispatch': 'a digest to our own staff',
  'ct-roster-audit': 'an audit to our own staff',
  'gc-word-ask': 'a question to our own leader',
  'invite-user': 'an account invitation, not a paper',
  'money-waiting-email-dispatch': 'a digest to our own staff',
  'paid-job-email': 'a notice to our own staff',
  'payment-forecast-email-dispatch': 'a digest to our own staff',
  'schedule-share-dispatch': 'a schedule to our own staff',
  'send-lien-desk-summary': 'a summary to our own office',
  'send-scheduled-reminders': 'reminders to our own users',
  'send-sign-in-email': 'a sign-in link, not a paper',
  'statement-round-email-dispatch': 'a digest to our own staff',
  'sync-resend-emails': 'reads the email log from Resend; sends nothing',
  'test-email': 'a test message to ourselves',
  'weekly-money-email-dispatch': 'a report to our own staff',
  'weekly-movement-email-dispatch': 'a report to our own staff',
}

const sources: Array<{ key: string; text: string }> = []
for (const name of readdirSync(FUNCTIONS)) {
  if (name === '_shared') continue
  const index = join(FUNCTIONS, name, 'index.ts')
  if (existsSync(index)) sources.push({ key: name, text: readFileSync(index, 'utf8') })
}
for (const name of readdirSync(join(FUNCTIONS, '_shared'))) {
  if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) sources.push({ key: `_shared/${name}`, text: readFileSync(join(FUNCTIONS, '_shared', name), 'utf8') })
}
const sending = sources.filter((f) => SENDS.test(f.text))

describe('every email has an answer', () => {
  it('a function that sends mail files it, is owed, or does not write outside', () => {
    const unanswered = sending.filter((f) => !FILES_A_COPY.test(f.text) && !EMAILS_OWED.includes(f.key) && !(f.key in NOT_OUTSIDE)).map((f) => f.key)
    expect(unanswered, 'These functions send mail and keep no copy. File it (fileSentEmailBestEffort, or file: on sendEmailViaResend), or add the function to NOT_OUTSIDE with its reason.').toEqual([])
  })

  it('the owed list only names functions that still send without filing', () => {
    const byKey = new Map(sending.map((f) => [f.key, f]))
    const stale = EMAILS_OWED.filter((key) => !byKey.has(key) || FILES_A_COPY.test(byKey.get(key)!.text))
    expect(stale, 'These functions file their email now, or no longer send. Remove their rows from EMAILS_OWED.').toEqual([])
  })

  it('no function is on both lists, and every reason is written', () => {
    expect(EMAILS_OWED.filter((key) => key in NOT_OUTSIDE)).toEqual([])
    expect(Object.entries(NOT_OUTSIDE).filter(([, why]) => why.trim().length < 8)).toEqual([])
    const known = new Set(sending.map((f) => f.key))
    expect(Object.keys(NOT_OUTSIDE).filter((key) => !known.has(key)), 'These functions no longer send. Remove their rows from NOT_OUTSIDE.').toEqual([])
  })
})
