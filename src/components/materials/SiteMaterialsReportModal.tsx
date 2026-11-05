/**
 * The material location report (punch list #268): the Development page's paper of what is in every
 * cage and box across the site's jobs, by job or by location, with Print at its head. The window
 * reads the site's ledger when it opens (never with the page), folds it once through
 * `lib/materials/siteMaterialsReport.ts`, and draws one Letter paper: the head with the site, the day
 * and who printed, the sections and their boxes, the jobs with nothing on site in one closing block,
 * and a foot on every page that names the ledger. Printing draws the paper alone at full size, as the
 * manifest does (`printRootCss`, v2.6432); the PDF is the browser's own Print, Save as PDF. A plain
 * print: no sent copy. The reader switches between the two groupings at leisure (the owner's word on
 * the mock-up), and the device remembers the last pick.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { printRootCss } from '../../lib/printRoot'
import { manifestDateWords } from '../../lib/materials/containerManifest'
import { fetchSiteMaterials, type SiteMaterialsReader } from '../../lib/materials/siteMaterialsRead'
import { readReportView, writeReportView } from '../../lib/materials/siteMaterialsReportPrefs'
import { boxWords, buildSiteMaterialsReport, countsWords, EMPTY_BOX_WORDS, footWords, jobWords, lastRecordedWords, NOTHING_ON_SITE_WORDS, nothingHeading, REPORT_VIEWS, reportLeadWords, reportSections, type ReportBox, type ReportJobInput, type ReportSiteInput, type ReportView, type SiteMaterialsReport, type SiteMaterialsRows } from '../../lib/materials/siteMaterialsReport'

const BLUE = '#2563eb'
const btn: CSSProperties = { minHeight: 36, padding: '0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }
const btnPrimary: CSSProperties = { ...btn, background: BLUE, borderColor: BLUE, color: '#fff' }

/** The paper's own rule, dark on white: a printed page has no theme. */
const RULE = 'var(--text-strong)'
const paper: CSSProperties = { color: 'var(--text-strong)', background: 'var(--surface)', fontSize: '0.8rem', lineHeight: 1.4 }
const eye: CSSProperties = { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-700)', margin: '0 0 2px' }
const sectionHead: CSSProperties = { borderBottom: `1.5px solid ${RULE}`, padding: '3px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: '0.9rem' }
const groupHead: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-700)', margin: '0.45rem 0 0.15rem' }
const box: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 4, margin: '0.25rem 0 0.4rem' }
const boxHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 7px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.6rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-700)', padding: '2px 7px', borderBottom: '1px solid var(--border)', fontWeight: 700 }
const td: CSSProperties = { padding: '2.5px 7px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
const num: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }

type Props = {
  site: ReportSiteInput
  jobs: ReadonlyArray<ReportJobInput>
  printedBy: string | null
  onClose: () => void
  /** The print call, `window.print` in the app; a test hands in a spy. */
  print?: () => void
  /** The read, the site's three tables over the job ids; a test hands in rows. */
  read?: SiteMaterialsReader
}

