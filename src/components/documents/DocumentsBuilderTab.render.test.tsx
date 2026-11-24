// @vitest-environment jsdom
/**
 * The Documents page's Document builder tab (punch list #404): the list of builders with where each stands, the press
 * that loads a first draft, the open builder on the address it names, the way back, and what the tab says when the
 * read fails or a builder's contents are not shaped like a paper. A draft that breaks a rule of the paper still opens
 * in the editor. The flow's own wiring is held by
 * `DocumentBuilderFlow.render.test.tsx`. Every name here is made up.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'

/** The editor's save of a draft, so a smoke can let one land. Every other write is the real one over the stub. */
const { saveBuilderDraft } = vi.hoisted(() => ({ saveBuilderDraft: vi.fn() }))
vi.mock('../../lib/documentBuilder/sheetsIo', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/documentBuilder/sheetsIo')>()), saveBuilderDraft }))

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
import { INSURANCE_SHEET_FIXTURE } from '../../lib/documentBuilder/insuranceSheet.fixture'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'
import type { readSheetCounts } from '../../lib/documentBuilder/sheetsIo'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import DocumentsBuilderTab from './DocumentsBuilderTab'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  saveBuilderDraft.mockReset()
})

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
type ReadCounts = typeof readSheetCounts

/** The insurance sheet's builder as the table holds it: a filled builder, its usual published. */
const insurance = (over: Record<string, unknown> = {}): BuilderRecord =>
  builderRecordFromRow({
    key: 'insurance',
    kind: 'filled',
    draft: JSON.parse(JSON.stringify(INSURANCE_SHEET_FIXTURE)),
    published: JSON.parse(JSON.stringify(INSURANCE_SHEET_FIXTURE)),
    revision: 1,
    published_at: '2026-11-20T15:00:00.000Z',
    read_revision: null,
    read_by_name: '',
    read_on: null,
    updated_at: '2026-11-20T15:00:00.000Z',
    ...over,
  }) as BuilderRecord

const holding = (...recs: BuilderRecord[]): Read => vi.fn(async () => new Map(recs.map((r) => [r.key, r])))

