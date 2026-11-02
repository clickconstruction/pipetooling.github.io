import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import {
  FIND_DEBOUNCE_MS,
  FIND_MIN_CHARS,
  FIND_WORDS,
  emptyFindWords,
  findFailedWords,
  foundWords,
  groupByHome,
  hitMetaWords,
  homeWords,
  type FindAFileRead,
} from '../../lib/documents/findAFile'
import { supabaseFindAFileIo, type FindAFileIo } from '../../lib/documents/findAFileIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'

type State =
  | { kind: 'idle' }
  | { kind: 'searching'; words: string }
  | { kind: 'done'; words: string; read: FindAFileRead }
  | { kind: 'failed'; words: string; reason: string }

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.9rem 1rem', background: 'var(--surface)', display: 'grid', gap: '0.6rem', marginTop: '1.25rem' }
const muted: CSSProperties = { color: 'var(--text-muted)' }
const small: CSSProperties = { fontSize: '0.8125rem' }
const inputStyle: CSSProperties = { font: 'inherit', padding: '0.5rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', width: '100%', maxWidth: '32rem' }
const quiet: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
const linkStyle: CSSProperties = { color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }

/**
 * Find a file (v2.6305): the box on the Documents page's Search tab that searches every job's Drive files by their
 * words. It waits for the typing to pause, asks `drive-link`'s `search` (Drive's own full-text index, which already
 * reads the words inside PDFs and OCR'd scans, scoped to the jobs Shared Drive), and lists the hits under the job or
 * bid whose folder holds each, with the folder, the day and the size under the name. A hit opens in Drive; a job's
 * group offers Open the job. Nothing found says so in the empty state; a refusal shows its reason with Try again.
 */
export function FindAFile({ io = supabaseFindAFileIo, debounceMs = FIND_DEBOUNCE_MS }: { io?: FindAFileIo; debounceMs?: number }) {
  const jobModal = useJobDetailModal()
  const [words, setWords] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const seq = useRef(0)

  const run = (w: string) => {
    const mine = ++seq.current
    setState({ kind: 'searching', words: w })
    io.search(w).then(
      (read) => {
        if (seq.current === mine) setState({ kind: 'done', words: w, read })
      },
      (e: unknown) => {
        if (seq.current === mine) setState({ kind: 'failed', words: w, reason: formatErrorMessage(e, FIND_WORDS.failed) })
      },
    )
  }

  useEffect(() => {
    const w = words.trim()
    if (w.length < FIND_MIN_CHARS) {
      seq.current += 1
      setState({ kind: 'idle' })
      return
    }
    const t = setTimeout(() => run(w), debounceMs)
    return () => clearTimeout(t)
    // `run` reads io from props; the effect re-arms on the words alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, debounceMs])

  return (
    <section aria-labelledby="find-a-file-heading" data-find-a-file="" style={card}>
      <h2 id="find-a-file-heading" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }}>
        {FIND_WORDS.title}
      </h2>
      <p style={{ margin: 0, ...small, ...muted }}>{FIND_WORDS.hint}</p>
      <input type="search" aria-label={FIND_WORDS.label} placeholder={FIND_WORDS.placeholder} value={words} onChange={(e) => setWords(e.target.value)} style={inputStyle} />

      {state.kind === 'searching' ? <p style={{ margin: 0, ...small, ...muted }}>{FIND_WORDS.searching}</p> : null}

      {state.kind === 'failed' ? (
        <p style={{ margin: 0, ...small, color: 'var(--text-red-700)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{findFailedWords(state.reason)}</span>
          <button type="button" style={quiet} onClick={() => run(state.words)}>
            {FIND_WORDS.tryAgain}
          </button>
        </p>
      ) : null}

      {state.kind === 'done' && state.read.noRoot ? <p style={{ margin: 0, ...small, color: 'var(--text-amber-800)' }}>{FIND_WORDS.noRoot}</p> : null}

      {state.kind === 'done' && !state.read.noRoot && state.read.hits.length === 0 ? <EmptyState compact {...emptyFindWords(state.words)} /> : null}

      {state.kind === 'done' && state.read.hits.length > 0 ? (
        <>
          <p style={{ margin: 0, ...small, ...muted }}>{foundWords(state.read, state.words)}</p>
          {groupByHome(state.read.hits).map((g) => (
            <div key={g.key} data-find-group={g.key} style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }}>{homeWords(g.home)}</h3>
                {g.home?.kind === 'job' ? (
                  jobModal ? (
                    <button type="button" style={{ ...linkStyle, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', ...small }} onClick={() => jobModal.openJobDetail({ jobId: g.home!.id })}>
                      {FIND_WORDS.openJob}
                    </button>
                  ) : (
                    <Link to={`/jobs?edit=${g.home.id}`} style={{ ...linkStyle, ...small }}>
                      {FIND_WORDS.openJob}
                    </Link>
                  )
                ) : null}
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 0.85rem', listStyle: 'none', display: 'grid', gap: '0.35rem', borderLeft: '2px solid var(--border)' }}>
                {g.files.map((f) => (
                  <li key={f.id} data-found-file={f.id} style={{ display: 'grid', gap: '0.1rem' }}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" title={FIND_WORDS.openInDrive} style={{ ...linkStyle, fontSize: '0.875rem', fontWeight: 500, overflowWrap: 'anywhere' }}>
                      {f.name}
                    </a>
                    {hitMetaWords(f) ? <span style={{ ...small, ...muted }}>{hitMetaWords(f)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}
    </section>
  )
}
