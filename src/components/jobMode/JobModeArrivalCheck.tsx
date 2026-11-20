/**
 * Is it as told? (punch list #382, PR 10): the crew's card on arrival at a stage, in Job Mode. It lists only the
 * bullets on them that nobody of ours has seen. **Yes, all as told** turns each into a yes we saw, in this person's
 * name. A **No** on a bullet opens it again, turns the stage red in the office and tells Dispatch as a stage check.
 * The card asks once a stage, draws nothing when there is nothing to ask, and never stops anyone: the person is
 * clocked in whatever they answer. The database picks the stage and holds the answer (`start_check_arrive`).
 */
import { useCallback, useEffect, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { ARRIVAL_WORDS as W } from '../../lib/startChecks/startChecks'
import { supabaseStartChecksIo, type ArrivalAsk, type StartChecksIo } from '../../lib/startChecks/startChecksIo'
import { formatErrorMessage } from '../../utils/errorHandling'

export function JobModeArrivalCheck({ jobId, io = supabaseStartChecksIo }: { jobId: string; io?: Pick<StartChecksIo, 'readArrival' | 'arrive'> }) {
  const { showToast } = useToastContext()
  const [ask, setAsk] = useState<ArrivalAsk | null>(null)
  const [no, setNo] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const read = useCallback(() => {
    let live = true
    // A read that fails asks nothing: the card is an extra on the way in, never a wall.
    io.readArrival(jobId).then(
      (next) => live && setAsk(next),
      () => live && setAsk(null),
    )
    return () => {
      live = false
    }
  }, [io, jobId])
  useEffect(() => {
    setAsk(null)
    setNo({})
    return read()
  }, [read])

  if (!ask || ask.bullets.length === 0) return null
  const nos = ask.bullets.filter((b) => no[b.id]).map((b) => b.id)

  async function send() {
    if (!ask) return
    setBusy(true)
    try {
      const out = await io.arrive(ask.fixtureId, nos)
      showToast(out.dispatchRequestId ? W.keptNo : W.kept, 'success')
      setNo({})
      setAsk(null)
      read()
    } catch (e) {
      showToast(formatErrorMessage(e, 'That was not kept'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section data-testid="job-mode-arrival-check" data-arrival-stage={ask.fixtureId} aria-label={W.heading} style={{ border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', padding: '0.7rem 0.8rem', display: 'grid', gap: 8 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-strong)' }}>{W.heading}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.lead(ask.name)}</div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {ask.bullets.map((b) => {
          const isNo = !!no[b.id]
          return (
            <li key={b.id} data-arrival-bullet={b.id} data-answer={isNo ? 'no' : 'as-told'} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', border: `1px solid ${isNo ? '#dc2626' : 'var(--border)'}`, borderRadius: 8, padding: '0.45rem 0.6rem' }}>
              <span style={{ flex: '1 1 12rem', minWidth: 0, color: 'var(--text-strong)' }}>{b.words}</span>
              <button
                type="button"
                className="scArrivalNo"
                aria-pressed={isNo}
                aria-label={`${W.no}: ${b.words}`}
                disabled={busy}
                onClick={() => setNo((n) => ({ ...n, [b.id]: !isNo }))}
              >
                {isNo ? W.no : W.asTold}
              </button>
            </li>
          )
        })}
      </ul>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="scArrivalSend" data-no={nos.length ? 'yes' : 'no'} disabled={busy} onClick={() => void send()}>
          {busy ? 'Keeping…' : nos.length ? W.send(nos.length) : W.allYes}
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{W.noGoes}</span>
      </div>
    </section>
  )
}

export default JobModeArrivalCheck
