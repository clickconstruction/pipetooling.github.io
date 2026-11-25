import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useMyNoteTags } from '../../hooks/useMyNoteTags'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatDispatchNoteWeekdayShortTimeChicago } from '../../utils/dispatchNoteDisplay'
import { NAV_BADGE_STYLE, navBadgeWords } from '../../lib/navBadgeStyle'
import { emptyWords } from '../../lib/emptyWords'
import { phoneGiveBack, phoneTall } from '../../lib/phonePressFloor'
import { EmptyState } from '../EmptyState'
import {
  askedLineWords,
  canTagInJobNotes,
  myTagsView,
  noteBodyParts,
  sectionSplit,
  tagAgeWords,
  tagIsLate,
  tagIsTask,
  tagWhere,
  tagsOfKind,
  type MyTag,
  type TagKinds,
} from '../../lib/jobs/noteTags'
import { markAnswersSeen, markTagDone, noteTagsChanged, notifyNoteTag, postTaggedNote, postTaggedTaskNote } from '../../lib/jobs/noteTagsIo'
import { useNoteTagBox } from './NoteTagBox'

/**
 * Tagged notes (punch list #363, and task notes since #375): the notes that tagged the reader and
 * still wait, each with a box to answer where the note is and a No reply needed press, then the
 * notes the reader tagged.
 *
 * `pipeline` is the section at the top of Jobs → Pipeline, for job notes: it draws nothing when
 * nothing waits and nothing was asked, so an idle Pipeline looks as it did. `today` is the same
 * section at the top of the Checklist's Today, for task notes, and for both kinds in Task Mode,
 * where no other page is open. `window` is the list inside the Dashboard's window, both kinds,
 * and says so when it is empty.
 *
 * An answer clears a tag and opening one does not. An answer to the reader's own tag counts for
 * them until this list has been on their screen, and is then marked seen with nothing to press.
 */

type Variant = 'pipeline' | 'today' | 'window'

const FOLD_KEYS: Record<Variant, string> = { pipeline: 'pt.taggedJobNotes.folded', today: 'pt.taggedTaskNotes.folded', window: '' }

/** What each list is called, by the notes it holds. */
const TITLE: Record<TagKinds, string> = { job: 'Tagged job notes', task: 'Tagged task notes', both: 'Tagged notes' }

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
/**
 * The section's *Fold ▴* is 34 by 18 in the title row. On a phone it is a thumb's square (the phone walk of
 * 2026-11-21): the margin gives the row back what the press grew by, and its words keep to the row's right edge.
 */
const FOLD_THUMB: CSSProperties = { minHeight: phoneTall(18), minWidth: phoneTall(34), marginTop: phoneGiveBack(18), marginBottom: phoneGiveBack(18), textAlign: 'right' }

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function readFolded(variant: Variant): boolean {
  if (!FOLD_KEYS[variant]) return false
  try {
    return window.localStorage.getItem(FOLD_KEYS[variant]) === '1'
  } catch {
    return false
  }
}

/** The doors a list may be handed: the job's window, and the task on the Checklist. */
type Doors = {
  onOpenJob?: (jobId: string) => void
  onOpenTask?: (instanceId: string) => void
  /** False when the page that hosts the list cannot show this task, so its title is plain words and no dead press. */
  taskOpens?: (instanceId: string) => boolean
}

