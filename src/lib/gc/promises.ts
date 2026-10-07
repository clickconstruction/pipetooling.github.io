/**
 * GC mode, the real build: when an insurance certificate is asked for, moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcPromises.ts`) by the schedule's PR 1b, which reads it. The lane that lifts the trades' promises adds the rest of `gcPromises.ts` here.
 */

/** Ask for the renewed certificate this many days before the policy runs out. */
export const INSURANCE_ASK_DAYS = 30
