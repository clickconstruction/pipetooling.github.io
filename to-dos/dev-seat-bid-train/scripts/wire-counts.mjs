// Splices plan_bid_counts / apply_bid_counts into the seat. Each replacement must match exactly once. Re-runnable on a
// fresh copy of main's files (a merge takes main's and runs this again).
import { readFileSync, writeFileSync } from 'node:fs'
const once = (t, a, b, what) => { if (t.split(a).length !== 2) throw new Error(`anchor not found once: ${what}`); return t.replace(a, () => b) }
const only = process.argv[2] // 'kernel' | 'writes' | 'server' | 'edge' | undefined = all

if (!only || only === 'kernel') {
  const f = 'supabase/functions/_shared/devMcpBidCounts.ts'
  let t = readFileSync(f, 'utf8')
  if (!t.includes('export function sheetSummaryWords')) {
    t = once(t, "  const sheetWords = (list: CountRow[], tags: readonly string[]) => [summarizeRowsByUnit(list) || 'no rows', summarizeAlternates(list, tags)].filter(Boolean).join(' · ')\n", '', 'inline sheet words')
    t = t.split('sheetWords(').join('sheetSummaryWords(')
    t = once(t, "export function countsBidLabel(", "/** The sheet's totals in its own words: \"3 counts (9 ea) · 1 line type (48.5 ft) · 1 alternate: Break room (1 ea)\". */\nexport function sheetSummaryWords(list: CountRow[], tags: readonly string[]): string {\n  return [summarizeRowsByUnit(list) || 'no rows', summarizeAlternates(list, tags)].filter(Boolean).join(' · ')\n}\n\nexport function countsBidLabel(", 'sheet words export')
    writeFileSync(f, t)
  }
}

if (!only || only === 'edge') {
  const f = 'scripts/edge-kernels.mjs'
  let t = readFileSync(f, 'utf8')
  t = once(t, "  'lib/bids/submissionSections.ts': { values: [], types: [] },\n", `  'lib/bids/submissionSections.ts': { values: [], types: [] },
  // The dev seat's plan_bid_counts (v2.6967): the Count Sheet's own rules — one row a fixture in a scope, the units, the
  // \`[Group] \` prefix, the active version — so a row the seat writes is a row the sheet would have written. Off the
  // index, like the rest of the seat's bid kernels.
  'lib/bids/countSheet.ts': { values: [], types: [] },
  'lib/bids/countRowUnit.ts': { values: [], types: [] },
  'lib/bids/parseCountsImportText.ts': { values: [], types: [] },
  'lib/bids/pickActiveVersion.ts': { values: [], types: [] },
`, 'edge entries')
  writeFileSync(f, t)
  const g = 'src/lib/gc/edgeKernels.test.ts'
  let u = readFileSync(g, 'utf8')
  u = once(u, "      'lib/bids/submissionSections.ts',\n", "      'lib/bids/submissionSections.ts',\n      // The dev seat's plan_bid_counts (v2.6967): the Count Sheet's rules.\n      'lib/bids/countSheet.ts',\n      'lib/bids/countRowUnit.ts',\n      'lib/bids/parseCountsImportText.ts',\n      'lib/bids/pickActiveVersion.ts',\n", 'edge test list')
  writeFileSync(g, u)
}

if (!only || only === 'writes') {
  const f = 'supabase/functions/_shared/devMcpWrites.ts'
  let t = readFileSync(f, 'utf8')
  t = once(t, "import { bidUpdateInput, isBidUpdateVerb } from './devMcpBidUpdate.ts'\n", "import { bidUpdateInput, isBidUpdateVerb } from './devMcpBidUpdate.ts'\nimport { bidCountsInput, isBidCountsVerb } from './devMcpBidCounts.ts'\n", 'import')
  t = once(t, "  plan_bid_update: { rpc: null, step: 'plan' },\n  apply_bid_update: { rpc: null, step: 'apply' },\n", `  plan_bid_update: { rpc: null, step: 'plan' },
  apply_bid_update: { rpc: null, step: 'apply' },
  // v2.6967 (the bid train's PR 2): a bid's count rows as the Counts tab writes them — a row added as the Count Sheet's
  // quick add adds it, changed as its inline edit changes it, removed as its delete removes it, an alternate joined to
  // the bid's; rpc is null, the dry run the server's read of the bid, its versions and the active version's rows
  // (devMcpBidCounts.ts). A row with a fault is held and the rest goes on.
  plan_bid_counts: { rpc: null, step: 'plan' },
  apply_bid_counts: { rpc: null, step: 'apply' },
`, 'WRITE_VERBS')
  t = once(t, "  if (isBidUpdateVerb(verb)) {\n", `  if (isBidCountsVerb(verb)) {
    // v2.6967: the shape is devMcpBidCounts'; a row with a fault is kept for the plan to hold, never a refusal here.
    const built = bidCountsInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (isBidUpdateVerb(verb)) {
`, 'writeRpcBody')
  t = once(t, "  if (verb === 'apply_bid_update') return ", "  if (verb === 'apply_bid_counts') return `Nothing written: this plan was already applied on this bid${when}. The Count Sheet already reads that way; get_bid lists the rows. A further change needs a new plan from the sheet as it stands.`\n  if (verb === 'apply_bid_update') return ", 'alreadyApplied')
  writeFileSync(f, t)
}

