// @vitest-environment jsdom
/**
 * Render smoke for a filled builder (punch list #404, step 3): the sheet is the editor, a job's own words are marked
 * and listed with the way back, a draft is saved after the typing rests, a job's sheet is published over the usual's
 * published copy, the usual's publish goes to every job that is ready and names what it held, the read mark is a
 * press, and a refusal names its reason. The rules are held by `sheet.test.ts` and `sheetScreen.test.ts`; this holds
 * the wiring. Every name and amount here is made up.
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
import { INSURANCE_SHEET_FIXTURE } from '../../lib/documentBuilder/insuranceSheet.fixture'
import { coverPath, layOver, startJobSheet, withJobWords, type JobSheet, type SheetDef } from '../../lib/documentBuilder/sheet'
import type { GcJob, SheetRecord } from '../../lib/documentBuilder/sheetsIo'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { FilledBuilder, type FilledBuilderIo } from './FilledBuilder'

afterEach(cleanup)

const INSURANCE = documentBuilderById('insurance') as DocumentBuilderEntry
const USUAL: SheetDef = { ...INSURANCE_SHEET_FIXTURE, cover: INSURANCE_SHEET_FIXTURE.cover.map((c, i) => ({ ...c, limit: `Made-up amount ${i + 1}` })) }
const JOBS: GcJob[] = [
  { projectId: 'cedar', name: 'Cedar Park Medical Office', place: '410 Sample Street, Cedar Park, TX 78613', ownerName: 'Pecan Ridge Holdings, Ltd.', stage: 'building' },
  { projectId: 'mesa', name: 'Mesa Verde Retail Shell', place: '77 Placeholder Parkway, Round Rock, TX 78664', ownerName: '', stage: 'buyout' },
]
const CEDAR_OWN = (): JobSheet => startJobSheet({ name: JOBS[0]!.name, place: JOBS[0]!.place, insured: [JOBS[0]!.ownerName] })

const builder = (over: Record<string, unknown> = {}): BuilderRecord =>
  builderRecordFromRow({ key: 'insurance', kind: 'filled', draft: USUAL, published: USUAL, revision: 1, published_at: '2026-11-19T15:00:00Z', read_revision: null, read_by_name: '', read_on: null, updated_at: null, ...over }) as BuilderRecord

const sheetRow = (over: Partial<SheetRecord> = {}): SheetRecord => ({ id: 'sheet-cedar', projectId: 'cedar', draft: CEDAR_OWN(), published: CEDAR_OWN(), publishedSheet: layOver(USUAL, CEDAR_OWN()), revision: 1, usualRevision: 1, publishedAt: '2026-11-19T16:00:00Z', ...over })

type Mocks = { [K in keyof FilledBuilderIo]: ReturnType<typeof vi.fn> }

/** The link card reads no link in these tests: it has its own. */
const LINK = { read: vi.fn(async () => ({ ok: true as const, value: { on: false as const } })), make: vi.fn(), end: vi.fn(), copy: vi.fn(async () => true) }

function open(opts: { rec?: BuilderRecord; sheets?: SheetRecord[]; jobs?: GcJob[]; io?: Partial<FilledBuilderIo> } = {}) {
  let rec = opts.rec ?? builder()
  const io: Mocks = {
    readGcJobs: vi.fn(async () => opts.jobs ?? JOBS),
    readBuilderSheets: vi.fn(async () => new Map((opts.sheets ?? []).map((s) => [s.projectId, s]))),
    saveBuilderDraft: vi.fn(async (_key: string, draft: unknown) => ({ ok: true as const, value: { ...rec, draft } })),
    publishBuilder: vi.fn(async (_key: string, from: number, contents: unknown) => ({ ok: true as const, value: { ...rec, draft: contents, published: contents, revision: from + 1 } })),
    markBuilderRead: vi.fn(async (_key: string, revision: number, byName: string, on: string) => ({ ok: true as const, value: { ...rec, read: { revision, byName, on } } })),
    startSheet: vi.fn(async (_key: string, projectId: string, draft: JobSheet) => ({ ok: true as const, value: sheetRow({ id: `sheet-${projectId}`, projectId, draft, published: null, publishedSheet: null, revision: 0, usualRevision: null, publishedAt: null }) })),
    saveSheetDraft: vi.fn(async (id: string, draft: JobSheet) => ({ ok: true as const, value: sheetRow({ id, draft }) })),
    publishSheet: vi.fn(async (id: string, from: number, own: JobSheet, page: unknown, usualRevision: number) => ({ ok: true as const, value: sheetRow({ id, projectId: id.replace('sheet-', ''), draft: own, published: own, publishedSheet: page, revision: from + 1, usualRevision }) })),
    print: vi.fn(() => true),
    link: LINK as unknown as ReturnType<typeof vi.fn>,
    ...(opts.io as Partial<Mocks>),
  }
  const onBack = vi.fn()
  function Host() {
    return <FilledBuilder entry={INSURANCE} rec={rec} onBack={onBack} onRecord={(next) => { rec = next; view.rerender(<Host />) }} io={io as unknown as FilledBuilderIo} />
  }
  const view = renderWithProviders(<Host />)
  return { io, onBack }
}

