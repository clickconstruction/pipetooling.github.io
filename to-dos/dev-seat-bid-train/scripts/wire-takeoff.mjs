// Splices plan_bid_takeoff / apply_bid_takeoff into the seat. Each replacement must match exactly once; re-runnable on
// main's copies of the two files.
import { readFileSync, writeFileSync } from 'node:fs'
const once = (t, a, b, what) => { if (t.split(a).length !== 2) throw new Error(`anchor not found once: ${what}`); return t.replace(a, () => b) }
{
  const f = 'supabase/functions/_shared/devMcpWrites.ts'
  let t = readFileSync(f, 'utf8')
  t = once(t, "import { bidCountsInput, isBidCountsVerb } from './devMcpBidCounts.ts'\n", "import { bidCountsInput, isBidCountsVerb } from './devMcpBidCounts.ts'\nimport { bidTakeoffInput, isBidTakeoffVerb } from './devMcpBidTakeoff.ts'\n", 'import')
  t = once(t, "  plan_bid_counts: { rpc: null, step: 'plan' },\n  apply_bid_counts: { rpc: null, step: 'apply' },\n", `  plan_bid_counts: { rpc: null, step: 'plan' },
  apply_bid_counts: { rpc: null, step: 'apply' },
  // v2.6968 (the bid train's PR 3): a bid's takeoff as the Takeoffs tab holds it — the part lines on a count row, added,
  // changed or rewritten whole, and the quoted materials cost each; rpc is null, the dry run the server's read of the
  // bid, the active version's count rows and lines, the parts and their lowest prices (devMcpBidTakeoff.ts).
  plan_bid_takeoff: { rpc: null, step: 'plan' },
  apply_bid_takeoff: { rpc: null, step: 'apply' },
`, 'WRITE_VERBS')
  t = once(t, "  if (isBidCountsVerb(verb)) {\n", `  if (isBidTakeoffVerb(verb)) {
    // v2.6968: the shape is devMcpBidTakeoff's; a row or a line with a fault is kept for the plan to hold.
    const built = bidTakeoffInput(verb, input)
    if (!built.ok) return built
    return { ok: true, rpc: null, step, body: { p: built.p }, dryRunBody: null, target: built.target, planHash }
  }
  if (isBidCountsVerb(verb)) {
`, 'writeRpcBody')
  t = once(t, "  if (verb === 'apply_bid_counts') return ", "  if (verb === 'apply_bid_takeoff') return `Nothing written: this plan was already applied on this bid${when}. The takeoff already reads that way; read_rows on bids_takeoff_rough_part_lines by bid_id lists the lines. A further change needs a new plan from the lines as they stand.`\n  if (verb === 'apply_bid_counts') return ", 'alreadyApplied')
  writeFileSync(f, t)
}
{
  const f = 'supabase/functions/dev-mcp/index.ts'
  let t = readFileSync(f, 'utf8')
  t = once(t, "import { COUNTS_INSERT_ACTION,", "import { bidTakeoffAppliedWords, bidTakeoffDryRun, materialsTotal, readBidTakeoffWorld, type BidTakeoffPayload, type PlanLine, type PlanTakeoffRow, type TakeoffReads } from '../_shared/devMcpBidTakeoff.ts'\nimport { COUNTS_INSERT_ACTION,", 'import')
  t = once(t, "// its reason and the rest goes on; a plan with nothing ready is refused. restRows takes DELETE and extra headers for it.\n// No wrapper RPC, no migration.\n//\n", `// its reason and the rest goes on; a plan with nothing ready is refused. restRows takes DELETE and extra headers for it.
// No wrapper RPC, no migration.
//
// __VERSION__ (v2.6968, the bid train's PR 3): plan_bid_takeoff → apply_bid_takeoff writes what the Takeoffs tab holds on a
// count row — its part lines, each as the tab's own save writes it (the quantity for one counted unit, the book's lowest
// price and its price row when no price is given, how the part is sold snapshotted, after the row's last line), and the
// quoted materials cost each (bid_count_row_custom_costs, one a row) (devMcpBidTakeoff.ts). One line a part on a row:
// the line that carries the part is changed, a new part is added, replace rewrites the row's lines whole. The plan
// states the bid's materials before and after through the tab's own kernel (combinedMaterials, from the kernel copy).
// No wrapper RPC, no migration.
//
`, 'header note')
  t = once(t, "  {\n    name: 'plan_bid_counts',\n", `  {
    name: 'plan_bid_takeoff',
    description: "Dry-run a bid's takeoff (v2.6968), as the Takeoffs tab holds it on a count row, as you under the tab's own RLS: rows = [{ fixture, group?, lines?: [{ part_id | part (its exact name in the bid's trade's parts book), quantity, unit_price? }], replace?, materials_each?, materials_from? }]. The count row is named by the Count Sheet's key (plan_bid_counts adds one). A line's quantity is for ONE counted unit: the row's count multiplies it. With no unit_price a new line takes the parts book's lowest price and remembers the price row; a part with no price lands at $0 and the plan says so; a typed price forgets the price row. The line snapshots how the part is sold (20 ft sticks, a box), so the order rounding works as on the tab. One line a part on a row: the line that already carries the part is changed (its price kept unless you give one), a part not on the row is added after its last line, and replace: true rewrites the row's lines whole (a replace with a held line holds the whole row). materials_each is a quoted materials cost for one counted unit, in dollars, with materials_from naming who quoted it; Pricing costs the row from it over the lines, and null clears it. Held, not refused: a fixture with no count row, a part not found or named by several parts, a part of another trade's book, a quantity not above zero, the same part twice in a row's lines. A plan with nothing ready is refused. The reply lists every row and line as add, change, unchanged or held with its reason, one unit's materials before and after, and the bid's materials before and after, before tax and with order rounding, through the tab's own kernel, under a plan_hash; nothing is written.",
    inputSchema: { type: 'object', properties: { takeoff: { type: 'object', description: '{ bid_id (find_bid), rows: [{ fixture, group?, lines?: [{ part_id | part, quantity, unit_price? }], replace?, materials_each?, materials_from? }], version_id? }' } }, required: ['takeoff'] },
  },
  {
    name: 'apply_bid_takeoff',
    description: 'Write the takeoff you planned: the same takeoff plus the plan_hash from plan_bid_takeoff. Reads the lines again first and writes only when the plan still matches. Row by row: a replace removes the row\\'s lines, the new lines go in as one insert, each changed line is its own write, then the quoted cost is set or cleared; a row that fails is named with its reason and the next row still goes on. Replies with what landed, what failed and the bid\\'s materials as they read now.',
    inputSchema: { type: 'object', properties: { takeoff: { type: 'object' }, plan_hash: { type: 'string' } }, required: ['takeoff', 'plan_hash'] },
  },
  {
    name: 'plan_bid_counts',
`, 'TOOLS')
  t = once(t, "a faulty row held and the rest going on, since ", "a faulty row held and the rest going on; plan_bid_takeoff → apply_bid_takeoff writes the part lines on a count row and the quoted materials cost each, as the Takeoffs tab holds them, a line's quantity for one counted unit, the plan stating the bid's materials before and after, since __VERSION__; the counts since ", 'INSTRUCTIONS')
  t = once(t, "    case 'plan_bid_counts':\n    case 'apply_bid_counts': {\n", `    case 'plan_bid_takeoff':
    case 'apply_bid_takeoff': {
      // v2.6968 (the bid train's PR 3): a bid's takeoff as the Takeoffs tab holds it, under RLS as the dev. No wrapper RPC:
      // the dry run is this server's read of the bid, the active version's count rows and lines, the parts and their
      // lowest prices (devMcpBidTakeoff.ts), hashed with the payload; apply reads again and writes only when the hash
      // still matches. Never as anyone else.
      if (who.role !== 'dev') return refused(\`\${name} writes, and only a dev's own key may write.\`)
      const built = writeRpcBody(name, args)
      if (!built.ok) return refused(built.error)
      const session = await jwt()
      const p = built.body.p as BidTakeoffPayload
      const reads: TakeoffReads = {
        rows: async (table, query) => {
          const res = await restGet(session, table, query)
          if (!res.ok) throw new Error(restError(res.status, res.body))
          return Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : []
        },
      }
      const errored = (text: string): Outcome => ({ log: { status: 'error', target: built.target, error: text }, text, isError: true })
      let world
      try {
        world = await readBidTakeoffWorld(reads, p, { userId: who.userId })
      } catch (e) {
        return errored(e instanceof Error ? e.message : String(e))
      }
      const dry = bidTakeoffDryRun(p, world)
      if (!dry.ok) return refused(dry.refused, { target: built.target })
      const fresh = await planHash(name, p, dry.reply)
      if (built.step === 'plan') return ok(planReply(name, dry.reply, fresh), { target: built.target })
      if (fresh !== built.planHash) return refused(planMismatch(name, built.planHash ?? '', fresh), { target: built.target })
      const prior = await hooks.priorApply(name, fresh)
      if (prior) return refused(alreadyApplied(name, prior), { target: built.target })
      const planRows = dry.reply.rows as PlanTakeoffRow[]
      const label = (dry.reply.bid as { label: string }).label
      const failed: Array<{ n: number; what: string; why: string }> = []
      const done = { rows: 0, added: 0, changed: 0, removed: 0, costs_set: 0, costs_cleared: 0 }
      const rowsBack = (res: { ok: boolean; status: number; body: unknown }): number | string => (!res.ok ? restError(res.status, res.body) : Array.isArray(res.body) ? res.body.length : 0)
      // Row by row, in the tab's order of work: a replace clears the row first, then its lines, then its quoted cost.
      // A row that fails is named and the next row still goes on.
      for (const r of planRows) {
        if (r.status !== 'ready') continue
        const before = failed.length
        if (r.remove_line_ids.length) {
          const got = rowsBack(await restRows(session, 'DELETE', 'bids_takeoff_rough_part_lines', \`id=in.(\${r.remove_line_ids.join(',')})&select=id\`, null, 'return=representation'))
          if (typeof got === 'string') {
            failed.push({ n: r.n, what: \`\${r.reads}: its lines were not removed, so nothing of the row was written\`, why: got })
            continue
          }
          done.removed += got
        }
        const adds = r.lines.filter((l): l is Extract<PlanLine, { status: 'add' }> => l.status === 'add')
        if (adds.length) {
          const got = rowsBack(await restRows(session, 'POST', 'bids_takeoff_rough_part_lines', 'select=id', adds.map((l) => l.row)))
          if (typeof got === 'string') failed.push({ n: r.n, what: \`\${r.reads}: \${adds.length} new line\${adds.length === 1 ? '' : 's'}\`, why: got })
          else done.added += got
        }
        for (const l of r.lines) {
          if (l.status !== 'change') continue
          const got = rowsBack(await restRows(session, 'PATCH', 'bids_takeoff_rough_part_lines', \`id=eq.\${l.id}&select=id\`, l.patch, 'return=representation'))
          if (got === 1) done.changed += 1
          else failed.push({ n: r.n, what: \`\${r.reads}: \${l.reads}\`, why: typeof got === 'string' ? got : 'the line let no write through (RLS let no row back)' })
        }
        if (r.cost?.status === 'set') {
          const got = rowsBack(await restRows(session, 'POST', 'bid_count_row_custom_costs', 'on_conflict=bid_id,count_row_id&select=id', r.cost.row, 'resolution=merge-duplicates,return=representation'))
          if (got === 1) done.costs_set += 1
          else failed.push({ n: r.n, what: \`\${r.reads}: \${r.cost.reads}\`, why: typeof got === 'string' ? got : 'the cost let no write through (RLS let no row back)' })
        } else if (r.cost?.status === 'clear') {
          const got = rowsBack(await restRows(session, 'DELETE', 'bid_count_row_custom_costs', \`id=eq.\${r.cost.id}&select=id\`, null, 'return=representation'))
          if (got === 1) done.costs_cleared += 1
          else failed.push({ n: r.n, what: \`\${r.reads}: \${r.cost.reads}\`, why: typeof got === 'string' ? got : 'the cost let no delete through (RLS let no row back)' })
        }
        if (failed.length === before) done.rows += 1
      }
      let materialsNow: string | null = null
      try {
        const now = await readBidTakeoffWorld(reads, { ...p, rows: [] }, { userId: who.userId })
        materialsNow = \`$\${materialsTotal(now.lines, now.countRows).total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`
      } catch { /* the lines landed; the total is a courtesy */ }
      const heldRows = (dry.reply.counts as { rows_held: number }).rows_held
      return ok(bidTakeoffAppliedWords(label, done, failed, heldRows, materialsNow), { target: p.bid_id })
    }
    case 'plan_bid_counts':
    case 'apply_bid_counts': {
`, 'case')
  writeFileSync(f, t)
}
console.log('wired takeoff')
