import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState } from '../EmptyState'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { ParcelFacts } from '../../../supabase/functions/_shared/permitLookup'
import { appraisalDoor, askingCountyWords, cityReadsParcels, noParcelWords, permitSearchDoor } from '../../lib/research/permitCityDoors'
import { mapsDoor, plumberWords, shortDay, shortMoney, sqFtWords, workWords, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { deedsDoor, feedRowFields, googleAskForAddress, googleAskForCompany, sitePermitLines, siteWords, type SitePermit } from '../../lib/research/permitPublic'
import { historyWords } from '../../lib/research/permitHistory'
import { loadPermitFeedRow, loadPermitHistory, loadSitePermits, lookupParcel, type LookupAnswer, type PermitFeedRow, type PermitVerdictEvent } from '../../lib/research/permitResearchIo'
import { GoogleSearchPress } from './GoogleSearchPress'

/**
 * Research, The building (punch list #302): everything public about a permit's address on one
 * sheet. The permit as the city gave it, with every column the feed sent behind one press; the
 * parcel at the county (the owner of record, the values, what stands there); every permit the
 * feed holds on the address; and the doors to the city's own record and the county clerk's
 * deeds. A Google press searches the address and the owner. Opened from a row's address.
 */
const sectionTitle: CSSProperties = { fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const line: CSSProperties = { fontSize: '0.875rem', lineHeight: 1.5 }
const linkStyle: CSSProperties = { color: 'var(--text-link)' }
const smallPress: CSSProperties = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', minHeight: 34, cursor: 'pointer', font: 'inherit' }
const linkPress: CSSProperties = { background: 'transparent', border: 0, padding: 0, font: 'inherit', fontSize: 'inherit', color: 'var(--text-link)', textAlign: 'left', cursor: 'pointer' }
const facts: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(96px, 132px) minmax(0, 1fr)', gap: '3px 10px', fontSize: '0.875rem', lineHeight: 1.45 }
const factName: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }

type Loadable<T> = { state: 'loading' } | { state: 'done'; value: T } | { state: 'failed'; message: string }

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div style={facts}>
      {rows.map(([name, value]) => (
        <Fragment key={name}>
          <span style={factName}>{name}</span>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
        </Fragment>
      ))}
    </div>
  )
}

