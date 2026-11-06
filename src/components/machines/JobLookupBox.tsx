/** Spike #270: pick a job by its number or name, for a machine's hand-off or a check started from the label. */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import * as S from '../jobMode/sheetStyles'

export interface JobPick {
  id: string
  words: string
}

export function JobLookupBox({ onPick, placeholder = 'Job number or name' }: { onPick: (job: JobPick) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<JobPick[]>([])
  const [looking, setLooking] = useState(false)
  useEffect(() => {
    const t = text.trim()
    if (t.length < 2) {
      setRows([])
      return
    }
    let live = true
    setLooking(true)
    const h = window.setTimeout(() => {
      void supabase
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_name, job_address')
        .or(`hcp_number.ilike.%${t}%,click_number.ilike.%${t}%,job_name.ilike.%${t}%`)
        .limit(6)
        .then(({ data }) => {
          if (!live) return
          setLooking(false)
          setRows(
            (data ?? []).map((r) => ({
              id: r.id as string,
              words: `${(r.hcp_number as string | null) || (r.click_number as string | null) || '—'} · ${(r.job_name as string | null) || (r.job_address as string | null) || '—'}`,
            })),
          )
        })
    }, 250)
    return () => {
      live = false
      window.clearTimeout(h)
    }
  }, [text])
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} style={{ ...S.field, textAlign: 'left', fontWeight: 500, fontSize: '1rem' }} />
      {looking ? <p style={{ ...S.muted, margin: 0 }}>Looking…</p> : null}
      {rows.map((r) => (
        <button key={r.id} type="button" style={S.destBtn} onClick={() => onPick(r)}>
          <b>{r.words}</b>
        </button>
      ))}
    </div>
  )
}
