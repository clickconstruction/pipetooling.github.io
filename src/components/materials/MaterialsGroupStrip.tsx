/**
 * The Materials page's strip in three named groups (punch list #304): a quiet caption over each group, a hairline
 * between groups, a badge on a caption only when its group needs a hand. The tabs keep their pill; Scan a label and
 * Print labels are drawn as presses at the right end of On site's row (v2.6871, the owner: Print labels last, both
 * right-aligned), since each does one thing and neither is a place. The groups,
 * their order and their words are `lib/materials/materialsGroups.ts`.
 *
 * When the whole strip does not fit one row it folds (v2.6871, the owner's idea): the strip measures itself, the group
 * with the open tab stays open, the others stay open while there is room, and the rest fold to a press with their
 * name and their badge. A folded group's press opens it and does not change the page. Where even one open group is too
 * wide beside the names (a phone), the names take a row and the open group's tabs sit under them. Which groups fold is
 * `lib/materials/materialsStripFit.ts`; before v2.6871 the last group wrapped under the others.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { pageTabStyle } from '../../lib/pageTabStyle'
import { MATERIALS_PRESS_LABELS, MATERIALS_TAB_LABELS, materialsGroupOf, type MaterialsBadge, type MaterialsGroup, type MaterialsGroupKey, type MaterialsPress } from '../../lib/materials/materialsGroups'
import { foldedGroupLabel, stripFit } from '../../lib/materials/materialsStripFit'
import type { MaterialsTab } from '../../lib/materials/materialsTabs'
import { materialsPressStyle } from '../../lib/materials/materialsPressStyle'
import { MaterialsPressGlyph } from './MaterialsPress'

type Widths = Partial<Record<MaterialsGroupKey, number>>
export type StripMeasured = { available: number; openWidths: Widths; foldWidths: Widths }

type Props = {
  groups: ReadonlyArray<MaterialsGroup>
  activeTab: MaterialsTab
  onTab: (tab: MaterialsTab) => void
  /** The presses at the right end of On site's row, in order. */
  presses: ReadonlyArray<MaterialsPress>
  onPress: (press: MaterialsPress) => void
  /** What a caption wears, by group; a group with nothing to say wears nothing. */
  badges?: Partial<Record<MaterialsGroupKey, ReadonlyArray<MaterialsBadge>>>
  /** The widths, handed in where there is no layout to measure (a test's DOM). The strip measures itself otherwise. */
  measured?: StripMeasured
}

/** The room between two groups: the hairline, with 0.6rem on each side of it. */
const GAP = 21

