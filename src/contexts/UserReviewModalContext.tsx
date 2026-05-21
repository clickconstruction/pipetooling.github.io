import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type UserReviewModalOpenArgs = {
  userId: string
  displayName: string
  /** Company-calendar day (YYYY-MM-DD); defaults to today when omitted. */
  workDateYmd?: string
}

type UserReviewModalContextValue = {
  open: (args: UserReviewModalOpenArgs) => void
  close: () => void
  /** When non-null, the modal should render for this subject and day seed. */
  payload: UserReviewModalOpenArgs | null
}

const UserReviewModalContext = createContext<UserReviewModalContextValue | null>(null)

export function UserReviewModalProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<UserReviewModalOpenArgs | null>(null)

  const open = useCallback((args: UserReviewModalOpenArgs) => {
    setPayload({
      userId: args.userId.trim(),
      displayName: args.displayName.trim() || 'Unknown',
      workDateYmd: args.workDateYmd?.trim() || undefined,
    })
  }, [])

  const close = useCallback(() => {
    setPayload(null)
  }, [])

  const value = useMemo(
    (): UserReviewModalContextValue => ({
      open,
      close,
      payload,
    }),
    [open, close, payload],
  )

  return <UserReviewModalContext.Provider value={value}>{children}</UserReviewModalContext.Provider>
}

export function useUserReviewModal(): UserReviewModalContextValue | null {
  return useContext(UserReviewModalContext)
}
