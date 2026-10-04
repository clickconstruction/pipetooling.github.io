import type { MouseEvent } from 'react'
import type { PortalLine } from '../../lib/gcMode/gcModel'
import { Chip } from './gcUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the sheet numbers beside each line of a trade's bid form, only the ones
 * the office set (owner, 2026-10-03). A tap opens the plans on that sheet. Amber: a set newer than
 * the company's number changed it.
 */

export function SheetChip({ id, changed, onOpen }: { id: string; changed: boolean; onOpen: (sheetId: string) => void }) {
  const { t } = usePortalLang()
  return (
    <button
      type="button"
      title={t('openSheet', { id })}
      onClick={(e: MouseEvent) => {
        // The chip sits inside the line's label: open the sheet, never tick the box.
        e.preventDefault()
        e.stopPropagation()
        onOpen(id)
      }}
      style={{
        padding: '0.05rem 0.4rem',
        borderRadius: 4,
        border: `1px solid ${changed ? 'var(--text-amber-700)' : 'var(--border-strong)'}`,
        background: changed ? 'var(--bg-amber-100)' : 'var(--surface)',
        color: 'inherit',
        fontSize: '0.72rem',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        cursor: 'pointer',
        lineHeight: 1.5,
      }}
    >
      {id}
    </button>
  )
}

/** A sheet a newer set took out: struck through, with nothing to open (owner, 2026-10-04). */
export function GoneSheet({ id, word = true }: { id: string; word?: boolean }) {
  const { t } = usePortalLang()
  return (
    <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', fontSize: '0.72rem' }}>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textDecoration: 'line-through', opacity: 0.7 }}>{id}</span>
      {/* Under "Taken out in …" the words are said already. */}
      {word && <span style={{ opacity: 0.8 }}>{t('takenOutWord')}</span>}
    </span>
  )
}

/**
 * A line's sheets, and "changed in …" when a newer set changed one of them. A line that stands
 * for the whole trade shows no sheets until one of its trade's sheets changes, then those.
 */
export function LineSheets({ line, onOpen }: { line: PortalLine | undefined; onOpen: (sheetId: string) => void }) {
  const { t } = usePortalLang()
  if (!line) return null
  const shown = line.wholeTrade ? line.changed : line.sheets
  if (shown.length === 0 && line.by.length === 0) return null
  return (
    <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {shown.map((id) =>
        line.gone.includes(id) ? <GoneSheet key={id} id={id} /> : <SheetChip key={id} id={id} changed={line.changed.includes(id)} onOpen={onOpen} />,
      )}
      {line.by.length > 0 && <Chip tone="amber">{t('changedIn', { set: line.by.join(t('and')) })}</Chip>}
    </span>
  )
}

/** For a number on older plans: the lines the newer sets touch, and the trade's changed sheets no line names. */
export function ChangedLines({
  trade,
  lines,
  otherSheets,
  goneSheets = [],
  setNames,
  onOpen,
}: {
  trade: string
  lines: PortalLine[]
  otherSheets: string[]
  /** The trade's sheets the newer sets took out that no line named. */
  goneSheets?: string[]
  setNames: string[]
  onOpen: (sheetId: string) => void
}) {
  const { t } = usePortalLang()
  const touched = lines.filter((l) => l.by.length > 0)
  const named = touched.filter((l) => !l.wholeTrade)
  const whole = touched.filter((l) => l.wholeTrade)
  if (touched.length === 0 && otherSheets.length === 0 && goneSheets.length === 0) return null
  const sets = setNames.join(t('and'))
  return (
    <div style={{ display: 'grid', gap: '0.3rem' }}>
      {touched.length > 0 && <div>{t('touchesLines', { sets })}</div>}
      {named.map((l) => (
        <div key={l.item.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{l.item.label}</strong>
          {l.changed.map((id) => (
            <SheetChip key={id} id={id} changed onOpen={onOpen} />
          ))}
          {l.gone.map((id) => (
            <GoneSheet key={id} id={id} />
          ))}
        </div>
      ))}
      {whole.length > 0 && (
        // The lines that stand for the whole trade read the same sheets: one row, the sheets once.
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{listWords(whole.map((l) => l.item.label), t('and'))}</strong>
          <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>{t(whole.length === 1 ? 'readsEvery' : 'readEveryMany', { trade })}</span>
          {[...new Set(whole.flatMap((l) => l.changed))].map((id) => (
            <SheetChip key={id} id={id} changed onOpen={onOpen} />
          ))}
        </div>
      )}
      {otherSheets.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{touched.length > 0 ? t('alsoChanged') : t('changedInSets', { sets })}</span>
          {otherSheets.map((id) => (
            <SheetChip key={id} id={id} changed onOpen={onOpen} />
          ))}
        </div>
      )}
      {goneSheets.length > 0 && <TakenOut ids={goneSheets} sets={sets} />}
    </div>
  )
}

/** "Taken out in Addendum 2: E-305", for the trade's sheets a set took out that no line named. */
export function TakenOut({ ids, sets }: { ids: string[]; sets: string }) {
  const { t } = usePortalLang()
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{t('takenOutIn', { sets })}</span>
      {ids.map((id) => (
        <GoneSheet key={id} id={id} word={false} />
      ))}
    </div>
  )
}

/** "A", "A and B", "A, B and C". */
function listWords(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`
}
