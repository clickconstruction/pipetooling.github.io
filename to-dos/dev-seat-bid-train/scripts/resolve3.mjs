// node resolve3.mjs <mineOld> <mineNew> — this merge's hand conflicts: main's version line and instructions line are
// taken and this PR's phrase is put back into the instructions; both notes are kept in the doc; this PR's own
// mentions of its server version move from <mineOld> to <mineNew>.
import { readFileSync, writeFileSync } from 'node:fs'
const [, , O, N] = process.argv
const RE = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> origin\/main\n/g
const once = (t, a, b, what) => { if (t.split(a).length !== 2) throw new Error(`anchor not found once: ${what}`); return t.replace(a, () => b) }
{
  const f = 'supabase/functions/dev-mcp/index.ts'
  let n = 0
  let t = readFileSync(f, 'utf8').replace(RE, (_m, ours, theirs) => {
    n++
    if (ours.startsWith('const SERVER_VERSION') || ours.includes('PipeTooling dev seat — read-only')) return theirs
    throw new Error('unexpected conflict in the server: ' + ours.slice(0, 60))
  })
  if (n !== 2) throw new Error(`server: ${n} conflicts, wanted 2`)
  if (t.includes('plan_bid_update → apply_bid_update (a bid changed')) throw new Error('the phrase is already in the instructions')
  t = once(t, "plan_bid → apply_bid (a new bid as the New Bid form makes it, numbered by the database)", "plan_bid → apply_bid (a new bid as the New Bid form makes it, numbered by the database), plan_bid_update → apply_bid_update (a bid changed as Edit Bid and the Bid Board change it: its value, the sent date and who it went to, the outcome with the day it was decided and why it was lost, the due date, the estimator, the GC, the development, the links, the notes; the plan shows each column before and after and what the database does next — a win opens no job, a first sent date fills the labor rows from the book; a bid with versions keeps Sent and Won / Lost per GC; since __VERSION__)", 'INSTRUCTIONS')
  t = once(t, `// ${O} (v2.6945,`, `// ${N} (v2.6945,`, 'header note')
  writeFileSync(f, t)
}
{
  const f = 'docs/EDGE_FUNCTIONS.md'
  let n = 0
  let t = readFileSync(f, 'utf8').replace(RE, (_m, ours, theirs) => {
    n++
    if (!ours.startsWith('> **v2.6945') || !theirs.startsWith('> **v2.')) throw new Error('unexpected conflict in the doc')
    return `${ours}\n${theirs}`
  })
  if (n !== 1) throw new Error(`doc: ${n} conflicts, wanted 1`)
  t = once(t, `v2.6945 (server ${O})`, `v2.6945 (server ${N})`, 'doc version')
  writeFileSync(f, t)
}
{
  const f = 'docs/dev-mcp/README.md'
  let t = readFileSync(f, 'utf8')
  if (t.split(`v2.6945 / ${O}`).length !== 3) throw new Error('README: own version mentions')
  writeFileSync(f, t.split(`v2.6945 / ${O}`).join(`v2.6945 / ${N}`))
}
console.log('resolved')
