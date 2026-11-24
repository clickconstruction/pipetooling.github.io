// @vitest-environment jsdom
/**
 * Render smoke for a filled builder whose row moved on somewhere else (punch list #404): a save or a publish refused
 * because a teammate or another tab changed the row is held, what was typed stays on the page, and the panel's two
 * presses settle it. The guard itself is held by `sheetsIo.test.ts` and the beds; this holds the wiring. Every name
 * and amount here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'dev', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { documentBuilderById, type DocumentBuilderEntry } from '../../lib/documentBuilder/builders'
import { MOVED_ON_PUBLISH, MOVED_ON_SAVE, type Landed } from '../../lib/documentBuilder/documentBuildersIo'
import { INSURANCE_SHEET_FIXTURE } from '../../lib/documentBuilder/insuranceSheet.fixture'
import { MOVED_ON_KEEP, MOVED_ON_LOAD } from '../../lib/documentBuilder/movedOn'
import { coverPath, fieldPath, layOver, startJobSheet, withJobWords, withUsualWords, type JobSheet, type SheetDef } from '../../lib/documentBuilder/sheet'
import type { GcJob, SheetRecord } from '../../lib/documentBuilder/sheetsIo'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { FilledBuilder, type FilledBuilderIo } from './FilledBuilder'

afterEach(cleanup)

const INSURANCE = documentBuilderById('insurance') as DocumentBuilderEntry
const USUAL: SheetDef = { ...INSURANCE_SHEET_FIXTURE, cover: INSURANCE_SHEET_FIXTURE.cover.map((c, i) => ({ ...c, limit: `Made-up amount ${i + 1}` })) }
const JOBS: GcJob[] = [{ projectId: 'cedar', name: 'Cedar Park Medical Office', place: '410 Sample Street, Cedar Park, TX 78613', ownerName: 'Pecan Ridge Holdings, Ltd.', stage: 'building', over: null, billingJobId: null }]
const CEDAR_OWN = (): JobSheet => startJobSheet({ name: JOBS[0]!.name, place: JOBS[0]!.place, insured: [JOBS[0]!.ownerName] })
const FOOT = 'The line at the foot'

const builder = (over: Record<string, unknown> = {}): BuilderRecord =>
  builderRecordFromRow({ key: 'insurance', kind: 'filled', draft: USUAL, published: USUAL, revision: 1, draft_no: 4, published_at: '2026-11-19T15:00:00Z', read_revision: null, read_by_name: '', read_on: null, updated_at: null, ...over }) as BuilderRecord
const sheetRow = (over: Partial<SheetRecord> = {}): SheetRecord => ({ id: 'sheet-cedar', projectId: 'cedar', draft: CEDAR_OWN(), published: CEDAR_OWN(), publishedSheet: layOver(USUAL, CEDAR_OWN()), revision: 1, draftNo: 2, usualRevision: 1, publishedAt: '2026-11-19T16:00:00Z', ...over })

/** What a teammate saved after this page read the usual, and after it read the job's sheet. */
const TEAMMATES_USUAL = withUsualWords(USUAL, fieldPath('foot'), 'A foot line a teammate typed.')
const newerUsual = (over: Record<string, unknown> = {}) => builder({ draft: TEAMMATES_USUAL, draft_no: 5, ...over })
const TEAMMATES_JOB: JobSheet = { ...CEDAR_OWN(), place: '414 Sample Street, Cedar Park, TX 78613' }
const newerSheet = () => sheetRow({ draft: TEAMMATES_JOB, draftNo: 3 })

const SENDS = { readParties: vi.fn(async () => []), send: vi.fn(), takeOff: vi.fn(), turnPageOn: vi.fn() }
const CERTS = { readParties: vi.fn(async () => []), readCertificates: vi.fn(async () => []), markGood: vi.fn(), sendBack: vi.fn() }
const LINK = { read: vi.fn(async () => ({ ok: true as const, value: { on: false as const } })), make: vi.fn(), end: vi.fn(), copy: vi.fn(async () => true) }

