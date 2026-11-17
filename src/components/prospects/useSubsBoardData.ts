import { useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { firstCallbackWords } from '../../lib/prospects/callRun'
import { inboundProspects } from '../../lib/prospects/subRecord'
import { tradeKey } from '../../lib/prospects/subsLane'
import { pinAfterDrop, pinnedIds, pinsByTrade, rankWrites, unpin, type RankRow } from '../../lib/prospects/subsRanks'

/**
 * What the Subs Board reads beside the lane's rows, and its pin writes (v2.5808, v2.5809): the pins by trade, the
 * prospects somebody wrote back to, the upcoming callbacks in words. Moved out of `src/pages/Prospects.tsx`
 * unchanged. The page's two loaders call `loadLaneRanks` and `loadLaneExtras`; every read here is fail-soft.
 */
export function useSubsBoardData({ userId }: { userId: string | null }) {
  const { showToast } = useToastContext()
  const [inboundProspectIds, setInboundProspectIds] = useState<Set<string>>(() => new Set())
  const [laneCallbacks, setLaneCallbacks] = useState<Record<string, string>>({})
  // The board's pins (v2.5809): one row a company a trade, read with the lane, written on a drop.
  const [laneRanks, setLaneRanks] = useState<RankRow[]>([])
  const lanePins = useMemo(() => pinsByTrade(laneRanks), [laneRanks])

  /** The board's pins (v2.5809), the whole lane's: a few hundred rows at most. Fail-soft. */
  async function loadLaneRanks(): Promise<RankRow[]> {
    try {
      const { data, error } = await supabase.from('prospect_trade_ranks').select('prospect_id, trade, rank_order')
      if (error) return []
      const rows = (data ?? []) as RankRow[]
      setLaneRanks(rows)
      return rows
    } catch {
      return []
    }
  }

  /** A drop on the board (v2.5809): the dragged card pinned where it landed among the column's pins; the rows written dense. */
  async function dropOnBoard(trade: string, draggedId: string, toIndex: number) {
    if (!userId) return
    const key = tradeKey(trade)
    const was = lanePins.get(key)
    const next = pinAfterDrop(pinnedIds(was), draggedId, toIndex)
    await writePins(trade, next, was)
  }

  async function unpinOnBoard(trade: string, prospectId: string) {
    const key = tradeKey(trade)
    const was = lanePins.get(key)
    await writePins(trade, unpin(pinnedIds(was), prospectId), was)
  }

  async function writePins(trade: string, next: string[], was: ReadonlyMap<string, number> | undefined) {
    if (!userId) return
    const { upserts, deletes } = rankWrites(trade, next, was)
    const key = tradeKey(trade)
    // Paint first, then write; a refusal reloads the truth.
    setLaneRanks((prev) => [...prev.filter((r) => tradeKey(r.trade) !== key), ...upserts])
    const problems: string[] = []
    if (deletes.length > 0) {
      const { error } = await supabase.from('prospect_trade_ranks').delete().eq('trade', trade).in('prospect_id', deletes)
      if (error) problems.push(error.message)
    }
    if (upserts.length > 0) {
      const { error } = await supabase.from('prospect_trade_ranks').upsert(upserts.map((r) => ({ ...r, set_by: userId, set_at: new Date().toISOString() })), { onConflict: 'prospect_id,trade' })
      if (error) problems.push(error.message)
    }
    if (problems.length > 0) {
      showToast(`The pin did not save: ${problems[0]}`, 'error')
      void loadLaneRanks()
    }
  }

  /** The board's extra facts (v2.5808): a text or an email back on a sub's thread, and the upcoming callbacks. Both fail-soft. */
  async function loadLaneExtras(ids: string[]) {
    if (ids.length === 0) {
      setInboundProspectIds(new Set())
      setLaneCallbacks({})
      return
    }
    try {
      const { data: contacts } = await supabase.from('contacts').select('id, prospect_id').in('prospect_id', ids)
      const contactRows = (contacts ?? []) as { id: string; prospect_id: string | null }[]
      let inbound = new Set<string>()
      if (contactRows.length > 0) {
        const { data: lines } = await supabase.from('messages').select('contact_id').eq('direction', 'in').in('contact_id', contactRows.map((c) => c.id))
        inbound = inboundProspects(contactRows, (lines ?? []) as { contact_id: string }[])
      }
      setInboundProspectIds(inbound)
    } catch {
      setInboundProspectIds(new Set())
    }
    void loadLaneRanks()
    try {
      const { data: cbs } = await supabase.from('prospect_callbacks').select('prospect_id, callback_date').gte('callback_date', new Date().toISOString()).in('prospect_id', ids).order('callback_date', { ascending: true })
      setLaneCallbacks(firstCallbackWords((cbs ?? []) as { prospect_id: string; callback_date: string }[], new Date()))
    } catch {
      setLaneCallbacks({})
    }
  }

  return { inboundProspectIds, laneCallbacks, setLaneCallbacks, lanePins, loadLaneRanks, loadLaneExtras, dropOnBoard, unpinOnBoard }
}