export function PermitBuildingSheet({
  row,
  onClose,
  onDecide,
  onWho,
  answers,
  closeOut,
}: {
  row: ResearchPermitRow
  onClose: () => void
  /** Opens the Decide sheet on this permit. */
  onDecide: () => void
  /** Opened from the skim: the two answers take the foot in place of Decide. */
  answers?: { onPass: () => void; onKeep: () => void }
  /** Opened from Kept: what was done on the permit shows, and the close-out takes the foot. */
  closeOut?: { onPursue: () => void; onNotPursuing: () => void }
  /** Opens the Who pulled it card on this permit's contact. */
  onWho: () => void
}) {
  const [feed, setFeed] = useState<Loadable<PermitFeedRow | null>>({ state: 'loading' })
  const [site, setSite] = useState<Loadable<SitePermit[]>>({ state: 'loading' })
  const [parcel, setParcel] = useState<Loadable<LookupAnswer<ParcelFacts>>>({ state: 'loading' })
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const [events, setEvents] = useState<PermitVerdictEvent[] | null>(null)

  // What was done on the permit, newest first, on every permit: who moved it, where to, when and why.
  useEffect(() => {
    let live = true
    loadPermitHistory(row.id)
      .then((list) => live && setEvents(list))
      .catch(() => live && setEvents([]))
    return () => {
      live = false
    }
  }, [row.id])

  const load = useCallback(
    async (refresh: boolean) => {
      setFeed({ state: 'loading' })
      setSite({ state: 'loading' })
      // The feed's row first: it carries the address key the site's list pairs on.
      loadPermitFeedRow(row.id)
        .then((value) => {
          setFeed({ state: 'done', value })
          return loadSitePermits(row.city, row.permit_number, value?.addressKey ?? null)
        })
        .then((value) => setSite({ state: 'done', value }))
        .catch((e) => {
          const message = formatErrorMessage(e)
          setFeed((f) => (f.state === 'done' ? f : { state: 'failed', message }))
          setSite({ state: 'failed', message })
        })
      if (row.address) {
        setParcel({ state: 'loading' })
        lookupParcel(row.address, row.city, refresh)
          .then((value) => setParcel({ state: 'done', value }))
          .catch((e) => setParcel({ state: 'failed', message: formatErrorMessage(e) }))
      } else {
        setParcel({ state: 'done', value: { found: false, facts: null, error: 'the permit has no street address', cached: false, lookedUpAt: null } })
      }
    },
    [row.id, row.city, row.permit_number, row.address],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const work = workWords(row)
  const plumber = plumberWords(row)
  const maps = mapsDoor(row)
  const deeds = deedsDoor(row.city)
  const cityPermitSearch = permitSearchDoor(row.city)
  // Offered only where the county's own record is not read: Bexar's answer carries its own link.
  const appraisal = cityReadsParcels(row.city) ? null : appraisalDoor(row.city)
  const parcelFacts = parcel.state === 'done' ? parcel.value.facts : null
  const fields = useMemo(() => (feed.state === 'done' ? feedRowFields(feed.value?.raw) : []), [feed])
  const lines = useMemo(() => (site.state === 'done' ? sitePermitLines(site.value, row.id) : []), [site, row.id])

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(row.permit_number)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const permitFacts: Array<[string, ReactNode]> = [
    ['Type', row.permit_type],
    ['Number', row.permit_number],
    ['Work', work.main],
    [row.stage === 'issued' ? 'Issued' : 'Applied', row.stage === 'issued' ? shortDay(row.issued_on ?? row.filed_on) : `${shortDay(row.submitted_on ?? row.filed_on)}, not issued yet`],
    ['Declared', shortMoney(row.declared_value) ?? 'value not declared'],
    ['Area', sqFtWords(row.area_sf) ?? 'not given'],
    [
      'Pulled by',
      row.contact ? (
        <button type="button" onClick={onWho} style={linkPress}>
          {row.contact}
        </button>
      ) : (
        'nobody named'
      ),
    ],
    ['Plumber', plumber.under ? `${plumber.chip}, ${plumber.under}` : plumber.chip],
  ]

  const countyFacts: Array<[string, ReactNode]> = parcelFacts
    ? [
        [
          'Owner of record',
          <span key="owner">
            {parcelFacts.owner ?? 'not given'} <GoogleSearchPress ask={googleAskForCompany(parcelFacts.owner, row.city)} />
          </span>,
        ],
        ['Mailing address', parcelFacts.owner_address ?? 'not given'],
        ['Doing business as', parcelFacts.dba ?? 'none given'],
        ['Land', shortMoney(parcelFacts.land_value) ?? 'not given'],
        ['Buildings', shortMoney(parcelFacts.improvement_value) ?? 'none on the roll'],
        ['Appraised', shortMoney(parcelFacts.total_value) ?? 'not given'],
        ['Use', parcelFacts.use_code ?? 'not given'],
        ['Built', parcelFacts.year_built ?? 'not given'],
        ['Built area', parcelFacts.building_sf ? `${Math.round(parcelFacts.building_sf).toLocaleString('en-US')} sq ft` : 'not given'],
        ['Lot', parcelFacts.acres ? `${parcelFacts.acres} acres` : 'not given'],
      ]
    : []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permit-building-title"
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 12, padding: '1.25rem 1.5rem', maxWidth: 600, width: '92%', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={muted}>The building</div>
            <h2 id="permit-building-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {row.address ?? row.permit_number}
            </h2>
            <div style={muted}>
              {row.city}
              {row.zip ? ` ${row.zip}` : ''} · {work.main}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <GoogleSearchPress ask={googleAskForAddress(row.address, row.city, row.zip)} words="Google the address" />
              {maps && (
                <a href={maps} target="_blank" rel="noreferrer" style={{ ...muted, ...linkStyle }}>
                  Open in Google Maps
                </a>
              )}
            </div>
          </div>
          <span style={{ flex: '1 1 auto' }} />
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', width: 36, height: 36, borderRadius: 8, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>
            ×
          </button>
        </div>

        <section>
          <div style={sectionTitle}>The permit, as the city gave it</div>
          <Facts rows={permitFacts} />
          <div style={{ marginTop: 6 }}>
            {feed.state === 'loading' && <span style={muted}>Reading the city’s row…</span>}
            {feed.state === 'failed' && <span style={{ ...muted, color: 'var(--text-red-700)' }}>{feed.message}</span>}
            {feed.state === 'done' && fields.length === 0 && <span style={muted}>The feed’s own row is not on file for this permit.</span>}
            {feed.state === 'done' && fields.length > 0 && (
              <button type="button" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)} style={{ ...linkPress, fontSize: '0.8125rem' }}>
                {showAll ? 'Hide the city’s own fields' : `Show all ${fields.length} fields the city sent`}
              </button>
            )}
          </div>
          {showAll && fields.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <Facts rows={fields.map((f) => [f.label, f.value] as [string, ReactNode])} />
              {feed.state === 'done' && feed.value && <div style={{ ...muted, marginTop: 6 }}>From the feed {feed.value.source}, last read {new Date(feed.value.pulledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</div>}
            </div>
          )}
        </section>

        <section>
          <div style={sectionTitle}>The property, at the county</div>
          {parcel.state === 'loading' && <div style={muted}>{askingCountyWords(row.city)}</div>}
          {parcel.state === 'failed' && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{parcel.message}</div>}
          {parcel.state === 'done' && !parcelFacts && <div style={muted}>{parcel.value.error ? `Could not ask: ${parcel.value.error}` : noParcelWords(row.city)}</div>}
          {parcel.state === 'done' && !parcelFacts && !parcel.value.error && appraisal && (
            <div style={{ marginTop: 6 }}>
              <a href={appraisal} target="_blank" rel="noreferrer" style={{ ...smallPress, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Open the appraisal district
              </a>
            </div>
          )}
          {parcelFacts && (
            <>
              <Facts rows={countyFacts} />
              <div style={{ ...muted, marginTop: 6 }}>
                {parcelFacts.detail_url && (
                  <a href={parcelFacts.detail_url} target="_blank" rel="noreferrer" style={linkStyle}>
                    Open at the appraisal district
                  </a>
                )}{' '}
                · as of the county’s roll, which runs behind the sale
              </div>
            </>
          )}
        </section>

        <section>
          <div style={sectionTitle}>Every permit on this address</div>
          {site.state === 'loading' && <div style={muted}>Reading the permits on this address…</div>}
          {site.state === 'failed' && <div style={{ ...muted, color: 'var(--text-red-700)' }}>{site.message}</div>}
          {site.state === 'done' && (
            <>
              <div style={muted}>{siteWords(lines)}</div>
              {lines.length > 0 && (
                <div style={{ ...facts, gridTemplateColumns: '64px minmax(0, 1fr)', marginTop: 6 }}>
                  {lines.map((l) => (
                    <Fragment key={l.id}>
                      <span style={factName}>{shortDay(l.day)}</span>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {l.what}
                        {l.who ? <span style={muted}> · {l.who}</span> : null}
                        {l.self ? <span style={muted}> · this permit</span> : null}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section>
          <div style={sectionTitle}>What we did</div>
          {events == null && <div style={muted}>Reading what was done…</div>}
          {events != null && events.length === 0 && closeOut && <div style={muted}>Kept, with nothing written since.</div>}
          {/* The next step is the answers at the foot of this sheet, so the words stand alone. */}
          {events != null && events.length === 0 && !closeOut && <EmptyState main="Nobody has answered this permit yet." compact />}
          {events != null && events.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {events.map((ev) => (
                <div key={ev.id} style={{ ...line, overflowWrap: 'anywhere' }}>
                  {historyWords(ev)}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div style={sectionTitle}>More, one press away</div>
          <div style={muted}>Each opens a public search page in a new tab.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            <div style={line}>
              The city’s own record: the applicant, the contractor and the reviews.
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button type="button" onClick={() => void copyNumber()} style={smallPress}>
                  {copied ? 'Copied' : `Copy ${row.permit_number}`}
                </button>
                {cityPermitSearch && (
                  <a href={cityPermitSearch} target="_blank" rel="noreferrer" style={{ ...smallPress, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                    Open the city’s permit search
                  </a>
                )}
              </div>
            </div>
            {deeds && (
              <div style={line}>
                The county clerk’s deeds: who bought it, and when.
                <div style={{ marginTop: 4 }}>
                  <a href={deeds} target="_blank" rel="noreferrer" style={{ ...smallPress, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                    Open the county clerk’s records
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'wrap' }}>
          {closeOut ? (
            <>
              <button type="button" onClick={closeOut.onPursue} style={{ background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
                Pursue…
              </button>
              <button type="button" onClick={closeOut.onNotPursuing} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
                Not pursuing…
              </button>
            </>
          ) : answers ? (
            <>
              <button type="button" onClick={answers.onPass} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
                Pass
              </button>
              <button type="button" onClick={answers.onKeep} style={{ background: '#16a34a', color: '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={onDecide} style={{ background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 8, padding: '11px 16px', fontSize: '0.9375rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}>
              {row.verdict ? 'Change the verdict…' : 'Decide…'}
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
