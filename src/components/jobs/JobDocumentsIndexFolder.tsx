import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { HELD_SHOWN, INDEX_FOLDER_WORDS, addRound, emptyTally, hasRetryableHeld, heldLineWords, indexedWords, indexingWords, moreHeldWords, wantsAnotherRound, type IndexJobTally } from '../../lib/jobs/jobIndexFolder'
import { supabaseJobIndexFolderIo, type JobIndexFolderIo } from '../../lib/jobs/jobIndexFolderIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { documentsQuietButton } from './jobDocumentsStyles'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const linkPress: CSSProperties = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem' }

type State = { kind: 'idle' } | { kind: 'running'; tally: IndexJobTally } | { kind: 'done'; tally: IndexJobTally } | { kind: 'failed'; reason: string; tally: IndexJobTally }

/**
 * Index this job's files (punch list #240, PR 1, v2.6319): one press under the job window's folder listing that reads
 * the words inside the job's Drive files into our own index, through `drive-link`'s `index_job`, forty files a round
 * until none remain, with the count as it goes. Done, it says what was indexed and lists what was held with the reason;
 * a slow or failed read offers a second try. A refusal shows its reason with Try again. Nothing drawn for a job with no
 * folder links: the Job folders section above says so.
 */
export function JobDocumentsIndexFolder({ job, io = supabaseJobIndexFolderIo }: { job: { id: string; google_drive_link: string | null; job_pictures_link: string | null; job_plans_link: string | null }; io?: JobIndexFolderIo }) {
  const linked = Boolean(job.google_drive_link || job.job_pictures_link || job.job_plans_link)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const run = async (retry: boolean) => {
    let tally = emptyTally()
    setState({ kind: 'running', tally })
    try {
      do {
        const answer = await io.indexJob(job.id, retry && tally.rounds === 0)
        tally = addRound(tally, answer)
        if (!live.current) return
        setState({ kind: 'running', tally })
      } while (wantsAnotherRound(tally))
      if (live.current) setState({ kind: 'done', tally })
    } catch (e) {
      if (live.current) setState({ kind: 'failed', reason: formatErrorMessage(e, INDEX_FOLDER_WORDS.failed), tally })
    }
  }

  if (!linked) return null
  const busy = state.kind === 'running'
  return (
    <div data-job-index-folder={state.kind} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...documentsQuietButton, ...(busy ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } : {}) }}
          disabled={busy}
          onClick={() => void run(false)}
        >
          {busy ? INDEX_FOLDER_WORDS.busy : INDEX_FOLDER_WORDS.button}
        </button>
        <span style={muted}>{INDEX_FOLDER_WORDS.hint}</span>
      </div>
      {state.kind === 'running' ? (
        <p style={muted} aria-live="polite">
          {indexingWords(state.tally)}
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <p style={{ ...muted, color: 'var(--text-red-700)' }} role="alert">
          {INDEX_FOLDER_WORDS.failed} {state.reason}{' '}
          <button type="button" style={linkPress} onClick={() => void run(false)}>
            {INDEX_FOLDER_WORDS.tryAgain}
          </button>
        </p>
      ) : null}
      {state.kind === 'done' ? (
        <div data-job-index-done="" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <p style={{ ...muted, color: 'var(--text-700)' }}>
            {indexedWords(state.tally)}
            {hasRetryableHeld(state.tally.held) ? (
              <>
                {' '}
                <button type="button" style={linkPress} onClick={() => void run(true)}>
                  {INDEX_FOLDER_WORDS.retryHeld}
                </button>
              </>
            ) : null}
          </p>
          {state.tally.held.length > 0 ? (
            <ul style={{ margin: 0, padding: '0 0 0 0.85rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.1rem', borderLeft: '2px solid var(--border)' }}>
              {state.tally.held.slice(0, HELD_SHOWN).map((h) => (
                <li key={h.id} style={muted}>
                  {heldLineWords(h)}
                </li>
              ))}
              {moreHeldWords(state.tally.held) ? <li style={muted}>{moreHeldWords(state.tally.held)}</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default JobDocumentsIndexFolder
