/**
 * Messages → My email, a door where the person already works (punch list #263 PR A, call 1, v2.6730): the line under
 * the job window's *Where it stands* card (`DetailJobModal.tsx`) and above the box of a thread narrowed to a job
 * (`useMyMailJobLineThreadSlots.tsx`). When the window opens and the person's switch is on, one `gmail-mine` `list` as
 * them, searched on the job's people's addresses and the job's number (`jobDoor.ts`), metadata only, kept nowhere.
 * The conversations not on this job yet draw with **Yes** on each, the tab's own tag onto this job; after Yes the row
 * turns green, *on JP1077 ✓ · open the thread ›*. Read once per window open, keyed by the job and the addresses;
 * nothing counts or nags; a switch that is off, a refusal of any kind, a lost signal or a page with nothing on it
 * draws no line and no words. *All your mail with Dale ›* opens the tab searched as the line searched.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import type { MyMailJobChip, MyMailTagOk } from '../../../lib/myMail/contract'
import { JOB_DOOR_WORDS, jobDoorHref, jobDoorRowFacts, jobDoorRows, type JobDoorRow } from '../../../lib/myMail/jobDoor'
import { supabaseJobDoorIo, type JobDoorIo, type JobDoorRead } from '../../../lib/myMail/jobDoorIo'
import { rowDay, taggedWords, notTaggedWords } from '../../../lib/myMail/list'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { Btn } from '../../gc/gcUi'
import { mutedSmall as muted, oneLine } from './myMailStyles'

export interface MyMailJobLineProps {
  /** The job the line is on: its kind and id for the tag, its number and name as the window shows them. */
  job: MyMailJobChip
  /** Who the mail is with, for the head: the customer on a job window, the person on a thread. */
  who: string
  /** The job's people, whose addresses the io reads. Either this or `addresses`. */
  contactIds?: readonly string[]
  /** The addresses to search on, when the surface already has them (a thread's person's channels). */
  addresses?: readonly string[]
  /** A phone's width: the presses under the subject. */
  narrow?: boolean
  /** The door after Yes: the thread the conversation landed on. Absent: no door. */
  onOpenThread?: (contactId: string) => void
  /** The door to the tab, searched as the line searched. Absent: a plain link. */
  onOpenHref?: (href: string) => void
  /** After a tag landed: the surface reads its lines again. */
  onTagged?: () => void
  /** The reads and the one write; the real one when absent. */
  io?: JobDoorIo
  nowIso?: string
}

const defaultIo = (): JobDoorIo => supabaseJobDoorIo()

