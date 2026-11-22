/**
 * Is it as told? (punch list #382, PR 10): the crew's card on arrival at a stage, at the head of the job's details in
 * Job Mode. It lists only the bullets on them that nobody of ours has seen. **Yes, all as told** turns each into a yes
 * we saw, in this person's name. A **No** on a bullet opens it again, turns the stage red in the office and tells
 * Dispatch. The card asks once a stage, draws nothing when there is nothing to ask, and never stops anyone. The
 * database picks the stage and holds the answer (`start_check_arrive`).
 *
 * A first read lost to the signal asks nothing and shows nothing: the card is an extra on the way in, never a wall,
 * and most jobs have nothing to ask. It reads again by itself when the phone finds its signal or the page comes back
 * to the front, so a site with no signal at the gate is still asked once it has one. A first read the app refuses is
 * a fault of ours and not of the site, so the card says so with the reason, and offers no Retry (the owner's call D).
 * A later read that fails keeps the card that is up, with the Nos pressed on it.
 *
 * A send that is refused reads again. The card was read before the answer, so a refusal means it is older than the
 * list: one of the crew answered first, or the office changed a bullet. The words say which, and the card then shows
 * what is true now, or leaves. Without that read a second person on the crew kept a card no press could answer.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { ARRIVAL_WORDS as W } from '../../lib/startChecks/arrival'
import { supabaseStartChecksIo, type ArrivalAsk, type StartChecksIo } from '../../lib/startChecks/startChecksIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import OfflineRetryPanel from '../OfflineRetryPanel'

export function JobModeArrivalCheck({ jobId, io = supabaseStartChecksIo }: { jobId: string; io?: Pick<StartChecksIo, 'readArrival' | 'arrive'> }) {
  const { showToast } = useToastContext()
  const [ask, setAsk] = useState<ArrivalAsk | null>(null)
  const [no, setNo] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  /** What this person just answered: the card says so in place of leaving. */
  const [said, setSaid] = useState<{ no: number } | null>(null)
  /** A read the app refused. A read lost to the signal is never kept here: that one stays silent. */
  const [refused, setRefused] = useState<OfflineRecoveryLastError | null>(null)
  const gen = useRef(0)

  const read = useCallback(() => {
    const mine = ++gen.current
    io.readArrival(jobId).then(
      (next) => {
        if (mine !== gen.current) return
        setAsk(next)
        setRefused(null)
      },
      // A read that fails keeps what is drawn: the card after a later one. A refusal is said, a lost signal is not.
      (e) => {
        if (mine !== gen.current) return
        const failure = recoveryFailureFromError(e, W.notRead)
        setRefused(failure.kind === 'server' ? failure : null)
      },
    )
  }, [io, jobId])

  useEffect(() => {
    setAsk(null)
    setNo({})
    setSaid(null)
    setRefused(null)
    read()
    return () => {
      gen.current += 1
    }
  }, [read])

  // Reads again when the signal comes back or the page returns to the front, unless an answer is on its way or in.
  const quiet = busy || said != null
  useEffect(() => {
    if (quiet) return
    const again = () => {
      if (document.visibilityState === 'visible') read()
    }
    window.addEventListener('online', again)
    document.addEventListener('visibilitychange', again)
    return () => {
      window.removeEventListener('online', again)
      document.removeEventListener('visibilitychange', again)
    }
  }, [quiet, read])

  if (said) {
    const tone = said.no ? 'var(--text-amber-800)' : 'var(--text-green-700)'
    return (
      <section data-testid="job-mode-arrival-check" data-arrival-said={said.no ? 'no' : 'yes'} aria-label={W.heading} role="status" style={{ border: `1px solid ${tone}`, borderRadius: 10, background: 'var(--surface)', padding: '0.6rem 0.8rem' }}>
        <div style={{ fontWeight: 700, color: tone }}>{said.no ? W.saidNo(said.no) : W.saidYes}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.either}</div>
      </section>
    )
  }
  if (!ask || ask.bullets.length === 0) {
    // Nothing is drawn to answer. A refused read is said in the card's place: it is ours to mend, and no Retry mends it.
    if (!refused) return null
    return (
      <section data-testid="job-mode-arrival-check" data-arrival-refused="yes" aria-label={W.heading} style={{ border: '1px solid var(--border-strong)', borderRadius: 10, background: 'var(--surface)', padding: '0.7rem 0.8rem', display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-strong)' }}>{W.heading}</div>
        <OfflineRetryPanel failure={refused} onRetry={read} surface="job-mode-arrival" idempotent style={{ margin: 0 }} />
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{W.either}</div>
      </section>
    )
  }
  const nos = ask.bullets.filter((b) => no[b.id]).map((b) => b.id)

  async function send() {
    if (!ask) return
    setBusy(true)
    try {
      await io.arrive(ask.fixtureId, nos)
      gen.current += 1
      setSaid({ no: nos.length })
      setNo({})
      setAsk(null)
    } catch (e) {
      showToast(formatErrorMessage(e, W.notKept), 'error')
      // The card may be older than the list. Read again, so it shows what is true now or leaves.
      read()
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
            <li key={b.id} data-arrival-bullet={b.id} data-answer={isNo ? 'no' : 'as-told'} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${isNo ? '#dc2626' : 'var(--border)'}`, borderRadius: 8, padding: '0.45rem 0.6rem' }}>
              <span style={{ flex: '1 1 auto', minWidth: 0, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{b.words}</span>
              <button type="button" className="scArrivalNo" aria-pressed={isNo} aria-label={`${W.no}: ${b.words}`} disabled={busy} onClick={() => setNo((n) => ({ ...n, [b.id]: !isNo }))}>
                {W.no}
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="scArrivalSend" data-no={nos.length ? 'yes' : 'no'} disabled={busy} onClick={() => void send()}>
        {busy ? W.keeping : nos.length ? W.send(nos.length) : W.allYes}
      </button>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{W.noGoes}</span>
    </section>
  )
}

export default JobModeArrivalCheck
