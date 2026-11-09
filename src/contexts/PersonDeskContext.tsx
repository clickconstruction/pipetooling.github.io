import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { canOpenPersonDesk } from '../lib/people/personDeskGates'
import type { PersonDeskSectionId } from '../lib/people/personDeskSections'

/**
 * Person Desk opener (v2.2701). Any component can open the per-person drawer
 * with one call — the User Review modal precedent. Pass whichever id you have;
 * the Desk resolves the rest (usePersonDesk).
 */
export type PersonDeskOpenArgs = {
  userId?: string | null
  personId?: string | null
  /** Name-keyed surfaces (Hours grid, Contracts) open by pay name; the Desk resolves the account or roster row (PR 4). */
  payName?: string | null
  /** Shown in the header until the key resolves. */
  displayName?: string | null
  /** v2.2810: scroll the Desk to this section once it renders. */
  section?: PersonDeskSectionId | null
  /**
   * Bring back (v2.6523): Users → Archived opens the desk with the Bring back window already up. Attach a login
   * (v2.6789): the Hire form's and the roster form's end open the desk on Access & account with the Attach form open.
   */
  flow?: 'bring_back' | 'attach_login' | null
}

type PersonDeskContextValue = {
  open: (args: PersonDeskOpenArgs) => void
  close: () => void
  payload: PersonDeskOpenArgs | null
  /** Bumped by sections after a write so siblings and the header refetch. */
  changeKey: number
  markChanged: () => void
  /** Whether the signed-in viewer may open the Desk at all (office roles) — doors read this instead of useAuth. */
  canOpen: boolean
  /**
   * The desk closed last in this session (v2.6789): a first-timer who closed the drawer had no idea how to get back,
   * so People → Users offers "Back to <name>'s desk" while the desk is shut. Null until one has been closed.
   */
  lastClosed: PersonDeskOpenArgs | null
}

const PersonDeskContext = createContext<PersonDeskContextValue | null>(null)

export function PersonDeskProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<PersonDeskOpenArgs | null>(null)
  const [lastClosed, setLastClosed] = useState<PersonDeskOpenArgs | null>(null)
  const payloadRef = useRef<PersonDeskOpenArgs | null>(null)
  payloadRef.current = payload
  const [changeKey, setChangeKey] = useState(0)
  const { role } = useAuth()
  const canOpen = canOpenPersonDesk(role)

  const open = useCallback((args: PersonDeskOpenArgs) => {
    const userId = args.userId?.trim() || null
    const personId = args.personId?.trim() || null
    const payName = args.payName?.trim() || null
    if (!userId && !personId && !payName) return
    setPayload({ userId, personId, payName, displayName: args.displayName?.trim() || payName, section: args.section ?? null, flow: args.flow ?? null })
  }, [])

  const close = useCallback(() => {
    const was = payloadRef.current
    // The way back opens the same person, with no section ring and no window already up.
    if (was) setLastClosed({ ...was, section: null, flow: null })
    setPayload(null)
  }, [])
  const markChanged = useCallback(() => setChangeKey((k) => k + 1), [])

  const value = useMemo(() => ({ open, close, payload, changeKey, markChanged, canOpen, lastClosed }), [open, close, payload, changeKey, markChanged, canOpen, lastClosed])
  return <PersonDeskContext.Provider value={value}>{children}</PersonDeskContext.Provider>
}

export function usePersonDeskContext(): PersonDeskContextValue {
  const v = useContext(PersonDeskContext)
  if (!v) throw new Error('usePersonDeskContext must be used within PersonDeskProvider')
  return v
}

/** Null outside the provider (render smokes, storybook-style mounts). */
export function useOptionalPersonDesk(): PersonDeskContextValue | null {
  return useContext(PersonDeskContext)
}
