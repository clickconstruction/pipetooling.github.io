import { useEffect, useMemo, useState } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER_GREEN, PAPER_RED } from '../../../lib/portal/portalTheme'
import { buildLienTimelineBook, lienGridHtml, type LienBookShow } from '../../../lib/jobs/lienTimelineBook'
import { assembleLienBookInput, type LienBookRaw } from '../../../lib/jobs/lienTimelineBookAssemble'
import { filterLegalLienGrid, findLegalLienCourts, findLegalLienGcs, legalLienCourtSections, legalLienGcCountWords, legalLienGridCells, legalLienGridCourts, legalLienGridGcs, legalLienSectionWords, LEGAL_LIEN_RAIL_FIND_AT, type LegalLienCourtSection, type LegalLienGridCell } from '../../../lib/legal/legalLienGridView'
import { openHtmlPrintWindow } from '../../../lib/jobsDocuments/printWindow'
import { formatUsdNoCents } from '../../../lib/jobs/jobFormatting'
import { justiceCourtCap, PRECINCT_NOT_YET, PRECINCT_NOT_YET_TITLE } from '../../../lib/legal/jpVenue'
import { portalBtn, portalCap, portalCard, portalTd, portalTh } from './legalFirmMatterViewShared'
import { CardCell } from './LegalCardCell'
import { LEGAL_CARD_VARS, lienCardMissingLine, portalSmall, type LienCardFact } from '../../../lib/legal/legalPortalCards'

/** The rail reads by GC or by court (v2.4825). */
type LienRailLens = 'gc' | 'court'

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
 * the office has not entered yet. On a narrow box (v2.4808) each job folds into a card: the job and its
 * address lead it, each fact beside its column's name, and the facts not entered yet read as one red line
 * (`lienCardMissingLine`) instead of a `?` each. The rail also reads by court (v2.4825): each county with
 * its justice precincts, the jobs over the justice limit under their county, and with more than one court
 * shown a band opens each court's run of rows, on the screen and on the print.
 */
