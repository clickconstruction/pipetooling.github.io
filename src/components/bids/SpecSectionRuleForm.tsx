/**
 * Add or edit one Division 22 rule (v2.5061, the rules manager's write side — PR 4 of the train in
 * `to-dos/division-22-rules-manager.md`). Before anything is saved the form shows what the change would move:
 * every name whose code changes and the coverage before and after (`previewRuleChange`), what stops it from
 * saving (`validateRuleDraft`) and an order shared with a rule that catches the same names (`orderTies`).
 */
import { useId, useMemo, useState, type CSSProperties } from 'react'

import type { SpecSectionMatchKind } from '../../lib/classifySpecSection'
import type { FixtureNameAuditInput } from '../../lib/specSectionAudit'
import {
  defaultPriorityFor,
  orderTieWarning,
  orderTies,
  previewRuleChange,
  priorityBand,
  validateRuleDraft,
  type LedgerRule,
  type NameOutcome,
  type RuleDraft,
  type RuleProblem,
} from '../../lib/specSectionRules'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'

const NO_CODE = '__no_code__'
const SHIFTS_SHOWN = 8

const KIND_OPTIONS: Array<{ value: SpecSectionMatchKind; label: string }> = [
  { value: 'starts_with', label: 'starts with' },
  { value: 'contains', label: 'contains' },
  { value: 'exact', label: 'exactly' },
]

type Props = {
  /** The rule being edited, or null to add one. */
  editing: LedgerRule | null
  rules: ReadonlyArray<LedgerRule>
  names: ReadonlyArray<FixtureNameAuditInput>
  sections: ReadonlyArray<{ code: string; title: string }>
  saving: boolean
  error: string | null
  portalZIndex: number
  onCancel: () => void
  onSave: (draft: RuleDraft) => void
}

function outcomeWords(o: NameOutcome): string {
  if (o.outcome === 'matched') return o.sectionCode
  return o.outcome === 'no-code' ? 'no code' : 'uncoded'
}

const label: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }
const field: CSSProperties = {
  padding: '0.35rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  font: 'inherit',
  fontSize: '0.875rem',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
}

export function SpecSectionRuleForm({ editing, rules, names, sections, saving, error, portalZIndex, onCancel, onSave }: Props) {
  const [pattern, setPattern] = useState(editing?.pattern ?? '')
  const [matchKind, setMatchKind] = useState<SpecSectionMatchKind>(editing?.matchKind ?? 'contains')
  const [section, setSection] = useState<string>(editing ? (editing.sectionCode ?? NO_CODE) : '')
  const [order, setOrder] = useState<string>(String(editing?.priority ?? defaultPriorityFor('contains', rules)))
  // A new rule's order follows its kind until someone types an order of their own.
  const [orderTouched, setOrderTouched] = useState(editing != null)

  const editingId = editing?.id
  const sectionId = useId()
  const draft: RuleDraft = useMemo(
    () => ({ pattern, matchKind, sectionCode: section === NO_CODE || section === '' ? null : section, priority: Number(order) }),
    [pattern, matchKind, section, order],
  )
  const sectionCodes = useMemo(() => new Set(sections.map((s) => s.code)), [sections])
  const problems: RuleProblem[] = useMemo(() => {
    const list = validateRuleDraft(draft, rules, sectionCodes, editingId)
    if (section === '') list.unshift({ level: 'refuse', message: 'Pick where the rule files its names, or No code.' })
    const tie = orderTieWarning(orderTies(draft, rules, names, editingId), draft.priority)
    if (tie) list.push(tie)
    return list
  }, [draft, section, rules, names, sectionCodes, editingId])
  const refused = problems.some((p) => p.level === 'refuse')

  const preview = useMemo(() => {
    if (!draft.pattern.trim() || section === '' || !Number.isInteger(draft.priority)) return null
    return previewRuleChange(rules, names, editingId ? { kind: 'edit', id: editingId, draft } : { kind: 'add', draft })
  }, [draft, section, rules, names, editingId])

  const sectionOptions: SearchableSelectOption[] = useMemo(
    () => [{ value: NO_CODE, label: 'No code (deliberately)' }, ...sections.map((s) => ({ value: s.code, label: `${s.code} · ${s.title}` }))],
    [sections],
  )

  const n = Number(order)
  return (
    <form
      aria-label={editing ? 'Edit a rule' : 'Add a rule'}
      onSubmit={(e) => {
        e.preventDefault()
        if (!refused && !saving) onSave(draft)
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '0.65rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 8rem minmax(0, 1.6fr) 6rem', gap: '0.5rem', alignItems: 'end' }}>
        <label style={label}>
          Looks for
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} style={{ ...field, fontFamily: 'ui-monospace, Menlo, monospace' }} />
        </label>
        <label style={label}>
          How
          <select
            value={matchKind}
            onChange={(e) => {
              const kind = e.target.value as SpecSectionMatchKind
              setMatchKind(kind)
              if (!orderTouched) setOrder(String(defaultPriorityFor(kind, rules)))
            }}
            style={field}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <div style={label}>
          <label htmlFor={sectionId}>Files under</label>
          <SearchableSelect
            id={sectionId}
            value={section}
            onChange={setSection}
            options={sectionOptions}
            placeholder="pick a section…"
            portalZIndex={portalZIndex}
            fillViewportHeight
            listMinWidthPx={420}
          />
        </div>
        <label style={label}>
          Order
          <input
            type="number"
            min={1}
            step={1}
            value={order}
            onChange={(e) => {
              setOrder(e.target.value)
              setOrderTouched(true)
            }}
            style={field}
          />
        </label>
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Rules decide in order, the lowest number first.{Number.isFinite(n) && n >= 1 ? ` Order ${n} sits with the ${priorityBand(n)}.` : ''}
      </span>

      {preview ? (
        <div aria-label="What this change moves" style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
          {preview.shifts.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>No name changes its code.</span>
          ) : (
            <>
              <span>
                Codes {preview.newlyCoded}, recodes {preview.recoded}, leaves {preview.newlyUncoded} uncoded. Coverage {preview.coverageBefore}% →{' '}
                {preview.coverageAfter}%.
              </span>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {preview.shifts.slice(0, SHIFTS_SHOWN).map((s) => (
                  <li key={s.fixture}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{s.fixture}</span> ({s.bidCount} bid{s.bidCount === 1 ? '' : 's'}): {outcomeWords(s.before)} →{' '}
                    {outcomeWords(s.after)}
                  </li>
                ))}
                {preview.shifts.length > SHIFTS_SHOWN ? <li>and {preview.shifts.length - SHIFTS_SHOWN} more names</li> : null}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {problems.map((p) => (
        <p key={p.message} role={p.level === 'refuse' ? 'alert' : undefined} style={{ margin: 0, fontSize: '0.8125rem', color: p.level === 'refuse' ? 'var(--text-red-600)' : 'var(--text-amber-700)' }}>
          {p.message}
        </p>
      ))}
      {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '0.35rem 0.8rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={refused || saving}
          style={{
            padding: '0.35rem 0.8rem',
            background: refused ? 'var(--bg-200)' : '#16a34a',
            color: refused ? 'var(--text-faint)' : 'white',
            border: 'none',
            borderRadius: 4,
            cursor: refused ? 'not-allowed' : 'pointer',
            font: 'inherit',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          {saving ? 'Saving…' : 'Save rule'}
        </button>
      </div>
    </form>
  )
}
