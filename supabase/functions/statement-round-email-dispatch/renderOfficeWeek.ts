/**
 * The week's GC statements, as an email to the office (punch list #49, step
 * 6b). The round email spoke to the account man — "yours to fix, not the
 * office's" — and he does not open the app; the office works every GC. This
 * one is a call list: every GC over the line, grouped by the account man to
 * ask, each with its next step, the last word and the promise. One email for
 * every recipient; a recipient who is an account man sees his own GCs first.
 *
 * Dependency-free on purpose (the time zone is passed in), so the client's
 * tests run the same file — src/lib/statementWeekEmail.ts re-exports it.
 * Email-safe markup: inline styles, light colors, no scripts.
 */

export type OfficeWeekItem = {
  gc_id: string
  gc_name: string
  amount: number
  job_count: number
  oldest_age_days: number | null
  over_90: number
  owner_user_id: string | null
  owner_name: string | null
  /** needs_certify · ready (checked, statement not out) · needs_word · done · skipped */
  state: string
  checked: boolean
  sent: boolean
  word_in: boolean
  ap_email: string | null
  ap_phone: string | null
  last_statement_at: string | null
  last_word: { note: string; by: string; at: string; action: string; temperature: string | null } | null
  last_temperature: { temperature: string; by: string; at: string } | null
  expected_pay_by: string | null
  promise_late: boolean
  days_late: number
}

export type OfficeWeekPayload = {
  week_start: string
  deadline: string
  today: string
  office: true
  items: OfficeWeekItem[]
  counts: { gcs: number; to_check: number; to_send: number; to_send_total: number; words_due: number; done: number; late: number; total: number }
}

export function isOfficeWeekPayload(v: unknown): v is OfficeWeekPayload {
  if (!v || typeof v !== 'object') return false
  const p = v as Partial<OfficeWeekPayload>
  return p.office === true && Array.isArray(p.items) && !!p.counts && typeof p.counts === 'object' && typeof p.week_start === 'string'
}

export type OfficeWeekStep = 'check' | 'send' | 'word'

/** Check, then send, then the word — the week's list's own order (gcWorklist.ts). */
export function officeWeekStep(item: Pick<OfficeWeekItem, 'state'>): OfficeWeekStep | null {
  if (item.state === 'needs_certify') return 'check'
  if (item.state === 'ready') return 'send'
  if (item.state === 'needs_word') return 'word'
  return null
}

export type OfficeWeekGroup = {
  key: string
  ownerUserId: string | null
  ownerName: string | null
  isYou: boolean
  items: OfficeWeekItem[]
  total: number
  toDo: number
  late: number
}

/** The reader's own accounts first, then the largest book, the GCs nobody is set on last. Items keep the payload's order (broken promises first). */
export function groupOfficeWeek(p: Pick<OfficeWeekPayload, 'items'>, recipientUserId: string | null): OfficeWeekGroup[] {
  const byKey = new Map<string, OfficeWeekGroup>()
  for (const it of p.items) {
    if (it.state === 'skipped') continue
    const key = it.owner_user_id ?? 'unassigned'
    let g = byKey.get(key)
    if (!g) {
      g = { key, ownerUserId: it.owner_user_id, ownerName: it.owner_user_id ? (it.owner_name ?? '').trim() || null : null, isYou: it.owner_user_id != null && it.owner_user_id === recipientUserId, items: [], total: 0, toDo: 0, late: 0 }
      byKey.set(key, g)
    }
    g.items.push(it)
    g.total += Number(it.amount || 0)
    if (officeWeekStep(it)) g.toDo += 1
    if (it.promise_late) g.late += 1
  }
  const rank = (g: OfficeWeekGroup) => (g.isYou ? 0 : g.ownerUserId ? 1 : 2)
  return [...byKey.values()].sort((a, b) => rank(a) - rank(b) || b.total - a.total || a.key.localeCompare(b.key))
}

const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] || 'there'
const usd = (n: number): string => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usdRound = (n: number): string => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ymdLabel(ymd: string | null, withWeekday = false): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...(withWeekday ? { weekday: 'long' } : {}), month: 'short', day: 'numeric' }).format(new Date(Date.UTC(y!, m! - 1, d!)))
}

function isoLabel(iso: string | null, timeZone: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(d)
}

export function groupTitle(g: Pick<OfficeWeekGroup, 'isYou' | 'ownerUserId' | 'ownerName'>): string {
  if (g.isYou) return 'Your accounts'
  if (!g.ownerUserId) return 'No account man yet'
  return `Call ${firstName(g.ownerName)}`
}

const STEP_LABEL: Record<OfficeWeekStep, string> = { check: 'Check the bills', send: 'Send the statement', word: 'Get the word' }

export function promiseLine(it: Pick<OfficeWeekItem, 'expected_pay_by' | 'promise_late' | 'days_late'>): string {
  if (!it.expected_pay_by) return ''
  const day = ymdLabel(it.expected_pay_by)
  return it.promise_late ? `promised ${day} — ${plural(it.days_late, 'day', 'days')} late` : `pays by ${day}`
}

