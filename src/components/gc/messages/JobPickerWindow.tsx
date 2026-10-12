import { useEffect, useState } from 'react'
import { formatErrorMessage } from '../../../utils/errorHandling'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { PhoneSheet } from '../../PhoneSheet'
import { Btn, input } from '../gcUi'

/**
 * Messages, cut 1's screens: pick a job, for *+ add a job* on the rail and for a line's *Tie to* (the prototype's
 * picker, v1.4). Their own jobs first, then any job found by its name or number. A line can also be untied, so it sits
 * on the person. A sheet from the bottom on a phone (`PhoneSheet`, cut 10).
 */
export function JobPickerWindow({
  title,
  theirs,
  untie,
  searchJobs,
  onPick,
  onClose,
}: {
  title: string
  /** The person's jobs, listed first. */
  theirs: readonly JobTile[]
  /** Offer *On the person, no job* (a line's tie). */
  untie?: boolean
  searchJobs: (words: string) => Promise<JobTile[]>
  onPick: (key: string | null) => void
  onClose: () => void
}) {
  const [words, setWords] = useState('')
  const [found, setFound] = useState<JobTile[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (words.trim().length < 2) {
      setFound(null)
      return
    }
    let live = true
    const t = window.setTimeout(() => {
      searchJobs(words)
        .then((tiles) => live && setFound(tiles))
        .catch((e: unknown) => live && setProblem(formatErrorMessage(e, 'The jobs did not load.')))
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [words, searchJobs])

  const row = (t: JobTile) => (
    <button
      key={t.key}
      type="button"
      onClick={() => onPick(t.key)}
      style={{ textAlign: 'left', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '0.4rem 0.6rem', cursor: 'pointer', display: 'grid', gap: '0.1rem' }}
    >
      <span>
        <strong>{t.num}</strong> {t.name}
      </span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.day.words}</span>
    </button>
  )

  return (
    <PhoneSheet label={title} title={title} width={480} maxHeight="80vh" dataAttrs={{ 'data-job-picker': '' }} onClose={onClose}>
      <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
        {problem && (
          <div role="alert" style={{ color: 'var(--text-red-700)' }}>
            {problem}
          </div>
        )}
        {untie && (
          <Btn onClick={() => onPick(null)} kind="quiet">
            On the person, no job
          </Btn>
        )}
        {theirs.length > 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Their jobs</div>}
        {theirs.map(row)}
        <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Find another job by its name or number" style={input} />
        {found && found.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No job goes by that.</div>}
        {found?.filter((t) => !theirs.some((x) => x.key === t.key)).map(row)}
      </div>
    </PhoneSheet>
  )
}
