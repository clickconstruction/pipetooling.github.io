import { createContext, useContext } from 'react'

/**
 * Whether the app's top bar is naming the page in words right now. It does under the new phone layout's
 * one-row bar (`lib/phoneLayout/phoneBar.ts`), and only there: the role dock's row keeps its icons and names
 * no page, and so does every bar with the switch off.
 *
 * Layout is the one place that knows which bar it drew, so it hands the answer down. A page reads it to
 * leave its own title undrawn while the bar says the same word (`lib/phoneLayout/phoneTabRows.ts`). A page
 * drawn outside Layout reads false and keeps its title.
 */
export const PhoneBarPageNameContext = createContext(false)

/** True while the top bar names the page, so the page's own title would say it twice. */
export function usePhoneBarNamesPage(): boolean {
  return useContext(PhoneBarPageNameContext)
}
