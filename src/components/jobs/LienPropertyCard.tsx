import { useEffect, type CSSProperties } from 'react'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { splitLienJobLabel } from '../../lib/jobs/lienJobLabel'
import { lienPropertyCardHead, lienPropertyPublicLine, lienPropertySameOwnerWords, type LienPropertyTone } from '../../lib/jobs/lienPropertyCard'
import { lienPropertyJobsWords, type LienProperty, type LienPropertyJobLine } from '../../lib/jobs/lienPropertyPapers'
import { LienJobNumber } from './LienJobNumber'

/**
 * The property card (v2.7488): one property whole. Every job at one property record, each on one row with where its
 * notice and its affidavit stand and what it still owes, under two lines that count them: the notices, then the lien
 * affidavits, each kind apart. Opened from wherever a
 * property is named: a By job row, the run's envelope line, the address `?property=<record id>`.
 *
 * The card has no verbs and reads nothing: the desk hands it the property out of By job's book
 * (`lienPropertyOf`), so its words are the book's and the Board's. A row's two papers are presses that open that
 * paper where the desk already opens it.
 */
export type LienPropertyCardProps = {
  /** The property, or null while the book is being read or when no job in the book stands on the record. */
  property: LienProperty | null
  loading: boolean
  error: string
  onClose: () => void
  /** Open one job's notice or affidavit where the desk opens it. */
  onOpenPaper: (jobId: string, kind: 'notice' | 'affidavit') => void
  /** A row's number opens the job itself. */
  onOpenJob?: (jobId: string) => void
  /** The quiet line under the list: the owner's other property. */
  onOpenProperty: (addressId: string) => void
  /** The job the card was opened from, marked in the list. */
  fromJobId?: string | null
  phone?: boolean
  zIndex?: number
}

const TONE: Record<LienPropertyTone, string> = {
  done: 'var(--text-green-700)',
  going: 'var(--text-blue-700)',
  waits: 'var(--text-amber-800)',
  stop: 'var(--text-red-600)',
  quiet: 'var(--text-muted)',
}

const cellPress: CSSProperties = { display: 'grid', gap: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }
const colHead: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const aside: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

function Paper({ label, words, asideWords, tone, onOpen, testId, phone }: { label: string; words: string; asideWords: string; tone: LienPropertyTone; onOpen: (() => void) | null; testId: string; phone: boolean }) {
  const body = (
    <>
      <span style={{ fontWeight: 600, color: TONE[tone] }}>
        {phone ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{label}: </span> : null}
        {words || '—'}
      </span>
      {asideWords ? <span style={aside}>{asideWords}</span> : null}
    </>
  )
  if (!onOpen || !words) return <span style={{ display: 'grid', gap: 1, minWidth: 0 }} data-testid={testId}>{body}</span>
  return (
    <button type="button" style={{ ...cellPress, ...(phone ? { minHeight: 44, alignContent: 'center' } : null) }} onClick={onOpen} data-testid={testId} title={`Open this job’s ${label.toLowerCase()}`}>
      {body}
    </button>
  )
}

