/**
 * The guard on every save and publish of a builder and of a job's sheet (punch list #404): a write names the draft's
 * number its page read, and lands on no row when the row moved on. The client here is a stand-in that keeps rows the
 * way the database does: a row's number goes up with its draft and with its revision, whatever a write sent, and a
 * read mark does not move it. The database's own rules are held by the beds `document-builders` and
 * `document-builder-sheets`. Every name and word here is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  type Row = Record<string, unknown>
  const tables: Record<string, Row[]> = { document_builders: [], document_builder_sheets: [] }
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const from = (table: string) => {
    let op: 'select' | 'update' | 'insert' = 'select'
    let sent: Row = {}
    const filters: Array<[string, unknown]> = []
    const run = (): { data: unknown; error: unknown } => {
      const rows = tables[table] as Row[]
      if (op === 'insert') {
        if (rows.some((r) => r.builder_key === sent.builder_key && r.project_id === sent.project_id)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "document_builder_sheets_one_a_job"' } }
        const row: Row = { ...sent, id: `sheet-${rows.length + 1}`, published: null, published_sheet: null, revision: 0, usual_revision: null, draft_no: 0 }
        rows.push(row)
        return { data: [{ ...row }], error: null }
      }
      const hit = rows.filter((r) => filters.every(([col, value]) => r[col] === value))
      if (op === 'update') {
        for (const r of hit) {
          const moved = ('draft' in sent && !same(sent.draft, r.draft)) || ('revision' in sent && sent.revision !== r.revision)
          Object.assign(r, sent, { draft_no: (r.draft_no as number) + (moved ? 1 : 0) })
        }
      }
      return { data: hit.map((r) => ({ ...r })), error: null }
    }
    const query = {
      select: () => query,
      update: (patch: Row) => {
        op = 'update'
        sent = patch
        return query
      },
      insert: (row: Row) => {
        op = 'insert'
        sent = row
        return query
      },
      eq: (col: string, value: unknown) => {
        filters.push([col, value])
        return query
      },
      then: (onLanded: (answer: { data: unknown; error: unknown }) => unknown) => Promise.resolve(run()).then(onLanded),
    }
    return query
  }
  return { tables, client: { from } }
})
vi.mock('../supabase', () => ({ supabase: db.client }))

import { MOVED_ON_PUBLISH, MOVED_ON_SAVE, WRITE_GONE } from './documentBuildersIo'
import { startJobSheet, type JobSheet } from './sheet'
import { INSURANCE_SHEET_FIXTURE } from './insuranceSheet.fixture'
import { layOver, withUsualWords, fieldPath, type SheetDef } from './sheet'
import { markBuilderRead, publishBuilder, publishSheet, publishUsualToJobs, readBuilder, readBuilderSheets, saveBuilderDraft, saveSheetDraft, startSheet } from './sheetsIo'
import type { BuilderRecord } from './standing'

const USUAL = { fields: { title: 'A made-up sheet' } }
const row = (key: string) => db.tables.document_builders!.find((r) => r.key === key) as Record<string, unknown>
const sheetRow = (id: string) => db.tables.document_builder_sheets!.find((r) => r.id === id) as Record<string, unknown>
const CEDAR = (place = '410 Sample Street'): JobSheet => startJobSheet({ name: 'Cedar Park Medical Office', place, insured: ['Pecan Ridge Holdings, Ltd.'] })
const PAGE = { co: 'Acme Plumbing' } as never

beforeEach(() => {
  db.tables.document_builders = [{ key: 'insurance', kind: 'filled', draft: USUAL, published: USUAL, revision: 1, draft_no: 4, published_at: null, read_revision: null, read_by_name: '', read_on: null, updated_at: null }]
  db.tables.document_builder_sheets = []
})

describe('a builder’s draft, saved from two tabs', () => {
  it('lands the first save, and refuses the save from the tab that fell behind with the row as it now reads', async () => {
    const first = (await readBuilder('insurance')) as BuilderRecord
    const leftOpen = (await readBuilder('insurance')) as BuilderRecord
    expect([first.draftNo, leftOpen.draftNo]).toEqual([4, 4])

    const saved = await saveBuilderDraft('insurance', { fields: { title: 'Typed in the first tab' } }, first.draftNo)
    expect(saved.ok && saved.value.draftNo).toBe(5)

    const refused = await saveBuilderDraft('insurance', { fields: { title: 'Typed in the tab left open' } }, leftOpen.draftNo)
    expect(refused).toMatchObject({ ok: false, error: MOVED_ON_SAVE, movedOn: { draftNo: 5, draft: { fields: { title: 'Typed in the first tab' } } } })
    // The newer draft stands.
    expect(row('insurance').draft).toEqual({ fields: { title: 'Typed in the first tab' } })
  })

  it('refuses a publish from the tab that fell behind, though the revision it names still stands', async () => {
    const leftOpen = (await readBuilder('insurance')) as BuilderRecord
    await saveBuilderDraft('insurance', { fields: { title: 'Typed in the first tab' } }, leftOpen.draftNo)
    const refused = await publishBuilder('insurance', leftOpen.revision, { fields: { title: 'Typed in the tab left open' } }, leftOpen.draftNo)
    expect(refused).toMatchObject({ ok: false, error: MOVED_ON_PUBLISH, movedOn: { revision: 1, draftNo: 5 } })
    expect(row('insurance')).toMatchObject({ revision: 1, published: USUAL, draft: { fields: { title: 'Typed in the first tab' } } })
  })

  it('lands the save once the person chose to save theirs over the newer one, naming the number it is on', async () => {
    const leftOpen = (await readBuilder('insurance')) as BuilderRecord
    await saveBuilderDraft('insurance', { fields: { title: 'Typed in the first tab' } }, leftOpen.draftNo)
    const refused = await saveBuilderDraft('insurance', { fields: { title: 'Typed in the tab left open' } }, leftOpen.draftNo)
    const newer = (!refused.ok && refused.movedOn) as BuilderRecord
    const kept = await saveBuilderDraft('insurance', { fields: { title: 'Typed in the tab left open' } }, newer.draftNo)
    expect(kept.ok && kept.value.draftNo).toBe(6)
    expect(row('insurance').draft).toEqual({ fields: { title: 'Typed in the tab left open' } })
  })

  it('takes a save sent twice as the one save landing, not as someone else’s change', async () => {
    const mine = { fields: { title: 'Typed once' } }
    await saveBuilderDraft('insurance', mine, 4)
    const again = await saveBuilderDraft('insurance', mine, 4)
    expect(again.ok && again.value.draftNo).toBe(5)
    const published = await publishBuilder('insurance', 1, mine, 5)
    expect(published.ok && [published.value.revision, published.value.draftNo]).toEqual([2, 6])
    const publishedAgain = await publishBuilder('insurance', 1, mine, 5)
    expect(publishedAgain.ok && publishedAgain.value.revision).toBe(2)
  })

  it('lets a read mark through without moving the number, so a save from another tab still lands', async () => {
    const marked = await markBuilderRead('insurance', 1, 'Avery Stone', '2026-11-20')
    expect(marked.ok && marked.value.draftNo).toBe(4)
    expect((await saveBuilderDraft('insurance', { fields: { title: 'Typed after the mark' } }, 4)).ok).toBe(true)
  })

  it('says a builder that is no longer there is gone', async () => {
    expect(await saveBuilderDraft('nope', USUAL, 0)).toEqual({ ok: false, error: WRITE_GONE })
  })
})

describe('a job’s sheet, saved from two pages', () => {
  it('refuses the save and the publish of the page that fell behind, and keeps the teammate’s draft', async () => {
    const started = await startSheet('insurance', 'cedar', CEDAR())
    const id = (started.ok && started.value.id) as string
    const read = (await readBuilderSheets('insurance')).get('cedar')
    expect(read?.draftNo).toBe(0)

    // A teammate changes the job's place after this page read the sheet.
    const teammate = await saveSheetDraft(id, CEDAR('414 Sample Street'), 0)
    expect(teammate.ok && teammate.value.draftNo).toBe(1)

    const save = await saveSheetDraft(id, CEDAR('Typed on the page left open'), 0)
    expect(save).toMatchObject({ ok: false, error: MOVED_ON_SAVE, movedOn: { draftNo: 1, draft: { place: '414 Sample Street' } } })
    // The usual's publish to every job wrote the job's draft from the page as it was loaded. It names the number now.
    const publish = await publishSheet(id, 0, CEDAR(), PAGE, 1, 0)
    expect(publish).toMatchObject({ ok: false, error: MOVED_ON_PUBLISH, movedOn: { draftNo: 1 } })
    expect(sheetRow(id)).toMatchObject({ revision: 0, draft: { place: '414 Sample Street' } })

    const fresh = await publishSheet(id, 0, CEDAR('414 Sample Street'), PAGE, 1, 1)
    expect(fresh.ok && [fresh.value.revision, fresh.value.draftNo]).toEqual([1, 2])
  })

  it('reads the sheet someone else started a moment ago: the same draft is this start, another is a sheet that moved on', async () => {
    const first = await startSheet('insurance', 'cedar', CEDAR())
    const same = await startSheet('insurance', 'cedar', CEDAR())
    expect(same.ok && first.ok && same.value.id).toBe(first.ok && first.value.id)
    const other = await startSheet('insurance', 'cedar', CEDAR('Typed on another page'))
    expect(other).toMatchObject({ ok: false, error: MOVED_ON_SAVE, movedOn: { draft: { place: '410 Sample Street' } } })
    expect(db.tables.document_builder_sheets).toHaveLength(1)
  })
})

describe('the usual, published to every job', () => {
  const OLD_USUAL: SheetDef = { ...INSURANCE_SHEET_FIXTURE, cover: INSURANCE_SHEET_FIXTURE.cover.map((c, i) => ({ ...c, limit: `Made-up amount ${i + 1}` })) }
  const NEW_USUAL = withUsualWords(OLD_USUAL, fieldPath('foot'), 'A new foot line.')
  const MESA = (place = '77 Placeholder Parkway'): JobSheet => startJobSheet({ name: 'Mesa Verde Retail Shell', place, insured: ['Mesa Verde Partners, LLC'] })
  const JOBS = [
    { projectId: 'cedar', name: 'Cedar Park Medical Office' },
    { projectId: 'mesa', name: 'Mesa Verde Retail Shell' },
    { projectId: 'oak', name: 'Oak Hollow Offices' },
  ]
  const io = { readBuilderSheets, publishSheet }
  const ask = { builderKey: 'insurance', def: NEW_USUAL, usualRevision: 2, jobs: JOBS }
  /** Two jobs with a sheet out on the old usual and nothing of their own waiting. The third has no sheet. */
  const seed = () => {
    const out = (id: string, projectId: string, own: JobSheet) => ({ id, builder_key: 'insurance', project_id: projectId, draft: own, published: own, published_sheet: layOver(OLD_USUAL, own), revision: 1, usual_revision: 1, draft_no: 3 })
    db.tables.document_builder_sheets = [out('sheet-cedar', 'cedar', CEDAR()), out('sheet-mesa', 'mesa', MESA())]
  }

  it('goes to each job that is ready as its next revision, and holds the job with no sheet', async () => {
    seed()
    const went = await publishUsualToJobs(io, ask)
    expect(went.ok && { done: went.value.done, failed: went.value.failed, held: went.value.held }).toEqual({ done: 2, failed: [], held: [{ name: 'Oak Hollow Offices', why: 'Held. It has no sheet yet.' }] })
    expect(sheetRow('sheet-cedar')).toMatchObject({ revision: 2, usual_revision: 2, published_sheet: { foot: 'A new foot line.' } })
    expect(went.ok && went.value.sheets.get('mesa')?.revision).toBe(2)
  })

  it('reads each job as it stands at that moment: a draft a teammate saved since the page loaded is kept, and the job is held', async () => {
    seed()
    // The page loaded here. Then a teammate changed Cedar Park's place, and did not publish.
    await saveSheetDraft('sheet-cedar', CEDAR('414 Sample Street'), 3)
    const went = await publishUsualToJobs(io, ask)
    expect(went.ok && { done: went.value.done, failed: went.value.failed }).toEqual({ done: 1, failed: [] })
    expect(went.ok && went.value.held).toContainEqual({ name: 'Cedar Park Medical Office', why: 'Held. It has changes of its own waiting.' })
    // The teammate's draft stands, and subs still read revision 1 of that job.
    expect(sheetRow('sheet-cedar')).toMatchObject({ revision: 1, draft: { place: '414 Sample Street' }, published: { place: '410 Sample Street' } })
    // The page takes the job as it now reads, the teammate's draft with it.
    expect(went.ok && went.value.sheets.get('cedar')?.draft.place).toBe('414 Sample Street')
    expect(sheetRow('sheet-mesa')).toMatchObject({ revision: 2 })
  })

  it('goes out from the copy a teammate published since the page loaded', async () => {
    seed()
    await publishSheet('sheet-mesa', 1, MESA('79 Placeholder Parkway'), layOver(OLD_USUAL, MESA('79 Placeholder Parkway')), 1, 3)
    const went = await publishUsualToJobs(io, ask)
    expect(went.ok && went.value.done).toBe(2)
    expect(sheetRow('sheet-mesa')).toMatchObject({ revision: 3, published: { place: '79 Placeholder Parkway' }, published_sheet: { place: '79 Placeholder Parkway', foot: 'A new foot line.' } })
  })

  it('refuses a job whose draft moved between the read and the write, names it, and still goes to the rest', async () => {
    seed()
    const racing: typeof publishSheet = async (id, ...rest) => {
      // A teammate's save lands after the read, just ahead of this job's publish.
      if (id === 'sheet-cedar') await saveSheetDraft('sheet-cedar', CEDAR('414 Sample Street'), 3)
      return publishSheet(id, ...rest)
    }
    const went = await publishUsualToJobs({ readBuilderSheets, publishSheet: racing }, ask)
    expect(went.ok && { done: went.value.done, failed: went.value.failed }).toEqual({ done: 1, failed: [{ name: 'Cedar Park Medical Office', why: MOVED_ON_PUBLISH }] })
    expect(sheetRow('sheet-cedar')).toMatchObject({ revision: 1, draft: { place: '414 Sample Street' } })
    expect(went.ok && went.value.sheets.get('cedar')?.draft.place).toBe('414 Sample Street')
    expect(sheetRow('sheet-mesa')).toMatchObject({ revision: 2 })
  })

  it('holds a job the page has words of its own for, with the reason', async () => {
    seed()
    const went = await publishUsualToJobs(io, { ...ask, heldHere: (projectId) => (projectId === 'cedar' ? 'moved' : projectId === 'mesa' ? 'own-changes' : null) })
    expect(went.ok && { done: went.value.done, held: went.value.held }).toEqual({
      done: 0,
      held: [
        { name: 'Cedar Park Medical Office', why: 'Held. It changed somewhere else. Choose on its panel first.' },
        { name: 'Mesa Verde Retail Shell', why: 'Held. It has changes of its own waiting.' },
        { name: 'Oak Hollow Offices', why: 'Held. It has no sheet yet.' },
      ],
    })
    expect(sheetRow('sheet-cedar')).toMatchObject({ revision: 1 })
  })

  it('says so when the jobs did not read, and publishes to none', async () => {
    seed()
    const went = await publishUsualToJobs({ readBuilderSheets: async () => Promise.reject(new Error('The network is down.')), publishSheet }, ask)
    expect(went).toEqual({ ok: false, error: 'The network is down.' })
    expect(sheetRow('sheet-cedar')).toMatchObject({ revision: 1 })
  })
})
