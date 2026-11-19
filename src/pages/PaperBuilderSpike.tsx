/**
 * The paper builder, a design spike (punch list #389): `/paper-builder`, open to a dev only. It walks the
 * step-by-step flow the owner asked for on 2026-11-19 over one made-up job, so he can steer it in the app before
 * anything is built for real. The flow is `components/paperBuilder/PaperFlow.tsx`, its rules are
 * `lib/paperBuilder/paperBuilder.ts` and its contents are `lib/paperBuilder/secrecyPaper.fixture.ts`.
 *
 * Nothing here reads or writes the database. No link in the app opens this page: the address is its only door.
 * Every name is made up, and no clause wording is shown.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { pageGate } from '../lib/roleGate'
import { PaperFlow } from '../components/paperBuilder/PaperFlow'
import { SECRECY_PAPER_FIXTURE } from '../lib/paperBuilder/secrecyPaper.fixture'
import type { PaperDef } from '../lib/paperBuilder/paperBuilder'

/**
 * The flow in a frame that ends at the bottom of the screen, so the slider and the Next press stay in reach while the
 * page above them scrolls. The frame's top is measured, since the bars above it differ by screen and by role. It is
 * never taller than the mock-up's 680 px and never shorter than 420 px.
 */
function FlowOnScreen({ def }: { def: PaperDef }) {
  const holder = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      if (holder.current) setTop(Math.round(holder.current.getBoundingClientRect().top + window.scrollY))
    }
    measure()
    window.addEventListener('resize', measure)
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    watch?.observe(document.body)
    return () => {
      window.removeEventListener('resize', measure)
      watch?.disconnect()
    }
  }, [])
  const room = top == null ? '680px' : `calc(100dvh - ${top}px - var(--app-bottom-chrome, 0px) - 12px)`
  return (
    <div ref={holder} style={{ minWidth: 0 }}>
      <PaperFlow def={def} style={{ height: `max(420px, min(680px, ${room}))` }} />
    </div>
  )
}

export default function PaperBuilderSpike() {
  const { user, role, loading } = useAuth()
  const gate = pageGate({ loading, user, role }, (r) => r === 'dev')
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />
  const def = SECRECY_PAPER_FIXTURE
  return (
    <div style={{ padding: '0.35rem 1rem 1.5rem', maxWidth: 492, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: 8 }}>
      <div>
        <h1 style={{ margin: '0.25rem 0 0.1rem', fontSize: '1.25rem', color: 'var(--text-strong)' }}>Paper builder</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>A spike on made-up data. Nothing is saved.</p>
      </div>
      <FlowOnScreen def={def} />
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        {`${def.title} on job ${def.job}, for ${def.protectedParty}. Every name is made up, and nobody is asked to sign. The disclaimer, the breach lines, the site lines and the meanings are placeholders. No clause wording is on this page.`}
      </p>
    </div>
  )
}