/** The task's day, as the line under its title says it: `Nov 17`. */
function taskDayWords(ymd: string | null | undefined): string {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** The few words after the name: a job's number and customer, or that it is a task and its day. */
function whereMeta(tag: MyTag): string {
  if (tagIsTask(tag)) return ['task', taskDayWords(tag.taskDate)].filter(Boolean).join(' · ')
  return [tag.jobNumber, tag.customerName].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ')
}

/** The job's name or the task's title: the card's only door, where one was handed. */
function WhereName({ tag, onOpenJob, onOpenTask, taskOpens }: { tag: MyTag } & Doors) {
  const name = tagWhere(tag)
  const task = tagIsTask(tag)
  const instanceId = tag.instanceId ?? null
  const open = task ? (onOpenTask && instanceId && (taskOpens?.(instanceId) ?? true) ? () => onOpenTask(instanceId) : null) : onOpenJob ? () => onOpenJob(tag.jobId) : null
  return open ? (
    <button type="button" style={linkLook} title={task ? 'Open the task' : 'Open the job'} onClick={open}>
      {name}
    </button>
  ) : (
    <strong style={{ color: 'var(--text-strong)' }}>{name}</strong>
  )
}

function TagCard({ tag, today, onOpenJob, onOpenTask, taskOpens }: { tag: MyTag; today: string } & Doors) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'post' | 'done' | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { showToast } = useToastContext()
  const narrow = typeof window !== 'undefined' && window.innerWidth <= 700
  // The person who asked is offered before a letter is typed (punch list #375): one tap tags them back.
  const offer = useMemo(() => [{ userId: tag.taggerUserId, name: tag.taggerName, says: 'asked you' }], [tag.taggerUserId, tag.taggerName])
  const task = tagIsTask(tag)
  const where = tagWhere(tag)
  const tagBox = useNoteTagBox({ jobId: task ? '' : tag.jobId, taskInstanceId: task ? tag.instanceId : null, draft, setDraft, inputRef, enabled: true, askerId: tag.taggerUserId, offer, place: narrow ? 'above' : 'below', bigAt: narrow })
  const posted = calendarYmdInAppTzFromIso(tag.noteCreatedAt)
  const late = tagIsLate(posted, today)
  const age = tagAgeWords(posted, today)
  const asker = firstWord(tag.taggerName) || 'A teammate'

  const post = async () => {
    const body = draft.trim()
    if (!body || busy) return
    setBusy('post')
    try {
      if (task) {
        // The answer is a note on the task's thread, on the day row the tagged note is on.
        notifyNoteTag({ taskEventId: await postTaggedTaskNote(tag.instanceId ?? '', body, tagBox.taggedIds(body)) })
      } else {
        const noteId = await postTaggedNote(tag.jobId, body, tagBox.taggedIds(body))
        notifyNoteTag({ noteId })
      }
      setDraft('')
      tagBox.reset()
      showToast(task ? `Answered. It is on the notes of the task ${where}.` : `Answered. It is on the notes of ${tag.jobName.trim() || 'the job'}.`, 'success')
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
      if (await markTagDone(tag.tagId, task ? 'task' : 'job')) notifyNoteTag(task ? { taskTagId: tag.tagId } : { tagId: tag.tagId })
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
        <WhereName tag={tag} onOpenJob={onOpenJob} onOpenTask={onOpenTask} taskOpens={taskOpens} />
        <span style={meta}>{whereMeta(tag)}</span>
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
            {tagBox.mark}
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => tagBox.onText(e.target.value, e.target.selectionStart)}
              onClick={(e) => tagBox.onText(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyDown={(e) => {
                if (tagBox.onKeyDown(e)) return
                if (e.key === 'Enter') void post()
              }}
              placeholder={task ? `Answer ${asker} on the task's notes…` : `Answer ${asker} on the job's notes…`}
              aria-label={`Answer ${asker} on ${task ? where : tag.jobName.trim() || 'the job'}`}
              disabled={busy != null}
              maxLength={2000}
              // A thumb's height on a phone (the live walk of punch list #363 measured the box 22 px, Post 26 and No reply needed 30).
              style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: phoneTall(22), background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-strong)', fontSize: '0.8125rem' }}
            />
            {tagBox.atButton}
            <button
              type="button"
              onClick={() => void post()}
              disabled={busy != null}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 999, padding: '5px 16px', minHeight: phoneTall(26), fontSize: '0.78rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0 }}
            >
              {busy === 'post' ? '…' : 'Post'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void done()}
          disabled={busy != null}
          style={{ fontSize: '0.78rem', fontWeight: 600, padding: '6px 12px', minHeight: phoneTall(30), borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
        >
          No reply needed
        </button>
      </div>
    </div>
  )
}

function AskedLine({ tag, today, fresh, onOpenJob, onOpenTask, taskOpens }: { tag: MyTag; today: string; fresh: boolean } & Doors) {
  const said = askedLineWords(tag, today, calendarYmdInAppTzFromIso(tag.noteCreatedAt))
  const who = tag.taggedName.trim() || 'A teammate'
  return (
    <div data-asked-note style={{ fontSize: '0.8125rem', color: 'var(--text-700)', overflowWrap: 'anywhere', fontWeight: fresh ? 600 : 400 }}>
      <WhereName tag={tag} onOpenJob={onOpenJob} onOpenTask={onOpenTask} taskOpens={taskOpens} /> <span style={meta}>{tagIsTask(tag) ? 'task' : (tag.jobNumber ?? '').trim()}</span> ·{' '}
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

export function TaggedJobNotesSection({
  variant,
  kinds = variant === 'pipeline' ? 'job' : variant === 'today' ? 'task' : 'both',
  onOpenJob,
  onOpenTask,
  taskOpens,
}: {
  variant: Variant
  /** Which notes the list holds. The Pipeline's are a job's, Today's a task's, the window's both. */
  kinds?: TagKinds
} & Doors) {
  const role = useOptionalAuth()?.role ?? null
  const { tags, error } = useMyNoteTags(canTagInJobNotes(role))
  const view = useMemo(() => myTagsView(tagsOfKind(tags ?? [], kinds)), [tags, kinds])
  const [folded, setFolded] = useState(() => readFolded(variant))
  const [showAll, setShowAll] = useState(false)
  // The answers that were new when this list came on screen keep their mark until it is left.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const today = todayYmdInAppTz()
  const open = variant === 'window' || !folded

  const unseen = useMemo(() => view.asked.filter((t) => t.clearedAt != null && t.askerSeenAt == null), [view.asked])
  const unseenKey = unseen.map((t) => t.tagId).join(',')
  useEffect(() => {
    if (!open || unseen.length === 0) return
    setFresh((prev) => new Set([...prev, ...unseen.map((t) => t.tagId)]))
    // An answer clears when it is seen: this list is on screen, so it is. Each kind has its own mark, and only
    // the kinds on this list are marked. A failed mark tries again on the next read.
    const sources = [...new Set(unseen.map((t) => (tagIsTask(t) ? 'task' : 'job') as 'job' | 'task'))]
    void Promise.all(sources.map((source) => markAnswersSeen(source)))
      .then(noteTagsChanged)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unseenKey stands for unseen
  }, [open, unseenKey])

  const toggleFold = () => {
    setFolded((was) => {
      try {
        window.localStorage.setItem(FOLD_KEYS[variant], was ? '0' : '1')
      } catch {
        /* a private window keeps the fold for this visit only */
      }
      return !was
    })
  }

  const nothing = view.waiting.length === 0 && view.asked.length === 0
  if (variant !== 'window' && (tags == null || nothing) && !error) return null

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
        <TagCard key={t.tagId} tag={t} today={today} onOpenJob={onOpenJob} onOpenTask={onOpenTask} taskOpens={taskOpens} />
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
            <AskedLine key={t.tagId} tag={t} today={today} fresh={fresh.has(t.tagId)} onOpenJob={onOpenJob} onOpenTask={onOpenTask} taskOpens={taskOpens} />
          ))}
        </div>
      ) : null}
    </>
  )

  if (variant === 'window') return <div data-tagged-job-notes="window">{body}</div>

  return (
    <section data-tagged-job-notes={variant} aria-label={TITLE[kinds]} style={{ margin: '0 0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <h3 style={{ margin: 0, padding: '10px 14px', fontSize: '0.84375rem', color: 'var(--text-strong)', borderBottom: open ? '1px solid var(--border)' : 'none', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {TITLE[kinds]}
        {view.count > 0 ? <span style={{ ...NAV_BADGE_STYLE, position: 'static', border: 'none' }}>{navBadgeWords(view.count)}</span> : null}
        <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          {view.waiting.length > 0 ? 'waiting on you, oldest first · an answer or No reply needed clears one' : emptyWords({ kind: 'waiting', who: 'you' }).main}
        </span>
        <button type="button" data-tagged-notes-fold onClick={toggleFold} aria-expanded={open} style={{ ...linkLook, marginLeft: 'auto', textDecoration: 'none', fontSize: '0.75rem', ...FOLD_THUMB }}>
          {open ? 'Fold ▴' : 'Open ▾'}
        </button>
      </h3>
      {open ? body : null}
    </section>
  )
}
