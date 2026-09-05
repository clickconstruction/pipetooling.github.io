/**
 * HTML/text renderer for the "Your statement round" email (v2.2812 redesign,
 * owner-approved mockup). The email is the account man's own account, not a
 * list: addressed by name, the standard stated once, one card per ready GC
 * with the pressure visible (aging chips, AP contact, last word), a
 * three-step ask ending in a note, a deadline, held GCs parked as "coming
 * back to you", and a scoreboard. Email-safe markup: inline styles, light
 * colors, no scripts.
 */
export type StatementRoundReadyGc = {
  gc_id: string
  gc_name: string
  amount: number
  job_count: number
  oldest_age_days: number | null
  over_90: number
  certified_by_name: string | null
  certified_at: string | null
  ap_email: string | null
  ap_phone: string | null
  last_statement_at: string | null
  last_word: { note: string; by: string; at: string; action: string; temperature: string | null } | null
  last_temperature: { temperature: string; by: string; at: string } | null
  expected_pay_by: string | null
}

export type StatementRoundPayload = {
  week_start: string
  deadline: string
  user_id: string
  ready: StatementRoundReadyGc[]
  held: { count: number; total: number; items: Array<{ gc_id: string; gc_name: string; amount: number; reason: string }> }
  assigned_to_me: number
  sent_by_me: number
  contacted_by_me: number
  book_total: number
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const usd = (n: number): string => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usdRound = (n: number): string => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`

const shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })
const shortDateTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' })
function fmtShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : shortDate.format(d)
}
function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : shortDateTime.format(d)
}
function ymdLabel(ymd: string | null, withWeekday = false): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...(withWeekday ? { weekday: 'long' } : {}), month: 'short', day: 'numeric' }).format(dt)
}
function daysAgo(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}

export function roundTotal(p: StatementRoundPayload): number {
  return p.ready.reduce((t, r) => t + Number(r.amount || 0), 0)
}

const firstName = (name: string | null): string => (name ?? '').trim().split(/\s+/)[0] || 'there'

export function statementRoundSubject(p: StatementRoundPayload, recipientName: string | null): string {
  const n = p.ready.length
  const who = firstName(recipientName)
  if (n === 0) return `${who}, nothing is waiting on you today`
  return `${who}, ${n} GC${n === 1 ? ' is' : 's are'} waiting to hear from you — ${usdRound(roundTotal(p))}`
}

const TEMP_LABEL: Record<string, string> = { hot: 'hot', warm: 'warm', cool: 'cool', cold: 'cold' }
const TEMP_COLOR: Record<string, { bg: string; fg: string }> = {
  hot: { bg: '#E1F5EE', fg: '#085041' },
  warm: { bg: '#FAEEDA', fg: '#633806' },
  cool: { bg: '#E6F1FB', fg: '#0C447C' },
  cold: { bg: '#FCEBEB', fg: '#791F1F' },
}

const STANDARD =
  "You're the account man on these GCs. They should never be surprised by what they owe us. Until you mark a statement sent, the company assumes that GC doesn't know — and that's yours to fix, not the office's."

function gcUrl(base: string, gcId: string): string {
  return `${base}&gc=${encodeURIComponent(gcId)}`
}

export function statementRoundText(p: StatementRoundPayload, dateLabel: string, roundUrl: string, recipientName: string | null, nowMs = Date.now()): string {
  const L: string[] = []
  const n = p.ready.length
  L.push(`${dateLabel} · your accounts`)
  L.push(n === 0 ? `${firstName(recipientName)}, nothing is waiting on you today` : `${firstName(recipientName)}, ${n} GC${n === 1 ? ' is' : 's are'} waiting to hear from you`)
  L.push(`${usd(roundTotal(p))} outstanding across your accounts · ${p.sent_by_me} of ${p.assigned_to_me} sent this week`)
  L.push('')
  L.push(`THE STANDARD: ${STANDARD}`)
  for (const r of p.ready) {
    L.push('')
    L.push(`${r.gc_name} — ${usd(r.amount)} · ${r.job_count} job${r.job_count === 1 ? '' : 's'}${r.certified_by_name ? ` · certified by ${r.certified_by_name}` : ''}`)
    const chips: string[] = []
    if (r.oldest_age_days != null) chips.push(`oldest bill ${r.oldest_age_days} days`)
    if (r.over_90 > 0) chips.push(`${usdRound(r.over_90)} over 90 days`)
    const ago = daysAgo(r.last_statement_at, nowMs)
    chips.push(r.last_statement_at ? `last statement: ${fmtShort(r.last_statement_at)} · ${ago} day${ago === 1 ? '' : 's'} ago` : 'no statement on record')
    L.push(`  ${chips.join(' · ')}`)
    if (r.ap_email || r.ap_phone) L.push(`  AP contact: ${[r.ap_email, r.ap_phone].filter(Boolean).join(' · ')}`)
    if (r.last_word) L.push(`  Last word: ${fmtShort(r.last_word.at)}${r.last_word.temperature ? ` · ${TEMP_LABEL[r.last_word.temperature] ?? r.last_word.temperature}` : ''} · "${r.last_word.note}" — ${r.last_word.by}`)
    if (r.expected_pay_by) L.push(`  They said they'd pay by ${ymdLabel(r.expected_pay_by)}`)
    L.push('  What to do today:')
    L.push('   1. Send them their statement — from your inbox, or Send from the app.')
    L.push('   2. Ask for a pay date, and get it in writing.')
    L.push("   3. Mark it sent with a note — or, if you spoke with them and no statement went out, mark that with their temperature.")
    L.push(`  Open: ${gcUrl(roundUrl, r.gc_id)}`)
  }
  if (n > 0) L.push(`\nDue by end of day ${ymdLabel(p.deadline, true)}.`)
  if (p.held.items.length > 0) {
    L.push('')
    L.push('Coming back to you:')
    for (const h of p.held.items) L.push(`  - ${h.gc_name} · ${usdRound(h.amount)} · ${h.reason === 'changed' ? 'changed after sign-off' : 'not certified yet'} — rejoins your round once the office certifies it.`)
  }
  L.push('')
  L.push(`Your week: ${p.sent_by_me} of ${p.assigned_to_me} sent${p.contacted_by_me > 0 ? ` · ${p.contacted_by_me} contacted` : ''} · Your accounts: ${usdRound(p.book_total)} outstanding · ${p.assigned_to_me} GC${p.assigned_to_me === 1 ? '' : 's'}`)
  L.push('')
  L.push('Manage this email in Settings → My email schedule.')
  return L.join('\n')
}

