#!/usr/bin/env node
/**
 * letter two → the attorney's letter, on every surface a person reads (punch list #274, v2.6591).
 *
 * Once the second courtesy reminder was dropped (2026-11-06), "letter two" read as a second copy
 * of something. The paper is counsel's certified letter, so the words say that. This sweep changes
 * string literals, JSX text and guide prose; it never touches identifiers (no identifier holds a
 * space), code comments, release notes or recent-features fragments (frozen history).
 *
 *   node scripts/codemods/attorneys-letter-rename.mjs --check   # list what would change
 *   node scripts/codemods/attorneys-letter-rename.mjs           # apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const check = process.argv.includes('--check')
const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'src/content/help/*.md' 'src/lib/**/*.ts'", { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.includes('src/content/releaseNotes/') && !f.endsWith('attorneys-letter-rename.mjs'))

const A = '’' // the curly apostrophe the app writes
/** In order: the specific shapes first, the bare words last. */
const RULES = [
  [/Send letter two/g, `Send the attorney${A}s letter`],
  [/\ba letter two\b/g, `an attorney${A}s letter`],
  [/\bletter two['’]s\b/g, `the attorney${A}s letter${A}s`],
  [/\bLetter two['’]s\b/g, `The attorney${A}s letter${A}s`],
  // A label: "Letter two" alone, or before " ·", a quote or a tag — no article.
  [/\bLetter two(?=\s*(?:['"`\u2019<)]|\s*$|\s·|,))/gm, `Attorney${A}s letter`],
  // A sentence: "Letter two is …" — with its article.
  [/\bLetter two\b/g, `The attorney${A}s letter`],
  [/\bletter two\b/g, `the attorney${A}s letter`],
  [/\b(the|The) the attorney/g, (_, t) => `${t} attorney`],
  [/\ban the attorney/g, 'an attorney'],
]

const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line)
let total = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  if (!/letter two/i.test(src)) continue
  const md = f.endsWith('.md')
  const out = src
    .split('\n')
    .map((line) => {
      if (!md && isComment(line)) return line
      let l = line
      for (const [re, rep] of RULES) l = l.replace(re, rep)
      return l
    })
    .join('\n')
  if (out === src) continue
  const n = src.split('\n').filter((l, i) => l !== out.split('\n')[i]).length
  total += n
  console.log(`${check ? 'would change' : 'changed'} ${n} line${n === 1 ? '' : 's'} · ${f}`)
  if (!check) writeFileSync(f, out)
}
console.log(`${check ? 'would change' : 'changed'} ${total} lines in all`)
