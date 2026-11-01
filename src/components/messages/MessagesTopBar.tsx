/**
 * Messages' one-row header (punch list #151 PR 2, v2.5801): option C of the header mock-ups. One bar at the top of
 * `/messages` that stays pinned on a desktop: the title, the kind picker (`KIND_PILLS` behind one button that reads
 * the pick), Show's Mine · Everyone, the search glass that opens the box under the bar, the jump strip
 * (`MessagesJumpStrip`, PR 1, measuring this bar as what is pinned) and **7 days**, which opens The last 7 days under
 * the bar and stays as you left it on this browser. On a phone (`phone`) the controls take a row that scrolls away and
 * the strip sticks on its own, as one line. The words and the fold's memory: `lib/messages/topBar.ts`.
 *
 * Since punch list #230 PR 3 the title is followed by two tabs, **Follow up · My email** (`tabs`, a `tablist`, the
 * pressed one filled), drawn while the person's own switch is on. While My email is open the bar keeps the title, the
 * tabs and the ?, and leaves out the kind picker, Show, the glass, the strip and 7 days: those are Follow up's, and
 * the tab has its own search.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Search } from 'lucide-react'
import { KIND_PILLS, type KindPill } from '../../lib/messages/kindPills'
import { SHOW_WORDS, type ShowLens } from '../../lib/messages/showLens'
import type { JumpCounts, JumpLane } from '../../lib/messages/jumpStrip'
import { pickerLabel, TOP_BAR_WORDS } from '../../lib/messages/topBar'
import { LEGEND_WORDS } from '../../lib/messages/laneLegend'
import { MESSAGES_TABS, type MessagesTab } from '../../lib/myMail/tab'
import { MessagesJumpStrip } from './MessagesJumpStrip'

export interface MessagesTopBarProps {
  pill: KindPill
  onPick: (pill: KindPill) => void
  lens: ShowLens
  lensCount: { mine: number; everyone: number } | null
  onLens: (lens: ShowLens) => void
  searchOpen: boolean
  onSearch: (open: boolean) => void
  weekOpen: boolean
  onWeek: (open: boolean) => void
  /** The strip's counts and press; left out while the lanes are not drawn (a search, the last pill). */
  strip?: { counts: JumpCounts; onJump: (lane: JumpLane) => void }
  /** The page's phone line: the controls scroll away and the strip sticks on its own. */
  phone: boolean
  /** The ? at the bar's end (v2.5802): what each lane holds, as a card under the bar. Left out: no ?. */
  legend?: { open: boolean; onToggle: (open: boolean) => void }
  /**
   * The two tabs after the title (punch list #230 PR 3): the open one, the press, and whether My email is drawn, which
   * is while the person's own switch is on. Left out, or with `myMailOn` false: no tabs, the bar as it was.
   */
  tabs?: { tab: MessagesTab; onTab: (tab: MessagesTab) => void; myMailOn: boolean }
}

const pillStyle = (on: boolean): CSSProperties => ({
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  padding: '0.25rem 0.7rem',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
  fontWeight: on ? 600 : 400,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})
const menuItem = (on: boolean): CSSProperties => ({
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  textAlign: 'left',
  padding: '0.35rem 0.6rem',
  borderRadius: 6,
  border: 0,
  background: on ? 'var(--bg-blue-tint)' : 'transparent',
  color: on ? 'var(--text-blue-500)' : 'var(--text-700)',
  fontWeight: on ? 600 : 400,
  cursor: 'pointer',
})
const segStyle = (on: boolean, first: boolean): CSSProperties => ({
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  padding: '0.25rem 0.7rem',
  border: 0,
  borderLeft: first ? 0 : '1px solid var(--border-strong)',
  background: on ? 'var(--bg-blue-tint)' : 'transparent',
  color: on ? 'var(--text-blue-500)' : 'var(--text-600)',
  fontWeight: on ? 600 : 400,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})
/** A tab: the open one filled blue under white words, the other quiet, as the mock-up's bar draws them. */
const tabStyle = (on: boolean): CSSProperties => ({
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  padding: '0.25rem 0.7rem',
  borderRadius: 8,
  border: `1px solid ${on ? '#2563eb' : 'var(--border-strong)'}`,
  background: on ? '#2563eb' : 'var(--surface)',
  color: on ? 'white' : 'var(--text-600)',
  fontWeight: 600,
  cursor: on ? 'default' : 'pointer',
  whiteSpace: 'nowrap',
})
const glassStyle = (on: boolean): CSSProperties => ({
  width: 30,
  height: 30,
  flex: 'none',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: on ? 'var(--text-blue-500)' : 'var(--text-700)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
})

