/**
 * GC mode, Owner Billing's O7b: the Monday money email's renderer (the gc_money_monday stream). It shapes
 * get_gc_money_monday_payload() in the Money lens's own words: Who owes us as GcMoney's OwedRow says each bill (late,
 * waiting on the architect, promised or expected), the lens's whole dollars and short days, then last week's sends and
 * certificates, and Open Money. No six weeks line yet (the lead's call 2, 2026-10-08). Settings → What the team sees
 * renders it on sample data; gc-money-monday-email/render.ts re-exports it.
 */

export type GcMoneyMondayBill = {
  projectId: string
  project: string
  customer: string
  architect: string
  number: number
  final: boolean
  sentOn: string
  certified: number | null
  certifiedOn: string | null
  open: number
  dueOn: string | null
  promised: boolean
  daysLate: number
  missed: number
  waitingOnArchitect: boolean
}

export type GcMoneyMondayPayload = {
  today: string
  weekFrom: string
  weekTo: string
  bills: GcMoneyMondayBill[]
  sent: { project: string; number: number; final: boolean; due: number; sentOn: string }[]
  certified: { project: string; number: number; final: boolean; certified: number; certifiedOn: string }[]
}

export type GcMoneyMondaySection = 'late' | 'architect' | 'coming'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Oct 7", the lens's short day. */
export function gcMoneyShortDate(ymd: string): string {
  const [, m, d] = ymd.split('-')
  const month = MONTHS[Number(m) - 1]
  return month ? `${month} ${Number(d)}` : ymd
}

/** "Tue Oct 6". */
function dayWords(ymd: string): string {
  const weekday = WEEKDAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()] ?? ''
  return `${weekday} ${gcMoneyShortDate(ymd)}`.trim()
}

/** The lens's whole dollars: "$15,000". */
const money = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const billName = (b: { final: boolean; number: number }): string => (b.final ? 'final pay application' : `pay application ${b.number}`)

/** Where a bill goes in the email and its words: GcMoney's OwedRow, the architect first, then late. */
export function gcMoneyMondayStatus(b: GcMoneyMondayBill): { section: GcMoneyMondaySection; words: string } {
  if (b.waitingOnArchitect) return { section: 'architect', words: `waiting on ${b.architect.trim() || 'the architect'} to certify` }
  if (b.daysLate > 0) {
    return { section: 'late', words: `late ${b.daysLate === 1 ? '1 day' : `${b.daysLate} days`}, past ${b.promised ? 'their promise' : 'the day we expected'}` }
  }
  if (b.dueOn === null) return { section: 'coming', words: 'waiting' }
  return { section: 'coming', words: `${b.promised ? 'promised' : 'expected'} ${gcMoneyShortDate(b.dueOn)}` }
}

export function gcMoneyMondaySubject(p: GcMoneyMondayPayload): string {
  return `Our GC money, ${dayWords(p.today)}`
}

/** The email's first line: what customers owe us across our GC jobs, and how much of it is late. */
export function gcMoneyMondayHeadline(p: GcMoneyMondayPayload): string {
  const bills = p.bills ?? []
  if (bills.length === 0) return 'Nobody owes us right now.'
  const open = bills.reduce((s, b) => s + Number(b.open), 0)
  const late = bills.filter((b) => gcMoneyMondayStatus(b).section === 'late').reduce((s, b) => s + Number(b.open), 0)
  const count = bills.length === 1 ? '1 bill' : `${bills.length} bills`
  return `Customers owe us ${money(open)} on ${count}. ${Math.round(late) > 0 ? `${money(late)} of it is late.` : 'None of it is late.'}`
}

function lastWeekLines(p: GcMoneyMondayPayload): string[] {
  const sent = (p.sent ?? []).map((s) => `We sent ${s.project}'s ${billName(s)} for ${money(s.due)} on ${dayWords(s.sentOn)}.`)
  const certified = (p.certified ?? []).map(
    (c) => `The architect certified ${c.project}'s ${billName(c)} for ${money(c.certified)} on ${dayWords(c.certifiedOn)}.`,
  )
  const lines = [...sent, ...certified]
  return lines.length > 0 ? lines : ['No pay application went out or came back certified.']
}

