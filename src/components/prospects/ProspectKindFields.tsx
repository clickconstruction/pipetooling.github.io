import { PROSPECT_COMPANY_ROLES, PROSPECT_SOURCES, type ProspectKind } from '../../lib/prospects/prospectKinds'
import { tradesLeftToPick, withTrade } from '../../lib/prospects/subsLane'

/**
 * The boxes a kind adds to New Prospect and Edit prospect (v2.5559): where we found them for every kind; a sub's
 * trades and range; a GC lead's role. Moved out of `src/pages/Prospects.tsx` unchanged. It stays a function the two
 * windows call, as it was, so each window's column of boxes is drawn as one list.
 */
export function renderKindFields(
  k: ProspectKind,
  f: {
    source: string
    setSource: (v: string) => void
    trades: string
    setTrades: (v: string) => void
    maxMiles: string
    setMaxMiles: (v: string) => void
    role: string
    setRole: (v: string) => void
    /** The bench's trade names (v2.5560), offered as picks under Trades. */
    tradeChoices?: readonly string[]
  },
) {
  const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const
  const labelStyle = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' } as const
  return (
    <>
      {k === 'gc_lead' && (
        <div>
          <span style={labelStyle}>Who they are</span>
          <div style={{ display: 'flex', gap: '0.5rem 0.9rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
            {PROSPECT_COMPANY_ROLES.map((r) => (
              <label key={r.role} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                <input type="radio" name="prospect-company-role" checked={f.role === r.role} onChange={() => f.setRole(r.role)} />
                {r.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {k === 'sub' && (
        <>
          <label>
            <span style={labelStyle}>
              Trades <span style={{ color: 'var(--text-muted)' }}>— the bench's names, a comma between two</span>
            </span>
            <input type="text" value={f.trades} onChange={(e) => f.setTrades(e.target.value)} style={inputStyle} placeholder="Concrete, Fire sprinkler" />
          </label>
          {(() => {
            const left = tradesLeftToPick(f.tradeChoices ?? [], f.trades)
            if (left.length === 0) return null
            return (
              <div role="group" aria-label="The bench's trades" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '-0.4rem', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>On the bench:</span>
                {left.map((trade) => (
                  <button
                    key={trade}
                    type="button"
                    onClick={() => f.setTrades(withTrade(f.trades, trade))}
                    style={{ font: 'inherit', fontSize: '0.75rem', padding: '0.05rem 0.5rem', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                  >
                    + {trade}
                  </button>
                ))}
              </div>
            )
          })()}
          <label>
            <span style={labelStyle}>Goes up to (miles)</span>
            <input type="number" min={1} value={f.maxMiles} onChange={(e) => f.setMaxMiles(e.target.value)} style={inputStyle} placeholder="not said" />
          </label>
        </>
      )}
      <label>
        <span style={labelStyle}>Where we found them</span>
        <input type="text" list="prospect-sources" value={f.source} onChange={(e) => f.setSource(e.target.value)} style={inputStyle} placeholder={PROSPECT_SOURCES[0]} />
        <datalist id="prospect-sources">
          {PROSPECT_SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
    </>
  )
}
