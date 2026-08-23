/**
 * `?stagesMove=` deep link (v2.2145): open what a Today's Money Opportunities
 * card opens — from Quickfill's Jobs Cleanup station (or anywhere else that
 * renders the shared cards). One param, one key per card action; Jobs.tsx
 * routes it through the Stages tab's imperative handle (`openMoneyMove`).
 */
import type { PipelineMoveKey } from './pipelineOverview'

export const STAGES_MONEY_MOVE_KEYS = [
  'capable',
  'chase90',
  'fixDates',
  'ar',
  'chase',
  'gcRoundCertify',
  'gcRoundStart',
] as const

export type StagesMoneyMoveKey = (typeof STAGES_MONEY_MOVE_KEYS)[number]

export function parseStagesMoneyMoveKey(raw: string | null | undefined): StagesMoneyMoveKey | null {
  const t = (raw ?? '').trim()
  return (STAGES_MONEY_MOVE_KEYS as readonly string[]).includes(t) ? (t as StagesMoneyMoveKey) : null
}

/** The Pipeline URL that opens the card's target on arrival. */
export function stagesMoneyMoveHref(key: StagesMoneyMoveKey): string {
  return `/jobs?tab=stages&stagesMove=${key}`
}

/** The four system moves map 1:1 onto deep-link keys. */
export function stagesMoneyMoveKeyForPipelineMove(moveKey: PipelineMoveKey): StagesMoneyMoveKey {
  switch (moveKey) {
    case 'bill-capable':
      return 'capable'
    case 'chase-90':
      return 'chase90'
    case 'allocate-deposits':
      return 'ar'
    case 'fix-dates':
      return 'fixDates'
  }
}
