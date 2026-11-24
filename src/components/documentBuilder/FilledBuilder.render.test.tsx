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
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import { INSURANCE_SHEET_FIXTURE } from '../../lib/documentBuilder/insuranceSheet.fixture'
import { coverPath, layOver, startJobSheet, withJobWords, type JobSheet, type SheetDef } from '../../lib/documentBuilder/sheet'
import type { GcJob, SheetRecord } from '../../lib/documentBuilder/sheetsIo'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { FilledBuilder, type FilledBuilderIo } from './FilledBuilder'

afterEach(cleanup)

const INSURANCE = documentBuilderById('insurance') as DocumentBuilderEntry
const USUAL: SheetDef = { ...INSURANCE_SHEET_FIXTURE, cover: INSURANCE_SHEET_FIXTURE.cover.map((c, i) => ({ ...c, limit: `Made-up amount ${i + 1}` })) }
const JOBS: GcJob[] = [
  { projectId: 'cedar', name: 'Cedar Park Medical Office', place: '410 Sample Street, Cedar Park, TX 78613', ownerName: 'Pecan Ridge Holdings, Ltd.', stage: 'building', over: null, billingJobId: null },
  { projectId: 'mesa', name: 'Mesa Verde Retail Shell', place: '77 Placeholder Parkway, Round Rock, TX 78664', ownerName: '', stage: 'buyout', over: null, billingJobId: null },
]
const CEDAR_OWN = (): JobSheet => startJobSheet({ name: JOBS[0]!.name, place: JOBS[0]!.place, insured: [JOBS[0]!.ownerName] })

const builder = (over: Record<string, unknown> = {}): BuilderRecord =>
  builderRecordFromRow({ key: 'insurance', kind: 'filled', draft: USUAL, published: USUAL, revision: 1, published_at: '2026-11-19T15:00:00Z', read_revision: null, read_by_name: '', read_on: null, updated_at: null, ...over }) as BuilderRecord

const sheetRow = (over: Partial<SheetRecord> = {}): SheetRecord => ({ id: 'sheet-cedar', projectId: 'cedar', draft: CEDAR_OWN(), published: CEDAR_OWN(), publishedSheet: layOver(USUAL, CEDAR_OWN()), revision: 1, draftNo: 0, usualRevision: 1, publishedAt: '2026-11-19T16:00:00Z', ...over })

type Mocks = { [K in keyof FilledBuilderIo]: ReturnType<typeof vi.fn> }

/** The send list has no trade in these tests: it has its own. */
const SENDS = { readParties: vi.fn(async () => []), send: vi.fn(), takeOff: vi.fn(), turnPageOn: vi.fn() }
/** The certificate card reads no trade in these tests: it has its own. */
const CERTS = { readParties: vi.fn(async () => []), readCertificates: vi.fn(async () => []), markGood: vi.fn(), sendBack: vi.fn() }
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
    sends: SENDS as unknown as ReturnType<typeof vi.fn>,
    certificates: CERTS as unknown as ReturnType<typeof vi.fn>,
    ...(opts.io as Partial<Mocks>),
  }
  const onBack = vi.fn()
  const onRecord = vi.fn()
  let gone = false
  function Host() {
    return <FilledBuilder entry={INSURANCE} rec={rec} onBack={onBack} onRecord={(next) => { onRecord(next); rec = next; if (!gone) view.rerender(<Host />) }} io={io as unknown as FilledBuilderIo} />
  }
  const view = renderWithProviders(<Host />)
  /** Leave the builder, as the back press does: the tab above stays. */
  const leave = () => {
    gone = true
    view.unmount()
  }
  return { io, onBack, onRecord, leave }
}

