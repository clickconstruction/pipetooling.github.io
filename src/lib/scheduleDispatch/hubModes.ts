/**
 * The Dispatch hub's interaction modes, and the rule that entering one leaves the others (the
 * SCHEDULE_DISPATCH map's step 6). `useScheduleDispatchHubModes` owns every flag below and ends a
 * flag only through `hubModeClears`, so this table is the whole rule: one row per thing that
 * changes a mode, one column per flag. `on` is the row's own flag (the hook sets it), `end` is
 * what the row ends, and `keep` is what it leaves alone.
 *
 * The rule is the page's as it stood before the move, gaps included, but for a to c: the three
 * that left two strips on screen were fixed in v2.4989. Gaps d to f, the owner's calls, are named
 * on their rows (`to-dos/dispatch-residuals.md`); changing one is a change to its row here and
 * the same flip in `hubModes.test.ts`.
 */

/** The columns. The first five are the modes; the rest travel with them. */
export const HUB_MODE_FLAGS = [
  /** Moving or copying a block (`cardPlacementMode`). */
  'placement',
  /** A block's + menu, the way into Linked copy and Solo copy (`plusMenuBlockId`). */
  'plusMenu',
  /** The two-stage linked copy (`linkedCopyMode`). */
  'linkedCopy',
  /** Placing a picked job on a cell (`hubAssignJobPlacement`). */
  'assignPlacement',
  /** Picking several cells for one job (`hubMultiCellAddActive` and its selection). */
  'multiCell',
  /** The job picker window (`hubAssignJobPickerOpen`). */
  'picker',
  /** Why the picker is open (`hubAssignJobPickerIntent`); ending it puts it back to `toolbar`. */
  'pickerIntent',
  /** The person and day the picker was opened for (`hubCellAddContext`). */
  'cellContext',
  /** The page's add-block window; the hook ends it through the page's callback. */
  'addBlock',
  /** `?placeJob=` in the URL. */
  'placeJobParam',
  /** The `?placeJob=` arm's memory of the job and week it last armed (`placeJobArmKeyRef`). */
  'armKey',
] as const
export type HubModeFlag = (typeof HUB_MODE_FLAGS)[number]

/** The five flags that are modes: at most one should be on (the gaps aside). */
export const HUB_MODES = ['placement', 'linkedCopy', 'assignPlacement', 'multiCell', 'picker'] as const satisfies readonly HubModeFlag[]
export type HubMode = (typeof HUB_MODES)[number]

export type HubModeCell = 'on' | 'end' | 'keep'

const O = 'on' as const
const E = 'end' as const
const _ = 'keep' as const

