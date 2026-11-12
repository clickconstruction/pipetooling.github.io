import { readFileSync, writeFileSync } from 'node:fs'
const f = 'src/lib/devMcp/devMcpWrites.test.ts'
const t = readFileSync(f, 'utf8')
if (t.includes("'apply_bid_counts', 'plan_bid_takeoff', 'apply_bid_takeoff'")) { console.log('table verbs already there'); process.exit(0) }
const a = "'plan_bid_counts', 'apply_bid_counts'"
if (t.split(a).length !== 2) throw new Error('anchor')
writeFileSync(f, t.replace(a, () => "'plan_bid_counts', 'apply_bid_counts', 'plan_bid_takeoff', 'apply_bid_takeoff'"))
console.log('table verbs added')
