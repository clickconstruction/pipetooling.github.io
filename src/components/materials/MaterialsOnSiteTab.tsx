/**
 * Materials → On site (punch list #304): the cages and boxes on every job, on the page that prices
 * and buys the parts in them. One search finds a part or a box on any job. Under it the office gets
 * the Materials desk itself (`JobsMaterialsTab`, the component Jobs → Materials mounts), with a
 * row's Labels press and its door to the phone screen; an estimator, a primary and a superintendent
 * get their jobs with boxes as doors to the Tally's On site tab, where the presses are, with no
 * money drawn. The rows come from the on-site store's desk load, gated by `on_site_can_touch_job`.
 * A site's materials on one screen (punch list #330) is `?site=<development id>`: the office reaches
 * it through the desk's site row, a primary and a superintendent through the site row over their
 * jobs, with no money; an estimator gets no site row.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useOnSiteDeskJobs, type OnSiteDeskJobRow } from '../../hooks/useOnSiteDeskJobs'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { boxOnSiteLink } from '../../lib/materials/boxSearch'
import { onSiteJobHref } from '../../lib/materials/materialsGroups'
import { groupDeskBySite } from '../../lib/materials/siteRollup'
import { useOnSiteSites } from '../../hooks/useOnSiteSites'
import SiteMaterialsView from './SiteMaterialsView'
import { isMaterialsOfficeRole } from '../../lib/materials/materialsTabs'
import { countIsDue, lastCountedAt, lastCountWords } from '../../lib/materials/onSite'
import { findOnSite, findOnSiteWords, type OnSiteFindJob } from '../../lib/materials/onSiteFind'
import { listMovements } from '../../lib/materials/onSiteStore'
import { recoveryFailureFromError } from '../../lib/offlineRecoveryState'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import JobsMaterialsTab, { type MaterialsJob } from '../jobs/JobsMaterialsTab'

type Props = {
  active: boolean
  role: string | null
  userId: string | null
  userName: string
  /** A row's Labels press: the page opens the labels window on that job. */
  onLabels: (jobId: string) => void
}

