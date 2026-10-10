/**
 * GC mode design spike: "Trades say they will be late" on the Schedule tab, the Gantt's Phase 3
 * (G-117; mock-up `to-dos/gc-mode/mockups/G-117.md`). Each notice a company sent from its portal,
 * with what it says, when it came against the day it changes, and what taking it does. Take opens
 * Why it moved with the company's day, reason and words; Push back sends the office's words to the
 * company's portal. Nothing on the chart moves until one of the two.
 *
 * The prototype's copy, forked to `.proto` when the schedule's PR 14c put the office's side on main at
 * `GcLateNotices.tsx` (#5358); the prototype's Schedule tab reads this one.
 */
import { useState, type Dispatch } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { weekdayDate, type GcAction, type GcProject, type GcState } from '../../lib/gcMode/gcModel'
import { lateDayAsked, lateDayChanged, lateNoticeMove, lateNoticeRows, type LateNoticeRow } from '../../lib/gcMode/gcLateNotices'
import { MOVE_NOTE_MIN } from '../../lib/gcMode/gcScheduleMoves'
import { partnerReach, telHref } from '../../lib/gcMode/gcFollowUpSheet'
import { Btn, Card, Chip, input } from './gcUi'
import type { PendingMove } from './GcScheduleMoves.proto'

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

export function GcLateNotices({ state, project, dispatch, onTake }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onTake: (move: PendingMove) => void }) {
  const me = useMeName() ?? 'The office'
  const rows = lateNoticeRows(state, project)
  const [pushing, setPushing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  if (rows.length === 0) return null
  const open = rows.filter((r) => r.state === 'open').length
  return (
    <Card dataTour="gc-late-notices">
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong>Trades say they will be late ({rows.length})</strong>
        {open > 0 && <Chip tone="amber">{open} to answer</Chip>}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Each came from the trade's portal. Take the new day as a move, or push back. Nothing moves until you do.</span>
      </div>
      <div style={{ display: 'grid' }}>
        {rows.map((r) => (
          <Row
            key={r.notice.id}
            r={r}
            pushing={pushing === r.notice.id}
            note={note}
            onNote={setNote}
            onTake={() => {
              const move = lateNoticeMove(state, project, r.notice)
              if (move) onTake(move)
            }}
            onPush={() => {
              setPushing(r.notice.id)
              setNote('')
            }}
            onBack={() => setPushing(null)}
            onSend={() => {
              dispatch({ type: 'pushBackLateNotice', projectId: project.id, noticeId: r.notice.id, note: note.trim(), by: me })
              setPushing(null)
            }}
          />
        ))}
      </div>
    </Card>
  )
}

function Row({
  r,
  pushing,
  note,
  onNote,
  onTake,
  onPush,
  onBack,
  onSend,
}: {
  r: LateNoticeRow
  pushing: boolean
  note: string
  onNote: (note: string) => void
  onTake: () => void
  onPush: () => void
  onBack: () => void
  onSend: () => void
}) {
  const reach = partnerReach(r.partner)
  const day = lateDayChanged(r.notice)
  const short = note.trim().length < MOVE_NOTE_MIN
  return (
    <div data-late-notice={r.notice.id} style={{ display: 'grid', gap: '0.2rem', padding: '0.55rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>{r.partner.company}</strong>
        <span>· {r.name}</span>
        <Chip tone="grey">{r.reason}</Chip>
        {r.state === 'pushedBack' && <Chip tone="amber">pushed back</Chip>}
        {r.state === 'kept' && <Chip tone="green">will make it</Chip>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.8rem', color: r.late ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{r.sent}</span>
      </div>
      <div>{r.says}</div>
      <div>
        “{r.notice.note}” <span style={{ color: 'var(--text-muted)' }}>{r.notice.by}</span>
      </div>
      {r.ifTaken && <div style={{ color: r.finishMoves ? 'var(--text-red-700)' : 'var(--text-600)', fontWeight: r.finishMoves ? 600 : 400 }}>{r.ifTaken}</div>}
      {r.notice.pushedBack && (
        <div>
          <span style={{ color: 'var(--text-muted)' }}>We said: </span>“{r.notice.pushedBack.note}” <span style={{ color: 'var(--text-muted)' }}>{r.notice.pushedBack.by}</span>
        </div>
      )}
      {r.answer && <div style={{ color: r.state === 'kept' ? 'var(--text-green-800)' : 'var(--text-amber-800)' }}>{r.answer}</div>}
      {r.state === 'open' && !pushing && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
          <Btn kind="primary" onClick={onTake} title="Opens Why it moved with their day, their reason and their words. You can change either before you save.">
            Take {weekdayDate(lateDayAsked(r.notice))}
          </Btn>
          <Btn kind="plain" onClick={onPush} title="Their day stays as drawn. Your words go to their portal.">
            Push back
          </Btn>
          <a href={telHref(reach.phone)} style={{ color: 'var(--text-link)', fontSize: '0.85rem' }}>
            Call {reach.first}
          </a>
        </div>
      )}
      {r.state === 'open' && pushing && (
        <div style={{ display: 'grid', gap: '0.4rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem', marginTop: '0.2rem' }}>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={label}>What you need from them</span>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => onNote(e.target.value)}
              rows={2}
              placeholder="We need the day as drawn. The next trade is booked that week."
              style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
            />
          </label>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            It goes to {r.partner.company} in its portal. {r.work} keeps its {r.notice.started ? 'finish' : 'start'}, {weekdayDate(day)}.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn kind="primary" disabled={short} onClick={onSend}>
              Send it to {r.partner.company}
            </Btn>
            <Btn kind="quiet" onClick={onBack}>
              Back
            </Btn>
            {short && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Say what you need, in a sentence.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