/** Type over a field, as a person would. */
function type(label: string, words: string) {
  const field = screen.getByRole('textbox', { name: label })
  field.textContent = words
  fireEvent.input(field)
  return field
}
const publish = () => screen.getByRole('button', { name: /^(Publish|Nothing to publish)/ }) as HTMLButtonElement

describe('FilledBuilder', () => {
  it('opens on the first job, with its blanks filled from the job and nothing differing', async () => {
    open()
    expect(await screen.findByText('This job is on your usual sheet')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Job' }) as HTMLSelectElement).value).toBe('cedar')
    expect(screen.getByRole('option', { name: 'Cedar Park Medical Office, no sheet yet' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Additional insured, name 1' }).textContent).toBe('Pecan Ridge Holdings, Ltd.')
    expect(screen.getByRole('textbox', { name: 'The place' }).textContent).toBe('410 Sample Street, Cedar Park, TX 78613')
    expect(screen.getByRole('textbox', { name: 'The line under the title' }).textContent).toBe('For subcontractors on Cedar Park Medical Office')
    expect(screen.getByText('No sheet yet')).toBeTruthy()
    expect(screen.getByText('No sub sees a sheet for this job until you publish.')).toBeTruthy()
    expect(publish().textContent).toBe("Publish this job's sheet")
    expect(publish().disabled).toBe(false)
    expect(screen.getByText('Draft. Not published.')).toBeTruthy()
  })

  it('holds a job’s publish until the usual is published, and says so', async () => {
    open({ rec: builder({ published: null, revision: 0 }) })
    expect(await screen.findByText('Publish your usual sheet first.')).toBeTruthy()
    expect(publish().disabled).toBe(true)
  })

  it('marks a job’s own words, lists them with the usual’s, and takes them back', async () => {
    open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    const field = type('Umbrella, its amount', 'Made-up amount 9')
    expect(field.getAttribute('data-mark')).toBe('own')
    expect(screen.getByText('1 thing differs on this job')).toBeTruthy()
    expect(screen.getByText('Your usual: Made-up amount 5')).toBeTruthy()
    expect(screen.getByText('Changed. Subs see revision 1 until you publish.')).toBeTruthy()
    expect(screen.getByText('Revision 2, not yet published · Cedar Park Medical Office')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the usual for Umbrella, its amount' }))
    expect(screen.getByText('This job is on your usual sheet')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Umbrella, its amount' }).textContent).toBe('Made-up amount 5')
    expect(screen.getByRole('textbox', { name: 'Umbrella, its amount' }).getAttribute('data-mark')).toBe('usual')
  })

  it('saves a job’s draft a moment after the typing rests', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    expect(screen.getByText('Saving the draft…')).toBeTruthy()
    expect(io.saveSheetDraft).not.toHaveBeenCalled()
    await waitFor(() => expect(io.saveSheetDraft).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(io.saveSheetDraft).toHaveBeenCalledWith('sheet-cedar', withJobWords(USUAL, CEDAR_OWN(), coverPath('umb', 'limit'), 'Made-up amount 9'))
    expect(await screen.findByText('Draft saved')).toBeTruthy()
  })

  it('publishes a job with no row yet: the row is made, then the page goes out on the usual’s revision', async () => {
    const { io } = open()
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(publish())
    await waitFor(() => expect(io.publishSheet).toHaveBeenCalledTimes(1))
    expect(io.startSheet).toHaveBeenCalledWith('insurance', 'cedar', CEDAR_OWN())
    expect(io.publishSheet).toHaveBeenCalledWith('sheet-cedar', 0, CEDAR_OWN(), layOver(USUAL, CEDAR_OWN()), 1)
    expect(await screen.findByText('Published, revision 1')).toBeTruthy()
    expect(screen.getByText('Subs see what you see.')).toBeTruthy()
    expect(publish().textContent).toBe('Nothing to publish')
  })

  it('saves what was typed before it publishes, and publishes those words', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    fireEvent.click(publish())
    await waitFor(() => expect(io.publishSheet).toHaveBeenCalledTimes(1))
    const own = withJobWords(USUAL, CEDAR_OWN(), coverPath('umb', 'limit'), 'Made-up amount 9')
    expect(io.saveSheetDraft).toHaveBeenCalledWith('sheet-cedar', own)
    expect(io.publishSheet).toHaveBeenCalledWith('sheet-cedar', 1, own, layOver(USUAL, own), 1)
  })

  it('names the reason when a publish is refused', async () => {
    open({ sheets: [sheetRow({ published: null, publishedSheet: null, revision: 0, usualRevision: null })], io: { publishSheet: vi.fn(async () => ({ ok: false as const, error: 'Someone published this since you opened it. Read it again, then publish.' })) } })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(publish())
    expect((await screen.findByRole('alert')).textContent).toBe('Someone published this since you opened it. Read it again, then publish.')
  })

  it('makes a job’s own words the usual: the standing sheet’s draft takes them, and the job keeps its own', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    fireEvent.click(screen.getByRole('button', { name: 'Make this the usual for Umbrella, its amount' }))
    expect(screen.getByText('In your usual now. Publish the usual to send it to the other jobs.')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Umbrella, its amount' }).textContent).toBe('Made-up amount 9')
    await waitFor(() => expect(io.saveBuilderDraft).toHaveBeenCalledTimes(1), { timeout: 3000 })
    const saved = io.saveBuilderDraft.mock.calls[0]?.[1] as SheetDef
    expect(saved.cover.find((c) => c.key === 'umb')?.limit).toBe('Made-up amount 9')
  })

  it('leaves a usual line off one job, adds one for it, and puts each back', async () => {
    open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'Do not ask for Umbrella' }))
    expect(screen.queryByRole('textbox', { name: 'Umbrella, its amount' })).toBeNull()
    expect(screen.getByText('Not asked on this job.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add a coverage line for this job' }))
    expect(screen.getByText('2 things differ on this job')).toBeTruthy()
    expect(screen.getByText('An added coverage line has no name yet.')).toBeTruthy()
    expect(publish().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Put Umbrella back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take A coverage off' }))
    expect(screen.getByText('This job is on your usual sheet')).toBeTruthy()
  })

  it('edits the standing sheet for every job, and says where the change goes', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    expect(screen.getByText('You are changing your usual sheet. Every job starts on it.')).toBeTruthy()
    expect(screen.getByText('Every job is on your usual')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Job' }) as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText("The property's owner, from each job")).toBeTruthy()
    expect(publish().textContent).toBe('Nothing to publish')
    type('The line at the foot', 'A new foot line.')
    expect(screen.getByText('Where this change goes')).toBeTruthy()
    expect(screen.getByText('Gets it, as revision 2')).toBeTruthy()
    expect(screen.getByText('Held. It has no sheet yet.')).toBeTruthy()
    expect(publish().textContent).toBe('Publish to 1 job')
    fireEvent.click(publish())
    await waitFor(() => expect(io.publishSheet).toHaveBeenCalledTimes(1))
    const usual = { ...USUAL, fields: { ...USUAL.fields, foot: 'A new foot line.' } }
    expect(io.publishBuilder).toHaveBeenCalledWith('insurance', 1, usual)
    expect(io.publishSheet).toHaveBeenCalledWith('sheet-cedar', 1, CEDAR_OWN(), layOver(usual, CEDAR_OWN()), 2)
    expect(await screen.findByText('Published to 1 job. Held 1.')).toBeTruthy()
    expect(screen.getByText('Your usual, revision 2')).toBeTruthy()
  })

  it('keeps going past a job that fails, and names it with its reason', async () => {
    const second = sheetRow({ id: 'sheet-mesa', projectId: 'mesa', draft: startJobSheet({ name: JOBS[1]!.name, place: JOBS[1]!.place, insured: ['Mesa Verde Partners, LLC'] }), published: startJobSheet({ name: JOBS[1]!.name, place: JOBS[1]!.place, insured: ['Mesa Verde Partners, LLC'] }) })
    const publishSheet = vi.fn(async (id: string, from: number, own: JobSheet, page: unknown, usualRevision: number) =>
      id === 'sheet-cedar' ? { ok: false as const, error: "You don't have access to this record." } : { ok: true as const, value: sheetRow({ id, projectId: 'mesa', draft: own, published: own, publishedSheet: page, revision: from + 1, usualRevision }) },
    )
    open({ sheets: [sheetRow(), second], io: { publishSheet } })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    type('The line at the foot', 'A new foot line.')
    expect(publish().textContent).toBe('Publish to 2 jobs')
    fireEvent.click(publish())
    expect(await screen.findByText('Published to 1 job. 1 did not publish.')).toBeTruthy()
    expect(publishSheet).toHaveBeenCalledTimes(2)
    expect(screen.getByText('1 job did not publish. It stays here with the reason.')).toBeTruthy()
    expect(screen.getByText("Cedar Park Medical Office: You don't have access to this record.")).toBeTruthy()
  })

  it('will not publish a usual with an amount still to set, and says which', async () => {
    open({ rec: builder({ draft: INSURANCE_SHEET_FIXTURE, published: null, revision: 0 }) })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    expect(publish().textContent).toBe('Publish your usual')
    expect(publish().disabled).toBe(true)
    expect(screen.getByText('Commercial general liability has no amount yet.')).toBeTruthy()
  })

  it('marks the usual as checked by a named agent, on the published revision', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'Not checked by your insurance agent. Mark it checked' }))
    const mark = screen.getByRole('button', { name: 'Mark your usual, revision 1, as checked' }) as HTMLButtonElement
    expect(mark.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'The agent who checked your usual sheet' }), { target: { value: 'Jo Ferris' } })
    fireEvent.click(mark)
    await waitFor(() => expect(io.markBuilderRead).toHaveBeenCalledTimes(1))
    expect(io.markBuilderRead.mock.calls[0]?.slice(0, 3)).toEqual(['insurance', 1, 'Jo Ferris'])
    expect(io.markBuilderRead.mock.calls[0]?.[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await screen.findByText(/^Checked by Jo Ferris, /)).toBeTruthy()
  })

  it('reads as a sub sees it with the marks off: no field, no small press', async () => {
    open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('switch', { name: 'Marks are on' }))
    expect(screen.getByRole('switch', { name: 'Marks are off, as a sub sees it' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'The title' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a name' })).toBeNull()
    const page = document.querySelector('[data-sheet-paper]') as HTMLElement
    expect(within(page).getByText('INSURANCE REQUIREMENTS')).toBeTruthy()
    expect(page.getAttribute('data-theme')).toBe('light')
  })

  it('prints the page subs see, never the draft, and only once there is one', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    fireEvent.click(screen.getByRole('button', { name: 'Print the sheet' }))
    expect(io.print).toHaveBeenCalledTimes(1)
    const [html, filing] = io.print.mock.calls[0] as [string, { kind: string; title: string; source?: { table: string; id: string } }]
    expect(html).toContain('Made-up amount 5')
    expect(html).not.toContain('Made-up amount 9')
    expect(html).toContain('Revision 1 · Cedar Park Medical Office')
    expect(filing).toEqual({ kind: 'insurance_sheet', title: 'INSURANCE REQUIREMENTS For subcontractors on Cedar Park Medical Office', source: { table: 'document_builder_sheets', id: 'sheet-cedar' } })
    cleanup()
    open()
    expect(await screen.findByText("Publish this job's sheet first. It then prints as subs see it.")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Print the sheet' })).toBeNull()
  })

  it('says so with no job run as the GC, and still opens the standing sheet', async () => {
    open({ jobs: [] })
    expect(await screen.findByText(/^No job you run as the GC yet\. A job shows here/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    expect(screen.getByRole('textbox', { name: 'The title' })).toBeTruthy()
  })

  it('says why the jobs did not read, and reads again on Retry', async () => {
    const readGcJobs = vi.fn<() => Promise<GcJob[]>>().mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValue(JOBS)
    open({ io: { readGcJobs } })
    fireEvent.click(await screen.findByRole('button', { name: /retry/i }))
    expect(await screen.findByText('This job is on your usual sheet')).toBeTruthy()
    expect(readGcJobs).toHaveBeenCalledTimes(2)
  })

  it('never half draws a builder whose contents do not read as a sheet', async () => {
    open({ rec: builder({ draft: { fields: {} } }) })
    expect(await screen.findByRole('heading', { name: 'Insurance requirements for subs cannot be shown' })).toBeTruthy()
    expect(screen.getByText('The sheet has no list of opening lines.')).toBeTruthy()
  })
})