const caption = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: 18, paddingLeft: '0.75rem', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: on ? 'var(--text-blue-700)' : 'var(--text-muted)', whiteSpace: 'nowrap' })
const badge = (tone: MaterialsBadge['tone']): CSSProperties => ({ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', padding: '0 0.4rem', borderRadius: 999, whiteSpace: 'nowrap', ...(tone === 'red' ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' } : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }) })
// No `font` shorthand here: pageTabStyle changes fontWeight on a press, and React warns when a shorthand and its longhand mix.
const tabStyle = (on: boolean): CSSProperties => ({ ...pageTabStyle(on), padding: '6px 0.75rem', fontFamily: 'inherit', fontSize: 'inherit', whiteSpace: 'nowrap' })
/** A folded group: its name as one press, at the tabs' height, blue when it holds the open tab. */
const foldStyle = (here: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 32, margin: '0 0 6px', padding: '0 0.6rem 0 0.75rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: here ? '#2563eb' : 'var(--border-strong)', background: here ? 'var(--bg-blue-tint)' : 'var(--surface)', color: here ? 'var(--text-blue-700)' : 'var(--text-700)', font: 'inherit', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', flex: '0 0 auto', whiteSpace: 'nowrap' })
const plainWords: CSSProperties = { letterSpacing: 0, textTransform: 'none', fontWeight: 600 }

export default function MaterialsGroupStrip({ groups, activeTab, onTab, presses, onPress, badges = {}, measured }: Props) {
  const hereKey = materialsGroupOf(activeTab)
  const hereLabel = MATERIALS_TAB_LABELS[activeTab]
  /** A folded group the person pressed open. It changes what is drawn, never the page. */
  const [opened, setOpened] = useState<MaterialsGroupKey | null>(null)
  // A tab pressed is the page changed: the strip goes back to folding around the open tab.
  useEffect(() => { setOpened(null) }, [activeTab])

  const rootRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState<StripMeasured>({ available: 0, openWidths: {}, foldWidths: {} })
  const badgeKey = groups.map((g) => `${g.key}:${g.tabs.join(',')}:${(badges[g.key] ?? []).map((b) => b.text).join('|')}`).join(';')
  useLayoutEffect(() => {
    if (measured) return
    const root = rootRef.current
    const ruler = rulerRef.current
    if (!root || !ruler) return
    const read = () => {
      const openWidths: Widths = {}
      const foldWidths: Widths = {}
      ruler.querySelectorAll<HTMLElement>('[data-rule]').forEach((el) => {
        const [kind, key] = (el.dataset.rule ?? '').split(':') as ['open' | 'fold', MaterialsGroupKey]
        ;(kind === 'open' ? openWidths : foldWidths)[key] = Math.ceil(el.getBoundingClientRect().width)
      })
      const next: StripMeasured = { available: Math.floor(root.clientWidth), openWidths, foldWidths }
      setSizes((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    read()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read)
    observer?.observe(root)
    // The words' widths change once the page's font arrives.
    void document.fonts?.ready.then(read)
    return () => observer?.disconnect()
    // `presses.length` and `hereLabel` change a group's width; the badges and tabs are in `badgeKey`.
  }, [measured, badgeKey, presses.length, hereLabel])

  const room = (measured ?? sizes).available
  // A window resized, or a phone turned, is a new row to fit: the strip folds around the open tab again.
  useEffect(() => { setOpened(null) }, [room])

  const fit = stripFit({ groups: groups.map((g) => g.key), here: hereKey, opened, gap: GAP, ...(measured ?? sizes) })
  const isOpen = (key: MaterialsGroupKey) => fit.open.includes(key)

  // A press on a folded group puts the keyboard on that group's first tab, where the next press is.
  const focusGroup = useRef<MaterialsGroupKey | null>(null)
  useEffect(() => {
    const key = focusGroup.current
    if (!key) return
    focusGroup.current = null
    rootRef.current?.querySelector<HTMLElement>(`[data-strip-group="${key}"] button`)?.focus()
  })
  const openFolded = (key: MaterialsGroupKey) => {
    focusGroup.current = key
    setOpened(key)
  }

  const tabButton = (tab: MaterialsTab, live: boolean): ReactNode => (
    <button key={tab} type="button" tabIndex={live ? undefined : -1} onClick={live ? () => onTab(tab) : undefined} style={tabStyle(activeTab === tab)} aria-current={live && activeTab === tab ? 'page' : undefined}>
      {MATERIALS_TAB_LABELS[tab]}
    </button>
  )
  const pressButtons = (group: MaterialsGroup, live: boolean): ReactNode =>
    group.key === 'track' && presses.length > 0 ? (
      // Pushed to the row's right end: the tab is the place, the presses are what you do there.
      <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginLeft: 'auto', paddingLeft: '0.5rem' }}>
        {presses.map((p) => (
          <button key={p} type="button" tabIndex={live ? undefined : -1} onClick={live ? () => onPress(p) : undefined} style={materialsPressStyle()} data-testid={live ? `materials-press-${p}` : undefined}>
            <MaterialsPressGlyph kind={p} />
            {MATERIALS_PRESS_LABELS[p]}
          </button>
        ))}
      </span>
    ) : null
  const badgeChips = (key: MaterialsGroupKey): ReactNode => (badges[key] ?? []).map((b) => <span key={b.text} style={badge(b.tone)}>{b.text}</span>)

  /**
   * A group drawn open: its caption, its tabs, its presses. `live` is false for the copy the strip measures. `grow`
   * lets the last group take the rest of the row, so its presses reach the right edge.
   */
  const openGroup = (g: MaterialsGroup, live: boolean, withCaption = true, grow = false): ReactNode => (
    <div style={{ display: 'grid', gap: 2, flex: grow ? '1 1 auto' : '0 0 auto' }} {...(live ? { role: 'group', 'aria-label': g.word, 'data-strip-group': g.key } : { 'data-rule': `open:${g.key}` })}>
      {withCaption ? <div style={caption(g.key === hereKey)}>{g.word}{badgeChips(g.key)}</div> : null}
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        {g.tabs.map((t) => tabButton(t, live))}
        {pressButtons(g, live)}
      </div>
    </div>
  )
  /** A group folded to its name. It keeps its badge, and says where the open tab is when it holds it. */
  const foldedGroup = (g: MaterialsGroup, live: boolean): ReactNode => {
    const here = g.key === hereKey
    return (
      <button
        type="button"
        tabIndex={live ? undefined : -1}
        style={foldStyle(here)}
        {...(live
          ? { 'aria-expanded': false, 'aria-label': foldedGroupLabel(g.word, here ? hereLabel : null, (badges[g.key] ?? []).map((b) => b.text)), onClick: () => openFolded(g.key), 'data-testid': `materials-group-folded-${g.key}` }
          : { 'data-rule': `fold:${g.key}` })}
      >
        {g.word}
        {here ? <span style={plainWords}>· {hereLabel}</span> : null}
        {badgeChips(g.key)}
        <span aria-hidden style={{ ...plainWords, color: 'var(--text-faint)', fontSize: '0.85rem' }}>›</span>
      </button>
    )
  }
  /** The copy the strip measures: every group open and folded, out of sight and out of reach. */
  const ruler = measured ? null : (
    <div ref={rulerRef} aria-hidden style={{ position: 'absolute', left: 0, top: 0, height: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none', display: 'flex', gap: 40, whiteSpace: 'nowrap' }}>
      {groups.map((g) => <span key={g.key} style={{ display: 'flex', gap: 40, flex: '0 0 auto' }}>{openGroup(g, false)}{foldedGroup(g, false)}</span>)}
    </div>
  )

  if (fit.shape === 'rows') {
    const open = groups.find((g) => g.key === fit.open[0]) ?? groups[0]
    return (
      <div ref={rootRef} style={{ position: 'relative', display: 'grid', gap: '0.5rem', marginBottom: '1.25rem' }} data-testid="materials-group-strip" data-strip-shape="rows">
        {ruler}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {groups.map((g) => {
            const on = g.key === open?.key
            const here = g.key === hereKey
            const marks = (badges[g.key] ?? []).map((b) => b.text)
            return (
              <button
                key={g.key}
                type="button"
                aria-expanded={on}
                aria-label={foldedGroupLabel(g.word, here && !on ? hereLabel : null, marks, !on)}
                onClick={() => { if (!on) openFolded(g.key) }}
                data-testid={`materials-group-name-${g.key}`}
                style={{ flex: '1 1 0', minWidth: 0, maxWidth: '11rem', minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: on ? 'var(--text-strong)' : here ? '#2563eb' : 'var(--border-strong)', background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'var(--surface)' : here ? 'var(--text-blue-700)' : 'var(--text-700)', font: 'inherit', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {g.word}
                {marks.length > 0 ? <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} /> : null}
              </button>
            )
          })}
        </div>
        {open ? (
          <div style={{ borderBottom: '2px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', width: 'max-content', minWidth: '100%' }}>{openGroup(open, true, false, true)}</div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', borderBottom: '2px solid var(--border)', marginBottom: '2rem', minWidth: 0 }} data-testid="materials-group-strip" data-strip-shape="row">
      {ruler}
      {groups.map((g, i) => {
        const last = i === groups.length - 1
        return (
          <div key={g.key} style={{ display: 'flex', alignItems: 'flex-end', flex: last && isOpen(g.key) ? '1 1 auto' : '0 0 auto', ...(last ? {} : { paddingRight: '0.6rem', marginRight: '0.6rem', borderRight: '1px solid var(--border)' }) }}>
            {isOpen(g.key) ? openGroup(g, true, true, last) : foldedGroup(g, true)}
          </div>
        )
      })}
    </div>
  )
}