const sec: CSSProperties = { background: 'var(--surface)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, overflowX: 'auto', overflowY: 'hidden', minWidth: 0 }
const th: CSSProperties = { textAlign: 'left', padding: '0.4rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.45rem 0.6rem', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '0 0.6rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }
const amber: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, borderWidth: 1, borderStyle: 'solid', whiteSpace: 'nowrap', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' }

/** How many of a job's live boxes are due a count. */
function dueBoxes(job: OnSiteFindJob, now: Date): number {
  const movements = listMovements(job.jobId)
  return job.containers.filter((c) => !c.retiredAt && c.kind !== 'unsorted' && countIsDue(lastCountedAt(movements, c.id), now)).length
}

export default function MaterialsOnSiteTab({ active, role, userId, userName, onLabels }: Props) {
  const office = isMaterialsOfficeRole(role)
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job')
  const siteId = params.get('site')
  const jobDetailModal = useJobDetailModal()
  const desk = useOnSiteDeskJobs(active)
  const [query, setQuery] = useState('')
  /** Every job, for the desk's Open a job list: the office starts a job's first container from here. */
  const [allJobs, setAllJobs] = useState<MaterialsJob[]>([])
  useEffect(() => {
    if (!active || !office) return
    let live = true
    void withSupabaseRetry(
      () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, google_drive_link').eq('billing_only', false).order('hcp_number', { ascending: false }),
      'load jobs for materials on site',
    )
      .then((data) => {
        if (live) setAllJobs((data ?? []) as MaterialsJob[])
      })
      .catch(() => {
        // The desk still names every job with a box (it reads those by id); only the Open a job list stays short.
      })
    return () => {
      live = false
    }
  }, [active, office])

  const withBoxes = desk.jobs.filter((j) => j.containers.some((c) => !c.retiredAt))
  // A site's screen for the field roles that run a site; an estimator reads no site here.
  const fieldSites = !office && role !== 'estimator'
  const sites = useOnSiteSites(withBoxes.map((j) => j.jobId), active && fieldSites && desk.loaded)

  if (!active) return null

  const now = new Date()
  const found = findOnSite(desk.jobs, query)
  const searching = query.trim() !== ''
  const siteGroups = fieldSites ? groupDeskBySite(withBoxes.map((j) => j.jobId), sites.siteOfJob, sites.siteNames).filter((g) => g.kind === 'site') : []
  const fieldSite = fieldSites && siteId ? siteGroups.find((g) => g.kind === 'site' && g.siteId === siteId) : undefined
  const setSite = (id: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('site', id)
      else next.delete('site')
      return next
    })
  // The office's job page and a site's screen have their own search; this one is the desk's, across jobs.
  const showSearch = !(office && (jobId || siteId)) && !fieldSite
  const deskJobs: MaterialsJob[] = allJobs.length ? allJobs : desk.rows.map((r: OnSiteDeskJobRow) => ({ id: r.id, hcp_number: r.hcp_number, job_name: r.job_name, job_address: r.job_address ?? null, google_drive_link: r.google_drive_link ?? null }))

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }} data-testid="materials-on-site-tab">
      {showSearch ? (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a part or a box on any job"
            aria-label="Find a part or a box on any job"
            style={{ flex: '1 1 260px', minWidth: 0, minHeight: 40, borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-strong)', font: 'inherit', padding: '0 1rem' }}
          />
          {searching && found.total > 0 ? <span style={muted}>{findOnSiteWords(found)}</span> : null}
        </div>
      ) : null}

      {!office || searching ? <OfflineRetryPanel failure={desk.error ? recoveryFailureFromError(desk.raw, 'The boxes did not load.') : null} onRetry={desk.retry} surface="materials-on-site-tab" idempotent /> : null}

      {showSearch && searching ? (
        <div style={sec}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={{ ...th, minWidth: 200 }}>Part</th><th style={th}>Box</th><th style={th}>Job</th><th style={{ ...th, ...num }}>On hand</th><th style={th}>Last counted</th><th style={th} aria-label="Door"></th></tr></thead>
            <tbody>
              {found.hits.length === 0 ? (
                <tr><td style={td} colSpan={6}>{desk.loading && !desk.loaded ? <span style={muted}>Loading the boxes…</span> : <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'parts on site', query: query.trim() }), { onPress: () => setQuery('') })} />}</td></tr>
              ) : found.hits.map((h) => {
                const last = lastCountedAt(listMovements(h.jobId), h.container.id)
                const due = h.container.kind !== 'unsorted' && countIsDue(last, now)
                return (
                  <tr key={`${h.container.id}:${h.line?.partKey ?? ''}`}>
                    <td style={td}>{h.line ? <>{h.line.partName}{h.line.manufacturer ? <span style={muted}> · {h.line.manufacturer}</span> : null}</> : <span style={muted}>the box itself</span>}</td>
                    <td style={td}><strong>{h.container.label}</strong> <span style={muted}>{h.container.kind === 'unsorted' ? 'delivered' : h.container.kind}{h.place ? ` · ${h.place}` : ''}{h.container.where ? ` · ${h.container.where}` : ''}</span></td>
                    <td style={td}>{h.jobLabel}</td>
                    <td style={{ ...td, ...num, fontWeight: 700 }}>{h.line ? h.line.onHand : ''}</td>
                    <td style={td}>{h.container.kind === 'unsorted' ? '' : due ? <span style={amber}>{lastCountWords(last, now)}</span> : <span style={muted}>{lastCountWords(last, now)}</span>}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {office
                        ? <Link to={onSiteJobHref(role, h.jobId)} style={door}>Open the job</Link>
                        : <Link to={boxOnSiteLink(h.jobId, h.container.id)} style={door}>Open the box</Link>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : fieldSite && fieldSite.kind === 'site' ? (
        <SiteMaterialsView
          site={{ id: fieldSite.siteId, name: fieldSite.name }}
          jobs={fieldSite.jobIds.map((id) => ({ id, label: withBoxes.find((j) => j.jobId === id)?.label ?? `job ${id.slice(0, 8)}` }))}
          showMoney={false}
          onBack={() => setSite(null)}
          backLabel="On site"
          boxHref={boxOnSiteLink}
          loading={desk.loading && !desk.loaded}
        />
      ) : office ? (
        <JobsMaterialsTab
          jobs={deskJobs}
          byUserId={userId}
          byName={userName}
          onOpenJobDetail={(id) => jobDetailModal?.openJobDetail({ jobId: id })}
          driveBackfill={false}
          rowDoors={{ onLabels }}
        />
      ) : (
        <div style={sec}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={{ ...th, minWidth: 220 }}>Your jobs with boxes</th><th style={{ ...th, ...num }}>Containers</th><th style={th}>Counts</th><th style={th} aria-label="Door"></th></tr></thead>
            <tbody>
              {withBoxes.length === 0 ? (
                <tr><td style={td} colSpan={4}>
                  {desk.loading && !desk.loaded
                    ? <span style={muted}>Loading the boxes…</span>
                    : <EmptyState compact main="No job you can open has a cage or a box yet." tail="The crew adds the first on the Tally’s On site tab." />}
                </td></tr>
              ) : [
                ...siteGroups.map((g) => {
                  if (g.kind !== 'site') return null
                  const members = withBoxes.filter((j) => g.jobIds.includes(j.jobId))
                  const due = members.reduce((n, j) => n + dueBoxes(j, now), 0)
                  return (
                    <tr key={`site:${g.siteId}`} data-site-row={g.siteId} style={{ background: 'var(--bg-subtle)' }}>
                      <td style={{ ...td, fontWeight: 800 }}>{g.name} <span style={{ ...muted, fontWeight: 400 }}>· the whole site, {members.length === 1 ? '1 job' : `${members.length} jobs`}</span></td>
                      <td style={{ ...td, ...num }}>{members.reduce((n, j) => n + j.containers.filter((c) => !c.retiredAt).length, 0)}</td>
                      <td style={td}>{due > 0 ? <span style={amber}>{due} due a count</span> : <span style={muted}>all counted this fortnight</span>}</td>
                      <td style={{ ...td, textAlign: 'right' }}><button type="button" style={{ ...door, cursor: 'pointer' }} onClick={() => setSite(g.siteId)}>Open the site</button></td>
                    </tr>
                  )
                }),
                ...withBoxes.map((j) => {
                const due = dueBoxes(j, now)
                return (
                  <tr key={j.jobId}>
                    <td style={{ ...td, fontWeight: 700 }}>{j.label}</td>
                    <td style={{ ...td, ...num }}>{j.containers.filter((c) => !c.retiredAt).length}</td>
                    <td style={td}>{due > 0 ? <span style={amber}>{due} due a count</span> : <span style={muted}>all counted this fortnight</span>}</td>
                    <td style={{ ...td, textAlign: 'right' }}><Link to={onSiteJobHref(role, j.jobId)} style={door}>Open the boxes</Link></td>
                  </tr>
                )
              }),
              ]}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
