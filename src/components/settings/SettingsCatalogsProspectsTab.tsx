/** Settings → Catalogs tab dev-only block (rendered outside the SettingsGroup, conditional-mount):
 * prospect follow-up copy defaults, estimate public terms, estimate line-item catalog, and
 * estimate customer-experience config.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props. */
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  ESTIMATE_APP_SETTING_LABELS,
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  ESTIMATE_EXPERIENCE_FIELD_MAX_LEN,
} from '../../lib/estimateCustomerExperience'
import { computeEstimateLineExtendedCents } from '../../lib/estimateLineItemNormalize'
import type { EstimateCatalogLineItem } from '../../lib/estimateLineItemCatalog'

type SettingsCatalogsProspectsTabProps = {
  estimateCxByKey: Record<string, string>
  estimateCxSaving: boolean
  estimateCxSectionOpen: boolean
  estimateLineItemCatalogRows: EstimateCatalogLineItem[]
  estimateLineItemCatalogSaving: boolean
  estimateLineItemCatalogSectionOpen: boolean
  estimatePublicTermsBody: string
  estimatePublicTermsSaving: boolean
  estimatePublicTermsSectionOpen: boolean
  prospectCopyJustCheckingIn: string
  prospectCopyJustCheckingInSubject: string
  prospectCopyNoResponse: string
  prospectCopyNoResponseSubject: string
  prospectCopyPhoneFollowup: string
  prospectCopyPhoneFollowupSubject: string
  prospectCopySaving: boolean
  prospectCopySectionOpen: boolean
  saveEstimateCustomerCopyDefaults: (e: FormEvent) => void
  saveEstimateLineItemCatalog: (e: FormEvent) => void
  saveEstimatePublicTerms: (e: FormEvent) => void
  saveProspectCopyDefaults: (e: FormEvent) => void
  setEstimateCxByKey: Dispatch<SetStateAction<Record<string, string>>>
  setEstimateCxSectionOpen: Dispatch<SetStateAction<boolean>>
  setEstimateLineItemCatalogRows: Dispatch<SetStateAction<EstimateCatalogLineItem[]>>
  setEstimateLineItemCatalogSectionOpen: Dispatch<SetStateAction<boolean>>
  setEstimatePublicTermsBody: Dispatch<SetStateAction<string>>
  setEstimatePublicTermsSectionOpen: Dispatch<SetStateAction<boolean>>
  setProspectCopyJustCheckingIn: Dispatch<SetStateAction<string>>
  setProspectCopyJustCheckingInSubject: Dispatch<SetStateAction<string>>
  setProspectCopyNoResponse: Dispatch<SetStateAction<string>>
  setProspectCopyNoResponseSubject: Dispatch<SetStateAction<string>>
  setProspectCopyPhoneFollowup: Dispatch<SetStateAction<string>>
  setProspectCopyPhoneFollowupSubject: Dispatch<SetStateAction<string>>
  setProspectCopySectionOpen: Dispatch<SetStateAction<boolean>>
}

