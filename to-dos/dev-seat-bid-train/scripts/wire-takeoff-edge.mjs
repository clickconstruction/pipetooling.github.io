import { readFileSync, writeFileSync } from 'node:fs'
const once = (t, a, b, what) => { if (t.split(a).length !== 2) throw new Error(`anchor not found once: ${what}`); return t.replace(a, () => b) }
{
  const f = 'scripts/edge-kernels.mjs'
  let t = readFileSync(f, 'utf8')
  t = once(t, "  'lib/bids/pickActiveVersion.ts': { values: [], types: [] },\n", `  'lib/bids/pickActiveVersion.ts': { values: [], types: [] },
  // The dev seat's plan_bid_takeoff: the bid's materials off its part lines (the Takeoffs strip's and Pricing's number,
  // with the order rounding) and how a part is sold, so the plan states the tab's own total. Off the index.
  'lib/bids/bidMaterials.ts': { values: [], types: [] },
  'lib/materials/orderIncrement.ts': { values: [], types: [] },
`, 'edge entries')
  writeFileSync(f, t)
  const g = 'src/lib/gc/edgeKernels.test.ts'
  let u = readFileSync(g, 'utf8')
  u = once(u, "      'lib/bids/pickActiveVersion.ts',\n", "      'lib/bids/pickActiveVersion.ts',\n      // The dev seat's plan_bid_takeoff: the materials total and how a part is sold.\n      'lib/bids/bidMaterials.ts',\n      'lib/materials/orderIncrement.ts',\n", 'edge test list')
  writeFileSync(g, u)
}
console.log('edge entries added')
