import { useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../../contexts/ToastContext'
import { AR_CASE_REOPENED, arCaseReopenConfirm, arCaseReopenDrawn, arClosedOthersWords, arClosedTestCases, type ArClosedTestCaseLine } from '../../../lib/jobs/arCaseReopen'
import { reopenArTestCase } from '../../../lib/jobs/arCaseReopenIo'
import type { ArReturnCaseRow } from '../../../lib/jobs/arReturnCase'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { Money } from '../../Money'

/**
 * **Closed test cases**, a folded line in the list of Accounts Receivable (punch list #443, row 5): the take-back
 * of **Close it as settled** and **Close it as not coming**, for a dev on a test job's case. It draws nothing for
 * any other role, and nothing when no closed case is on a test job.
 *
 * Each case reads who paid, the amount, how it was closed and its job, with **Reopen…**. A test case closed for a
 * reason a reopen does not undo has a dead press and says why. Closed cases on real jobs are counted and not listed.
 * The press asks first, in a confirm whose button names the act, then calls `reopenArTestCase`, which reads the
 * cases again and runs the same rule. `onReopened` reads the page again.
 */
export function ArClosedTestCases({ role, allCases, onReopened }: { role: string | null | undefined; /** Every case the page read, closed ones too. */ allCases: ReadonlyArray<ArReturnCaseRow>; onReopened: () => void | Promise<void> }) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [shown, setShown] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const drawn = arCaseReopenDrawn(role)
  const { lines, others } = useMemo(() => (drawn ? arClosedTestCases(allCases) : { lines: [], others: 0 }), [drawn, allCases])
  if (!drawn || lines.length === 0) return null

  const reopen = async (line: ArClosedTestCaseLine) => {
    if (busyId || line.problem) return
    if (!(await confirmDialog(arCaseReopenConfirm(line)))) return
    setBusyId(line.id)
    try {
      await reopenArTestCase(line.id)
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
  return (
    <div data-testid="ar-closed-test-cases" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.75rem', color: 'var(--text-700)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.75rem' }}>
        <b>Closed test cases · {lines.length}</b>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} style={word}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {shown ? (
        <div style={{ padding: '0 0.75rem 0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>Only a developer sees this list. A case reopened here goes back under Came back for everyone.</p>
          {lines.map((line) => {
            const dead = !!line.problem || busyId != null
            return (
              <div key={line.id} data-testid="ar-closed-test-case" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.6rem', alignItems: 'center', padding: '0.3rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <b style={{ color: 'var(--text-strong)' }}>{line.payer}</b> · <Money amount={line.amount} />
                  <span style={{ display: 'block' }}>{line.jobWords}</span>
                  <span style={{ display: 'block', color: 'var(--text-muted)' }}>{line.closedWords}</span>
                  {line.problem ? (
                    <span style={{ display: 'block', color: 'var(--text-muted)' }} data-testid="ar-closed-test-case-why">
                      {line.problem}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void reopen(line)}
                  disabled={dead}
                  aria-label={`Reopen the case of ${line.payer}`}
                  style={line.problem ? { ...word, color: 'var(--text-muted)', textDecoration: 'none', cursor: 'default' } : { ...word, cursor: dead ? 'default' : 'pointer' }}
                >
                  {busyId === line.id ? 'Reopening…' : 'Reopen…'}
                </button>
              </div>
            )
          })}
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
