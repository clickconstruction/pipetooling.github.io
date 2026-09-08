import { useState } from 'react'

import { SupplyHouseDirectory } from './SupplyHouseDirectory'
import { useSupplyHouseEditor } from './useSupplyHouseEditor'
import type { Database } from '../../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

/**
 * The estimator's Supply houses tab (to-dos/supply-house-directory, PR 2):
 * the Directory pane alone — no accounts payable, no invoices, no balances.
 * Same component and same editor the office uses; the only difference is
 * what surrounds them.
 */
export function MaterialsSupplyHouseDirectoryTab({
  supplyHouses,
  onSupplyHousesChange,
  myRole,
  selectedServiceTypeId,
}: {
  supplyHouses: SupplyHouse[]
  onSupplyHousesChange: () => Promise<void> | void
  myRole: UserRole | null
  selectedServiceTypeId?: string | null
}) {
  const [reloadKey, setReloadKey] = useState(0)
  const editor = useSupplyHouseEditor({
    myRole,
    onSaved: async () => {
      await onSupplyHousesChange()
      setReloadKey((k) => k + 1)
    },
  })

  return (
    <div>
      {editor.error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{editor.error}</p>}
      <SupplyHouseDirectory
        supplyHouses={supplyHouses}
        audience="estimator"
        onAddHouse={editor.openAdd}
        onEditHouse={editor.openEdit}
        reloadKey={reloadKey}
        selectedServiceTypeId={selectedServiceTypeId ?? null}
      />
      {editor.modal}
    </div>
  )
}
