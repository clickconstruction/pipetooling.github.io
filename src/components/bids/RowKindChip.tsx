import { SearchableSelect } from '../SearchableSelect'
import { ROW_KINDS, ROW_KIND_WORDS, type RowKind } from '../../lib/bids/rowKinds'

type Props = {
  kind: RowKind
  /** True while the kind is the app's guess from the row's words (drawn dashed). */
  guessed: boolean
  rowName: string
  onChange: (kind: RowKind) => void
}

/** What each kind means, under its name in the list. */
const KIND_WORDS: Record<RowKind, string> = {
  fixture: 'counted each: toilets, sinks, heaters',
  pipe: 'by the foot',
  fitting: 'rides the pipe: valves, wyes, cleanouts',
  equipment: 'an item of its own: a lift, shoring; its price is not split',
  allowance: 'money, not plumbing: permits, travel, lump sums',
}

/**
 * The row's kind as a chip (punch list #128): the app's guess dashed, the row's own solid,
 * Equipment in amber since it is the one pick that changes money. The list is the app's own
 * select (`SearchableSelect`) with no search box, each kind with one line of meaning.
 */
export function RowKindChip({ kind, guessed, rowName, onChange }: Props) {
  const equipment = kind === 'equipment'
  return (
    <span role="group" aria-label={`Kind of ${rowName}`} style={{ display: 'inline-block' }}>
    <SearchableSelect
      value={kind}
      onChange={(v) => onChange(v as RowKind)}
      searchable={false}
      listAriaLabel={`Kind of ${rowName}`}
      listMinWidthPx={260}
      listMaxHeightPx={320}
      listOptionPadding="0.4rem 0.7rem"
      listOptionFontSize="0.8rem"
      triggerMinHeightPx={20}
      triggerStyle={{
        font: 'inherit',
        fontSize: '0.68rem',
        fontWeight: 600,
        lineHeight: 1.2,
        padding: '0.05rem 0.5rem',
        borderRadius: 999,
        border: `1px ${guessed ? 'dashed' : 'solid'} ${equipment ? '#d97706' : 'var(--border-strong)'}`,
        background: equipment ? 'rgba(245, 158, 11, 0.14)' : 'var(--surface)',
        color: guessed ? 'var(--text-muted)' : equipment ? 'var(--text-amber-700)' : 'var(--text-700)',
        width: 'auto',
        minWidth: 0,
        gap: '0.25rem',
      }}
      options={ROW_KINDS.map((k) => ({
        value: k,
        label: ROW_KIND_WORDS[k],
        triggerContent: <span title={guessed ? "The app's guess from the name — pick one to make it the row's own" : "The row's own kind"}>{ROW_KIND_WORDS[k]}</span>,
        labelContent: (
          <span style={{ display: 'block', lineHeight: 1.25 }}>
            <span style={{ fontWeight: 600, color: k === 'equipment' ? '#b45309' : undefined }}>{ROW_KIND_WORDS[k]}</span>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{KIND_WORDS[k]}</span>
          </span>
        ),
      }))}
    />
    </span>
  )
}