if (!only || only === 'server') {
  const f = 'supabase/functions/dev-mcp/index.ts'
  let t = readFileSync(f, 'utf8')
  t = once(t, "import { bidUpdateAppliedWords,", "import { COUNTS_INSERT_ACTION, bidCountsAppliedWords, bidCountsDryRun, readBidCountsWorld, sheetSummaryWords, type BidCountsPayload, type CountsReads, type PlanRemove, type PlanRow } from '../_shared/devMcpBidCounts.ts'\nimport { bidUpdateAppliedWords,", 'import')
  t = once(t, "// lines, and that a win opens no job. No wrapper RPC, no migration.\n//\n", `// lines, and that a win opens no job. No wrapper RPC, no migration.
//
// __VERSION__ (v2.6967, the bid train's PR 2): plan_bid_counts → apply_bid_counts writes a bid's count rows as the Counts
// tab writes them — a row added as the Count Sheet's quick add adds it (the active version, after the bid's last row,
// the unit pinned, tagged as the sheet's import for the bid's History), changed as the inline edit changes it, removed
// as its delete removes it, and an alternate group joined to bids.alternate_group_tags (devMcpBidCounts.ts). The key is
// the sheet's own rule, one row a fixture in a scope (the base bid or one alternate). A row with a fault is held with
// its reason and the rest goes on; a plan with nothing ready is refused. restRows takes DELETE and extra headers for it.
// No wrapper RPC, no migration.
//
`, 'header note')
  // the row-write helper: DELETE, and extra request headers (the bid history tag)
  t = once(t, "async function restRows(jwt: string, method: 'POST' | 'PATCH', table: string, query: string, body: Record<string, unknown> | Record<string, unknown>[], prefer?: string): Promise<{ ok: boolean; status: number; body: unknown }> {", "async function restRows(jwt: string, method: 'POST' | 'PATCH' | 'DELETE', table: string, query: string, body: Record<string, unknown> | Record<string, unknown>[] | null, prefer?: string, extra?: Record<string, string>): Promise<{ ok: boolean; status: number; body: unknown }> {", 'restRows signature')
  t = once(t, "Prefer: prefer ?? (method === 'POST' ? 'return=representation' : 'return=minimal') },\n    body: JSON.stringify(body),\n  })\n  const text = await res.text()\n  let parsed: unknown = text\n  try {\n    parsed = text ? JSON.parse(text) : null\n  } catch { /* a non-JSON reply is reported as text */ }\n  return { ok: res.ok, status: res.status, body: parsed }", "Prefer: prefer ?? (method === 'POST' ? 'return=representation' : 'return=minimal'), ...(extra ?? {}) },\n    ...(body === null ? {} : { body: JSON.stringify(body) }),\n  })\n  const text = await res.text()\n  let parsed: unknown = text\n  try {\n    parsed = text ? JSON.parse(text) : null\n  } catch { /* a non-JSON reply is reported as text */ }\n  return { ok: res.ok, status: res.status, body: parsed }", 'restRows body')
  t = once(t, "  {\n    name: 'plan_bid_update',\n", `  {
    name: 'plan_bid_counts',
    description: "Dry-run count rows onto a bid (v2.6967), as the Counts tab's Count Sheet writes them, as you under the tab's own RLS: rows = [{ fixture, count, unit?, page?, group?, alternate? }] added or changed, remove = [{ fixture, group? }]. The key is the sheet's own rule, one row a fixture in a scope, where a scope is the base bid or one alternate group: a fixture not on the sheet there is added after the bid's last row (the unit read off its name when left out, as quick add does); one already there is changed in the fields you name (count, unit, page, group); the same fixture twice in a scope is held, as quick add refuses it, so an area is the row's group and not a second row. A \`[Group] \` prefix on a fixture is lifted off the name, as the sheet's import does. alternate: true joins the row's group to the bid's alternates, priced with and without. Rows land on the bid's active version (version_id names another). Held, not refused: a row with no fixture, a count that is not above zero, a unit that is not ea, ft, px or sqft, an alternate with no group, a fixture several rows already wear. A plan with nothing ready is refused. The reply lists every row as add, change, unchanged or held with its reason, every remove with the takeoff lines and prices that go with the row, the sheet's totals before and after in its own words, what follows on Labor and Pricing, and what the verb does not do, under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { counts: { type: 'object', description: '{ bid_id (find_bid), rows?: [{ fixture, count, unit? (ea | ft | px | sqft), page?, group?, alternate? }], remove?: [{ fixture, group? }], version_id? }' } }, required: ['counts'] },
  },
  {
    name: 'apply_bid_counts',
    description: 'Write the count rows you planned: the same counts plus the plan_hash from plan_bid_counts. Reads the sheet again first and writes only when the plan still matches. The new rows go in as one insert tagged as the sheet\\'s import, each changed row as its own edit, each remove as the row\\'s delete, then the alternates onto the bid; a row that fails is named with its reason and the rest still lands. Replies with what landed, what failed and the sheet\\'s totals as they read now.',
    inputSchema: { type: 'object', properties: { counts: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['counts', 'plan_hash'] },
  },
  {
    name: 'plan_bid_update',
`, 'TOOLS')
  t = once(t, "a bid with versions keeps Sent and Won / Lost per GC; since ", "a bid with versions keeps Sent and Won / Lost per GC; plan_bid_counts → apply_bid_counts writes its count rows as the Count Sheet does, one row a fixture in the base bid or in an alternate, added, changed or removed, a faulty row held and the rest going on, since __VERSION__; the update since ", 'INSTRUCTIONS')
  t = once(t, "    case 'plan_bid_update':\n    case 'apply_bid_update': {\n", `    case 'plan_bid_counts':
    case 'apply_bid_counts': {
      // v2.6967 (the bid train's PR 2): a bid's count rows as the Counts tab writes them, under RLS as the dev. No wrapper
      // RPC: the dry run is this server's read of the bid, its versions and the active version's rows (devMcpBidCounts.ts),
      // hashed with the payload; apply reads again and writes only when the hash still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(\`\${name} writes, and only a dev's own key may write.\`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as BidCountsPayload
      const reads: CountsReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readBidCountsWorld(reads, p)
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = bidCountsDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const planRows = dry.reply.rows as PlanRow[]
      const planRemoves = dry.reply.remove as PlanRemove[]
      const label = (dry.reply.bid as { label: string }).label
      const failed: Array<{ n: number | null; what: string; why: string }> = []
      const oneRow = (res: { ok: boolean; status: number; body: unknown }): string | null =>
        !res.ok ? restError(res.status, res.body) : Array.isArray(res.body) && res.body.length === 1 ? null : 'the row let no write through (RLS let no row back)'
      // The new rows: one insert, tagged as the sheet's own import so the bid's History reads them as one action.
      const adds = planRows.filter((r): r is Extract<PlanRow, { status: 'add' }> => r.status === 'add')
      let added = 0
      if (adds.length) {
        const res = await restRows(session, 'POST', 'bids_count_rows', 'select=id', adds.map((a) => a.row), undefined, { 'x-bid-action': COUNTS_INSERT_ACTION })
        added = res.ok && Array.isArray(res.body) ? res.body.length : 0
        if (!res.ok) for (const a of adds) failed.push({ n: a.n, what: a.reads, why: restError(res.status, res.body) })
        else if (added < adds.length) failed.push({ n: null, what: \`\${adds.length - added} of the new rows\`, why: 'the table let them not through (RLS let no row back)' })
      }
      // Each changed row is the sheet's inline edit: its own write, so one that fails never stops the next.
      const changed: Array<{ n: number; reads: string }> = []
      for (const c of planRows) {
        if (c.status !== 'change') continue
        const why = oneRow(await restRows(session, 'PATCH', 'bids_count_rows', \`id=eq.\${c.id}&select=id\`, c.patch, 'return=representation'))
        if (why) failed.push({ n: c.n, what: c.reads, why })
        else changed.push({ n: c.n, reads: c.reads })
      }
      const removed: Array<{ n: number; reads: string }> = []
      for (const r of planRemoves) {
        if (r.status !== 'remove') continue
        const why = oneRow(await restRows(session, 'DELETE', 'bids_count_rows', \`id=eq.\${r.id}&select=id\`, null, 'return=representation'))
        if (why) failed.push({ n: r.n, what: r.reads, why })
        else removed.push({ n: r.n, reads: r.reads })
      }
      // The alternates join the bid's last, as the sheet's import and paste_counts write them: after the rows.
      const alt = dry.reply.alternates as { after: string[]; joined: string[] }
      let alternates: string[] = []
      if (alt.joined.length) {
        const why = oneRow(await restRows(session, 'PATCH', 'bids', \`id=eq.\${p.bid_id}&select=id\`, { alternate_group_tags: alt.after }, 'return=representation'))
        if (why) failed.push({ n: null, what: \`the alternates \${alt.joined.join(', ')}\`, why })
        else alternates = alt.joined
      }
      let sheetNow: string | null = null
      try {
        const now = await readBidCountsWorld(reads, { ...p, rows: [], remove: [] })
        sheetNow = sheetSummaryWords(now.rows, now.bid?.alternate_group_tags ?? [])
      } catch { /* the rows landed; the totals are a courtesy */ }
      const heldInPlan = (dry.reply.counts as { held: number }).held
      return ok(bidCountsAppliedWords(label, { added, changed, removed, alternates }, failed, heldInPlan, sheetNow), { target: p.bid_id })
    }
    case 'plan_bid_update':
    case 'apply_bid_update': {
`, 'case')
  writeFileSync(f, t)
}
console.log('wired', only ?? 'all')
