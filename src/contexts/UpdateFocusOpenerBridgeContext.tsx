import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

export type UpdateFocusApplyDirectOpts = {
  jobLedgerId: string | null
  bidId: string | null
  notes: string
}

export type UpdateFocusApplyDirectResult = {
  ok: boolean
  error: string | null
}

export type UpdateFocusApplyDirectFn = (
  opts: UpdateFocusApplyDirectOpts,
) => Promise<UpdateFocusApplyDirectResult>

type UpdateFocusOpenerBridgeContextValue = {
  registerUpdateFocusOpener: (opener: (() => void) | null) => void
  requestOpenUpdateFocus: () => void
  registerUpdateFocusApplyDirect: (apply: UpdateFocusApplyDirectFn | null) => void
  applyUpdateFocusDirect: UpdateFocusApplyDirectFn
  /** ClockInOutButton registers its guarded clock-out entry (tally gate + review modal) here so Job Mode can offer Clock Out (v2.2558). */
  registerClockOutOpener: (opener: (() => void) | null) => void
  /** Returns false when no clock-out opener is mounted (e.g. salaried users). */
  requestClockOut: () => boolean
}

const UpdateFocusOpenerBridgeContext =
  createContext<UpdateFocusOpenerBridgeContextValue | null>(null)

export function UpdateFocusOpenerBridgeProvider({ children }: { children: ReactNode }) {
  const openerRef = useRef<(() => void) | null>(null)
  const applyDirectRef = useRef<UpdateFocusApplyDirectFn | null>(null)
  const clockOutOpenerRef = useRef<(() => void) | null>(null)

  const registerUpdateFocusOpener = useCallback((opener: (() => void) | null) => {
    openerRef.current = opener
  }, [])

  const requestOpenUpdateFocus = useCallback(() => {
    openerRef.current?.()
  }, [])

  const registerUpdateFocusApplyDirect = useCallback(
    (apply: UpdateFocusApplyDirectFn | null) => {
      applyDirectRef.current = apply
    },
    [],
  )

  const applyUpdateFocusDirect = useCallback<UpdateFocusApplyDirectFn>(async (opts) => {
    const fn = applyDirectRef.current
    if (!fn) {
      return { ok: false, error: 'Update focus is not available right now.' }
    }
    return fn(opts)
  }, [])

  const registerClockOutOpener = useCallback((opener: (() => void) | null) => {
    clockOutOpenerRef.current = opener
  }, [])

  const requestClockOut = useCallback(() => {
    const fn = clockOutOpenerRef.current
    if (!fn) return false
    fn()
    return true
  }, [])

  const value = useMemo(
    (): UpdateFocusOpenerBridgeContextValue => ({
      registerUpdateFocusOpener,
      requestOpenUpdateFocus,
      registerUpdateFocusApplyDirect,
      applyUpdateFocusDirect,
      registerClockOutOpener,
      requestClockOut,
    }),
    [
      registerUpdateFocusOpener,
      requestOpenUpdateFocus,
      registerUpdateFocusApplyDirect,
      applyUpdateFocusDirect,
      registerClockOutOpener,
      requestClockOut,
    ],
  )

  return (
    <UpdateFocusOpenerBridgeContext.Provider value={value}>
      {children}
    </UpdateFocusOpenerBridgeContext.Provider>
  )
}

export function useUpdateFocusOpenerBridge(): UpdateFocusOpenerBridgeContextValue {
  const ctx = useContext(UpdateFocusOpenerBridgeContext)
  if (!ctx) {
    throw new Error(
      'useUpdateFocusOpenerBridge must be used within UpdateFocusOpenerBridgeProvider',
    )
  }
  return ctx
}
