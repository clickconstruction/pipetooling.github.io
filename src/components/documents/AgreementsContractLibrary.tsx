import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { canDeleteFromContractLibrary, canUseContractFormStudio } from '../../lib/contracts/contractLibraryRoles'
import { readContractsLibrary, type ContractsLibrary } from '../../lib/contracts/contractsLibraryIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Documents → Agreements, the **Contract library** door (punch list #376, the second train): the window People →
 * Contracts opens, opened in place. It is the same component with the same role rules: the owner and a dev delete, the
 * controller and a dev see the Forms tab, and the database's own policies decide every write. The library is read when
 * the door opens and again after each save, so the window shows what it just changed. **Send to…** on a paper hands
 * the paper's name to the tab's Send a paper, at the person step.
 */

const ContractLibraryModal = lazy(() => import('../contracts/ContractLibraryModal').then((m) => ({ default: m.ContractLibraryModal })))

export function AgreementsContractLibrary({
  open,
  onClose,
  onQuickSend,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  /** A paper's Send to… was pressed: the tab picks the person and sends. */
  onQuickSend: (documentName: string) => void
  /** The library saved something: the tab may read again. */
  onChanged?: () => void
}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [library, setLibrary] = useState<ContractsLibrary | null>(null)

  const read = useCallback(async () => {
    try {
      setLibrary(await readContractsLibrary())
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'The Contract library did not read.'), 'error')
      return false
    }
  }, [showToast])

  // Read on the way in. A read that fails says why and closes the door, so no empty library is ever drawn.
  useEffect(() => {
    if (!open) {
      setLibrary(null)
      return
    }
    let live = true
    void read().then((ok) => {
      if (live && !ok) onClose()
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [open])

  if (!open || !library) return null
  return (
    <Suspense fallback={null}>
      <ContractLibraryModal
        open
        onClose={onClose}
        templates={library.templates}
        templateDocuments={library.templateDocuments}
        assignments={library.assignments}
        personDocuments={library.personDocuments}
        canDeletePeopleContracts={canDeleteFromContractLibrary(role)}
        canUseFormStudio={canUseContractFormStudio(role)}
        onSaved={() => {
          void read()
          onChanged?.()
        }}
        onQuickSend={onQuickSend}
      />
    </Suspense>
  )
}

export default AgreementsContractLibrary
