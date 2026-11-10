import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatErrorMessage } from '../../utils/errorHandling'
import { contactParts, type CompanyFacts, type ParcelFacts } from '../../../supabase/functions/_shared/permitLookup'
import { askingCountyWords, noParcelWords, permitSearchDoor } from '../../lib/research/permitCityDoors'
import { shortDay, shortMoney, workWords, type Hint, type LeadFacts, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { loadBuilderPermits, lookupCompany, lookupParcel, type LookupAnswer } from '../../lib/research/permitResearchIo'
import { BUILDER_PERMIT_DAYS, TEXAS_FRANCHISE_SEARCH, builderPermitLines, builderSearchWord, builderWords, googleAskForCompany, googleAsksForContact, type SitePermit } from '../../lib/research/permitPublic'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { GoogleSearchPress } from './GoogleSearchPress'

/**
 * Research, Who pulled it (punch list #292, PR 4): the card behind a contact's name. The
 * company on Google Places (phone, website, address, what kind of business), the parcel at the
 * county (the owner of record, their mailing address, the DBA, the values), our own history
 * with the name, and the door to the city's own record with the permit number copied. Approach
 * them from here carries what was found onto the lead. Since punch list #302 it also lists the
 * other permits the same name pulled in the last year, a Google press searches the company, the
 * person and the owner of record, and a door opens the state's franchise tax search.
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
  answers,
}: {
  row: ResearchPermitRow
  hint: Hint
  onClose: () => void
  onApproach: (facts: LeadFacts) => void
  /** Opened from the skim: the two answers take the foot in place of Pursue. */
  answers?: { onPass: () => void; onKeep: () => void }
}) {
  const parts = contactParts(row.contact)
  const [company, setCompany] = useState<Loadable<CompanyFacts>>({ state: 'loading' })
  const [parcel, setParcel] = useState<Loadable<ParcelFacts>>({ state: 'loading' })
  const [copied, setCopied] = useState(false)
  const [nameCopied, setNameCopied] = useState(false)
  const [theirs, setTheirs] = useState<{ state: 'loading' } | { state: 'done'; rows: SitePermit[] } | { state: 'failed'; message: string }>({ state: 'loading' })
  const asks = googleAsksForContact(row.contact, row.city)

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

  // The name's other permits: one word asked of the table, the rows held to the whole name by the kernel.
  useEffect(() => {
    const word = builderSearchWord(row.contact)
    if (!word) {
      setTheirs({ state: 'done', rows: [] })
      return
    }
    let live = true
    setTheirs({ state: 'loading' })
    loadBuilderPermits(row.city, word, todayYmdInAppTz())
      .then((rows) => live && setTheirs({ state: 'done', rows }))
      .catch((e) => live && setTheirs({ state: 'failed', message: formatErrorMessage(e) }))
    return () => {
      live = false
    }
  }, [row.contact, row.city])
  const theirLines = useMemo(() => (theirs.state === 'done' ? builderPermitLines(theirs.rows, row.contact, row.id) : []), [theirs, row.contact, row.id])

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
  // The state's search is for a company: the one on the permit, else the county's owner of record.
  const stateName = parts.company ?? parcelFacts?.owner ?? null
  const work = workWords(row)

  const copyName = async () => {
    if (!stateName) return
    try {
      await navigator.clipboard.writeText(stateName)
      setNameCopied(true)
    } catch {
      setNameCopied(false)
    }
  }

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
            {(asks.company || asks.person) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <GoogleSearchPress ask={asks.company} words="Google the company" />
                <GoogleSearchPress ask={asks.person} words={parts.person ? `Google ${parts.person}` : undefined} />
              </div>
            )}
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
          {parcel.state === 'loading' && <div style={muted}>{askingCountyWords(row.city)}</div>}
          {parcel.state === 'failed' && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{parcel.message}</div>}
          {parcel.state === 'done' && !parcelFacts && <div style={muted}>{parcel.answer.error ? `Could not ask: ${parcel.answer.error}` : noParcelWords(row.city)}</div>}
          {parcelFacts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={line}>
                <strong>Owner of record:</strong> {parcelFacts.owner ?? 'not given'} <GoogleSearchPress ask={googleAskForCompany(parcelFacts.owner, row.city)} />
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
          <div style={sectionTitle}>Their other permits</div>
          {theirs.state === 'loading' && <div style={muted}>Reading this name’s other permits…</div>}
          {theirs.state === 'failed' && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{theirs.message}</div>}
          {theirs.state === 'done' && (
            <>
              <div style={muted}>{builderWords(theirLines, BUILDER_PERMIT_DAYS)}</div>
              {theirLines.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '3px 10px', fontSize: '0.875rem', lineHeight: 1.45, marginTop: 6 }}>
                  {theirLines.slice(0, 12).map((l) => (
                    <Fragment key={l.id}>
                      <span style={muted}>{shortDay(l.day)}</span>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {l.what}
                        {l.where ? <span style={muted}> · {l.where}</span> : null}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
              {theirLines.length > 12 && <div style={{ ...muted, marginTop: 4 }}>and {theirLines.length - 12} older ones</div>}
            </>
          )}
        </section>

        {stateName && (
          <section>
            <div style={sectionTitle}>The state’s business record</div>
            <div style={muted}>The franchise tax search: whether the company is in good standing, its registered agent and its officers. Copy the name, open the search, paste it.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <button type="button" onClick={() => void copyName()} style={smallPress}>
                {nameCopied ? 'Copied' : `Copy ${stateName}`}
              </button>
              <a href={TEXAS_FRANCHISE_SEARCH} target="_blank" rel="noreferrer" style={{ ...smallPress, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Open the state’s search
              </a>
            </div>
          </section>
        )}

        <section>
          <div style={sectionTitle}>The city’s own record</div>
          <div style={muted}>The applicant, the contractor and the licensed professional, with a phone when the city has one. Copy the number, open the search, paste it.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" onClick={() => void copyNumber()} style={smallPress}>
              {copied ? 'Copied' : `Copy ${row.permit_number}`}
            </button>
            {permitSearchDoor(row.city) && (
              <a href={permitSearchDoor(row.city) ?? undefined} target="_blank" rel="noreferrer" style={{ ...smallPress, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Open the city’s permit search
              </a>
            )}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          {answers ? (
            <>
              <button type="button" onClick={answers.onPass} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
                Pass
              </button>
              <button type="button" onClick={answers.onKeep} style={{ background: '#16a34a', color: '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => onApproach(facts)} style={{ background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
              Pursue with these facts…
            </button>
          )}
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
