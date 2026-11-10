/**
 * The Materials page's strip in three named groups (punch list #304): a quiet caption over each
 * group, a hairline between groups, a badge on a caption only when its group needs a hand. The
 * tabs keep their pill; Print labels and Scan a label are drawn as presses beside On site, since
 * each does one thing and neither is a place. On a phone the three words are chips in one row and
 * the open group's tabs sit under them. The groups, their order and their words are
 * `lib/materials/materialsGroups.ts`.
 */
import type { CSSProperties, ReactNode } from 'react'
import { pageTabStyle } from '../../lib/pageTabStyle'
import { MATERIALS_PRESS_LABELS, MATERIALS_TAB_LABELS, materialsGroupOf, type MaterialsBadge, type MaterialsGroup, type MaterialsGroupKey, type MaterialsPress } from '../../lib/materials/materialsGroups'
import type { MaterialsTab } from '../../lib/materials/materialsTabs'

type Props = {
  groups: ReadonlyArray<MaterialsGroup>
  activeTab: MaterialsTab
  onTab: (tab: MaterialsTab) => void
  /** The presses beside On site, in order. */
  presses: ReadonlyArray<MaterialsPress>
  onPress: (press: MaterialsPress) => void
  /** What a caption wears, by group; a group with nothing to say wears nothing. */
  badges?: Partial<Record<MaterialsGroupKey, ReadonlyArray<MaterialsBadge>>>
  phone: boolean
}

const caption = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: 18, paddingLeft: '0.75rem', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: on ? 'var(--text-blue-700)' : 'var(--text-muted)', whiteSpace: 'nowrap' })
const badge = (tone: MaterialsBadge['tone']): CSSProperties => ({ fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', padding: '0 0.4rem', borderRadius: 999, whiteSpace: 'nowrap', ...(tone === 'red' ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' } : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }) })
// No `font` shorthand here: pageTabStyle changes fontWeight on a press, and React warns when a shorthand and its longhand mix.
const tabStyle = (on: boolean): CSSProperties => ({ ...pageTabStyle(on), padding: '6px 0.75rem', fontFamily: 'inherit', fontSize: 'inherit', whiteSpace: 'nowrap' })
const pressStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minHeight: 30, padding: '0 0.7rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flex: '0 0 auto', whiteSpace: 'nowrap' }

function PressGlyph({ press }: { press: MaterialsPress }) {
  const common = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, style: { display: 'block', color: 'var(--text-muted)' } }
  if (press === 'print-labels') {
    return (
      <svg {...common}>
        <path d="M4.5 6V2.5h7V6" />
        <rect x="2" y="6" width="12" height="5.5" rx="1.2" />
        <path d="M4.5 9.5h7v4h-7z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3" />
      <path d="M5.5 8h5" />
    </svg>
  )
}

export default function MaterialsGroupStrip({ groups, activeTab, onTab, presses, onPress, badges = {}, phone }: Props) {
  const openKey = materialsGroupOf(activeTab)
  const tabButton = (tab: MaterialsTab): ReactNode => (
    <button key={tab} type="button" onClick={() => onTab(tab)} style={tabStyle(activeTab === tab)} aria-current={activeTab === tab ? 'page' : undefined}>
      {MATERIALS_TAB_LABELS[tab]}
    </button>
  )
  const pressButtons = (group: MaterialsGroup): ReactNode =>
    group.key === 'track'
      ? presses.map((p) => (
          <button key={p} type="button" onClick={() => onPress(p)} style={pressStyle} data-testid={`materials-press-${p}`}>
            <PressGlyph press={p} />
            {MATERIALS_PRESS_LABELS[p]}
          </button>
        ))
      : null

  if (phone) {
    const open = groups.find((g) => g.key === openKey) ?? groups[0]
    return (
      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.25rem' }} data-testid="materials-group-strip">
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {groups.map((g) => {
            const on = g.key === open?.key
            const needsHand = (badges[g.key]?.length ?? 0) > 0
            return (
              <button
                key={g.key}
                type="button"
                aria-pressed={on}
                aria-label={needsHand ? `${g.word}, needs a hand` : g.word}
                onClick={() => { if (!on && g.tabs[0]) onTab(g.tabs[0]) }}
                style={{ flex: '1 1 0', minWidth: 0, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: on ? 'var(--text-strong)' : 'var(--border-strong)', background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', font: 'inherit', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {g.word}
                {needsHand ? <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} /> : null}
              </button>
            )
          })}
        </div>
        {open ? (
          <div style={{ borderBottom: '2px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div role="group" aria-label={open.word} style={{ display: 'flex', gap: '0.25rem', width: 'max-content', alignItems: 'center' }}>
              {open.tabs.map(tabButton)}
              {pressButtons(open)}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '2rem' }} data-testid="materials-group-strip">
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* A window too narrow for the three groups wraps the last one under the others: nothing sits past a sideways scroll. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: '0.35rem', alignItems: 'flex-end' }}>
          {groups.map((g, i) => {
            const last = i === groups.length - 1
            return (
              <div key={g.key} role="group" aria-label={g.word} style={{ display: 'grid', gap: 2, ...(last ? {} : { paddingRight: '0.6rem', marginRight: '0.6rem', borderRight: '1px solid var(--border)' }) }}>
                <div style={caption(g.key === openKey)}>
                  {g.word}
                  {(badges[g.key] ?? []).map((b) => <span key={b.text} style={badge(b.tone)}>{b.text}</span>)}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  {g.tabs.map(tabButton)}
                  {pressButtons(g)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
