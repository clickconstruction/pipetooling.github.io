import { describe, expect, it } from 'vitest'
import { EMAIL_CATALOG, EMAIL_CATALOG_GROUP_LABELS, emailCatalogByGroup } from './emailCatalog'

describe('EMAIL_CATALOG', () => {
  it('ids are unique, snake_case, and non-empty', () => {
    const ids = EMAIL_CATALOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]+$/)
  })

  it('every group used has a label, and every label group has rows', () => {
    for (const e of EMAIL_CATALOG) expect(EMAIL_CATALOG_GROUP_LABELS[e.group]).toBeTruthy()
    for (const g of Object.keys(EMAIL_CATALOG_GROUP_LABELS) as (keyof typeof EMAIL_CATALOG_GROUP_LABELS)[]) {
      expect(emailCatalogByGroup(g).length, `group ${g} has no rows`).toBeGreaterThan(0)
    }
  })

  it('templates-editable rows name at least one template type; workflow row carries all 11', () => {
    for (const e of EMAIL_CATALOG) {
      if (e.editable.kind === 'templates') expect(e.editable.templateTypes.length).toBeGreaterThan(0)
    }
    const wf = EMAIL_CATALOG.find((e) => e.id === 'workflow_notifications')!
    expect(wf.editable.kind).toBe('templates')
    if (wf.editable.kind === 'templates') expect(wf.editable.templateTypes).toHaveLength(11)
  })

  it('covers the full inventory: 32 rows, every sender named, no blank subjects', () => {
    // 33 composition paths from the 2026-09-02 inventory, folded: the 11
    // workflow templates ride one aggregate row, pure variants (resends,
    // reminders, [TEST] twins) ride their parent row.
    expect(EMAIL_CATALOG).toHaveLength(32)
    for (const e of EMAIL_CATALOG) {
      expect(e.sender.trim().length).toBeGreaterThan(0)
      expect(e.subjectExample.trim().length).toBeGreaterThan(0)
    }
  })
})
