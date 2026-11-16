import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useMyNoteTags } from '../../hooks/useMyNoteTags'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatDispatchNoteWeekdayShortTimeChicago } from '../../utils/dispatchNoteDisplay'
import { NAV_BADGE_STYLE, navBadgeWords } from '../../lib/navBadgeStyle'
import { emptyWords } from '../../lib/emptyWords'
import { EmptyState } from '../EmptyState'
import {
  askedLineWords,
  canTagInJobNotes,
  myTagsView,
  noteBodyParts,
  sectionSplit,
  tagAgeWords,
  tagIsLate,
  type MyTag,
} from '../../lib/jobs/noteTags'
import { markAnswersSeen, markTagDone, noteTagsChanged, postTaggedNote } from '../../lib/jobs/noteTagsIo'
import { useNoteTagBox } from './NoteTagBox'

/**
 * Tagged job notes (punch list #363): the job notes that tagged the reader and still wait, each
 * with a box to answer on the job and a No reply needed press, then the notes the reader tagged.
 *
 * `pipeline` is the section at the top of Jobs → Pipeline: it draws nothing when nothing waits and
 * nothing was asked, so an idle Pipeline looks as it did. `window` is the same list inside the
 * Dashboard's window, for the roles with no Pipeline, and says so when it is empty.
 *
 * An answer clears a tag and opening one does not. An answer to the reader's own tag counts for
 * them until this list has been on their screen, and is then marked seen with nothing to press.
 */

const FOLD_KEY = 'pt.taggedJobNotes.folded'

