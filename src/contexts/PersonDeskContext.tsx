import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Person Desk opener (v2.2701). Any component can open the per-person drawer
 * with one call — the User Review modal precedent. Pass whichever id you have;
 * the Desk resolves the rest (usePersonDesk).
 */
export type PersonDeskOpenArgs = {
  userId?: string | null
  personId?: string | null
  /** Shown in the header until the key resolves. */
  displayName?: string | null
}

type PersonDeskContextValue = {
  open: (args: PersonDeskOpenArgs) => void
  close: () => void
  payload: PersonDeskOpenArgs | null
  /** Bumped by sections after a write so siblings and the header refetch. */
  changeKey: number
  markChanged: () => void
}

const PersonDeskContext = createContext<PersonDeskContextValue | null>(null)

export function PersonDeskProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<PersonDeskOpenArgs | null>(null)
  const [changeKey, setChangeKey] = useState(0)

  const open = useCallback((args: PersonDeskOpenArgs) => {
    const userId = args.userId?.trim() || null
    const personId = args.personId?.trim() || null
    if (!userId && !personId) return
    setPayload({ userId, personId, displayName: args.displayName?.trim() || null })
  }, [])

  const close = useCallback(() => setPayload(null), [])
  const markChanged = useCallback(() => setChangeKey((k) => k + 1), [])

  const value = useMemo(() => ({ open, close, payload, changeKey, markChanged }), [open, close, payload, changeKey, markChanged])
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
