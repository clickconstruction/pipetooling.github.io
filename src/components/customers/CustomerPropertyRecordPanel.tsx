import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { txCountyCadPropertyUrl, txCountyCadSearchUrl } from '../../lib/txCountyLookup'
import { cadPasteHasFacts, parseCadPagePaste, type CadPasteResult } from '../../lib/customers/cadPagePaste'
import { customerAddressLienGaps } from '../../lib/jobs/lienProperty'
import {
  applyProposalToFields,
  cityStraddlesCounties,
  countySourceLabel,
  ownerLooksLikeCompany,
  parcelProvenanceLine,
  type ProposedPropertyRecord,
  type PropertyRecordFields,
} from '../../lib/customers/propertyRecord'
import { lookupPropertyRecord, propertyLookupErrorMessage, type PropertyLookupOutcome } from '../../lib/customers/propertyLookupClient'
import { splitJobAddressForPrefill } from '../../lib/txLocalityAddressSplit'

/**
 * The property record panel (customer properties train, PR 1 — v2.3004): the
 * legal identity of one `customer_addresses` row — county, legal description,
 * kind / homestead, owner of record, owner mailing address — with the
 * lookup that proposes them from the Texas statewide parcel roll. Every
 * proposed value shows where it came from; a person's typing is never
 * overwritten (the lookup fills blanks; each differing field offers its
 * record value as a one-click "use"). Pure presentation over `fields` /
 * `onChange`; the parent owns persistence.
 */

export type PropertyRecordDraft = PropertyRecordFields & { parcel_looked_up_at: string }

type Props = {
  address: string
  fields: PropertyRecordDraft
  onChange: (patch: Partial<PropertyRecordDraft>) => void
  /** Run the lookup on mount when the row has never been looked up (the sheet opens ready). */
  autoLookup?: boolean
  compact?: boolean
}

const inputStyle: CSSProperties = { padding: '0.4rem 0.5rem', width: '100%', boxSizing: 'border-box', fontSize: '0.8125rem' }
const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2, fontWeight: 500 }
const provStyle: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-faint)', marginTop: 2, display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }
const linkBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', color: 'var(--text-link)', fontWeight: 600 }
const srcTag: CSSProperties = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.6875rem', background: 'var(--bg-muted)', borderRadius: 3, padding: '0 0.3rem', color: 'var(--text-muted)' }

function pill(label: string, on: boolean, onClick: () => void, title?: string) {
  return (
    <button
      type="button"
      key={label}
      onClick={onClick}
      aria-pressed={on}
      title={title}
      style={{
        padding: '0.25rem 0.6rem',
        fontSize: '0.75rem',
        borderRadius: 6,
        border: on ? '2px solid #2563eb' : '1px solid var(--border-strong)',
        background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
        cursor: 'pointer',
        fontWeight: on ? 600 : 400,
        color: 'var(--text-700)',
      }}
    >
      {label}
    </button>
  )
}