/** Type over a field, as a person would. */
function type(label: string, words: string) {
  const field = screen.getByRole('textbox', { name: label })
  field.textContent = words
  fireEvent.input(field)
  return field
}
const publish = () => screen.getByRole('button', { name: /^(Publish|Nothing to publish)/ }) as HTMLButtonElement
/** Press the bar's publish, then the window's own press: a publish asks first. */
async function publishYes() {
  fireEvent.click(publish())
  const win = await screen.findByRole('alertdialog')
  fireEvent.click(within(win).getByRole('button', { name: /^Publish/ }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
}

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

  it('draws the marks’ legend on a light ground of its own, so *Your usual* reads on a dark card', async () => {
    open()
    await screen.findByText('This job is on your usual sheet')
    // The legend is pinned light and *Your usual* has no fill: without a ground its dark words sat on the dark card.
    const legend = screen.getByText('Your usual').parentElement as HTMLElement
    expect(legend.getAttribute('data-theme')).toBe('light')
    expect(legend.style.background).toBe('var(--surface)')
    expect(legend.style.color).toBe('var(--text-base)')
  })
  it('holds a job’s publish until the usual is published, and says so', async () => {
    open({ rec: builder({ published: null, revision: 0 }) })
    expect(await screen.findByText('Publish your usual sheet first.')).toBeTruthy()
    expect(publish().disabled).toBe(true)
    // A dead press opens no window.
    fireEvent.click(publish())
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks before a job’s publish, and publishes nothing on Not yet', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    fireEvent.click(publish())
    const win = await screen.findByRole('alertdialog')
    expect(within(win).getByText('Publish the sheet for Cedar Park Medical Office')).toBeTruthy()
    expect(within(win).getByText('Every sub you sent this sheet to sees revision 2 from now on. So does anyone with the link. A publish cannot be taken back. A later revision can only replace it.')).toBeTruthy()
    expect(within(win).getByRole('button', { name: 'Publish revision 2' })).toBeTruthy()
    expect(io.publishSheet).not.toHaveBeenCalled()
    fireEvent.click(within(win).getByRole('button', { name: 'Not yet' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.publishSheet).not.toHaveBeenCalled()
    expect(publish().textContent).toBe("Publish this job's sheet")
    expect(screen.getByRole('textbox', { name: 'Umbrella, its amount' }).textContent).toBe('Made-up amount 9')
  })

  it('asks before the usual’s publish with the jobs it goes to and the jobs held, and publishes nothing on Not yet', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    type('The line at the foot', 'A new foot line.')
    fireEvent.click(publish())
    const win = await screen.findByRole('alertdialog')
    expect(within(win).getByText('Publish your usual')).toBeTruthy()
    expect(within(win).getByText("Your usual becomes revision 2. 1 job gets it now, and each sub sent that sheet sees the change. 1 job is held. Each held job's row says why. A publish cannot be taken back. A later revision can only replace it.")).toBeTruthy()
    expect(within(win).getByRole('button', { name: 'Publish to 1 job' })).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: 'Not yet' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.publishBuilder).not.toHaveBeenCalled()
    expect(io.publishSheet).not.toHaveBeenCalled()
    expect(publish().textContent).toBe('Publish to 1 job')
    // The typed line is still saved as a draft, a moment after the typing rests.
    await waitFor(() => expect(io.saveBuilderDraft).toHaveBeenCalledTimes(1), { timeout: 3000 })
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
    expect(io.saveSheetDraft).toHaveBeenCalledWith('sheet-cedar', withJobWords(USUAL, CEDAR_OWN(), coverPath('umb', 'limit'), 'Made-up amount 9'), 0)
    expect(await screen.findByText('Draft saved')).toBeTruthy()
  })

  it('says a job’s draft did not save, with the reason, and holds that until a later save lands', async () => {
    const saveSheetDraft = vi.fn(async (id: string, draft: JobSheet): Promise<Landed<SheetRecord>> => ({ ok: true, value: sheetRow({ id, draft }) })).mockResolvedValueOnce({ ok: false, error: 'The draft did not save.' })
    open({ sheets: [sheetRow()], io: { saveSheetDraft } })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    expect((await screen.findByRole('alert', undefined, { timeout: 3000 })).textContent).toBe('The draft did not save.')
    expect(saveSheetDraft).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Draft saved')).toBeNull()
    expect(screen.getByText('Draft not saved')).toBeTruthy()

    // The next typing sends the draft again. The bar holds its words until that save lands.
    type('Umbrella, its amount', 'Made-up amount 10')
    expect(screen.getByText('Draft not saved')).toBeTruthy()
    expect(await screen.findByText('Draft saved', undefined, { timeout: 3000 })).toBeTruthy()
    expect(saveSheetDraft).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Draft not saved')).toBeNull()
  })

  it('says the usual’s draft did not save, with the reason', async () => {
    const saveBuilderDraft = vi.fn(async (): Promise<Landed<BuilderRecord>> => ({ ok: false, error: 'The draft did not save.' }))
    const { onRecord } = open({ sheets: [sheetRow()], io: { saveBuilderDraft } })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    type('The line at the foot', 'A new foot line.')
    expect((await screen.findByRole('alert', undefined, { timeout: 3000 })).textContent).toBe('The draft did not save.')
    expect(screen.queryByText('Draft saved')).toBeNull()
    expect(screen.getByText('Draft not saved')).toBeTruthy()
    expect(onRecord).not.toHaveBeenCalled()
  })

  it('hands up the usual’s save when it lands after the builder is left', async () => {
    let land: (res: Landed<BuilderRecord>) => void = () => {}
    const saveBuilderDraft = vi.fn(() => new Promise<Landed<BuilderRecord>>((resolve) => (land = resolve)))
    const { onRecord, leave } = open({ sheets: [sheetRow()], io: { saveBuilderDraft } })
    await screen.findByText('This job is on your usual sheet')
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    type('The line at the foot', 'A new foot line.')
    leave()
    await waitFor(() => expect(saveBuilderDraft).toHaveBeenCalledTimes(1))
    expect(onRecord).not.toHaveBeenCalled()
    const saved = builder({ draft: { ...USUAL, fields: { ...USUAL.fields, foot: 'A new foot line.' } } })
    land({ ok: true, value: saved })
    await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(1))
    expect(onRecord).toHaveBeenCalledWith(saved)
  })

  it('sends a draft that did not save again when the builder is left', async () => {
    const saveSheetDraft = vi.fn(async (id: string, draft: JobSheet): Promise<Landed<SheetRecord>> => ({ ok: true, value: sheetRow({ id, draft }) })).mockResolvedValueOnce({ ok: false, error: 'The draft did not save.' })
    const { leave } = open({ sheets: [sheetRow()], io: { saveSheetDraft } })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    await screen.findByRole('alert', undefined, { timeout: 3000 })
    expect(saveSheetDraft).toHaveBeenCalledTimes(1)
    leave()
    await waitFor(() => expect(saveSheetDraft).toHaveBeenCalledTimes(2))
    expect(saveSheetDraft).toHaveBeenLastCalledWith('sheet-cedar', withJobWords(USUAL, CEDAR_OWN(), coverPath('umb', 'limit'), 'Made-up amount 9'), 0)
  })

  it('publishes a job with no row yet: the row is made, then the page goes out on the usual’s revision', async () => {
    const { io } = open()
    await screen.findByText('This job is on your usual sheet')
    await publishYes()
    await waitFor(() => expect(io.publishSheet).toHaveBeenCalledTimes(1))
    expect(io.startSheet).toHaveBeenCalledWith('insurance', 'cedar', CEDAR_OWN())
    expect(io.publishSheet).toHaveBeenCalledWith('sheet-cedar', 0, CEDAR_OWN(), layOver(USUAL, CEDAR_OWN()), 1, 0)
    expect(await screen.findByText('Published, revision 1')).toBeTruthy()
    expect(screen.getByText('Subs see what you see.')).toBeTruthy()
    expect(publish().textContent).toBe('Nothing to publish')
  })

  it('saves what was typed before it publishes, and publishes those words', async () => {
    const { io } = open({ sheets: [sheetRow()] })
    await screen.findByText('This job is on your usual sheet')
    type('Umbrella, its amount', 'Made-up amount 9')
    await publishYes()
    await waitFor(() => expect(io.publishSheet).toHaveBeenCalledTimes(1))
    const own = withJobWords(USUAL, CEDAR_OWN(), coverPath('umb', 'limit'), 'Made-up amount 9')
    expect(io.saveSheetDraft).toHaveBeenCalledWith('sheet-cedar', own, 0)
    expect(io.publishSheet).toHaveBeenCalledWith('sheet-cedar', 1, own, layOver(USUAL, own), 1, 0)
  })

  it('names the reason when a publish is refused', async () => {
    open({ sheets: [sheetRow({ published: null, publishedSheet: null, revision: 0, usualRevision: null })], io: { publishSheet: vi.fn(async () => ({ ok: false as const, error: 'Someone published this since you opened it. Read it again, then publish.' })) } })
    await screen.findByText('This job is on your usual sheet')
    await publishYes()
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
    expect(screen.getByText('1 of 2 jobs is on your usual')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Job' }) as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText("The property's owner, from each job")).toBeTruthy()
    expect(publish().textContent).toBe('Nothing to publish')
    type('The line at the foot', 'A new foot line.')
    expect(screen.getByText('Where this change goes')).toBeTruthy()
    expect(screen.getByText('Gets it, as revision 2')).toBeTruthy()
    expect(screen.getByText('Held. It has no sheet yet.')).toBeTruthy()
    expect(publish().textContent).toBe('Publish to 1 job')
    await publishYes()
    await waitFor(() => expect(io.publishSheet).toHaveBeenCalledTimes(1))
    const usual = { ...USUAL, fields: { ...USUAL.fields, foot: 'A new foot line.' } }
    expect(io.publishBuilder).toHaveBeenCalledWith('insurance', 1, usual, 0)
    expect(io.publishSheet).toHaveBeenCalledWith('sheet-cedar', 1, CEDAR_OWN(), layOver(usual, CEDAR_OWN()), 2, 0)
    expect(await screen.findByText('Published to 1 job. Held 1.')).toBeTruthy()
    expect(screen.getByText('Your usual, revision 2')).toBeTruthy()
  })

  const mesaSheet = () => {
    const own = startJobSheet({ name: JOBS[1]!.name, place: JOBS[1]!.place, insured: ['Mesa Verde Partners, LLC'] })
    return sheetRow({ id: 'sheet-mesa', projectId: 'mesa', draft: own, published: own })
  }

  it('says every job is on the usual when every one is', async () => {
    open({ sheets: [sheetRow(), mesaSheet()] })
    fireEvent.click(await screen.findByRole('button', { name: 'The standing sheet' }))
    expect(screen.getByText('Every job is on your usual')).toBeTruthy()
  })

  it('counts the jobs on the usual, and marks a job a publish left behind', async () => {
    open({ rec: builder({ revision: 2 }), sheets: [sheetRow({ usualRevision: 2, revision: 2 }), mesaSheet()] })
    fireEvent.click(await screen.findByRole('button', { name: 'The standing sheet' }))
    expect(screen.getByText('1 of 2 jobs is on your usual')).toBeTruthy()
    expect(screen.getByText('Revision 1, behind your usual')).toBeTruthy()
    expect(screen.getByText('Revision 2')).toBeTruthy()
    expect(publish().textContent).toBe('Nothing to publish')
  })

  it('lists a job being bid, leaves out a lost or closed one, and keeps one whose sheet went out', async () => {
    const job = (projectId: string, name: string, over: GcJob['over'], stage = 'building'): GcJob => ({ projectId, name, place: 'A made-up place', ownerName: 'A made-up owner', stage, over, billingJobId: null })
    const jobs = [job('alder', 'Alder Row Shops', null, 'bidding'), job('birch', 'Birch Hall', 'lost', 'bidding'), job('cedar', JOBS[0]!.name, 'closed', 'closed'), job('dune', 'Dune Street Annex', 'closed', 'closed')]
    const { io, onRecord } = open({ jobs, sheets: [sheetRow()] })
    const pick = (await screen.findByRole('combobox', { name: 'Job' })) as HTMLSelectElement
    expect([...pick.options].map((o) => o.text)).toEqual(['Alder Row Shops, no sheet yet', 'Cedar Park Medical Office, closed'])
    fireEvent.click(screen.getByRole('button', { name: 'The standing sheet' }))
    expect(screen.getByText('Held. This job is closed.')).toBeTruthy()
    expect(screen.queryByText('Birch Hall')).toBeNull()
    type('The line at the foot', 'A new foot line.')
    expect(publish().textContent).toBe('Publish your usual')
    // The draft's save lands and is drawn before the test ends, so nothing is drawn after the screen is gone.
    await waitFor(() => expect(io.saveBuilderDraft).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(1))
  })

  it('files a printed sheet under the job its project bills through', async () => {
    const { io } = open({ jobs: [{ ...JOBS[0]!, billingJobId: 'job-cedar' }], sheets: [sheetRow()] })
    fireEvent.click(await screen.findByRole('button', { name: 'Print the sheet' }))
    expect((io.print.mock.calls[0] as [string, { jobIds?: string[] }])[1].jobIds).toEqual(['job-cedar'])
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
    await publishYes()
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

  it('asks for Send it anyway by the revision of the usual the job’s sheet went out on, not the usual’s newest', async () => {
    const trade = { id: 'cedarfork', name: 'Cedar Fork Drain', page: { state: 'on' as const }, contacts: [{ name: 'Ana Pruitt', email: 'ana@cedarfork.test' }], send: null }
    const sends = { ...SENDS, readParties: vi.fn(async () => [trade]) } as unknown as FilledBuilderIo['sends']
    const checked = { read_by_name: 'Jo Ferris', read_on: '2026-11-20' }
    // The job went out on revision 1, which nobody checked. The usual is now on revision 2, which was checked.
    open({ rec: builder({ revision: 2, read_revision: 2, ...checked }), sheets: [sheetRow({ usualRevision: 1 })], io: { sends } })
    expect(await screen.findByRole('checkbox', { name: "Your insurance agent has not checked revision 1 of your usual sheet. This job's sheet went out on that revision. Send it anyway." })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Send to 1 trade who is ready' }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    // The reverse: the job went out on the checked revision 1, and the usual has a newer revision nobody checked.
    open({ rec: builder({ revision: 2, read_revision: 1, ...checked }), sheets: [sheetRow({ usualRevision: 1 })], io: { sends } })
    expect(((await screen.findByRole('button', { name: 'Send to 1 trade who is ready' })) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole('checkbox', { name: /Send it anyway/ })).toBeNull()
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

  it('shows nothing of the last job’s link or trades while the next job’s are read', async () => {
    const mesaOwn = startJobSheet({ name: JOBS[1]!.name, place: JOBS[1]!.place, insured: ['Lone Oak Property Management'] })
    const never = new Promise<never>(() => {})
    const link = { ...LINK, read: vi.fn((_key: string, sheetId: string | null) => (sheetId === 'sheet-cedar' ? Promise.resolve({ ok: true as const, value: { on: true as const, code: 'abcdefghjkmnpqrs', madeAt: '2026-11-19T16:00:00Z', opened: 0, lastOpenedAt: null } }) : never)) }
    const cedarTrade = { id: 'co-1', name: 'Made-up Concrete Co', page: { state: 'on' as const }, contacts: [{ name: 'Dana Whitlock', email: 'dana@example.test' }], send: null }
    const sends = { ...SENDS, readParties: vi.fn((projectId: string) => (projectId === 'cedar' ? Promise.resolve([cedarTrade]) : never)) }
    open({
      sheets: [sheetRow(), sheetRow({ id: 'sheet-mesa', projectId: 'mesa', draft: mesaOwn, published: mesaOwn, publishedSheet: layOver(USUAL, mesaOwn) })],
      io: { link, sends } as unknown as Partial<FilledBuilderIo>,
    })
    expect((await screen.findByTestId('builder-link-url')).textContent).toContain('/d/abcdefghjkmnpqrs')
    expect(await screen.findByText('Made-up Concrete Co')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Job' }), { target: { value: 'mesa' } })
    // The other job's link must not sit here with Copy live, nor its trades with a send press.
    expect(screen.queryByTestId('builder-link-url')).toBeNull()
    expect(screen.getByText('Reading the link…')).toBeTruthy()
    expect(screen.queryByText('Made-up Concrete Co')).toBeNull()
    expect(screen.getByText("Reading this job's trades…")).toBeTruthy()
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