const chip: CSSProperties = {
  display: 'inline-block',
  borderRadius: 999,
  padding: '0 7px',
  fontWeight: 600,
  fontSize: '0.92em',
  whiteSpace: 'nowrap',
}
const myChip: CSSProperties = { ...chip, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }
const theirChip: CSSProperties = { ...chip, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', border: '1px solid var(--border-blue)' }
const linkLook: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left' }
const meta: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function readFolded(): boolean {
  try {
    return window.localStorage.getItem(FOLD_KEY) === '1'
  } catch {
    return false
  }
}

function JobName({ tag, onOpenJob }: { tag: MyTag; onOpenJob?: (jobId: string) => void }) {
  const name = tag.jobName.trim() || 'A job'
  return onOpenJob ? (
    <button type="button" style={linkLook} title="Open the job" onClick={() => onOpenJob(tag.jobId)}>
      {name}
    </button>
  ) : (
    <strong style={{ color: 'var(--text-strong)' }}>{name}</strong>
  )
}

function TagCard({ tag, today, onOpenJob }: { tag: MyTag; today: string; onOpenJob?: (jobId: string) => void }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'post' | 'done' | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { showToast } = useToastContext()
  const narrow = typeof window !== 'undefined' && window.innerWidth <= 700
  const tagBox = useNoteTagBox({ jobId: tag.jobId, draft, setDraft, inputRef, enabled: true, askerId: tag.taggerUserId, place: narrow ? 'above' : 'below' })
  const posted = calendarYmdInAppTzFromIso(tag.noteCreatedAt)
  const late = tagIsLate(posted, today)
  const age = tagAgeWords(posted, today)
  const asker = firstWord(tag.taggerName) || 'A teammate'

  const post = async () => {
    const body = draft.trim()
    if (!body || busy) return
    setBusy('post')
    try {
      await postTaggedNote(tag.jobId, body, tagBox.taggedIds(body))
      setDraft('')
      tagBox.reset()
      showToast(`Answered. It is on the notes of ${tag.jobName.trim() || 'the job'}.`, 'success')
      noteTagsChanged()
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The answer was not posted'), 'error')
    } finally {
      setBusy(null)
    }
  }
  const done = async () => {
    if (busy) return
    setBusy('done')
    try {
      await markTagDone(tag.tagId)
      noteTagsChanged()
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'The tag was not cleared'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div data-tagged-note style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        <JobName tag={tag} onOpenJob={onOpenJob} />
        <span style={meta}>{[tag.jobNumber, tag.customerName].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ')}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', whiteSpace: 'nowrap', fontWeight: late ? 700 : 400, color: late ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
          {formatDispatchNoteWeekdayShortTimeChicago(tag.noteCreatedAt)}
          {age ? ` · ${age}` : ''}
        </span>
      </div>
      <div style={{ fontSize: '0.84375rem', color: 'var(--text-base)', overflowWrap: 'anywhere' }}>
        <strong style={{ color: 'var(--text-strong)' }}>{asker}</strong>
        <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>|</span>
        {noteBodyParts(tag.noteBody, [tag.taggedName]).map((p, i) =>
          p.kind === 'text' ? (
            <span key={i}>{p.text}</span>
          ) : (
            <span key={i} style={myChip}>
              @{p.name}
            </span>
          ),
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
          {tagBox.chips}
          {tagBox.list}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 7px 5px 14px', border: '1px solid #3b82f6', borderRadius: 999, background: 'var(--surface)' }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => tagBox.onText(e.target.value, e.target.selectionStart)}
              onClick={(e) => tagBox.onText(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyDown={(e) => {
                if (tagBox.onKeyDown(e)) return
                if (e.key === 'Enter') void post()
              }}
              placeholder={`Answer ${asker} on the job's notes…`}
              aria-label={`Answer ${asker} on ${tag.jobName.trim() || 'the job'}`}
              disabled={busy != null}
              maxLength={2000}
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-strong)', fontSize: '0.8125rem' }}
            />
            {tagBox.atButton}
            <button
              type="button"
              onClick={() => void post()}
              disabled={busy != null}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 16px', fontSize: '0.78rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0 }}
            >
              {busy === 'post' ? '…' : 'Post'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void done()}
          disabled={busy != null}
          style={{ fontSize: '0.78rem', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          No reply needed
        </button>
      </div>
    </div>
  )
}

function AskedLine({ tag, today, fresh, onOpenJob }: { tag: MyTag; today: string; fresh: boolean; onOpenJob?: (jobId: string) => void }) {
  const said = askedLineWords(tag, today, calendarYmdInAppTzFromIso(tag.noteCreatedAt))
  const who = tag.taggedName.trim() || 'A teammate'
  return (
    <div data-asked-note style={{ fontSize: '0.8125rem', color: 'var(--text-700)', overflowWrap: 'anywhere', fontWeight: fresh ? 600 : 400 }}>
      <JobName tag={tag} onOpenJob={onOpenJob} /> <span style={meta}>{(tag.jobNumber ?? '').trim()}</span> ·{' '}
      {tag.clearedAt == null ? (
        <>
          you tagged <span style={theirChip}>@{who}</span>
        </>
      ) : (
        <strong style={{ color: 'var(--text-strong)' }}>{who}</strong>
      )}{' '}
      <span style={{ fontWeight: 600, color: said.tone === 'late' ? 'var(--text-amber-800)' : said.tone === 'cleared' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{said.words}</span>
      {fresh ? (
        <span data-asked-new style={{ marginLeft: 6, background: '#2563eb', color: '#fff', fontSize: '0.65rem', fontWeight: 700, borderRadius: 999, padding: '1px 7px', verticalAlign: 'middle' }}>
          new
        </span>
      ) : null}
    </div>
  )
}

export function TaggedJobNotesSection({ variant, onOpenJob }: { variant: 'pipeline' | 'window'; onOpenJob?: (jobId: string) => void }) {
  const role = useOptionalAuth()?.role ?? null
  const { tags, error } = useMyNoteTags(canTagInJobNotes(role))
  const view = useMemo(() => myTagsView(tags ?? []), [tags])
  const [folded, setFolded] = useState(readFolded)
  const [showAll, setShowAll] = useState(false)
  // The answers that were new when this list came on screen keep their mark until it is left.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const today = todayYmdInAppTz()
  const open = variant === 'window' || !folded

  const unseenIds = useMemo(() => view.asked.filter((t) => t.clearedAt != null && t.askerSeenAt == null).map((t) => t.tagId), [view.asked])
  const unseenKey = unseenIds.join(',')
  useEffect(() => {
    if (!open || unseenIds.length === 0) return
    setFresh((prev) => new Set([...prev, ...unseenIds]))
    // An answer clears when it is seen: this list is on screen, so it is. A failed mark tries again on the next read.
    void markAnswersSeen()
      .then(noteTagsChanged)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unseenKey stands for unseenIds
  }, [open, unseenKey])

  const toggleFold = () => {
    setFolded((was) => {
      try {
        window.localStorage.setItem(FOLD_KEY, was ? '0' : '1')
      } catch {
        /* a private window keeps the fold for this visit only */
      }
      return !was
    })
  }

  const nothing = view.waiting.length === 0 && view.asked.length === 0
  if (variant === 'pipeline' && (tags == null || nothing) && !error) return null

  const split = sectionSplit(view.waiting, showAll)
  const body = (
    <>
      {error ? (
        <p role="alert" style={{ margin: 0, padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
      {tags == null && !error ? <p style={{ margin: 0, padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading…</p> : null}
      {tags != null && nothing ? <EmptyState compact main={emptyWords({ kind: 'waiting', who: 'you' }).main} /> : null}
      {split.shown.map((t) => (
        <TagCard key={t.tagId} tag={t} today={today} onOpenJob={onOpenJob} />
      ))}
      {split.rest > 0 ? (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
          <button type="button" style={linkLook} onClick={() => setShowAll(true)}>
            Show the rest ({split.rest})
          </button>
        </div>
      ) : null}
      {view.asked.length > 0 ? (
        <div data-you-asked style={{ padding: '9px 14px', display: 'grid', gap: 5 }}>
          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-strong)' }}>You asked · {view.asked.length}</div>
          {view.asked.map((t) => (
            <AskedLine key={t.tagId} tag={t} today={today} fresh={fresh.has(t.tagId)} onOpenJob={onOpenJob} />
          ))}
        </div>
      ) : null}
    </>
  )

  if (variant === 'window') return <div data-tagged-job-notes="window">{body}</div>

  return (
    <section data-tagged-job-notes="pipeline" aria-label="Tagged job notes" style={{ margin: '0 0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <h3 style={{ margin: 0, padding: '10px 14px', fontSize: '0.84375rem', color: 'var(--text-strong)', borderBottom: open ? '1px solid var(--border)' : 'none', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        Tagged job notes
        {view.count > 0 ? <span style={{ ...NAV_BADGE_STYLE, position: 'static', border: 'none' }}>{navBadgeWords(view.count)}</span> : null}
        <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          {view.waiting.length > 0 ? 'waiting on you, oldest first · an answer or No reply needed clears one' : emptyWords({ kind: 'waiting', who: 'you' }).main}
        </span>
        <button type="button" onClick={toggleFold} aria-expanded={open} style={{ ...linkLook, marginLeft: 'auto', textDecoration: 'none', fontSize: '0.75rem' }}>
          {open ? 'Fold ▴' : 'Open ▾'}
        </button>
      </h3>
      {open ? body : null}
    </section>
  )
}
