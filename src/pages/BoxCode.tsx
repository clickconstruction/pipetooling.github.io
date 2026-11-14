/**
 * Materials on site (punch list #209): the door a box label's code opens. `prts.co/b/7D759246` is the
 * short address printed on the label, forwarded here as `/b/7D759246`. Signed in, it finds the box by its
 * code and goes to its screen on the On site tab; a code no box carries says so and offers the tab. Signed
 * out (v2.6797, punch list #294) it is the box page: what is in the box with its counts and newest photo,
 * read through the `box-read` function, with Sign in to record a use or a count coming back here with a session.
 * The route sits outside the Layout, so the sign-in gate never swallows a scan.
 *
 * Since v2.7072 (punch list #329) the code may be a sticker's: a printed code that points at a box, or at nothing yet.
 * One resolver answers both (`resolveBoxCode`, a sticker first). A sticker on a box goes to that box as a label does.
 * A blank one gets a plain page that says so; the sheet that puts it on a box is the train's PR 3. A lost one, one on a
 * retired box and one on a box of a job the reader is not on each say so.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BoxPublicPage } from '../components/materials/BoxPublicPage'
import { useAuth } from '../hooks/useAuth'
import { boxCodeWords, normalizeBoxCode } from '../lib/materials/labels'
import { resolveBoxCode } from '../lib/materials/onSiteStore'
import { blankStickerTitle, lostStickerDetail, lostStickerTitle, NO_BOX_DETAIL, noBoxTitle, outOfReachStickerTitle, retiredBoxStickerTitle, type CodeLookup } from '../lib/materials/stickers'
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

/** What the page says when the code is not a box to open: a heading and one line under it. */
function wordsFor(found: CodeLookup, words: string, wanted: string, error: string | null): { title: string; detail: string } {
  if (error) return { title: `Box ${words} did not open`, detail: error }
  switch (found.kind) {
    case 'blank':
      return { title: blankStickerTitle(found.sticker.number), detail: 'Nobody has said which box it is on.' }
    case 'lost':
      return { title: lostStickerTitle(found.sticker.number), detail: lostStickerDetail(found.sticker) }
    case 'retired':
      return { title: retiredBoxStickerTitle(found.sticker), detail: 'Open On site and bring the box back to use it.' }
    case 'out_of_reach':
      return { title: outOfReachStickerTitle(found.sticker.number), detail: 'Ask the office to add you to that job.' }
    default:
      return {
        title: wanted ? noBoxTitle(words) : 'That is not a box code',
        detail: wanted ? NO_BOX_DETAIL : 'Open On site and find the box by its stencil.',
      }
  }
}

/** Signed in: the box's screen on the On site tab, as before the public page; a sticker with no box to open says why. */
function SignedInBox({ wanted }: { wanted: string }) {
  const [found, setFound] = useState<CodeLookup | 'looking'>(wanted ? 'looking' : { kind: 'none' })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!wanted) return
    let live = true
    resolveBoxCode(wanted)
      .then((c) => { if (live) setFound(c) })
      .catch((e: unknown) => { if (live) { setFound({ kind: 'none' }); setError(formatErrorMessage(e, 'The box did not read.')) } })
    return () => { live = false }
  }, [wanted])
  if (found !== 'looking' && found.kind === 'box') return <Navigate to={`/tally?tab=on-site&job=${found.container.jobId}&container=${found.container.id}`} replace />
  const words = wanted ? boxCodeWords(wanted) : ''
  const said = found === 'looking' ? null : wordsFor(found, words, wanted, error)
  return (
    // v2.6131: a flex item in Layout's column with auto side margins is sized by its content, so the page drew
    // narrower than the screen when its lines were short and moved as each load landed (v2.6117, Job Parts
    // Tally). Pin it to its container like `.pageWrap` (v2.1003); border-box is global, so the max width
    // is already the outer width and stays.
    <div style={{ padding: '1.5rem 1rem', maxWidth: 480, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: '0.75rem' }}>
      {said === null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Finding box {words}…</p>
      ) : (
        <>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-strong)' }} data-testid="box-code-title" data-kind={error || found === 'looking' ? 'error' : found.kind}>{said.title}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }} data-testid="box-code-detail">{said.detail}</p>
          <Link to="/tally?tab=on-site" style={{ fontWeight: 600 }}>Open On site</Link>
        </>
      )}
    </div>
  )
}
