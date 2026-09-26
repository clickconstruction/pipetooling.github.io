import type { JobFormFocusRow } from './jobFormFocusRow'

/**
 * What a lien screen's door into Edit Job asks the window to open on. The Lien desk
 * (v2.3697: the plain-value doors), Put a GC on notice (v2.3819: the jobs band's chips)
 * and the owner-of-record prompts (v2.3667: the property-kind door) each name a focus;
 * this maps it onto the Job window's own options — the property-record row, a ringed fact
 * row, the Bill tab, the line items — in one place, so the two desks cannot drift
 * (they had: the Stages tab held two divergent inline ternaries).
 */
export type LienDoorFocus = 'property-record' | JobFormFocusRow | 'bill' | 'line-items'

/** The Job-window options a lien door sets — a structural slice of `OpenEditJobOptions`. */
export type LienDoorEditJobOptions = {
  /** Open on the Property record row, expanded and flashed. */
  propertyRecordFocus?: true
  /** Open on this fact row, expanded and ringed for a moment. */
  focusRow?: JobFormFocusRow
  /** Land on the Bill tab. */
  initialTab?: 'bill'
  /** Scroll to the line items and flash them. */
  fixturesSectionHighlight?: true
}

export function lienFocusEditJobOptions(focus: LienDoorFocus | null | undefined): LienDoorEditJobOptions {
  switch (focus) {
    case 'property-record':
      return { propertyRecordFocus: true }
    case 'gc':
    case 'lien-contract':
    case 'status':
      return { focusRow: focus }
    case 'pct':
      // The % done field lives on the Bill tab (v2.3819).
      return { initialTab: 'bill', focusRow: 'pct' }
    case 'line-items':
      return { initialTab: 'bill', fixturesSectionHighlight: true }
    case 'bill':
      return { initialTab: 'bill' }
    default:
      return {}
  }
}
