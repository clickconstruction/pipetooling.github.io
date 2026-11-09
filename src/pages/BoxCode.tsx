/**
 * Materials on site (punch list #209): the door a box label's code opens. `prts.co/b/7D759246` is the
 * short address printed on the label, forwarded here as `/b/7D759246`. Signed in, it finds the box by its
 * code and goes to its screen on the On site tab; a code no box carries says so and offers the tab. Signed
 * out (v2.6797, punch list #294) it is the box page: what is in the box with its counts and newest photo,
 * read through the `box-read` function, with Sign in to change a count coming back here with a session.
 * The route sits outside the Layout, so the sign-in gate never swallows a scan.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BoxPublicPage } from '../components/materials/BoxPublicPage'
import { useAuth } from '../hooks/useAuth'
import { boxCodeWords, normalizeBoxCode } from '../lib/materials/labels'
import { fetchContainerByCode } from '../lib/materials/onSiteStore'
import type { Container } from '../lib/materials/onSite'
import { formatErrorMessage } from '../utils/errorHandling'

export default function BoxCode() {
  const { code = '' } = useParams()
  const wanted = normalizeBoxCode(code)
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ padding: '1.5rem 1rem', maxWidth: 480, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Finding box {wanted ? boxCodeWords(wanted) : ''}…</p>
      </div>
    )
  }
  if (!user) return <BoxPublicPage code={wanted} />
  return <SignedInBox wanted={wanted} />
}

/** Signed in: the box's screen on the On site tab, as before the public page. */
function SignedInBox({ wanted }: { wanted: string }) {
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
  const words = wanted ? boxCodeWords(wanted) : ''
  return (
    // v2.6131: a flex item in Layout's column with auto side margins is sized by its content, so the page drew
    // narrower than the screen when its lines were short and moved as each load landed (v2.6117, Job Parts
    // Tally). Pin it to its container like `.pageWrap` (v2.1003); border-box is global, so the max width
    // is already the outer width and stays.
    <div style={{ padding: '1.5rem 1rem', maxWidth: 480, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: '0.75rem' }}>
      {found === 'looking' ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Finding box {words}…</p>
      ) : (
        <>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-strong)' }}>{error ? `Box ${words} did not open` : wanted ? `${words} is not a box on any job` : 'That is not a box code'}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{error ?? 'The label may be from a box that was retired. Open On site and find the box by its stencil.'}</p>
          <Link to="/tally?tab=on-site" style={{ fontWeight: 600 }}>Open On site</Link>
        </>
      )}
    </div>
  )
}
