/**
 * T5-07 (Tier 5 X7): "These look like the same builder" — the one pair the loose rule would merge
 * but the key could not. Merge writes a `merge` alias (every join re-keys on the next load);
 * Keep separate writes a `keep` alias so the pair is never offered again.
 */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { saveIdentityAlias, type IdentityAliasMap } from '../../lib/identityAliases'
import { findLooseIdentityPairs } from '../../lib/identityKey'
import { identityPairKept } from '../../lib/identityAliases'

export type BuilderMergeCandidate = { key: string; name: string; bids: number }

export function builderMergePairs(groups: ReadonlyArray<BuilderMergeCandidate>, aliases: IdentityAliasMap): Array<[BuilderMergeCandidate, BuilderMergeCandidate]> {
  // Only name-keyed groups can be aliased; customer-keyed ones merge through Customers → Show similar.
  const nameKeyed = groups.filter((g) => g.key.startsWith('name:')).map((g) => ({ ...g, key: g.key.slice(5) }))
  return findLooseIdentityPairs(nameKeyed)
    .map(([a, b]) => [nameKeyed.find((g) => g.key === a.key)!, nameKeyed.find((g) => g.key === b.key)!] as [BuilderMergeCandidate, BuilderMergeCandidate])
    .filter(([a, b]) => !identityPairKept(a.key, b.key, aliases))
}

const btn: React.CSSProperties = {
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '0.3rem 0.65rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  cursor: 'pointer',
}

export function BuilderMergePrompt({ pair, onSaved }: { pair: [BuilderMergeCandidate, BuilderMergeCandidate]; onSaved: () => void }) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const [a, b] = pair
  const total = a.bids + b.bids

  const decide = async (into: BuilderMergeCandidate | null) => {
    if (busy) return
    setBusy(true)
    const err = into
      ? await saveIdentityAlias(
          {
            kind: 'builder',
            alias_key: into.key === a.key ? b.key : a.key,
            canonical_key: into.key,
            canonical_name: into.name,
            decision: 'merge',
          },
          user?.id ?? null,
        )
      : await saveIdentityAlias({ kind: 'builder', alias_key: b.key, canonical_key: a.key, canonical_name: a.name, decision: 'keep' }, user?.id ?? null)
    setBusy(false)
    if (err) {
      showToast(err, 'error')
      return
    }
    showToast(into ? `Merged into ${into.name} — every lens re-reads on the next load.` : 'Kept separate.', 'success')
    onSaved()
  }

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem 0.75rem',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.75rem',
        border: '1px solid var(--border-amber-soft)',
        background: 'var(--bg-amber-tint)',
        borderRadius: 8,
        fontSize: '0.8125rem',
        color: 'var(--text-amber-800)',
      }}
    >
      <span>
        These look like the same builder: <strong>{a.name}</strong> and <strong>{b.name}</strong> — {total} lost bid{total === 1 ? '' : 's'} between them.
      </span>
      <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
        <button type="button" disabled={busy} onClick={() => void decide(a)} style={btn}>
          Merge into {a.name}
        </button>
        <button type="button" disabled={busy} onClick={() => void decide(b)} style={btn}>
          Merge into {b.name}
        </button>
        <button type="button" disabled={busy} onClick={() => void decide(null)} style={{ ...btn, fontWeight: 500 }}>
          Keep separate
        </button>
      </span>
    </div>
  )
}
