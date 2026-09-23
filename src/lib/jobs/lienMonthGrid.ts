/**
 * Months on this job — the grid (punch list #38): months down, papers across.
 * One row per month the job has (approved hours, the creation month, a month
 * a paper or a desk item names, a month with sessions still pending), oldest
 * first, with its window; one column per § 53.056 paper that went out (the
 * run's, or one recorded by hand — v2.3770), lettered A, B… oldest first; and
 * this notice as the last column, whose checks are the office's ticks. A cell
 * is a paper that names the month — "as information" when the paper went out
 * after the month's window closed (counsel, v2.3745). Pure; the modal feeds
 * it and the card draws it.
 */
import type { LienDeskItemRow, LienDeskMonth } from './lienDesk'
import { daysBetweenYmd } from './billedExpectedPay'
import { noticeDeadlineForMonth, type JobLienFilingRow } from './lienDeadlines'
import { normalizeDocumentUrl, type LienFilingDocument } from './lienFilingDocumentLink'
import { buildLienMonthHistory } from './lienMonthHistory'

export type LienGridPaper = {
  /** The filing id, or 'this' for the notice being drafted. */
  key: string
  letter: string
  kind: 'filing' | 'this'
  /** 'YYYY-MM-DD' — '' on this notice. */
  sentOn: string
  byHand: boolean
  /** This job's amount on the paper. */
  amount: number
  /** The paper's total when it covered several jobs (or was set by hand), else null. */
  printedClaim: number | null
  /** Other jobs' filings on the same packet, among the filings loaded — 0 when none or unknown. */
  packetOthers: number
  months: string[]
  method: string
  documentUrl: string
  documentNote: string
  /** This notice's pile — '' on a filing. */
  pile: string
}

export type LienGridCell = 'named' | 'info' | 'blank'

export type LienGridWindowState = 'open' | 'closed' | 'none'

export type LienGridRow = {
  month: string
  hours: number
  /** "3 people · 4 days" — '' when the crew evidence is not loaded. */
  crew: string
  fromCreation: boolean
  /** Sessions await approval and nothing is approved yet — not a work month yet. */
  pendingOnly: boolean
  window: {
    state: LienGridWindowState
    deadline: string
    daysLeft: number | null
    /** A paper names it — its lien question is answered. */
    noticed: boolean
    /** A closed window someone wrote down (v2.3679). */
    noted: boolean
    notedBy: string
    notedAt: string
    skipped: boolean
    skipReason: string
    skippedBy: string
  }
  /** One cell per paper key (this notice under 'this'). */
  cells: Record<string, LienGridCell>
  thisNotice: { on: boolean; locked: boolean; info: boolean }
}

export type LienMonthGrid = {
  rows: LienGridRow[]
  papers: LienGridPaper[]
  /** The earliest open deadline among the months on this notice — the date it has to beat. */
  earliestOpen: string | null
}

export type LienGridEvidence = { key: string; hours: number; people: number; dayCount: number; pendingHours?: number }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function firstSend(f: JobLienFilingRow): { method: string; sent_on: string } {
  const sends = Array.isArray(f.sends) ? (f.sends as { method?: string; sent_on?: string }[]) : []
  return { method: sends[0]?.method ?? '', sent_on: sends[0]?.sent_on ?? '' }
}

