/**
 * The Division 22 window's Rules tab (v2.5058, the rules manager's read side — PR 3 of the train in
 * `to-dos/division-22-rules-manager.md`). Every rule in the ledger under its section, in the order the rules
 * decide, each with its standing from `ruleStandings`: the names it decides, or the rule that gets its names
 * first, or nothing caught yet. Read-only; the write side is PR 4.
 */
import { useMemo, useState, type CSSProperties } from 'react'

import { ruleLabel } from '../../lib/specSectionAudit'
import { priorityBand, type LedgerRule, type RuleStanding, type SectionRuleGroup } from '../../lib/specSectionRules'

type Props = {
  groups: ReadonlyArray<SectionRuleGroup>
  standings: ReadonlyMap<string, RuleStanding>
  rulesById: ReadonlyMap<string, LedgerRule>
}

const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function Standing({ standing, rulesById }: { standing: RuleStanding | undefined; rulesById: ReadonlyMap<string, LedgerRule> }) {
  if (!standing || standing.state === 'idle') return <span style={muted}>Catches no name yet</span>
  if (standing.state === 'shadowed') {
    const first = standing.sampleShadowedBy[0]
    const by = first ? rulesById.get(first.byRuleId) : undefined
    return (
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
        Never decides: “{by ? ruleLabel(by) : 'an earlier rule'}” gets its names first
      </span>
    )
  }
  const more = standing.wins - standing.sampleWins.length
  return (
    <details>
      <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', color: '#15803d', fontWeight: 600 }}>
        Decides {plural(standing.wins, 'name', 'names')} on {plural(standing.winBids, 'bid', 'bids')}
      </summary>
      <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem', ...muted }}>
        {standing.sampleWins.map((name) => (
          <li key={name} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
            {name}
          </li>
        ))}
        {more > 0 ? <li>and {plural(more, 'more name', 'more names')}</li> : null}
      </ul>
    </details>
  )
}

export function SpecSectionRulesTab({ groups, standings, rulesById }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return groups
    return groups
      .map((g) => {
        const sectionHit = (g.code ?? '').toLowerCase().includes(q) || g.title.toLowerCase().includes(q)
        return { ...g, rules: sectionHit ? g.rules : g.rules.filter((r) => r.pattern.toLowerCase().includes(q)) }
      })
      .filter((g) => g.rules.length > 0 || (g.code ?? '').toLowerCase().includes(q) || g.title.toLowerCase().includes(q))
  }, [groups, q])

  const ruleGrid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.3fr) 9rem minmax(0, 1.7fr)',
    gap: '0.5rem',
    alignItems: 'start',
    padding: '0.4rem 0.6rem',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a rule or a section…"
        aria-label="Find a rule or a section"
        style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
      />
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', maxHeight: '52vh', overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <p style={{ margin: 0, padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No rule or section matches “{query.trim()}”.</p>
        ) : (
          visible.map((g) => (
            <section key={g.code ?? 'no-code'} aria-label={g.code ? `${g.code} ${g.title}` : g.title}>
              <h3
                style={{
                  margin: 0,
                  padding: '0.45rem 0.6rem',
                  background: 'var(--bg-subtle)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-strong)',
                }}
              >
                {g.code ? `${g.code} · ${g.title}` : g.title}
                <span style={{ ...muted, fontWeight: 400, marginLeft: '0.5rem' }}>{plural(g.rules.length, 'rule', 'rules')}</span>
              </h3>
              {g.rules.length === 0 ? (
                <p style={{ margin: 0, padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', ...muted }}>No rule files names here yet.</p>
              ) : (
                g.rules.map((r) => (
                  <div key={r.id} style={ruleGrid}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                      {ruleLabel(r)}
                    </span>
                    <span style={muted} title="Rules decide in this order: the lowest number goes first.">
                      order {r.priority} · {priorityBand(r.priority)}
                    </span>
                    <Standing standing={standings.get(r.id)} rulesById={rulesById} />
                  </div>
                ))
              )}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
