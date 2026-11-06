#!/usr/bin/env node
/**
 * The guard sweep (punch list #256, PR 7b, v2.6573): every edge function that reads the caller (`auth.getUser`) and
 * switches to the service role (`SUPABASE_SERVICE_ROLE_KEY`) gets one call to `refuseArchivedCaller` from
 * `_shared/refuseArchivedCaller.ts`, placed after both the caller read and the service-role client's declaration, in
 * the function's own indentation, with its `corsHeaders`:
 *
 *     const archivedRefusal = await refuseArchivedCaller(admin, user?.id, corsHeaders)
 *     if (archivedRefusal) return archivedRefusal
 *
 * It reads the two shapes the functions use for the caller (`const { data: { user } } = …` with an alias, or
 * `const { data: u } = …`), finds the service client by `createClient(…, SUPABASE_SERVICE_ROLE_KEY)` directly or
 * through the variable the key was read into, or as the parameter of the helper that reads the caller; it refuses to
 * touch a function where either is missing, where no client is in the caller read's scope (a brace walk from each
 * declaration to the insertion point), or where `corsHeaders` is not a name in the file; those are listed for a hand edit. A function already carrying the call is left alone.
 * The script is the source of truth: on a rebase conflict, re-run it on the new main rather than resolve by hand.
 *
 *   node scripts/codemods/archived-guard-sweep.mjs [functions-dir] [--dry]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? 'supabase/functions')

const IMPORT = "import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'"

/** The index just past the statement that starts at `from`: the first `\n` after its parentheses balance. */
function statementEnd(text, from) {
  let depth = 0
  let i = from
  for (; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') depth--
    else if (ch === '\n' && depth <= 0) return i + 1
  }
  return text.length
}

/** True when a brace walk from `from` to `to` never leaves the block `from` sits in. */
function sameScope(text, from, to) {
  let depth = 0
  for (let i = from; i < to; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth < 0) return false }
  }
  return true
}


/**
 * The named function a position sits in: its parameters, its return type (braces, angle brackets and parentheses
 * balanced, so `Promise<{ userId: string } | Response>` reads whole) and where its body's brace is; null outside one.
 */
function enclosingNamedFunction(text, pos) {
  const heads = [...text.slice(0, pos).matchAll(/(?:async\s+)?function\s+\w+\s*\(/g)]
  for (let h = heads.length - 1; h >= 0; h--) {
    const head = heads[h]
    let i = head.index + head[0].length
    let depth = 1
    const paramsStart = i
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')') depth--
    }
    const params = text.slice(paramsStart, i - 1)
    // After the parameters: an optional `: type`, then the body's brace at depth zero of <>, {} and ().
    let j = i
    while (j < text.length && /\s/.test(text[j])) j++
    let returnType = ''
    if (text[j] === ':') {
      const typeStart = j + 1
      let d = 0
      let k = typeStart
      for (; k < text.length; k++) {
        const ch = text[k]
        if (ch === '<' || ch === '(' || ch === '[') d++
        else if (ch === '>' || ch === ')' || ch === ']') d--
        else if (ch === '{') {
          if (d === 0) break
          d++
        } else if (ch === '}') d--
      }
      returnType = text.slice(typeStart, k).trim()
      j = k
    }
    if (text[j] !== '{') continue
    const bodyAt = j
    if (bodyAt < pos && sameScope(text, bodyAt + 1, pos)) return { params, returnType, bodyAt }
  }
  return null
}

const code = (text) => text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