export default function SiteMaterialsReportModal({ site, jobs, printedBy, onClose, print = () => window.print(), read = fetchSiteMaterials }: Props) {
  const [view, setView] = useState<ReportView>(() => readReportView())
  const [rows, setRows] = useState<SiteMaterialsRows | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tick, setTick] = useState(0)
  // The read keys on the ids as a string: a parent that hands a new array each render must not read the site again.
  const idsKey = jobs.map((j) => j.id).join(',')

  useEffect(() => {
    let cancelled = false
    setReading(true)
    setFailure(null)
    void read(idsKey ? idsKey.split(',') : []).then(
      (r) => {
        if (cancelled) return
        setRows(r)
        setReading(false)
      },
      (e: unknown) => {
        if (cancelled) return
        setFailure(recoveryFailureFromError(e, 'The site’s cages and boxes did not read.'))
        setReading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [read, idsKey, tick])

  const report = useMemo(() => (rows ? buildSiteMaterialsReport({ site, jobs, rows, now: new Date(), printedBy }) : null), [rows, site, jobs, printedBy])
  const pick = (v: ReportView) => {
    setView(v)
    writeReportView(v)
  }
  const foot = report ? footWords(report) : ''
  // In print the foot rides in the page's margin boxes on every page (Chrome, as the costs packet's does); on screen it is drawn once at the paper's end.
  const footCss = `@page { @bottom-left { content: "${foot.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"; font: 8px -apple-system, "Segoe UI", system-ui, sans-serif; color: #6b7280; } @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8px -apple-system, "Segoe UI", system-ui, sans-serif; color: #6b7280; } }`

  return createPortal(
    <div className="site-materials-report" style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      {/* Printing draws the paper alone at full size, one Letter sheet after another. The window sits on <body> (a portal) and print takes everything else on <body> out of the layout (lib/printRoot.ts), so the page behind can neither show on the paper nor shrink it (v2.6432). */}
      <style>{`${printRootCss('site-materials-report')} @media print { ${footCss} .site-materials-report-dialog { box-shadow: none !important; max-height: none !important; width: 100% !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; border: none !important; } .site-materials-report-chrome { display: none !important; } .site-materials-report-paper { border: none !important; padding: 0 !important; } .site-materials-report-box { break-inside: avoid; page-break-inside: avoid; } .site-materials-report-section-head, .site-materials-report-group-head { break-after: avoid; page-break-after: avoid; } .site-materials-report-nothing { break-inside: avoid; page-break-inside: avoid; } .site-materials-report-foot { display: none !important; } thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; } } @media screen and (max-width: 560px) { .site-materials-report-head { flex-direction: column; align-items: flex-start !important; } .site-materials-report-head > div:last-child { text-align: left !important; } .site-materials-report-lines { table-layout: auto !important; } .site-materials-report-lines th { width: auto !important; } .site-materials-report-dialog { padding: 0.75rem !important; } .site-materials-report-paper { padding: 0.75rem 0.6rem !important; } }`}</style>
      <div role="dialog" aria-modal="true" aria-label="Material location report" className="site-materials-report-dialog" data-theme="light" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(900px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', padding: '1rem 1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div className="site-materials-report-chrome" style={{ display: 'grid', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', flex: '1 1 auto', minWidth: 0 }}>Material location report · {site.name}</h2>
            <span role="group" aria-label="How the paper is grouped" style={{ display: 'inline-flex', gap: 2, padding: 2, border: '1px solid var(--border)', borderRadius: 9999, background: 'var(--bg-subtle)' }} data-testid="report-views">
              {REPORT_VIEWS.map((v) => (
                <button key={v.key} type="button" onClick={() => pick(v.key)} aria-pressed={view === v.key} title={v.title} data-testid={`report-view-${v.key}`} style={{ border: `1px solid ${view === v.key ? 'var(--border-strong)' : 'transparent'}`, borderRadius: 9999, padding: '3px 10px', font: 'inherit', fontSize: '0.78rem', lineHeight: 1.2, cursor: 'pointer', background: view === v.key ? 'var(--surface)' : 'transparent', color: view === v.key ? 'var(--text-strong)' : 'var(--text-700)', fontWeight: view === v.key ? 700 : 500 }}>
                  {v.label}
                </button>
              ))}
            </span>
            <button type="button" style={{ ...btnPrimary, flex: '0 0 auto' }} disabled={!report} onClick={print} data-testid="report-print">Print</button>
            <button type="button" style={{ ...btn, flex: '0 0 auto' }} onClick={onClose}>Close</button>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{reportLeadWords(view)}</span>
        </div>
        {failure ? (
          <OfflineRetryPanel failure={failure} onRetry={() => setTick((t) => t + 1)} idempotent busy={reading} surface="site-materials-report" />
        ) : !report ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }} data-testid="report-reading">Reading the site’s cages and boxes…</div>
        ) : (
          <ReportPaper report={report} view={view} />
        )}
      </div>
    </div>,
    document.body,
  )
}

/** The Letter paper: the head, the sections of the view picked, the closing block, the foot. */
function ReportPaper({ report, view }: { report: SiteMaterialsReport; view: ReportView }) {
  const sections = reportSections(report, view)
  const empty = report.jobs.length === 0
  return (
    <section className="site-materials-report-paper" aria-label="The paper" data-testid="report-paper" style={{ ...paper, border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.1rem' }}>
      <header className="site-materials-report-head site-materials-report-section-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', borderBottom: `2px solid ${RULE}`, paddingBottom: '0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <p style={eye}>Material location report</p>
          <h1 style={{ fontSize: '1.5rem', margin: 0, lineHeight: 1.1 }}>{report.site.name}</h1>
          {report.site.customer || report.site.address ? <div style={{ fontSize: '0.82rem', color: 'var(--text-700)', marginTop: 3 }}>{[report.site.customer, report.site.address].filter(Boolean).join(' · ')}</div> : null}
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-700)', lineHeight: 1.45, whiteSpace: 'nowrap' }} data-testid="report-printed">
          <b style={{ color: 'var(--text-strong)' }}>{manifestDateWords(report.printedOn)}</b>
          {report.printedBy ? <><br />printed by {report.printedBy}</> : null}
        </div>
      </header>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-700)', margin: '6px 0 2px' }} data-testid="report-counts">{countsWords(report.counts)}</div>
      {empty ? (
        <div style={{ margin: '1.2rem 0', padding: '0.9rem', border: '1px dashed var(--border-strong)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--text-700)' }} data-testid="report-empty">{NOTHING_ON_SITE_WORDS}</div>
      ) : null}
      {sections.map((s) => (
        <div key={s.key} data-testid="report-section">
          <div className="site-materials-report-section-head" style={sectionHead}>
            <b style={{ fontSize: '0.98rem' }}>{s.title}</b>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right' }}>{s.meta}</span>
          </div>
          {s.groups.map((g) => (
            <div key={g.key} data-testid="report-group">
              <div className="site-materials-report-group-head" style={groupHead}>{g.heading}</div>
              {g.boxes.map((b) => (
                <BoxBlock key={b.containerId} box={b} withJob={view === 'location' && (s.key === 'unsorted' || s.key === 'no-place')} printedOn={report.printedOn} />
              ))}
            </div>
          ))}
        </div>
      ))}
      {report.nothing.length ? (
        <div className="site-materials-report-nothing" style={{ marginTop: '0.9rem', borderTop: `1.5px solid ${RULE}`, paddingTop: 4 }} data-testid="report-nothing">
          <b style={{ fontSize: '0.88rem', display: 'block', marginBottom: 3 }}>{nothingHeading(report.nothing.length)}</b>
          {report.nothing.map((n) => (
            <div key={n.jobId} style={{ padding: '1.5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }} data-testid="report-nothing-line">
              <span style={{ fontWeight: 700 }}>{jobWords(n)}</span>: {n.words}
            </div>
          ))}
        </div>
      ) : null}
      <div className="site-materials-report-foot" style={{ marginTop: '0.9rem', paddingTop: 4, borderTop: '1px solid var(--border)', fontSize: '0.64rem', color: 'var(--text-muted)' }} data-testid="report-foot">{footWords(report)}</div>
    </section>
  )
}

/** One cage, box, pile or the Unsorted row with its lines; the whole block stays on one page. */
function BoxBlock({ box: b, withJob, printedOn }: { box: ReportBox; withJob: boolean; printedOn: string }) {
  return (
    <div className="site-materials-report-box" style={box} data-testid="report-box" aria-label={boxWords(b)}>
      <div style={boxHead}>
        <span>
          <b style={{ fontSize: '0.85rem', letterSpacing: '0.02em' }}>{boxWords(b)}</b>
          {b.where ? <span> · {b.where}</span> : null}
          {withJob ? <span style={{ color: 'var(--text-700)' }}> · {jobWords({ label: b.jobLabel, name: b.jobName })}</span> : null}
        </span>
        {b.code ? <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.66rem', color: 'var(--text-muted)' }}>{b.code}</span> : null}
      </div>
      {/* On a phone the columns size to their words (the fixed widths left Part no room at 375 wide, the live walk 2026-11-04); the print keeps the fixed layout. */}
      <table className="site-materials-report-lines" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        {b.lines.length === 0 ? (
          <tbody>
            <tr><td style={{ ...td, color: 'var(--text-muted)', fontStyle: 'italic', borderBottom: 'none' }} data-testid="report-box-empty">{EMPTY_BOX_WORDS}</td></tr>
          </tbody>
        ) : (
          <>
            <thead>
              <tr>
                <th style={th}>Part</th>
                <th style={{ ...th, ...num, width: 64 }}>On hand</th>
                <th style={{ ...th, width: 52 }}>Unit</th>
                <th style={{ ...th, width: 126 }}>Last recorded</th>
              </tr>
            </thead>
            <tbody>
              {b.lines.map((l, i) => (
                <tr key={l.partKey} data-testid="report-line">
                  <td style={{ ...td, ...(i === b.lines.length - 1 ? { borderBottom: 'none' } : {}) }}>{l.partName}{l.manufacturer ? <span style={{ color: 'var(--text-muted)' }}> · {l.manufacturer}</span> : null}</td>
                  <td style={{ ...td, ...num, ...(i === b.lines.length - 1 ? { borderBottom: 'none' } : {}) }}>{l.onHand}</td>
                  <td style={{ ...td, color: 'var(--text-700)', whiteSpace: 'nowrap', ...(i === b.lines.length - 1 ? { borderBottom: 'none' } : {}) }}>{l.unit ?? ''}</td>
                  <td style={{ ...td, color: 'var(--text-700)', whiteSpace: 'nowrap', ...(i === b.lines.length - 1 ? { borderBottom: 'none' } : {}) }}>{lastRecordedWords(l, printedOn)}</td>
                </tr>
              ))}
            </tbody>
          </>
        )}
      </table>
    </div>
  )
}
