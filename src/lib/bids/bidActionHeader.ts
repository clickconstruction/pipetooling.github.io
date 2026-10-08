/**
 * The bid history request tag (punch list #73, PR 1b). Each REST call is its own transaction and
 * a bulk path writes one request per batch, so the ledger (`bid_changes`, the record_bid_change()
 * trigger) could not tell an import of 23 rows from 23 edits, or the Labor tab's load sync from
 * the person who happened to open the tab. A bulk or app-own path sends `x-bid-action: <name>`
 * on each of its calls; PostgREST hands the headers to the database and the trigger stores the
 * tag (`bid_changes.action`) and whether it is one of the app's own actions (`by_app`). The
 * reader (PR 2) groups and captions by it. A write with no tag records null, as before.
 *
 * `BID_APP_ACTIONS` mirrors `bid_changes_app_actions()` in the migration;
 * `bidChangesCapture.test.ts` fails CI when the two lists disagree.
 */

export const BID_ACTION_HEADER = 'x-bid-action'

export const BID_ACTIONS = {
  /** The Counts tab's import (paste or /Tooling): every batch of rows it inserts. */
  countsImport: 'counts-import',
  /** The Counts tab's Clear all counts. */
  countsClearAll: 'counts-clear-all',
  /** The Labor tab's load sync: rows minted from the book, counts refreshed. The app's own. */
  laborSync: 'labor-sync',
  /** The load sync renames a row whose fixture changed only in case, spacing or a group prefix (PR 0b). The app's own. */
  laborRename: 'labor-rename',
  /** The load sync moves a row no counted fixture claims to the unmatched table (PR 0b). The app's own. */
  laborPark: 'labor-park',
  /** The load sync takes a parked row back when its fixture is counted again (PR 0b). The app's own. */
  laborTakeBack: 'labor-take-back',
  /** The Labor tab's band: Use for <fixture> puts a parked row's hours on a counted row (PR 0b). */
  laborUseParked: 'labor-use-parked',
  /** The Pricing tab's "fill from the book": assignments minted for every matched row in one press. */
  bookFill: 'book-fill',
  /** twin-mcp's paste_counts: a robot's rows and their book assignments. */
  robotPaste: 'robot-paste',
  /** History's Put back (PR 4): set by `put_back_bid_change` itself on its one write, never sent by the client. */
  putBack: 'put-back',
} as const

export type BidAction = (typeof BID_ACTIONS)[keyof typeof BID_ACTIONS]

/** The actions that are the app's own doing, not a person's press. Mirrors `bid_changes_app_actions()`. */
export const BID_APP_ACTIONS: ReadonlyArray<BidAction> = [BID_ACTIONS.laborSync, BID_ACTIONS.laborRename, BID_ACTIONS.laborPark, BID_ACTIONS.laborTakeBack]

/** A tag is a plain slug, as the trigger accepts it; anything else is dropped there. */
export const BID_ACTION_SHAPE = /^[a-z][a-z0-9-]{1,40}$/

/**
 * Tag one query with the action: `withBidAction(supabase.from('bids_count_rows').insert(rows), BID_ACTIONS.countsImport)`.
 * A builder with no header method (a test's hand-made stub) is returned as it is: the tag is a
 * reading aid for the history, never a condition of the write.
 */
export function withBidAction<T extends { setHeader?(name: string, value: string): T }>(query: T, action: BidAction): T {
  return typeof query.setHeader === 'function' ? query.setHeader(BID_ACTION_HEADER, action) : query
}

/** The header as a client option, for a client whose every call is one action (twin-mcp's paste_counts). */
export function bidActionHeaders(action: BidAction): Record<string, string> {
  return { [BID_ACTION_HEADER]: action }
}