export function sweepOne(text) {
  const body = code(text)
  if (!/\.auth\.getUser\(/.test(body) || !/SUPABASE_SERVICE_ROLE_KEY/.test(body)) return { kind: 'not-in-scope' }
  if (/\b(refuseArchivedCaller|isArchivedCaller)\(/.test(body)) return { kind: 'already' }
  if (!/\bcorsHeaders\b/.test(text)) return { kind: 'hand', why: 'no corsHeaders in the file' }
  const getUserAt = text.indexOf('.auth.getUser(')
  const declStart = text.lastIndexOf('const ', getUserAt)
  const decl = text.slice(declStart, getUserAt)
  let userExpr = null
  let m
  if ((m = /^const\s*\{\s*data:\s*\{\s*user(?:\s*:\s*(\w+))?\s*\}/s.exec(decl))) userExpr = `${m[1] || 'user'}?.id`
  else if ((m = /^const\s*\{\s*data\s*:\s*(\w+)\s*(?:,[^}]*)?\}/s.exec(decl))) userExpr = `${m[1]}?.user?.id`
  if (!userExpr) return { kind: 'hand', why: 'the caller read is not one of the two shapes' }
  const getUserEnd = statementEnd(text, getUserAt)

  // The service-role client in scope: a helper that takes it as a parameter (`requireStaff(admin: Admin, …)`), else the
  // nearest declaration, direct or through the variable the key was read into, that a brace walk keeps in one scope.
  let admin = null
  let at = -1
  const fn = enclosingNamedFunction(text, getUserAt)
  const paramAdmin = fn ? /\b(admin|adminClient|serviceClient|service)\s*[:,)]/.exec(fn.params + ')') : null
  // A helper's early return must be a Response: a helper that answers a boolean or a row gets its guard by hand.
  const returnsResponse = !fn || !fn.returnType || /\bResponse\b/.test(fn.returnType)
  if (paramAdmin && fn && !returnsResponse) return { kind: 'hand', why: `the helper that reads the caller returns ${fn.returnType}, not a Response` }
  const fnHead = fn ? { index: fn.bodyAt, 0: '' } : null
  if (paramAdmin && fnHead && sameScope(text, fnHead.index + 1, getUserAt)) {
    admin = paramAdmin[1]
    at = getUserEnd
  } else {
    const keys = [...text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]\s*\)/g)].map((k) => k[1])
    const candidates = [...text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*createClient\(/g)]
      .filter((c) => {
        const call = text.slice(c.index, statementEnd(text, c.index + c[0].length - 1))
        return /SUPABASE_SERVICE_ROLE_KEY/.test(call) || keys.some((k) => new RegExp(`,\\s*${k}\\b`).test(call))
      })
      .map((c) => ({ name: c[1], at: c.index, end: statementEnd(text, c.index + c[0].length - 1) }))
      .filter((c) => {
        const point = Math.max(getUserEnd, c.end)
        return sameScope(text, getUserEnd, point) && sameScope(text, c.end, point)
      })
      .sort((a, b) => Math.abs(a.at - getUserAt) - Math.abs(b.at - getUserAt))
    if (candidates[0]) {
      admin = candidates[0].name
      at = Math.max(getUserEnd, candidates[0].end)
    }
  }
  if (!admin) return { kind: 'hand', why: 'no service-role client in the caller read’s scope' }
  // The indentation of the statement that ends at the insertion point.
  const lineStart = text.lastIndexOf('\n', at - 2) + 1
  const indent = /^\s*/.exec(text.slice(lineStart, at))[0]
  const guard = `${indent}const archivedRefusal = await refuseArchivedCaller(${admin}, ${userExpr}, corsHeaders)\n${indent}if (archivedRefusal) return archivedRefusal\n`
  let out = text.slice(0, at) + guard + text.slice(at)
  // The import after the last import statement.
  const imports = [...out.matchAll(/^import\s[\s\S]*?['"][^'"\n]+['"];?[ \t]*\n/gm)]
  const last = imports[imports.length - 1]
  const importAt = last ? last.index + last[0].length : 0
  out = out.slice(0, importAt) + IMPORT + '\n' + out.slice(importAt)
  return { kind: 'swept', text: out, admin, userExpr }
}

const slugs = readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .filter((e) => existsSync(join(dir, e.name, 'index.ts')))
  .map((e) => e.name)
  .sort()
const tally = { swept: [], already: [], hand: [] }
for (const slug of slugs) {
  const file = join(dir, slug, 'index.ts')
  const r = sweepOne(readFileSync(file, 'utf8'))
  if (r.kind === 'swept') {
    tally.swept.push(`${slug} (${r.admin}, ${r.userExpr})`)
    if (!dry) writeFileSync(file, r.text)
  } else if (r.kind === 'already') tally.already.push(slug)
  else if (r.kind === 'hand') tally.hand.push(`${slug}: ${r.why}`)
}
console.log(`${dry ? 'would sweep' : 'swept'} ${tally.swept.length}, already guarded ${tally.already.length}, by hand ${tally.hand.length}`)
if (tally.hand.length) console.log('by hand:\n  ' + tally.hand.join('\n  '))
if (process.env.SWEEP_VERBOSE) console.log('swept:\n  ' + tally.swept.join('\n  '))
