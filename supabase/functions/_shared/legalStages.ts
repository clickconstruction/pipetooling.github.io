/**
 * A legal matter's stages (punch list #85, item 16) — one list for the office's
 * kernel (`src/lib/legal/legalMatters.ts` re-exports it), `legal-portal`,
 * `submit-legal-portal` and `legal-notify-dispatch`. Pure, no imports.
 *
 *   review → referred (a dev's attorney-ready mark) → the firm's working stages
 *   demand · suit · judgment · post_judgment, with payment_plan beside them →
 *   one of the firm's ends: settled · uncollectible · dismissed.
 *
 * The firm reaching an end moves the stage but does NOT close the matter: it
 * stays on the portal, open for the payment and the last costs, until the
 * office closes it (`closed_at`). `written_down` is the office's own exit;
 * `pulled` is the label for a matter the office pulled back (`pulled_at`).
 */

/** Every stage the table allows (the CHECK widens to these with the item 16 migration). */
export const LEGAL_STAGE_LIST = ['review', 'referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed', 'written_down', 'pulled'] as const

/** The firm is working it. */
export const LEGAL_ACTIVE_STAGES = ['referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan'] as const

/** The firm's ends: they move the stage; the office's close is the end of the matter. */
export const LEGAL_END_STAGES = ['settled', 'uncollectible', 'dismissed'] as const

/** What the portal shows and accepts acts on — while `closed_at` is null. */
export const LEGAL_PORTAL_STAGES: readonly string[] = [...LEGAL_ACTIVE_STAGES, ...LEGAL_END_STAGES]

/** The steps the firm can record, in the picker's order (the CHECK takes them all since migration 20261006150000). */
export const LEGAL_FIRM_STEPS = ['demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed'] as const
export type LegalFirmStep = (typeof LEGAL_FIRM_STEPS)[number]

/** The step's line in the matter's stream (`legal_matter_entries.body`). */
export const LEGAL_FIRM_STEP_WORDS: Record<LegalFirmStep, string> = {
  demand: 'Demand sent on firm letterhead',
  suit: 'Suit filed',
  judgment: 'Judgment entered',
  post_judgment: 'After judgment: abstract or garnishment',
  payment_plan: 'On a payment plan',
  settled: 'Settled',
  uncollectible: 'Uncollectible',
  dismissed: 'Dismissed',
}

/** The picker's two groups: working it, and how it ended. */
export const LEGAL_FIRM_STEP_GROUPS: ReadonlyArray<{ label: string; steps: readonly LegalFirmStep[] }> = [
  { label: 'Working it', steps: ['demand', 'suit', 'judgment', 'post_judgment', 'payment_plan'] },
  { label: 'How it ended', steps: ['settled', 'uncollectible', 'dismissed'] },
]

export function isLegalFirmStep(raw: unknown): raw is LegalFirmStep {
  return typeof raw === 'string' && (LEGAL_FIRM_STEPS as readonly string[]).includes(raw)
}

/** True while the firm sees the matter and may act on it. */
export function legalMatterOnPortal(m: { stage: string | null | undefined; closed_at?: string | null }): boolean {
  return LEGAL_PORTAL_STAGES.includes(m.stage ?? '') && !m.closed_at
}

/** The ladder a step climbs. `payment_plan` sits beside it; the ends sit after it. */
const LADDER: Record<string, number> = { referred: 0, demand: 1, suit: 2, judgment: 3, post_judgment: 4 }

/**
 * What a firm step does to the stage (item 16 c): `move` it, keep it (`same`),
 * or `ask` the office first because it would move backward — judgment back to
 * demand, or an end back to a working stage. The entry is recorded either way.
 * Into or out of a payment plan is never backward: a plan can start after a
 * demand or a judgment, and a defaulted plan goes to suit.
 */
export function firmStepDecision(current: string, next: LegalFirmStep): 'move' | 'same' | 'ask' {
  if (current === next) return 'same'
  const fromEnd = (LEGAL_END_STAGES as readonly string[]).includes(current)
  if (fromEnd) return 'ask' // settled, then a dismissal or a revived suit: the office decides which end the matter has
  if ((LEGAL_END_STAGES as readonly string[]).includes(next) || next === 'payment_plan' || current === 'payment_plan') return 'move'
  const a = LADDER[current]
  const b = LADDER[next]
  if (a == null || b == null) return 'move'
  return b < a ? 'ask' : 'move'
}
