import { PLANS_PICKER_HINT, PLANS_PICKER_LABEL, PLANS_PICKER_NONE, plansChoiceWords, type PlansChoice } from '../../lib/prospects/subsStages'

/**
 * For: the project a set of plans is for (v2.5807). Its trades come first on the list and light up. Draws nothing
 * when no project is out for a bid. Moved out of `src/pages/Prospects.tsx` (`renderPlansPicker`) unchanged.
 */
export function SubsPlansPicker({
  plans,
  plansFor,
  picked,
  onPick,
}: {
  plans: readonly PlansChoice[]
  /** The project the address names (`?for=`), which may no longer be one of `plans`. */
  plansFor: string | null
  picked: PlansChoice | null
  onPick: (id: string | null) => void
}) {
  if (plans.length === 0) return null
  return (
    <div role="group" aria-label={PLANS_PICKER_LABEL} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>
      <label style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', fontWeight: 700, color: 'var(--text-700)' }}>
        {PLANS_PICKER_LABEL}
        <select
          value={plansFor ?? ''}
          onChange={(e) => onPick(e.target.value || null)}
          style={{ font: 'inherit', fontWeight: 400, padding: '0.25rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', maxWidth: '100%' }}
        >
          <option value="">{PLANS_PICKER_NONE}</option>
          {plans.map((c) => (
            <option key={c.id} value={c.id}>
              {plansChoiceWords(c)}
            </option>
          ))}
        </select>
      </label>
      {picked ? (
        <span style={{ color: 'var(--text-600)' }}>
          {picked.trades.length === 0 ? (
            'every trade on this one is ours'
          ) : (
            <>
              needs <b style={{ color: 'var(--text-strong)' }}>{picked.trades.join(', ')}</b>
            </>
          )}
        </span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>{PLANS_PICKER_HINT}</span>
      )}
    </div>
  )
}
