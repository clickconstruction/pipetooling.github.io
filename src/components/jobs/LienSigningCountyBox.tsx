import { LIEN_SIGNING_COUNTY_LABEL, signingCountyHint } from '../../lib/jobs/lienSigningCounty'

/** The box beside a lien paper's print press (punch list #314): the county it is signed in, for this print. */
export function LienSigningCountyBox({ county, onChange, id }: { county: string; onChange: (county: string) => void; id: string }) {
  return (
    <div data-lien-signing-county style={{ display: 'grid', gap: '0.2rem', flexBasis: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
      <label htmlFor={id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', justifySelf: 'start' }}>
        {LIEN_SIGNING_COUNTY_LABEL}
        <input
          id={id}
          type="text"
          value={county}
          onChange={(e) => onChange(e.target.value)}
          placeholder="county"
          autoComplete="off"
          style={{ width: '9rem', padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)' }}
        />
        County
      </label>
      <span data-lien-signing-county-hint>{signingCountyHint(county)}</span>
    </div>
  )
}
