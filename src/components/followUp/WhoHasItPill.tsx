/**
 * Messages, cut 2: who has a conversation (v1.90). A pill on a Follow up row and in the thread's header: *You have this*,
 * *Rosa has this* or *Nobody has it · Take it*, its hover saying since when. Pressing it lists the team (*I'll take it*
 * first when it is not yours, each teammate with what they hold open, *Nobody* to put it back); a press takes or hands
 * it on, and the thread records the change (`take_it`, `hand_to`). The words are `followUp/queue.ts`'s.
 *
 * Punch list #141 PR 4 (v2.6060): with the team's Push me hours (`pushHours`), the pill says when whoever has it is off,
 * *Rosa has this · off until 6 AM*, and when nobody has it and every office member is, *the office is off until 6 AM*;
 * the hover says what that means (`messages/whoIsOff.ts`). Without the hours, or with nobody off, it reads as before.
 */
import { useEffect, useRef, useState } from 'react'
import type { FollowUpContact } from '../../lib/followUp/followUpRows'
import { hasPillWords, hasSinceWords, holdCount, takeItWords, whoPickerHead, type QueueContact } from '../../lib/followUp/queue'
import { exactStamp } from '../../lib/messages/owed'
import { whenWords } from '../../lib/messages/thread'
import type { PushHoursByUser } from '../../lib/messages/pushHours'
import { offPillTip, offPillWords, threadOff } from '../../lib/messages/whoIsOff'
import type { Teammate } from '../../lib/followUp/team'

export type { Teammate }

export interface WhoHasItPillProps {
  contact: FollowUpContact
  me: Teammate
  team: readonly Teammate[]
  /** Everyone Follow up reads, for what each teammate holds open. */
  everyone: readonly QueueContact[]
  todayYmd: string
  nowIso: string
  /** Hands it to someone, or puts it back (null). Taking it is handing it to me. */
  onHand: (userId: string | null) => void
  busy?: boolean
  /** In the thread's header (v2.5542): the header's control class in place of the border, one 28px height; the tint still says it is yours. */
  bare?: boolean
  /** The team's Push me hours (v2.6060), for the off words; none reads as nobody off. */
  pushHours?: PushHoursByUser
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')
    .slice(0, 2)

const ROLE_WORDS: Readonly<Record<string, string>> = {
  dev: 'dev',
  master_technician: 'owner',
  assistant: 'office',
  controller: 'controller',
  estimator: 'estimator',
  superintendent: 'superintendent',
}

export function WhoHasItPill({ contact, me, team, everyone, todayYmd, nowIso, onHand, busy, bare, pushHours }: WhoHasItPillProps) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const mine = contact.hasUserId === me.id
  const since = contact.hasSince ? hasSinceWords(whenWords(contact.hasSince, nowIso), exactStamp(contact.hasSince)) : ''
  const holderName = contact.has ? (mine ? me.name : contact.has) : null
  // Who is off (v2.6060): the holder by their hours, or the whole office when nobody has it. An unread row is any time.
  const off = pushHours
    ? threadOff({ holderId: contact.has ? (contact.hasUserId ?? '') : null, holderName, mine, officeIds: [...team.map((t) => t.id), me.id], hours: pushHours, now: nowIso })
    : null
  // Nobody has it and the office is off: the off words in place of *Take it*, which the hover keeps.
  const label = off?.kind === 'office' ? `Nobody has it · ${offPillWords(off)}` : `${hasPillWords(me.name, holderName)}${off ? ` · ${offPillWords(off)}` : ''}`
  const tip = !contact.has
    ? `${off ? `${offPillTip(off)} ` : 'Nobody has it. Whoever answers first takes it. '}Press to take it or hand it to someone.`
    : off
      ? `${offPillTip(off)}${since ? ` ${since}` : ''}`
      : `${mine ? 'You claimed it, so the team leaves it to you.' : `${contact.has} claimed it, so nobody else answers it.`}${since ? ` ${since}` : ''}`
  const pick = (userId: string | null) => {
    setOpen(false)
    if (userId !== contact.hasUserId) onHand(userId)
  }
  const sinceShort = contact.hasSince ? exactStamp(contact.hasSince) : null

  return (
    <span ref={box} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title={tip}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className={bare ? 'thread-head-control' : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: bare ? '0 0.55rem 0 0.15rem' : '0.15rem 0.6rem 0.15rem 0.2rem',
          borderRadius: 999,
          border: bare ? undefined : '1px solid var(--border-strong)',
          background: mine ? 'var(--bg-blue-tint)' : bare ? undefined : 'var(--surface)',
          color: 'var(--text-base)',
          fontSize: '0.8rem',
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: 999,
            background: contact.has ? 'var(--bg-blue-200)' : 'var(--bg-muted)',
            color: contact.has ? 'var(--text-blue-800)' : 'var(--text-muted)',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}
        >
          {contact.has ? initials(mine ? me.name : contact.has) : '?'}
        </span>
        {label}
      </button>
      {open && (
        <span
          role="menu"
          aria-label={`Who has ${contact.name}`}
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 20,
            width: 280,
            maxWidth: '85vw',
            display: 'grid',
            gap: 2,
            padding: '0.4rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.2rem 0.3rem' }}>
            {whoPickerHead(me.name, contact.name, contact.has ? (mine ? me.name : contact.has) : null, sinceShort)}
          </span>
          {!mine && <PickerRow name="I'll take it" words={takeItWords(contact.has)} avatar={initials(me.name)} onPick={() => pick(me.id)} />}
          {team
            .filter((t) => t.id !== me.id)
            .map((t) => {
              const holds = holdCount(everyone, t.name, todayYmd)
              return (
                <PickerRow
                  key={t.id}
                  name={t.name}
                  on={contact.hasUserId === t.id}
                  words={`${ROLE_WORDS[t.role] ?? t.role} · holds ${holds} waiting`}
                  avatar={initials(t.name)}
                  onPick={() => pick(t.id)}
                />
              )
            })}
          {contact.has && <PickerRow name="Nobody" words="Put it back for whoever answers first." avatar="?" onPick={() => pick(null)} />}
        </span>
      )}
    </span>
  )
}

function PickerRow({ name, words, avatar, on, onPick }: { name: string; words: string; avatar: string; on?: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={Boolean(on)}
      onClick={onPick}
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr',
        gap: '0.5rem',
        alignItems: 'center',
        textAlign: 'left',
        padding: '0.35rem 0.4rem',
        border: 'none',
        borderRadius: 6,
        background: on ? 'var(--bg-blue-tint)' : 'transparent',
        color: 'var(--text-base)',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 999, background: 'var(--bg-muted)', fontSize: '0.7rem', fontWeight: 700 }}>
        {avatar}
      </span>
      <span style={{ display: 'grid' }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
          {name}
          {on ? ' · has it now' : ''}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{words}</span>
      </span>
    </button>
  )
}
