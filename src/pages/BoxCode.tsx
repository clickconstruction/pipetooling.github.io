/**
 * Materials on site (punch list #209): the door a box label's code opens. `prts.co/b/7D759246` is the
 * short address printed on the label, forwarded here as `/b/7D759246`; it finds the box by its code and
 * goes to its screen on the On site tab. A code no box carries says so and offers the tab.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { normalizeBoxCode } from '../lib/materials/labels'
import { fetchContainerByCode } from '../lib/materials/onSiteStore'
import type { Container } from '../lib/materials/onSite'
import { formatErrorMessage } from '../utils/errorHandling'

export default function BoxCode() {
  const { code = '' } = useParams()
  const wanted = normalizeBoxCode(code)
  const [found, setFound] = useState<Container | null | 'looking'>(wanted ? 'looking' : null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!wanted) return
    let live = true
    fetchContainerByCode(wanted)
      .then((c) => { if (live) setFound(c) })
      .catch((e: unknown) => { if (live) { setFound(null); setError(formatErrorMessage(e, 'The box did not read.')) } })
    return () => { live = false }
  }, [wanted])
  if (found && found !== 'looking') return <Navigate to={`/tally?tab=on-site&job=${found.jobId}&container=${found.id}`} replace />
  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: 480, margin: '0 auto', display: 'grid', gap: '0.75rem' }}>
      {found === 'looking' ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Finding box {wanted}…</p>
      ) : (
        <>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-strong)' }}>{error ? `Box ${wanted} did not open` : wanted ? `${wanted} is not a box on any job` : 'That is not a box code'}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{error ?? 'The label may be from a box that was retired. Open On site and find the box by its stencil.'}</p>
          <Link to="/tally?tab=on-site" style={{ fontWeight: 600 }}>Open On site</Link>
        </>
      )}
    </div>
  )
}
