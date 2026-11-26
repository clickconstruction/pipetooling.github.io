import { useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../../contexts/ToastContext'
import { AR_CASE_REOPENED, arCaseReopenConfirm, arCaseReopenDrawn, arClosedCases, arClosedCasesShown, arClosedOlderLabel, arClosedOthersWords, type ArClosedCaseLine } from '../../../lib/jobs/arCaseReopen'
import { reopenArCase } from '../../../lib/jobs/arCaseReopenIo'
import type { ArReturnCaseRow } from '../../../lib/jobs/arReturnCase'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { Money } from '../../Money'

/**
 * **Closed cases**, a folded line in the list of Accounts Receivable (punch list #443, row 5): the take-back of
 * **Close it as settled** and **Close it as not coming**, for the office (a dev, a master, an assistant, a
 * controller). It draws nothing for any other role, and nothing when no closed case can be reopened.
 *
 * Each case reads who paid, the amount, what kind of case it is (a check that came back, a card dispute, a check
 * never deposited: punch list #443, finding 255), how it was closed and its job, with **Reopen…**. The list shows the cases
 * closed in the last 90 days, newest first, and one press draws the older ones. A case closed by a new payment or
 * by Stripe's answer is counted and not listed. The press asks first, in a confirm whose button names the act,
 * then calls `reopenArCase`, which reads the cases again and runs the same rule. `onReopened` reads the page again.
 */
export function ArClosedCases({ role, allCases, todayYmd, onReopened }: { role: string | null | undefined; /** Every case the page read, closed ones too. */ allCases: ReadonlyArray<ArReturnCaseRow>; /** Today in the app's time zone: the 90 days are counted back from it. */ todayYmd: string; onReopened: () => void | Promise<void> }) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [shown, setShown] = useState(false)
  const [showOlder, setShowOlder] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const drawn = arCaseReopenDrawn(role)
  const { lines, others } = useMemo(() => (drawn ? arClosedCases(allCases, todayYmd) : { lines: [], others: 0 }), [drawn, allCases, todayYmd])
  if (!drawn || lines.length === 0) return null

  const reopen = async (line: ArClosedCaseLine) => {
    if (busyId) return
    if (!(await confirmDialog(arCaseReopenConfirm(line)))) return
    setBusyId(line.id)
    try {
      await reopenArCase(line.id)
      showToast(AR_CASE_REOPENED, 'success')
      await onReopened()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The case was not reopened.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.75rem', border: 'none', background: 'transparent', padding: 0, minHeight: 44, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
  const othersWords = arClosedOthersWords(others)
  const { shown: drawnLines, folded } = arClosedCasesShown(lines, showOlder)
  return (
    <div data-testid="ar-closed-cases" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.75rem', color: 'var(--text-700)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem' }}>
        <b>Closed cases · {lines.length}</b>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} style={word}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {shown ? (
        <div style={{ padding: '0 0.75rem 0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>A case reopened here goes back under Came back for everyone.</p>
          {drawnLines.map((line) => {
            const dead = busyId != null
            return (
              <div key={line.id} data-testid="ar-closed-case" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.6rem', alignItems: 'center', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <b style={{ color: 'var(--text-strong)' }}>{line.payer}</b> · <Money amount={line.amount} />
                  <span data-testid="ar-closed-kind" style={{ display: 'block', fontWeight: 600, color: 'var(--text-700)' }}>{line.kind}</span>
                  {line.jobWords ? <span style={{ display: 'block' }}>{line.jobWords}</span> : null}
                  <span style={{ display: 'block', color: 'var(--text-muted)' }}>{line.closedWords}</span>
                </div>
                <button type="button" onClick={() => void reopen(line)} disabled={dead} aria-label={`Reopen the case of ${line.payer}`} style={{ ...word, cursor: dead ? 'default' : 'pointer' }}>
                  {busyId === line.id ? 'Reopening…' : 'Reopen…'}
                </button>
              </div>
            )
          })}
          {folded > 0 ? (
            <button type="button" onClick={() => setShowOlder(true)} data-testid="ar-closed-older" style={word}>
              {arClosedOlderLabel(folded)}
            </button>
          ) : null}
          {othersWords ? (
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)' }} data-testid="ar-closed-others">
              {othersWords}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
