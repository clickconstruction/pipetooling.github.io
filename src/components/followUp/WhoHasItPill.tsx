/**
 * Messages, cut 2: who has a conversation (v1.90). A pill on a Follow up row and in the thread's header: *Rosa has this*
 * (the holder by name, yourself included, since v2.6521) or *Nobody has it · Take it*, its hover saying since when. Pressing it lists the team (*I'll take it*
 * first when it is not yours, each teammate with what they hold open, *Nobody* to put it back); a press takes or hands
 * it on, and the thread records the change (`take_it`, `hand_to`). The words are `followUp/queue.ts`'s.
 *
 * Punch list #141 PR 4 (v2.6060): with the team's Push me hours (`pushHours`), the pill says when whoever has it is off,
 * *Rosa has this · off until 6 AM*, and when nobody has it and every office member is, *the office is off until 6 AM*;
 * the hover says what that means (`messages/whoIsOff.ts`). Without the hours, or with nobody off, it reads as before.
 *
 * On a kept row (punch list #183 PR 5, `held`) the pill is inert under `keptPress` with the hover *reading again…*:
 * Take it and a hand-off act on who has it now, which the device's kept read cannot say.
 *
 * The menu (v2.6506, Grace's ask): a search box on top, focused on open unless the screen is a phone's (the keyboard
 * would jump), typing narrowing the list by name with the run lit; the team in three groups under thin headings,
 * the office and the estimators first, then the owner and the devs, then anyone else, each by name
 * (`messages/handToOrder.ts`); ↓ and ↑ walk the rows, Enter hands it to the lit one, Escape closes. With nothing
 * typed the first row is *I'll take it*, so Enter alone takes it. The samples, the twins and the walk tester are
 * not on the team the reads hand in (`loadGcTeam`, `followUpThreadIo.loadTeam`).
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { FollowUpContact } from '../../lib/followUp/followUpRows'
import { hasPillWords, hasSinceWords, holdCount, takeItWords, whoPickerHead, type QueueContact } from '../../lib/followUp/queue'
import { READING_AGAIN_WORDS } from '../../lib/keptRead'
import { exactStamp } from '../../lib/messages/owed'
import { whenWords } from '../../lib/messages/thread'
import type { PushHoursByUser } from '../../lib/messages/pushHours'
import { offPillTip, offPillWords, threadOff } from '../../lib/messages/whoIsOff'
import type { Teammate } from '../../lib/followUp/team'
import { filterHandTo, nextLit, orderHandTo } from '../../lib/messages/handToOrder'
import { splitTextForQueryHighlight } from '../../lib/assignJobPickerHighlight'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { EmptyState } from '../EmptyState'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'

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
  /** The row is a kept read (#183 PR 5): the pill waits, inert, with *reading again…* as its hover, until the live read lands. */
  held?: boolean
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

const MENU_WIDTH = 280

const ROLE_WORDS: Readonly<Record<string, string>> = {
  dev: 'dev',
  master_technician: 'owner',
  assistant: 'office',
  controller: 'controller',
  estimator: 'estimator',
  superintendent: 'superintendent',
}

