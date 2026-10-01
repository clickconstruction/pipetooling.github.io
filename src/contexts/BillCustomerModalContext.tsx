import { createContext, useCallback, useContext, lazy, Suspense, useMemo, useRef, useState } from 'react'
import type { SendRecordInvoicePayload } from '../components/jobs/SendRecordInvoiceModal.types'

/** Code-split: modal pulls physical PDF + jspdf; only load when Bill Customer is used. */
const SendRecordInvoiceModal = lazy(() => import('../components/jobs/SendRecordInvoiceModal'))

/** The waiver that follows a bill (v2.4275) — loaded with the modal, never on first paint. */
const BillCustomerWaiverFollowUp = lazy(() => import('../components/jobs/BillCustomerWaiverFollowUp'))

/** Above JobFormModal overlay (1010). */
const BILL_CUSTOMER_OVERLAY_Z_INDEX = 1020

export type OpenBillCustomerOptions = {
  payload: SendRecordInvoicePayload
  onSuccess?: () => void | Promise<void>
  onAfterEnsureSuccess?: () => void | Promise<void>
  onAfterOobUnwindSuccess?: () => void | Promise<void>
  /** Discount tools (v2.3268): the modal added a discount row to the job — an open Edit Job form re-reads its line items. */
  onDiscountApplied?: () => void | Promise<void>
}

type BillCustomerModalContextValue = {
  openBillCustomer: (opts: OpenBillCustomerOptions) => void
  closeBillCustomer: () => void
}

const BillCustomerModalContext = createContext<BillCustomerModalContextValue | null>(null)

export function BillCustomerModalProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SendRecordInvoicePayload | null>(null)
  // v2.4275: the bill went; the office ticked "send the lien waiver with it" — the Release of Lien
  // window opens on that bill after Bill Customer closes, owned here so the close does not unmount it.
  const [waiverFollowUp, setWaiverFollowUp] = useState<{ jobId: string; invoiceId: string } | null>(null)

  const callbacksRef = useRef<{
    onSuccess: (() => void | Promise<void>) | null
    onAfterEnsureSuccess: (() => void | Promise<void>) | null
    onAfterOobUnwindSuccess: (() => void | Promise<void>) | null
    onDiscountApplied: (() => void | Promise<void>) | null
  }>({ onSuccess: null, onAfterEnsureSuccess: null, onAfterOobUnwindSuccess: null, onDiscountApplied: null })

  const openBillCustomer = useCallback((opts: OpenBillCustomerOptions) => {
    callbacksRef.current = {
      onSuccess: opts.onSuccess ?? null,
      onAfterEnsureSuccess: opts.onAfterEnsureSuccess ?? null,
      onAfterOobUnwindSuccess: opts.onAfterOobUnwindSuccess ?? null,
      onDiscountApplied: opts.onDiscountApplied ?? null,
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
      <Suspense fallback={null}>
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
          onDiscountApplied={async () => {
            await callbacksRef.current.onDiscountApplied?.()
          }}
          onSentWantWaiver={(jobId, invoiceId) => setWaiverFollowUp({ jobId, invoiceId })}
          jobUpdating={false}
          invoiceUpdating={false}
          overlayZIndex={BILL_CUSTOMER_OVERLAY_Z_INDEX}
        />
        {waiverFollowUp ? <BillCustomerWaiverFollowUp jobId={waiverFollowUp.jobId} invoiceId={waiverFollowUp.invoiceId} onClose={() => setWaiverFollowUp(null)} /> : null}
      </Suspense>
    </BillCustomerModalContext.Provider>
  )
}

export function useBillCustomerModal(): BillCustomerModalContextValue | null {
  return useContext(BillCustomerModalContext)
}