// prettier-ignore
const RULE = {
  //                   placement plusMenu linkedCopy assignPlacement multiCell picker pickerIntent cellContext addBlock placeJobParam armKey
  // Turning a mode on
  /** A block's + menu → Linked copy or Solo copy, or Move (`onStartCardPlacement`). */
  startPlacement:    [ O,        E,       E,         E,              E,        _,     _,           _,          E,       E,            _ ],
  /** The toolbar's Copy jobs linked, while it is off (`onStartLinkedCopyMode`). */
  startLinkedCopy:   [ E,        E,       O,         E,              E,        E,     _,           E,          _,       E,            _ ],
  /** The toolbar's Select multiple cells, while it is off (`onRequestHubMultiCellAddMode`). */
  startMultiCell:    [ E,        E,       E,         E,              O,        E,     E,           E,          _,       E,            _ ],
  /** The toolbar's + Add job (`onRequestHubAddJob`). */
  openToolbarPicker: [ E,        E,       E,         E,              E,        O,     O,           E,          _,       E,            _ ],
  /** A cell's + (`onHubEmptyCellOpenChoice`). Gap e: it ends nothing. */
  openCellPicker:    [ _,        _,       _,         _,              _,        O,     O,           O,          _,       _,            _ ],
  /** The multi-cell bar's Choose job (`onRequestHubMultiCellAddChooseJob`). */
  openMultiPicker:   [ _,        _,       _,         _,              _,        O,     O,           E,          _,       _,            _ ],
  /** A job picked in the toolbar picker: the placing strip. */
  pickJobToPlace:    [ E,        E,       _,         O,              _,        E,     E,           _,          _,       _,            _ ],
  /** New job from the picker, before the job form opens (`onCreateNewJobFromHubJobPicker`). */
  newJob:            [ E,        E,       _,         _,              _,        E,     _,           E,          _,       _,            _ ],
  /** That job saved with no cell to put it on: the placing strip. */
  newJobToPlace:     [ _,        _,       _,         O,              _,        _,     _,           _,          _,       _,            _ ],
  /** `?placeJob=` arms the placing strip and ends every other mode (gap a, fixed v2.4989: linked copy and the picker stayed on). */
  urlArm:            [ E,        E,       E,         O,              E,        E,     _,           _,          _,       _,            O ],
  /** A block's + button opens or shuts its menu. */
  togglePlusMenu:    [ _,        O,       _,         _,              _,        _,     _,           _,          _,       _,            _ ],
  // Leaving a mode
  /** Cancel on the moving or copying strip, or on the board (`onCancelCardPlacement`). */
  cancelPlacement:   [ E,        E,       _,         _,              _,        _,     _,           _,          _,       _,            _ ],
  /** The move or copy landed, or its block is gone (`onCardPlacementPickCell`). */
  placementDone:     [ E,        _,       _,         _,              _,        _,     _,           _,          _,       _,            _ ],
  /** Cancel or Done on the linked-copy strip, or the toolbar button again. */
  endLinkedCopy:     [ _,        _,       E,         _,              _,        _,     _,           _,          _,       _,            _ ],
  /** The toolbar's Select multiple cells again. */
  endMultiCell:      [ _,        _,       _,         _,              E,        _,     _,           _,          _,       _,            _ ],
  /** Cancel on the placing strip (`onCancelHubAssignJobPlacement`). */
  cancelAssign:      [ _,        _,       _,         E,              _,        _,     _,           _,          _,       E,            _ ],
  /** A cell picked for the placing job; the add-block window opens next (`onHubAssignJobCellPick`). */
  assignCellPick:    [ _,        _,       _,         E,              _,        _,     _,           _,          _,       _,            _ ],
  /** The picker shuts, or its not-coming-in and NCNS doors are used (`closeHubAssignJobPicker`). */
  closePicker:       [ _,        _,       _,         _,              E,        E,     E,           E,          _,       _,            _ ],
  /** The multi-cell add was written (`applyHubMultiCellJob`). */
  multiCellApplied:  [ _,        _,       _,         _,              E,        E,     E,           E,          _,       _,            _ ],
  /** Esc while moving, copying or placing. Gap f: it also ends the placing strip and the param. */
  escapePlacement:   [ E,        E,       _,         E,              _,        _,     _,           E,          _,       E,            _ ],
  /** Esc in linked copy. Gap f: only its own mode. */
  escapeLinkedCopy:  [ _,        _,       E,         _,              _,        _,     _,           _,          _,       _,            _ ],
  /** Esc in multi-cell. Gap f: only its own mode. */
  escapeMultiCell:   [ _,        _,       _,         _,              E,        _,     _,           _,          _,       _,            _ ],
  // The page around the modes
  /** The add-block window opens (`openAddBlock`), ending linked copy and the param too (gap b, fixed v2.4989). */
  openAddBlock:      [ E,        E,       E,         E,              E,        E,     E,           E,          O,       E,            _ ],
  /** The add-block window shuts (`closeAdd`). */
  closeAddBlock:     [ _,        _,       _,         _,              _,        _,     _,           _,          E,       E,            _ ],
  /** The Jobs or Day tab (`setHubTab`), ending linked copy and the picker too (gap c, fixed v2.4989). */
  tabAway:           [ E,        E,       E,         E,              E,        E,     _,           _,          _,       E,            _ ],
  /** The week arrows or This week (`shiftWeek`, `goThisWeek`); the new URL they write drops the param. Gap d: multi-cell waits for `weekChanged`. */
  weekNav:           [ E,        E,       E,         E,              _,        _,     _,           _,          _,       _,            E ],
  /** The week in the URL changed. */
  weekChanged:       [ _,        _,       _,         _,              E,        _,     _,           _,          _,       _,            _ ],
  /** No `?placeJob=`, or the tomorrow embed: the arm forgets its last job. */
  urlIdle:           [ _,        _,       _,         _,              _,        _,     _,           _,          _,       _,            E ],
  /** The vestigial job-week view (`jobId` set). */
  jobWeek:           [ _,        _,       _,         E,              _,        E,     _,           _,          _,       _,            E ],
} as const satisfies Record<string, readonly HubModeCell[]>

export type HubModeEntry = keyof typeof RULE
export const HUB_MODE_ENTRIES = Object.keys(RULE) as HubModeEntry[]

/** The entries the page itself raises (the writers outside the hook); the hook raises the rest. */
export type HubModePageEntry = Extract<HubModeEntry, 'openAddBlock' | 'closeAddBlock' | 'assignCellPick' | 'newJob' | 'tabAway' | 'weekNav'>

/** One row of the rule: what `entry` does to every flag. */
export function hubModeRow(entry: HubModeEntry): Readonly<Record<HubModeFlag, HubModeCell>> {
  const cells: readonly HubModeCell[] = RULE[entry]
  return Object.fromEntries(HUB_MODE_FLAGS.map((flag, i) => [flag, cells[i]!])) as Record<HubModeFlag, HubModeCell>
}

/** The flags `entry` ends. The hook's `leave` clears exactly these and nothing else. */
export function hubModeClears(entry: HubModeEntry): ReadonlySet<HubModeFlag> {
  const cells: readonly HubModeCell[] = RULE[entry]
  return new Set(HUB_MODE_FLAGS.filter((_flag, i) => cells[i] === 'end'))
}
