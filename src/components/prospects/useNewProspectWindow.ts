import { useState, type Dispatch, type SetStateAction } from 'react'
import { useLeaveGuard } from '../../hooks/useLeaveGuard'
import { supabase } from '../../lib/supabase'
import { companyDouble, type ProspectDoubleRow } from '../../lib/prospects/companyDouble'
import { EMPTY_COMPANY, EMPTY_PERSON, blocksProblem, rowFromBlocks, type CompanyFields, type PersonFields } from '../../lib/prospects/personBlock'
import { kindFieldsPayload, type ProspectKind } from '../../lib/prospects/prospectKinds'
import { anyTyped } from '../../lib/prospects/windowLeave'

/**
 * The New Prospect window's engine: its boxes, its leave guard, the double lookup's answer, the ways it opens
 * (the lane's kind, or a sub with a trade filled in) and its save. Moved out of `src/pages/Prospects.tsx`
 * unchanged; `NewProspectWindow` draws it.
 *
 * The open flag and the picked kind stay with the page, since the lane reads above this hook are keyed on them.
 * The page calls this hook, and hands it its one `saving` flag.
 */
export function useNewProspectWindow({
  kind,
  newKind,
  setNewKind,
  newProspectModalOpen,
  setNewProspectModalOpen,
  saving,
  setSaving,
  userId,
  prospectDoubles,
  benchCompanies,
  customerDoubles,
  getEffectiveMasterId,
  setKindTab,
  reloadLane,
}: {
  /** The lane the page is on. */
  kind: ProspectKind
  newKind: ProspectKind
  setNewKind: Dispatch<SetStateAction<ProspectKind>>
  newProspectModalOpen: boolean
  setNewProspectModalOpen: Dispatch<SetStateAction<boolean>>
  saving: boolean
  setSaving: Dispatch<SetStateAction<boolean>>
  userId: string | null
  prospectDoubles: ProspectDoubleRow[]
  benchCompanies: { id: string; name: string; phone: string | null; trades: string[]; vetted?: boolean }[]
  customerDoubles: { id: string; name: string; phone: string | null; since: string | null }[]
  getEffectiveMasterId: () => Promise<string | null>
  /** The new row lives on another lane: go there, and its loaders run on the kind change. */
  setKindTab: (next: ProspectKind) => void
  /** The new row lives on this lane: read the deck, then the list. */
  reloadLane: () => Promise<void>
}) {
  const [newCustomerLink, setNewCustomerLink] = useState<{ id: string; name: string } | null>(null)
  const [newProspectError, setNewProspectError] = useState<string | null>(null)
  const [newSource, setNewSource] = useState('')
  const [newTrades, setNewTrades] = useState('')
  const [newMaxMiles, setNewMaxMiles] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newPerson, setNewPerson] = useState<PersonFields>(EMPTY_PERSON)
  const [newCompany, setNewCompany] = useState<CompanyFields>(EMPTY_COMPANY)

  // Escape and the backdrop (v2.5582): an untouched window closes at once, a touched one asks. Leaving New
  // Prospect clears its boxes.
  const newProspectDirty = newProspectModalOpen && anyTyped({ ...newPerson, okToText: newPerson.okToText !== 'not_asked', ...newCompany, newSource, newTrades, newMaxMiles, newRole, linked: !!newCustomerLink })
  const newGuard = useLeaveGuard({ dirty: newProspectDirty, onClose: closeNewProspect, busy: saving, paused: !newProspectModalOpen })

  function closeNewProspect() {
    setNewProspectModalOpen(false)
    resetNewProspectForm()
  }

  function resetNewProspectForm() {
    setNewPerson(EMPTY_PERSON)
    setNewCompany(EMPTY_COMPANY)
    setNewSource('')
    setNewTrades('')
    setNewMaxMiles('')
    setNewRole('')
    setNewCustomerLink(null)
    setNewProspectError(null)
  }

  /** New Prospect on this lane's kind, the header's button and the empty Prospect List's press (punch list #184, sweep C). */
  const openNewProspect = () => {
    resetNewProspectForm()
    setNewKind(kind)
    setNewCustomerLink(null)
    setNewProspectError(null)
    setNewProspectModalOpen(true)
  }

  /** Add a sub (v2.5782): New Prospect as a sub with the trade filled in, from a need's row or a book chip. */
  const openAddSub = (trade: string) => {
    resetNewProspectForm()
    setNewKind('sub')
    setNewTrades(trade)
    setNewCustomerLink(null)
    setNewProspectError(null)
    setNewProspectModalOpen(true)
  }

  const newProspectTwin = newProspectModalOpen
    ? companyDouble(newCompany.company || newPerson.name, newPerson.cell || newCompany.officePhone, { kind: newKind, prospects: prospectDoubles, bench: benchCompanies, customers: customerDoubles }, Date.now(), newCompany.mapsUrl)
    : null

  async function saveNewProspect() {
    if (!userId || saving) return
    const held = blocksProblem(newPerson, newCompany)
    if (held) {
      setNewProspectError(held)
      return
    }
    setNewProspectError(null)
    setSaving(true)
    const effectiveMasterId = await getEffectiveMasterId()
    if (!effectiveMasterId) {
      setNewProspectError('Unable to determine prospect owner.')
      setSaving(false)
      return
    }
    const payload = {
      master_user_id: effectiveMasterId,
      created_by: userId,
      warmth_count: 0,
      ...rowFromBlocks(newPerson, newCompany),
      kind: newKind,
      ...kindFieldsPayload(newKind, { source: newSource, trades: newTrades, maxMiles: newMaxMiles, role: newRole }),
      customer_id: newKind === 'gc_lead' && newCustomerLink ? newCustomerLink.id : null,
    }
    const { error } = await supabase.from('prospects').insert(payload)
    setSaving(false)
    if (error) {
      setNewProspectError(error.message)
      return
    }
    setNewProspectModalOpen(false)
    resetNewProspectForm()
    if (newKind !== kind) {
      // The new row lives on another lane: go there, and its loaders run on the kind change.
      setKindTab(newKind)
      return
    }
    await reloadLane()
  }

  return {
    newCustomerLink,
    setNewCustomerLink,
    newProspectError,
    newSource,
    setNewSource,
    newTrades,
    setNewTrades,
    newMaxMiles,
    setNewMaxMiles,
    newRole,
    setNewRole,
    newPerson,
    setNewPerson,
    newCompany,
    setNewCompany,
    newGuard,
    newProspectTwin,
    closeNewProspect,
    openNewProspect,
    openAddSub,
    saveNewProspect,
  }
}

export type NewProspectWindowState = ReturnType<typeof useNewProspectWindow>
