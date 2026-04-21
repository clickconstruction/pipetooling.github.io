import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import SendRecordInvoiceModal, { type SendRecordInvoicePayload } from '../components/jobs/SendRecordInvoiceModal'

/** Above JobFormModal overlay (1010). */
const BILL_CUSTOMER_OVERLAY_Z_INDEX = 1020

export type OpenBillCustomerOptions = {
  payload: SendRecordInvoicePayload
  onSuccess?: () => void | Promise<void>
  onAfterEnsureSuccess?: () => void | Promise<void>
  onAfterOobUnwindSuccess?: () => void | Promise<void>
}

type BillCustomerModalContextValue = {
  openBillCustomer: (opts: OpenBillCustomerOptions) => void
  closeBillCustomer: () => void
}

const BillCustomerModalContext = createContext<BillCustomerModalContextValue | null>(null)

export function BillCustomerModalProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SendRecordInvoicePayload | null>(null)

  const callbacksRef = useRef<{
    onSuccess: (() => void | Promise<void>) | null
    onAfterEnsureSuccess: (() => void | Promise<void>) | null
    onAfterOobUnwindSuccess: (() => void | Promise<void>) | null
  }>({ onSuccess: null, onAfterEnsureSuccess: null, onAfterOobUnwindSuccess: null })

  const openBillCustomer = useCallback((opts: OpenBillCustomerOptions) => {
    callbacksRef.current = {
      onSuccess: opts.onSuccess ?? null,
      onAfterEnsureSuccess: opts.onAfterEnsureSuccess ?? null,
      onAfterOobUnwindSuccess: opts.onAfterOobUnwindSuccess ?? null,
    }
    setSession(opts.payload)
  }, [])

  const closeBillCustomer = useCallback(() => {
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ openBillCustomer, closeBillCustomer }),
    [openBillCustomer, closeBillCustomer],
  )

  return (
    <BillCustomerModalContext.Provider value={value}>
      {children}
      <SendRecordInvoiceModal
        payload={session}
        onClose={closeBillCustomer}
        onSuccess={async () => {
          await callbacksRef.current.onSuccess?.()
        }}
        onAfterEnsureSuccess={async () => {
          await callbacksRef.current.onAfterEnsureSuccess?.()
        }}
        onAfterOobUnwindSuccess={async () => {
          await callbacksRef.current.onAfterOobUnwindSuccess?.()
        }}
        jobUpdating={false}
        invoiceUpdating={false}
        overlayZIndex={BILL_CUSTOMER_OVERLAY_Z_INDEX}
      />
    </BillCustomerModalContext.Provider>
  )
}

export function useBillCustomerModal(): BillCustomerModalContextValue | null {
  return useContext(BillCustomerModalContext)
}
