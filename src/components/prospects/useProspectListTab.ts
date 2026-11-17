import { useEffect, useState } from 'react'
import type { SetURLSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LIST_SECTION_ORDER, LIST_SECTIONS_DEFAULT_OPEN, groupProspectsForList, type ListSectionKey, type ProspectLastCall } from '../../lib/prospects/prospectListGrouping'
import type { Prospect } from '../../lib/prospects/prospectRow'
import { sumTimerSecondsByProspect } from '../../lib/prospects/prospectTimerSums'

/**
 * The Prospect List tab's own state: its search, which sections and which of the Subs list's folds are open, the
 * row last opened on the deck, and each prospect's timed seconds. Moved out of `src/pages/Prospects.tsx` unchanged.
 *
 * The page calls this hook and `ProspectsListTab` draws its value. The state lives with the page on purpose: the
 * tab unmounts when the caller looks at another tab, and the search and the open sections are still there on
 * the way back.
 */
export function useProspectListTab({
  active,
  userId,
  searchParams,
  setSearchParams,
  prospectListProspects,
  prospectLastCallMap,
  showDeck,
}: {
  /** The Prospect List is the tab on screen. */
  active: boolean
  userId: string | null
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  prospectListProspects: Prospect[]
  prospectLastCallMap: Record<string, ProspectLastCall>
  /** Put Follow Up on screen: a row's Call now opens the deck on it. */
  showDeck: () => void
}) {
  const [subsSectionOpen, setSubsSectionOpen] = useState<Record<string, boolean>>({})
  const [prospectListSearchQuery, setProspectListSearchQuery] = useState('')
  const [prospectListSectionOpen, setProspectListSectionOpen] = useState<Partial<Record<ListSectionKey, boolean>>>({})
  const [selectedProspectForList, setSelectedProspectForList] = useState<Prospect | null>(null)
  const [prospectLedgerSecondsMap, setProspectLedgerSecondsMap] = useState<Record<string, number>>({})

  // When on Prospect List with prospect_id in URL (e.g. from Quickfill Edit), select that prospect
  useEffect(() => {
    if (!active) return
    const prospectId = searchParams.get('prospect_id')
    if (!prospectId || prospectListProspects.length === 0) return
    const p = prospectListProspects.find((x) => x.id === prospectId)
    if (p) {
      setSelectedProspectForList(p)
      const grouped = groupProspectsForList([p], new Set(Object.keys(prospectLastCallMap)), Date.now())
      const sectionKey = LIST_SECTION_ORDER.find((k) => grouped[k].length > 0)
      if (sectionKey && !LIST_SECTIONS_DEFAULT_OPEN.has(sectionKey)) {
        setProspectListSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('prospect_id')
        return next
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed as the page had it: the tab, the address and the rows
  }, [active, searchParams, prospectListProspects])

  async function loadProspectLedgerSecondsMap() {
    if (!userId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the cast the page carried (the map's quirk 1)
    const { data } = await (supabase as any)
      .from('prospect_timer_events')
      .select('prospect_id, timer_seconds')
      .eq('user_id', userId)
    setProspectLedgerSecondsMap(sumTimerSecondsByProspect((data ?? []) as Array<{ prospect_id: string | null; timer_seconds: number }>))
  }

  useEffect(() => {
    if (active && userId) {
      loadProspectLedgerSecondsMap()
    } else {
      setProspectLedgerSecondsMap({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the tab and the user, as the page had it
  }, [active, userId])

  function toggleProspectListSection(key: ListSectionKey) {
    setProspectListSectionOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? LIST_SECTIONS_DEFAULT_OPEN.has(key)) }))
  }

  function jumpToProspectListSection(key: ListSectionKey) {
    setProspectListSectionOpen((prev) => ({ ...prev, [key]: true }))
    requestAnimationFrame(() => {
      document.getElementById(`plist-sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function selectProspectForList(p: Prospect) {
    setSelectedProspectForList(p)
    showDeck()
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', 'follow-up')
      next.set('prospect_id', p.id)
      return next
    })
  }

  /** Which of the Subs list's folds are open stays here, so a fold survives a visit to another tab. */
  const toggleSubsSection = (key: string, fallback: boolean) => setSubsSectionOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? fallback) }))

  return {
    prospectListSearchQuery,
    setProspectListSearchQuery,
    prospectListSectionOpen,
    selectedProspectForList,
    prospectLedgerSecondsMap,
    subsSectionOpen,
    toggleSubsSection,
    toggleProspectListSection,
    jumpToProspectListSection,
    selectProspectForList,
  }
}

export type ProspectListTabState = ReturnType<typeof useProspectListTab>
