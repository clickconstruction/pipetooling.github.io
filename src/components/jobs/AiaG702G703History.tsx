import type { CSSProperties } from 'react'
import { formatAiaDate } from '../../lib/aiaG702G703Template'
import { formatAiaMoney } from '../../lib/aiaG702G703Preview'
import { type SavedPayApplication, carryMismatch } from '../../lib/aiaPayApplications'
import {
  type PayApplicationHistory,
  type PayApplicationSummary,
  changedAfterWentOut,
  changedAfterWords,
  payApplicationDay,
  payApplicationDeletedWords,
  payApplicationDayTime,
  payApplicationFileName,
  payApplicationSavedWords,
  payApplicationSummaryWords,
  payApplicationWentOutWords,
} from '../../lib/aiaPayApplicationHistory'
import type { SentCopy } from '../../lib/sent/sentCopies'
import { openSentFile } from '../../lib/sent/sentCopiesIo'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * The first frame of the AIA G702-G703 window on a job with saved applications (v2.4710):
 * where the job stands against the contract, then one line per application with its stops
 * — who saved it and when, each workbook that went out — and the door to the next
 * application. Open on a line puts that application in the form; New application starts the
 * next one from the last saved; Put it back on a deleted line returns it to the job (#92).
 */

const eyebrow: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
const quietButton: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const fileButton: CSSProperties = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-blue-700)', textDecoration: 'underline' }
const summaryCell: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.05rem', minWidth: 0 }
const summaryKey: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }
const summaryValue: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)' }

function Summary({ summary }: { summary: PayApplicationSummary }) {
  const pct = Math.round(summary.fractionComplete * 100)
  const heldShare = summary.contractSumToDate > 0 ? Math.max(0, Math.min(1, summary.retainageHeld / summary.contractSumToDate)) : 0
  const paidShare = Math.max(0, summary.fractionComplete - heldShare)
  return (
    <div data-testid="aia-history-summary" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.25rem 1rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-muted)' }}>
        <div style={summaryCell}>
          <span style={summaryKey}>CONTRACT TO DATE</span>
          <span style={summaryValue}>{formatAiaMoney(summary.contractSumToDate)}</span>
        </div>
        <div style={summaryCell}>
          <span style={summaryKey}>COMPLETED AND STORED</span>
          <span style={summaryValue}>
            {formatAiaMoney(summary.totalCompletedAndStored)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{pct}%</span>
          </span>
        </div>
        <div style={summaryCell}>
          <span style={summaryKey}>HELD AS RETAINAGE</span>
          <span style={summaryValue}>{formatAiaMoney(summary.retainageHeld)}</span>
        </div>
        <div style={summaryCell}>
          <span style={summaryKey}>WORK LEFT</span>
          <span style={summaryValue}>{formatAiaMoney(summary.workLeft)}</span>
        </div>
      </div>
      <div
        role="img"
        aria-label={`${pct}% of the contract completed; ${formatAiaMoney(summary.retainageHeld)} of it held as retainage`}
        style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', background: 'var(--border)' }}
      >
        <span style={{ display: 'block', height: '100%', width: `${paidShare * 100}%`, background: '#16a34a' }} />
        <span style={{ display: 'block', height: '100%', width: `${heldShare * 100}%`, background: 'var(--border-amber)' }} />
      </div>
    </div>
  )
}

