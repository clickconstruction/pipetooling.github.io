import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { openRfiAssumptions } from '../../lib/bids/scopeSheet'
import type { RfiRow } from '../../lib/bids/rfiFlow'

/**
 * RFI_LOOP_PLAN R5: the letter-time reminder. RFIs are non-blocking, so the rule is that
 * every RFI still open when the letter goes out MUST surface as an explicit assumption or
 * exclusion. This chip sits beside Mark sent and names the debt; it never blocks the
 * button — the human decides, with eyes open. Renders nothing when the queue is clear.
 */
export function OpenRfiChip({ bidId }: { bidId: string }) {
  const [open, setOpen] = useState<ReturnType<typeof openRfiAssumptions>>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.from('bids_rfis').select('rfi_number, question, status, answer').eq('bid_id', bidId)
        if (!cancelled) setOpen(openRfiAssumptions(((data ?? []) as unknown as Pick<RfiRow, 'rfi_number' | 'question' | 'status' | 'answer'>[])))
      } catch {
        if (!cancelled) setOpen([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId])
  if (open.length === 0) return null
  return (
    <span
      title={open.map((s) => s.text).join('\n')}
      style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        padding: '0.15rem 0.55rem',
        borderRadius: 999,
        background: 'var(--bg-amber-tint)',
        color: 'var(--text-amber-800)',
        border: '1px solid var(--text-amber-800)',
        whiteSpace: 'nowrap',
      }}
    >
      {open.length} open RFI{open.length === 1 ? '' : 's'} — carry as assumptions/exclusions
    </span>
  )
}
