/**
 * The Monday email (punch list #255, v2.6607; the train's PR 7, second half): Your week, mailed on Monday at 6 AM
 * Central to each person the office picked a signal for, saying last week once more for anyone who missed the sheet.
 * The same card the home draws (`weekSignal.ts`), read for the previous complete pay week. The switch, the tick and
 * the last run follow the Bridge's weekly send (`lib/bridge/weeklySend.ts`); the keys are this email's own.
 *
 * Pure: who hears it, the subject, the text and the html. Runs on the edge from the copy of the kernels.
 */
import { wordsInWeek, parseMyCustomerWords, customerFirstName, dayWord } from '../ratings/ratingCredit'
import type { PayWeek } from '../payWeekAnchor'
import { parseMyWeek, yourWeekCard, type YourWeekCard } from './weekSignal'

export const YOUR_WEEK_EMAIL_ON_KEY = 'your_week_email_on_v1'
export const YOUR_WEEK_EMAIL_LAST_RUN_KEY = 'your_week_email_last_run_v1'
export const YOUR_WEEK_EMAIL_TYPE = 'your_week_email'

export interface WeekEmailRecipientRow {
  id: string
  name: string | null
  email: string | null
  week_signal: string | null
  archived_at: string | null
  is_sample?: boolean | null
  is_digital_twin?: boolean | null
  is_walk_tester?: boolean | null
}

/** Everyone with a signal picked, a real account that is not archived, and an address; each once. */
export function weekEmailRecipients(rows: ReadonlyArray<WeekEmailRecipientRow>): Array<{ id: string; email: string; name: string }> {
  const out: Array<{ id: string; email: string; name: string }> = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.week_signal || r.archived_at || r.is_sample || r.is_digital_twin || r.is_walk_tester) continue
    const email = (r.email ?? '').trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push({ id: r.id, email, name: (r.name ?? '').trim() })
  }
  return out
}

export type WeekEmail = { subject: string; text: string; html: string }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * One person's email for a week: the card as the home draws it, read as of the week's last day, and the customer's
 * words of that week. Null when the person has no signal or the signal has nothing to read yet.
 */
export function weekEmailFor(raw: unknown, week: PayWeek, dashboardUrl: string, now: Date = new Date()): WeekEmail | null {
  const my = parseMyWeek(raw)
  if (!my) return null
  const card = yourWeekCard(my, week.end)
  if (!card) return null
  const words = wordsInWeek(parseMyCustomerWords((raw as { words?: unknown }).words), week).find((w) => w.words) ?? null
  const first = my.name.trim().split(/\s+/)[0] || 'there'
  return buildWeekEmail(card, first, words ? { stars: words.score, words: words.words, who: `${customerFirstName(words.customerName)}${words.customerName.trim().split(/\s+/)[1] ? ` ${words.customerName.trim().split(/\s+/)[1]![0]}.` : ''} · ${words.jobName.trim().toLowerCase() || `job ${words.jobNumber}`} · ${dayWord(words.answeredAt, now)}` } : null, dashboardUrl)
}

export function buildWeekEmail(card: YourWeekCard, firstName: string, quote: { stars: number; words: string; who: string } | null, dashboardUrl: string): WeekEmail {
  const subject = `Your week, ${card.range}: ${card.head}`
  const lines = [
    `${firstName}, here is your week, ${card.range}.`,
    '',
    card.kicker,
    card.head,
    card.sub,
    card.move.text,
    card.mark,
    card.note,
  ].filter((l, i) => i < 2 || l)
  if (quote) lines.push('', `${'★'.repeat(quote.stars)} “${quote.words}”`, quote.who)
  lines.push('', `Your home shows the same card every day: ${dashboardUrl}`, '', 'Compared to yourself, never to anyone else.')
  const text = lines.join('\n')
  const pill = card.move.text ? `<p style="margin:0 0 8px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;font-weight:700;font-size:14px;background:${card.move.tone === 'up' ? '#dcfce7' : '#f3f4f6'};color:${card.move.tone === 'up' ? '#166534' : '#4b5563'}">${esc(card.move.text)}</span></p>` : ''
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:16px;color:#111827">
<p style="margin:0 0 12px">${esc(firstName)}, here is your week, ${esc(card.range)}.</p>
<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#374151">${esc(card.kicker)}</p>
<p style="margin:0 0 6px;font-size:30px;font-weight:800;letter-spacing:-0.02em">${esc(card.head)}</p>
${card.sub ? `<p style="margin:0 0 8px;font-size:13px;color:#6b7280">${esc(card.sub)}</p>` : ''}
${pill}
${card.mark ? `<p style="margin:0 0 6px;font-size:13px;color:#6b7280">${esc(card.mark)}</p>` : ''}
${card.note ? `<p style="margin:0 0 6px;font-size:13px;color:#6b7280">${esc(card.note)}</p>` : ''}
${quote ? `<div style="border-top:1px solid #e5e7eb;margin-top:12px;padding-top:10px"><p style="margin:0 0 4px;color:#f59e0b;letter-spacing:1px">${'★'.repeat(quote.stars)}</p><p style="margin:0 0 4px;font-size:15px">“${esc(quote.words)}”</p><p style="margin:0;font-size:13px;color:#6b7280">${esc(quote.who)}</p></div>` : ''}
<p style="margin:16px 0 0;font-size:13px;color:#6b7280">Your home shows the same card every day: <a href="${esc(dashboardUrl)}" style="color:#2563eb">${esc(dashboardUrl)}</a></p>
<p style="margin:8px 0 0;font-size:12px;color:#9ca3af">Compared to yourself, never to anyone else.</p>
</div>`
  return { subject, text, html }
}

export const WEEK_EMAIL_WORDS = {
  title: 'The Monday email',
  what: 'Every Monday at 6 AM Central, each person the office picked a signal for gets last week’s Your week card at their own address. Nobody else.',
  confirm: { title: 'Turn the Monday email on?', message: 'Every person with a week signal gets last week’s card at their own address, Monday at 6 AM Central.', confirmLabel: 'Turn it on' },
  onToast: 'The Monday email is on. Last week’s card goes out Monday at 6 AM Central.',
  offToast: 'The Monday email is off. Nothing goes out on Monday.',
  notSaved: 'The switch did not change. Only a dev can turn the Monday email on or off.',
  on: 'On. Goes out Monday at 6 AM Central.',
  off: 'Off. Nothing goes out.',
  preview: 'Preview mine',
  nothingToSay: 'No card for you yet: the office has not picked your signal, or it has nothing to read.',
}
