import { useEffect, useState } from 'react'
import { loadGcProjects } from '../../lib/gc/gcIo'
import type { ProspectDoubleRow } from '../../lib/prospects/companyDouble'
import { loadProspectDoubles } from '../../lib/prospects/companyDoubleIo'
import { gcBiddingLines, gcWorkCounts, type BiddingLine, type GcWorkCounts } from '../../lib/prospects/gcLeadLane'
import { loadCustomerDoubles } from '../../lib/prospects/gcLeadLaneIo'
import type { ProspectKind } from '../../lib/prospects/prospectKinds'
import type { StripRead } from '../../lib/prospects/stripState'
import { todayYmdInAppTz } from '../../utils/dateUtils'

type CustomerDouble = { id: string; name: string; phone: string | null; since: string | null }

/**
 * Two fail-soft reads of `src/pages/Prospects.tsx`, moved out unchanged and kept in one hook because they share a
 * piece of state:
 *
 * - **The doubles** (v2.5579): the prospects of every lane and the customers load when New Prospect opens,
 *   whatever its kind, for `companyDouble`.
 * - **The Jobs to GC lane** (v2.5561, v2.5785): the Project Board's counts and its bidding lines, and the
 *   customers again. It reads when the lane is Jobs to GC or New Prospect's kind is.
 *
 * `customerDoubles` has two writers on purpose (the map's quirk 31): whichever read answers last wins, and both
 * read the same rows.
 */
export function useProspectDoubles({
  kind,
  newKind,
  newProspectModalOpen,
  userId,
}: {
  kind: ProspectKind
  newKind: ProspectKind
  newProspectModalOpen: boolean
  userId: string | null
}) {
  const [gcWork, setGcWork] = useState<StripRead<GcWorkCounts>>(undefined)
  // The projects bidding now (v2.5785, punch list #148, PR 2): named under the counts, soonest due first.
  const [gcBidding, setGcBidding] = useState<BiddingLine[]>([])
  const [customerDoubles, setCustomerDoubles] = useState<CustomerDouble[]>([])
  const [prospectDoubles, setProspectDoubles] = useState<ProspectDoubleRow[]>([])

  // One lookup for every double (v2.5579): both fail-soft, and the bench rides along from the Subs read.
  useEffect(() => {
    if (!newProspectModalOpen || !userId) return
    let live = true
    loadProspectDoubles()
      .then((rows) => {
        if (live) setProspectDoubles(rows)
      })
      .catch(() => {
        if (live) setProspectDoubles([])
      })
    loadCustomerDoubles()
      .then((rows) => {
        if (live) setCustomerDoubles(rows)
      })
      .catch(() => {
        if (live) setCustomerDoubles([])
      })
    return () => {
      live = false
    }
  }, [newProspectModalOpen, userId])

  // The Jobs to GC lane (v2.5561): the Project Board's counts and the customers, both fail-soft.
  useEffect(() => {
    if (kind !== 'gc_lead' && newKind !== 'gc_lead') return
    if (!userId) return
    let live = true
    loadGcProjects()
      .then((projects) => {
        if (!live) return
        setGcWork(gcWorkCounts(projects))
        setGcBidding(gcBiddingLines(projects, todayYmdInAppTz()))
      })
      .catch(() => {
        if (live) setGcWork(null)
      })
    loadCustomerDoubles()
      .then((rows) => {
        if (live) setCustomerDoubles(rows)
      })
      .catch(() => {
        if (live) setCustomerDoubles([])
      })
    return () => {
      live = false
    }
  }, [kind, newKind, userId])

  return { gcWork, gcBidding, customerDoubles, prospectDoubles }
}