export function officeWeekSubject(p: Pick<OfficeWeekPayload, 'counts'>, recipientName: string | null): string {
  const who = firstName(recipientName)
  const c = p.counts
  const open = c.to_check + c.to_send + c.words_due
  if (c.gcs === 0) return `${who}, no GC owes over $10,000 this week`
  if (open === 0) return `${who}, the week’s GC statements are done`
  const parts: string[] = []
  if (c.to_send > 0) parts.push(`${plural(c.to_send, 'GC statement', 'GC statements')} to send`)
  if (c.to_check > 0) parts.push(`${c.to_check} to check`)
  if (c.words_due > 0) parts.push(`${plural(c.words_due, 'word', 'words')} to get`)
  return `${who}, ${parts.join(' · ')}${c.late > 0 ? ` — ${c.late} broke a promise` : ''}`
}

export const OFFICE_STANDARD =
  'A GC should never be surprised by what they owe us. The office checks the bills and sends every statement; the account man’s word — where the GC stands, and the date they gave — keeps the record current.'

function gcUrl(base: string, gcId: string): string {
  return `${base}&gc=${encodeURIComponent(gcId)}`
}

export type OfficeWeekRenderOpts = { dateLabel: string; roundUrl: string; recipientName: string | null; recipientUserId: string | null; timeZone: string }

function summaryLine(p: Pick<OfficeWeekPayload, 'counts'>): string {
  const c = p.counts
  return `${plural(c.gcs, 'GC', 'GCs')} over $10,000 · ${usdRound(c.total)} outstanding · ${c.to_check} to check · ${c.to_send} to send · ${plural(c.words_due, 'word', 'words')} to get`
}

export function officeWeekText(p: OfficeWeekPayload, o: OfficeWeekRenderOpts): string {
  const L: string[] = []
  L.push(`${o.dateLabel} · the week’s GC statements`)
  L.push(officeWeekSubject(p, o.recipientName))
  L.push(summaryLine(p))
  L.push('')
  L.push(`THE STANDARD: ${OFFICE_STANDARD}`)
  for (const g of groupOfficeWeek(p, o.recipientUserId)) {
    L.push('')
    L.push(`${groupTitle(g)} — ${plural(g.items.length, 'GC', 'GCs')} · ${usdRound(g.total)}${g.toDo > 0 ? ` · ${g.toDo} to do` : ' · all done'}`)
    for (const it of g.items) {
      const step = officeWeekStep(it)
      const bits = [usd(it.amount)]
      if (it.oldest_age_days != null) bits.push(`oldest bill ${it.oldest_age_days} days`)
      if (it.over_90 > 0) bits.push(`${usdRound(it.over_90)} over 90 days`)
      const promise = promiseLine(it)
      if (promise) bits.push(it.promise_late ? promise.toUpperCase() : promise)
      L.push(`  ${it.gc_name} — ${bits.join(' · ')}`)
      L.push(`    Next: ${step ? STEP_LABEL[step] : 'done for the week'}`)
      if (it.last_word) L.push(`    Last word: ${isoLabel(it.last_word.at, o.timeZone)}${it.last_word.temperature ? ` · ${it.last_word.temperature}` : ''} · "${it.last_word.note}" — ${it.last_word.by}`)
      else L.push('    Last word: nothing on record')
      if (step === 'send' && (it.ap_email || it.ap_phone)) L.push(`    AP contact: ${[it.ap_email, it.ap_phone].filter(Boolean).join(' · ')}`)
    }
    const first = g.items[0]
    if (first) L.push(`  Open the call sheet: ${gcUrl(o.roundUrl, first.gc_id)}`)
  }
  if (p.deadline) L.push(`\nThe week closes end of day ${ymdLabel(p.deadline, true)}.`)
  L.push('')
  L.push('Manage this email in Settings → My email schedule.')
  return L.join('\n')
}

const TEMP_COLOR: Record<string, { bg: string; fg: string }> = {
  hot: { bg: '#E1F5EE', fg: '#085041' },
  warm: { bg: '#FAEEDA', fg: '#633806' },
  cool: { bg: '#E6F1FB', fg: '#0C447C' },
  cold: { bg: '#FCEBEB', fg: '#791F1F' },
}