function open(over: Partial<FilledBuilderIo> = {}) {
  let rec = builder()
  const io = {
    readGcJobs: vi.fn(async () => JOBS),
    readBuilderSheets: vi.fn(async () => new Map([['cedar', sheetRow()]])),
    saveBuilderDraft: vi.fn(async (_key: string, draft: unknown, draftNo: number): Promise<Landed<BuilderRecord>> => ({ ok: true, value: builder({ draft, draft_no: draftNo + 1 }) })),
    publishBuilder: vi.fn(async (_key: string, from: number, contents: unknown, draftNo: number): Promise<Landed<BuilderRecord>> => ({ ok: true, value: builder({ draft: contents, published: contents, revision: from + 1, draft_no: draftNo + 1 }) })),
    markBuilderRead: vi.fn(),
    startSheet: vi.fn(),
    saveSheetDraft: vi.fn(async (id: string, draft: JobSheet, draftNo: number): Promise<Landed<SheetRecord>> => ({ ok: true, value: sheetRow({ id, draft, draftNo: draftNo + 1 }) })),
    publishSheet: vi.fn(async (id: string, from: number, own: JobSheet, page: unknown, usualRevision: number, draftNo: number): Promise<Landed<SheetRecord>> => ({ ok: true, value: sheetRow({ id, draft: own, published: own, publishedSheet: page, revision: from + 1, usualRevision, draftNo: draftNo + 1 }) })),
    print: vi.fn(() => true),
    link: LINK,
    sends: SENDS,
    certificates: CERTS,
    ...over,
  }
  const onRecord = vi.fn()
  function Host() {
    return <FilledBuilder entry={INSURANCE} rec={rec} onBack={vi.fn()} onRecord={(next) => { onRecord(next); rec = next; view.rerender(<Host />) }} io={io as unknown as FilledBuilderIo} />
  }
  const view = renderWithProviders(<Host />)
  return { io, onRecord }
}

function type(label: string, words: string) {
  const field = screen.getByRole('textbox', { name: label })
  field.textContent = words
  fireEvent.input(field)
}
const words = (label: string) => screen.getByRole('textbox', { name: label }).textContent
const publish = () => screen.getByRole('button', { name: /^(Publish|Nothing to publish)/ }) as HTMLButtonElement
/** Press the bar's publish, then the window's own press: a publish asks first. */
async function publishYes() {
  fireEvent.click(publish())
  const win = await screen.findByRole('alertdialog')
  fireEvent.click(within(win).getByRole('button', { name: /^Publish/ }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
}
const usualTitle = 'Your usual sheet changed somewhere else'
const jobTitle = 'The sheet for Cedar Park Medical Office changed somewhere else'

async function openOnUsual(over: Partial<FilledBuilderIo> = {}) {
  const opened = open(over)
  await screen.findByText('This job is on your usual sheet')
  fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
  return opened
}

describe('FilledBuilder, when the usual moved on somewhere else', () => {
  it('holds the refused save, keeps what was typed, names the number it read, and stops the publish', async () => {
    const saveBuilderDraft = vi.fn(async (): Promise<Landed<BuilderRecord>> => ({ ok: false, error: MOVED_ON_SAVE, movedOn: newerUsual() }))
    const { io } = await openOnUsual({ saveBuilderDraft })
    type(FOOT, 'A foot line typed on this page.')
    expect(await screen.findByText(usualTitle, undefined, { timeout: 3000 })).toBeTruthy()
    expect(saveBuilderDraft).toHaveBeenCalledWith('insurance', withUsualWords(USUAL, fieldPath('foot'), 'A foot line typed on this page.'), 4)
    expect(screen.getByText('A newer draft was saved after this page read it.')).toBeTruthy()
    // What was typed is still on the page, and the bar says it is not saved.
    expect(words(FOOT)).toBe('A foot line typed on this page.')
    expect(screen.getByText('Draft not saved')).toBeTruthy()
    // The publish waits for the choice.
    expect(publish().disabled).toBe(true)
    fireEvent.click(publish())
    expect(io.publishBuilder).not.toHaveBeenCalled()
    // More typing waits too: no save is sent while the choice is open.
    type(FOOT, 'A foot line typed on this page, again.')
    await new Promise((r) => setTimeout(r, 900))
    expect(saveBuilderDraft).toHaveBeenCalledTimes(1)
    expect(words(FOOT)).toBe('A foot line typed on this page, again.')
  })

  it('loads the newer one on the press: the teammate’s words replace what was typed, and nothing is saved over them', async () => {
    const saveBuilderDraft = vi.fn(async (): Promise<Landed<BuilderRecord>> => ({ ok: false, error: MOVED_ON_SAVE, movedOn: newerUsual() }))
    const { onRecord } = await openOnUsual({ saveBuilderDraft })
    type(FOOT, 'A foot line typed on this page.')
    await screen.findByText(usualTitle, undefined, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: MOVED_ON_LOAD }))
    expect(screen.queryByText(usualTitle)).toBeNull()
    await waitFor(() => expect(words(FOOT)).toBe('A foot line a teammate typed.'))
    expect(onRecord).toHaveBeenLastCalledWith(newerUsual())
    expect(screen.getByText('Draft saved')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 900))
    expect(saveBuilderDraft).toHaveBeenCalledTimes(1)
  })

  it('saves mine over it on the press, naming the number the newer draft is on', async () => {
    const saveBuilderDraft = vi
      .fn(async (_key: string, draft: unknown, draftNo: number): Promise<Landed<BuilderRecord>> => ({ ok: true, value: builder({ draft, draft_no: draftNo + 1 }) }))
      .mockResolvedValueOnce({ ok: false, error: MOVED_ON_SAVE, movedOn: newerUsual() })
    await openOnUsual({ saveBuilderDraft })
    type(FOOT, 'A foot line typed on this page.')
    await screen.findByText(usualTitle, undefined, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: MOVED_ON_KEEP }))
    await waitFor(() => expect(saveBuilderDraft).toHaveBeenCalledTimes(2))
    expect(saveBuilderDraft).toHaveBeenLastCalledWith('insurance', withUsualWords(USUAL, fieldPath('foot'), 'A foot line typed on this page.'), 5)
    expect(screen.queryByText(usualTitle)).toBeNull()
    expect(words(FOOT)).toBe('A foot line typed on this page.')
    expect(await screen.findByText('Draft saved')).toBeTruthy()
  })

  it('holds a publish that was refused because someone published first, and says which revision', async () => {
    const publishBuilder = vi.fn(async (): Promise<Landed<BuilderRecord>> => ({ ok: false, error: MOVED_ON_PUBLISH, movedOn: newerUsual({ published: TEAMMATES_USUAL, revision: 2, draft_no: 6 }) }))
    const { io } = await openOnUsual({ publishBuilder })
    type(FOOT, 'A foot line typed on this page.')
    await publishYes()
    expect(await screen.findByText(usualTitle, undefined, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText('Revision 2 was published after this page read it.')).toBeTruthy()
    expect(screen.getByText('Save mine over it drops the newer draft. Revision 2 stays published.')).toBeTruthy()
    // The draft was saved first, naming the number it read, and the publish named the number that save left.
    expect(publishBuilder).toHaveBeenCalledWith('insurance', 1, withUsualWords(USUAL, fieldPath('foot'), 'A foot line typed on this page.'), 5)
    expect(io.publishSheet).not.toHaveBeenCalled()
    expect(words(FOOT)).toBe('A foot line typed on this page.')
  })
})

