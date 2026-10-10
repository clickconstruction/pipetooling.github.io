/**
 * GC mode, the real build, the schedule's PR 14c: "Trades say they will be late" on the Schedule window (G-117; the plan
 * is to-dos/gc-mode/mockups/schedule-pr14.md on branch spike/gc-mode). Ported from the GC mode prototype's
 * `GcLateNotices.tsx`, its words kept: each notice a company sent from its portal, with what it says, when it came
 * against the day it changes, and what taking it does. **Take** opens Why it moved with the company's day, reason and
 * words, and the move names the notice; **Push back** sends the office's words to the company's portal. Nothing on the
 * chart moves until one of the two. The prototype dispatched the push back to its reducer; here it is a callback the
 * Schedule window carries to the database.
 */
import { useState, type ReactNode } from 'react'
import { partnerReach, telHref } from '../../lib/gc/followUpSheet'
import { lateDayAsked, lateDayChanged, lateNoticeMove, lateNoticeRows, type LateNoticeRow } from '../../lib/gc/schedule/lateNotices'
import { MOVE_NOTE_MIN } from '../../lib/gc/schedule/moves'
import type { GcProject, GcState } from '../../lib/gc/types'
import { weekdayDate } from '../../lib/gc/words'
import { PressNote } from './GcScheduleCards'
import type { PendingMove } from './GcScheduleMoves'
import { Btn, Card, Chip, input } from './gcUi'
import { useSchedulePress } from './useSchedulePress'

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

export function GcLateNotices({
  state,
  project,
  onTake,
  onPushBack,
  onReload,
}: {
  state: GcState
  project: GcProject
  /** Take: Why it moved, filled in with the notice. */
  onTake: (move: PendingMove) => void
  /** Push back: the office's words to the company, today. Throws the database's refusal. */
  onPushBack: (noticeId: string, note: string) => Promise<void>
  onReload?: () => void
}) {
  const rows = lateNoticeRows(state, project)
  const [pushing, setPushing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const press = useSchedulePress(onReload)
  // Sent, the form closes; refused, it stays open with the person's words.
  const send = async (noticeId: string) => {
    if (await press.run(() => onPushBack(noticeId, note.trim()), 'The push back did not send.')) setPushing(null)
  }
  if (rows.length === 0) return null
  const open = rows.filter((r) => r.state === 'open').length
  return (
    <Card dataTour="gc-late-notices">
      <div data-late-notices style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
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
            busy={press.busy}
            said={pushing === r.notice.id ? <PressNote refused={press.refused} failed={press.failed} /> : null}
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
            onSend={() => void send(r.notice.id)}
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
  busy,
  said,
  onNote,
  onTake,
  onPush,
  onBack,
  onSend,
}: {
  r: LateNoticeRow
  pushing: boolean
  note: string
  busy: boolean
  said: ReactNode
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
            <Btn kind="primary" disabled={short || busy} onClick={onSend}>
              {busy ? 'Sending…' : `Send it to ${r.partner.company}`}
            </Btn>
            <Btn kind="quiet" onClick={onBack}>
              Back
            </Btn>
            {short && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Say what you need, in a sentence.</span>}
          </div>
          {said}
        </div>
      )}
    </div>
  )
}