export function renderOfficeWeekHtml(p: OfficeWeekPayload, o: OfficeWeekRenderOpts): string {
  const chip = (text: string, bg: string, fg: string) => `<span style="display:inline-block;font-size:12px;padding:2px 9px;border-radius:999px;background:${bg};color:${fg};margin:0 6px 4px 0;white-space:nowrap;">${text}</span>`
  const groups = groupOfficeWeek(p, o.recipientUserId)

  const cards = groups
    .map((g) => {
      const rows = g.items
        .map((it) => {
          const step = officeWeekStep(it)
          const chips: string[] = []
          chips.push(step ? chip(esc(STEP_LABEL[step]), step === 'check' ? '#FAEEDA' : '#E6F1FB', step === 'check' ? '#633806' : '#0C447C') : chip('done for the week &#10003;', '#E1F5EE', '#085041'))
          const promise = promiseLine(it)
          if (promise) chips.push(chip(esc(promise), it.promise_late ? '#FCEBEB' : '#E1F5EE', it.promise_late ? '#791F1F' : '#085041'))
          if (it.oldest_age_days != null) chips.push(chip(`oldest bill ${it.oldest_age_days} days`, it.oldest_age_days >= 90 ? '#FCEBEB' : '#F1EFE8', it.oldest_age_days >= 90 ? '#791F1F' : '#444441'))
          if (it.over_90 > 0) chips.push(chip(`${esc(usdRound(it.over_90))} over 90 days`, '#FAEEDA', '#633806'))
          const temp = it.last_word?.temperature ?? it.last_temperature?.temperature ?? null
          const tc = temp ? TEMP_COLOR[temp] : null
          const word = it.last_word
            ? `${esc(isoLabel(it.last_word.at, o.timeZone))}${tc && temp ? ` · <span style="background:${tc.bg};color:${tc.fg};padding:1px 7px;border-radius:999px;font-size:12px;">${esc(temp)}</span>` : ''} · &ldquo;${esc(it.last_word.note)}&rdquo; <span style="color:#64748b;">— ${esc(it.last_word.by)}</span>`
            : '<span style="color:#64748b;">nothing on record — nobody has written down what this GC said</span>'
          const ap = step === 'send' ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">AP contact: ${it.ap_email || it.ap_phone ? esc([it.ap_email, it.ap_phone].filter(Boolean).join(' · ')) : '<span style="color:#b91c1c;">none on the customer — add one before you send</span>'}</div>` : ''
          return `
          <div style="border-top:1px solid #e2e8f0;padding:10px 0;${it.promise_late ? 'border-left:3px solid #b91c1c;padding-left:10px;' : ''}">
            <table style="width:100%;border-collapse:collapse;"><tr>
              <td style="font-size:15px;font-weight:700;color:#0f172a;">${esc(it.gc_name)}</td>
              <td style="font-size:15px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;">${esc(usd(it.amount))}</td>
            </tr></table>
            <div style="margin:4px 0 2px;">${chips.join('')}</div>
            <div style="font-size:13px;color:#0f172a;line-height:1.5;"><span style="color:#64748b;">Last word</span> ${word}</div>
            ${ap}
          </div>`
        })
        .join('')
      const first = g.items[0]
      const door = first
        ? `<a href="${esc(gcUrl(o.roundUrl, first.gc_id))}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:8px 14px;border-radius:6px;margin-top:6px;">Open ${g.isYou ? 'your' : g.ownerUserId ? `${esc(firstName(g.ownerName))}’s` : 'the'} call sheet &#8594;</a>`
        : ''
      return `
      <div style="border:1px solid #cbd5e1;border-radius:12px;padding:12px 16px 14px;margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="font-size:17px;font-weight:700;color:#0f172a;">${esc(groupTitle(g))}</td>
          <td style="font-size:13px;color:#475569;text-align:right;white-space:nowrap;">${plural(g.items.length, 'GC', 'GCs')} · ${esc(usdRound(g.total))} · ${g.toDo > 0 ? `${g.toDo} to do` : 'all done'}</td>
        </tr></table>
        ${g.late > 0 ? `<div style="font-size:13px;font-weight:700;color:#b91c1c;margin-top:2px;">${plural(g.late, 'GC', 'GCs')} broke a promise — start there.</div>` : ''}
        ${rows}
        ${door}
      </div>`
    })
    .join('')

  const empty = groups.length === 0 ? '<p style="margin:0 0 14px;font-size:14px;color:#334155;">No GC owes $10,000 or more right now.</p>' : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <div style="max-width:600px;margin:0 auto;padding:20px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
      <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">${esc(o.dateLabel)} · the week&rsquo;s GC statements</div>
      <h1 style="margin:0 0 2px;font-size:21px;color:#0f172a;">${esc(officeWeekSubject(p, o.recipientName))}</h1>
      <div style="font-size:13px;color:#475569;margin-bottom:14px;">${esc(summaryLine(p))}</div>
      <div style="border-left:3px solid #BA7517;background:#FAEEDA;padding:10px 14px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#633806;">The standard</div>
        <div style="font-size:14px;color:#854F0B;line-height:1.5;">${esc(OFFICE_STANDARD)}</div>
      </div>
      ${empty}
      ${cards}
      ${p.deadline ? `<div style="font-size:13px;color:#475569;border-top:1px solid #e2e8f0;padding-top:10px;">The week closes end of day <b style="color:#0f172a;">${esc(ymdLabel(p.deadline, true))}</b>.</div>` : ''}
    </div>
    <p style="font-size:11px;color:#94a3b8;margin:10px 4px;">Manage this email in Settings &#8594; My email schedule.</p>
  </div>
</body></html>`
}
