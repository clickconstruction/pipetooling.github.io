/**
 * A paper the flow editor adds (Messages cut 4, `flow_paper_create`, v2.5306) is a Contract library document with its
 * `flow_kind` set, filed under the customer or the sub audience. Every read that takes the library by audience means the
 * Book's own documents: a job contract's terms, a work order's references, the Gen. Cond. pill, Contracts & terms. So
 * each one skips flow papers with `.is('flow_kind', null)`. The test reads the real files, so a new reader by audience
 * cannot ship without the guard.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : []
  })
}

/** Each library read: the line that names the table and the chain lines after it. */
function libraryReads(file: string): { at: string; chain: string }[] {
  const lines = readFileSync(file, 'utf8').split('\n')
  const out: { at: string; chain: string }[] = []
  lines.forEach((line, i) => {
    if (!/from\('contract_template_documents'/.test(line)) return
    const chain = [line]
    for (let j = i + 1; j < lines.length && lines[j]!.trim().startsWith('.'); j++) chain.push(lines[j]!)
    out.push({ at: `${relative(ROOT, file)}:${i + 1}`, chain: chain.join('\n') })
  })
  return out
}

const byAudience = [...sourceFiles(resolve(ROOT, 'src')), ...sourceFiles(resolve(ROOT, 'supabase/functions'))]
  .flatMap(libraryReads)
  .filter((r) => /\.(eq|in)\('audience'/.test(r.chain))

describe('flow papers stay out of the Book', () => {
  it('finds the readers that take the library by audience', () => {
    const files = new Set(byAudience.map((r) => r.at.split(':')[0]))
    expect(files).toContain('src/lib/jobs/jobContractInPerson.ts')
    expect(files).toContain('src/lib/subWorkOrders/quickSendWorkOrder.ts')
    expect(files).toContain('supabase/functions/get-job-contract/index.ts')
    expect(byAudience.length).toBeGreaterThanOrEqual(11)
  })

  it('skips flow papers on every one of them', () => {
    expect(byAudience.filter((r) => !r.chain.includes(".is('flow_kind', null)")).map((r) => r.at)).toEqual([])
  })
})