export default function CustomerPropertyRecordPanel({ address, fields, onChange, autoLookup = false, compact = false }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [outcome, setOutcome] = useState<PropertyLookupOutcome | null>(null)
  const autoRan = useRef(false)
  // "Paste the CAD page" (v2.3016): the fallback when the roll has nothing under the pin.
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteResult, setPasteResult] = useState<CadPasteResult | null>(null)

  const proposal: ProposedPropertyRecord | null = outcome?.ok ? outcome.proposal : null
  const parcelError = outcome?.ok ? outcome.parcelError : null

  async function runLookup() {
    const a = address.trim()
    if (!a || status === 'loading') return
    setStatus('loading')
    const res = await lookupPropertyRecord(a)
    setOutcome(res)
    if (!res.ok) {
      setStatus('error')
      return
    }
    const next = applyProposalToFields(fields, res.proposal, 'fill-blanks')
    const patch: Partial<PropertyRecordDraft> = {}
    for (const k of Object.keys(next) as (keyof PropertyRecordFields)[]) {
      if (next[k] !== fields[k]) (patch as Record<string, unknown>)[k] = next[k]
    }
    if (res.proposal.found || res.proposal.county.county) patch.parcel_looked_up_at = new Date().toISOString()
    if (Object.keys(patch).length > 0) onChange(patch)
    setStatus('done')
  }

  useEffect(() => {
    if (!autoLookup || autoRan.current) return
    if (fields.parcel_id.trim() || fields.parcel_looked_up_at.trim()) return
    if (!address.trim()) return
    autoRan.current = true
    void runLookup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLookup, address])

  const gaps = customerAddressLienGaps(fields)
  const lienReady = gaps.length === 0
  const city = splitJobAddressForPrefill(address).city
  const straddle = cityStraddlesCounties(city)
  const cadPropertyUrl = txCountyCadPropertyUrl(fields.county, fields.parcel_id)
  const cadUrl = cadPropertyUrl || txCountyCadSearchUrl(fields.county)
  const provenance = parcelProvenanceLine(fields)
  const lookedUp = fields.parcel_looked_up_at.trim() !== ''

  /** "use: <record value>" under a field whose typed value differs from the record. */
  function recordLink(field: keyof PropertyRecordFields, proposed: string) {
    const current = String(fields[field] ?? '')
    if (!proposed || current.trim() === proposed.trim()) return null
    return (
      <button type="button" style={linkBtn} onClick={() => onChange({ [field]: proposed } as Partial<PropertyRecordDraft>)} title={proposed}>
        use the record's: {proposed.length > 60 ? `${proposed.slice(0, 58)}…` : proposed}
      </button>
    )
  }

  const countyCandidates = proposal?.county.candidates ?? []
  const showCountyPills = countyCandidates.length > 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* header: lookup + readiness */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void runLookup()}
          disabled={status === 'loading' || !address.trim()}
          style={{ padding: '0.3rem 0.7rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', fontWeight: 600 }}
        >
          {status === 'loading' ? 'Looking up…' : lookedUp || status === 'done' ? 'Look up again' : 'Look up the property record'}
        </button>
        {lienReady ? (
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-green-700)', border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', borderRadius: 6, padding: '0.05rem 0.4rem' }}>
            ✓ lien-ready
          </span>
        ) : (
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {gaps.length} lien field{gaps.length === 1 ? '' : 's'} missing
          </span>
        )}
        {cadUrl ? (
          <button
            type="button"
            onClick={() => openInExternalBrowser(cadUrl)}
            style={linkBtn}
            title={cadPropertyUrl ? `Open this parcel (Prop ID ${fields.parcel_id.trim()}) on the ${fields.county.trim()} County Appraisal District` : `Open the ${fields.county.trim()} County Appraisal District property search`}
          >
            {cadPropertyUrl ? `this parcel on ${fields.county.trim()} CAD ↗` : `${fields.county.trim()} CAD ↗`}
          </button>
        ) : null}
        <button type="button" onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen} style={linkBtn}>
          {pasteOpen ? 'Hide paste' : 'Paste the CAD page…'}
        </button>
      </div>

      {pasteOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '0.5rem 0.6rem', background: 'var(--bg-subtle)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            On the district's page for this property, select all, copy, and paste here. The app picks out the legal description, owner, mailing address and exemptions; you keep what is right.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value)
              setPasteResult(e.target.value.trim() ? parseCadPagePaste(e.target.value) : null)
            }}
            rows={4}
            placeholder="Paste the whole property page here"
            aria-label="Pasted CAD page"
            style={{ ...inputStyle, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', resize: 'vertical' }}
          />
          {pasteResult ? (
            cadPasteHasFacts(pasteResult) ? (
              <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 600 }}>Found in the paste:</span>
                {pasteResult.legalDescription ? <span>Legal description · {pasteResult.legalDescription}</span> : null}
                {pasteResult.ownerName ? <span>Owner · {pasteResult.ownerName}</span> : null}
                {pasteResult.mailingAddress ? <span>Mailing address · {pasteResult.mailingAddress}</span> : null}
                {pasteResult.propId ? <span>Prop ID · {pasteResult.propId}</span> : null}
                {pasteResult.homestead !== 'unknown' ? <span>Exemptions · {pasteResult.homestead === 'yes' ? 'homestead (HS)' : 'no homestead'}</span> : null}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const r = pasteResult
                      const company = ownerLooksLikeCompany(r.ownerName)
                      const patch: Partial<PropertyRecordDraft> = {}
                      if (r.legalDescription) patch.legal_description = r.legalDescription
                      if (r.ownerName) {
                        if (company) {
                          patch.owner_company = r.ownerName
                          if (!fields.owner_mode) patch.owner_mode = 'building_owner'
                        } else {
                          patch.owner_name = r.ownerName
                          if (!fields.owner_mode) patch.owner_mode = 'homeowner'
                        }
                      }
                      if (r.mailingAddress) patch.owner_mailing_address = r.mailingAddress
                      if (r.propId) patch.parcel_id = r.propId
                      if (r.homestead === 'yes') {
                        patch.property_kind = 'residential'
                        patch.homestead = true
                      } else if (r.homestead === 'no' && fields.property_kind === 'residential') {
                        patch.homestead = false
                      }
                      patch.parcel_source = fields.county.trim() ? `${fields.county.trim()} CAD (pasted)` : 'CAD page (pasted)'
                      patch.parcel_tax_year = ''
                      patch.parcel_looked_up_at = new Date().toISOString()
                      onChange(patch)
                      setPasteOpen(false)
                      setPasteText('')
                      setPasteResult(null)
                    }}
                    style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Use these
                  </button>
                  <button type="button" onClick={() => { setPasteOpen(false); setPasteText(''); setPasteResult(null) }} style={{ padding: '0.25rem 0.7rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>No property facts recognised yet — paste the whole page, including the "Legal Description" and "Owner" rows.</span>
            )
          ) : null}
        </div>
      ) : null}

      {status === 'error' && outcome && !outcome.ok ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{propertyLookupErrorMessage(outcome.error)}</p>
      ) : null}
      {status === 'done' && proposal ? (
        proposal.found ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-700)' }}>
            Found on the appraisal roll. Blank fields were filled from the record; check each value against the address, then keep or fix it.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-700)' }}>
            No parcel under the map pin{parcelError ? ` (${parcelError})` : ''}.{' '}
            {proposal.county.county ? `County still resolved: ${proposal.county.county}. ` : ''}
            Find the rest on the county appraisal district and paste it here.
          </p>
        )
      ) : null}

      {/* county */}
      <div>
        <label style={labelStyle}>County (where the lien files)</label>
        {showCountyPills ? (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: 4 }}>
            {countyCandidates.map((c) =>
              pill(`${c.county} · ${c.source === 'parcel' ? 'from the parcel' : c.source === 'geocoder' ? 'from the map pin' : 'from the city'}`, fields.county.trim().toLowerCase() === c.county.toLowerCase(), () => onChange({ county: c.county, county_source: c.source })),
            )}
          </div>
        ) : null}
        <input
          type="text"
          value={fields.county}
          onChange={(e) => onChange({ county: e.target.value, county_source: 'manual' })}
          placeholder="County"
          aria-label="Property county"
          style={inputStyle}
        />
        <div style={provStyle}>
          {fields.county.trim() && fields.county_source ? <span>{countySourceLabel(fields.county_source)}</span> : null}
          {straddle.length > 0 && fields.county_source === 'city' ? (
            <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>
              {city} sits in {straddle.join(', ')} — confirm from the parcel or the map pin.
            </span>
          ) : null}
          {showCountyPills ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>The sources disagree; the parcel record wins unless you know better.</span> : null}
        </div>
      </div>

      {/* legal description */}
      <div>
        <label style={labelStyle}>Legal description (County Appraisal District)</label>
        <textarea
          value={fields.legal_description}
          onChange={(e) => onChange({ legal_description: e.target.value })}
          rows={compact ? 2 : 2}
          placeholder="e.g. Lot 7, Block B, … Plat Records of … County, Texas"
          aria-label="Property legal description"
          style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={provStyle}>
          {provenance ? <span style={srcTag}>{provenance}</span> : null}
          {proposal?.found ? recordLink('legal_description', proposal.legalDescription) : null}
        </div>
      </div>

      {/* kind + homestead */}
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {pill('Residential', fields.property_kind === 'residential', () => onChange({ property_kind: fields.property_kind === 'residential' ? '' : 'residential' }))}
        {pill('Non-residential', fields.property_kind === 'non_residential', () => onChange({ property_kind: fields.property_kind === 'non_residential' ? '' : 'non_residential', homestead: false }))}
        {fields.property_kind === 'residential' ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }} title="Owner-occupied homestead: lien rights need a recorded pre-work contract signed by both spouses (Tex. Prop. Code § 53.254)">
            <input type="checkbox" checked={fields.homestead} onChange={(e) => onChange({ homestead: e.target.checked })} />
            homestead
          </label>
        ) : null}
      </div>
      {proposal?.found && fields.property_kind === 'residential' ? (
        <div style={{ ...provStyle, marginTop: -4 }}>
          {proposal.homestead === 'likely'
            ? 'Homestead is not on the statewide roll. Suggested because the owner gets mail at this property; confirm the HS exemption on the CAD page before a homestead job starts.'
            : proposal.homestead === 'unlikely'
              ? 'The owner gets mail elsewhere, so this looks like a rental — homestead left unchecked.'
              : 'Homestead is not on the statewide roll; confirm it on the CAD page.'}
        </div>
      ) : null}

      {/* owner */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {pill('Homeowner', fields.owner_mode === 'homeowner', () => onChange({ owner_mode: fields.owner_mode === 'homeowner' ? '' : 'homeowner' }))}
        {pill('Building owner', fields.owner_mode === 'building_owner', () => onChange({ owner_mode: fields.owner_mode === 'building_owner' ? '' : 'building_owner' }))}
      </div>
      <div>
        <label style={labelStyle}>Owner of record (person)</label>
        <input type="text" value={fields.owner_name} onChange={(e) => onChange({ owner_name: e.target.value })} placeholder="Owner of record" aria-label="Owner of record name" style={inputStyle} />
        <div style={provStyle}>{proposal?.found ? recordLink('owner_name', proposal.ownerName) : null}</div>
      </div>
      <div>
        <label style={labelStyle}>Owner company (if an entity holds title)</label>
        <input type="text" value={fields.owner_company} onChange={(e) => onChange({ owner_company: e.target.value })} placeholder="Owner company" aria-label="Owner of record company" style={inputStyle} />
        <div style={provStyle}>{proposal?.found ? recordLink('owner_company', proposal.ownerCompany) : null}</div>
      </div>
      <div>
        <label style={labelStyle}>Owner mailing address (lien notices go here)</label>
        <input type="text" value={fields.owner_mailing_address} onChange={(e) => onChange({ owner_mailing_address: e.target.value })} placeholder="Owner MAILING address" aria-label="Owner mailing address" style={inputStyle} />
        <div style={provStyle}>{proposal?.found ? recordLink('owner_mailing_address', proposal.ownerMailingAddress) : null}</div>
      </div>

      {/* checklist */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
        {(['county', 'legal description', 'owner of record', 'owner mailing address'] as const).map((item) => {
          const missing = gaps.includes(item)
          return (
            <span
              key={item}
              style={{
                padding: '0.15rem 0.5rem',
                borderRadius: 5,
                border: `1px solid ${missing ? 'var(--border-amber)' : 'var(--border-green)'}`,
                background: missing ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)',
                color: missing ? 'var(--text-amber-700)' : 'var(--text-green-700)',
              }}
            >
              {missing ? '○' : '✓'} {item}
            </span>
          )
        })}
      </div>
      {provenance ? (
        <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--text-faint)' }}>
          The roll lags sales — check the district's page on the day an affidavit files.
        </p>
      ) : null}
    </div>
  )
}
