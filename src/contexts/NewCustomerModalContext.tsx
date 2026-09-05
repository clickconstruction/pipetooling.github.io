import { createContext, useContext, useState, useCallback } from 'react'
import type { Database } from '../types/database'
import type { NewCustomerInitialValues, NewCustomerCreatedMeta } from '../components/NewCustomerForm'
import type { ConvertibleProspect, ProspectConversionLane } from '../lib/prospects/prospectConversion'

type CustomerRow = Database['public']['Tables']['customers']['Row']

type NewCustomerModalOptions = {
  onCreated?: (customer: CustomerRow, meta?: NewCustomerCreatedMeta) => void
  /** Prefill (Follow Up's "Converted ✓" passes the prospect's fields). */
  initialValues?: NewCustomerInitialValues
  /** Pre-linked prospect: Save marks it converted with the new customer id. */
  sourceProspect?: ConvertibleProspect | null
  /** Telemetry lane for `prospect_converted{lane}`; defaults to `add-customer`. */
  conversionLane?: ProspectConversionLane
}

type NewCustomerModalContextValue = {
  openNewCustomerModal: (options?: NewCustomerModalOptions) => void
  closeModal: () => void
  isOpen: boolean
  onCreated: ((customer: CustomerRow, meta?: NewCustomerCreatedMeta) => void) | null
  initialValues: NewCustomerInitialValues | undefined
  sourceProspect: ConvertibleProspect | null
  conversionLane: ProspectConversionLane
}

const NewCustomerModalContext = createContext<NewCustomerModalContextValue | null>(null)

export function NewCustomerModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<NewCustomerModalOptions>({})

  const openNewCustomerModal = useCallback((next?: NewCustomerModalOptions) => {
    setOptions(next ?? {})
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setOptions({})
  }, [])

  return (
    <NewCustomerModalContext.Provider
      value={{
        openNewCustomerModal,
        closeModal,
        isOpen,
        onCreated: options.onCreated ?? null,
        initialValues: options.initialValues,
        sourceProspect: options.sourceProspect ?? null,
        conversionLane: options.conversionLane ?? 'add-customer',
      }}
    >
      {children}
    </NewCustomerModalContext.Provider>
  )
}

export function useNewCustomerModal(): NewCustomerModalContextValue | null {
  return useContext(NewCustomerModalContext)
}
