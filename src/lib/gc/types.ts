/**
 * GC mode, the real build: the shapes the plan kernels read (`plans.ts`). They are the GC mode
 * prototype's own shapes (branch spike/gc-mode, `src/lib/gcMode/gcTypes.ts`), so its records fit
 * them as they are. The plan: to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on branch spike/gc-mode.
 */

/** One drawing in a set: its number, like "E-201", and its title. */
export interface PlanSheet {
  id: string
  title: string
  /** The office's pick, when the number's letters do not say which discipline it is (`SHEET_DISCIPLINES`). */
  discipline?: string
  /** The page of the plan PDF it was read from. */
  page?: number
}

/** One section of the project manual (the specs): its number, like "09 91 23", and its title. */
export interface SpecSection {
  id: string
  title: string
}

/** Work a trade's quote leaves out, and who does it instead: another trade, "the owner" or "us". */
export interface ScopeExclusion {
  label: string
  by: string
}

/**
 * Who our customer is to the job (the owner, 2026-10-04: "Sometimes we are working for the owner,
 * sometimes we are working for another GC or an owner's rep who then works and bills the owner").
 */
export type CustomerRole = 'owner' | 'gc' | 'ownersRep'

/** A line the office saved to the scope book by hand. */
export interface ScopeBookSaved {
  trade: string
  words: string
  spec?: string
  leavesOut?: ScopeExclusion
  savedOn: string
}

/** A change to a line of the scope book. A null spec or "leaves out" clears it. */
export interface ScopeBookEdit {
  trade: string
  /** The line as the book had it. */
  words: string
  to: { words: string; spec?: string | null; leavesOut?: ScopeExclusion | null }
}

/** Two lines of one trade that say the same thing: `from` folds into `into`. */
export interface ScopeBookMerge {
  trade: string
  from: string
  into: string
}

/** A named list of one trade's lines, taken into a scope in one press. */
export interface ScopeBookSet {
  id: string
  trade: string
  name: string
  lines: string[]
  savedOn: string
  /** The project whose scope it was saved from. */
  fromProjectId?: string
}

/**
 * What the office changed in the scope book (the owner, 2026-10-04). The book itself is read from
 * every scope on our jobs and the usual lines (`scopeBook`); this holds only the hand-made part.
 */
export interface ScopeBookStore {
  saved: ScopeBookSaved[]
  edits: ScopeBookEdit[]
  merges: ScopeBookMerge[]
  sets: ScopeBookSet[]
}
