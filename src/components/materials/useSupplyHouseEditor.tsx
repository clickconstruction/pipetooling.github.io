import { useState, type ReactNode } from 'react'

import { supabase } from '../../lib/supabase'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { SupplyHouseForm, type SupplyHouseFormData } from '../SupplyHouseForm'
import type { Database } from '../../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

/**
 * The one add / edit / delete path for a supply house (to-dos/supply-house-directory,
 * PR 1). Lifted verbatim from `SupplyHousesTab` so the Directory pane, the
 * office's accounts-payable drawer and (PR 2) the estimator's tab all open the
 * same modal instead of each carrying a copy of the form state.
 *
 * The host renders `{editor.modal}` once and calls `openAdd()` / `openEdit(house)`.
 */
export function useSupplyHouseEditor({
  myRole,
  onSaved,
}: {
  myRole: UserRole | null
  /** Runs after a successful save or delete — reload whatever lists the host shows. */
  onSaved: (change: { kind: 'created' | 'updated' | 'deleted'; houseId: string | null }) => void | Promise<void>
}): {
  openAdd: () => void
  openEdit: (house: SupplyHouse) => void
  close: () => void
  /** The house being edited, or null while adding / closed. */
  editing: SupplyHouse | null
  isOpen: boolean
  error: string | null
  modal: ReactNode
} {
  const confirmDialog = useConfirmDialog()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SupplyHouse | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [monthlyPaymentDay, setMonthlyPaymentDay] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setEditing(null)
  }

  function fill(house: SupplyHouse | null) {
    setEditing(house)
    setName(house?.name ?? '')
    setPhone(house?.phone ?? '')
    setAddress(house?.address ?? '')
    setWebsiteUrl(house?.website_url ?? '')
    setNotes(house?.notes ?? '')
    setMonthlyPaymentDay(house?.monthly_payment_day != null ? String(house.monthly_payment_day) : '')
    setError(null)
    setOpen(true)
  }

  function handleChange(field: string, value: string) {
    switch (field) {
      case 'name': setName(value); break
      case 'phone': setPhone(value); break
      case 'address': setAddress(value); break
      case 'website_url': setWebsiteUrl(value); break
      case 'notes': setNotes(value); break
      case 'monthly_payment_day': setMonthlyPaymentDay(value); break
    }
  }

  async function handleSubmit(data: SupplyHouseFormData) {
    if (!data.name.trim()) {
      setError('Supply house name is required')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: data.name.trim(),
      phone: data.phone.trim() || null,
      address: data.address.trim() || null,
      website_url: data.website_url,
      notes: data.notes.trim() || null,
      monthly_payment_day: data.monthly_payment_day,
      vendor_kind: data.vendor_kind,
    }
    if (editing) {
      const { error: e } = await supabase.from('supply_houses').update(payload).eq('id', editing.id)
      if (e) setError(e.message)
      else {
        const tradeErr = await syncHouseTrades(editing.id, data.service_type_ids)
        if (tradeErr) setError(tradeErr)
        await onSaved({ kind: 'updated', houseId: editing.id })
        if (!tradeErr) close()
      }
    } else {
      const { data: inserted, error: e } = await supabase.from('supply_houses').insert(payload).select('id').single()
      if (e) setError(e.message)
      else {
        const newId = (inserted as { id: string } | null)?.id ?? null
        const tradeErr = newId ? await syncHouseTrades(newId, data.service_type_ids) : null
        if (tradeErr) setError(tradeErr)
        await onSaved({ kind: 'created', houseId: newId })
        if (!tradeErr) close()
      }
    }
    setSaving(false)
  }

  /**
   * Trades served (v2.3173): replace the house's supply_house_service_types rows with the
   * chosen set. Before that table is pushed the reads and writes 404 — treat that as
   * "nothing to sync" rather than a failed save. Returns an error message otherwise.
   */
  async function syncHouseTrades(houseId: string, ids: string[]): Promise<string | null> {
    const table = supabase.from('supply_house_service_types' as never)
    const missingTable = (msg: string) => /supply_house_service_types/.test(msg) && /schema cache|does not exist|not found/i.test(msg)
    const { data: existing, error: readErr } = await table.select('service_type_id').eq('supply_house_id', houseId)
    if (readErr) return missingTable(readErr.message) ? null : readErr.message
    const have = new Set(((existing ?? []) as Array<{ service_type_id: string }>).map((l) => l.service_type_id))
    const want = new Set(ids)
    const toDelete = [...have].filter((id) => !want.has(id))
    const toInsert = [...want].filter((id) => !have.has(id))
    if (toDelete.length > 0) {
      const { error } = await supabase.from('supply_house_service_types' as never).delete().eq('supply_house_id', houseId).in('service_type_id', toDelete)
      if (error) return error.message
    }
    if (toInsert.length > 0) {
      const rows = toInsert.map((service_type_id) => ({ supply_house_id: houseId, service_type_id })) as never
      const { error } = await supabase.from('supply_house_service_types' as never).insert(rows)
      if (error) return error.message
    }
    return null
  }

  async function handleDelete(houseId: string) {
    const { data: prices } = await supabase.from('material_part_prices').select('id').eq('supply_house_id', houseId).limit(1)
    const hasPrices = prices && prices.length > 0
    const message = hasPrices
      ? 'Delete this supply house? All prices associated with it will also be removed.'
      : 'Delete this supply house?'
    if (!(await confirmDialog({ message, confirmLabel: 'Delete', danger: true }))) return
    setError(null)
    const { error: e } = await supabase.from('supply_houses').delete().eq('id', houseId)
    if (e) setError(e.message)
    else {
      await onSaved({ kind: 'deleted', houseId })
      close()
    }
  }

  const modal = open ? (
    <SupplyHouseForm
      key={editing?.id ?? 'new'}
      editingSupplyHouse={editing}
      name={name}
      phone={phone}
      address={address}
      websiteUrl={websiteUrl}
      notes={notes}
      monthlyPaymentDay={monthlyPaymentDay}
      onChange={handleChange}
      onSubmit={handleSubmit}
      onClose={close}
      onDelete={editing ? () => handleDelete(editing.id) : undefined}
      saving={saving}
      myRole={myRole}
      variant="modal"
    />
  ) : null

  return {
    openAdd: () => fill(null),
    openEdit: (house) => fill(house),
    close,
    editing,
    isOpen: open,
    error,
    modal,
  }
}