export function WhoHasItPill({ contact, me, team, everyone, todayYmd, nowIso, onHand, busy, held, bare, pushHours }: WhoHasItPillProps) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const phone = useNarrowViewport640()
  const menuId = useId()
  // The search (v2.6506): the typed run and the lit row, both fresh on every open.
  const [query, setQuery] = useState('')
  const [lit, setLit] = useState(0)
  // The menu hangs from the pill's right edge, as a desktop row draws the pill at the right; on a phone the pill
  // wraps to the row's left and a right-hung menu runs off the screen, so it hangs from the left when the right would not fit.
  const [fromLeft, setFromLeft] = useState(false)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])
  useEffect(() => {
    if (!open) return
    setQuery('')
    setLit(0)
    const at = box.current?.getBoundingClientRect()
    setFromLeft(Boolean(at && at.right - MENU_WIDTH < 8))
    // On a phone the keyboard would jump up over the list, so the box waits for a tap.
    if (!phone) input.current?.focus()
  }, [open, phone])

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
  const typed = query.trim() !== ''
  const groups = useMemo(() => filterHandTo(orderHandTo(team.filter((t) => t.id !== me.id)), query), [team, me.id, query])
  // The rows the keys walk, in the order the menu draws them: *I'll take it* and *Nobody* only while nothing is typed.
  const rows = useMemo<Array<{ key: string; userId: string | null }>>(
    () => [
      ...(!mine && !typed ? [{ key: 'take', userId: me.id }] : []),
      ...groups.flatMap((g) => g.people.map((t) => ({ key: t.id, userId: t.id }))),
      ...(contact.has && !typed ? [{ key: 'nobody', userId: null }] : []),
    ],
    [mine, typed, me.id, groups, contact.has],
  )
  const rowIndex = (key: string) => rows.findIndex((r) => r.key === key)
  const rowId = (key: string) => `${menuId}-${key}`
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setLit((i) => nextLit(i, rows.length, e.key === 'ArrowDown' ? 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[lit]
      if (row) pick(row.userId)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }
  const litRow = rows[lit]
  const sinceShort = contact.hasSince ? exactStamp(contact.hasSince) : null
  const className = [bare ? 'thread-head-control' : '', held ? 'keptPress' : ''].filter(Boolean).join(' ') || undefined

  return (
    <span ref={box} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title={held ? READING_AGAIN_WORDS : tip}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy || held}
        data-held={held ? '' : undefined}
        onClick={() => setOpen((o) => !o)}
        className={className}
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
          cursor: busy ? 'wait' : held ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          // `keptPress` mutes it and would switch its pointer events off. They stay on: the hover must show, and a press
          // on the dead pill must not fall through to the row, which would open the thread.
          ...(held ? { pointerEvents: 'auto' as const } : {}),
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
            ...(fromLeft ? { left: 0 } : { right: 0 }),
            top: 'calc(100% + 4px)',
            zIndex: 20,
            width: MENU_WIDTH,
            maxWidth: '85vw',
            display: 'grid',
            gap: 2,
            padding: '0.4rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.2rem 0.3rem' }}>
            {whoPickerHead(me.name, contact.name, contact.has ? (mine ? me.name : contact.has) : null, sinceShort)}
          </span>
          <input
            ref={input}
            type="text"
            inputMode="search"
            enterKeyHint="go"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLit(0)
            }}
            onKeyDown={onKey}
            placeholder="Type a name"
            aria-label="Find a teammate"
            aria-activedescendant={litRow ? rowId(litRow.key) : undefined}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.4rem 0.6rem',
              margin: '0 0 0.2rem',
              fontSize: '0.85rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--bg-subtle)',
              color: 'var(--text-strong)',
            }}
          />
          {!mine && !typed && (
            <PickerRow id={rowId('take')} name="I'll take it" words={takeItWords(contact.has)} avatar={initials(me.name)} lit={lit === rowIndex('take')} onLight={() => setLit(rowIndex('take'))} onPick={() => pick(me.id)} />
          )}
          {groups.map((g, gi) => (
            <span key={g.key} role="group" aria-label={g.heading} style={{ display: 'grid', gap: 2 }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: 'var(--text-muted)',
                  padding: '0.35rem 0.3rem 0.1rem',
                  marginTop: gi === 0 && (mine || typed) ? 0 : '0.2rem',
                  borderTop: gi === 0 && (mine || typed) ? 'none' : '1px solid var(--border)',
                }}
              >
                {g.heading}
              </span>
              {g.people.map((t) => {
                const holds = holdCount(everyone, t.name, todayYmd)
                return (
                  <PickerRow
                    key={t.id}
                    id={rowId(t.id)}
                    name={t.name}
                    query={query}
                    on={contact.hasUserId === t.id}
                    words={`${ROLE_WORDS[t.role] ?? t.role} · holds ${holds} waiting`}
                    avatar={initials(t.name)}
                    lit={lit === rowIndex(t.id)}
                    onLight={() => setLit(rowIndex(t.id))}
                    onPick={() => pick(t.id)}
                  />
                )
              })}
            </span>
          ))}
          {typed && groups.length === 0 && <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'teammates', query }), { onPress: () => setQuery('') })} />}
          {contact.has && !typed && <PickerRow id={rowId('nobody')} name="Nobody" words="Put it back for whoever answers first." avatar="?" lit={lit === rowIndex('nobody')} onLight={() => setLit(rowIndex('nobody'))} onPick={() => pick(null)} />}
        </span>
      )}
    </span>
  )
}

/** The Jobs page's amber mark on the typed run; `display: inline` said outright and the rest bare text, so the row's name reads whole to a screen reader (and to the smoke). */
const LIT_RUN = { display: 'inline', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 2, padding: 0, fontWeight: 700 } as const

function PickerRow({ id, name, query = '', words, avatar, on, lit, onLight, onPick }: { id: string; name: string; query?: string; words: string; avatar: string; on?: boolean; lit: boolean; onLight: () => void; onPick: () => void }) {
  const self = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (lit) self.current?.scrollIntoView?.({ block: 'nearest' })
  }, [lit])
  return (
    <button
      ref={self}
      id={id}
      type="button"
      role="menuitemradio"
      aria-checked={Boolean(on)}
      data-lit={lit ? '' : undefined}
      onClick={onPick}
      onMouseEnter={onLight}
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr',
        gap: '0.5rem',
        alignItems: 'center',
        textAlign: 'left',
        padding: '0.35rem 0.4rem',
        border: 'none',
        borderRadius: 6,
        background: on ? 'var(--bg-blue-tint)' : lit ? 'var(--bg-muted)' : 'transparent',
        color: 'var(--text-base)',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 999, background: 'var(--bg-muted)', fontSize: '0.7rem', fontWeight: 700 }}>
        {avatar}
      </span>
      <span style={{ display: 'grid' }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
          {splitTextForQueryHighlight(name, query).map((seg, i) => (seg.match ? <mark key={i} style={LIT_RUN}>{seg.text}</mark> : <Fragment key={i}>{seg.text}</Fragment>))}
          {on ? ' · has it now' : ''}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{words}</span>
      </span>
    </button>
  )
}
