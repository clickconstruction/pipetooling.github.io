import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

type UpdateFocusOpenerBridgeContextValue = {
  registerUpdateFocusOpener: (opener: (() => void) | null) => void
  requestOpenUpdateFocus: () => void
}

const UpdateFocusOpenerBridgeContext =
  createContext<UpdateFocusOpenerBridgeContextValue | null>(null)

export function UpdateFocusOpenerBridgeProvider({ children }: { children: ReactNode }) {
  const openerRef = useRef<(() => void) | null>(null)

  const registerUpdateFocusOpener = useCallback((opener: (() => void) | null) => {
    openerRef.current = opener
  }, [])

  const requestOpenUpdateFocus = useCallback(() => {
    openerRef.current?.()
  }, [])

  const value = useMemo(
    (): UpdateFocusOpenerBridgeContextValue => ({
      registerUpdateFocusOpener,
      requestOpenUpdateFocus,
    }),
    [registerUpdateFocusOpener, requestOpenUpdateFocus],
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