describe('FilledBuilder, when a job’s sheet moved on somewhere else', () => {
  const typed = () => withJobWords(USUAL, CEDAR_OWN(), coverPath('umb', 'limit'), 'Made-up amount 9')

  it('holds the refused save and loads the teammate’s draft on the press', async () => {
    const saveSheetDraft = vi.fn(async (): Promise<Landed<SheetRecord>> => ({ ok: false, error: MOVED_ON_SAVE, movedOn: newerSheet() }))
    open({ saveSheetDraft })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    expect(await screen.findByText(jobTitle, undefined, { timeout: 3000 })).toBeTruthy()
    expect(saveSheetDraft).toHaveBeenCalledWith('sheet-cedar', typed(), 2)
    expect(words('Umbrella, its amount')).toBe('Made-up amount 9')
    expect(publish().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: MOVED_ON_LOAD }))
    await waitFor(() => expect(words('The place')).toBe('414 Sample Street, Cedar Park, TX 78613'))
    expect(words('Umbrella, its amount')).toBe('Made-up amount 5')
    expect(screen.queryByText(jobTitle)).toBeNull()
  })

  it('saves mine over it, naming the number the teammate’s draft is on', async () => {
    const saveSheetDraft = vi
      .fn(async (id: string, draft: JobSheet, draftNo: number): Promise<Landed<SheetRecord>> => ({ ok: true, value: sheetRow({ id, draft, draftNo: draftNo + 1 }) }))
      .mockResolvedValueOnce({ ok: false, error: MOVED_ON_SAVE, movedOn: newerSheet() })
    open({ saveSheetDraft })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    await screen.findByText(jobTitle, undefined, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: MOVED_ON_KEEP }))
    await waitFor(() => expect(saveSheetDraft).toHaveBeenCalledTimes(2))
    expect(saveSheetDraft).toHaveBeenLastCalledWith('sheet-cedar', typed(), 3)
    expect(words('Umbrella, its amount')).toBe('Made-up amount 9')
    expect(words('The place')).toBe('410 Sample Street, Cedar Park, TX 78613')
    expect(screen.queryByText(jobTitle)).toBeNull()
  })

  it('names the number each save left, so the next save of the same page lands', async () => {
    const { io } = open()
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    await waitFor(() => expect(io.saveSheetDraft).toHaveBeenCalledTimes(1), { timeout: 3000 })
    type('Umbrella, its amount', 'Made-up amount 10')
    await waitFor(() => expect(io.saveSheetDraft).toHaveBeenCalledTimes(2), { timeout: 3000 })
    expect(vi.mocked(io.saveSheetDraft).mock.calls.map((c) => c[2])).toEqual([2, 3])
  })
})

