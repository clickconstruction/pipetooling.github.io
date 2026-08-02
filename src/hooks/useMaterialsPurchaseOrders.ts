import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { loadPOItemsWithDetails, type PurchaseOrderWithItems } from '../lib/materials/poItemDetails'

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']

/**
 * The Materials page's shared purchase-order engine — the seam hook prescribed
 * by docs/MATERIALS_TABS_ARCHITECTURE.md. Owns the PO caches (`allPOs`,
 * `draftPOs`), the two shared selections (`selectedPO` view card, `editingPO`
 * draft being edited), the notes-author name map, `loadPurchaseOrders`, and
 * the reload-on-`editingPO.id`-change effect.
 *
 * Consumed by the Purchase Orders tab, the PO Builder (`assemblies-po`) tab,
 * the `?po=`/`openPOId` deep-link router, and `handleNavigateToPOFromSupplyHouses`
 * (the latter two stay in the parent). The parent destructures the returned
 * object so downstream references keep their pre-extraction names.
 */
export function useMaterialsPurchaseOrders({
  selectedServiceTypeId,
  onError,
}: {
  selectedServiceTypeId: string
  onError: (message: string) => void
}) {
  const [allPOs, setAllPOs] = useState<PurchaseOrderWithItems[]>([])
  const [draftPOs, setDraftPOs] = useState<PurchaseOrderWithItems[]>([])
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithItems | null>(null)
  const [editingPO, setEditingPO] = useState<PurchaseOrderWithItems | null>(null)
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({})

  async function loadPurchaseOrders() {
    if (!selectedServiceTypeId) {
      // No service type selected yet, skip loading
      return
    }

    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('service_type_id', selectedServiceTypeId)
      .order('created_at', { ascending: false })

    if (poError) {
      onError(`Failed to load purchase orders: ${poError.message}`)
      return
    }

    const pos = (poData as PurchaseOrder[]) ?? []

    // Load items for each PO
    const posWithItems: PurchaseOrderWithItems[] = await Promise.all(
      pos.map(async (po) => {
        const itemsWithDetails = await loadPOItemsWithDetails(supabase, po.id)
        return { ...po, items: itemsWithDetails ?? [] }
      })
    )

    setAllPOs(posWithItems)
    setDraftPOs(posWithItems.filter(po => po.status === 'draft'))

    // Load user names for notes_added_by
    const userIds = [...new Set(posWithItems.map(po => po.notes_added_by).filter(Boolean) as string[])]
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)

      if (usersData) {
        const namesMap: Record<string, string> = {}
        usersData.forEach(user => {
          const name = (user as { name: string | null; email: string | null }).name || (user as { email: string | null }).email || 'Unknown'
          namesMap[user.id] = name
        })
        setUserNamesMap(namesMap)
      }
    }
  }

  useEffect(() => {
    if (editingPO?.id) {
      // Reload PO to get latest items
      const loadPODetails = async () => {
        const { data: poData } = await supabase
          .from('purchase_orders')
          .select('*')
          .eq('id', editingPO.id)
          .single()

        if (poData) {
          const itemsWithDetails = await loadPOItemsWithDetails(supabase, editingPO.id)
          if (itemsWithDetails) {
            setEditingPO({ ...poData as PurchaseOrder, items: itemsWithDetails })
          }
        }
      }
      loadPODetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPO?.id])

  return {
    allPOs,
    setAllPOs,
    draftPOs,
    setDraftPOs,
    selectedPO,
    setSelectedPO,
    editingPO,
    setEditingPO,
    userNamesMap,
    setUserNamesMap,
    loadPurchaseOrders,
  }
}
