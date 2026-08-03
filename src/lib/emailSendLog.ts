/** Pure display logic for Settings → Notifications → "Most recent emails sent". */

export type EmailSendLogDisplayRow = {
  id: string
  sentAt: string | null
  fromEmail: string | null
  toEmails: string[]
  subject: string | null
  lastEvent: string | null
}

export type EmailLogStatusChip = {
  label: string
  /** Theme-token-friendly hue bucket; the component maps this to colors. */
  tone: 'good' | 'bad' | 'neutral'
}

/**
 * Map a Resend event name (last_event without the "email." prefix, or as stored)
 * to a short user-facing chip. Unknown events display as-is, neutral.
 */
export function emailLogStatusChip(lastEvent: string | null | undefined): EmailLogStatusChip {
  const ev = (lastEvent ?? '').replace(/^email\./, '').trim().toLowerCase()
  switch (ev) {
    case 'delivered':
      return { label: 'Delivered', tone: 'good' }
    case 'opened':
      return { label: 'Opened', tone: 'good' }
    case 'clicked':
      return { label: 'Clicked', tone: 'good' }
    case 'sent':
      return { label: 'Sent', tone: 'neutral' }
    case 'scheduled':
      return { label: 'Scheduled', tone: 'neutral' }
    case 'queued':
      return { label: 'Queued', tone: 'neutral' }
    case 'delivery_delayed':
      return { label: 'Delayed', tone: 'bad' }
    case 'bounced':
      return { label: 'Bounced', tone: 'bad' }
    case 'complained':
      return { label: 'Complained', tone: 'bad' }
    case 'failed':
      return { label: 'Failed', tone: 'bad' }
    case 'canceled':
      return { label: 'Canceled', tone: 'bad' }
    case '':
      return { label: '—', tone: 'neutral' }
    default:
      return { label: ev, tone: 'neutral' }
  }
}

/** "a@x.com" · "a@x.com +2" for multi-recipient sends. */
export function formatEmailLogRecipients(toEmails: string[] | null | undefined): string {
  const list = (toEmails ?? []).map((t) => t.trim()).filter(Boolean)
  if (list.length === 0) return '—'
  const first = list[0] ?? '—'
  return list.length === 1 ? first : `${first} +${list.length - 1}`
}

type RawRow = {
  id: string
  sent_at: string | null
  from_email: string | null
  to_emails: string[] | null
  subject: string | null
  last_event: string | null
}

export function mapEmailSendLogRows(rows: RawRow[] | null | undefined): EmailSendLogDisplayRow[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    sentAt: r.sent_at,
    fromEmail: r.from_email,
    toEmails: r.to_emails ?? [],
    subject: r.subject,
    lastEvent: r.last_event,
  }))
}
