/**
 * The queues' fold on a phone (v2.5708, punch list #139 PR 16, the sixth addition's second half): three empty lists
 * on a phone pushed Went out and the search a screen down. When nothing waits, the lists fold to one line that opens
 * on a press; any count unfolds them. Words only; the page draws it.
 */
export const QUEUES_FOLD_WORDS = {
  /** The one line: the three lists at zero. Its dots are the lists' own shape, not prose. */
  line: 'New 0 · Needs a reply 0 · We owe them 0',
  tail: 'Nothing waiting.',
  open: 'Show the lists',
}

/**
 * Whether the lists fold: a phone, nothing waiting, and nobody has opened them. A kept read (#183 PR 5) never folds,
 * whatever its count: the stamp over the lanes must show, and *Nothing waiting.* is a claim a kept read cannot make.
 */
export function queuesFolded(args: { phone: boolean; count: number | null; open: boolean; kept: boolean }): boolean {
  return args.phone && args.count === 0 && !args.open && !args.kept
}