/** `initialShow`: the sample opens on All (#85 item 9) so the matter's own job shows beside the due ones. */
export default function LegalPortalLienGrid({ raw, todayYmd, companyName, initialShow = 'due' }: { raw: LienBookRaw; todayYmd: string; companyName: string; initialShow?: LienBookShow }) {
  const [lens, setLens] = useState<LienRailLens>('gc')
  const [gcId, setGcId] = useState<string | null>(null)
  const [courtId, setCourtId] = useState<string | null>(null)
  const [show, setShow] = useState<LienBookShow>(initialShow)
  const [find, setFind] = useState('')
  const byCourt = lens === 'court'
  const book = useMemo(() => buildLienTimelineBook(assembleLienBookInput(raw, todayYmd)), [raw, todayYmd])
  const rows = useMemo(() => filterLegalLienGrid(book, { gcId: byCourt ? null : gcId, courtId: byCourt ? courtId : null, show }), [book, byCourt, gcId, courtId, show])
  const rail = useMemo(() => legalLienGridGcs(book, show), [book, show])
  const courtRail = useMemo(() => legalLienGridCourts(book, show), [book, show])
  // A choice that left its rail (the view emptied it) falls back to All, so the grid never sits empty under a name.
  useEffect(() => { if (gcId && !rail.some((g) => g.id === gcId)) setGcId(null) }, [rail, gcId])
  useEffect(() => { if (courtId && !courtRail.some((c) => c.id === courtId)) setCourtId(null) }, [courtRail, courtId])
  const railShown = useMemo(() => findLegalLienGcs(rail, find, gcId), [rail, find, gcId])
  const courtShown = useMemo(() => findLegalLienCourts(courtRail, find, courtId), [courtRail, find, courtId])
  const gc = !byCourt && gcId ? rail.find((g) => g.id === gcId) ?? null : null
  const court = byCourt && courtId ? courtRail.find((c) => c.id === courtId) ?? null : null
  const title = byCourt ? (court ? court.title : 'every court') : gc ? gc.name : 'all GCs'
  // By court the rows run in the rail's order, and a band opens each court's run when more than one court is shown.
  const sections = useMemo(() => (byCourt ? legalLienCourtSections(rows) : []), [byCourt, rows])
  const banded = sections.length > 1
  const groups = useMemo(
    () => (banded ? sections.map((s) => ({ section: s as LegalLienCourtSection | null, cells: legalLienGridCells(s.rows, todayYmd) })) : [{ section: null, cells: legalLienGridCells(rows, todayYmd) }]),
    [banded, sections, rows, todayYmd],
  )
  const open = rows.reduce((s, r) => s + r.job.openBalance, 0)
  const railCount = byCourt ? courtRail.length : rail.length
  const switchLens = (next: LienRailLens) => {
    if (next === lens) return
    setLens(next)
    setGcId(null)
    setCourtId(null)
    setFind('')
  }
  const print = () => {
    const html = banded
      ? lienGridHtml(sections.flatMap((s) => s.rows), { title, todayYmd, companyName, sections: sections.map((s) => ({ title: legalLienSectionWords(s), rows: s.rows })) })
      : lienGridHtml(rows, { title, todayYmd, companyName })
    if (!openHtmlPrintWindow(html)) alert('Your browser blocked the print window. Allow pop-ups and try again.')
  }
  const seg = (on: boolean): React.CSSProperties => ({ font: 'inherit', fontSize: 12.5, padding: '4px 10px', border: 'none', cursor: 'pointer', background: on ? INK : CARD, color: on ? '#fff' : MUTED, fontWeight: on ? 600 : 500 })
  const unknown = (title: string) => <span style={{ color: PAPER_RED, fontWeight: 700 }} title={title}>?</span>
  const fact = (v: string) => (v ? v : unknown('A fact the office has not entered yet'))
  // A cell that is only a `?` centres it (v2.4753); a cell with words keeps the column's left edge.
  // On a card (v2.4808) a fact the office has not entered drops out; the card's last line names them all.
  const factTd = (key: LienCardFact, v: string, extra?: React.CSSProperties) => <CardCell label={labelOf(key)} drop={!v} style={{ ...td, ...(v ? extra : { textAlign: 'center' }) }}>{fact(v)}</CardCell>
  return (
    <div style={portalCard} data-legal-portal-lien-grid>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={portalCap}>Lien grid</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }} data-legal-lien-summary>
            Each job with money open and a lien month, from the office's records today — {rows.length} {rows.length === 1 ? 'job' : 'jobs'} · {formatUsdNoCents(open)} open{gc ? ` · ${gc.name}` : ''}{byCourt ? ` · ${title}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12.5 }}>
            <span style={{ color: MUTED }}>Show</span>
            <div role="group" aria-label="Show" style={{ display: 'inline-flex', border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden' }}>
              <button type="button" aria-pressed={show === 'due'} style={seg(show === 'due')} onClick={() => setShow('due')}>Due in 30 days · {book.counts.due}</button>
              <button type="button" aria-pressed={show === 'all'} style={{ ...seg(show === 'all'), borderLeft: `1px solid ${HAIR}` }} onClick={() => setShow('all')}>Upcoming · {book.counts.all}</button>
            </div>
          </div>
        </div>
        <button type="button" style={{ ...portalBtn, background: COPPER, color: '#fff' }} onClick={print}>
          ⎙ Print the grid
        </button>
      </div>
      <div className="legalLienLay">
        <nav className="legalLienRail" aria-label={byCourt ? 'Courts' : 'GCs'} data-legal-lien-rail={lens}>
          <div className="legalLienRailList">
            <div role="group" aria-label="Read the rail by" className="legalLienLens" style={{ display: 'flex', border: `1px solid ${HAIR}`, borderRadius: 6, overflow: 'hidden', marginBottom: 8, flexShrink: 0 }}>
              <button type="button" aria-pressed={!byCourt} style={{ ...seg(!byCourt), flex: 1 }} onClick={() => switchLens('gc')}>GCs</button>
              <button type="button" aria-pressed={byCourt} style={{ ...seg(byCourt), flex: 1, borderLeft: `1px solid ${HAIR}` }} onClick={() => switchLens('court')}>Courts</button>
            </div>
            {railCount > LEGAL_LIEN_RAIL_FIND_AT ? (
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={byCourt ? 'Find a court' : 'Find a GC'} aria-label={byCourt ? 'Find a court' : 'Find a GC'} style={{ font: 'inherit', fontSize: 12.5, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '5px 8px', background: CARD, color: INK, marginBottom: 6, width: '100%' }} />
            ) : null}
            {byCourt
              ? courtShown.map((c) => {
                  const on = (c.id || null) === courtId
                  return (
                    <button
                      key={c.id || 'all'}
                      type="button"
                      className={`legalLienGc${c.kind === 'court' ? ' legalLienCourtEntry' : c.kind === 'county' || c.kind === 'none' ? ' legalLienCountyEntry' : ''}`}
                      aria-pressed={on}
                      data-legal-lien-court={c.kind}
                      onClick={() => setCourtId(c.id || null)}
                      style={{ background: on ? NOTE_BAND : 'transparent', borderLeftColor: on ? COPPER : 'transparent', color: INK, ...(c.kind === 'all' ? { borderBottom: `1px dotted ${HAIR}`, marginBottom: 4, paddingBottom: 8 } : null) }}
                    >
                      <span className="legalLienGcName" style={{ fontWeight: c.kind === 'court' || c.kind === 'none' ? 500 : 600, fontStyle: c.kind === 'none' ? 'italic' : undefined, color: c.courtKind === 'over' ? PAPER_RED : c.kind === 'none' ? MUTED : INK, ...(c.kind === 'county' ? { fontSize: portalSmall(11.5), letterSpacing: '0.06em', textTransform: 'uppercase' } : null) }}>
                        <span className="legalLienCourtFull">{c.name}</span>
                        <span className="legalLienCourtShort">{c.short}</span>
                      </span>
                      <span className="legalLienGcCount" style={{ color: MUTED }}>{legalLienGcCountWords(c.count)}</span>
                      <span className="legalLienGcOpen">{formatUsdNoCents(c.open)}</span>
                    </button>
                  )
                })
              : railShown.map((g) => {
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
        {rows.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 13, margin: '4px 0' }}>Nothing on the grid{gc ? ` for ${gc.name}` : court ? ` for ${court.title}` : ''}{show === 'due' ? ' due in 30 days — switch to Upcoming for the whole book' : ''}.</p>
        ) : (
          <div className="legalCardWrap" style={{ overflowX: 'auto', ...LEGAL_CARD_VARS }}>
            <table role="table" className="legalCardTable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: portalSmall(11.5), minWidth: 960 }}>
              <thead role="rowgroup"><tr role="row">{COLUMNS.map((c) => <th key={c.key} role="columnheader" style={{ ...portalTh, fontSize: portalSmall(10), whiteSpace: 'nowrap' }}>{c.key === 'unpaid' ? <>Amount due<span style={{ display: 'block', fontWeight: 500 }}>For work in</span></> : c.label}</th>)}</tr></thead>
              <tbody role="rowgroup">{groups.flatMap(({ section, cells }) => [...(section ? [bandRow(section)] : []), ...cells.map(jobRow)])}</tbody>
            </table>
          </div>
        )}
      </div>
      <p style={{ fontSize: portalSmall(11.5), color: MUTED, margin: '10px 0 0' }}>The rail reads by GC or by court; by court, each county lists its justice precincts, and a job over the justice limit sits under its county, not a precinct. Deadlines are per job and per work month (§ 53.056, § 53.052), weekends rolled; a property of unknown kind shows commercial dates and a residential one is a month earlier. Court is the county the work was done in, where the contract was performed (TRCP 502.4); the payer's own county is on the matter, and a lien foreclosure goes to district court whatever the amount. The justice precinct reads <i>{PRECINCT_NOT_YET}</i> until the office's court map names it. A month whose § 53.056 window has closed is left off; <span style={{ color: FAINT }}>—</span> is a job with no window still open. A <b style={{ color: PAPER_RED }}>?</b> is a fact the office has not entered — payment bond, paid out to the GC, the 10 % reserved, the owner's contract completion.</p>
    </div>
  )

  /** A court's band (v2.4825): its words, its jobs and its total, above its run of rows; a line of its own on a card. The total follows the count, so a wide table never scrolls it out of sight. */
  function bandRow(s: LegalLienCourtSection) {
    return (
      <tr key={`band-${s.id}`} role="row" data-card-band="" data-legal-lien-band={s.kind}>
        <td role="cell" colSpan={COLUMNS.length} data-label="" style={{ ...td, background: NOTE_BAND, fontSize: portalSmall(12), padding: '6px 8px' }}>
          <b style={{ color: s.kind === 'over' ? PAPER_RED : s.kind === 'none' ? MUTED : INK, fontStyle: s.kind === 'none' ? 'italic' : undefined }}>{s.title}</b>
          <span style={{ color: MUTED }}> · {legalLienGcCountWords(s.rows.length)} · </span>
          <b style={{ fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(s.open)}</b>
        </td>
      </tr>
    )
  }

  function jobRow(c: LegalLienGridCell) {
    return (
      <tr key={c.jobId} role="row">
        <CardCell label="" style={{ ...td, whiteSpace: 'nowrap' }}>
          <b style={{ display: 'block', fontSize: 12 }}>{c.job}</b>
          <span style={{ display: 'block', color: MUTED, marginTop: 1 }}>{c.street}</span>
          <span style={{ display: 'block', color: MUTED }}>{c.cityLine || ' '}</span>
        </CardCell>
        {factTd('owner', c.owner)}
        <CardCell label={labelOf('kind')} style={td}>
          <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{c.kind}{c.kindUnknown ? <> {unknown('The office has not entered the property kind — residential dates shown, the earlier ones; a commercial property is a month later')}</> : null}</span>
          {c.homestead ? <span style={{ display: 'block', color: MUTED, fontSize: portalSmall(10.5), whiteSpace: 'nowrap' }}>{c.homestead}</span> : null}
        </CardCell>
        <CardCell label={labelOf('court')} style={td} data-legal-grid-court>
          <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{c.county ? `${c.county} · JP Pct ` : <>{unknown('The county is not on the property record yet')} · JP Pct </>}{c.precinct ? <b style={{ fontWeight: 600 }}>{c.precinct}</b> : unknown(PRECINCT_NOT_YET_TITLE)}</span>
          <span style={{ display: 'inline-block', fontSize: portalSmall(10), padding: '0 6px', borderRadius: 999, border: `1px solid ${c.withinJusticeLimit ? HAIR : PAPER_RED}`, color: c.withinJusticeLimit ? MUTED : PAPER_RED, marginTop: 2, whiteSpace: 'nowrap' }}>{justiceCourtCap(c.total === '' ? 0 : Number(c.total.replace(/[$,]/g, ''))).chip}</span>
        </CardCell>
        {factTd('lastOnSite', c.lastOnSite, { whiteSpace: 'nowrap' })}
        <CardCell label={labelOf('unpaid')} style={td}>
          <b style={{ display: 'block', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{c.total}</b>
          {c.months ? <span style={{ display: 'block', color: MUTED, marginTop: 1 }}>{c.months}</span> : null}
        </CardCell>
        <CardCell label={labelOf('notices')} style={{ ...td, ...(noticeIsUnknown(c) ? { textAlign: 'center' } : null) }}>{noticeCell(c)}</CardCell>
        {factTd('affidavit', c.affidavit)}
        {factTd('bond', c.bond)}
        {factTd('paidOut', c.paidOut)}
        {factTd('reserved', c.reserved)}
        {factTd('contractCompleted', c.contractCompleted)}
        {lienCardMissingLine(c) ? <CardCell label="" className="legalCardOnly" style={{ ...td, color: PAPER_RED }} data-legal-card-missing>{lienCardMissingLine(c)}</CardCell> : null}
      </tr>
    )
  }

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

const td: React.CSSProperties = { ...portalTd, fontSize: portalSmall(11.5), padding: '6px 6px', lineHeight: 1.3 }

/** A column's name, which a card shows beside the cell's value (v2.4808). */
function labelOf(key: string): string {
  return COLUMNS.find((c) => c.key === key)?.label ?? ''
}

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
