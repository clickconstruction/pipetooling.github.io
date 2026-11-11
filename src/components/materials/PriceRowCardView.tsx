/**
 * One row as a card (punch list #308): the row as printed, the part on file and how it was found,
 * what the book holds now, the one question the row raises and the presses that answer it. The
 * words come from `rowCard`; this draws them. One price (QuickPriceWindow) shows one of these, and a
 * price sheet (PriceSheetPanel) shows many.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cardInput, cardLink, cardPress, CHIP_TONE } from '../../lib/materials/priceSheet/cardStyles'
import type { BookPart, PartMatch } from '../../lib/materials/partMatch'
import { bookPrice, PRICING_UNIT_FACTOR, type PricingUnit } from '../../lib/materials/priceSheet/pastedRow'
import { dollars, rowCard, type OnFilePrice } from '../../lib/materials/priceSheet/rowCard'

export type KnownPart = BookPart & { is_robot?: boolean | null }
export type CardRow = { key: string; houseCode: string; description: string; unitPrice: number | null; pricingUnit: PricingUnit; lines: number }
export type CardFileOpts = { unitFactor?: number; allow?: boolean }
/** The database held the row and said why: the next press is a person's word to file it anyway. */
export type ServerAsk = { why: 'moved' | 'newer_on_file'; onFile: OnFilePrice }