export default function SettingsCatalogsProspectsTab({
  estimateCxByKey,
  estimateCxSaving,
  estimateCxSectionOpen,
  estimateLineItemCatalogRows,
  estimateLineItemCatalogSaving,
  estimateLineItemCatalogSectionOpen,
  estimatePublicTermsBody,
  estimatePublicTermsSaving,
  estimatePublicTermsSectionOpen,
  prospectCopyJustCheckingIn,
  prospectCopyJustCheckingInSubject,
  prospectCopyNoResponse,
  prospectCopyNoResponseSubject,
  prospectCopyPhoneFollowup,
  prospectCopyPhoneFollowupSubject,
  prospectCopySaving,
  prospectCopySectionOpen,
  saveEstimateCustomerCopyDefaults,
  saveEstimateLineItemCatalog,
  saveEstimatePublicTerms,
  saveProspectCopyDefaults,
  setEstimateCxByKey,
  setEstimateCxSectionOpen,
  setEstimateLineItemCatalogRows,
  setEstimateLineItemCatalogSectionOpen,
  setEstimatePublicTermsBody,
  setEstimatePublicTermsSectionOpen,
  setProspectCopyJustCheckingIn,
  setProspectCopyJustCheckingInSubject,
  setProspectCopyNoResponse,
  setProspectCopyNoResponseSubject,
  setProspectCopyPhoneFollowup,
  setProspectCopyPhoneFollowupSubject,
  setProspectCopySectionOpen,
}: SettingsCatalogsProspectsTabProps) {
  return (
    <>
          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setProspectCopySectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{prospectCopySectionOpen ? '▼' : '▶'}</span>
              Prospect copy templates (dev)
            </button>
            {prospectCopySectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Default text for the three copy buttons in Prospects → Follow Up. Users can override with their own text. Placeholders: [User name], [user email], [user phone number], [company name], [prospect phone number], [prospect contact name], [prospect last contact], [prospect last successful contact] (and _______ for Phone call / Just checking in).
                </p>
                <form onSubmit={saveProspectCopyDefaults}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>No Response Email</label>
                    <input
                      type="text"
                      value={prospectCopyNoResponseSubject}
                      onChange={(e) => setProspectCopyNoResponseSubject(e.target.value)}
                      placeholder="Subject (e.g. Follow up - [company name])"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                    />
                    <textarea
                      value={prospectCopyNoResponse}
                      onChange={(e) => setProspectCopyNoResponse(e.target.value)}
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Phone call Follow up Email</label>
                    <input
                      type="text"
                      value={prospectCopyPhoneFollowupSubject}
                      onChange={(e) => setProspectCopyPhoneFollowupSubject(e.target.value)}
                      placeholder="Subject (e.g. Re: [company name])"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                    />
                    <textarea
                      value={prospectCopyPhoneFollowup}
                      onChange={(e) => setProspectCopyPhoneFollowup(e.target.value)}
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Just checking in Email</label>
                    <input
                      type="text"
                      value={prospectCopyJustCheckingInSubject}
                      onChange={(e) => setProspectCopyJustCheckingInSubject(e.target.value)}
                      placeholder="Subject (e.g. Re: [company name])"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                    />
                    <textarea
                      value={prospectCopyJustCheckingIn}
                      onChange={(e) => setProspectCopyJustCheckingIn(e.target.value)}
                      rows={6}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={prospectCopySaving}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: prospectCopySaving ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                  >
                    {prospectCopySaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setEstimateCxSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{estimateCxSectionOpen ? '▼' : '▶'}</span>
              Estimate customer experience defaults (dev)
            </button>
            {estimateCxSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Defaults for estimate emails, public acceptance page, and thank-you. Staff can override per draft estimate on the estimate detail page. Sent estimates freeze copy at send time. Email templates:
                  <code>{' {{accept_url}}'}</code>,<code>{' {{title}}'}</code>,<code>{' {{estimate_number}}'}</code>.
                </p>
                <form onSubmit={saveEstimateCustomerCopyDefaults}>
                  {ESTIMATE_EXPERIENCE_APP_KEY_LIST.map((appKey) => (
                    <div key={appKey} style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                        {ESTIMATE_APP_SETTING_LABELS[appKey] ?? appKey}
                      </label>
                      <textarea
                        value={estimateCxByKey[appKey] ?? ''}
                        onChange={(e) =>
                          setEstimateCxByKey((prev) => ({
                            ...prev,
                            [appKey]: e.target.value.slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN),
                          }))
                        }
                        rows={appKey.includes('email_body') || appKey.includes('thank_you_body') ? 5 : 2}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={estimateCxSaving}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: estimateCxSaving ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {estimateCxSaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setEstimateLineItemCatalogSectionOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{estimateLineItemCatalogSectionOpen ? '▼' : '▶'}</span>
              Estimate line item catalog (dev)
            </button>
            {estimateLineItemCatalogSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Preset line item, count, unit price, and optional description for draft estimates. Staff pick from the
                  book icon next to Line items.
                </p>
                <form onSubmit={saveEstimateLineItemCatalog}>
                  {estimateLineItemCatalogRows.map((r, idx) => (
                    <div
                      key={r.id && r.id.trim() !== '' ? r.id : `new-row-${idx}`}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        alignItems: 'center',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <input
                        value={r.line_item}
                        onChange={(e) => {
                          const v = e.target.value
                          setEstimateLineItemCatalogRows((prev) => {
                            const next = [...prev]
                            const cur = next[idx]
                            if (!cur) return prev
                            next[idx] = { ...cur, line_item: v }
                            return next
                          })
                        }}
                        placeholder="Line item"
                        style={{ flex: '1 1 120px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={r.quantity}
                        onChange={(e) => {
                          let q = Number(e.target.value)
                          if (!Number.isFinite(q) || q <= 0) q = 1
                          setEstimateLineItemCatalogRows((prev) => {
                            const next = [...prev]
                            const cur = next[idx]
                            if (!cur) return prev
                            const amount_cents = computeEstimateLineExtendedCents(q, cur.unit_price_cents)
                            next[idx] = { ...cur, quantity: q, amount_cents }
                            return next
                          })
                        }}
                        placeholder="Count"
                        title="Count"
                        style={{ width: 72, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.unit_price_cents ? r.unit_price_cents / 100 : ''}
                        onChange={(e) => {
                          const unit = Math.max(0, Math.round(Number(e.target.value || '0') * 100))
                          setEstimateLineItemCatalogRows((prev) => {
                            const next = [...prev]
                            const cur = next[idx]
                            if (!cur) return prev
                            const amount_cents = computeEstimateLineExtendedCents(cur.quantity, unit)
                            next[idx] = { ...cur, unit_price_cents: unit, amount_cents }
                            return next
                          })
                        }}
                        placeholder="Unit ($)"
                        style={{ width: 100, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                      <input
                        value={r.description}
                        onChange={(e) => {
                          const v = e.target.value
                          setEstimateLineItemCatalogRows((prev) => {
                            const next = [...prev]
                            const cur = next[idx]
                            if (!cur) return prev
                            next[idx] = { ...cur, description: v }
                            return next
                          })
                        }}
                        placeholder="Description (optional)"
                        aria-label="Description (optional)"
                        style={{ flex: '1 1 160px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEstimateLineItemCatalogRows((prev) => prev.filter((_, j) => j !== idx))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setEstimateLineItemCatalogRows((prev) => [
                          ...prev,
                          {
                            id: '',
                            line_item: '',
                            description: '',
                            quantity: 1,
                            unit_price_cents: 0,
                            amount_cents: 0,
                          },
                        ])
                      }
                    >
                      Add row
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={estimateLineItemCatalogSaving}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: estimateLineItemCatalogSaving ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {estimateLineItemCatalogSaving ? 'Saving…' : 'Save catalog'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setEstimatePublicTermsSectionOpen((prev) => !prev)}
              aria-expanded={estimatePublicTermsSectionOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '0.75rem' }} aria-hidden>
                {estimatePublicTermsSectionOpen ? '\u25BC' : '\u25B6'}
              </span>
              Public estimate Terms and Conditions (plain text)
            </button>
            {estimatePublicTermsSectionOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                  Shown at <code>/estimate/terms</code> to anyone (no login). Linked from the estimate acceptance page.
                </p>
                <form onSubmit={saveEstimatePublicTerms}>
                  <textarea
                    value={estimatePublicTermsBody}
                    onChange={(e) =>
                      setEstimatePublicTermsBody(e.target.value.slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN))
                    }
                    rows={8}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={estimatePublicTermsSaving}
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 1rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: estimatePublicTermsSaving ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {estimatePublicTermsSaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </div>
            )}
          </div>
    </>
  )
}
