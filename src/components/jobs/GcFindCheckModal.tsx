import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { buildGcChecksReport, checkAppliedSentence, checkHeadline, checkMoveWords, findChecks, formatYmdLong, formatYmdShort, type GcCheck } from '../../lib/jobs/gcChecksApplied'
import { fetchGcChecksInputs, type GcChecksInputs } from '../../lib/jobs/gcChecksAppliedIo'
import { addDaysYmd } from '../../lib/emailSchedule/emailScheduleWeek'
import { todayYmdChicago } from '../../lib/formatJobDetailModalDateYmd'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { buildGcChecksAppliedCsv, buildGcChecksAppliedReportHtml, gcChecksCsvFileName } from '../../lib/jobsDocuments/gcChecksAppliedReport'

type Props = {
  gcId: string
  gcName: string
  onClose: () => void
}

/** How many of the newest checks show before anything is typed. */
const NEWEST_SHOWN = 5
/** The sheet's default period: the last twelve months, since a bookkeeper reconciles a year at a time. */
const SHEET_DAYS = 365

const headerButtonStyle = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' } as const

/**
 * Find a check (v2.4046, "Where the checks went" PR 3): the GC is on the
 * phone — "what did you put #48211 against?" Type the number, the amount or
 * the day; the answer is the check's current home, one line per job, then
 * the moves that got it there. Before anything is typed, the newest checks.
 * The sheet (v2.4050) prints or downloads the same facts for the period —
 * every payment, where it sits now, what moved, what is not yet on a bill,
 * and where each job stands.
 */
export default function GcFindCheckModal({ gcId, gcName, onClose }: Props) {
  const [inputs, setInputs] = useState<GcChecksInputs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [everything, setEverything] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const todayYmd = useMemo(() => todayYmdChicago(), [])
  const sinceYmd = everything ? null : addDaysYmd(todayYmd, -SHEET_DAYS)

  useEffect(() => {
    let cancelled = false
    setInputs(null)
    setError(null)
    fetchGcChecksInputs(gcId)
      .then((r) => {
        if (!cancelled) setInputs(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read the payments')
      })
    return () => {
      cancelled = true
    }
  }, [gcId])

  // The search reads every payment on record; the sheet reads the period.
  const report = useMemo(() => (inputs ? buildGcChecksReport({ gcId, ...inputs }) : null), [gcId, inputs])
  const sheet = useMemo(() => (inputs ? buildGcChecksReport({ gcId, ...inputs, sinceYmd }) : null), [gcId, inputs, sinceYmd])

  function printSheet() {
    if (!sheet) return
    const ok = openHtmlPrintWindow(buildGcChecksAppliedReportHtml(gcName, sheet, { asOfYmd: todayYmd }))
    setNote(ok ? null : 'The browser blocked the print window — allow pop-ups for this site and try again.')
  }

  function downloadCsv() {
    if (!sheet) return
    const blob = new Blob([`\uFEFF${buildGcChecksAppliedCsv(sheet)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = gcChecksCsvFileName(gcName, todayYmd)
    a.click()
    URL.revokeObjectURL(url)
    setNote(null)
  }
  const trimmed = query.trim()
  const results: GcCheck[] = useMemo(() => {
    if (!report) return []
    return trimmed ? findChecks(report.checks, trimmed) : report.checks.slice(0, NEWEST_SHOWN)
  }, [report, trimmed])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Find a check — ${gcName}`}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 764, paddingTop: 'var(--app-top-chrome, 0px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(680px, 94vw)', maxHeight: 'min(88vh, 100%)', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
      >
        <div style={{ padding: '0.85rem 1.1rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700 }}>Find a check — {gcName}</span>
            {report ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {report.checks.length} payment{report.checks.length === 1 ? '' : 's'} on record · ${formatCurrency(report.summary.received)}
              </span>
            ) : null}
            <button type="button" onClick={onClose} aria-label="Close Find a check" style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
              ✕
            </button>
          </div>
          <input
            id="gc-find-check-query"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Check number, amount or the day it was received"
            aria-label="Check number, amount or the day it was received"
            style={{ marginTop: '0.55rem', width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: '0.9375rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
          />
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            The answer is where the check sits now, one line per job, then how it got there. An amount finds a check recorded without its number.
          </p>
          {sheet ? (
            <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ flex: '1 1 14rem', minWidth: 0 }}>
                The sheet: {sheet.checks.length} payment{sheet.checks.length === 1 ? '' : 's'}{sheet.sinceYmd ? ` since ${formatYmdLong(sheet.sinceYmd)}` : ' on record'} · ${formatCurrency(sheet.summary.received)}
                {sheet.earlierCount > 0 ? (
                  <>
                    {' · '}
                    <button type="button" onClick={() => setEverything(true)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}>
                      show all {sheet.checks.length + sheet.earlierCount}
                    </button>
                  </>
                ) : everything ? (
                  <>
                    {' · '}
                    <button type="button" onClick={() => setEverything(false)} style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}>
                      last 12 months
                    </button>
                  </>
                ) : null}
              </span>
              <button type="button" onClick={printSheet} title="Print the sheet — every payment in the period, where it sits now, what moved, what is not yet on a bill, and where each job stands" style={headerButtonStyle}>
                🖨 Print the sheet
              </button>
              <button type="button" onClick={downloadCsv} title="The same rows as a CSV, one per applied line, for the bookkeeper's spreadsheet" style={headerButtonStyle}>
                CSV
              </button>
            </div>
          ) : null}
          {note ? <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{note}</p> : null}
        </div>

        <div style={{ overflowY: 'auto', padding: '0.6rem 1.1rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {error ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p>
          ) : !report ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading {gcName}'s payments…</p>
          ) : report.checks.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No payments from {gcName} on record.</p>
          ) : (
            <>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {trimmed ? `${results.length} match${results.length === 1 ? '' : 'es'}` : `Newest ${Math.min(NEWEST_SHOWN, report.checks.length)} of ${report.checks.length}`}
              </div>
              {trimmed && results.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  No check matches “{trimmed}”. Try the amount, or the day it was received — a check recorded without its number is found that way.
                </p>
              ) : null}
              {results.map((c) => (
                <div key={c.key} data-testid="gc-found-check" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 600 }}>
                    {checkHeadline(c)}
                    {c.noNumber ? (
                      <span title="Recorded without its number — add it on Edit Job → Payments received" style={{ marginLeft: '0.5rem', padding: '0.05rem 0.4rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 9999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
                        no number
                      </span>
                    ) : null}
                  </div>
                  <div>{checkAppliedSentence(c)}</div>
                  {c.wasOn.length > 0 ? (
                    <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {c.wasOn.map((m, i) => (
                        <div key={i}>{checkMoveWords(m)}</div>
                      ))}
                      {c.receivedYmd ? <div>Recorded {formatYmdShort(c.receivedYmd)}</div> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
