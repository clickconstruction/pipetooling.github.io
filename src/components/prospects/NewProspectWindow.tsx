import { Link } from 'react-router-dom'
import { LeaveQuestion } from '../bids/SubmittalLeaveGuard'
import type { CompanyDouble } from '../../lib/prospects/companyDouble'
import { PROSPECT_KINDS, PROSPECT_KIND_WORDS, type ProspectKind } from '../../lib/prospects/prospectKinds'
import type { StripRead } from '../../lib/prospects/stripState'
import { renderKindFields } from './ProspectKindFields'
import { ProspectPersonForm } from './ProspectPersonForm'
import type { NewProspectWindowState } from './useNewProspectWindow'

/**
 * New Prospect: the three kind cards, the person and company blocks, the line that says where a company already
 * lives with its door, and the kind's boxes. Its JSX moved out of `src/pages/Prospects.tsx` unchanged;
 * `useNewProspectWindow`, which the page calls, holds its boxes and its save. The page mounts it while it is open.
 */
export function NewProspectWindow({
  win,
  newKind,
  setNewKind,
  saving,
  benchTrades,
  openDoubleProspect,
}: {
  win: NewProspectWindowState
  newKind: ProspectKind
  setNewKind: (kind: ProspectKind) => void
  saving: boolean
  benchTrades: StripRead<{ trade: string; dependable: number }[]>
  /** Open it on a prospect double: the window closes and the card opens on its own lane. */
  openDoubleProspect: (twin: Extract<CompanyDouble, { door: 'open_prospect' }>) => void
}) {
  const {
    newCustomerLink,
    setNewCustomerLink,
    newProspectError,
    newSource,
    setNewSource,
    newTrades,
    setNewTrades,
    newMaxMiles,
    setNewMaxMiles,
    newRole,
    setNewRole,
    newPerson,
    setNewPerson,
    newCompany,
    setNewCompany,
    newGuard,
    newProspectTwin,
    closeNewProspect,
    saveNewProspect,
  } = win

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 750,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
      onClick={newGuard.requestClose}
    >
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 520,
          width: '90%',
          // The kind cards and a kind's boxes make the window taller than a laptop screen (v2.5574): it scrolls
          // inside, and it is wide enough that the three cards read in a few lines each.
          maxHeight: 'min(90vh, 100%)',
          overflowY: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.25rem 0' }}>New Prospect</h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Who are we looking for?</p>
        <div role="radiogroup" aria-label="What kind of prospect" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
          {PROSPECT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={newKind === k}
              onClick={() => setNewKind(k)}
              style={{
                textAlign: 'left',
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                border: newKind === k ? '2px solid #3b82f6' : '1px solid var(--border)',
                background: newKind === k ? 'var(--bg-blue-200)' : 'var(--surface)',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem' }}>{PROSPECT_KIND_WORDS[k].tab === 'Customers' ? 'A customer' : PROSPECT_KIND_WORDS[k].tab === 'Subs' ? 'A sub' : 'A job to GC'}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-700)' }}>{PROSPECT_KIND_WORDS[k].card}</span>
            </button>
          ))}
        </div>
        {newProspectError && (
          <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{newProspectError}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <ProspectPersonForm
            person={newPerson}
            onPerson={setNewPerson}
            company={newCompany}
            onCompany={setNewCompany}
            kind={newKind}
            onSource={setNewSource}
            double={(() => {
            // One line for every double (v2.5579): this lane, another lane, the bench, the customers, in that order.
            const linkish = { font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 } as const
            if (newKind === 'gc_lead' && newCustomerLink) {
              return (
                <p role="status" style={{ margin: 0, padding: '0.4rem 0.6rem', borderLeft: '3px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', fontSize: '0.8125rem', borderRadius: '0 4px 4px 0' }}>
                  Linked to the customer {newCustomerLink.name}. Asked us ✓ will use that record.{' '}
                  <button type="button" onClick={() => setNewCustomerLink(null)} style={linkish}>
                    Unlink
                  </button>
                </p>
              )
            }
            const twin = newProspectTwin
            if (!twin) return null
            return (
              <p role="status" data-company-double={twin.where} style={{ margin: 0, padding: '0.4rem 0.6rem', borderLeft: '3px solid var(--border-amber-soft)', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', fontSize: '0.8125rem', borderRadius: '0 4px 4px 0' }}>
                {twin.line}{' '}
                {twin.door === 'open_prospect' && (
                  <button type="button" onClick={() => openDoubleProspect(twin)} style={linkish}>
                    Open it
                  </button>
                )}
                {twin.door === 'open_bench' && (
                  <Link to="/gc?view=partners" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                    Open it
                  </Link>
                )}
                {twin.door === 'customer' && (
                  <>
                    {newKind === 'gc_lead' && (
                      <>
                        <button type="button" onClick={() => setNewCustomerLink({ id: twin.id, name: twin.name })} style={linkish}>
                          Link this lead to them
                        </button>
                        {' · '}
                      </>
                    )}
                    <Link to={`/customers/${twin.id}`} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                      Open their page
                    </Link>
                  </>
                )}
              </p>
            )
          })()}
          />
          {renderKindFields(newKind, {
            source: newSource, setSource: setNewSource,
            trades: newTrades, setTrades: setNewTrades,
            maxMiles: newMaxMiles, setMaxMiles: setNewMaxMiles,
            role: newRole, setRole: setNewRole,
            tradeChoices: (benchTrades ?? []).map((b) => b.trade),
          })}
        </div>
        {newGuard.asking && <LeaveQuestion what="The new prospect is not saved." onLeave={closeNewProspect} onKeep={newGuard.keep} />}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={saveNewProspect}
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {newProspectTwin ? 'Save anyway' : 'Save'}
          </button>
          <button
            type="button"
            onClick={newGuard.requestClose}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
