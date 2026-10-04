/**
 * GC mode, the real build: the shapes the plan kernels read (`plans.ts`). They are the GC mode
 * prototype's own shapes (branch spike/gc-mode, `src/lib/gcMode/gcTypes.ts`), so its records fit
 * them as they are. The plan: to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on branch spike/gc-mode.
 */

/** One drawing in a set: its number, like "E-201", and its title. */
export interface PlanSheet {
  id: string
  title: string
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