describe('FilledBuilder, the usual published to every job', () => {
  it('publishes nothing when a job changed since the page read it, shows the new count, and publishes on the next press', async () => {
    // The page loads with Cedar Park's sheet out and nothing waiting. A teammate then changes its place.
    const readBuilderSheets = vi
      .fn(async () => new Map([['cedar', newerSheet()]]))
      .mockResolvedValueOnce(new Map([['cedar', sheetRow()]]))
    const { io } = await openOnUsual({ readBuilderSheets })
    type(FOOT, 'A new foot line.')
    expect(publish().textContent).toBe('Publish to 1 job')
    await publishYes()
    // The press said one job. Read again, no job gets it, so the press does nothing and says why.
    expect(await screen.findByText('Nothing was published yet.', undefined, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText('A job changed since this page read it. The rows and the button now say where your usual goes. Press it again.')).toBeTruthy()
    expect(io.publishBuilder).not.toHaveBeenCalled()
    expect(io.publishSheet).not.toHaveBeenCalled()
    // The rows and the press are drawn again from what was just read.
    expect(screen.getByText('Held. It has changes of its own waiting.')).toBeTruthy()
    await waitFor(() => expect(publish().textContent).toBe('Publish your usual'))
    expect(publish().disabled).toBe(false)
    // The second press does what it now says: the usual, and no job.
    await publishYes()
    expect(await screen.findByText('Published your usual. Held 1.', undefined, { timeout: 3000 })).toBeTruthy()
    expect(io.publishBuilder).toHaveBeenCalledTimes(1)
    // The job's draft is never written from this page's old copy of it.
    expect(io.publishSheet).not.toHaveBeenCalled()
    // The page shows the job as the teammate left it.
    fireEvent.click(screen.getByRole('button', { name: 'This job' }))
    await waitFor(() => expect(words('The place')).toBe('414 Sample Street, Cedar Park, TX 78613'))
    expect(screen.getByText('Your usual changed since this sheet was published. Publish to bring it up.')).toBeTruthy()
  })

  it('goes ahead on the first press when the same jobs still get it, naming the number it just read', async () => {
    const readBuilderSheets = vi
      .fn(async () => new Map([['cedar', sheetRow({ draftNo: 9 })]]))
      .mockResolvedValueOnce(new Map([['cedar', sheetRow()]]))
    const { io } = await openOnUsual({ readBuilderSheets })
    type(FOOT, 'A new foot line.')
    await publishYes()
    expect(await screen.findByText('Published to 1 job.', undefined, { timeout: 3000 })).toBeTruthy()
    const usual = withUsualWords(USUAL, fieldPath('foot'), 'A new foot line.')
    expect(io.publishSheet).toHaveBeenCalledWith('sheet-cedar', 1, CEDAR_OWN(), layOver(usual, CEDAR_OWN()), 2, 9)
    // The jobs are read once at the load and once at the press, before anything is published.
    expect(readBuilderSheets).toHaveBeenCalledTimes(2)
  })

  it('publishes nothing when the jobs did not read, and says why', async () => {
    const readBuilderSheets = vi
      .fn(async (): Promise<Map<string, SheetRecord>> => Promise.reject(new Error('The network is down.')))
      .mockResolvedValueOnce(new Map([['cedar', sheetRow()]]))
    const { io } = await openOnUsual({ readBuilderSheets })
    type(FOOT, 'A new foot line.')
    await publishYes()
    expect((await screen.findByRole('alert', undefined, { timeout: 3000 })).textContent).toBe('The network is down. Nothing was published.')
    expect(io.publishBuilder).not.toHaveBeenCalled()
    expect(io.publishSheet).not.toHaveBeenCalled()
    // The press is live again, to try once the jobs read.
    expect(publish().disabled).toBe(false)
  })
})
