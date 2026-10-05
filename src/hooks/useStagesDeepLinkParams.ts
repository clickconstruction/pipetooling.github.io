import { useEffect, useMemo, useRef } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import {
  parseStagesDeepLinks,
  stripStagesDeepLink,
  type StagesDeepLinkKey,
  type StagesDeepLinks,
  type StagesLienDeskLink,
  type StagesLienWindowLink,
} from '../lib/jobs/stagesDeepLinks'
import { stagesSectionElementId } from '../lib/jobs/stagesSectionPrefs'

/** What each modal door opens — the tab's setters. Pass a stable object (memoized once). */
export type StagesDeepLinkDoors = {
  /** `?followups=1` (v2.1720): the follow-up deck. */
  followups: () => void
  /** `?gcReview=1` (v2.1984): GC Review. */
  gcReview: () => void
  /** `?gcnotice=<customer id>` (v2.3470): Put a GC on notice. */
  gcNotice: (gcId: string) => void
  /** `?liendesk=1` (v2.3405): the Lien desk on a job, pane and pile. */
  lienDesk: (link: StagesLienDeskLink) => void
  /** `?lienwindow=<job id>`: that job's Lien window on a tab. */
  lienWindow: (link: StagesLienWindowLink) => void
  /** `?round=1` (v2.2771): GC Review straight into the round overlay. */
  round: (gcId: string | null) => void
  /** `?chase=1` (v2.2025): payment follow-up call mode. */
  chase: () => void
  /** `?forecast=1` (v2.2226): the Payment forecast modal. */
  forecast: () => void
}

type ModalDoorKey = Exclude<StagesDeepLinkKey, 'rtb'>

/** The order the tab's seven effects ran in — kept, since each strips its own params from the same pre-strip URL. */
const MODAL_DOORS: readonly ModalDoorKey[] = ['followups', 'gcReview', 'gcNotice', 'lienDesk', 'lienWindow', 'round', 'chase', 'forecast']

/** Opens the door when its link is present; false when it is not. */
function openDoor(key: ModalDoorKey, links: StagesDeepLinks, doors: StagesDeepLinkDoors): boolean {
  switch (key) {
    case 'followups':
      if (!links.followups) return false
      doors.followups()
      return true
    case 'gcReview':
      if (!links.gcReview) return false
      doors.gcReview()
      return true
    case 'gcNotice':
      if (!links.gcNoticeGcId) return false
      doors.gcNotice(links.gcNoticeGcId)
      return true
    case 'lienDesk':
      if (!links.lienDesk) return false
      doors.lienDesk(links.lienDesk)
      return true
    case 'lienWindow':
      if (!links.lienWindow) return false
      doors.lienWindow(links.lienWindow)
      return true
    case 'round':
      if (!links.round) return false
      doors.round(links.round.gcId)
      return true
    case 'chase':
      if (!links.chase) return false
      doors.chase()
      return true
    case 'forecast':
      if (!links.forecast) return false
      doors.forecast()
      return true
  }
}

/**
 * The board's deep links (moved out of JobsStagesTab, punch list #46 row 2, the Stages map's
 * step 5): one parse of the URL (`lib/jobs/stagesDeepLinks`, v2.3865), then each modal door
 * consumes once, opens, and strips its own params with `replace` so a refresh or Back does not
 * re-open it. A door is consumed for the life of the mount — the URL bringing it back later does
 * not re-open it. Returns the parsed links (the `rtb` focus below reads them).
 */
export function useStagesDeepLinkParams(
  searchParams: URLSearchParams,
  navigate: NavigateFunction,
  doors: StagesDeepLinkDoors,
): StagesDeepLinks {
  const deepLinks = useMemo(() => parseStagesDeepLinks(searchParams), [searchParams])
  const consumedRef = useRef<Set<ModalDoorKey>>(new Set())
  useEffect(() => {
    for (const key of MODAL_DOORS) {
      if (consumedRef.current.has(key)) continue
      if (!openDoor(key, deepLinks, doors)) continue
      consumedRef.current.add(key)
      navigate({ search: stripStagesDeepLink(searchParams, key) }, { replace: true })
    }
  }, [deepLinks, searchParams, navigate, doors])
  return deepLinks
}

/**
 * `?rtb=1` deep link (v2.2276): the assistants' ready-to-bill banner lands
 * on the Ready to Bill section. Unlike the modal params above, this one
 * needs the board DOM, so the scroll polls for the section header while
 * data loads; and the strip re-runs unguarded because the tab-router
 * effect can resurrect the param from its own pre-strip snapshot.
 */
export function useStagesRtbFocus(
  deepLinks: StagesDeepLinks,
  searchParams: URLSearchParams,
  navigate: NavigateFunction,
  focusStagesSection: (key: 'readyToBill') => void,
): void {
  useEffect(() => {
    if (!deepLinks.rtb) return
    navigate({ search: stripStagesDeepLink(searchParams, 'rtb') }, { replace: true })
    // Window-level arm (not a ref/state): survives the StrictMode double
    // mount that loses component state here, and expires so a later banner
    // tap re-arms. The scroll itself waits for the board's layout to hold
    // still — the section header exists while sections above it are still
    // streaming in, and scrolling early gets eaten by the growth.
    const w = window as unknown as { __rtbFocusArmedAt?: number }
    if (w.__rtbFocusArmedAt != null && Date.now() - w.__rtbFocusArmedAt < 5000) return
    w.__rtbFocusArmedAt = Date.now()
    // Stillness alone can't tell "loaded" from "not loaded yet" — the page is
    // perfectly still while the board query is in flight, so a single scroll
    // fires early and the sections above then grow and push the target back
    // down. Keep polling after the first scroll and re-pin whenever layout
    // settles with the section away from the top; stop once it holds there.
    let lastTop: number | null = null
    let tries = 0
    let focused = false
    const tick = () => {
      const el = document.getElementById(stagesSectionElementId('readyToBill'))
      if (el) {
        const top = Math.round(el.getBoundingClientRect().top)
        if (lastTop != null && Math.abs(top - lastTop) < 2) {
          if (!focused || Math.abs(top) > 40) {
            focusStagesSection('readyToBill')
            focused = true
          } else {
            return
          }
        }
        lastTop = top
      }
      if (++tries < 100) window.setTimeout(tick, 300)
    }
    window.setTimeout(tick, 400)
  }, [deepLinks, searchParams, navigate, focusStagesSection])
}
