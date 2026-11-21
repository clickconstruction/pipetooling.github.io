/**
 * A builder on a GC's own page (punch list #404, step 9): the block for each builder the office sent them. One about
 * all their jobs sits at the top, and one about a job sits under that job's name. The block says what it is, with
 * *New* until they open it and *Changed since you opened it* after a newer revision, and one press opens the builder
 * right there to walk. A GC can look only: nothing they pick is sent.
 *
 * Opening it tells the office the day it was opened. A preview and the sample page tell nobody, and a signed-in
 * teammate's look is not counted by the function. The words and the placing are `lib/documentBuilder/customerPageBuilders.ts`.
 * Light always, as their page is.
 */
import { lazy, Suspense, useState } from 'react'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { customerBuilderWords, placeCustomerBuilders, type CustomerBuilder } from '../../lib/documentBuilder/customerPageBuilders'
import { WALKED_LINK_WORDS } from '../../lib/documentBuilder/linkPage'
import { CARD, HAIR, INK, MUTED, PAPER } from '../../lib/portal/portalTheme'
import { staffAwarePublicHeaders } from '../../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../../lib/publicViewCounting'
import { Chip } from '../gc/gcUi'

const DocumentBuilderFlow = lazy(() => import('../documentBuilder/DocumentBuilderFlow').then((m) => ({ default: m.DocumentBuilderFlow })))

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/document-builder-send`

/** Tell the office a builder was opened. Best effort: the page never waits on it or fails for it. */
function tellOpened(token: string, builderKey: string): void {
  void staffAwarePublicHeaders()
    .then((headers) => fetch(FUNCTION_URL, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'opened', portalToken: token, builderKey }) }))
    .catch(() => {})
}

function BuilderBlock({ builder, company, onOpened }: { builder: CustomerBuilder; company: string; onOpened: () => void }) {
  const [open, setOpen] = useState(false)
  const w = customerBuilderWords(builder, company)
  return (
    <div data-portal-builder={builder.builderKey} style={{ background: CARD, border: `1px solid ${INK}`, padding: '1rem 1.3rem', display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center' }}>
        <b style={{ fontSize: '1rem' }}>{w.title}</b>
        {w.chip ? (
          <Chip tone={w.chip.tone === 'changed' ? 'amber' : 'blue'} wrap>
            {w.chip.words}
          </Chip>
        ) : null}
      </div>
      <div style={{ fontSize: '0.92rem' }}>{w.says}</div>
      <div>
        <button
          type="button"
          onClick={() => {
            if (!open) onOpened()
            setOpen((was) => !was)
          }}
          style={{ border: `1px solid ${INK}`, background: open ? CARD : INK, color: open ? INK : PAPER, borderRadius: 6, padding: '10px 18px', fontFamily: 'inherit', fontSize: '0.92rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }}
        >
          {open ? w.close : w.open}
        </button>
      </div>
      <div style={{ fontSize: '0.8rem', color: MUTED }}>{w.fine}</div>
      {open ? (
        <Suspense fallback={<div style={{ fontSize: '0.85rem', color: MUTED }}>Opening the builder…</div>}>
          {/* Look only (step 8's flow): the last step has no press, so nothing on a GC's page reads as an ask to require the paper. */}
          <DocumentBuilderFlow def={builder.def} look={{ lastStep: WALKED_LINK_WORDS.lastStep }} style={{ height: 'min(780px, calc(100dvh - 96px))', minHeight: 420 }} />
        </Suspense>
      ) : null}
    </div>
  )
}

/**
 * Every builder on the page, placed. `jobOrder` is the order the page lists the jobs they are the GC on. Draws nothing
 * for a customer who was sent none.
 */
export function PortalBuilders({ builders, token, company, jobOrder = [] }: { builders: CustomerBuilder[]; token: string; company: string; jobOrder?: readonly string[] }) {
  // What this visit opened: the page is not read again after a press, so the block moves its own chip.
  const [openedNow, setOpenedNow] = useState<Record<string, true>>({})
  if (builders.length === 0) return null
  const quiet = !!sampleStateFromToken(token) || isPreviewFlag(new URLSearchParams(window.location.search).get(PUBLIC_PREVIEW_PARAM))
  const shown = builders.map((b) => (openedNow[b.sendId] ? { ...b, opened: true, changed: false } : b))
  const placed = placeCustomerBuilders(shown, jobOrder)
  const block = (b: CustomerBuilder) => (
    <BuilderBlock
      key={b.sendId}
      builder={b}
      company={company}
      onOpened={() => {
        if (openedNow[b.sendId]) return
        setOpenedNow((was) => ({ ...was, [b.sendId]: true }))
        if (!quiet) tellOpened(token, b.builderKey)
      }}
    />
  )
  return (
    <div data-screen-only data-portal-builders="" style={{ margin: '1.4rem 0 0', display: 'grid', gap: '0.8rem' }}>
      {placed.top.map(block)}
      {placed.byJob.map((job) => (
        <div key={job.jobId} data-portal-builder-job={job.jobId} style={{ display: 'grid', gap: '0.4rem' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, borderBottom: `1px solid ${HAIR}`, paddingBottom: 4 }}>{job.job}</div>
          {job.builders.map(block)}
        </div>
      ))}
    </div>
  )
}

export default PortalBuilders
