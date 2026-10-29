/**
 * The Job window's Materials tab (punch list #209): the summary of what is on this job's site and
 * one press to Jobs → Materials, where the four sections live. The window is for one act, so the
 * sections stay on the page.
 */
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnSiteJob } from '../../hooks/useOnSiteStore'
import { REASON_WORDS } from '../../lib/materials/onSite'
import { listContainers, listMovements } from '../../lib/materials/onSiteStore'
import { jobMaterialsSummary, staleWords } from '../../lib/materials/onSiteSummary'

const chip = (tone: 'amber' | 'red' | 'green' | 'blue' | 'dim'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.05rem 0.5rem',
  borderRadius: 999,
  fontSize: '0.78rem',
  fontWeight: 600,
  borderWidth: 1,
  borderStyle: 'solid',
  ...(tone === 'amber' ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderColor: 'var(--text-amber-800)' } : tone === 'red' ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)', borderColor: 'var(--text-red-700)' } : tone === 'green' ? { background: 'var(--bg-green-100)', color: 'var(--text-green-700)', borderColor: 'var(--text-green-700)' } : tone === 'blue' ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderColor: 'var(--text-blue-700)' } : { color: 'var(--text-muted)', borderColor: 'var(--border)' }),
})

export default function JobWindowMaterialsPanel({ jobId, onBeforeNavigate }: { jobId: string; onBeforeNavigate?: () => void }) {
  const navigate = useNavigate()
  const load = useOnSiteJob(jobId)
  const containers = listContainers(jobId)
  const movements = listMovements(jobId)
  const sum = jobMaterialsSummary(containers, movements, new Date())
  const last = [...movements].sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null
  const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return (
    <div style={{ display: 'grid', gap: '0.75rem', padding: '0.5rem 0' }}>
      {!load.loaded ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{load.error ?? 'Loading…'}</p>
      ) : sum.containers === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nothing on this site yet. Open the materials page to add the containers, or a crew adds them from the tally.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={chip('dim')}>{sum.containers} {sum.containers === 1 ? 'container' : 'containers'}</span>
            <span style={chip('dim')}>{sum.onSiteLines} lines on site</span>
            {sum.stale.length ? <span style={chip('amber')}>{staleWords(sum.stale)}</span> : <span style={chip('green')}>counts fresh</span>}
            {sum.missingLines ? <span style={chip('red')}>{sum.missingLines} missing this week · {money(sum.missingMoneyWeek)}</span> : <span style={chip('green')}>nothing missing this week</span>}
            {sum.credits ? <span style={chip('blue')}>{sum.credits} credit{sum.credits === 1 ? '' : 's'} due</span> : null}
          </div>
          {last ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-700)' }}>
              Last movement {new Date(last.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}: {last.reason === 'counted' ? `${last.byName} counted ${last.partName} at ${last.quantity}` : `${last.byName} ${REASON_WORDS[last.reason].past.toLowerCase()} ${last.quantity} ${last.partName}`}.
            </p>
          ) : null}
        </>
      )}
      <button type="button" onClick={() => { onBeforeNavigate?.(); navigate(`/jobs?tab=materials&job=${jobId}`) }} style={{ justifySelf: 'start', minHeight: 40, padding: '0 0.9rem', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>
        Open the materials page
      </button>
    </div>
  )
}
