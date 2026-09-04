/**
 * Maps an email_send_log subject line to the stream card that produced it on
 * Settings → Email & notifications (v2.1754). The log stores only
 * when/to/subject/status, but every stream builds its subject from a stable
 * template (billedReportEmailSubject, paidJobEmailSubject, …), so a prefix
 * match identifies the stream. Subjects with no template here (estimate
 * sends, quote-accepted, invoice emails, …) return null — those rows have no
 * stream card to land on and stay plain in the log table.
 */

export type EmailStreamKey =
  | 'digest'
  | 'paid'
  | 'payment'
  | 'ready_to_bill'
  | 'billed'
  | 'schedule_day'
  | 'weekly_money'
  | 'weekly_movement'
  | 'gc_statement'
  | 'signed_agreements'

/** DOM id of a stream's card in SettingsEmailStreamsSection. */
export function emailStreamCardId(key: EmailStreamKey): string {
  return `email-stream-${key}`
}

// Order matters only for readability — the prefixes are mutually exclusive.
// Sources of truth for the templates (supabase/functions/…):
//   digest          recurringJobReportCore.ts  "Job activity summary — …"
//   billed          billed-report-email        "Billed awaiting payment — …"
//   paid/payment    paid-job-email             "Paid in full — …" / "Payment progress — …" / "Not paid — …"
//   ready_to_bill   paid-job-email             "Ready to bill — …" (v2.1836 stream)
//   schedule_day    schedule-day-email-dispatch "Dispatch schedule — …"
//   weekly_money    weekly-money-email-dispatch "Weekly money movement — …"
//   weekly_movement weekly-movement-email-dispatch "Weekly movement — …"
//   signed_agreements accept-estimate · sign-bid-room "Signed — …" (v2.2743)
//   gc_statement    gc-statement-email-dispatch "Click Plumbing open balances: …" (v2.2131; pre-v2.2131 "Open balances — …") / "Open balances (all …) — …"
const SUBJECT_PATTERNS: Array<[RegExp, EmailStreamKey]> = [
  [/^job activity summary — /i, 'digest'],
  [/^billed awaiting payment — /i, 'billed'],
  [/^paid in full — /i, 'paid'],
  [/^ready to bill — /i, 'ready_to_bill'],
  [/^payment progress — /i, 'payment'],
  [/^not paid — /i, 'payment'],
  [/^dispatch schedule — /i, 'schedule_day'],
  [/^weekly money movement — /i, 'weekly_money'],
  [/^weekly movement — /i, 'weekly_movement'],
  [/^open balances/i, 'gc_statement'],
  [/^click plumbing open balances/i, 'gc_statement'],
  [/^signed — /i, 'signed_agreements'],
]

/** "[TEST] " — "Email me a test" sends carry this prefix ahead of the template. */
const TEST_PREFIX = /^\[test\]\s*/i

export function emailLogStreamForSubject(subject: string | null | undefined): EmailStreamKey | null {
  const cleaned = (subject ?? '').trim().replace(TEST_PREFIX, '')
  if (!cleaned) return null
  for (const [pattern, key] of SUBJECT_PATTERNS) {
    if (pattern.test(cleaned)) return key
  }
  return null
}
