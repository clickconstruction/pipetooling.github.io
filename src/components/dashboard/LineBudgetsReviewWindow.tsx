import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { countedLabel } from '../../lib/batchWords'
import { lineBudgetsReviewSettledWords, lineBudgetsReviewTitle, reviewLineWords, type LineBudgetsReview } from '../../lib/needsYou/lineBudgetsReview'
import { lineBudgetsReviewIo, type LineBudgetsReviewIo } from '../../lib/needsYou/lineBudgetsReviewIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

/**
 * Budgets to tune (punch list #234, PR 1c): the window behind the owner's Needs you line, once a
 * week — the assumed lines on the projects awarded this week, one row each with the job, the line,
 * its price and the company split it reads; *Looks right · stamp 4* stamps them reviewed with his
 * name and leaves them assumed; *Tune* opens the first project's job window, where the sliders are.
 */
type Props = {
  review: LineBudgetsReview
  onClose: () => void
  /** The line re-reads after a stamp. */
  onChanged: () => void
  io?: LineBudgetsReviewIo
}

const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '0.45rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.86rem' }
const btn = (primary: boolean, dead: boolean): CSSProperties => ({ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, borderRadius: 6, cursor: dead ? 'default' : 'pointer', border: `1px solid ${primary && !dead ? '#2563eb' : 'var(--border-strong)'}`, background: dead ? DEAD_PRESS_FILL : primary ? '#2563eb' : 'var(--surface)', color: dead ? DEAD_PRESS_TEXT : primary ? '#fff' : 'inherit' })

export function LineBudgetsReviewWindow({ review: opened, onClose, onChanged, io = lineBudgetsReviewIo }: Props) {
  // The window keeps the review it opened on: the stamp makes the line re-read, and the re-read (no assumed
  // lines left) must not redraw this window as "The other 1 line on these 0 projects" (the first walk's slip 1).
  const [review] = useState(opened)
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const [stamped, setStamped] = useState<number | null>(null)
  const n = review.lines.length

  const stamp = async () => {
    if (busy || n === 0) return
    setBusy(true)
    try {
      const count = await io.stamp(review.lines.map((l) => l.fixtureId))
      setStamped(count)
      showToast(count === 1 ? '1 line stamped reviewed, left assumed.' : `${count} lines stamped reviewed, left assumed.`, 'success')
      onChanged()
    } catch (e) {
      showToast(`Could not stamp the lines: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  const tune = () => {
    const first = review.jobIds[0]
    onClose()
    if (first) navigate(`/jobs?tab=stages&edit=${encodeURIComponent(first)}`)
  }

  return (
    <ResponsiveModalShell title="Budgets to tune · this week" onRequestClose={onClose} maxWidthDesktop={620}>
      <div style={{ display: 'grid', gap: 10, padding: '0.25rem 0 0.5rem' }} data-testid="line-budgets-review-window">
        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
          {stamped != null ? `${stamped} ${stamped === 1 ? 'line' : 'lines'} stamped reviewed with your name. Each still reads the company split.` : `${lineBudgetsReviewTitle(review)}. Each reads the company split for its kind. Nothing here reaches a customer.`}
        </div>
        {stamped == null ? (
          <div>
            {review.lines.map((l) => (
              <div key={l.fixtureId} style={row} data-testid="line-budgets-review-row">
                <span>{reviewLineWords(l)}</span>
              </div>
            ))}
          </div>
        ) : null}
        {lineBudgetsReviewSettledWords(review) ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lineBudgetsReviewSettledWords(review)}</div> : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          {stamped == null ? (
            <button type="button" disabled={busy || n === 0} onClick={() => void stamp()} style={btn(true, busy || n === 0)} data-testid="line-budgets-looks-right">
              {countedLabel('Looks right · stamp', n, ['line', 'lines'])}
            </button>
          ) : null}
          <button type="button" onClick={tune} style={btn(false, false)} data-testid="line-budgets-tune">
            Tune
          </button>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.86rem' }}>
            {stamped != null ? 'Done' : 'Later'}
          </button>
        </div>
      </div>
    </ResponsiveModalShell>
  )
}

export default LineBudgetsReviewWindow
