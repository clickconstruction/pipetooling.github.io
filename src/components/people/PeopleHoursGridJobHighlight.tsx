import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'

export type HoursGridJobHighlightPick = { id: string; hcp_number: string; click_number?: string; job_name: string }

type JobSearchResult = { id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }

export interface PeopleHoursGridJobHighlightProps {
  selectedJobHighlight: HoursGridJobHighlightPick | null
  setSelectedJobHighlight: (pick: HoursGridJobHighlightPick | null) => void
}

/** Hours grid "Highlight by job" search: debounced job lookup + selected-job chip. Owns its search state; emits the pick upward. */
export function PeopleHoursGridJobHighlight({
  selectedJobHighlight,
  setSelectedJobHighlight,
}: PeopleHoursGridJobHighlightProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<JobSearchResult[]>([])
  const [listOpen, setListOpen] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim()
      if (!q) {
        setResults([])
        return
      }
      void supabase.rpc('search_jobs_ledger', { search_text: q }).then(({ data }) => {
        setResults((data ?? []) as JobSearchResult[])
      })
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div
      style={{ marginBottom: '0.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.5rem' }}
      title="Highlights people whose crew row lists this job (assignments on that person’s row only, not crew-lead inheritance)."
    >
      <span style={{ fontSize: '0.875rem', color: 'var(--text-700)', fontWeight: 500, paddingTop: '0.35rem', flexShrink: 0 }}>Highlight by job</span>
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180, maxWidth: 400 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
            setListOpen(true)
          }}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => setListOpen(false), 175)
          }}
          placeholder="Search HCP, job name, address…"
          aria-label="Search job to highlight on hours grid"
          autoComplete="off"
          style={{
            width: '100%',
            padding: '0.35rem 0.5rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        />
        {listOpen && results.length > 0 ? (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 25,
              marginTop: 2,
              maxHeight: 220,
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            {results.map((j) => (
              <button
                key={j.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedJobHighlight({ id: j.id, hcp_number: j.hcp_number ?? '', click_number: j.click_number ?? '', job_name: j.job_name ?? '' })
                  setSearch('')
                  setResults([])
                  setListOpen(false)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.5rem 0.65rem',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <div style={{ fontWeight: 500 }}>
                  J{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · {j.job_name || '—'}
                </div>
                {j.job_address ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{j.job_address}</div>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {selectedJobHighlight ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.55rem',
            background: 'var(--bg-blue-tint)',
            border: '1px solid #93c5fd',
            borderRadius: 6,
            fontSize: '0.8125rem',
            maxWidth: '100%',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            J{effectiveJobLedgerNumber(selectedJobHighlight.hcp_number, selectedJobHighlight.click_number) || '—'} · {selectedJobHighlight.job_name || '—'}
          </span>
          <button
            type="button"
            aria-label="Clear job highlight"
            onClick={() => setSelectedJobHighlight(null)}
            style={{
              padding: '0 0.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-slate-500)',
              fontSize: '1.125rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ) : null}
    </div>
  )
}
