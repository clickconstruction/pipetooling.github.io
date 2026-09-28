import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cssBraceProblems } from './cssBraceBalance'

describe('cssBraceProblems', () => {
  it('passes a balanced sheet, nested blocks and all', () => {
    expect(cssBraceProblems('.a { color: red; }\n@media (max-width: 600px) {\n  .a { color: blue; }\n}\n')).toEqual([])
  })

  it('names the line of a rule left open', () => {
    expect(cssBraceProblems('.a {\n  font-size: 16px;\n.b {\n  color: red;\n}\n')).toEqual([{ kind: 'unclosed', line: 1 }])
  })

  it('names the line of a brace that closes nothing', () => {
    expect(cssBraceProblems('.a { color: red; }\n}\n.b { color: blue; }\n')).toEqual([{ kind: 'unopened', line: 2 }])
  })

  it('does not count a brace inside a comment or a string', () => {
    expect(cssBraceProblems('/* a { stray */\n.a::after { content: "}"; }\n.b::before { content: \'{\'; }\n')).toEqual([])
  })
})

const SRC = join(__dirname, '..')
const stylesheets = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? stylesheets(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []))

describe('the app’s stylesheets', () => {
  it.each(stylesheets(SRC).map((f) => [relative(SRC, f), f]))('%s closes every rule it opens', (_name, file) => {
    expect(cssBraceProblems(readFileSync(file, 'utf8'))).toEqual([])
  })
})
