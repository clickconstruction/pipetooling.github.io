/**
 * Materials on site (punch list #297, the finish line, v2.6927): the strip a job's screens draw while its box photos'
 * files are on their way to its Drive folder, after a combine or a move changed the photos' job. It shows the count
 * going down, names a held file with its reason and offers one press to try the held ones again. Nothing is drawn when
 * nothing is due. The words are `boxPhotoRefileStrip.ts`'s; the read and the ask are `boxPhotoRefileIo.ts`'s.
 */
import { useEffect, useSyncExternalStore, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useOnSiteStoreVersion } from '../../hooks/useOnSiteStore'
import { mayAskRefile, refileStripView } from '../../lib/materials/boxPhotoRefileStrip'
import { listPhotos } from '../../lib/materials/onSiteStore'
import { refileJobState, refileVersion, refreshRefileMarks, runBoxPhotoRefile, subscribeRefile } from '../../lib/materials/boxPhotoRefileIo'
import { formatErrorMessage } from '../../utils/errorHandling'

type Toast = (m: string, t: 'success' | 'info' | 'error') => void

/** How often the strip reads the marks again while files are moving: the sweep's work shows without a reload. */
const WATCH_MS = 10_000

const box: CSSProperties = { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', display: 'grid', gap: '0.3rem' }
const amber: CSSProperties = { ...box, background: 'var(--bg-amber-100)', borderColor: 'var(--text-amber-800)' }
const headStyle: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)' }
const subStyle: CSSProperties = { color: 'var(--text-700)', fontSize: '0.85rem' }
const press: CSSProperties = { justifySelf: 'start', minHeight: 36, padding: '0 0.8rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: '#2563eb', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }

export default function BoxPhotoRefileStrip({ jobId, onToast }: { jobId: string; onToast: Toast }) {
  useSyncExternalStore(subscribeRefile, refileVersion, refileVersion)
  useOnSiteStoreVersion()
  const { role } = useAuth()
  // The roles that may combine may ask; anyone else reads the strip and the sweep does the work.
  const canAsk = mayAskRefile(role)
  // How many of the job's box photos are filed in Drive, for the line that stands once only held files are left.
  const filedTotal = listPhotos(jobId).filter((p) => p.driveFileId).length || null
  const state = refileJobState(jobId)
  const view = refileStripView(state.marks, state.seenMost, filedTotal)
  const moving = view.kind === 'moving'

  useEffect(() => {
    void refreshRefileMarks(jobId)
  }, [jobId])

  useEffect(() => {
    if (!moving) return
    const timer = setInterval(() => void refreshRefileMarks(jobId), WATCH_MS)
    return () => clearInterval(timer)
  }, [jobId, moving])

  if (view.kind === 'none') return null

  const tryAgain = () => {
    runBoxPhotoRefile(jobId).catch((e: unknown) => onToast(formatErrorMessage(e, 'The photos’ files did not move.'), 'error'))
  }
  const heldList =
    view.held.length > 0 ? (
      <ul style={{ margin: '0.2rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-700)' }}>
        {view.held.map((h) => (
          <li key={h.id}>
            <strong style={{ color: 'var(--text-strong)' }}>{h.fileName}</strong>: {h.why}
          </li>
        ))}
      </ul>
    ) : null

  if (view.kind === 'moving') {
    return (
      <div role="status" data-testid="box-photo-refile-strip" style={box}>
        <div style={headStyle}>{view.head}</div>
        <div style={subStyle}>{view.sub}</div>
        {view.progress != null ? (
          <div aria-hidden style={{ height: 8, borderRadius: 999, background: 'var(--bg-200)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(view.progress * 100)}%`, background: '#2563eb', borderRadius: 999 }} />
          </div>
        ) : null}
        {heldList}
      </div>
    )
  }
  return (
    <div role="status" data-testid="box-photo-refile-strip" style={amber}>
      <div style={headStyle}>{view.head}</div>
      <div style={subStyle}>{view.sub}</div>
      {heldList}
      {canAsk ? (
        <button type="button" style={{ ...press, ...(state.asking ? { opacity: 0.45, cursor: 'default' } : {}) }} disabled={state.asking} onClick={tryAgain}>
          {state.asking ? 'Trying again…' : view.button}
        </button>
      ) : null}
    </div>
  )
}
