/**
 * The Division 22 window's Rules tab (v2.5058, the rules manager's read side — PR 3 of the train,
 * v2.5054–v2.5063). Every rule in the ledger under its section, in the order the rules
 * decide, each with its standing from `ruleStandings`: the names it decides, or the rule that gets its names
 * first, or nothing caught yet. Since v2.5061 (PR 4) it writes too: **Add a rule**, and **Edit** or **Delete** on
 * each rule, each showing what it would move before anything is saved. A deleted rule can be put back for 90 days.
 */
import { useMemo, useState, type CSSProperties } from 'react'

import { ruleLabel, type FixtureNameAuditInput } from '../../lib/specSectionAudit'
import {
  previewRuleChange,
  priorityBand,
  type LedgerRule,
  type RuleDraft,
  type RuleStanding,
  type SectionRuleGroup,
} from '../../lib/specSectionRules'
import { SpecSectionRuleForm } from './SpecSectionRuleForm'

type Props = {
  groups: ReadonlyArray<SectionRuleGroup>
  standings: ReadonlyMap<string, RuleStanding>
  rulesById: ReadonlyMap<string, LedgerRule>
  /** The write side (v2.5061): every rule in deciding order, the audit's names and the sections, for the form's preview. */
  rules: ReadonlyArray<LedgerRule>
  names: ReadonlyArray<FixtureNameAuditInput>
  sections: ReadonlyArray<{ code: string; title: string }>
  portalZIndex: number
  /** Saves a new rule (`editingId` null) or an edited one. Resolves to an error message, or null when saved. */
  onSaveRule: (editingId: string | null, draft: RuleDraft) => Promise<string | null>
  /** Deletes a rule. Resolves to an error message, or null when deleted. */
  onDeleteRule: (id: string) => Promise<string | null>
}

const smallButton: CSSProperties = {
  padding: '0.2rem 0.55rem',
  background: 'var(--bg-muted)',
  color: 'var(--text-strong)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.75rem',
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

/** What a delete would move, said before it happens. The rule can be put back for 90 days from Recently deleted. */
function DeleteConfirm({
  rule,
  rules,
  names,
  busy,
  error,
  onKeep,
  onDelete,
}: {
  rule: LedgerRule
  rules: ReadonlyArray<LedgerRule>
  names: ReadonlyArray<FixtureNameAuditInput>
  busy: boolean
  error: string | null
  onKeep: () => void
  onDelete: () => void
}) {
  const p = useMemo(() => previewRuleChange(rules, names, { kind: 'delete', id: rule.id }), [rules, names, rule.id])
  const effect =
    p.shifts.length === 0
      ? 'No name changes its code.'
      : `${p.newlyUncoded} name${p.newlyUncoded === 1 ? '' : 's'} would be left uncoded and ${p.recoded} recoded. Coverage ${p.coverageBefore}% → ${p.coverageAfter}%.`
  return (
    <div role="group" aria-label={`Delete ${ruleLabel(rule)}?`} style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-yellow-tint)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
        Delete “{ruleLabel(rule)}”? {effect} You can put it back for 90 days from Recently deleted.
      </span>
      {error ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</span> : null}
      <span style={{ display: 'flex', gap: '0.4rem' }}>
        <button type="button" disabled={busy} onClick={onDelete} style={{ ...smallButton, background: '#dc2626', color: 'white', border: 'none', fontWeight: 600 }}>
          {busy ? 'Deleting…' : 'Delete rule'}
        </button>
        <button type="button" onClick={onKeep} style={smallButton}>
          Keep it
        </button>
      </span>
    </div>
  )
}

export function SpecSectionRulesTab({ groups, standings, rulesById, rules, names, sections, portalZIndex, onSaveRule, onDeleteRule }: Props) {
  const [query, setQuery] = useState('')
  // Which rule the form is open for ('new' to add one), and which rule waits on a delete confirmation.
  const [formFor, setFormFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openForm(id: string) {
    setFormFor(id)
    setDeleting(null)
    setError(null)
  }

  async function save(draft: RuleDraft) {
    setBusy(true)
    const err = await onSaveRule(formFor === 'new' ? null : formFor, draft)
    setBusy(false)
    setError(err)
    if (!err) setFormFor(null)
  }

  async function remove(id: string) {
    setBusy(true)
    const err = await onDeleteRule(id)
    setBusy(false)
    setError(err)
    if (!err) setDeleting(null)
  }

  const formProps = { rules, names, sections, saving: busy, error, portalZIndex, onCancel: () => setFormFor(null), onSave: (d: RuleDraft) => void save(d) }
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
    gridTemplateColumns: 'minmax(0, 1.3fr) 9rem minmax(0, 1.7fr) auto',
    gap: '0.5rem',
    alignItems: 'start',
    padding: '0.4rem 0.6rem',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {formFor === 'new' ? (
        <SpecSectionRuleForm editing={null} {...formProps} />
      ) : (
        <button type="button" onClick={() => openForm('new')} style={{ ...smallButton, alignSelf: 'flex-start', fontSize: '0.8125rem', padding: '0.35rem 0.8rem' }}>
          Add a rule
        </button>
      )}
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
                g.rules.map((r) =>
                  formFor === r.id ? (
                    <div key={r.id} style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                      <SpecSectionRuleForm editing={r} {...formProps} />
                    </div>
                  ) : (
                    <div key={r.id}>
                      <div style={ruleGrid}>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                          {ruleLabel(r)}
                        </span>
                        <span style={muted} title="Rules decide in this order: the lowest number goes first.">
                          order {r.priority} · {priorityBand(r.priority)}
                        </span>
                        <Standing standing={standings.get(r.id)} rulesById={rulesById} />
                        <span style={{ display: 'flex', gap: '0.3rem' }}>
                          <button type="button" aria-label={`Edit ${ruleLabel(r)}`} onClick={() => openForm(r.id)} style={smallButton}>
                            Edit
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${ruleLabel(r)}`}
                            onClick={() => {
                              setDeleting(r.id)
                              setFormFor(null)
                              setError(null)
                            }}
                            style={smallButton}
                          >
                            Delete
                          </button>
                        </span>
                      </div>
                      {deleting === r.id ? (
                        <DeleteConfirm rule={r} rules={rules} names={names} busy={busy} error={error} onKeep={() => setDeleting(null)} onDelete={() => void remove(r.id)} />
                      ) : null}
                    </div>
                  ),
                )
              )}
            </section>
          ))
        )}
      </div>
    </div>
  )
}
