import { createContext, useContext } from 'react'
import type { Contact } from '../../../lib/contacts/kernel'
import type { JobTile } from '../../../lib/messages/jobTiles'
import type { ThreadMessage } from '../../../lib/messages/thread'

/**
 * Messages, cut 3's screens: the open thread, as the thread window already reads it, for a slot's component that needs
 * more than the person (the reply box: our last text to the number for the opt-out line, the job in view for *Tie to*,
 * the rail and the tiles for its choices). The window gives it around everything it draws, so a component a slot
 * returns reads it; `useThreadSlots` itself runs above the window's provider and gets null. Null outside a window and in
 * a smoke with no provider.
 */
export interface OpenThread {
  contact: Contact
  /** The person's lines on every job, oldest first, the sent copies' overlay included. */
  lines: readonly ThreadMessage[]
  /** The job the thread shows, or null for all of them. */
  jobFilter: string | null
  /** The person's rail: the office's ties, then the jobs the facts give. */
  rail: readonly string[]
  /** Every job on a rail or a line, by key. */
  tiles: Readonly<Record<string, JobTile>>
  userNames: Readonly<Record<string, string>>
  /** The window's clock, so a slot reads the same day the lines do. */
  nowIso: string
  /** The jobs a name or a number may be, for a job that is not on the rail yet. */
  searchJobs: (words: string) => Promise<JobTile[]>
  /** The window is short (v2.6474, `isThreadShort`). Unset reads tall. */
  short?: boolean
  /** The thread is wide enough for the sort card to sit whole beside the lines (v2.6478, `isThreadBeside`). */
  beside?: boolean
  /** The sort card folds to one row: it sits over the lines (v2.6482, `threadFolds`). Unset: whole, as outside a window. */
  foldCard?: boolean
  /** The reply box folds to one row: a short window or a phone (v2.6482, `threadFolds`). Unset: whole. */
  foldBox?: boolean
}

export const OpenThreadContext = createContext<OpenThread | null>(null)

export function useOpenThread(): OpenThread | null {
  return useContext(OpenThreadContext)
}