export default function LienPropertyCard({ property, loading, error, onClose, onOpenPaper, onOpenJob, onOpenProperty, fromJobId = null, phone = false, zIndex = 805 }: LienPropertyCardProps) {
  // Escape closes the card when it is the window on top, and only the card: a window under it keeps its own Escape.
  const isTopmost = useModalStackEntry()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTopmost()) return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, isTopmost])

  const head = property ? lienPropertyCardHead(property) : null
  const publicLine = property ? lienPropertyPublicLine(property.publicStanding) : ''
  const cols = 'minmax(0, 1.5fr) 4.5rem minmax(0, 1.5fr) minmax(0, 1.5fr) 5.5rem'
  const row = (l: LienPropertyJobLine) => {
    const label = splitLienJobLabel(l.label)
    const from = l.jobId === fromJobId
    const job = (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {onOpenJob ? <LienJobNumber number={label.number} onOpen={() => onOpenJob(l.jobId)} /> : null}
        <span style={{ minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{onOpenJob ? label.name || l.label : l.label}</span>
      </span>
    )
    const notice = <Paper label="Notice" words={l.notice.words} asideWords={l.notice.aside} tone={head!.tones[l.jobId]!.notice} onOpen={l.notice.state === 'none_needed' ? null : () => onOpenPaper(l.jobId, 'notice')} testId={`lien-property-notice-${l.jobId}`} phone={phone} />
    const affidavit = <Paper label="Affidavit" words={l.affidavit.words} asideWords={l.affidavit.aside} tone={head!.tones[l.jobId]!.affidavit} onOpen={() => onOpenPaper(l.jobId, 'affidavit')} testId={`lien-property-affidavit-${l.jobId}`} phone={phone} />
    const open = <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: phone ? 'left' : 'right' }}>{formatUsdNoCents(l.openBalance)}</span>
    const mark: CSSProperties = from ? { background: 'var(--bg-subtle)' } : {}
    if (phone) {
      return (
        <div key={l.jobId} role="row" data-lien-property-row={l.jobId} data-from={from ? 'true' : undefined} style={{ display: 'grid', gap: '0.2rem', padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.875rem', ...mark }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
            {job}
            {open}
          </span>
          {l.months ? <span style={aside}>{l.months}</span> : null}
          {notice}
          {affidavit}
        </div>
      )
    }
    return (
      <div key={l.jobId} role="row" data-lien-property-row={l.jobId} data-from={from ? 'true' : undefined} style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 0.8rem', alignItems: 'start', padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', ...mark }}>
        {job}
        <span style={{ color: 'var(--text-muted)' }}>{l.months || '—'}</span>
        {notice}
        {affidavit}
        {open}
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={head ? `Every job at ${head.title}` : 'Every job at this property'}
      data-testid="lien-property-card"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: phone ? 'stretch' : 'center', justifyContent: 'center', zIndex }}
    >
      <div style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: phone ? 0 : 10, width: phone ? '100%' : 'min(860px, calc(100vw - 2rem))', maxHeight: phone ? 'none' : 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem 0.65rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }} data-testid="lien-property-title">
              {head ? head.title : 'This property'}
            </h2>
            {head?.sub ? <div style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{head.sub}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: 6, cursor: 'pointer', font: 'inherit', fontSize: phone ? '0.875rem' : '0.8125rem', fontWeight: 600, padding: phone ? '0 14px' : '0.3rem 0.8rem', minHeight: phone ? 44 : undefined }}>
            Close
          </button>
        </div>
        <div style={{ overflow: 'auto', minHeight: 0 }}>
          {error ? (
            <p role="alert" style={{ margin: 0, padding: '0.9rem 1rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
              The jobs at this property could not be read: {error}
            </p>
          ) : !property ? (
            <p style={{ margin: 0, padding: '0.9rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="lien-property-waiting">
              {loading ? 'Reading every job at this property…' : 'Nothing waiting on this property. No job on the Lien desk stands on it.'}
            </p>
          ) : (
            <>
              <div style={{ padding: '0.65rem 1rem', fontSize: '0.8125rem', display: 'grid', gap: '0.2rem' }} data-testid="lien-property-tally">
                <span>
                  <strong>{lienPropertyJobsWords(property.jobs.length)}</strong> · {formatUsdNoCents(property.openBalance)} open
                </span>
                {/* Each kind of paper on its own line: a count of liens is never read as a count of notices. */}
                {property.tallies.notices ? <span data-testid="lien-property-tally-notices">{property.tallies.notices}</span> : null}
                {property.tallies.affidavits ? <span data-testid="lien-property-tally-affidavits">{property.tallies.affidavits}</span> : null}
              </div>
              {publicLine ? (
                <p style={{ margin: 0, padding: '0 1rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)' }} data-testid="lien-property-public">
                  {publicLine}
                </p>
              ) : null}
              <div role="table" aria-label="The jobs at this property">
                {phone ? null : (
                  <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 0.8rem', padding: '0.3rem 1rem' }}>
                    <span style={colHead}>Job</span>
                    <span style={colHead}>Months</span>
                    <span style={colHead}>Notice</span>
                    <span style={colHead}>Affidavit</span>
                    <span style={{ ...colHead, textAlign: 'right' }}>Open</span>
                  </div>
                )}
                {property.jobs.map(row)}
              </div>
              {property.sameOwner.length ? (
                <div style={{ padding: '0.65rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem', alignItems: 'center' }} data-testid="lien-property-same-owner">
                  <span>Same owner also at</span>
                  {property.sameOwner.map((o) => (
                    <button key={o.addressId} type="button" onClick={() => onOpenProperty(o.addressId)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-blue-700)', cursor: 'pointer', minHeight: phone ? 44 : undefined }}>
                      {lienPropertySameOwnerWords(o)} ›
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
