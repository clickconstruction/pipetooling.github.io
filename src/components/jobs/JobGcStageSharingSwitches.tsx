/**
 * The two GC switches under the GC/Builder picker (v2.2933): "Share stage
 * dates with this GC" (off by default on every job — nothing about stages
 * reaches their portal until this is on AND a stage is offered) and "Offer
 * the next stage on its own when one passes inspection". Saved on the spot
 * against the job row, so they never ride the form's save-on-close.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'

export function JobGcStageSharingSwitches({ jobId, gcName }: { jobId: string; gcName: string | null }) {
  const { showToast } = useToastContext()
  const [flags, setFlags] = useState<{ share: boolean; auto: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('jobs_ledger').select('gc_shares_stage_dates, gc_auto_offer_next').eq('id', jobId).maybeSingle()
      if (cancelled) return
      const r = data as { gc_shares_stage_dates?: boolean | null; gc_auto_offer_next?: boolean | null } | null
      setFlags({ share: r?.gc_shares_stage_dates === true, auto: r?.gc_auto_offer_next === true })
    })()
    return () => {
      cancelled = true
    }
  }, [jobId])
  if (!flags) return null
  async function save(next: { share: boolean; auto: boolean }) {
    setBusy(true)
    const { error } = await supabase.from('jobs_ledger').update({ gc_shares_stage_dates: next.share, gc_auto_offer_next: next.auto }).eq('id', jobId)
    setBusy(false)
    if (error) {
      showToast(`Could not save: ${formatErrorMessage(error)}`, 'error')
      return
    }
    setFlags(next)
    showToast(next.share ? `Stage dates shared with ${gcName ?? 'the GC'} — offer a stage on Jobs → Subs → Work` : `Stage dates hidden from ${gcName ?? 'the GC'}`, 'success')
  }
  const row = (checked: boolean, label: string, hint: string, onChange: (v: boolean) => void) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8125rem', cursor: busy ? 'wait' : 'pointer' }}>
      <input type="checkbox" checked={checked} disabled={busy} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <span>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</span>
      </span>
    </label>
  )
  return (
    <div data-testid="gc-stage-switches" style={{ display: 'grid', gap: 6, marginTop: 8, padding: '0.5rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)' }}>
      {row(flags.share, `Share stage dates with ${gcName ?? 'this GC'}`, 'Off by default on every job. Nothing about stages reaches their portal until this is on and you press Offer to GC on a stage.', (v) => void save({ share: v, auto: v ? flags.auto : false }))}
      {flags.share ? row(flags.auto, 'Offer the next stage on its own when one passes inspection', 'Otherwise the dispatch inbox asks you each time.', (v) => void save({ share: true, auto: v })) : null}
    </div>
  )
}

export default JobGcStageSharingSwitches
