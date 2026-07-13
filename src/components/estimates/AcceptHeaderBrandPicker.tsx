import type { CSSProperties, ReactNode } from 'react'
import type { EstimateAcceptHeaderBrand } from '../../lib/estimateAcceptHeaderBrand'
import { acceptHeaderBrandImageSrc, acceptHeaderBrandLabel } from '../../lib/estimateAcceptHeaderBrand'

const ROOT_CLASS = 'accept-header-brand-picker'

const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
}

const BRANDS: EstimateAcceptHeaderBrand[] = ['elec', 'plum']

/** Matches `EstimateCustomerDocument` logo frame (140×56). */
const LOGO_FRAME: CSSProperties = {
  width: 140,
  height: 56,
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
}

export type AcceptHeaderBrandPickerProps = {
  value: EstimateAcceptHeaderBrand | null
  onChange: (value: EstimateAcceptHeaderBrand | null) => void
  /** Left column: same role as the document title on the acceptance page (h1 or title editor). */
  documentTitleSlot: ReactNode
  /** Below the title row: **For:** line + field (matches document order). */
  forFieldSlot: ReactNode
  /** Below For: **Expires on:** date + presets (matches document order). */
  expiresOnSlot: ReactNode
  /** Below Expires on: draft line items editor (matches customer document section). */
  lineItemsSlot: ReactNode
}

export function AcceptHeaderBrandPicker({
  value,
  onChange,
  documentTitleSlot,
  forFieldSlot,
  expiresOnSlot,
  lineItemsSlot,
}: AcceptHeaderBrandPickerProps) {
  return (
    <div
      className={ROOT_CLASS}
      style={{
        marginTop: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '1rem',
        background: 'var(--surface)',
        maxWidth: 'min(900px, 100%)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .${ROOT_CLASS} .accept-header-brand-tile-label:not(.accept-header-brand-tile-label--selected):hover .accept-header-brand-tile {
          border-color: #93c5fd;
        }
        .${ROOT_CLASS} .accept-header-brand-tile-label:focus-within .accept-header-brand-tile {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
        .${ROOT_CLASS} .accept-header-brand-none-row input[type="radio"]:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
      `}</style>
      <fieldset
        style={{
          border: 'none',
          padding: 0,
          margin: 0,
          minWidth: 0,
        }}
      >
        <legend style={srOnly}>Acceptance page header and logo</legend>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            marginTop: 0,
          }}
        >
          <div style={{ flex: '1 1 12rem', minWidth: 0 }}>{documentTitleSlot}</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.5rem',
              flex: '0 0 auto',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
              {BRANDS.map((brand) => {
                const selected = value === brand
                return (
                  <label
                    key={brand}
                    className={`accept-header-brand-tile-label${selected ? ' accept-header-brand-tile-label--selected' : ''}`}
                    style={{ position: 'relative', cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="acceptHeaderBrand"
                      checked={selected}
                      onChange={() => onChange(brand)}
                      aria-label={acceptHeaderBrandLabel(brand)}
                      style={srOnly}
                    />
                    <div
                      className="accept-header-brand-tile"
                      style={{
                        ...LOGO_FRAME,
                        borderRadius: 6,
                        border: selected ? '2px solid #2563eb' : '1px solid var(--border)',
                        background: selected ? 'var(--bg-blue-tint)' : 'transparent',
                        transition: 'border-color 0.12s ease, background 0.12s ease',
                      }}
                    >
                      <img
                        src={acceptHeaderBrandImageSrc(brand)}
                        alt=""
                        width={140}
                        height={56}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    </div>
                  </label>
                )
              })}
            </div>
            <label
              className="accept-header-brand-none-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-700)',
              }}
            >
              <input
                type="radio"
                name="acceptHeaderBrand"
                checked={value === null}
                onChange={() => onChange(null)}
              />
              <span>None</span>
            </label>
          </div>
        </div>
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            color: 'var(--text-700)',
          }}
        >
          {forFieldSlot}
        </div>
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            color: 'var(--text-700)',
          }}
        >
          {expiresOnSlot}
        </div>
        <div style={{ marginTop: '1.5rem' }}>{lineItemsSlot}</div>
      </fieldset>
    </div>
  )
}
