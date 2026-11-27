/**
 * Bids → Pricing, the three price-book forms: the version form (a book added or renamed), the delete window, and
 * the entry form (an entry added or edited, from the price-book drawer or from a row's assign search). Moved out of
 * `BidsPricingTab` as it stood (punch list #46, row 1, v2.8755): the same twenty state values, the same two effects
 * in the same order, the same doors that open and close each form. The tab calls the hook where the two effects
 * stood, so they keep their place among the tab's.
 *
 * The hook draws nothing and writes nothing. The four writes, save and delete for a book and for an entry, stay in
 * the tab and read what this returns: they reach the tab's freeze chain, its reloads and its book-edit offer.
 */
import { useEffect, useState } from 'react'

import type { PriceBookEntryWithFixture, PriceBookVersion } from '../lib/bids/bidPricingEngineTypes'

export type PriceBookFormsArgs = {
  /** A change of service type closes all three forms and forgets what they held. */
  selectedServiceTypeId: string
  /** The tab's error line: an opened form clears it. */
  setError: (message: string | null) => void
  /** The row's assign search closes when its *Add to the book* opens the entry form. */
  closeAssignDropdown: () => void
}

export function usePriceBookForms({ selectedServiceTypeId, setError, closeAssignDropdown }: PriceBookFormsArgs) {
  const [pricingVersionFormOpen, setPricingVersionFormOpen] = useState(false)
  const [editingPricingVersion, setEditingPricingVersion] = useState<PriceBookVersion | null>(null)
  const [pricingVersionNameInput, setPricingVersionNameInput] = useState('')
  const [savingPricingVersion, setSavingPricingVersion] = useState(false)
  const [pricingEntryFormOpen, setPricingEntryFormOpen] = useState(false)
  // v2.2398: entry form opened from an assign search targets the bid's ACTIVE pricing
  // (what the dropdowns search), not the drawer's template catalog.
  const [entryFormTargetPricing, setEntryFormTargetPricing] = useState(false)
  const [editingPricingEntry, setEditingPricingEntry] = useState<PriceBookEntryWithFixture | null>(null)
  const [pricingEntryFixtureName, setPricingEntryFixtureName] = useState('')
  const [pricingEntryRoughIn, setPricingEntryRoughIn] = useState('')
  const [pricingEntryTopOut, setPricingEntryTopOut] = useState('')
  const [pricingEntryTrimSet, setPricingEntryTrimSet] = useState('')
  const [pricingEntryTotal, setPricingEntryTotal] = useState('')
  // Combined-mode Price input keeps the raw string the user types; binding it to the
  // auto-toFixed(2) total reformatted the field on every keystroke ("21.00" → "2.01").
  const [pricingEntryCombinedPrice, setPricingEntryCombinedPrice] = useState('')
  const [savingPricingEntry, setSavingPricingEntry] = useState(false)
  const [deletePricingVersionModalOpen, setDeletePricingVersionModalOpen] = useState(false)
  const [pricingVersionToDelete, setPricingVersionToDelete] = useState<PriceBookVersion | null>(null)
  const [deletePricingVersionNameInput, setDeletePricingVersionNameInput] = useState('')
  const [deletePricingVersionError, setDeletePricingVersionError] = useState<string | null>(null)
  // What kind of version the version-form modal is creating.
  const [pricingFormMode, setPricingFormMode] = useState<'template' | 'pricing-blank' | 'pricing-clone'>('pricing-blank')
  const [pricingCloneSourceId, setPricingCloneSourceId] = useState<string | null>(null)

  // Close price book modals when service type changes
  useEffect(() => {
    setPricingVersionFormOpen(false)
    setPricingEntryFormOpen(false)
    setDeletePricingVersionModalOpen(false)
    setEditingPricingVersion(null)
    setEditingPricingEntry(null)
    setPricingVersionToDelete(null)
    setPricingVersionNameInput('')
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
  }, [selectedServiceTypeId])

  // Auto-calculate price book entry total
  useEffect(() => {
    const rough = parseFloat(pricingEntryRoughIn) || 0
    const top = parseFloat(pricingEntryTopOut) || 0
    const trim = parseFloat(pricingEntryTrimSet) || 0
    const calculatedTotal = rough + top + trim

    // Only auto-update if the current total is different (allows manual override)
    if (calculatedTotal !== (parseFloat(pricingEntryTotal) || 0)) {
      setPricingEntryTotal(calculatedTotal.toFixed(2))
    }
  }, [pricingEntryRoughIn, pricingEntryTopOut, pricingEntryTrimSet])

  // Version-form openers (the modal's Save branches on `pricingFormMode`).
  function openAddTemplate() {
    setEditingPricingVersion(null)
    setPricingFormMode('template')
    setPricingCloneSourceId(null)
    setPricingVersionNameInput('')
    setError(null)
    setPricingVersionFormOpen(true)
  }

  function openEditPricingVersion(v: PriceBookVersion) {
    setEditingPricingVersion(v)
    setPricingVersionNameInput(v.name)
    setPricingVersionFormOpen(true)
  }

  function closePricingVersionForm() {
    setPricingVersionFormOpen(false)
    setEditingPricingVersion(null)
    setPricingVersionNameInput('')
  }

  function openDeletePricingVersionModal(v: PriceBookVersion) {
    setPricingVersionToDelete(v)
    setDeletePricingVersionNameInput('')
    setDeletePricingVersionError(null)
    setDeletePricingVersionModalOpen(true)
  }

  function openNewPricingEntry() {
    setEditingPricingEntry(null)
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setError(null)
    setPricingEntryFormOpen(true)
  }

  /**
   * Add-from-the-assign-search (v2.2398, Wendi: "need ability to add new from dropdown
   * like on the old page"): opens the entry form pre-filled with the search term and
   * targets the bid's ACTIVE pricing — the set the assign dropdowns actually search.
   * (The panel form targets the template catalog since the drawer rework, so an entry
   * added there never appeared back in the dropdown.)
   */
  function openAddEntryFromAssignSearch(term: string) {
    setEditingPricingEntry(null)
    setPricingEntryFixtureName(term.trim())
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setEntryFormTargetPricing(true)
    setError(null)
    setPricingEntryFormOpen(true)
    closeAssignDropdown()
  }

  function openEditPricingEntry(entry: PriceBookEntryWithFixture) {
    setEditingPricingEntry(entry)
    setPricingEntryFixtureName(entry.fixture_types?.name ?? '')
    setPricingEntryRoughIn(String(entry.rough_in_price))
    setPricingEntryTopOut(String(entry.top_out_price))
    setPricingEntryTrimSet(String(entry.trim_set_price))
    setPricingEntryTotal(String(entry.total_price))
    setPricingEntryCombinedPrice(String(entry.total_price))
    setError(null)
    setPricingEntryFormOpen(true)
  }

  function closePricingEntryForm() {
    setPricingEntryFormOpen(false)
    setEditingPricingEntry(null)
    setPricingEntryFixtureName('')
    setPricingEntryRoughIn('')
    setPricingEntryTopOut('')
    setPricingEntryTrimSet('')
    setPricingEntryTotal('')
    setPricingEntryCombinedPrice('')
    setEntryFormTargetPricing(false)
    setError(null)
  }

  return {
    pricingVersionFormOpen,
    editingPricingVersion,
    pricingVersionNameInput,
    setPricingVersionNameInput,
    savingPricingVersion,
    setSavingPricingVersion,
    pricingEntryFormOpen,
    entryFormTargetPricing,
    editingPricingEntry,
    pricingEntryFixtureName,
    setPricingEntryFixtureName,
    pricingEntryRoughIn,
    setPricingEntryRoughIn,
    pricingEntryTopOut,
    setPricingEntryTopOut,
    pricingEntryTrimSet,
    setPricingEntryTrimSet,
    pricingEntryTotal,
    pricingEntryCombinedPrice,
    setPricingEntryCombinedPrice,
    savingPricingEntry,
    setSavingPricingEntry,
    deletePricingVersionModalOpen,
    setDeletePricingVersionModalOpen,
    pricingVersionToDelete,
    setPricingVersionToDelete,
    deletePricingVersionNameInput,
    setDeletePricingVersionNameInput,
    deletePricingVersionError,
    setDeletePricingVersionError,
    pricingFormMode,
    pricingCloneSourceId,
    openAddTemplate,
    openEditPricingVersion,
    closePricingVersionForm,
    openDeletePricingVersionModal,
    openNewPricingEntry,
    openAddEntryFromAssignSearch,
    openEditPricingEntry,
    closePricingEntryForm,
  }
}

export type PriceBookForms = ReturnType<typeof usePriceBookForms>
