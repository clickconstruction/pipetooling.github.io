import { useEffect, useMemo, useState } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER_GREEN, PAPER_RED } from '../../../lib/portal/portalTheme'
import { buildLienTimelineBook, lienGridHtml, type LienBookShow } from '../../../lib/jobs/lienTimelineBook'
import { assembleLienBookInput, type LienBookRaw } from '../../../lib/jobs/lienTimelineBookAssemble'
import { filterLegalLienGrid, findLegalLienGcs, legalLienGcCountWords, legalLienGridCells, legalLienGridGcs, LEGAL_LIEN_RAIL_FIND_AT, type LegalLienGridCell } from '../../../lib/legal/legalLienGridView'
import { openHtmlPrintWindow } from '../../../lib/jobsDocuments/printWindow'
import { formatUsdNoCents } from '../../../lib/jobs/jobFormatting'
import { justiceCourtCap, PRECINCT_NOT_YET, PRECINCT_NOT_YET_TITLE } from '../../../lib/legal/jpVenue'
import { portalBtn, portalCap, portalCard, portalTd, portalTh } from './legalFirmMatterViewShared'

/**
 * Counsel's grid on the firm's portal (punch list #41, PR 2): the Lien desk's
 * Timeline book — every billed job with money open and a lien month — as
 * *Due in 30 days / Upcoming*, per GC, and *Print the grid* (`lienGridHtml`, the
 * memo's twelve columns, the same page the desk prints). One fold of the
 * same rows the office reads (`assembleLienBookInput` +
 * `buildLienTimelineBook`), so the grid the firm sees is the office's book,
 * live. On the screen (v2.4749) the address sits under the job on two lines, the property
 * reads in words, the unpaid total leads its months, a month whose § 53.056
 * window closed is left off, and a rail of GCs with each one's count and
 * dollars stands in for the select (`legalLienGridView.ts`). A `?` is a fact
 * the office has not entered yet.
 */
