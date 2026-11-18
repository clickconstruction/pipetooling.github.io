import type { Dispatch, SetStateAction } from 'react'
import type { EstimateExperienceOverrideKey } from '../../lib/estimateCustomerExperience'
import {
  CX_FIELD_LABELS,
  cxFooterHidden,
  cxOverrideFieldRows,
  cxOverridesAfterEdit,
  cxWithFooterHidden,
  type CxOverrideFields,
  type CxOverrideSectionConfig,
} from '../../lib/estimates/estimateCxOverrideSections'
import { estInputBase } from './estimatesPageStyles'

export interface EstimateCxOverrideFieldsProps {
  section: CxOverrideSectionConfig
  /** Fields this estimate has no use for right now (no expiry date, a title of its own). */
  omitKeys?: ReadonlySet<EstimateExperienceOverrideKey>
  /** This draft's overrides; the page saves them with the draft. */
  fields: CxOverrideFields
  setFields: Dispatch<SetStateAction<CxOverrideFields>>
  /** The organization's copy, shown in a field with no override. */
  defaults: Record<EstimateExperienceOverrideKey, string>
}

/**
 * Customize customer copy on a draft estimate: one box per field of the section, each showing the
 * organization's default until it is changed. Moved from `EstimateDetail`'s `renderCxDraftSectionFields`
 * (v2.7622, punch list #46 row 3, cut 5 of the Estimates map); the markup is the page's own, and its
 * three inline rules are the tested ones in `estimateCxOverrideSections`.
 */
export default function EstimateCxOverrideFields({ section, omitKeys, fields, setFields, defaults }: EstimateCxOverrideFieldsProps) {
  const footerHidden = cxFooterHidden(fields)
  const keys = omitKeys && omitKeys.size > 0 ? section.keys.filter((k) => !omitKeys.has(k)) : section.keys
  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'var(--bg-page)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      <p style={{ fontSize: '0.85rem', fontWeight: 500, margin: '0 0 0.35rem', userSelect: 'none' }}>
        Customize customer copy (optional)
      </p>
      {keys.map((k) =>
        k === 'accept_page_footer' ? (
          <div key={k} style={{ marginTop: '0.65rem' }}>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={footerHidden}
                onChange={(e) => setFields((prev) => cxWithFooterHidden(prev, e.target.checked))}
              />
              <span style={{ fontSize: '0.85rem' }}>
                Hide company footer on this quote (acceptance page only)
              </span>
            </label>
            <label style={{ display: 'block', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{CX_FIELD_LABELS[k]}</span>
              <textarea
                value={footerHidden? ''
                    : (fields[k] ?? defaults[k])
                }
                disabled={footerHidden}
                onChange={(e) => setFields((prev) => cxOverridesAfterEdit(prev, k, e.target.value, defaults[k]))}
                rows={cxOverrideFieldRows(k)}
                style={{
                  ...estInputBase,
                  display: 'block',
                  width: '100%',
                  marginTop: '0.25rem',
                  padding: '0.5rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  ...(footerHidden ?
                    { opacity: 0.7 }
                  : {}),
                }}
              />
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
              Clear the textarea to use organization default. Check “Hide…” to omit the footer for this quote only
              (saved as an empty override).
            </p>
          </div>
        ) : (
          <label key={k} style={{ display: 'block', marginTop: '0.65rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{CX_FIELD_LABELS[k]}</span>
            <textarea
              value={fields[k] ?? defaults[k]}
              onChange={(e) => setFields((prev) => cxOverridesAfterEdit(prev, k, e.target.value, defaults[k]))}
              rows={cxOverrideFieldRows(k)}
              style={{
                ...estInputBase,
                display: 'block',
                width: '100%',
                marginTop: '0.25rem',
                padding: '0.5rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </label>
        ),
      )}
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
        Blank fields show organization defaults (built-in if unset in Settings). Only changes you make are saved as
        overrides.
      </p>
      {section.description ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>{section.description}</p>
      ) : null}
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
        Save the draft (Save draft or Send) to persist overrides.
      </p>
    </div>
  )
}
