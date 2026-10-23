import { createContext } from 'react'
import type { FocusBucket } from '../../lib/quickfill/views'

/**
 * Focus (punch list #147, v2.5778): the page hands the wrapper where each station sits.
 * Null when the view is the whole page, so every wrapper draws as before.
 */
export const QuickfillFocusContext = createContext<((sectionId: string) => FocusBucket) | null>(null)
