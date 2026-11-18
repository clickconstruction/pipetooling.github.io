import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A Supabase query is sent only when it is awaited: the client's builder is a thenable, and the request goes out
 * inside `then`. So `void supabase.from('t').delete().eq(…)` with nothing after it sends nothing, and reads like
 * it does. Two such writes shipped and were never sent: the Prospects calling lock's release (v2.2850) and the
 * alert dismissals' save (v2.2951), both found 2026-11-17.
 *
 * This test reads every source file and fails on a `void supabase…` query builder that no `then`, `catch` or
 * `finally` follows. A call that hands back a real promise is fine as it is and is not a builder: an edge
 * function's `invoke`, `auth`, `storage`, and the channel calls.
 */
const SRC = join(process.cwd(), 'src')
const REAL_PROMISE = /\.functions\.|\.auth\.|\.storage\b|removeChannel|removeAllChannels|\.channel\(|\.realtime\b/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(path)
  }
  return out
}

/** The whole statement that starts on a line: to the close of its parentheses, then any lines that chain on with a dot. */
function statementAt(lines: string[], start: number): string {
  let stmt = lines[start] ?? ''
  let depth = (stmt.match(/\(/g)?.length ?? 0) - (stmt.match(/\)/g)?.length ?? 0)
  let i = start
  while (depth > 0 && i + 1 < lines.length && i - start < 40) {
    i++
    stmt += '\n' + lines[i]
    depth += (lines[i]?.match(/\(/g)?.length ?? 0) - (lines[i]?.match(/\)/g)?.length ?? 0)
  }
  while (i + 1 < lines.length && (lines[i + 1] ?? '').trim().startsWith('.') && i - start < 60) {
    i++
    stmt += '\n' + lines[i]
    depth += (lines[i]?.match(/\(/g)?.length ?? 0) - (lines[i]?.match(/\)/g)?.length ?? 0)
    while (depth > 0 && i + 1 < lines.length && i - start < 60) {
      i++
      stmt += '\n' + lines[i]
      depth += (lines[i]?.match(/\(/g)?.length ?? 0) - (lines[i]?.match(/\)/g)?.length ?? 0)
    }
  }
  return stmt
}

export function unsentQueries(source: string): number[] {
  const lines = source.split('\n')
  const found: number[] = []
  lines.forEach((line, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) return // a comment that quotes the shape is not the shape
    if (!/\bvoid\s+\(?supabase\b/.test(line) && !/\bvoid\s+\(supabase as any\)/.test(line)) return
    const stmt = statementAt(lines, i)
    if (REAL_PROMISE.test(stmt)) return
    if (/\.(then|catch|finally)\(/.test(stmt)) return
    found.push(i + 1)
  })
  return found
}

describe('a Supabase query that is built must be sent', () => {
  it('the reader finds a builder that is built and dropped, on one line or across several', () => {
    expect(unsentQueries("    void supabase.from('t').delete().eq('id', id)\n")).toEqual([1])
    expect(unsentQueries("void supabase\n  .from('t')\n  .update({ a: 1 })\n  .eq('id', id)\nnext()\n")).toEqual([1])
    expect(unsentQueries("void supabase.rpc('do_it', { p: 1 })\n")).toEqual([1])
    expect(unsentQueries("void (supabase as any).from('t').insert(row)\n")).toEqual([1])
  })

  it('the reader passes a builder that is sent, and a call that already hands back a promise', () => {
    expect(unsentQueries("void supabase.from('t').delete().eq('id', id).then(() => undefined)\n")).toEqual([])
    expect(unsentQueries("void supabase\n  .from('t')\n  .upsert(row)\n  .then(\n    () => undefined,\n    () => undefined,\n  )\n")).toEqual([])
    expect(unsentQueries("void supabase.functions.invoke('send', { body })\n")).toEqual([])
    expect(unsentQueries("void supabase.removeAllChannels()\n")).toEqual([])
    expect(unsentQueries("void supabase.auth.signOut()\n")).toEqual([])
    expect(unsentQueries(" * the old code read `void supabase.from('t').delete()`\n")).toEqual([])
  })

  it('no source file builds a query and drops it', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      for (const line of unsentQueries(readFileSync(file, 'utf8'))) offenders.push(`${relative(process.cwd(), file)}:${line}`)
    }
    expect(offenders, 'each of these is a query that is never sent: end it with .then(…), or await it').toEqual([])
  })
})