/** `initialShow`: the sample opens on All (#85 item 9) so the matter's own job shows beside the due ones. */
export default function LegalPortalLienGrid({ raw, todayYmd, companyName, initialShow = 'due' }: { raw: LienBookRaw; todayYmd: string; companyName: string; initialShow?: LienBookShow }) {
  const [gcId, setGcId] = useState<string | null>(null)
  const [show, setShow] = useState<LienBookShow>(initialShow)
  const [find, setFind] = useState('')
  const book = useMemo(() => buildLienTimelineBook(assembleLienBookInput(raw, todayYmd)), [raw, todayYmd])
  const rows = useMemo(() => filterLegalLienGrid(book, { gcId, show }), [book, gcId, show])
  const cells = useMemo(() => legalLienGridCells(rows, todayYmd), [rows, todayYmd])
  const rail = useMemo(() => legalLienGridGcs(book, show), [book, show])
  // A choice that left the rail (the view emptied it) falls back to All GCs, so the grid never sits empty under a name.
  useEffect(() => { if (gcId && !rail.some((g) => g.id === gcId)) setGcId(null) }, [rail, gcId])
  const railShown = useMemo(() => findLegalLienGcs(rail, find, gcId), [rail, find, gcId])
  const gc = gcId ? rail.find((g) => g.id === gcId) ?? null : null
  const title = gc ? gc.name : 'all GCs'
  const open = rows.reduce((s, r) => s + r.job.openBalance, 0)
  const seg = (on: boolean): React.CSSProperties => ({ font: 'inherit', fontSize: 12.5, padding: '4px 10px', border: 'none', cursor: 'pointer', background: on ? INK : CARD, color: on ? '#fff' : MUTED, fontWeight: on ? 600 : 500 })
  const unknown = (title: string) => <span style={{ color: PAPER_RED, fontWeight: 700 }} title={title}>?</span>
  const fact = (v: string) => (v ? v : unknown('A fact the office has not entered yet'))
  // A cell that is only a `?` centres it (v2.4753); a cell with words keeps the column's left edge.
  const factTd = (v: string, extra?: React.CSSProperties) => <td style={{ ...td, ...(v ? extra : { textAlign: 'center' }) }}>{fact(v)}</td>
  return (
    <div style={portalCard} data-legal-portal-lien-grid>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={portalCap}>Lien grid</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
            Each job with money open and a lien month, from the office's records today — {rows.length} {rows.length === 1 ? 'job' : 'jobs'} · {formatUsdNoCents(open)} open{gc ? ` · ${gc.name}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12.5 }}>
            <span style={{ color: MUTED }}>Show</span>
            <div role="group" aria-label="Show" style={{ display: 'inline-flex', border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
              <button type="button" aria-pressed={show === 'due'} style={seg(show === 'due')} onClick={() => setShow('due')}>Due in 30 days · {book.counts.due}</button>
              <button type="button" aria-pressed={show === 'all'} style={{ ...seg(show === 'all'), borderLeft: `1px solid ${HAIR}` }} onClick={() => setShow('all')}>Upcoming · {book.counts.all}</button>
            </div>
          </div>
        </div>
        <button type="button" style={{ ...portalBtn, background: COPPER, color: '#fff' }} onClick={() => { if (!openHtmlPrintWindow(lienGridHtml(rows, { title, todayYmd, companyName }))) alert('Your browser blocked the print window. Allow pop-ups and try again.') }}>
          ⎙ Print the grid
        </button>
      </div>
      <div className="legalLienLay">
        <nav className="legalLienRail" aria-label="GCs" data-legal-lien-rail>
          <div className="legalLienRailList">
            {rail.length > LEGAL_LIEN_RAIL_FIND_AT ? (
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a GC" aria-label="Find a GC" style={{ font: 'inherit', fontSize: 12.5, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '5px 8px', background: CARD, color: INK, marginBottom: 6, width: '100%' }} />
            ) : null}
            {railShown.map((g) => {
              const on = (g.id || null) === gcId
              return (
                <button
                  key={g.id || 'all'}
                  type="button"
                  className="legalLienGc"
                  aria-pressed={on}
                  data-legal-lien-gc={g.kind}
                  onClick={() => setGcId(g.id || null)}
                  style={{ background: on ? NOTE_BAND : 'transparent', borderLeftColor: on ? COPPER : 'transparent', color: INK, ...(g.kind === 'all' ? { borderBottom: `1px dotted ${HAIR}`, marginBottom: 4, paddingBottom: 8 } : null) }}
                >
                  <span className="legalLienGcName" style={{ fontWeight: g.kind === 'none' ? 500 : 600, fontStyle: g.kind === 'none' ? 'italic' : undefined, color: g.kind === 'none' ? MUTED : INK }}>{g.name}</span>
                  <span className="legalLienGcCount" style={{ color: MUTED }}>{legalLienGcCountWords(g.count)}</span>
                  <span className="legalLienGcOpen">{formatUsdNoCents(g.open)}</span>
                </button>
              )
            })}
          </div>
        </nav>
        {cells.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 13, margin: '4px 0' }}>Nothing on the grid{gc ? ` for ${gc.name}` : ''}{show === 'due' ? ' due in 30 days — switch to Upcoming for the whole book' : ''}.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 960 }}>
              <thead><tr>{COLUMNS.map((c) => <th key={c.key} style={{ ...portalTh, fontSize: 10, whiteSpace: 'nowrap' }}>{c.key === 'unpaid' ? <>Amount due<span style={{ display: 'block', fontWeight: 500 }}>For work in</span></> : c.label}</th>)}</tr></thead>
              <tbody>
                {cells.map((c) => (
                  <tr key={c.jobId}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <b style={{ display: 'block', fontSize: 12 }}>{c.job}</b>
                      <span style={{ display: 'block', color: MUTED, marginTop: 1 }}>{c.street}</span>
                      <span style={{ display: 'block', color: MUTED }}>{c.cityLine || '\u00a0'}</span>
                    </td>
                    {factTd(c.owner)}
                    <td style={td}>
                      <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{c.kind}{c.kindUnknown ? <> {unknown('The office has not entered the property kind — commercial dates shown; a residential property is a month earlier')}</> : null}</span>
                      {c.homestead ? <span style={{ display: 'block', color: MUTED, fontSize: 10.5, whiteSpace: 'nowrap' }}>{c.homestead}</span> : null}
                    </td>
                    <td style={td} data-legal-grid-court>
                      <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{c.county ? `${c.county} · JP Pct ` : <>{unknown('The county is not on the property record yet')} · JP Pct </>}{unknown(PRECINCT_NOT_YET_TITLE)}</span>
                      <span style={{ display: 'inline-block', fontSize: 10, padding: '0 6px', borderRadius: 999, border: `1px solid ${c.withinJusticeLimit ? HAIR : PAPER_RED}`, color: c.withinJusticeLimit ? MUTED : PAPER_RED, marginTop: 2, whiteSpace: 'nowrap' }}>{justiceCourtCap(c.total === '' ? 0 : Number(c.total.replace(/[$,]/g, ''))).chip}</span>
                    </td>
                    {factTd(c.lastOnSite, { whiteSpace: 'nowrap' })}
                    <td style={td}>
                      <b style={{ display: 'block', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{c.total}</b>
                      {c.months ? <span style={{ display: 'block', color: MUTED, marginTop: 1 }}>{c.months}</span> : null}
                    </td>
                    <td style={{ ...td, ...(noticeIsUnknown(c) ? { textAlign: 'center' } : null) }}>{noticeCell(c)}</td>
                    {factTd(c.affidavit)}
                    {factTd(c.bond)}
                    {factTd(c.paidOut)}
                    {factTd(c.reserved)}
                    {factTd(c.contractCompleted)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: MUTED, margin: '10px 0 0' }}>Deadlines are per job and per work month (§ 53.056, § 53.052), weekends rolled; a property of unknown kind shows commercial dates and a residential one is a month earlier. Court is the county the work was done in, where the contract was performed (TRCP 502.4); the payer's own county is on the matter, and a lien foreclosure goes to district court whatever the amount. The justice precinct reads <i>{PRECINCT_NOT_YET}</i> until the office's court map names it. A month whose § 53.056 window has closed is left off; <span style={{ color: FAINT }}>—</span> is a job with no window still open. A <b style={{ color: PAPER_RED }}>?</b> is a fact the office has not entered — payment bond, paid out to the GC, the 10 % reserved, the owner's contract completion.</p>
    </div>
  )

  function noticeIsUnknown(c: LegalLienGridCell) {
    return !c.noticeNote && !c.allClosed && c.notices.length === 0
  }

  function noticeCell(c: LegalLienGridCell) {
    if (c.noticeNote) {
      // `none needed (with the owner)` on two lines (v2.4753): the words, then the reason under them.
      const cut = c.noticeNote.indexOf(' (')
      if (cut < 0) return c.noticeNote
      return <><span style={{ display: 'block' }}>{c.noticeNote.slice(0, cut)}</span><span style={{ display: 'block', color: MUTED }}>{c.noticeNote.slice(cut + 1)}</span></>
    }
    if (c.allClosed) return <span style={{ color: FAINT }} title="Every month's § 53.056 window has closed">—</span>
    if (c.notices.length === 0) return unknown('A fact the office has not entered yet')
    return c.notices.map((n) => (
      <span key={n.month} style={{ display: 'block', whiteSpace: 'nowrap' }}>
        {n.month}: <b style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n.date}</b>{n.sent ? <span style={{ color: PAPER_GREEN }}> · sent</span> : null}
      </span>
    ))
  }
}

const td: React.CSSProperties = { ...portalTd, fontSize: 11.5, padding: '6px 6px', lineHeight: 1.3 }

const COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'job', label: 'Job' },
  { key: 'owner', label: 'Owner of record' },
  { key: 'kind', label: 'Property' },
  { key: 'court', label: 'Court' },
  { key: 'lastOnSite', label: 'Last on site' },
  /** Drawn as two lines, one over each line of the cell (v2.4753): *Amount due* / *For work in*. */
  { key: 'unpaid', label: 'Amount due · for work in' },
  { key: 'notices', label: '§ 53.056 per month' },
  { key: 'affidavit', label: 'Affidavit by' },
  { key: 'bond', label: 'Bond' },
  { key: 'paidOut', label: 'Paid out to GC' },
  { key: 'reserved', label: '10 % reserved' },
  { key: 'contractCompleted', label: 'Contract completed' },
]
