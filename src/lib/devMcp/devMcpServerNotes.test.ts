/**
 * The dev seat's per-version notes live in docs/dev-mcp/SERVER_NOTES.md (v2.7999), not in the function's source. They
 * were comments at the top of index.ts until they weighed 47 KB of an upload the deploy refuses past 5 MB, and the seat
 * sat 11 KB under the 4.5 MB the bundle check holds. This keeps them from growing back.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const NOTES = readFileSync('docs/dev-mcp/SERVER_NOTES.md', 'utf8')

describe('the dev seat\'s version notes', () => {
  it('a new server version writes its note in docs/dev-mcp/SERVER_NOTES.md, never as a comment in index.ts', () => {
    const head = SERVER.slice(0, SERVER.indexOf('const SERVER_VERSION'))
    const strays = head.split('\n').filter((l) => /^\/\/ (0\.\d+\.\d+ \(|v2\.\d+ \()/.test(l))
    // A line here is a version note written in the function. Move it to the end of the notes file.
    expect(strays).toEqual([])
    expect(head).toContain('docs/dev-mcp/SERVER_NOTES.md, oldest first')
  })

  it('the version the server answers with has its note', () => {
    const version = /const SERVER_VERSION = '([^']+)'/.exec(SERVER)?.[1] ?? ''
    expect(version).toMatch(/^0\.\d+\.\d+$/)
    // Missing: the PR that moved the version did not say what the version added. Add a paragraph that opens `0.NNN.0 (`.
    expect(NOTES).toContain(`${version} (`)
  })

  it('the header that stays is the description of the door, well under what the notes weighed', () => {
    const head = SERVER.slice(0, SERVER.indexOf('const SERVER_VERSION'))
    const comment = head.split('\n').filter((l) => l.startsWith('//')).join('\n')
    expect(comment.length).toBeLessThan(12_000)
  })
})
