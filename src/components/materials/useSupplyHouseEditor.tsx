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
      is_insurer: data.is_insurer,
    }
    if (editing) {
      const { error: e } = await supabase.from('supply_houses').update(payload).eq('id', editing.id)
      if (e) setError(e.message)
      else {
        await onSaved({ kind: 'updated', houseId: editing.id })
        close()
      }
    } else {
      const { data: inserted, error: e } = await supabase.from('supply_houses').insert(payload).select('id').single()
      if (e) setError(e.message)
      else {
        await onSaved({ kind: 'created', houseId: (inserted as { id: string } | null)?.id ?? null })
        close()
      }
    }
    setSaving(false)
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
