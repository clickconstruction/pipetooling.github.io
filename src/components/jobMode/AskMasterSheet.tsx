import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { noteTagsChanged, notifyNoteTag, postTaggedNote } from '../../lib/jobs/noteTagsIo'
import type { TaggablePerson } from '../../lib/jobs/noteTags'
import { ASK_MASTER_WORDS, askMasterFactsLine, askMasterNoteBody, askMasterQuickQuestions, askMasterReady, mastersToAsk, type AskMasterFacts } from '../../lib/jobMode/askMaster'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { PhoneSheet } from '../PhoneSheet'
import OfflineRetryPanel from '../OfflineRetryPanel'
import AutosizeTextarea from '../AutosizeTextarea'

/**
 * Ask a master (punch list #396, PR 2): the pace card's window for a question to the master on the job. Quick
 * questions as chips, a box to type in, and the card's numbers, which ride with the note so the master reads
 * what the superintendent was looking at.
 *
 * It posts a job note that tags the master, through `job_note_post_tagged` (punch list #363). Nothing here is
 * a new kind of record: the note waits on the master, and the answer comes back under **You asked**.
 * `lib/jobMode/askMaster.ts` holds who is asked and every word.
 */

const CHIP: CSSProperties = { minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }
// The whole border is restated. A chip that only added a border colour would lose its edge's colour when it is unpicked.
const CHIP_ON: CSSProperties = { ...CHIP, border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', fontWeight: 700 }
const MUTED: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }

export function AskMasterSheet({ jobId, facts, onClose, onSent }: { jobId: string; facts: AskMasterFacts; onClose: () => void; onSent?: () => void }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [people, setPeople] = useState<TaggablePerson[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tick, setTick] = useState(0)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retry = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    setReading(true)
    void supabase.rpc('job_note_taggable', { p_job_id: jobId }).then(({ data, error: err }) => {
      if (!alive) return
      setReading(false)
      if (err) {
        setFailure(recoveryFailureFromError(err, 'The people on this job could not be read.'))
        return
      }
      setFailure(null)
      setPeople((data ?? []).map((r) => ({ userId: r.user_id, name: r.name, role: r.role, onJob: r.on_job })))
    })
    return () => {
      alive = false
    }
  }, [jobId, tick])

  const masters = useMemo(() => (people ? mastersToAsk(people, user?.id) : []), [people, user?.id])
  const to = masters.find((m) => m.userId === pickedId) ?? masters[0] ?? null
  const factsLine = askMasterFactsLine(facts)
  const ready = askMasterReady(question, to) && !busy

  const send = async () => {
    if (!to || !askMasterReady(question, to) || busy) return
    setBusy(true)
    setError(null)
    try {
      const noteId = await postTaggedNote(jobId, askMasterNoteBody(question, facts), [to.userId])
      notifyNoteTag({ noteId })
      noteTagsChanged()
      showToast(ASK_MASTER_WORDS.sent(to.name), 'success')
      onSent?.()
      onClose()
    } catch (e) {
      setError(formatErrorMessage(e, ASK_MASTER_WORDS.failed))
      setBusy(false)
    }
  }

  return (
    <PhoneSheet label={ASK_MASTER_WORDS.label} title={ASK_MASTER_WORDS.title} width={440} zIndex={1100} dataAttrs={{ 'data-ask-master': '' }} onClose={onClose}>
      <div style={{ overflowY: 'auto', minHeight: 0, padding: '0.5rem 1rem 1rem', display: 'grid', gap: '0.75rem' }}>
        {failure && !people ? (
          <OfflineRetryPanel failure={failure} onRetry={retry} surface="ask-master" idempotent busy={reading} />
        ) : !people ? (
          <p role="status" style={{ ...MUTED, margin: 0 }}>{ASK_MASTER_WORDS.reading}</p>
        ) : !to ? (
          <p role="status" data-testid="ask-master-nobody" style={{ margin: 0, fontSize: '0.9375rem' }}>{ASK_MASTER_WORDS.nobody}</p>
        ) : (
          <>
            {masters.length > 1 ? (
              <div role="group" aria-label={ASK_MASTER_WORDS.toLead} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={MUTED}>{ASK_MASTER_WORDS.toLead}</span>
                {masters.map((m) => (
                  <button key={m.userId} type="button" data-testid="ask-master-to" aria-pressed={m.userId === to.userId} onClick={() => setPickedId(m.userId)} style={m.userId === to.userId ? CHIP_ON : CHIP}>
                    {m.name}
                  </button>
                ))}
              </div>
            ) : (
              <div style={MUTED} data-testid="ask-master-to-one">{ASK_MASTER_WORDS.toLead} {to.name}</div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {askMasterQuickQuestions(facts).map((q) => (
                <button key={q} type="button" data-testid="ask-master-quick" onClick={() => setQuestion(q)} style={CHIP}>
                  {q}
                </button>
              ))}
            </div>
            <AutosizeTextarea
              id="ask-master-question"
              aria-label={ASK_MASTER_WORDS.boxLabel}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={ASK_MASTER_WORDS.placeholder}
              minRows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '1rem' }}
            />
            {factsLine ? <div style={MUTED} data-testid="ask-master-facts">{ASK_MASTER_WORDS.sentWith} {factsLine}</div> : null}
            {error ? <p role="alert" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
            <button
              type="button"
              data-testid="ask-master-send"
              disabled={!ready}
              onClick={() => void send()}
              style={{ minHeight: PHONE_PRESS_MIN_HEIGHT, borderRadius: 8, border: 'none', font: 'inherit', fontWeight: 700, fontSize: '0.95rem', cursor: ready ? 'pointer' : 'default', ...(ready ? { background: '#2563eb', color: '#fff' } : { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT }) }}
            >
              {busy ? ASK_MASTER_WORDS.sending : ASK_MASTER_WORDS.send(to.name)}
            </button>
          </>
        )}
      </div>
    </PhoneSheet>
  )
}

export default AskMasterSheet
