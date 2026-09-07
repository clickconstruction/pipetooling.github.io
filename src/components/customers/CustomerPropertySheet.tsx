import { useState, type CSSProperties } from 'react'
import JobAddressSuggestions from '../jobs/JobAddressSuggestions'
import { prewarmAddressGeocode, useAddressSuggestions } from '../../hooks/useAddressSuggestions'
import { titleCaseAddress } from '../../lib/addressTitleCase'
import { suggestionSavedAddress, type AddressSuggestion } from '../../lib/addressAutocomplete'
import CustomerPropertyRecordPanel from './CustomerPropertyRecordPanel'
import type { PropertyDraft } from '../../lib/customers/propertyDraft'

/**
 * The property sheet (customer properties train, PR 3 — v2.3009): one
 * property's address (Google autocomplete, the job form's), note, and its
 * legal record panel. Pure over `draft` / `onChange`; the section owns
 * persistence and the Done / Cancel / Remove actions passed in.
 */

type Props = {
  draft: PropertyDraft
  onChange: (patch: Partial<PropertyDraft>) => void
  isNew: boolean
  isPrimary: boolean
  busy: boolean
  linkedJobCount: number
  onDone: () => void
  onCancel: () => void
  onRemove?: () => void
}

const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }
const inputStyle: CSSProperties = { padding: '0.45rem 0.55rem', width: '100%', boxSizing: 'border-box', fontSize: '0.875rem' }
const smallBtn: CSSProperties = { padding: '0.3rem 0.8rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }

export default function CustomerPropertySheet({ draft, onChange, isNew, isPrimary, busy, linkedJobCount, onDone, onCancel, onRemove }: Props) {
  const [addressFocused, setAddressFocused] = useState(false)
  const [suggestionsSuppressed, setSuggestionsSuppressed] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const { suggestions, clearSuggestions } = useAddressSuggestions(draft.address, addressFocused && !suggestionsSuppressed)
  const suggestionsOpen = addressFocused && !suggestionsSuppressed && suggestions.length > 0
  // A property whose address changed after a lookup needs a fresh lookup: the
  // record panel keys its auto-run on this.
  const [lookupKey, setLookupKey] = useState(0)

  function takeSuggestion(s: AddressSuggestion) {
    const saved = titleCaseAddress(suggestionSavedAddress(s))
    onChange({ address: saved })
    setSuggestionsSuppressed(true)
    clearSuggestions()
    prewarmAddressGeocode(saved)
    setLookupKey((k) => k + 1)
  }

  const canDone = draft.address.trim().length > 0 && !busy

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.7rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.875rem' }}>{isNew ? 'New property' : isPrimary ? 'Primary property' : 'Property'}</strong>
        {linkedJobCount > 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            · {linkedJobCount} job{linkedJobCount === 1 ? '' : 's'} here
          </span>
        ) : null}
      </div>
      <div>
        <label style={labelStyle} htmlFor="customer-property-address">
          Address
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="customer-property-address"
            type="text"
            value={draft.address}
            role="combobox"
            aria-expanded={suggestionsOpen}
            aria-autocomplete="list"
            aria-controls={suggestionsOpen ? 'job-address-suggestions' : undefined}
            onChange={(e) => {
              onChange({ address: e.target.value })
              setSuggestionsSuppressed(false)
              setActiveSuggestion(0)
            }}
            onFocus={() => setAddressFocused(true)}
            onBlur={() => {
              setAddressFocused(false)
              const cased = titleCaseAddress(draft.address)
              if (cased !== draft.address) onChange({ address: cased })
            }}
            onKeyDown={(e) => {
              if (!suggestionsOpen) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveSuggestion((i) => (i + 1) % suggestions.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveSuggestion((i) => (i - 1 + suggestions.length) % suggestions.length)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const s = suggestions[activeSuggestion]
                if (s) takeSuggestion(s)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setSuggestionsSuppressed(true)
                clearSuggestions()
              }
            }}
            placeholder="Street, City, TX ZIP"
            autoComplete="off"
            style={inputStyle}
            autoFocus={isNew}
          />
          {suggestionsOpen && <JobAddressSuggestions suggestions={suggestions} activeIndex={activeSuggestion} onPick={takeSuggestion} onHover={setActiveSuggestion} />}
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="customer-property-note">
          Note
        </label>
        <input id="customer-property-note" type="text" value={draft.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="e.g. rental, shop — deliveries in back, mother's house" style={inputStyle} />
      </div>
      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem' }}>Property record <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· feeds lien paperwork</span></div>
        <CustomerPropertyRecordPanel key={lookupKey} address={draft.address} fields={draft} onChange={(patch) => onChange(patch)} autoLookup={draft.address.trim().length > 0} />
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', paddingTop: '0.2rem' }}>
        <button type="button" disabled={!canDone} onClick={onDone} style={{ ...smallBtn, background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, opacity: canDone ? 1 : 0.6 }}>
          {busy ? 'Saving…' : isNew ? 'Add property' : 'Done'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={smallBtn}>
          Cancel
        </button>
        {onRemove ? (
          <button
            type="button"
            disabled={busy || linkedJobCount > 0}
            onClick={onRemove}
            title={linkedJobCount > 0 ? `${linkedJobCount} job${linkedJobCount === 1 ? '' : 's'} sit at this property — move them first` : 'Remove this property'}
            style={{ ...smallBtn, marginLeft: 'auto', color: 'var(--text-red-600)', opacity: linkedJobCount > 0 ? 0.6 : 1, cursor: linkedJobCount > 0 ? 'not-allowed' : 'pointer' }}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}
