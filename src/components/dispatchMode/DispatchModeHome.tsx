import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import ClockInOutButton from '../ClockInOutButton'
import { useAuth } from '../../hooks/useAuth'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import {
  fetchJobsLedgerWithDetailsForStages,
} from '../../lib/fetchJobsLedgerWithDetailsForStages'
import { buildJobsStagesBoardLists } from '../../lib/jobsStagesBoard'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobWithDetails } from '../../types/jobWithDetails'

type StageGroup = {
  key: string
  label: string
  jobs: JobWithDetails[]
}

const groupHeaderBtn: CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 8,
  padding: '0.6rem 0.75rem',
  border: 'none',
  background: 'var(--bg-subtle)',
  cursor: 'pointer',
  fontSize: '0.9375rem',
  fontWeight: 700,
  color: 'var(--text-strong)',
  textAlign: 'left',
}

/** Dispatch Mode → Dashboard tab: clock in/out on top, compact Stages list below. */
export default function DispatchModeHome() {
  const { user: authUser, profileName } = useAuth()
  const jobDetailModal = useJobDetailModal()

  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Waiting is usually the longest and least actionable group — start it closed.
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => new Set(['waiting']))

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchJobsLedgerWithDetailsForStages({ statusScope: 'non_paid' })
    if (res.ok) setJobs(res.jobs)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const groups = useMemo((): StageGroup[] => {
    const lists = buildJobsStagesBoardLists(jobs, '')
    return [
      { key: 'waiting', label: 'Waiting', jobs: lists.waiting },
      { key: 'working', label: 'Working', jobs: lists.working },
      { key: 'ready_to_bill', label: 'Ready to bill', jobs: lists.readyToBillJobs },
      { key: 'billed', label: 'Billed awaiting payment', jobs: lists.billedActiveJobs },
      { key: 'collections', label: 'Collections', jobs: lists.collectionsJobs },
    ].filter((g) => g.jobs.length > 0)
  }, [jobs])

  const toggleStage = (key: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {authUser?.id ? (
        <ClockInOutButton userId={authUser.id} userName={profileName ?? null} />
      ) : null}

      <section aria-label="Job stages">
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--text-strong)' }}>
          Job Stages
        </h2>
        {loading ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading jobs…</p>
        ) : error ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>{error}</p>
        ) : groups.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No open jobs.</p>
        ) : (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {groups.map((g) => {
              const collapsed = collapsedStages.has(g.key)
              return (
                <div key={g.key}>
                  <button
                    type="button"
                    style={groupHeaderBtn}
                    aria-expanded={!collapsed}
                    onClick={() => toggleStage(g.key)}
                  >
                    <span aria-hidden="true" style={{ fontSize: '0.7rem' }}>
                      {collapsed ? '▶' : '▼'}
                    </span>
                    {g.label}
                    <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {g.jobs.length}
                    </span>
                  </button>
                  {!collapsed
                    ? g.jobs.map((j) => {
                        const num = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
                        const name = (j.job_name ?? '').trim() || 'Job'
                        const pill = buildServiceTypeTradePill(j.serviceType?.name)
                        return (
                          <button
                            key={j.id}
                            type="button"
                            onClick={() => jobDetailModal?.openJobDetail({ jobId: j.id })}
                            aria-label={`Open job detail for ${num} · ${name}`}
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'center',
                              gap: 8,
                              padding: '0.55rem 0.75rem',
                              border: 'none',
                              borderTop: '1px solid var(--border)',
                              background: 'var(--surface)',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: 'var(--text-strong)',
                              textAlign: 'left',
                              minWidth: 0,
                            }}
                          >
                            {pill ? (
                              <span aria-label={`Service type ${pill.label}`} style={{ ...pill.style, marginTop: 0, flexShrink: 0 }}>
                                {pill.label}
                              </span>
                            ) : null}
                            <span style={{ fontWeight: 600, flexShrink: 0 }}>{num}</span>
                            <span
                              style={{
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {name}
                            </span>
                          </button>
                        )
                      })
                    : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