export function renderStatementRoundHtml(p: StatementRoundPayload, dateLabel: string, roundUrl: string, recipientName: string | null, nowMs = Date.now()): string {
  const n = p.ready.length
  const who = firstName(recipientName)
  const headline = n === 0 ? `${esc(who)}, nothing is waiting on you today` : `${esc(who)}, ${n} GC${n === 1 ? ' is' : 's are'} waiting to hear from you`

  const chip = (text: string, bg: string, fg: string) =>
    `<span style="display:inline-block;font-size:12px;padding:3px 10px;border-radius:999px;background:${bg};color:${fg};margin:0 6px 6px 0;">${text}</span>`

  const cards = p.ready
    .map((r) => {
      const chips: string[] = []
      if (r.oldest_age_days != null) chips.push(chip(`&#9888; oldest bill ${r.oldest_age_days} days`, r.oldest_age_days >= 90 ? '#FCEBEB' : '#FAEEDA', r.oldest_age_days >= 90 ? '#791F1F' : '#633806'))
      if (r.over_90 > 0) chips.push(chip(`${esc(usdRound(r.over_90))} over 90 days`, '#FAEEDA', '#633806'))
      const ago = daysAgo(r.last_statement_at, nowMs)
      chips.push(
        r.last_statement_at
          ? chip(`last statement from you: ${esc(fmtShort(r.last_statement_at))} · ${ago} day${ago === 1 ? '' : 's'} ago`, '#F1EFE8', '#444441')
          : chip('no statement on record', '#FCEBEB', '#791F1F'),
      )
      const temp = r.last_word?.temperature ?? r.last_temperature?.temperature ?? null
      const tc = temp ? TEMP_COLOR[temp] : null
      const facts: string[] = []
      if (r.ap_email || r.ap_phone) {
        facts.push(`<tr><td style="padding:2px 0;color:#64748b;width:92px;vertical-align:top;">AP contact</td><td style="padding:2px 0;color:#0f172a;">${esc([r.ap_email, r.ap_phone].filter(Boolean).join(' · '))}</td></tr>`)
      } else {
        facts.push(`<tr><td style="padding:2px 0;color:#64748b;width:92px;vertical-align:top;">AP contact</td><td style="padding:2px 0;color:#b91c1c;">none on the customer — add one before you call</td></tr>`)
      }
      if (r.last_word) {
        facts.push(
          `<tr><td style="padding:2px 0;color:#64748b;vertical-align:top;">Last word</td><td style="padding:2px 0;color:#0f172a;">${esc(fmtShort(r.last_word.at))}${tc && temp ? ` · <span style="background:${tc.bg};color:${tc.fg};padding:1px 7px;border-radius:999px;font-size:12px;">${esc(TEMP_LABEL[temp] ?? temp)}</span>` : ''} · &ldquo;${esc(r.last_word.note)}&rdquo; <span style="color:#64748b;">— ${esc(r.last_word.by)}</span></td></tr>`,
        )
      } else {
        facts.push(`<tr><td style="padding:2px 0;color:#64748b;vertical-align:top;">Last word</td><td style="padding:2px 0;color:#64748b;">nothing on record — nobody has written down what this GC said</td></tr>`)
      }
      if (r.expected_pay_by) facts.push(`<tr><td style="padding:2px 0;color:#64748b;vertical-align:top;">Pays by</td><td style="padding:2px 0;color:#085041;font-weight:600;">${esc(ymdLabel(r.expected_pay_by))} — they said so; hold them to it</td></tr>`)
      return `
      <div style="border:1px solid #cbd5e1;border-radius:12px;padding:14px 16px;margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="font-size:17px;font-weight:700;color:#0f172a;">${esc(r.gc_name)}</td>
          <td style="font-size:20px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;">${esc(usd(r.amount))}</td>
        </tr></table>
        <div style="font-size:13px;color:#64748b;margin:2px 0 10px;">${r.job_count} job${r.job_count === 1 ? '' : 's'}${r.certified_by_name ? ` · certified by ${esc(r.certified_by_name)}${r.certified_at ? ` ${esc(fmtWhen(r.certified_at))}` : ''}` : ''}</div>
        <div style="margin-bottom:8px;">${chips.join('')}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">${facts.join('')}</table>
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;">What to do today</div>
        <ol style="margin:0 0 12px;padding-left:20px;font-size:13px;line-height:1.6;color:#0f172a;">
          <li>Send them their statement — from your inbox, or <b>Send from the app</b>.</li>
          <li>Ask for a pay date, and get it in writing.</li>
          <li><b>Mark it sent</b> with a note — or, if you spoke with them and no statement went out, mark that with their temperature.</li>
        </ol>
        <a href="${esc(gcUrl(roundUrl, r.gc_id))}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:9px 16px;border-radius:6px;">Send ${esc(r.gc_name)} their statement &#8594;</a>
        <div style="font-size:12px;color:#64748b;margin-top:6px;">Due by end of day ${esc(ymdLabel(p.deadline, true))}. Opens GC Review on ${esc(r.gc_name)}.</div>
      </div>`
    })
    .join('')

  const held =
    p.held.items.length > 0
      ? `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 16px;margin-bottom:14px;background:#f8fafc;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;">Coming back to you</div>
        ${p.held.items
          .map(
            (h) =>
              `<div style="font-size:13px;color:#475569;line-height:1.5;">&#128274; ${esc(h.gc_name)} · ${esc(usdRound(h.amount))} · ${h.reason === 'changed' ? 'changed after sign-off' : 'not certified yet'} — rejoins your round once the office certifies it. Nothing for you yet.</div>`,
          )
          .join('')}
      </div>`
      : ''

  const empty =
    n === 0
      ? `<p style="margin:0 0 14px;font-size:14px;color:#334155;">Nothing is certified and waiting on you right now. ${p.held.items.length > 0 ? 'What is coming back to you is below.' : ''}</p>`
      : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:20px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
      <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">${esc(dateLabel)} · your accounts</div>
      <h1 style="margin:0 0 2px;font-size:22px;color:#0f172a;">${headline}</h1>
      <div style="font-size:13px;color:#475569;margin-bottom:14px;">${esc(usd(roundTotal(p)))} outstanding across your accounts · ${p.sent_by_me} of ${p.assigned_to_me} sent this week</div>
      <div style="border-left:3px solid #BA7517;background:#FAEEDA;padding:10px 14px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#633806;">The standard</div>
        <div style="font-size:14px;color:#854F0B;line-height:1.5;">${esc(STANDARD)}</div>
      </div>
      ${empty}
      ${cards}
      ${held}
      <div style="font-size:13px;color:#475569;border-top:1px solid #e2e8f0;padding-top:10px;">
        <b style="color:#0f172a;">Your week:</b> ${p.sent_by_me} of ${p.assigned_to_me} sent${p.contacted_by_me > 0 ? ` · ${p.contacted_by_me} contacted` : ''}
        &nbsp;·&nbsp; <b style="color:#0f172a;">Your accounts:</b> ${esc(usdRound(p.book_total))} outstanding · ${p.assigned_to_me} GC${p.assigned_to_me === 1 ? '' : 's'}
      </div>
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:10px 4px;">Manage this email in Settings &#8594; My email schedule.</p>
  </div>
</body></html>`
}
