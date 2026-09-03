import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { derivePersonFileFreshness, type PersonFileFreshness } from '../../../lib/people/personFileFreshness'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { BTN, BTN_QUIET, Chip, DeskRow, DeskSection, LockTag, fmtDate } from '../personDeskShared'

/**
 * Records (PR 3): the HR file's freshness and pending reports (dev), write-ups
 * and attendance incidents, and the review door. Read-only pointers into the
 * surfaces that own the records.
 */
export function PersonDeskRecordsSection({ userId, personId, viewer, changeKey }: { userId: string | null; personId: string | null; viewer: PersonDeskViewer; changeKey: number }) {
  const [hr, setHr] = useState<{ freshness: PersonFileFreshness; pending: number } | null | undefined>(undefined)
  const [writeups, setWriteups] = useState<{ count: number; latest: string | null } | null>(null)
  const [incidents, setIncidents] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
      const [files, entries, reports, wu, inc] = await Promise.all([
        viewer.isDev && personId ? supabase.from('person_files').select('kind, updated_at, covered_through').eq('person_id', personId).eq('kind', 'summary').maybeSingle() : Promise.resolve({ data: null }),
        viewer.isDev && personId ? supabase.from('person_file_entries').select('created_at').eq('person_id', personId) : Promise.resolve({ data: [] }),
        viewer.isDev && personId ? supabase.from('person_reports').select('id', { count: 'exact', head: true }).eq('subject_person_id', personId).eq('status', 'pending') : Promise.resolve({ count: 0 }),
        viewer.canAccessContracts && userId ? supabase.from('writeups').select('id, created_at').eq('subject_user_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        viewer.canAccessContracts && userId ? supabase.from('attendance_incidents').select('id', { count: 'exact', head: true }).eq('subject_user_id', userId).gte('work_date', ninetyDaysAgo) : Promise.resolve({ count: 0 }),
      ])
      if (cancelled) return
      if (viewer.isDev && personId) {
        const summary = (files as { data: { updated_at: string | null; covered_through: string | null } | null }).data
        const created = (((entries as { data: Array<{ created_at: string }> | null }).data) ?? []).map((e) => e.created_at)
        setHr({
          freshness: derivePersonFileFreshness({ summaryUpdatedAt: summary?.updated_at ?? null, summaryCoveredThrough: summary?.covered_through ?? null, entryCreatedAts: created, nowIso: new Date().toISOString() }),
          pending: (reports as { count: number | null }).count ?? 0,
        })
      } else setHr(null)
      const wrows = (((wu as { data: Array<{ id: string; created_at: string }> | null }).data) ?? [])
      setWriteups({ count: wrows.length, latest: wrows[0]?.created_at ?? null })
      setIncidents((inc as { count: number | null }).count ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, personId, viewer.isDev, viewer.canAccessContracts, changeKey])

  return (
    <DeskSection title="Records" who={viewer.isDev ? undefined : 'HR file dev-only'} whoTone="dev">
      <DeskRow
        label="HR file"
        actions={
          viewer.isDev && personId ? (
            <a href={`/people?tab=hr&person=${personId}`} style={{ ...BTN_QUIET, textDecoration: 'none' }}>
              Open file
            </a>
          ) : viewer.isDev ? null : (
            <LockTag />
          )
        }
      >
        {!viewer.isDev ? (
          <span style={{ color: 'var(--text-muted)' }}>Kept by the dev</span>
        ) : !personId ? (
          <span style={{ color: 'var(--text-muted)' }}>Needs a roster row</span>
        ) : hr === undefined ? (
          <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
        ) : hr == null || hr.freshness.state === 'empty' ? (
          <span style={{ color: 'var(--text-muted)' }}>No file yet</span>
        ) : (
          <>
            <Chip tone={hr.freshness.state === 'current' ? 'green' : 'amber'}>{hr.freshness.state === 'current' ? 'Summary current' : `Summary ${hr.freshness.staleDays}d behind`}</Chip>
            <span>
              {hr.freshness.entryCount} entr{hr.freshness.entryCount === 1 ? 'y' : 'ies'}
            </span>
            {hr.pending > 0 ? <Chip tone="amber">{hr.pending} pending report{hr.pending === 1 ? '' : 's'}</Chip> : null}
          </>
        )}
      </DeskRow>
      {viewer.canAccessContracts ? (
        <DeskRow
          label="Write-ups"
          actions={
            userId ? (
              <a href="/people?tab=writeups" style={{ ...BTN, textDecoration: 'none' }}>
                Write-ups
              </a>
            ) : null
          }
        >
          {!userId ? (
            <span style={{ color: 'var(--text-muted)' }}>Needs a login</span>
          ) : writeups == null ? (
            <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
          ) : (
            <>
              <span>
                {writeups.count === 0 ? 'None' : `${writeups.count} · latest ${fmtDate(writeups.latest)}`}
              </span>
              {incidents != null ? (
                <span style={{ color: incidents > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
                  · {incidents} attendance incident{incidents === 1 ? '' : 's'} in 90 days
                </span>
              ) : null}
            </>
          )}
        </DeskRow>
      ) : null}
      {userId ? (
        <DeskRow
          label="Review"
          actions={
            <a href={`/prospects?tab=team&stage=review&rate=${userId}`} style={{ ...BTN_QUIET, textDecoration: 'none' }}>
              Rate
            </a>
          }
        >
          <span style={{ color: 'var(--text-muted)' }}>Team → Review holds their rating history</span>
        </DeskRow>
      ) : null}
    </DeskSection>
  )
}
