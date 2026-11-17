import { EmptyState } from '../EmptyState'
import NewCustomerForm from '../NewCustomerForm'
import { lastTouchLabel, type ProspectLastCall } from '../../lib/prospects/prospectListGrouping'
import { telHrefFor } from '../../lib/phoneContact'
import type { ProspectConvert } from './useProspectConvert'

/**
 * The Convert tab (the Customers lane): prospect → customer with contact persons and first bids, on one form.
 * Its JSX moved out of `src/pages/Prospects.tsx` unchanged; `useProspectConvert`, which the page calls, holds
 * everything it draws.
 */
export function ProspectsConvertTab({
  convert,
  canAccessFollowUp,
  prospectLastCallMap,
}: {
  convert: ProspectConvert
  canAccessFollowUp: boolean
  prospectLastCallMap: Record<string, ProspectLastCall>
}) {
  const {
    convertProspectId,
    convertSearchQuery,
    setConvertSearchQuery,
    convertContactPersons,
    setConvertContactPersons,
    convertBids,
    setConvertBids,
    convertServiceTypes,
    convertSaving,
    convertError,
    convertFirstInteractionDate,
    convertProspect,
    convertPickerPool,
    convertSearchResults,
    convertSuggestions,
    pickConvertProspect,
    handleConvertSubmit,
  } = convert

  return (
    <div className="prospectsConvert">
      {!canAccessFollowUp ? (
        <p style={{ color: 'var(--text-muted)' }}>You do not have access to Convert.</p>
      ) : (
        <>
          {/* Prospect selector */}
          <div className="convertProspectSelector">
            <label htmlFor="convert-prospect" className="convertLabel">Who are you converting?</label>
            <input
              id="convert-prospect"
              className="convertSelect"
              type="search"
              placeholder={`Search ${convertPickerPool.filter((p) => p.prospect_fit_status !== 'converted').length} prospects by company, contact, phone, or email…`}
              value={convertSearchQuery}
              onChange={(e) => setConvertSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const first = convertSearchResults[0]
                  if (first) pickConvertProspect(first)
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {convertSearchQuery.trim() !== '' && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginTop: '0.375rem', overflow: 'hidden' }}>
                {convertSearchResults.length === 0 ? (
                  <EmptyState compact main="No prospects match — converted prospects are not listed." />
                ) : (
                  convertSearchResults.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickConvertProspect(p)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem 0.75rem',
                        border: 'none',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        background: 'none',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.company_name || '—'}</span>
                      {p.contact_name && <span style={{ color: 'var(--text-muted)' }}> — {p.contact_name}</span>}
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {lastTouchLabel(p, prospectLastCallMap[p.id], Date.now())}
                        {p.phone_number ? ` · ${p.phone_number}` : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            {convertSearchQuery.trim() === '' && !convertProspectId && convertSuggestions.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ margin: '0 0 0.375rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Suggested — answered in the last 30 days</p>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {convertSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickConvertProspect(p)}
                      style={{ padding: '0.25rem 0.625rem', borderRadius: 999, fontSize: '0.8125rem', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                    >
                      {p.company_name || '—'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {convertProspect && (
              <div className="convertProspectSummary">
                <div className="convertProspectSummaryRow">
                  <span className="convertProspectSummaryLabel">Company</span>
                  <span>{convertProspect.company_name || '—'}</span>
                </div>
                <div className="convertProspectSummaryRow">
                  <span className="convertProspectSummaryLabel">Contact</span>
                  <span>{convertProspect.contact_name || '—'}</span>
                </div>
                <div className="convertProspectSummaryRow">
                  <span className="convertProspectSummaryLabel">Phone</span>
                  <span>{convertProspect.phone_number ? (
                    <a href={telHrefFor(convertProspect.phone_number)} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{convertProspect.phone_number}</a>
                  ) : '—'}</span>
                </div>
                <div className="convertProspectSummaryRow">
                  <span className="convertProspectSummaryLabel">Email</span>
                  <span>{convertProspect.email ? (
                    <a href={`mailto:${encodeURIComponent(convertProspect.email)}`} style={{ color: 'var(--text-link)', textDecoration: 'none' }}>{convertProspect.email}</a>
                  ) : '—'}</span>
                </div>
                <div className="convertProspectSummaryRow">
                  <span className="convertProspectSummaryLabel">Address</span>
                  <span>{convertProspect.address || '—'}</span>
                </div>
              </div>
            )}
          </div>

          {convertProspectId ? (
            <div className="convertFormLayout">
              {/* New Customer section */}
              <section className="convertSection">
                <h3 className="convertSectionTitle">1. Customer details</h3>
                <p className="convertSectionDesc">Basic info is pre-filled from the prospect.</p>
                <NewCustomerForm
                  mode="page"
                  showQuickFill={false}
                  initialValues={{
                    name: convertProspect?.company_name ?? '',
                    address: convertProspect?.address ?? '',
                    phone: convertProspect?.phone_number ?? '',
                    email: convertProspect?.email ?? '',
                    dateMet: convertFirstInteractionDate,
                  }}
                  onSubmitForConvert={handleConvertSubmit}
                />
              </section>

              {/* Contact persons */}
              <section className="convertSection">
                <h3 className="convertSectionTitle">2. Contact persons</h3>
                <p className="convertSectionDesc">Add people who will be associated with this customer.</p>
                <div className="convertCardsGrid">
                  {convertContactPersons.map((cp, i) => (
                    <div key={i} className="convertCard">
                      <div className="convertCardHeader">
                        <span className="convertCardTitle">Contact {i + 1}</span>
                        {convertContactPersons.length > 1 && (
                          <button
                            type="button"
                            className="convertRemoveBtn"
                            onClick={() => setConvertContactPersons((prev) => prev.filter((_, j) => j !== i))}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="convertCardFields">
                        <input
                          type="text"
                          className="convertInput"
                          placeholder="Name"
                          value={cp.name}
                          onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)))}
                        />
                        <input
                          type="text"
                          className="convertInput"
                          placeholder="Phone"
                          value={cp.phone}
                          onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, phone: e.target.value } : c)))}
                        />
                        <input
                          type="email"
                          className="convertInput"
                          placeholder="Email"
                          value={cp.email}
                          onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, email: e.target.value } : c)))}
                        />
                        <input
                          type="text"
                          className="convertInput"
                          placeholder="Note"
                          value={cp.note}
                          onChange={(e) => setConvertContactPersons((prev) => prev.map((c, j) => (j === i ? { ...c, note: e.target.value } : c)))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="convertAddBtn"
                  onClick={() => setConvertContactPersons((prev) => [...prev, { name: '', phone: '', email: '', note: '' }])}
                >
                  + Add contact person
                </button>
              </section>

              {/* Bids */}
              <section className="convertSection">
                <h3 className="convertSectionTitle">3. Bids</h3>
                <p className="convertSectionDesc">Create initial bids for this customer.</p>
                <div className="convertCardsGrid">
                  {convertBids.map((b, i) => (
                    <div key={i} className="convertCard">
                      <div className="convertCardHeader">
                        <span className="convertCardTitle">Bid {i + 1}</span>
                        {convertBids.length > 1 && (
                          <button
                            type="button"
                            className="convertRemoveBtn"
                            onClick={() => setConvertBids((prev) => prev.filter((_, j) => j !== i))}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="convertCardFields">
                        <input
                          type="text"
                          className="convertInput"
                          placeholder="Project name"
                          value={b.project_name}
                          onChange={(e) => setConvertBids((prev) => prev.map((x, j) => (j === i ? { ...x, project_name: e.target.value } : x)))}
                        />
                        <select
                          className="convertSelect"
                          value={b.service_type_id}
                          onChange={(e) => setConvertBids((prev) => prev.map((x, j) => (j === i ? { ...x, service_type_id: e.target.value } : x)))}
                        >
                          <option value="">Select service type...</option>
                          {convertServiceTypes.map((st) => (
                            <option key={st.id} value={st.id}>{st.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="convertAddBtn"
                  onClick={() => setConvertBids((prev) => [...prev, { project_name: '', service_type_id: convertServiceTypes[0]?.id ?? '' }])}
                >
                  + Add bid
                </button>
              </section>

              {/* Convert button */}
              <div className="convertSubmitRow">
                {convertError && <p className="convertError">{convertError}</p>}
                <button
                  type="submit"
                  form="convert-customer-form"
                  disabled={convertSaving}
                  className="convertSubmit"
                >
                  {convertSaving ? 'Converting…' : 'Convert to customer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="convertEmptyState">
              <p className="convertEmptyStateText">Select a prospect above to convert them into a customer.</p>
              <p className="convertEmptyStateHint">You can add contact persons and bids during the conversion.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
