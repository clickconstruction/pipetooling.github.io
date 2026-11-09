import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { contactParts, SAN_ANTONIO_PERMIT_PORTAL, type CompanyFacts, type ParcelFacts } from '../../../supabase/functions/_shared/permitLookup'
import { shortMoney, workWords, type Hint, type LeadFacts, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { lookupCompany, lookupParcel, type LookupAnswer } from '../../lib/research/permitResearchIo'

/**
 * Research, Who pulled it (punch list #292, PR 4): the card behind a contact's name. The
 * company on Google Places (phone, website, address, what kind of business), the parcel at the
 * county (the owner of record, their mailing address, the DBA, the values), our own history
 * with the name, and the door to the city's own record with the permit number copied. Approach
 * them from here carries what was found onto the lead.
 */
const sectionTitle: CSSProperties = { fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const line: CSSProperties = { fontSize: '0.875rem', lineHeight: 1.5 }
const linkStyle: CSSProperties = { color: 'var(--text-link)' }
const smallPress: CSSProperties = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', minHeight: 34, cursor: 'pointer', font: 'inherit' }

type Loadable<F> = { state: 'loading' } | { state: 'done'; answer: LookupAnswer<F> } | { state: 'failed'; message: string }

export function WhoPulledItSheet({
  row,
  hint,
  onClose,
  onApproach,
}: {
  row: ResearchPermitRow
  hint: Hint
  onClose: () => void
  onApproach: (facts: LeadFacts) => void
}) {
  const parts = contactParts(row.contact)
  const [company, setCompany] = useState<Loadable<CompanyFacts>>({ state: 'loading' })
  const [parcel, setParcel] = useState<Loadable<ParcelFacts>>({ state: 'loading' })
  const [copied, setCopied] = useState(false)

  const load = useCallback(
    async (refresh: boolean) => {
      if (row.contact) {
        setCompany({ state: 'loading' })
        lookupCompany(row.contact, row.city, refresh)
          .then((answer) => setCompany({ state: 'done', answer }))
          .catch((e) => setCompany({ state: 'failed', message: formatErrorMessage(e) }))
      } else {
        setCompany({ state: 'done', answer: { found: false, facts: null, error: 'the permit names nobody', cached: false, lookedUpAt: null } })
      }
      if (row.address) {
        setParcel({ state: 'loading' })
        lookupParcel(row.address, row.city, refresh)
          .then((answer) => setParcel({ state: 'done', answer }))
          .catch((e) => setParcel({ state: 'failed', message: formatErrorMessage(e) }))
      } else {
        setParcel({ state: 'done', answer: { found: false, facts: null, error: 'the permit has no street address', cached: false, lookedUpAt: null } })
      }
    },
    [row.contact, row.address, row.city],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const companyFacts = company.state === 'done' ? company.answer.facts : null
  const parcelFacts = parcel.state === 'done' ? parcel.answer.facts : null
  const facts: LeadFacts = {
    companyName: companyFacts?.match === 'exact' ? companyFacts.name : parts.company ?? parts.person ?? row.contact,
    contactName: parts.person,
    phone: companyFacts?.phone ?? null,
    website: companyFacts?.website ?? null,
    companyAddress: companyFacts?.address ?? null,
    ownerOfRecord: parcelFacts?.owner ?? null,
  }
  const work = workWords(row)

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(row.permit_number)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="who-pulled-it-title"
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, padding: '1.25rem 1.5rem', maxWidth: 600, width: '92%', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={muted}>Who pulled it</div>
            <h2 id="who-pulled-it-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {parts.company ?? parts.person ?? row.contact ?? 'Nobody named'}
            </h2>
            {parts.company && parts.person && <div style={line}>{parts.person}</div>}
            <div style={muted}>
              {row.permit_number} · {work.main} · {row.address ?? 'no address'}
            </div>
          </div>
          <span style={{ flex: '1 1 auto' }} />
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', width: 36, height: 36, borderRadius: 8, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>
            ×
          </button>
        </div>

        <section>
          <div style={sectionTitle}>The company, on Google</div>
          {company.state === 'loading' && <div style={muted}>Asking Google…</div>}
          {company.state === 'failed' && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{company.message}</div>}
          {company.state === 'done' && !companyFacts && <div style={muted}>{company.answer.error ? `Could not ask: ${company.answer.error}` : 'Google knows no business by this name near San Antonio.'}</div>}
          {companyFacts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={line}>
                <strong>{companyFacts.name}</strong>
                {companyFacts.kind ? <span style={muted}> · {companyFacts.kind}</span> : null}
                {companyFacts.match === 'loose' && <span style={muted}> · Google’s best guess, read with care</span>}
              </div>
              {companyFacts.phone && (
                <div style={line}>
                  <a href={`tel:${companyFacts.phone.replace(/[^\d+]/g, '')}`} style={linkStyle}>
                    {companyFacts.phone}
                  </a>
                </div>
              )}
              {companyFacts.website && (
                <div style={line}>
                  <a href={companyFacts.website} target="_blank" rel="noreferrer" style={linkStyle}>
                    {companyFacts.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              )}
              {companyFacts.address && <div style={line}>{companyFacts.address}</div>}
              {companyFacts.maps_url && (
                <div style={muted}>
                  <a href={companyFacts.maps_url} target="_blank" rel="noreferrer" style={linkStyle}>
                    Open in Google Maps
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <div style={sectionTitle}>The property, at the county</div>
          {parcel.state === 'loading' && <div style={muted}>Asking Bexar County…</div>}
          {parcel.state === 'failed' && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{parcel.message}</div>}
          {parcel.state === 'done' && !parcelFacts && <div style={muted}>{parcel.answer.error ? `Could not ask: ${parcel.answer.error}` : 'The county’s parcel layer has no row for this street address.'}</div>}
          {parcelFacts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={line}>
                <strong>Owner of record:</strong> {parcelFacts.owner ?? 'not given'}
                {parcelFacts.dba ? <span style={muted}> · DBA {parcelFacts.dba}</span> : null}
              </div>
              {parcelFacts.owner_address && <div style={line}>Mailing address: {parcelFacts.owner_address}</div>}
              <div style={muted}>
                {[
                  parcelFacts.total_value ? `appraised ${shortMoney(parcelFacts.total_value)}` : null,
                  parcelFacts.building_sf ? `${Math.round(parcelFacts.building_sf).toLocaleString('en-US')} sq ft built` : null,
                  parcelFacts.year_built ? `built ${parcelFacts.year_built}` : null,
                  parcelFacts.acres ? `${parcelFacts.acres} acres` : null,
                  parcelFacts.use_code ? `use ${parcelFacts.use_code}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div style={muted}>
                {parcelFacts.detail_url && (
                  <a href={parcelFacts.detail_url} target="_blank" rel="noreferrer" style={linkStyle}>
                    Open at the appraisal district
                  </a>
                )}{' '}
                · as of the county’s roll, which runs behind the sale
              </div>
            </div>
          )}
        </section>

        <section>
          <div style={sectionTitle}>Our history with the name</div>
          <div style={line}>
            <strong>{hint.word}</strong> <span style={muted}>· {hint.detail}</span>
          </div>
        </section>

        <section>
          <div style={sectionTitle}>The city’s own record</div>
          <div style={muted}>The applicant, the contractor and the licensed professional, with a phone when the city has one. Copy the number, open the search, paste it.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" onClick={() => void copyNumber()} style={smallPress}>
              {copied ? 'Copied' : `Copy ${row.permit_number}`}
            </button>
            <a href={SAN_ANTONIO_PERMIT_PORTAL} target="_blank" rel="noreferrer" style={{ ...smallPress, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              Open the city’s permit search
            </a>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onApproach(facts)} style={{ background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
            Approach them with these facts…
          </button>
          <button type="button" onClick={() => void load(true)} style={smallPress}>
            Look again
          </button>
          <span style={{ flex: '1 1 auto' }} />
          <button type="button" onClick={onClose} style={smallPress}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