const SECTIONS: { key: GcMoneyMondaySection; title: string; color: string }[] = [
  { key: 'late', title: 'Late', color: '#b91c1c' },
  { key: 'architect', title: 'Waiting on the architect', color: '#b45309' },
  { key: 'coming', title: 'Coming in', color: '#334155' },
]

export function renderGcMoneyMondayHtml(p: GcMoneyMondayPayload, moneyUrl: string, requesterName?: string): string {
  const bills = p.bills ?? []
  const section = (key: GcMoneyMondaySection, title: string, color: string): string => {
    const rows = bills.filter((b) => gcMoneyMondayStatus(b).section === key)
    if (rows.length === 0) return ''
    const body = rows
      .map((b) => {
        const status = gcMoneyMondayStatus(b)
        const missed = b.missed > 0 ? ` · ${b.missed === 1 ? 'missed a day before' : `missed ${b.missed} days before`}` : ''
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0"><strong>${esc(b.customer || b.project)}</strong>
            <div style="color:#64748b;font-size:12px">${esc(b.project)} · ${esc(billName(b))}</div>
            <div style="color:${color};font-size:12px">${esc(status.words)}${esc(missed)}</div></td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;font-weight:700">${money(b.open)}</td>
        </tr>`
      })
      .join('')
    return `<h2 style="font-size:15px;margin:18px 0 6px;color:${color}">${esc(title)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px"><tbody>${body}</tbody></table>`
  }
  const lastWeek = lastWeekLines(p)
    .map((l) => `<li style="margin:2px 0">${esc(l)}</li>`)
    .join('')
  return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;color:#1a202c;max-width:680px;margin:0 auto">
    <h1 style="font-size:19px;margin:0 0 2px">Our GC money</h1>
    <p style="color:#64748b;margin:0 0 12px">${esc(dayWords(p.today))}${requesterName ? ` · scheduled by ${esc(requesterName)}` : ''}</p>
    <p style="margin:0 0 8px;font-size:14px;font-weight:700">${esc(gcMoneyMondayHeadline(p))}</p>
    ${SECTIONS.map((s) => section(s.key, s.title, s.color)).join('')}
    <h2 style="font-size:15px;margin:18px 0 6px;color:#334155">Last week, ${esc(gcMoneyShortDate(p.weekFrom))} to ${esc(gcMoneyShortDate(p.weekTo))}</h2>
    <ul style="margin:0;padding-left:18px;font-size:13.5px">${lastWeek}</ul>
    <p style="margin:18px 0 0"><a href="${esc(moneyUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:8px 14px;border-radius:6px">Open Money</a></p>
    <p style="font-size:11.5px;color:#94a3b8;margin:14px 0 0">Built from live numbers when it was sent. Money in GC projects has every job, side by side.</p>
  </div>`
}

export function renderGcMoneyMondayText(p: GcMoneyMondayPayload, moneyUrl: string): string {
  const bills = p.bills ?? []
  const parts = [`Our GC money, ${dayWords(p.today)}`, gcMoneyMondayHeadline(p), '']
  for (const s of SECTIONS) {
    const rows = bills.filter((b) => gcMoneyMondayStatus(b).section === s.key)
    if (rows.length === 0) continue
    parts.push(`${s.title}:`)
    for (const b of rows) {
      const missed = b.missed > 0 ? `, ${b.missed === 1 ? 'missed a day before' : `missed ${b.missed} days before`}` : ''
      parts.push(`  ${b.customer || b.project}, ${b.project}, ${billName(b)}: ${money(b.open)}, ${gcMoneyMondayStatus(b).words}${missed}`)
    }
    parts.push('')
  }
  parts.push(`Last week, ${gcMoneyShortDate(p.weekFrom)} to ${gcMoneyShortDate(p.weekTo)}:`, ...lastWeekLines(p).map((l) => `  ${l}`), '', `Open Money: ${moneyUrl}`)
  return parts.join('\n')
}
