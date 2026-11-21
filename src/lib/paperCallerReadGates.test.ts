/**
 * A function that reads a paper as its caller says who that caller may be first.
 *
 * Some edge functions read `person_contract_documents` through the caller's own client and then write, or mint a file's
 * link, with the service role. For those, "the caller reads the row" is not a gate: a read policy for one more role
 * would hand that role the function's act too. So each of them names the roles it takes before it reads the paper, and
 * this test holds the list. A new function that reads a paper as its caller fails here until it is listed with the
 * check it makes.
 *
 * Why it is here: punch list #403 gave the estimator a read of an outside company's paper, and step 4 widened it to
 * every kind of one (the owner's call 9 of 2026-11-20).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUNCTIONS = resolve(__dirname, '../../supabase/functions')

/** The papers table and the view over it. */
const PAPER_READ = /(\w+)\s*\.from\(\s*['"](person_contract_documents|agreements_on_file)['"]\s*\)/g

/** The one client name that is the service role in every function here. A read through any other is the caller's. */
const SERVICE_CLIENT = 'admin'

/** Each function that reads a paper as its caller, and the role check its handler makes before that read. */
const GATES: Record<string, string> = {
  'complete-contract-form-office': 'ALLOWED_ROLES.has(role)',
  'open-contract-form-pdf': 'formPdfRefusal(caller, facts)',
  // Punch list #376: the four roles that send a paper, and never an estimator, before the row is read.
  'person-paper-pdf': 'ROLES.includes(role)',
  'send-contract-for-signature': 'signingCallerRefusal(',
}

function functionSources(): Array<{ name: string; source: string }> {
  return readdirSync(FUNCTIONS)
    .filter((name) => !name.startsWith('_') && statSync(join(FUNCTIONS, name)).isDirectory())
    .map((name) => {
      try {
        return { name, source: readFileSync(join(FUNCTIONS, name, 'index.ts'), 'utf8') }
      } catch {
        return { name, source: '' }
      }
    })
}

/** Where a function first reads a paper through a client that is not the service role, or -1. */
function firstCallerRead(source: string): number {
  for (const m of source.matchAll(PAPER_READ)) {
    if (m[1] !== SERVICE_CLIENT) return m.index ?? -1
  }
  return -1
}

describe('functions that read a paper as their caller', () => {
  const sources = functionSources()

  it('finds the functions folder', () => {
    expect(sources.length).toBeGreaterThan(100)
  })

  it('are the ones listed here, each with its check', () => {
    const found = sources.filter((f) => firstCallerRead(f.source) > -1).map((f) => f.name).sort()
    expect(found).toEqual(Object.keys(GATES).sort())
  })

  it.each(Object.entries(GATES))('%s asks who the caller is before it reads the paper', (name, gate) => {
    const source = sources.find((f) => f.name === name)?.source ?? ''
    const read = firstCallerRead(source)
    const asked = source.indexOf(gate)
    expect(read, `${name} reads a paper as its caller`).toBeGreaterThan(-1)
    expect(asked, `${name} holds its check, ${gate}`).toBeGreaterThan(-1)
    expect(asked).toBeLessThan(read)
  })

  it('the service client of each is made with the service key', () => {
    for (const name of Object.keys(GATES)) {
      const source = sources.find((f) => f.name === name)?.source ?? ''
      expect(source, name).toMatch(/const admin = createClient\(supabaseUrl, serviceKey/)
    }
  })
})
