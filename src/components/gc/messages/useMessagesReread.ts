import { createContext, useContext } from 'react'

/**
 * Messages, cut 1's screens: read the Messages view again. The page's own presses re-read through `MessagesWrites`; a
 * later cut's slot that writes on its own (cut 3's send, cut 2's note, the opt-out hold) calls this after its write, and
 * the page reads the view again, so the thread shows the new lines. Fire and forget. With no provider, outside the page
 * and in a smoke, it does nothing.
 */
export const MessagesRereadContext = createContext<() => void>(() => {})

export function useMessagesReread(): () => void {
  return useContext(MessagesRereadContext)
}