export default function AiaG702G703History({
  history,
  nextNumber,
  onOpen,
  onNew,
  onRestore,
  restoringId = null,
}: {
  history: PayApplicationHistory
  nextNumber: number
  onOpen: (app: SavedPayApplication) => void
  onNew: () => void
  onRestore: (app: SavedPayApplication) => void
  /** The deleted application being put back, while the write is in flight. */
  restoringId?: string | null
}) {
  const { showToast } = useToastContext()
  const apps = history.lines.filter((l) => !l.deleted).map((l) => l.app)
  const last = apps.length > 0 ? apps[apps.length - 1]! : null

  const openFile = async (copy: SentCopy) => {
    if (!copy.copyPath) return
    if (!(await openSentFile(copy.copyPath))) showToast('Could not open the workbook.', 'error')
  }

  const wentOutLine = (copy: SentCopy) => {
    const file = payApplicationFileName(copy)
    return (
      <div key={copy.id} data-testid="aia-history-went-out" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.5rem', alignItems: 'baseline', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
        <span>{payApplicationWentOutWords(copy, payApplicationDayTime)}</span>
        {copy.copyPath ? (
          <span>
            as{' '}
            <button type="button" onClick={() => void openFile(copy)} style={fileButton} title="Download the workbook as it went out">
              {file || 'the workbook'}
            </button>
          </span>
        ) : (
          <span style={{ color: 'var(--text-amber-800)' }}>The copy was not kept.</span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={eyebrow}>THIS JOB&apos;S PAY APPLICATIONS</span>
        {history.summary ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{payApplicationSummaryWords(history.summary)}</span> : null}
      </div>

      {history.summary ? <Summary summary={history.summary} /> : <p style={{ ...muted, margin: 0 }}>Nothing is saved on this job yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {history.lines.map(({ app, wentOut, deleted }) => {
          if (deleted) {
            // Taken off the job (v2.4715): a quiet line with what it asked for, who deleted it, and its workbooks.
            return (
              <div key={app.id} data-testid="aia-history-deleted" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem' }}>
                    <strong>{app.applicationNumber}</strong>
                    {app.name ? <span> · {app.name}</span> : null}
                    <span> · {app.periodTo ? `period to ${formatAiaDate(app.periodTo)}` : 'no period typed'} · deleted</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatAiaMoney(app.currentPaymentDue)} due</span>
                  <button
                    type="button"
                    onClick={() => onRestore(app)}
                    disabled={restoringId != null}
                    style={{ ...quietButton, cursor: restoringId != null ? 'wait' : 'pointer' }}
                    aria-label={`Put application ${app.applicationNumber} back`}
                  >
                    {restoringId === app.id ? 'Putting back…' : 'Put it back'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.6rem', borderLeft: '2px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8125rem' }}>{payApplicationDeletedWords(app, payApplicationDay) || 'Deleted'}</span>
                  {wentOut.map(wentOutLine)}
                </div>
              </div>
            )
          }
          const mismatch = carryMismatch({ values: app.fields, lines: app.lines }, app.applicationNumber, apps)
          const saved = payApplicationSavedWords(app, payApplicationDay)
          const changed = changedAfterWentOut(app, wentOut)
          return (
            <div key={app.id} data-testid="aia-history-line" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
                  <strong>{app.applicationNumber}</strong>
                  {app.name ? <span style={{ color: 'var(--text-600)' }}> · {app.name}</span> : null}
                  <span style={{ color: 'var(--text-600)' }}> · {app.periodTo ? `period to ${formatAiaDate(app.periodTo)}` : 'no period typed'}</span>
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{formatAiaMoney(app.currentPaymentDue)} due</span>
                <button type="button" onClick={() => onOpen(app)} style={quietButton} aria-label={`Open application ${app.applicationNumber}`}>
                  Open
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.6rem', borderLeft: '2px solid var(--border)' }}>
                {saved ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{saved}</span> : null}
                {wentOut.length > 0 ? wentOut.map(wentOutLine) : <span style={muted}>Not downloaded yet.</span>}
                {changed ? (
                  <span data-testid="aia-history-changed" style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                    ⚠ {changedAfterWords(changed, payApplicationDay)}. The GC has the {payApplicationDay(changed.copy.sentAt)} workbook. Generate it again to send the change, or open it and put the amounts back.
                  </span>
                ) : null}
                {mismatch ? (
                  <span data-testid="aia-history-flag" style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                    ⚠ No longer matches application {mismatch.previousNumber}. {app.carryReason ? `Kept as it is: ${app.carryReason}` : 'No reason given yet.'}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
        {history.unsaved.length > 0 ? (
          <div data-testid="aia-history-unsaved" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-600)' }}>Downloaded with no number typed, so saved on no application:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.6rem', borderLeft: '2px solid var(--border)' }}>{history.unsaved.map(wentOutLine)}</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={onNew}
          style={{ padding: '0.5rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
        >
          New application · {nextNumber}
        </button>
        {last ? <span style={muted}>Starts from application {last.applicationNumber} as it is saved now.</span> : null}
      </div>
    </div>
  )
}
