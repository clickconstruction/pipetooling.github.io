import { createContext } from 'react'

/**
 * True inside a Quickfill round screen (punch list #30, PR 3): the section wrapper renders
 * its body only — the screen owns the title, the count and the mark.
 */
export const QuickfillRoundScreenContext = createContext<boolean>(false)