export function PriceRowCardView({
  row,
  house,
  match,
  picked,
  fixedPart = false,
  priceOnFile,
  datedOn,
  serverAsk,
  problem,
  busy,
  dead,
  parts,
  where,
  leaveLabel = 'Leave it out',
  noPriceNote = 'Type its price in the row above.',
  noPricePress = false,
  onFileRow,
  onMakeAndFile,
  onPick,
  onUnpick,
  onLeaveOut,
}: {
  row: CardRow
  house: { id: string; name: string } | null
  match: PartMatch<KnownPart>
  /** A person picked the part for this row. */
  picked: boolean
  /** The part is known from where the window was opened: nothing to pick, and no row as printed. */
  fixedPart?: boolean
  priceOnFile: OnFilePrice | null
  datedOn: string
  serverAsk?: ServerAsk
  problem?: string
  busy: boolean
  dead: boolean
  parts: KnownPart[]
  /** Where the row sits on its sheet: SK-3 · row 2 · page 4. */
  where?: string
  leaveLabel?: string
  /** What a row with no price of its own says under its part. */
  noPriceNote?: string
  /** A sheet's kit row: with no price, its press says which part it is and keeps the house's number. */
  noPricePress?: boolean
  onFileRow: (part: KnownPart, opts?: CardFileOpts) => void
  onMakeAndFile: (name: string) => void
  onPick: (part: KnownPart) => void
  onUnpick: () => void
  onLeaveOut: () => void
}) {
  const [query, setQuery] = useState<string | null>(null)
  const [newName, setNewName] = useState<string | null>(null)

  const part = match.part
  const c = rowCard({ row, houseName: house?.name ?? null, match, onFile: priceOnFile, datedOn })
  const each = c.each
  const chipLabel = picked && !fixedPart && (c.status === 'offer' || c.status === 'no_price') ? 'Your pick' : c.chip.label
  const question = serverAsk
    ? serverAsk.why === 'moved'
      ? `${dollars(serverAsk.onFile.price)} is on file. That is a big move. Press again to file it.`
      : `A newer price is on file: ${dollars(serverAsk.onFile.price)}. Press again to file this one over it.`
    : c.status === 'no_price'
      ? noPriceNote
      : picked && c.status === 'offer'
        ? (c.onFileLine ?? `${house?.name ?? 'This house'} has no price on file for this part yet.`)
        : c.question
  const found =
    query != null && query.trim().length >= 2
      ? parts
          .filter((p) => !p.is_robot && query.toLowerCase().split(/\s+/).every((w) => `${p.name} ${p.manufacturer ?? ''}`.toLowerCase().includes(w)))
          .slice(0, 8)
      : []
  const calm = c.status === 'ready' || c.status === 'offer' || (c.status === 'no_price' && part != null)
  const name = newName ?? row.description

  return (
    <div data-testid="price-row-card" style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${calm ? '#059669' : '#d97706'}`, borderRadius: 8, padding: '0.65rem 0.8rem', display: 'grid', gap: '0.45rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span style={{ ...CHIP_TONE[c.chip.tone], borderRadius: 999, padding: '0.05rem 0.55rem', fontWeight: 600 }}>{chipLabel}</span>
        {where ? <span>{where}</span> : null}
        {row.houseCode ? <span>{house ? `${house.name} ` : ''}{row.houseCode}</span> : null}
        {c.ranOver ? <span>{c.ranOver} lines read as one row</span> : null}
      </div>
      {!fixedPart ? (
        <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.3rem 0.5rem', overflowWrap: 'anywhere' }}>
          {row.description}
          {row.unitPrice != null ? ` · ${row.unitPrice.toFixed(2)}${row.pricingUnit === 'per_hundred' ? ' C' : row.pricingUnit === 'per_thousand' ? ' M' : ''}` : ''}
        </div>
      ) : null}
      {part ? <strong style={{ fontSize: '0.875rem', overflowWrap: 'anywhere' }}>{part.name}</strong> : null}
      <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{question}</span>
      {problem ? (
        <span role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {problem}
        </span>
      ) : null}

      {c.status === 'pick'
        ? match.rivals.map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem 0.55rem' }}>
              <span style={{ fontSize: '0.8125rem', overflowWrap: 'anywhere' }}>{p.name}</span>
              <button type="button" disabled={dead} onClick={() => onPick(p)} style={cardPress(dead, false)}>
                Use this one
              </button>
            </div>
          ))
        : null}
      {c.status === 'pick' && match.how !== 'words' ? (
        <Link to="/duplicates" target="_blank" rel="noreferrer" style={{ ...cardLink, textDecoration: 'none' }}>
          They are one part. Merge them on Duplicates ↗
        </Link>
      ) : null}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {part && each != null && c.unitAsk && !serverAsk ? (
          <>
            <button type="button" disabled={dead} onClick={() => onFileRow(part)} style={cardPress(dead, true)}>
              {busy ? 'Filing…' : `File ${dollars(each)} each`}
            </button>
            <button type="button" disabled={dead} onClick={() => onFileRow(part, { unitFactor: 1 })} style={cardPress(dead, false)}>
              It is {dollars(c.eachAsPrinted ?? each)} each
            </button>
          </>
        ) : part && each != null && c.older && !serverAsk ? (
          <>
            <button type="button" disabled={dead} onClick={onLeaveOut} style={cardPress(dead, true)}>
              Keep the newer price
            </button>
            <button type="button" disabled={dead} onClick={() => onFileRow(part, { allow: true })} style={cardPress(dead, false)}>
              File {dollars(each)} over it
            </button>
          </>
        ) : part && each != null && house ? (
          <>
            <button type="button" disabled={dead} onClick={() => onFileRow(part, { allow: c.bigMove || serverAsk != null })} style={cardPress(dead, true)}>
              {busy ? 'Filing…' : serverAsk ? `File ${dollars(each)} anyway` : c.status === 'offer' && !picked ? `Same part · file ${dollars(each)}` : `File ${dollars(each)}`}
            </button>
            {c.bigMove && priceOnFile ? (
              <button type="button" disabled={dead} onClick={onLeaveOut} style={cardPress(dead, false)}>
                Keep {dollars(priceOnFile.price)}
              </button>
            ) : null}
          </>
        ) : part && noPricePress && c.status === 'no_price' && house ? (
          <button type="button" disabled={dead} onClick={() => onFileRow(part)} style={cardPress(dead, true)}>
            {busy ? 'Keeping…' : picked ? 'It is this part' : 'Same part'}
          </button>
        ) : null}
        {c.status === 'new' && row.unitPrice == null && noPricePress && house ? (
          <>
            <input type="text" value={name} onChange={(e) => setNewName(e.target.value)} aria-label="Name in the book" style={{ ...cardInput, flex: '1 1 16rem', minWidth: 0 }} />
            <button type="button" disabled={dead || !name.trim()} onClick={() => onMakeAndFile(name.trim())} style={cardPress(dead || !name.trim(), true)}>
              {busy ? 'Making…' : 'New part in the book'}
            </button>
          </>
        ) : null}
        {c.status === 'new' && row.unitPrice != null && house ? (
          <>
            <input type="text" value={name} onChange={(e) => setNewName(e.target.value)} aria-label="Name in the book" style={{ ...cardInput, flex: '1 1 16rem', minWidth: 0 }} />
            <button type="button" disabled={dead || !name.trim()} onClick={() => onMakeAndFile(name.trim())} style={cardPress(dead || !name.trim(), true)}>
              {busy ? 'Making…' : `New part in the book · file ${dollars(bookPrice(row.unitPrice, PRICING_UNIT_FACTOR[row.pricingUnit]))}`}
            </button>
          </>
        ) : null}
        {!fixedPart ? (
          <>
            <button type="button" onClick={() => setQuery((q) => (q == null ? '' : null))} style={cardLink}>
              {part ? 'Another part…' : 'It is…'}
            </button>
            {picked ? (
              <button type="button" onClick={onUnpick} style={cardLink}>
                Undo my pick
              </button>
            ) : null}
            <button type="button" onClick={onLeaveOut} style={cardLink}>
              {leaveLabel}
            </button>
          </>
        ) : null}
      </div>
      {query != null ? (
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <input type="text" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the parts book…" aria-label="Search the parts book" style={cardInput} />
          {found.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onPick(p)
                setQuery(null)
              }}
              style={{ ...cardLink, textAlign: 'left', color: 'var(--text-base)', padding: '0.2rem 0.3rem', overflowWrap: 'anywhere' }}
            >
              {p.name}
              {p.manufacturer ? <span style={{ color: 'var(--text-muted)' }}> · {p.manufacturer}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
