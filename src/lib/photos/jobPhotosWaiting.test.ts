import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The strip's and the Documents tab's *N on its way* count (`waiting` in job-photos's `list` answer, `jobPhotosLine.ts`)
 * is one head count per bucket table, read here from the function's source since the function runs in Deno. A job
 * photo added in the Job photos window (v2.6365) and a report's photo wait in their buckets like a checklist's or a
 * box's, and the count left them out until v2.6489. Each predicate is the photo-save cron's own clause for the table.
 */
const SOURCE = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'functions', 'job-photos', 'index.ts'), 'utf8')
const start = SOURCE.indexOf('async function waitingCount(')
const waitingCount = SOURCE.slice(start, SOURCE.indexOf('\n}\n', start))

const countOf = (table: string) => waitingCount.split('\n').find((line) => line.includes(`.from('${table}')`)) ?? ''

describe('job-photos waiting count', () => {
  it.each([
    ['stage_checklist_answers', ".is('photo_filed_at', null).not('photo_storage_path', 'is', null)"],
    ['job_box_photos', ".is('filed_at', null).not('storage_path', 'is', null)"],
    ['job_photo_notes', ".is('filed_at', null).not('storage_path', 'is', null).not('added_at', 'is', null)"],
    ['report_photos', ".is('filed_at', null).not('storage_path', 'is', null).not('report_id', 'is', null)"],
  ])('counts the job’s %s rows still in their bucket with one head count', (table, predicate) => {
    const line = countOf(table)
    expect(line).toContain(".eq('job_id', jobId)")
    expect(line).toContain("{ count: 'exact', head: true }")
    expect(line).toContain(predicate)
  })

  it('adds the four counts', () => {
    expect(waitingCount).toContain('(a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0) + (d.count ?? 0)')
  })
})
