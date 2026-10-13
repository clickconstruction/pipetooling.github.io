/**
 * GC mode, the real build, the Board's B2b-i: the shape of the Dashboard's Needs you line for GC follow up, moved word for
 * word from the GC mode prototype (branch spike/gc-mode, `gcNeedsYou.ts`); the plan is to-dos/gc-mode/mockups/board-b2b.md on
 * that branch. Since v2.5289 the line is Follow up's count (`followUpNeedsWords` in `followUpNeedsIo.ts`), so `gcNeedsYou`
 * and `phraseFor`, the line over everyone the office waits on, went back to the prototype, their only caller.
 */
export interface GcNeedsYou {
  count: number
  /** Someone is late: a day passed, an ask never opened, a bill past due, insurance run out. Red, not amber. */
  late: boolean
  title: string
  detail: string
}