function open(opts: { route?: string; read?: Read; load?: Load; readCounts?: ReadCounts } = {}) {
  const read = opts.read ?? holding(subNda())
  const load: Load = opts.load ?? vi.fn(async () => ({ ok: false as const, error: 'Not handed in.' }))
  renderWithProviders(
    <>
      <DocumentsBuilderTab read={read} load={load} readCounts={opts.readCounts} />
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
    expect(screen.getByText('Insurance requirements for subs')).toBeTruthy()
    expect(screen.getByText('What each sub must carry on a job you run as the GC. One sheet a job.')).toBeTruthy()
  })

  it('draws inside the one element the stylesheet makes every press 44 px tall in on a phone', async () => {
    open({ route: '/documents?tab=builder&builder=sub-nda' })
    const back = await screen.findByRole('button', { name: '‹ Document builder' })
    const tab = back.closest('.documentBuilderTab')
    expect(tab).not.toBeNull()
    // Every press of the open builder is inside it, and the step bar's dashes carry the class the rule leaves out.
    const presses = Array.from(document.querySelectorAll('button'))
    expect(presses.length).toBeGreaterThan(30)
    expect(presses.every((b) => tab?.contains(b))).toBe(true)
    expect(presses.filter((b) => b.classList.contains('documentBuilderStep'))).toHaveLength(11)
    // Their own heights are inline, 24 to 40 px, so the rule has to outrank an inline style.
    expect(back.style.minHeight).toBe('28px')

    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
    const rule = css.match(/@media \(max-width: 720px\) \{\n  \.documentBuilderTab button:not\(\.documentBuilderStep\),\n  \.documentBuilderTab select \{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('min-height: 44px !important')
  })

  it('says a published builder’s revision and who read it', async () => {
    const draft = JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE))
    open({ read: holding(subNda({ published: draft, revision: 2, read_revision: 2, read_by_name: 'Avery Stone', read_on: '2026-11-20' })) })
    expect(await screen.findByText('Published, revision 2')).toBeTruthy()
    expect(screen.getByText('Read by Avery Stone, Nov 20')).toBeTruthy()
    expect(screen.queryByText('Changes not published')).toBeNull()
  })

  it('says on the insurance row how many jobs have a sheet, once the jobs are read (punch list #416)', async () => {
    const readCounts: ReadCounts = vi.fn(async () => ({ jobs: 4, withSheet: 2 }))
    open({ read: holding(subNda(), insurance()), readCounts })
    expect(await screen.findByText('A sheet on 2 of 4 jobs')).toBeTruthy()
    expect(screen.getByText('Your usual, revision 1')).toBeTruthy()
    // One read, for the one filled builder that has a row. The Sub NDA's row counts no jobs.
    expect(readCounts).toHaveBeenCalledTimes(1)
    expect(readCounts).toHaveBeenCalledWith('insurance')
  })

  it('counts nothing for a builder with no row, and says so when no job is run as the GC', async () => {
    const none: ReadCounts = vi.fn(async () => ({ jobs: 0, withSheet: 0 }))
    open({ readCounts: none })
    expect(await screen.findByText('Not loaded yet')).toBeTruthy()
    expect(none).not.toHaveBeenCalled()
    cleanup()

    open({ read: holding(insurance()), readCounts: none })
    expect(await screen.findByText('No job you run as the GC yet')).toBeTruthy()
    expect(screen.queryByText(/A sheet on/)).toBeNull()
  })

  it('keeps the row and names the reason when the jobs do not read', async () => {
    open({ read: holding(insurance()), readCounts: vi.fn(async () => Promise.reject(new Error('permission denied for table gc_projects'))) })
    expect(await screen.findByText('Its jobs were not counted. permission denied for table gc_projects')).toBeTruthy()
    expect(screen.getByText('Your usual, revision 1')).toBeTruthy()
    expect(screen.queryByText(/A sheet on/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Open Insurance requirements for subs' })).toBeTruthy()
  })

  it('reads the count again on the way back from an open builder', async () => {
    let n = 0
    const readCounts: ReadCounts = vi.fn(async () => ({ jobs: 3, withSheet: (n += 1) }))
    open({ read: holding(subNda(), insurance()), readCounts })
    expect(await screen.findByText('A sheet on 1 of 3 jobs')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Sub NDA' }))
    fireEvent.click(await screen.findByRole('button', { name: '‹ Document builder' }))
    expect(await screen.findByText('A sheet on 2 of 3 jobs')).toBeTruthy()
  })

  it('offers Load the first draft for a builder with no row, and Open once it has landed', async () => {
    const load: Load = vi.fn(async (key) => ({ ok: true as const, value: subNda({ key }) }))
    open({ read: holding(), load })
    expect(await screen.findAllByText('Not loaded yet')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Open Sub NDA' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Load the first draft of Insurance requirements for subs' })).toBeTruthy()
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

  it('puts the send to GCs on the Sub NDA\u2019s Share side, under its link (step 9, punch list #416)', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Open Sub NDA' }))
    // Edit is where a builder opens: the map shows, and the send is not on show.
    expect(await screen.findByRole('table', { name: 'The map' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 3, name: 'Send it to a GC' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Send it to a GC' })).toBeTruthy()
    expect(screen.queryByRole('table', { name: 'The map' })).toBeNull()
    // The stub's database holds no job with a GC on it.
    expect(screen.getByText('No customer is the GC on a job yet. A GC shows here once a job names them as its GC.')).toBeTruthy()
  })

  it('keeps the side in the address: a press writes it, Back undoes it, and the list starts without one', async () => {
    open({ route: '/documents?tab=builder&builder=sub-nda' })
    expect(await screen.findByRole('table', { name: 'The map' })).toBeTruthy()
    expect(where()).toBe('?tab=builder&builder=sub-nda')
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(where()).toBe('?tab=builder&builder=sub-nda&side=share')
    expect(screen.getByRole('button', { name: 'Share' }).getAttribute('aria-pressed')).toBe('true')
    // Edit's address carries no key, so a builder's own address has one form.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(where()).toBe('?tab=builder&builder=sub-nda')
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    fireEvent.click(screen.getByRole('button', { name: '\u2039 Document builder' }))
    expect(where()).toBe('?tab=builder')
  })

  it('opens straight onto the Share side when the address names it', async () => {
    open({ route: '/documents?tab=builder&builder=sub-nda&side=share' })
    expect(await screen.findByRole('heading', { level: 3, name: 'Send it to a GC' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('table', { name: 'The map' })).toBeNull()
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

  it('never half draws a builder whose contents are not shaped like a paper: it lists what is wrong', async () => {
    const draft = JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as { notice?: unknown }
    delete draft.notice
    open({ route: '/documents?tab=builder&builder=sub-nda', read: holding(subNda({ draft })) })
    expect(await screen.findByRole('heading', { level: 2, name: 'Sub NDA cannot be shown' })).toBeTruthy()
    expect(screen.getByText('The paper has no notice.')).toBeTruthy()
    expect(screen.queryByText('Step 1 of 11')).toBeNull()
    expect(screen.getByRole('button', { name: '‹ Document builder' })).toBeTruthy()
    cleanup()
    open({ route: '/documents?tab=builder&builder=sub-nda', read: holding(subNda({ draft: {} })) })
    expect(await screen.findByRole('heading', { level: 2, name: 'Sub NDA cannot be shown' })).toBeTruthy()
    expect(screen.getByText('The paper has no words.')).toBeTruthy()
    expect(screen.queryByText('Step 1 of 11')).toBeNull()
  })

  it('opens a draft that breaks a rule of the paper in the editor, with the rule under the Publish press', async () => {
    const draft = JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as typeof SECRECY_PAPER_FIXTURE
    draft.notice.lines[0] = 'Use it (with care).'
    const std = draft.topics[0]?.levels.std
    if (!std) throw new Error('The made-up paper has no Standard level on its first topic.')
    std.says = ''
    std.breach = []
    open({ route: '/documents?tab=builder&builder=sub-nda', read: holding(subNda({ draft })) })
    expect(await screen.findByText('Step 1 of 11')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Sub NDA cannot be shown' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Publish revision 1' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('heading', { level: 3, name: 'Before this can be published' })).toBeTruthy()
    expect(screen.getByText('The disclaimer: glued (a dash, semicolon, parenthesis or · inside a sentence): Use it (with care).')).toBeTruthy()
    expect(screen.getByText('Photos and video at Standard does not say what it means.')).toBeTruthy()
    expect(screen.getByText('Photos and video at Standard has no breach line.')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'the disclaimer, line 1' }).textContent).toBe('Use it (with care).')
    // The page with no meaning and no breach line draws too, so the words can be typed back.
    fireEvent.click(screen.getByRole('button', { name: 'Photos and video, Standard' }))
    expect(screen.getByText('Step 4 of 11')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'What Photos and video at Standard means' }).textContent).toBe('')
    expect(screen.getByRole('button', { name: 'Add a breach line to Photos and video at Standard' })).toBeTruthy()
  })

  it('opens a draft whose topic has no row for a level, and names the level under the Publish press', async () => {
    const draft = JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as { topics: Array<{ levels: Record<string, unknown> }> }
    delete draft.topics[0]?.levels.mid
    open({ route: '/documents?tab=builder&builder=sub-nda', read: holding(subNda({ draft })) })
    expect(await screen.findByText('Step 1 of 11')).toBeTruthy()
    expect(screen.getByText('Photos and video has no Aggressive level.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Publish revision 1' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Photos and video, Aggressive' }))
    expect(screen.getByText('Step 4 of 11')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'What Photos and video at Aggressive means' }).textContent).toBe('')
  })

  it('keeps the editor open when a saved draft breaks a rule: a parenthesis typed into a line', async () => {
    saveBuilderDraft.mockImplementation(async (key: string, draft: unknown) => ({ ok: true as const, value: subNda({ key, draft }) }))
    open({ route: '/documents?tab=builder&builder=sub-nda' })
    const line = await screen.findByRole('textbox', { name: 'the disclaimer, line 1' })
    vi.useFakeTimers()
    line.textContent = 'Use it (with care).'
    fireEvent.input(line)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(saveBuilderDraft).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Draft saved')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Sub NDA cannot be shown' })).toBeNull()
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'the disclaimer, line 1' }).textContent).toBe('Use it (with care).')
    expect(screen.getByText('The disclaimer: glued (a dash, semicolon, parenthesis or · inside a sentence): Use it (with care).')).toBeTruthy()
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
