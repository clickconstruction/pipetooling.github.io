import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type UserDayScheduleModalOpenArgs = {
  userId: string
  displayName: string
  /** Company-calendar day (YYYY-MM-DD); defaults to today when omitted. */
  workDateYmd?: string
}

type UserDayScheduleModalContextValue = {
  open: (args: UserDayScheduleModalOpenArgs) => void
  close: () => void
  /** When non-null, the modal should render for this subject and day seed. */
  payload: UserDayScheduleModalOpenArgs | null
}

const UserDayScheduleModalContext = createContext<UserDayScheduleModalContextValue | null>(null)

export function UserDayScheduleModalProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<UserDayScheduleModalOpenArgs | null>(null)

  const open = useCallback((args: UserDayScheduleModalOpenArgs) => {
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
    (): UserDayScheduleModalContextValue => ({
      open,
      close,
      payload,
    }),
    [open, close, payload],
  )

  return <UserDayScheduleModalContext.Provider value={value}>{children}</UserDayScheduleModalContext.Provider>
}

export function useUserDayScheduleModal(): UserDayScheduleModalContextValue | null {
  return useContext(UserDayScheduleModalContext)
}
