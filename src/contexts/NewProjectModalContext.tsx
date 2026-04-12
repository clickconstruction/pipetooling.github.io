import { createContext, useCallback, useContext, useState } from 'react'

export type NewProjectPrefill = {
  customerId?: string
  name?: string
  address?: string
  plansLink?: string
  hcp?: string
  linkJobId?: string
  /** Skip copying customer address when selecting customer (job + Add Project flow). */
  fromJobModal?: boolean
  /** When true, treat address as explicitly set from prefill (matches `searchParams.has('address')`). */
  addressExplicit?: boolean
}

/** Build prefill from `/projects/new?...` query string (deep link / legacy URLs). */
export function prefillFromProjectNewSearchParams(searchParams: URLSearchParams): NewProjectPrefill | undefined {
  const customer = searchParams.get('customer')?.trim() || undefined
  const name = searchParams.get('name')
  const addressExplicit = searchParams.has('address')
  const address = addressExplicit ? (searchParams.get('address') ?? '') : undefined
  const plansLink = searchParams.get('plans')?.trim() || undefined
  const hcp = searchParams.get('hcp')?.trim() || undefined
  const job = searchParams.get('job')?.trim() || undefined

  if (!customer && name == null && !addressExplicit && !plansLink && !hcp && !job) {
    return undefined
  }

  return {
    ...(customer ? { customerId: customer } : {}),
    ...(name != null ? { name } : {}),
    ...(addressExplicit ? { address, addressExplicit: true } : {}),
    ...(plansLink ? { plansLink } : {}),
    ...(hcp ? { hcp } : {}),
    ...(job ? { linkJobId: job, fromJobModal: true } : {}),
  }
}

type NewProjectModalOptions = {
  prefill?: NewProjectPrefill
  onCreated?: (projectId: string) => void
}

type NewProjectModalContextValue = {
  openNewProjectModal: (options?: NewProjectModalOptions) => void
  closeModal: () => void
  isOpen: boolean
  prefill: NewProjectPrefill | undefined
  onCreated: ((projectId: string) => void) | null
  formKey: number
}

const NewProjectModalContext = createContext<NewProjectModalContextValue | null>(null)

let newProjectModalInstanceSeed = 0

export function NewProjectModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [prefill, setPrefill] = useState<NewProjectPrefill | undefined>(undefined)
  const [onCreated, setOnCreated] = useState<((projectId: string) => void) | null>(null)
  const [formKey, setFormKey] = useState(0)

  const openNewProjectModal = useCallback((options?: NewProjectModalOptions) => {
    newProjectModalInstanceSeed += 1
    setFormKey(newProjectModalInstanceSeed)
    setPrefill(options?.prefill)
    setOnCreated(() => options?.onCreated ?? null)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setPrefill(undefined)
    setOnCreated(null)
  }, [])

  return (
    <NewProjectModalContext.Provider
      value={{ openNewProjectModal, closeModal, isOpen, prefill, onCreated, formKey }}
    >
      {children}
    </NewProjectModalContext.Provider>
  )
}

export function useNewProjectModal(): NewProjectModalContextValue | null {
  return useContext(NewProjectModalContext)
}
