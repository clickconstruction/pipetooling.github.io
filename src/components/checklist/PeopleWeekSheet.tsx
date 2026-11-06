import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  PEOPLE_WEEK_DEFAULT_TIME,
  PEOPLE_WEEK_DEFAULT_WEEKDAY,
  PEOPLE_WEEK_PEOPLE_MAX,
  peopleWeekChainWords,
  peopleWeekChains,
  planPeopleWeekEdit,
  type PeopleWeekChain,
  type PeopleWeekInsert,
  type PeopleWeekRequestRow,
} from '../../lib/peopleWeek'
import { applyPeopleWeekPlan, listPeopleWeekRequests, loadPeopleToPick, previewPeopleWeek, sendPeopleWeekTest } from '../../lib/peopleWeekIo'

/**
 * Your people's week (punch list #273, PR 5): the sheet behind **✉ Email me their week** on Checklist → Review and
 * **✉ Get this every Monday** on the Dashboard's Your people card. Pick the people, the days and the time; Start it
 * makes one weekly chain per weekday (`planPeopleWeekEdit`, the statement round's shape), Stop it ends them. See the
 * email as it would go now and Email me a test go through the dispatcher's JWT modes. The reads and writes come in as
 * `io` so a test can stand them in.
 */
export interface PeopleWeekIo {
  list: () => Promise<PeopleWeekRequestRow[]>
  apply: (plan: { inserts: PeopleWeekInsert[]; cancelIds: string[] }) => Promise<void>
  preview: (peopleUserIds: string[]) => Promise<{ subject: string; html: string }>
  test: (peopleUserIds: string[]) => Promise<void>
  /** Everyone the office may pick, by name. */
  people: () => Promise<{ id: string; name: string }[]>
}

export const peopleWeekIo: PeopleWeekIo = {
  list: listPeopleWeekRequests,
  apply: applyPeopleWeekPlan,
  preview: previewPeopleWeek,
  test: sendPeopleWeekTest,
  people: loadPeopleToPick,
}

const DAYS: { dow: number; label: string }[] = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
]

