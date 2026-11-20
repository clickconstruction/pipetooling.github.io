// @vitest-environment jsdom
/**
 * The Documents page's Document builder tab (punch list #404): the list of builders with where each stands, the press
 * that loads a first draft, the open builder on the address it names, the way back, and what the tab says when the
 * read fails or a builder's contents do not read as a paper. The flow's own wiring is held by
 * `DocumentBuilderFlow.render.test.tsx`. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'dev', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { loadFirstDraft, readDocumentBuilders } from '../../lib/documentBuilder/documentBuildersIo'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import DocumentsBuilderTab from './DocumentsBuilderTab'

afterEach(cleanup)

/** The address the tab is on, drawn beside it so a press can be read off the page. */
function Where() {
  const { search } = useLocation()
  return <div data-testid="where">{search}</div>
}

/** The Sub NDA as the table holds it. */
const subNda = (over: Record<string, unknown> = {}): BuilderRecord =>
  builderRecordFromRow({
    key: 'sub-nda',
    kind: 'walked',
    draft: JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)),
    published: null,
    revision: 0,
    published_at: null,
    read_revision: null,
    read_by_name: '',
    read_on: null,
    updated_at: '2026-11-19T15:00:00.000Z',
    ...over,
  }) as BuilderRecord

type Read = typeof readDocumentBuilders
type Load = typeof loadFirstDraft

const holding = (...recs: BuilderRecord[]): Read => vi.fn(async () => new Map(recs.map((r) => [r.key, r])))

function open(opts: { route?: string; read?: Read; load?: Load } = {}) {
  const read = opts.read ?? holding(subNda())
  const load: Load = opts.load ?? vi.fn(async () => ({ ok: false as const, error: 'Not handed in.' }))
  renderWithProviders(
    <>
      <DocumentsBuilderTab read={read} load={load} />
      <Where />
    </>,
    { route: opts.route ?? '/documents?tab=builder' },
  )
  return { read, load }
}

const where = () => screen.getByTestId('where').textContent

describe('DocumentsBuilderTab', () => {
  it('lists the Sub NDA with where it stands, and says the tab is a dev’s', async () => {
    open()
    expect(screen.getByText('Reading the builders…')).toBeTruthy()
    expect(await screen.findByRole('heading', { level: 2, name: 'Document builder' })).toBeTruthy()
    expect(screen.getByText('Dev only')).toBeTruthy()
    expect(screen.getByText('Sub NDA')).toBeTruthy()
    expect(screen.getByText("A job's secrecy paper for the people you bring onto it. Four levels, seven topics.")).toBeTruthy()
    expect(screen.getByText('Draft, not published')).toBeTruthy()
    expect(screen.getByText('Not read by an attorney')).toBeTruthy()
    expect(screen.queryByText('Step 1 of 11')).toBeNull()
  })

  it('says a published builder’s revision and who read it', async () => {
    const draft = JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE))
    open({ read: holding(subNda({ published: draft, revision: 2, read_revision: 2, read_by_name: 'Avery Stone', read_on: '2026-11-20' })) })
    expect(await screen.findByText('Published, revision 2')).toBeTruthy()
    expect(screen.getByText('Read by Avery Stone, Nov 20')).toBeTruthy()
    expect(screen.queryByText('Changes not published')).toBeNull()
  })

  it('offers Load the first draft for a builder with no row, and Open once it has landed', async () => {
    const load: Load = vi.fn(async (key) => ({ ok: true as const, value: subNda({ key }) }))
    open({ read: holding(), load })
    expect(await screen.findByText('Not loaded yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open Sub NDA' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Load the first draft of Sub NDA' }))
    expect(await screen.findByRole('button', { name: 'Open Sub NDA' })).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('sub-nda', 'walked', SECRECY_PAPER_FIXTURE)
    expect(screen.getByText('Draft, not published')).toBeTruthy()
  })

  it('names the reason when the first draft is refused, and keeps the press', async () => {
    const load: Load = vi.fn(async () => ({ ok: false as const, error: "You don't have access to this record." }))
    open({ read: holding(), load })
    fireEvent.click(await screen.findByRole('button', { name: 'Load the first draft of Sub NDA' }))
    expect((await screen.findByRole('alert')).textContent).toBe("You don't have access to this record.")
    expect(screen.getByRole('button', { name: 'Load the first draft of Sub NDA' })).toBeTruthy()
  })

  it('opens the Sub NDA on its own address, on the disclaimer, and goes back to the list', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Sub NDA' }))
    expect(where()).toBe('?tab=builder&builder=sub-nda')
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Before you start')
    expect(screen.getByText(/Nobody is asked to sign\./)).toBeTruthy()
    expect(screen.getByText('Not read by an attorney')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '‹ Document builder' }))
    expect(where()).toBe('?tab=builder')
    expect(screen.getByRole('button', { name: 'Open Sub NDA' })).toBeTruthy()
  })

  it('opens straight onto a builder the address names, and onto the list for a name it does not know', async () => {
    open({ route: '/documents?tab=builder&builder=sub-nda' })
    expect(await screen.findByText('Step 1 of 11')).toBeTruthy()
    cleanup()
    open({ route: '/documents?tab=builder&builder=nope' })
    expect(await screen.findByRole('button', { name: 'Open Sub NDA' })).toBeTruthy()
  })

  it('offers the first draft on the address of a builder with no row', async () => {
    const load: Load = vi.fn(async (key) => ({ ok: true as const, value: subNda({ key }) }))
    open({ route: '/documents?tab=builder&builder=sub-nda', read: holding(), load })
    expect(await screen.findByText('This builder has no contents yet. The first draft is placeholder words, for you to change.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Load the first draft of Sub NDA' }))
    expect(await screen.findByText('Step 1 of 11')).toBeTruthy()
  })

  it('walks the open flow over the draft the database holds: the box on the disclaimer opens the basis', async () => {
    open({ route: '/documents?tab=builder&builder=sub-nda' })
    expect(((await screen.findByRole('button', { name: 'Next: The basis' })) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'I have read this.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: The basis' }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('The basis')
  })

  it('never half draws a builder whose contents do not read as a paper: it lists what is wrong', async () => {
    const draft = JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as { topics: Array<{ levels: Record<string, unknown> }> }
    delete draft.topics[0]?.levels.mid
    open({ route: '/documents?tab=builder&builder=sub-nda', read: holding(subNda({ draft })) })
    expect(await screen.findByRole('heading', { level: 2, name: 'Sub NDA cannot be shown' })).toBeTruthy()
    expect(screen.getByText('Photos and video has no Aggressive level.')).toBeTruthy()
    expect(screen.queryByText('Step 1 of 11')).toBeNull()
    expect(screen.getByRole('button', { name: '‹ Document builder' })).toBeTruthy()
  })

  it('says why the builders did not read, and reads again on Retry', async () => {
    const lost = new Error('Failed to fetch')
    const read = vi.fn<Read>().mockRejectedValueOnce(lost).mockResolvedValue(new Map([['sub-nda', subNda()]]))
    open({ read })
    const retry = await screen.findByRole('button', { name: /retry/i })
    expect(screen.queryByRole('heading', { level: 2, name: 'Document builder' })).toBeNull()
    fireEvent.click(retry)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Sub NDA' })).toBeTruthy())
    expect(read).toHaveBeenCalledTimes(2)
  })
})
