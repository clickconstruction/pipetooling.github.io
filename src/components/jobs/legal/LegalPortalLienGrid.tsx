import { useMemo, useState } from 'react'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER_RED } from '../../../lib/portal/portalTheme'
import { buildLienTimelineBook, filterLienTimelineBook, lienGridHtml, lienGridRows, LIEN_GRID_COLUMNS, type LienBookShow } from '../../../lib/jobs/lienTimelineBook'
import { assembleLienBookInput, type LienBookRaw } from '../../../lib/jobs/lienTimelineBookAssemble'
import { openHtmlPrintWindow } from '../../../lib/jobsDocuments/printWindow'
import { formatUsdNoCents } from '../../../lib/jobs/jobFormatting'
import { portalBtn, portalCap, portalCard, portalTd, portalTh } from './legalFirmMatterViewShared'

/**
 * Counsel's grid on the firm's portal (punch list #41, PR 2): the Lien desk's
 * Timeline book — every billed job with money open and a lien month — as the
 * memo's twelve columns, per GC, *Something due / All*, and *Print the grid*
 * (`lienGridHtml`, the same page the desk prints). One fold of the same rows
 * the office reads (`assembleLienBookInput` + `buildLienTimelineBook`), so the
 * grid the firm sees is the office's book, live. A `?` is a fact the office
 * has not entered yet.
 */
export default function LegalPortalLienGrid({ raw, todayYmd, companyName }: { raw: LienBookRaw; todayYmd: string; companyName: string }) {
  const [gcId, setGcId] = useState<string | null>(null)
  const [show, setShow] = useState<LienBookShow>('due')
  const book = useMemo(() => buildLienTimelineBook(assembleLienBookInput(raw, todayYmd)), [raw, todayYmd])
  const rows = useMemo(() => filterLienTimelineBook(book, { gcId, show }), [book, gcId, show])
  const grid = useMemo(() => lienGridRows(rows, todayYmd), [rows, todayYmd])
  const gc = gcId ? book.gcs.find((g) => g.id === gcId) ?? null : null
  const title = gc ? gc.name : 'all GCs'
  const open = rows.reduce((s, r) => s + r.job.openBalance, 0)
  const select: React.CSSProperties = { font: 'inherit', fontSize: 12.5, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '3px 8px', background: CARD, color: INK }
  return (
    <div style={portalCard} data-legal-portal-lien-grid>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={portalCap}>Lien grid</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
            Every billed job with money open and a lien month, as the office's Lien desk holds it today — {rows.length} {rows.length === 1 ? 'job' : 'jobs'} · {formatUsdNoCents(open)} open
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5 }}>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: MUTED }}>GC</span>
              <select value={gcId ?? ''} onChange={(e) => setGcId(e.target.value || null)} style={select} aria-label="GC">
                <option value="">All GCs · {book.rows.length}</option>
                {book.gcs.map((g) => <option key={g.id} value={g.id}>{g.name || 'GC'} · {g.count}</option>)}
              </select>
            </label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: MUTED }}>Show</span>
              <select value={show} onChange={(e) => setShow(e.target.value === 'all' ? 'all' : 'due')} style={select} aria-label="Show">
                <option value="due">Something due · {book.counts.due}</option>
                <option value="all">All · {book.counts.all}</option>
              </select>
            </label>
          </div>
        </div>
        <button type="button" style={{ ...portalBtn, background: COPPER, color: '#fff' }} onClick={() => { if (!openHtmlPrintWindow(lienGridHtml(rows, { title, todayYmd, companyName }))) alert('Your browser blocked the print window. Allow pop-ups and try again.') }}>
          ⎙ Print the grid
        </button>
      </div>
      {grid.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13, margin: '12px 0 4px' }}>Nothing on the grid{gc ? ` for ${gc.name}` : ''}{show === 'due' ? ' with something due — switch to All for the whole book' : ''}.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 1040 }}>
            <thead><tr>{LIEN_GRID_COLUMNS.map((c) => <th key={c.key} style={{ ...portalTh, fontSize: 10, whiteSpace: 'nowrap' }}>{c.label}</th>)}</tr></thead>
            <tbody>
              {grid.map((g, i) => (
                <tr key={rows[i]?.jobId ?? i}>
                  {LIEN_GRID_COLUMNS.map((c) => {
                    const v = g[c.key]
                    return <td key={c.key} style={{ ...portalTd, fontSize: 11.5, padding: '4px 5px', ...(c.key === 'job' ? { fontWeight: 700, whiteSpace: 'nowrap' } : null) }}>{v ? v : <span style={{ color: PAPER_RED, fontWeight: 700 }} title="A fact the office has not entered yet">?</span>}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 11.5, color: MUTED, margin: '8px 0 0' }}>Deadlines are per job and per work month (§ 53.056, § 53.052), weekends rolled; a property of unknown kind shows commercial dates and a residential one is a month earlier. A <b style={{ color: PAPER_RED }}>?</b> is a fact the office has not entered — payment bond, paid out to the GC, the 10 % reserved, the owner's contract completion.</p>
    </div>
  )
}