export function buildLienMonthGrid(input: {
  jobId: string
  /** The RPC's months for the job (open windows and the recent closed ones). */
  months: ReadonlyArray<LienDeskMonth>
  evidence?: ReadonlyArray<LienGridEvidence>
  items: ReadonlyArray<LienDeskItemRow>
  /** The job's live filings (any kind — only § 53.056 notices are read). */
  filings: ReadonlyArray<JobLienFilingRow>
  /** Every filing loaded, for packet siblings on other jobs. */
  allFilings?: ReadonlyArray<JobLienFilingRow>
  /** The months ticked on this notice. */
  checked: ReadonlySet<string>
  thisItem: LienDeskItemRow | null
  thisPile: string
  propertyKind: string
  todayYmd: string
}): LienMonthGrid {
  const notices = input.filings
    .filter((f) => f.kind === 'notice_53_056' && !f.voided_at)
    .slice()
    .sort((a, b) => (firstSend(a).sent_on || a.created_at).localeCompare(firstSend(b).sent_on || b.created_at) || a.created_at.localeCompare(b.created_at))
  const papers: LienGridPaper[] = notices.map((f, i) => {
    const send = firstSend(f)
    const x = f as JobLienFilingRow & LienFilingDocument & { by_hand?: boolean | null; packet_id?: string | null; printed_claim?: number | null }
    const packetOthers = x.packet_id ? (input.allFilings ?? []).filter((o) => (o as { packet_id?: string | null }).packet_id === x.packet_id && o.job_id !== f.job_id && !o.voided_at).length : 0
    return {
      key: f.id,
      letter: LETTERS[i] ?? String(i + 1),
      kind: 'filing',
      sentOn: send.sent_on || f.created_at.slice(0, 10),
      byHand: x.by_hand === true,
      amount: Number(f.amount) || 0,
      printedClaim: x.printed_claim == null ? null : Number(x.printed_claim),
      packetOthers,
      months: (f.months_covered ?? []).slice().sort(),
      method: send.method,
      documentUrl: normalizeDocumentUrl(x.document_url),
      documentNote: (x.document_note ?? '').trim(),
      pile: '',
    }
  })
  // This notice is a column unless it already went out (then it is among the filings).
  const thisSent = input.thisItem?.status === 'sent'
  if (!thisSent) {
    papers.push({ key: 'this', letter: LETTERS[papers.length] ?? String(papers.length + 1), kind: 'this', sentOn: '', byHand: false, amount: 0, printedClaim: null, packetOthers: 0, months: [...input.checked].sort(), method: '', documentUrl: '', documentNote: '', pile: input.thisPile })
  }

  const rpc = new Map(input.months.map((m) => [m.key, m]))
  const ev = new Map((input.evidence ?? []).map((e) => [e.key, e]))
  const history = new Map(buildLienMonthHistory(input.jobId, input.items, input.months).map((h) => [h.month, h]))
  const keys = new Set<string>()
  for (const m of input.months) keys.add(m.key)
  for (const e of input.evidence ?? []) if (e.hours > 0 || (e.pendingHours ?? 0) > 0) keys.add(e.key)
  for (const p of papers) for (const m of p.months) keys.add(m)
  for (const i of input.items) if (i.job_id === input.jobId && i.kind === 'notice_53_056' && !i.voided_at) for (const m of i.months) keys.add(m)
  for (const m of input.checked) keys.add(m)

  const rows: LienGridRow[] = [...keys]
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort()
    .map((month) => {
      const m = rpc.get(month)
      const e = ev.get(month)
      const h = history.get(month)
      const hours = e?.hours ?? m?.approvedHours ?? 0
      const pendingOnly = !m && hours <= 0 && (e?.pendingHours ?? 0) > 0 && !papers.some((p) => p.months.includes(month))
      const deadline = m?.deadline || noticeDeadlineForMonth(`${month}-01`, input.propertyKind) || ''
      const daysLeft = m ? m.daysLeft : deadline ? daysBetweenYmd(input.todayYmd, deadline) : null
      const namedBy = papers.filter((p) => p.kind === 'filing' && p.months.includes(month))
      const noticed = (m?.noticed ?? false) || namedBy.length > 0 || h?.outcome === 'sent'
      const cells: Record<string, LienGridCell> = {}
      for (const p of papers) {
        if (p.kind === 'this') continue
        cells[p.key] = p.months.includes(month) ? (deadline && p.sentOn > deadline ? 'info' : 'named') : 'blank'
      }
      const closed = daysLeft != null && daysLeft < 0
      const on = input.checked.has(month)
      const state: LienGridWindowState = pendingOnly ? 'none' : closed ? 'closed' : 'open'
      cells.this = on ? (closed ? 'info' : 'named') : 'blank'
      const locked = noticed || closed || (input.thisItem != null && input.thisItem.status !== 'drafted') || pendingOnly
      return {
        month,
        hours,
        crew: e ? `${e.people} ${e.people === 1 ? 'person' : 'people'} · ${e.dayCount} ${e.dayCount === 1 ? 'day' : 'days'}` : '',
        fromCreation: m?.fromCreation ?? false,
        pendingOnly,
        window: {
          state,
          deadline,
          daysLeft,
          noticed,
          noted: h?.outcome === 'missed' && Boolean(h.at || h.byName),
          notedBy: h?.outcome === 'missed' ? h.byName : '',
          notedAt: h?.outcome === 'missed' ? h.at : '',
          skipped: h?.outcome === 'skipped',
          skipReason: h?.outcome === 'skipped' ? h.reason : '',
          skippedBy: h?.outcome === 'skipped' ? h.byName : '',
        },
        cells,
        thisNotice: { on, locked: locked && !on ? true : locked, info: on && closed },
      }
    })
  const earliestOpen = rows.filter((r) => r.thisNotice.on && r.window.state === 'open' && r.window.deadline).map((r) => r.window.deadline).sort()[0] ?? null
  return { rows, papers, earliestOpen }
}

/** "Sent Sep 22 · by hand" / "This notice" — the paper's header line. */
export function lienGridPaperTitle(p: LienGridPaper, dayLabel: (ymd: string) => string): string {
  if (p.kind === 'this') return 'This notice'
  return `Sent ${p.sentOn ? dayLabel(p.sentOn) : '—'}${p.byHand ? ' · by hand' : ''}`
}

/** "$28,987 with 2 more jobs · mail" — the paper's second line; '' when there is nothing to say. */
export function lienGridPaperWords(p: LienGridPaper, money: (n: number) => string, methodLabel: (m: string) => string): string {
  if (p.kind === 'this') return ''
  const parts: string[] = []
  if (p.printedClaim != null && Math.abs(p.printedClaim - p.amount) >= 0.005) parts.push(`${money(p.printedClaim)}${p.packetOthers ? ` with ${p.packetOthers} more ${p.packetOthers === 1 ? 'job' : 'jobs'}` : ''}`)
  else if (p.amount > 0) parts.push(money(p.amount))
  if (p.method) parts.push(methodLabel(p.method))
  return parts.join(' · ')
}
