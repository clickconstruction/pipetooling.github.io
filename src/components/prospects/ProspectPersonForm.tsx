import type { ReactNode } from 'react'
import { OK_TO_TEXT_CHOICES, type CompanyFields, type PersonFields } from '../../lib/prospects/personBlock'
import { PROSPECT_LANGS, type ProspectKind } from '../../lib/prospects/prospectKinds'

/**
 * The two blocks New Prospect and Edit prospect share (v2.5601, punch list #117): the person we
 * call first, the company under them. A person on their own leaves the company block empty. The
 * `double` slot draws the one line that says where the company already lives.
 */
export function ProspectPersonForm({
  person,
  onPerson,
  company,
  onCompany,
  kind,
  double,
}: {
  person: PersonFields
  onPerson: (next: PersonFields) => void
  company: CompanyFields
  onCompany: (next: CompanyFields) => void
  kind: ProspectKind
  double?: ReactNode
}) {
  const input = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 } as const
  const label = { display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' } as const
  const head = { margin: '0.25rem 0 0', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-700)' } as const
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem 0.75rem' } as const
  const setP = (key: keyof PersonFields) => (v: string) => onPerson({ ...person, [key]: v })
  const setC = (key: keyof CompanyFields) => (v: string) => onCompany({ ...company, [key]: v })
  const companyHint = kind === 'sub' ? 'the company on the bench' : 'leave it empty for a person on their own'
  return (
    <div data-prospect-person-form style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <p style={head}>The person we call</p>
      <div style={grid}>
        <label>
          <span style={label}>Name</span>
          <input type="text" value={person.name} onChange={(e) => setP('name')(e.target.value)} style={input} />
        </label>
        <label>
          <span style={label}>Title</span>
          <input type="text" value={person.title} onChange={(e) => setP('title')(e.target.value)} style={input} placeholder="Estimator" />
        </label>
        <label>
          <span style={label}>Cell</span>
          <input type="text" value={person.cell} onChange={(e) => setP('cell')(e.target.value)} style={input} />
        </label>
        <label>
          <span style={label}>Email</span>
          <input type="email" value={person.email} onChange={(e) => setP('email')(e.target.value)} style={input} />
        </label>
        <div>
          <span style={label}>Language</span>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
            {PROSPECT_LANGS.map((l) => (
              <label key={l.lang} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                <input type="radio" name="prospect-lang" checked={person.lang === l.lang} onChange={() => setP('lang')(l.lang)} />
                {l.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span style={label}>May we text?</span>
          <div style={{ display: 'flex', gap: '0.9rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
            {OK_TO_TEXT_CHOICES.map((c) => (
              <label key={c.value} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                <input type="radio" name="prospect-ok-to-text" checked={person.okToText === c.value} onChange={() => onPerson({ ...person, okToText: c.value })} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>
      {double}
      <p style={head}>
        The company <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {companyHint}</span>
      </p>
      <div style={grid}>
        <label>
          <span style={label}>Company</span>
          <input type="text" value={company.company} onChange={(e) => setC('company')(e.target.value)} style={input} />
        </label>
        <label>
          <span style={label}>Office phone</span>
          <input type="text" value={company.officePhone} onChange={(e) => setC('officePhone')(e.target.value)} style={input} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          <span style={label}>Address</span>
          <input type="text" value={company.address} onChange={(e) => setC('address')(e.target.value)} style={input} />
        </label>
        <label>
          <span style={label}>Website</span>
          <input type="text" value={company.website} onChange={(e) => setC('website')(e.target.value)} style={input} placeholder="https://" />
        </label>
        <label>
          <span style={label}>Also reach</span>
          <input type="text" value={company.alsoReach} onChange={(e) => setC('alsoReach')(e.target.value)} style={input} placeholder="Ana Reyna, office · (210) 555-0190" />
        </label>
      </div>
    </div>
  )
}
