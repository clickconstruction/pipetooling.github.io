/**
 * Submittals decision 11 (v2.5023, the owner's call of 2026-10-09): a design-change row says whose
 * call it is (architect · engineer · GC · owner) and carries the sign-off the office recorded —
 * who, on what day, and how it came. The words the room prints live in the shared payload kernel
 * (`designCallLine`); this is the office's side: what the edit window starts from and what a save
 * writes. Pure.
 */
import { asDesignCallBy, asSignoffVia, type DesignCallBy, type SignoffVia } from '../../../supabase/functions/_shared/submittalRoomPayload'

/** The four columns (migration 20261009234500), optional until the types regenerate after the push. */
export type DesignCallFields = {
  call_by?: string | null
  signoff_name?: string | null
  signoff_on?: string | null
  signoff_via?: string | null
}

/** What the edit window holds while the office types. */
export type DesignCallDraft = { callBy: DesignCallBy | null; signoffName: string; signoffOn: string; signoffVia: SignoffVia | null }

export function designCallDraft(item: DesignCallFields): DesignCallDraft {
  return {
    callBy: asDesignCallBy(item.call_by),
    signoffName: item.signoff_name ?? '',
    signoffOn: item.signoff_on ?? '',
    signoffVia: asSignoffVia(item.signoff_via),
  }
}

/**
 * The columns a save writes. On a design change, what the office set; on any other status, nothing,
 * so a row that held a call or a sign-off is cleared. Null when there is nothing to write or clear:
 * a save before the migration is pushed then names no new column and cannot fail on it.
 */
export function designCallPatch(status: string, draft: DesignCallDraft, before: DesignCallFields): Required<DesignCallFields> | null {
  const next: Required<DesignCallFields> =
    status === 'design_change'
      ? {
          call_by: draft.callBy,
          signoff_name: draft.signoffName.trim().slice(0, 120) || null,
          signoff_on: /^\d{4}-\d{2}-\d{2}$/.test(draft.signoffOn) ? draft.signoffOn : null,
          signoff_via: draft.signoffVia,
        }
      : { call_by: null, signoff_name: null, signoff_on: null, signoff_via: null }
  const had = [before.call_by, before.signoff_name, before.signoff_on, before.signoff_via].some((v) => v != null)
  const has = Object.values(next).some((v) => v != null)
  return has || had ? next : null
}

/**
 * What a row takes with it when it moves: a split, or the next revision with the product unchanged.
 * Only a design change's record, and only one with something in it, so a row with none names no
 * new column.
 */
export function designCallCarry(status: string | null | undefined, item: DesignCallFields): Required<DesignCallFields> | null {
  if (status !== 'design_change') return null
  const rec = { call_by: item.call_by ?? null, signoff_name: item.signoff_name ?? null, signoff_on: item.signoff_on ?? null, signoff_via: item.signoff_via ?? null }
  return Object.values(rec).some((v) => v != null) ? rec : null
}
