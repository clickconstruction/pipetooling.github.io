/**
 * Bids → Pricing: the panel the Workbench shows for a version with no prices yet (punch
 * list #137). Pure render — the words come from `pricingStartChoices`, the doors from the
 * tab: the book press runs `onSelectPriceBookTemplate` (clone, stamp the version, star),
 * "another book ▸" opens the price book drawer, the copy runs `copyBasePriceFromVersion`.
 */
import type { CSSProperties } from 'react'
import type { PricingStartChoices } from '../../lib/bids/pricingStartChoices'

const frame: CSSProperties = { padding: '1rem', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.875rem' }
const subnote: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }
const row: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }
const primaryBtn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #3b82f6', background: '#3b82f6', color: '#fff', cursor: 'pointer' }
const ghostBtn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.8rem', borderRadius: 999, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }
const copyBtn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }

export function PricingStartPanel(props: {
  choices: PricingStartChoices
  busyBook: boolean
  busyCopy: boolean
  onPickBook: (templateId: string) => void
  onBrowseBooks: () => void
  onCopyFrom: (versionId: string) => void
}) {
  const { choices, busyBook, busyCopy, onPickBook, onBrowseBooks, onCopyFrom } = props
  if (choices.kind === 'needs-setup') {
    return <div style={frame}>The Workbench needs Counts, an active Pricing, and a cost estimate. Set those up on the Counts / Labor tabs, then come back.</div>
  }
  const bookId = choices.bookTemplateId
  return (
    <div style={frame}>
      <div style={{ color: 'var(--text-strong)', fontWeight: 600, marginBottom: '0.25rem' }}>{choices.title}</div>
      <div style={{ marginBottom: '0.55rem' }}>Price it from a book. The Workbench opens on this version's own counts.</div>
      <div style={row}>
        {bookId && choices.bookLabel ? (
          <button type="button" disabled={busyBook} onClick={() => onPickBook(bookId)} style={{ ...primaryBtn, opacity: busyBook ? 0.6 : 1 }}>
            {busyBook ? 'Opening…' : choices.bookLabel}
          </button>
        ) : null}
        <button type="button" onClick={onBrowseBooks} style={ghostBtn}>
          another book ▸
        </button>
      </div>
      <div style={subnote}>{choices.bookSubline}</div>
      {choices.donors.length > 0 ? (
        <>
          <div style={{ borderTop: '1px solid var(--border)', margin: '0.7rem 0 0.55rem' }} />
          <div style={row}>
            <span>Or start from prices already on this bid:</span>
            {choices.donors.map((d) => (
              <button key={d.versionId} type="button" disabled={busyCopy} onClick={() => onCopyFrom(d.versionId)} style={{ ...copyBtn, opacity: busyCopy ? 0.6 : 1 }}>
                {busyCopy ? 'Copying…' : d.label}
              </button>
            ))}
          </div>
          <div style={subnote}>Copies follow fixture names. Rows only in this version stay unpriced.</div>
        </>
      ) : null}
    </div>
  )
}
