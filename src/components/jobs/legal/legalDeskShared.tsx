import { type CSSProperties, type ReactNode } from 'react'

import type { JobContractCoverage } from '../../../lib/jobs/jobContractCoverage'
import { envelopeAnswersWords, type LegalEnvelope } from '../../../lib/legal/legalLienPaper'

import { formatLegalMoney, type LegalGap, type LegalPacket } from '../../../lib/legal/legalPacket'
import { type LegalMatterRow } from '../../../lib/legal/legalMatters'

import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'

/**
 * The Legal desk's shared pieces (v2.5852, the split): the tabs, the pills, the doors, the section titles and the
 * table every tab draws with, the styles, the fix labels and the sheet type. Split out of `LegalDeskModal.tsx`
 * so each tab and the With-the-firm panels live in files of their own.
 */
// v2.5851: six tabs — the Record of contact lives on the Timeline as the Said lane; Fees & steps is With the firm.
export const TABS = ['narrative', 'account', 'paper', 'evidence', 'fees_steps', 'timeline'] as const
export type Tab = (typeof TABS)[number]
export const TAB_LABELS: Record<Tab, string> = { narrative: 'Narrative', account: 'Account', paper: 'Paper', evidence: 'Evidence', fees_steps: 'With the firm', timeline: 'Timeline' }

export const MUTED: CSSProperties = { color: 'var(--text-muted)' }
export const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }
export const TH: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid var(--border)' }
export const TD: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.84rem' }
// Border longhands (v2.5780): a button at one spot in the header's row flips between `btn` and `btnPrimary` as the account changes, and React warns on a shorthand under a `borderColor`.
export const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
export const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
/**
 * The header's firm group (v2.5750, the owner's call; the firm's name was a blue chip inside the subtitle since v2.4711):
 * one bordered row whose first segment is the firm's name, the door to its window, followed by its emails and its portal
 * link — so the two doors read as the firm's without repeating the word. `SEG` is one segment; the first is amber while no
 * firm is set. Hover and focus live in `index.css` (`.legalDeskSeg`, `.legalDeskClose`).
 */
