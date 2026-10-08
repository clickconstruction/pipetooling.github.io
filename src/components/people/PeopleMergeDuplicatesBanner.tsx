import type { PersonUserDuplicate } from '../../lib/mergePersonUserDuplicates'

export type PeopleMergeDuplicatesBannerProps = {
  duplicates: PersonUserDuplicate[]
  mergingPersonName: string | null
  onMerge: (dup: PersonUserDuplicate) => void
}

/** People → Hours, under Teams: the person/user duplicates and a Merge button for each (#46 row 6, v2.4945). Nothing when there are none. */
export default function PeopleMergeDuplicatesBanner({ duplicates, mergingPersonName, onMerge }: PeopleMergeDuplicatesBannerProps) {
  if (duplicates.length === 0) return null
  return (
    <section style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-amber-100)', border: '1px solid #f59e0b', borderRadius: 4 }}>
      <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-amber-800)' }}>
        Found {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''}: person name vs user. Merge to consolidate.
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {duplicates.map((dup) => (
          <li key={dup.personName} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{dup.personName} → {dup.userDisplayName}</span>
            <button
              type="button"
              onClick={() => onMerge(dup)}
              disabled={mergingPersonName === dup.personName}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: mergingPersonName === dup.personName ? 'not-allowed' : 'pointer' }}
            >
              {mergingPersonName === dup.personName ? 'Merging…' : 'Merge'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