/** The eight kinds behind one button that reads the pick; a press outside or Escape closes the menu. */
function KindPicker({ pill, onPick }: Pick<MessagesTopBarProps, 'pill' | 'onPick'>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div ref={ref} className="messagesTopPicker">
      <button type="button" aria-haspopup="true" aria-expanded={open} title={TOP_BAR_WORDS.pickerTip} onClick={() => setOpen((o) => !o)} data-testid="kind-picker" style={pillStyle(pill !== 'all')}>
        {pickerLabel(pill)} <span aria-hidden>▾</span>
      </button>
      {open && (
        <div role="group" aria-label={TOP_BAR_WORDS.pickerTip} className="messagesTopMenu" data-messages-pills>
          {KIND_PILLS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={pill === p.key}
              title={p.title}
              onClick={() => {
                onPick(p.key)
                setOpen(false)
              }}
              style={menuItem(pill === p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Follow up · My email, after the title. */
function TabRow({ tab, onTab }: { tab: MessagesTab; onTab: (tab: MessagesTab) => void }) {
  return (
    <div role="tablist" aria-label={TOP_BAR_WORDS.tabs} data-messages-tabs style={{ display: 'inline-flex', gap: '0.3rem' }}>
      {MESSAGES_TABS.map((t) => {
        const on = tab === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            title={t.key === 'myMail' ? TOP_BAR_WORDS.myMailTip : TOP_BAR_WORDS.followUpTip}
            onClick={() => {
              if (!on) onTab(t.key)
            }}
            data-testid={`messages-tab-${t.key}`}
            style={tabStyle(on)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function MessagesTopBar({ pill, onPick, lens, lensCount, onLens, searchOpen, onSearch, weekOpen, onWeek, strip, phone, legend, tabs }: MessagesTopBarProps) {
  const title = <h1 className="messagesTopTitle">{TOP_BAR_WORDS.title}</h1>
  const tabRow = tabs?.myMailOn ? <TabRow tab={tabs.tab} onTab={tabs.onTab} /> : null
  const myMailOpen = Boolean(tabRow) && tabs?.tab === 'myMail'
  const picker = <KindPicker pill={pill} onPick={onPick} />
  const show = (
    <div role="radiogroup" aria-label={SHOW_WORDS.label} data-messages-show style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 999, overflow: 'hidden', background: 'var(--surface)' }}>
      {(['mine', 'everyone'] as const).map((v, i) => {
        const on = lens === v
        const n = lensCount ? (v === 'mine' ? lensCount.mine : lensCount.everyone) : null
        return (
          <button key={v} type="button" role="radio" aria-checked={on} title={v === 'mine' ? SHOW_WORDS.mineTip : SHOW_WORDS.everyoneTip} onClick={() => onLens(v)} style={segStyle(on, i === 0)}>
            {v === 'mine' ? SHOW_WORDS.mine : SHOW_WORDS.everyone}
            {n !== null && ` · ${n}`}
          </button>
        )
      })}
    </div>
  )
  const glass = (
    <button type="button" aria-pressed={searchOpen} aria-label={searchOpen ? TOP_BAR_WORDS.searchClose : TOP_BAR_WORDS.search} title={searchOpen ? TOP_BAR_WORDS.searchClose : TOP_BAR_WORDS.search} onClick={() => onSearch(!searchOpen)} data-testid="search-glass" style={glassStyle(searchOpen)}>
      <Search size={15} strokeWidth={2.2} aria-hidden="true" />
    </button>
  )
  const week = (
    <button type="button" aria-pressed={weekOpen} aria-expanded={weekOpen} title={weekOpen ? TOP_BAR_WORDS.weekCloseTip : TOP_BAR_WORDS.weekTip} onClick={() => onWeek(!weekOpen)} data-testid="week-fold" style={pillStyle(weekOpen)}>
      {TOP_BAR_WORDS.week} <span aria-hidden>{weekOpen ? '▴' : '▾'}</span>
    </button>
  )
  const lanes = strip ? <MessagesJumpStrip counts={strip.counts} onJump={strip.onJump} /> : null
  const help = legend ? (
    <button type="button" aria-pressed={legend.open} aria-expanded={legend.open} aria-label={LEGEND_WORDS.label} title={legend.open ? LEGEND_WORDS.closeTip : LEGEND_WORDS.tip} onClick={() => legend.onToggle(!legend.open)} data-testid="lane-help" style={{ ...glassStyle(legend.open), fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700 }}>
      {LEGEND_WORDS.button}
    </button>
  ) : null

  if (myMailOpen) {
    // My email (punch list #230 PR 3): the title, the tabs and the ?; the rest is Follow up's.
    return (
      <div className={phone ? 'messagesTopBar isControls' : 'messagesTopBar'} {...(phone ? {} : { 'data-messages-pinned': '' })} data-messages-top-bar>
        {title}
        {tabRow}
        {help ? <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>{help}</span> : null}
      </div>
    )
  }
  if (phone) {
    return (
      <>
        <div className="messagesTopBar isControls" data-messages-top-bar>
          {title}
          {tabRow}
          {picker}
          {glass}
          {show}
          {week}
          {help}
        </div>
        {lanes}
      </>
    )
  }
  return (
    <div className="messagesTopBar" data-messages-pinned data-messages-top-bar>
      {title}
      {tabRow}
      {picker}
      {show}
      {glass}
      {lanes}
      {week}
      {help}
    </div>
  )
}
