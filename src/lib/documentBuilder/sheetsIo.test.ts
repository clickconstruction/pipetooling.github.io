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
import { markBuilderRead, publishBuilder, publishSheet, readBuilder, readBuilderSheets, saveBuilderDraft, saveSheetDraft, startSheet } from './sheetsIo'
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
