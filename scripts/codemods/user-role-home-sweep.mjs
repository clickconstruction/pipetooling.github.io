#!/usr/bin/env node
/**
 * `UserRole`'s home sweep (punch list #434, the split's step 2).
 *
 * The type check is being cut into projects by layer, and a lower layer reads nothing from one above it
 * (`scripts/lib/layers.mjs`, `npm run check:layers`). On 2026-11-27 the lowest folders read the hooks from
 * 168 files, and in 92 of them the one thing read was the type `UserRole`, from the sign-in hook. The type
 * names the nine roles and needs nothing of the hook, so its home is `src/types/userRole.ts`. The hook
 * imports it from there and exports it again, so every component and page that reads it from the hook is
 * untouched.
 *
 * The rewrite: in every file the base rule speaks for (`src/lib`, `src/utils`, `src/types`, `src/constants`,
 * `src/content`, tests left out), an import or a re-export that names `UserRole` alone and resolves to
 * `src/hooks/useAuth.ts` is pointed at the new home. The import keeps its own style: the `@/` alias stays
 * an alias, a relative path stays relative, a `.ts` ending stays, and so does its quote.
 *
 * Listed, never rewritten: an import from the hook that names `UserRole` beside anything else. Each is read
 * by hand. There was none on the day this was written.
 *
 * Mechanical and re-runnable (rebase rule: re-run this on the new main, never hand-resolve its diff).
 * After it, `npm run check:layers -- --write` takes the mended rows off the list.
 *
 * Usage: node scripts/codemods/user-role-home-sweep.mjs [--dry | --check]
 *   --dry    lists what it would rewrite, writes nothing
 *   --check  the same, and exits 1 when anything is left to rewrite or to read by hand
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { resolveImport, ruleFor } from '../lib/layers.mjs'

const ROOT = process.cwd()
const ts = createRequire(path.join(ROOT, 'package.json'))('typescript')
const DRY = process.argv.includes('--dry') || process.argv.includes('--check')
const CHECK = process.argv.includes('--check')
const OLD_HOME = 'src/hooks/useAuth.ts'
const NEW_HOME = 'src/types/userRole'
const NAME = 'UserRole'

const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', 'src'], { cwd: ROOT, maxBuffer: 1 << 28 })
  .toString()
  .split('\0')
  .filter((file) => file && existsSync(path.join(ROOT, file)))
const known = new Set(files)
const has = (file) => known.has(file)

/** The new home as `from` would write it, in the style of the specifier it had. */
function newSpecifier(from, old) {
  const ending = old.endsWith('.ts') ? '.ts' : ''
  if (old.startsWith('@/')) return `@/${NEW_HOME.slice('src/'.length)}${ending}`
  const relative = path.posix.relative(path.posix.dirname(from), NEW_HOME)
  return `${relative.startsWith('.') ? relative : `./${relative}`}${ending}`
}

/** The names an import or a re-export takes from its module, or undefined when it takes more than named ones. */
function namedOnly(statement) {
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause
    if (!clause || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return undefined
    return clause.namedBindings.elements.map((element) => (element.propertyName ?? element.name).text)
  }
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return undefined
  return statement.exportClause.elements.map((element) => (element.propertyName ?? element.name).text)
}

let rewritten = 0
const byHand = []
for (const file of files) {
  if (ruleFor(file)?.name !== 'base') continue
  const text = readFileSync(path.join(ROOT, file), 'utf8')
  if (!text.includes('useAuth')) continue
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
    const specifier = statement.moduleSpecifier
    if (!specifier || !ts.isStringLiteral(specifier)) continue
    if (resolveImport(file, specifier.text, has) !== OLD_HOME) continue
    const names = namedOnly(statement)
    if (names && names.length && names.every((name) => name === NAME)) {
      // Inside the quotes, so the file's own quote stays.
      edits.push({ start: specifier.getStart(source) + 1, end: specifier.getEnd() - 1, to: newSpecifier(file, specifier.text) })
    } else if (!names || names.includes(NAME)) {
      byHand.push(`${file}:${source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1}`)
    }
  }
  if (!edits.length) continue
  rewritten += edits.length
  if (DRY) {
    console.log(`  ${file}`)
    continue
  }
  let next = text
  for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.to + next.slice(edit.end)
  writeFileSync(path.join(ROOT, file), next)
}

for (const line of byHand) console.log(`  by hand: ${line} names ${NAME} beside something else, or takes the hook whole`)
console.log(`${DRY ? '[dry] ' : ''}imports of ${NAME} pointed at ${NEW_HOME}: ${rewritten} · left to read by hand: ${byHand.length}`)
process.exit(CHECK && (rewritten || byHand.length) ? 1 : 0)
