/**
 * Settings → My email schedule → "Jobs you watch" (v2.2932): the jobs whose
 * sub reports reach you by email, with what you hear and a way out. Reads
 * your own job_watchers rows (RLS lets everyone see their own); assigned
 * superintendents also hear progress and done by default without a row.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'

type Row = { id: string; job_id: string; hear_progress: boolean; hear_done: boolean; hear_dates: boolean; source: string; job: { hcp_number: string | null; customer_name: string | null; job_address: string | null } | { hcp_number: string | null; customer_name: string | null; job_address: string | null }[] | null }

export function SettingsJobWatchesSection({ userId }: { userId: string | undefined }) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<Row[] | null>(null)
  const load = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase.from('job_watchers').select('id, job_id, hear_progress, hear_done, hear_dates, source, job:job_id(hcp_number, customer_name, job_address)').eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
    if (error) {
      // The table lands with its migration — until then this block simply stays quiet.
      setRows([])
      return
    }
    setRows((data ?? []) as unknown as Row[])
  }, [userId])
  useEffect(() => {
    void load()
  }, [load])
  if (!rows || rows.length === 0) return null
  const jobOf = (r: Row) => (Array.isArray(r.job) ? r.job[0] ?? null : r.job)
  async function patch(r: Row, next: Partial<Pick<Row, 'hear_progress' | 'hear_done' | 'hear_dates'>>) {
    const { error } = await supabase.from('job_watchers').update(next).eq('id', r.id)
    if (error) showToast(`Could not save: ${formatErrorMessage(error)}`, 'error')
    await load()
  }
  async function stop(r: Row) {
    const { error } = r.source === 'assigned' ? await supabase.from('job_watchers').update({ hear_progress: false, hear_done: false, hear_dates: false }).eq('id', r.id) : await supabase.from('job_watchers').delete().eq('id', r.id)
    if (error) showToast(`Could not stop: ${formatErrorMessage(error)}`, 'error')
    await load()
  }
  return (
    <div data-testid="settings-job-watches" style={{ padding: '0.6rem 0.9rem 0.8rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Jobs you watch</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>An email as the sub reports — a percent, "done", their dates — at most one an hour per kind. Assigned superintendents hear progress and done on their jobs without a row here.</div>
      {rows.map((r) => {
        const j = jobOf(r)
        return (
          <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '0.3rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 600 }}>{j?.hcp_number ? `#${j.hcp_number}` : 'Job'}{j?.customer_name ? ` · ${j.customer_name}` : ''}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{j?.job_address ?? ''}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {(['progress', 'done', 'dates'] as const).map((k) => (
                <label key={k} style={{ display: 'inline-flex', gap: 3, alignItems: 'center', fontSize: '0.72rem' }}>
                  <input type="checkbox" checked={r[`hear_${k}`]} onChange={(e) => void patch(r, { [`hear_${k}`]: e.target.checked })} />
                  {k}
                </label>
              ))}
              <button type="button" onClick={() => void stop(r)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                Stop watching
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default SettingsJobWatchesSection