export function PeopleWeekSheet({
  open,
  onClose,
  meId,
  canPickOthers,
  suggested,
  io = peopleWeekIo,
}: {
  open: boolean
  onClose: () => void
  meId: string | null
  /** The office (`is_dev_or_master_or_assistant()`) picks anyone; everyone else gets their own week. */
  canPickOthers: boolean
  /** The people the screen was showing, picked when the sheet opens with no chain yet. */
  suggested: string[]
  io?: PeopleWeekIo
}) {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<PeopleWeekRequestRow[] | null>(null)
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [days, setDays] = useState<number[]>([PEOPLE_WEEK_DEFAULT_WEEKDAY])
  const [time, setTime] = useState(PEOPLE_WEEK_DEFAULT_TIME)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, who] = await Promise.all([io.list(), canPickOthers ? io.people() : Promise.resolve([] as { id: string; name: string }[])])
      setRows(list)
      setPeople(who)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The Monday emails did not load.'))
      setRows([])
      setPeople([])
    }
  }, [io, canPickOthers])

  useEffect(() => {
    if (!open) return
    setRows(null)
    setPeople(null)
    setProblem(null)
    setNote(null)
    setPreview(null)
    setFilter('')
    void load()
  }, [open, load])

  const chains = useMemo(() => peopleWeekChains(rows ?? []), [rows])
  const current: PeopleWeekChain | null = chains[0] ?? null

  // Opening shows the chain as it stands, or the screen's people on Monday at 6 for a first one.
  useEffect(() => {
    if (!open || rows === null) return
    if (current) {
      setPicked(current.peopleUserIds)
      setDays(current.weekdays)
      setTime(current.timeHm)
    } else {
      setPicked(canPickOthers ? suggested.slice(0, PEOPLE_WEEK_PEOPLE_MAX) : meId ? [meId] : [])
      setDays([PEOPLE_WEEK_DEFAULT_WEEKDAY])
      setTime(PEOPLE_WEEK_DEFAULT_TIME)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rows, current])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const nameOf = (id: string) => (id === meId ? 'you' : (people ?? []).find((p) => p.id === id)?.name || '')
  const shown = (people ?? []).filter((p) => !filter.trim() || p.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const togglePerson = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= PEOPLE_WEEK_PEOPLE_MAX ? p : [...p, id]))
  const toggleDay = (dow: number) => setDays((d) => (d.includes(dow) ? d.filter((x) => x !== dow) : [...d, dow]))

  const run = async (key: string, work: () => Promise<void>, failed: string) => {
    setBusy(key)
    setProblem(null)
    setNote(null)
    try {
      await work()
    } catch (e) {
      setProblem(formatErrorMessage(e, failed))
    } finally {
      setBusy(null)
    }
  }
  const save = () => {
    if (!meId) return
    const plan = planPeopleWeekEdit({ userId: meId, peopleUserIds: picked, desiredWeekdays: days, desiredTimeHm: time, current })
    if (!plan.ok) {
      setProblem(plan.error)
      return
    }
    void run(
      'save',
      async () => {
        await io.apply(plan)
        await load()
        setNote(days.length === 0 ? 'It stopped.' : 'Saved. The first one comes on the next day you picked.')
      },
      'The Monday email was not saved.',
    )
  }
  const stop = () => {
    if (!current) return
    void run(
      'stop',
      async () => {
        await io.apply({ inserts: [], cancelIds: current.allRowIds })
        await load()
        setNote('It stopped.')
      },
      'The Monday email did not stop.',
    )
  }

  const stopping = days.length === 0 && current !== null
  const canSave = busy === null && meId !== null && (stopping || (picked.length > 0 && days.length > 0))
  const saveWords = busy === 'save' ? '…' : stopping ? 'Stop it' : current ? 'Save the change' : picked.length === 0 ? 'Pick who' : days.length === 0 ? 'Pick a day' : 'Start it'

  const panel: CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxHeight: '90vh', overflowY: 'auto' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', borderRadius: 16, padding: '16px 18px' }
  const chip = (on: boolean): CSSProperties => ({
    padding: '0.3rem 0.65rem',
    borderRadius: 999,
    fontSize: '0.85rem',
    cursor: 'pointer',
    border: '1px solid var(--border-strong)',
    background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
    color: on ? 'var(--text-blue-800)' : 'var(--text-base)',
    fontWeight: on ? 600 : 400,
  })
  const quiet: CSSProperties = { padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }
  const label: CSSProperties = { display: 'grid', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1200, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-week-sheet-title"
        onClick={(e) => e.stopPropagation()}
        style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)', boxSizing: 'border-box', display: 'grid', gap: '0.75rem', alignContent: 'start' }}
        data-testid="people-week-sheet"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id="people-week-sheet-title" style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            Your people’s week
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
            ×
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          One email each week about the people you pick: the cards they moved or finished, the lines ticked, the photos taken, their roadmap tasks and the jobs they clocked on, for the week just finished.
        </p>

        {problem ? (
          <div role="alert" style={{ fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
            {problem}
          </div>
        ) : null}

        {rows === null ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</div>
        ) : current ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem', padding: '0.5rem 0.65rem', borderRadius: 10, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' }} data-testid="people-week-standing">
            <span style={{ flex: 1, minWidth: 0 }}>You get it: {peopleWeekChainWords(current, nameOf)}</span>
            <button type="button" onClick={stop} disabled={busy !== null} style={quiet}>
              Stop it
            </button>
          </div>
        ) : null}

        {canPickOthers ? (
          <div style={label}>
            <span>
              Who is in it · {picked.length} of {PEOPLE_WEEK_PEOPLE_MAX} at most
            </span>
            {(people ?? []).length > 10 ? (
              <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a name" aria-label="Find a name" style={{ height: 36, padding: '0 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, boxSizing: 'border-box' }} />
            ) : null}
            <div role="group" aria-label="The people in it" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', maxHeight: 180, overflowY: 'auto', padding: '2px 0' }}>
              {people === null ? (
                <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
              ) : (
                shown.map((p) => (
                  <button key={p.id} type="button" aria-pressed={picked.includes(p.id)} onClick={() => togglePerson(p.id)} style={chip(picked.includes(p.id))}>
                    {p.id === meId ? `${p.name || 'Me'} (me)` : p.name || 'Someone'}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>It is about your own week.</div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={label}>
            The days
            <div role="group" aria-label="The days it goes" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {DAYS.map((d) => (
                <button key={d.dow} type="button" aria-pressed={days.includes(d.dow)} onClick={() => toggleDay(d.dow)} style={chip(days.includes(d.dow))}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <label style={label}>
            At, Central time
            <input aria-label="The time it goes" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ height: 36, padding: '0 0.5rem', fontSize: '0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, boxSizing: 'border-box' }} />
          </label>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          style={{ width: '100%', height: 46, borderRadius: 12, border: 'none', fontSize: '1rem', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', background: canSave ? (stopping ? '#b91c1c' : '#2563eb') : DEAD_PRESS_FILL, color: canSave ? 'white' : DEAD_PRESS_TEXT }}
        >
          {saveWords}
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <button
            type="button"
            disabled={busy !== null || picked.length === 0}
            style={{ ...quiet, cursor: busy !== null || picked.length === 0 ? 'not-allowed' : 'pointer' }}
            onClick={() =>
              void run(
                'preview',
                async () => {
                  setPreview(await io.preview(picked))
                },
                'The email did not load.',
              )
            }
          >
            {busy === 'preview' ? '…' : 'See the email as it would go now'}
          </button>
          <button
            type="button"
            disabled={busy !== null || picked.length === 0}
            style={{ ...quiet, cursor: busy !== null || picked.length === 0 ? 'not-allowed' : 'pointer' }}
            onClick={() =>
              void run(
                'test',
                async () => {
                  await io.test(picked)
                  setNote('A test went to your email.')
                },
                'The test did not go.',
              )
            }
          >
            {busy === 'test' ? '…' : 'Email me a test'}
          </button>
          {note ? <span style={{ color: 'var(--text-muted)' }}>{note}</span> : null}
        </div>

        {preview ? (
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{preview.subject}</div>
            {/* The email's own page, sandboxed, and light as an inbox shows it. */}
            <div data-theme="light">
              <iframe title="Your people’s week, as it would go now" sandbox="" srcDoc={preview.html} style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} />
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
