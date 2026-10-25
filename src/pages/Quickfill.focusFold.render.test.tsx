// @vitest-environment jsdom
/**
 * Render smoke for Focus's fold (punch list #147, v2.5830). A station at zero folds to one line
 * and its body stays mounted, hidden. Before v2.5830 the fold drew the body in another place in
 * the tree, so React remounted it on every fold: a body that loads its own count (Supply Houses,
 * People Hours) loaded again, reported loading, reopened, reported 0 and folded again, without
 * end — about 600 reads a second against prod from one tab.
 *
 * The wrapper is the page's own and the bucket is the kernel's. The body stands in for a station
 * that loads its own count on mount, and counts its mounts and its loads.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { installDomShims } from '../test/renderSmokeMocks'
import { QuickfillFocusContext } from '../components/quickfill/quickfillViewContext'
import { QuickfillSectionMetricsProvider, useQuickfillSectionMetricsContext, useReportQuickfillSectionMetric } from '../contexts/QuickfillSectionMetricsContext'
import { focusBucket } from '../lib/quickfill/views'
import { QuickfillSectionWrapper } from './Quickfill'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const body = { mounts: 0, loads: 0 }

/** A station body that loads its own count when it mounts, as Supply Houses and People Hours do. */
function SelfCountingBody({ count }: { count: number }) {
  const [loaded, setLoaded] = useState<number | null>(null)
  useEffect(() => {
    body.mounts += 1
    let live = true
    void Promise.resolve().then(() => {
      body.loads += 1
      if (live) setLoaded(count)
    })
    return () => {
      live = false
    }
  }, [count])
  useReportQuickfillSectionMetric('supply-houses', loaded, loaded === null)
  return <p>Supply Houses body</p>
}

/**
 * The page's `focusBucketOf` for one station that is not marked and not a door. No last count
 * is passed, so the wrapper alone has to keep the body: the kernel's hold is `views.test.ts`'s.
 */
function FocusDesk({ forced, children }: { forced: boolean; children: ReactNode }) {
  const { metrics } = useQuickfillSectionMetricsContext()
  const bucketOf = (sectionId: string) =>
    focusBucket({ count: metrics[sectionId]?.count ?? null, lastCount: null, loading: metrics[sectionId]?.loading ?? false, collapsed: false, personal: false, forced })
  return <QuickfillFocusContext.Provider value={bucketOf}>{children}</QuickfillFocusContext.Provider>
}

function station(count: number, forced = false) {
  return (
    <MemoryRouter>
      <QuickfillSectionMetricsProvider>
        <FocusDesk forced={forced}>
          <QuickfillSectionWrapper id="quickfill-supply-houses" sectionId="supply-houses" label="Supply Houses" withTopDivider={false} color="green" collapsed={false} mark={undefined} onMarkUpToDate={() => undefined} onOpenNow={() => undefined} onOpenHistory={() => undefined}>
            <SelfCountingBody count={count} />
          </QuickfillSectionWrapper>
        </FocusDesk>
      </QuickfillSectionMetricsProvider>
    </MemoryRouter>
  )
}

/** Long enough for a fold loop to spin many times over: each turn is a few microtasks. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

describe("Focus's fold keeps a station's body mounted (v2.5830)", () => {
  beforeEach(() => {
    installDomShims()
    body.mounts = 0
    body.loads = 0
  })
  afterEach(() => cleanup())

  it('folds a station at zero to one line and loads its body once', async () => {
    render(station(0))
    await settle()
    expect(await screen.findByText('0 open')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open now' })).toBeTruthy()
    expect(screen.getByText('Supply Houses body').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(body.mounts).toBe(1)
    expect(body.loads).toBe(1)
  })

  it('opens the same body on Open now, without loading it again', async () => {
    const view = render(station(0))
    await settle()
    expect(await screen.findByText('0 open')).toBeTruthy()
    view.rerender(station(0, true))
    await settle()
    expect(screen.queryByRole('button', { name: 'Open now' })).toBeNull()
    expect(screen.getByText('Supply Houses body').closest('[aria-hidden="true"]')).toBeNull()
    expect(body.mounts).toBe(1)
    expect(body.loads).toBe(1)
  })

  it('keeps a station with work open with its body loaded once', async () => {
    render(station(3))
    await settle()
    expect(await screen.findByText('3 open')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open now' })).toBeNull()
    expect(body.mounts).toBe(1)
    expect(body.loads).toBe(1)
  })
})
