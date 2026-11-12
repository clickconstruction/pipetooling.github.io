// node bump.mjs <oldVersion> <newVersion> <oldCountWord> <newCountWord> <oldCount> <newCount> <oldRestRows> <newRestRows>
// Moves the seat's pins: SERVER_VERSION, the tests that pin it, the verb count in words and digits, the restRows count.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
const [, , oldV, newV, oldW, newW, oldN, newN, oldR, newR] = process.argv
const edit = (f, fn) => { const a = readFileSync(f, 'utf8'); const b = fn(a); if (a !== b) writeFileSync(f, b); return a !== b }
const all = (t, a, b) => t.split(a).join(b)
const server = 'supabase/functions/dev-mcp/index.ts'
edit(server, (t) => all(all(all(t, `const SERVER_VERSION = '${oldV}'`, `const SERVER_VERSION = '${newV}'`), '__VERSION__', newV), `Writes are ${oldW} verbs and nothing else`, `Writes are ${newW} verbs and nothing else`))
let n = 0
for (const name of readdirSync('src/lib/devMcp')) {
  if (!name.endsWith('.test.ts')) continue
  const f = `src/lib/devMcp/${name}`
  if (edit(f, (t) => {
    t = all(t, `const SERVER_VERSION = '${oldV}'`, `const SERVER_VERSION = '${newV}'`)
    t = all(t, `SERVER_VERSION = '${oldV.replace(/\./g, '\\.')}'`, `SERVER_VERSION = '${newV.replace(/\./g, '\\.')}'`)
    t = all(t, `Writes are ${oldW} verbs and nothing else`, `Writes are ${newW} verbs and nothing else`)
    t = all(t, `toContain('${oldW} verbs')`, `toContain('${newW} verbs')`)
    t = all(t, `'${oldW} \`plan_\` / \`apply_\` / \`revert_\` verbs'`, `'${newW} \`plan_\` / \`apply_\` / \`revert_\` verbs'`)
    t = all(t, `expect(Object.keys(WRITE_VERBS)).toHaveLength(${oldN})`, `expect(Object.keys(WRITE_VERBS)).toHaveLength(${newN})`)
    t = all(t, `expect(SERVER.match(/restRows\\(/g)?.length).toBe(${oldR})`, `expect(SERVER.match(/restRows\\(/g)?.length).toBe(${newR})`)
    return t
  })) n++
}
console.log(`bumped ${n} test files`)