export const FIRM_GROUP: CSSProperties = { display: 'inline-flex', alignItems: 'stretch', height: 30, maxWidth: '100%', minWidth: 0, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }
export const SEG: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', border: 'none', borderLeft: '1px solid var(--border)', background: 'transparent', color: 'var(--text-700)', font: 'inherit', fontSize: '0.76rem', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap', cursor: 'pointer' }
export const FIRM_SEG: CSSProperties = { ...SEG, borderLeft: 'none', fontWeight: 600, maxWidth: 220, minWidth: 0 }
export const FIRM_SEG_NONE: CSSProperties = { ...FIRM_SEG, maxWidth: 'none', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
/** The desk's two views (v2.5784, punch list #144 PR 3): Accounts, the rail and the account; Map, every case on the county map. One group, the same chrome as the firm's. */
export const VIEW_SEG: CSSProperties = { ...SEG, borderLeft: 'none' }
export const VIEW_SEG_ON: CSSProperties = { ...VIEW_SEG, background: 'var(--bg-muted)', color: 'var(--text)', fontWeight: 600 }
export type DeskView = 'accounts' | 'map'
export const EMPTY_COUNTIES: ReadonlyMap<string, string[]> = new Map()
export const EMPTY_MATTERS: ReadonlyMap<string, LegalMatterRow> = new Map()
export const SEG_RED: CSSProperties = { color: '#b42318' }
export const SEG_AMBER: CSSProperties = { color: '#9a6700' }
/** The quiet ✕ the Lien desk's title bar wears: no box, so the firm group is the row's one box. */
export const CLOSE_X: CSSProperties = { width: 30, height: 30, padding: 0, border: 'none', background: 'none', borderRadius: 6, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }
/** The full-screen toggle beside it (v2.5780), as quiet as the ✕ and the Lien desk's; the shared button keeps its pressed tint. */
export const FULL_SCREEN_BTN: CSSProperties = { width: 30, height: 30, minHeight: 0, padding: 0, border: 'none', borderRadius: 6, color: 'var(--text-muted)' }
export const sheetInput: CSSProperties = { width: '100%', font: 'inherit', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', margin: '4px 0 8px' }

export type Tone = 'stop' | 'warn' | 'ok' | 'neutral' | 'legal' | 'blue'
export function pill(text: string, tone: Tone): ReactNode {
  const colors: Record<Tone, CSSProperties> = {
    stop: { background: 'rgba(180,35,24,0.12)', color: '#b42318' },
    warn: { background: 'rgba(154,103,0,0.14)', color: '#9a6700' },
    ok: { background: 'rgba(31,122,58,0.14)', color: '#1f7a3a' },
    neutral: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
    legal: { background: 'rgba(122,46,46,0.12)', color: '#7a2e2e' },
    blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  }
  return <span style={{ ...colors[tone], fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{text}</span>
}

export function Door({ label, onClick, title }: { label: string; onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{ ...btn, height: 24, fontSize: '0.72rem', textTransform: 'none', letterSpacing: 0 }}>
      {label} ↗
    </button>
  )
}

/** Under a § 53.056 notice on the desk's Paper tab (#41 PR 1b) — the same words the firm reads. */
export function DeskEnvelopeAnswersBand({ e, packet }: { e: LegalEnvelope; packet: LegalPacket }) {
  if (!e.answers) return null
  const w = envelopeAnswersWords(e.answers, { todayYmd: packet.todayYmd, gcName: packet.account.payer.viaGc ? packet.account.payer.name : 'the GC', formatMoney: formatLegalMoney })
  return (
    <div data-legal-envelope-answers={e.key} style={{ background: 'var(--bg-200)', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem', lineHeight: 1.45 }}>
      <div><b>The owner's answers</b> <span style={MUTED}>· {w.owner}</span></div>
      <div><b>Letter two</b> <span style={MUTED}>· {w.letterTwo}</span> <b style={{ marginLeft: 10 }}>GC's written okay to pay Click direct:</b> <span style={MUTED}>{w.gcOkay}</span></div>
    </div>
  )
}

export function SectionTitle({ children, doors }: { children: ReactNode; doors?: ReactNode }) {
  return (
    <h4 style={{ margin: '18px 0 6px', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span>{children}</span>
      {doors ? <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{doors}</span> : null}
    </h4>
  )
}

/** A table cell that is a bare `YYYY-MM-DD` (v2.5757): drawn as MM/DD/YY on one line, so a date never wraps. */
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
export function isYmdCell(c: ReactNode): c is string { return typeof c === 'string' && YMD_RE.test(c) }
export function deskDate(ymd: string): string { return `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}/${ymd.slice(2, 4)}` }
export const DATE_CELL: CSSProperties = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

export function Table({ head, rows, empty, numCols = [], subRows = [] }: { head: string[]; rows: ReactNode[][]; empty: string; numCols?: number[]; /** A full-width row under row i when set (the answers band under a notice, #41 PR 1b). */ subRows?: Array<ReactNode | null> }) {
  if (rows.length === 0) return <p style={{ ...MUTED, fontSize: '0.84rem', margin: '4px 0' }}>{empty}</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{head.map((h, i) => <th key={`${h}-${i}`} style={{ ...TH, ...(numCols.includes(i) ? { textAlign: 'right' } : null) }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.flatMap((r, ri) => [
            <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...TD, ...(numCols.includes(ci) ? NUM : null), ...(isYmdCell(c) ? DATE_CELL : null) }}>{isYmdCell(c) ? deskDate(c) : c}</td>)}</tr>,
            ...(subRows[ri] ? [<tr key={`${ri}-sub`}><td colSpan={head.length} style={{ ...TD, paddingTop: 0 }}>{subRows[ri]}</td></tr>] : []),
          ])}
        </tbody>
      </table>
    </div>
  )
}

export function coverageText(c: JobContractCoverage): string {
  if (c.kind === 'signed') return `Signed${c.signedAt ? ` ${calendarYmdInAppTzFromIso(c.signedAt)}` : ''}${c.signerName ? ` by ${c.signerName}` : ''} · ${c.source}`
  if (c.kind === 'sent') return `Sent ${calendarYmdInAppTzFromIso(c.sentAt)} · viewed ${c.viewCount}× · never signed`
  if (c.kind === 'draft') return 'Draft, never sent'
  return 'None on file'
}

export const FIX_LABEL: Record<LegalGap['fix'], string> = {
  contract: 'Contract…',
  lien_instruments: 'Liens on the job…',
  edit_customer: 'Edit customer…',
  edit_job: 'Edit job…',
  call_mode: 'Call mode…',
  collections_note: 'Edit job…',
  write_down: 'Write down…',
  set_gc: 'Set the GC',
  none: '',
}

export type Sheet = { kind: 'ready'; handling: string; note: string; /** #85 item 20: an optional settlement floor set with the release. */ floor?: string; floorUnit?: 'pct' | 'usd' } | { kind: 'ask'; note: string } | { kind: 'pull'; note: string } | { kind: 'close'; note: string } | { kind: 'in_house'; note: string } | null

export function daysAgo(iso: string | null | undefined, todayYmd: string): number | null {
  // An instant's day in APP_CALENDAR_TZ, not its first ten characters (the UTC date).
  const y = calendarYmdInAppTzFromIso(iso ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return null
  const a = Date.UTC(Number(y.slice(0, 4)), Number(y.slice(5, 7)) - 1, Number(y.slice(8, 10)))
  const b = Date.UTC(Number(todayYmd.slice(0, 4)), Number(todayYmd.slice(5, 7)) - 1, Number(todayYmd.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}
