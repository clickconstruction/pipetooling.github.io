/**
 * People → Feedback (v2.2835): the open-words feed under the table — newest first, an Unread
 * filter with a device-local read marker, the writer's name (dev only).
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { parseOpenPrompts } from '../../lib/people/crewReview'
import { FEEDBACK_WORDS_READ_AT_KEY, submissionHasWords, unreadWordsCount, type WordsSubmission } from '../../lib/people/feedbackTabRows'

type Props = {
  submissions: WordsSubmission[]
  openPrompts: unknown
  nameOf: (userId: string) => string
  onOpenPerson: (userId: string) => void
}

function readMarker(): string | null {
  try {
    return window.localStorage.getItem(FEEDBACK_WORDS_READ_AT_KEY)
  } catch {
    return null
  }
}

export default function OpenWordsFeed({ submissions, openPrompts, nameOf, onOpenPerson }: Props) {
  const [readAt, setReadAt] = useState<string | null>(() => readMarker())
  const [view, setView] = useState<'unread' | 'all'>(() => (unreadWordsCount(submissions, readMarker()) > 0 ? 'unread' : 'all'))
  const prompts = useMemo(() => parseOpenPrompts(openPrompts), [openPrompts])
  const withWords = useMemo(() => submissions.filter(submissionHasWords).sort((a, b) => b.created_at.localeCompare(a.created_at)), [submissions])
  const unread = unreadWordsCount(withWords, readAt)
  const shown = view === 'unread' ? withWords.filter((s) => !readAt || s.created_at > readAt) : withWords

  function markAllRead() {
    const now = new Date().toISOString()
    try {
      window.localStorage.setItem(FEEDBACK_WORDS_READ_AT_KEY, now)
    } catch {
      /* device-local nicety only */
    }
    setReadAt(now)
    setView('all')
  }

  return (
    <section style={{ marginTop: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>Open words</span>
        <button type="button" onClick={() => setView('unread')} aria-pressed={view === 'unread'} style={pill(view === 'unread')}>
          Unread · {unread}
        </button>
        <button type="button" onClick={() => setView('all')} aria-pressed={view === 'all'} style={pill(view === 'all')}>
          All · {withWords.length}
        </button>
        {unread > 0 && (
          <button type="button" onClick={markAllRead} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}>
            Mark all read
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p style={{ margin: '0.5rem 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{view === 'unread' ? 'Nothing unread.' : 'Nothing written yet.'}</p>
      ) : (
        <div>
          {shown.map((s) => {
            const entries = (
              [
                [prompts[0], s.open_fix_improve],
                [prompts[1], s.open_safety_tools],
                [prompts[2], s.open_training],
                [prompts[3], s.open_anything],
              ] as Array<[string, string | null]>
            ).filter(([, t]) => t && t.trim())
            return (
              <div key={s.id} style={{ borderTop: '1px solid var(--border)', padding: '0.5rem 0' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => onOpenPerson(s.reviewer_user_id)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer' }}>
                    {nameOf(s.reviewer_user_id)}
                  </button>
                  <span>{new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span style={{ color: 'var(--text-faint)' }}>name visible to you only</span>
                </div>
                {entries.map(([heading, t], i) => (
                  <div key={i} style={{ marginTop: '0.3rem' }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{heading}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', whiteSpace: 'pre-wrap' }}>{t}</div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function pill(active: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.74rem',
    fontWeight: active ? 700 : 500,
    padding: '0.15rem 0.6rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-strong)' : 'transparent',
    color: active ? 'var(--surface)' : 'var(--text-700)',
    cursor: 'pointer',
  }
}