export function MyMailJobLine({ job, who, contactIds, addresses, narrow = false, onOpenThread, onOpenHref, onTagged, io: ioGiven, nowIso }: MyMailJobLineProps) {
  const io = useMemo(() => ioGiven ?? defaultIo(), [ioGiven])
  const { showToast } = useToastContext()
  const peopleKey = (addresses ?? contactIds ?? []).join(',')
  const key = `${job.key}|${job.num}|${peopleKey}`
  const [read, setRead] = useState<{ key: string; read: JobDoorRead | null } | null>(null)
  const [done, setDone] = useState<Readonly<Record<string, MyMailTagOk>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const asked = useRef<string | null>(null)

  // Once per window open, keyed by the job and the people: a read for a window opened before never lands on this one.
  useEffect(() => {
    asked.current = key
    setDone({})
    setProblem(null)
    let live = true
    void (async () => {
      try {
        const list = addresses ? [...addresses] : contactIds && contactIds.length > 0 ? await io.addresses(contactIds) : []
        const got = list.length > 0 || job.num.trim() ? await io.read(list, job.num) : null
        if (live && asked.current === key) setRead({ key, read: got })
      } catch {
        // A lost signal draws no line: the door is never a nag, and the window itself still draws.
        if (live && asked.current === key) setRead({ key, read: null })
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, io])

  const page = read && read.key === key ? read.read : null
  const door = useMemo(() => (page ? jobDoorRows(page.rows, job.key) : null), [page, job.key])
  const now = nowIso ?? new Date().toISOString()
  if (!page || !door || (door.total === 0 && Object.keys(done).length === 0)) return null

  const yes = async (r: JobDoorRow) => {
    if (busy) return
    setBusy(r.threadId)
    setProblem(null)
    try {
      const a = await io.tag(r.threadId, { kind: job.kind, id: job.id })
      if (!a.ok) {
        setProblem(a.words)
        return
      }
      setDone((d) => ({ ...d, [r.threadId]: a }))
      showToast(taggedWords(a, job), 'success')
      onTagged?.()
    } catch (e) {
      setProblem(formatErrorMessage(e, notTaggedWords('tag')))
    } finally {
      setBusy(null)
    }
  }

  const href = jobDoorHref(page.query)
  const left = door.total - Object.keys(done).filter((t) => door.rows.some((r) => r.threadId === t)).length
  return (
    <section
      data-testid="my-mail-job-line"
      aria-label={JOB_DOOR_WORDS.head(who)}
      style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', marginBottom: '0.75rem', display: 'grid', gap: 6, background: 'var(--surface)' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.86rem', color: 'var(--text-strong)' }}>{JOB_DOOR_WORDS.head(who)}</strong>
        <span style={muted} data-testid="my-mail-job-line-count">
          {JOB_DOOR_WORDS.count(left)}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {door.rows.map((r) => {
          const ok = done[r.threadId]
          return (
            <div
              key={r.threadId}
              data-testid={`my-mail-job-line-row-${r.threadId}`}
              data-done={ok ? 'true' : undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: narrow ? 'auto 1fr' : 'auto 1fr auto',
                columnGap: 10,
                rowGap: 4,
                alignItems: 'center',
                padding: '4px 6px',
                borderRadius: 8,
                fontSize: '0.84rem',
                ...(ok ? { background: 'var(--bg-green-tint)' } : {}),
              }}
            >
              <span aria-label={ok ? JOB_DOOR_WORDS.done(job.num) : r.row.direction === 'out' ? JOB_DOOR_WORDS.wentOut : JOB_DOOR_WORDS.cameIn} style={{ color: ok ? 'var(--text-green-700)' : 'var(--text-muted)', fontWeight: 700 }}>
                {ok ? '✓' : r.row.direction === 'out' ? '↑' : '↓'}
              </span>
              <span style={{ minWidth: 0, display: 'grid' }}>
                <span style={{ ...oneLine, color: 'var(--text-strong)', fontWeight: 600 }}>{r.row.subject}</span>
                <span style={{ ...muted, ...oneLine }}>{ok ? [JOB_DOOR_WORDS.done(job.num), taggedWords(ok)].join(' · ') : jobDoorRowFacts(r, rowDay(r.row, now)).join(' · ')}</span>
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', ...(narrow ? { gridColumn: '2 / -1' } : {}) }}>
                {ok ? (
                  ok.contactId && onOpenThread ? (
                    <button type="button" onClick={() => onOpenThread(ok.contactId as string)} style={doorPress}>
                      {JOB_DOOR_WORDS.openThread}
                    </button>
                  ) : null
                ) : (
                  <Btn kind="primary" onClick={() => void yes(r)} disabled={busy !== null} title={JOB_DOOR_WORDS.yesTip(job.num)}>
                    {busy === r.threadId ? '…' : JOB_DOOR_WORDS.yes}
                  </Btn>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {problem ? (
        <p role="alert" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>
          {problem}
        </p>
      ) : null}
      <p style={{ margin: 0, ...muted, fontStyle: 'italic' }}>
        {JOB_DOOR_WORDS.quiet}{' '}
        {door.more > 0 ? <span data-testid="my-mail-job-line-more">{`${door.more} more. `}</span> : null}
        {onOpenHref ? (
          <button type="button" onClick={() => onOpenHref(href)} style={{ ...doorPress, fontStyle: 'normal' }} data-testid="my-mail-job-line-door">
            {JOB_DOOR_WORDS.door(who)}
          </button>
        ) : (
          <a href={href} style={{ color: 'var(--text-link)', fontStyle: 'normal', fontWeight: 600 }} data-testid="my-mail-job-line-door">
            {JOB_DOOR_WORDS.door(who)}
          </a>
        )}
      </p>
    </section>
  )
}

const doorPress: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }
