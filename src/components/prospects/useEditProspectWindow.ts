import { useState, type Dispatch, type SetStateAction } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useLeaveGuard } from '../../hooks/useLeaveGuard'
import { supabase } from '../../lib/supabase'
import { queueAfterRemoval } from '../../lib/prospects/callingOrder'
import { EMPTY_COMPANY, EMPTY_PERSON, blocksFromRow, blocksProblem, rowFromBlocks, type CompanyFields, type PersonFields } from '../../lib/prospects/personBlock'
import { kindFieldsPayload, tradesText } from '../../lib/prospects/prospectKinds'
import type { Prospect } from '../../lib/prospects/prospectRow'
import { editDirty, editSnapshotOf } from '../../lib/prospects/windowLeave'

/**
 * The Edit Prospect window's engine: its boxes, what it opened with (for the leave guard), and its writes: Save,
 * Delete and the warmth presses. Moved out of `src/pages/Prospects.tsx` unchanged; `EditProspectWindow` draws it.
 *
 * The window has two identities (the map's quirk 14): `editingProspect === null` means it edits the deck's card;
 * a set value means it edits that row, opened from the list or the Board. Delete handles both and re-points the
 * deck. The page calls this hook, and hands it the caches' setters and its one `saving` flag.
 */
export function useEditProspectWindow({
  currentProspect,
  followUpProspects,
  currentProspectIndex,
  saving,
  setSaving,
  setFollowUpProspects,
  setProspectListProspects,
  setCurrentProspectIndex,
  setFollowUpTimerSeconds,
  updateUrlProspectId,
}: {
  currentProspect: Prospect | null
  followUpProspects: Prospect[]
  currentProspectIndex: number
  saving: boolean
  setSaving: Dispatch<SetStateAction<boolean>>
  setFollowUpProspects: Dispatch<SetStateAction<Prospect[]>>
  setProspectListProspects: Dispatch<SetStateAction<Prospect[]>>
  setCurrentProspectIndex: Dispatch<SetStateAction<number>>
  setFollowUpTimerSeconds: Dispatch<SetStateAction<number>>
  updateUrlProspectId: (id: string | null) => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  // The kind's boxes on Edit prospect (v2.5559); the person and company blocks since v2.5601.
  const [editSource, setEditSource] = useState('')
  const [editTrades, setEditTrades] = useState('')
  const [editMaxMiles, setEditMaxMiles] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPerson, setEditPerson] = useState<PersonFields>(EMPTY_PERSON)
  const [editCompany, setEditCompany] = useState<CompanyFields>(EMPTY_COMPANY)
  const [editOpenedWith, setEditOpenedWith] = useState<Record<string, string>>({})

  // Escape and the backdrop (v2.5582): an untouched window closes at once, a touched one asks. Edit compares its
  // boxes to what it opened with.
  const editFieldsNow: Record<string, string> = { ...editPerson, ...editCompany, source: editSource, trades: editTrades, miles: editMaxMiles, role: editRole }
  const editGuard = useLeaveGuard({ dirty: editModalOpen && editDirty(editFieldsNow, editOpenedWith), onClose: closeEditProspect, busy: saving, paused: !editModalOpen })

  function closeEditProspect() {
    setEditModalOpen(false)
    setEditingProspect(null)
  }

  async function handleWarmthDelta(delta: number) {
    if (!currentProspect || saving) return
    setSaving(true)
    const newVal = (currentProspect.warmth_count ?? 0) + delta
    const { error } = await supabase.from('prospects').update({ warmth_count: newVal }).eq('id', currentProspect.id)
    if (!error) {
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, warmth_count: newVal } : p))
      )
    }
    setSaving(false)
  }

  async function handleWarmthReset() {
    if (!currentProspect || saving) return
    setSaving(true)
    const { error } = await supabase.from('prospects').update({ warmth_count: 0 }).eq('id', currentProspect.id)
    if (!error) {
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === currentProspect.id ? { ...p, warmth_count: 0 } : p))
      )
    }
    setSaving(false)
  }

  function openEditModal() {
    if (!currentProspect) return
    setEditingProspect(null)
    const blocks = blocksFromRow(currentProspect)
    setEditPerson(blocks.person)
    setEditCompany(blocks.company)
    setEditKindFields(currentProspect)
    setEditOpenedWith(editSnapshotOf(currentProspect))
    setEditModalOpen(true)
  }

  function setEditKindFields(p: Prospect) {
    setEditSource(p.source ?? '')
    setEditTrades(tradesText(p.trades))
    setEditMaxMiles(p.max_miles == null ? '' : String(p.max_miles))
    setEditRole(p.company_role ?? '')
  }

  function openEditModalForProspect(p: Prospect) {
    setEditingProspect(p)
    const blocks = blocksFromRow(p)
    setEditPerson(blocks.person)
    setEditCompany(blocks.company)
    setEditKindFields(p)
    setEditOpenedWith(editSnapshotOf(p))
    setEditModalOpen(true)
  }

  async function handleDeleteProspect() {
    const prospectToEdit = editingProspect ?? currentProspect
    if (!prospectToEdit || saving) return
    if (
      !(await confirmDialog({
        message: `Delete prospect "${prospectToEdit.company_name || 'Unknown'}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    setSaving(true)
    const { error } = await supabase.from('prospects').delete().eq('id', prospectToEdit.id)
    if (!error) {
      setFollowUpProspects((prev) => prev.filter((p) => p.id !== prospectToEdit.id))
      setProspectListProspects((prev) => prev.filter((p) => p.id !== prospectToEdit.id))
      if (currentProspect?.id === prospectToEdit.id) {
        const left = queueAfterRemoval(followUpProspects, currentProspectIndex, prospectToEdit.id)
        setCurrentProspectIndex(left.index)
        setFollowUpTimerSeconds(0)
        updateUrlProspectId(left.nextId)
      }
      setEditModalOpen(false)
      setEditingProspect(null)
    }
    setSaving(false)
  }

  async function saveEdit() {
    const prospectToEdit = editingProspect ?? currentProspect
    if (!prospectToEdit || saving) return
    setSaving(true)
    const held = blocksProblem(editPerson, editCompany)
    if (held) {
      showToast(held, 'error')
      setSaving(false)
      return
    }
    const updated = {
      ...rowFromBlocks(editPerson, editCompany),
      ...kindFieldsPayload(prospectToEdit.kind, { source: editSource, trades: editTrades, maxMiles: editMaxMiles, role: editRole }),
    }
    const { error } = await supabase
      .from('prospects')
      .update(updated)
      .eq('id', prospectToEdit.id)
    if (!error) {
      setFollowUpProspects((prev) =>
        prev.map((p) => (p.id === prospectToEdit.id ? { ...p, ...updated } : p))
      )
      setProspectListProspects((prev) =>
        prev.map((p) => (p.id === prospectToEdit.id ? { ...p, ...updated } : p))
      )
      setEditModalOpen(false)
      setEditingProspect(null)
    }
    setSaving(false)
  }

  return {
    editModalOpen,
    editingProspect,
    editSource,
    setEditSource,
    editTrades,
    setEditTrades,
    editMaxMiles,
    setEditMaxMiles,
    editRole,
    setEditRole,
    editPerson,
    setEditPerson,
    editCompany,
    setEditCompany,
    editGuard,
    closeEditProspect,
    openEditModal,
    openEditModalForProspect,
    handleDeleteProspect,
    saveEdit,
    handleWarmthDelta,
    handleWarmthReset,
  }
}

export type EditProspectWindowState = ReturnType<typeof useEditProspectWindow>
