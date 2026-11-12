// node docs-counts.mjs <serverVersion> — the docs that carry the seat's verbs, for plan_bid_counts. Each anchor once.
import { readFileSync, writeFileSync } from 'node:fs'
const [, , V, PREV, NEW, LAST_HISTORY, GLOSSARY_SINCE] = process.argv
const Cap = (w) => w[0].toUpperCase() + w.slice(1)
const edit = (f, pairs) => {
  let t = readFileSync(f, 'utf8')
  for (const [a, b, what] of pairs) {
    if (t.split(a).length !== 2) throw new Error(`${f}: anchor not found once: ${what ?? a.slice(0, 50)}`)
    t = t.replace(a, () => b)
  }
  writeFileSync(f, t)
}
const ROW = `| \`plan_bid_counts(counts)\` · \`apply_bid_counts(counts, plan_hash)\` | **Write a bid's count rows as the Counts tab does** (v2.6967 / ${V}, the bid train's PR 2): \`counts = { bid_id, rows?: [{ fixture, count, unit? (ea \\| ft \\| px \\| sqft), page?, group?, alternate? }], remove?: [{ fixture, group? }], version_id? }\`, up to 200 rows a call. **No RPC**: the rows \`BidsCountsTab\` writes (\`bids_count_rows\`) as you under the table's own RLS. **The key is the Count Sheet's own rule** (\`findDuplicateFixture\`), one row a fixture in a scope, where a scope is the base bid or one alternate group; the table has no key of its own. A fixture not on the sheet in its scope is added as quick add adds it (the bid's active version by \`pickActiveVersion\`, after the bid's last row, the unit read off the name by \`classifyCountRowUnit\` when left out, the insert tagged \`counts-import\` for the bid's History); one already there is changed as the inline edit changes it, in the fields the ask names (count, unit, page, group; a null page clears it); a remove is the row's delete, and the plan names the takeoff lines and prices the database deletes with it. A \`[Group] \` prefix on a fixture is lifted off the name, as the sheet's import and twin-mcp's \`paste_counts\` do (the test holds twin-mcp's prefix and unit list to the app's). \`alternate: true\` joins the row's group to \`bids.alternate_group_tags\`, priced with and without; nothing here takes an alternate off. **Held, not refused**: no fixture, a count not above zero, a unit the sheet does not have, an alternate with no group, the same fixture twice in one scope of the ask (quick add refuses it: the area is the row's group, not a second row), a fixture several rows already wear when the group does not pick one, a row also in remove. A plan with nothing ready is refused. The plan lists every row as add, change, unchanged or held with its reason, the sheet's totals before and after in its own words (\`summarizeRowsByUnit\`, \`summarizeAlternates\`), what follows (the Labor tab's load sync mints and moves labor rows the next time it is opened; a new row reads $0 on Pricing until priced), and warns on a sent bid and a locked version (a dev's write passes the lock). The apply writes the new rows in one insert, each changed row and each remove as its own write, then the alternates; a row that fails is named with its reason and the rest still lands, and the reply reads the sheet back. Not done: a note on a row (the sheet has none), the CountTooling import and its sources, the drag order, a rename, taking an alternate off. Kernel \`_shared/devMcpBidCounts.ts\`, tests \`src/lib/devMcp/devMcpBidCounts.test.ts\`. |\n`

edit('docs/dev-mcp/README.md', [
  ['| `plan_file_plans(plans)` · `apply_file_plans(plans, plan_hash)` |', `${ROW}| \`plan_file_plans(plans)\` · \`apply_file_plans(plans, plan_hash)\` |`, 'table row'],
  ['; a bid changed v2.6945 / ', `; a bid's count rows v2.6967 / ${V}; a bid changed v2.6945 / `, 'version list'],
  [`${Cap(PREV)} verbs (forty-five since`, `${Cap(NEW)} verbs (forty-five since`, 'count head'],
  [`${LAST_HISTORY})`, `${LAST_HISTORY}, ${NEW} since v2.6967's bid counts)`, 'count history'],
  ["the two bid update verbs (v2.6945) Edit Bid's own PATCH on `bids` and the outcome line the form leaves the same way,", "the two bid update verbs (v2.6945) Edit Bid's own PATCH on `bids` and the outcome line the form leaves the same way, the two bid counts verbs (v2.6967) the Count Sheet's own rows (`bids_count_rows`) the same way,", 'second path sentence'],
  [`except the ${PREV} \`plan_\` / \`apply_\` / \`revert_\` verbs above`, `except the ${NEW} \`plan_\` / \`apply_\` / \`revert_\` verbs above`, 'refuses count'],
])
edit('docs/GLOSSARY.md', [
  [`Writes are a second path, ${PREV} plan → apply verbs since ${GLOSSARY_SINCE} — `, `Writes are a second path, ${NEW} plan → apply verbs since v2.6967 — `, 'glossary count'],
  ["two over Edit Bid's own row (a bid changed, v2.6945),", "four over a bid's own rows (a bid changed, v2.6945, and its count rows, v2.6967),", 'glossary doors'],
])
edit('docs/ACCESS_CONTROL.md', [
  [`The one write path (v2.3722) is ${PREV} verbs, forty-seven of them POSTing one of twenty named dev-gated RPCs as the dev (`, `The one write path (v2.3722) is ${NEW} verbs, forty-seven of them POSTing one of twenty named dev-gated RPCs as the dev (${NEW} since v2.6967, whose bid counts are the Count Sheet's own rows under the dev's RLS, with no new role and no new policy; `, 'access count'],
])
edit('docs/EDGE_FUNCTIONS.md', [
  ['### dev-mcp\n\n', `### dev-mcp\n\n> **v2.6967 (server ${V}) — a bid's count rows, as the Count Sheet writes them** (the bid train's PR 2, \`to-dos/mcp-servers.md\`): **\`plan_bid_counts\` / \`apply_bid_counts\`** (\`_shared/devMcpBidCounts.ts\`) add, change and remove \`bids_count_rows\` under RLS as the dev, by the sheet's own key (one row a fixture in the base bid or in an alternate, \`findDuplicateFixture\`), on the bid's active version, and join an alternate group to \`bids.alternate_group_tags\`. A new row is the sheet's own insert, tagged \`counts-import\` for the bid's History; a changed row is its inline edit; a remove is its delete, with the cascade named in the plan. A row with a fault is held with its reason and the rest goes on. \`restRows\` takes \`DELETE\` and extra request headers for it. No RPC, no migration. ${Cap(NEW)} write verbs.\n\n`, 'edge note'],
])
edit('to-dos/mcp-servers.md', [
  ['| `plan_file_plans` / `apply_file_plans` | v2.6185 — shipped |', "| `plan_bid_counts` / `apply_bid_counts` | v2.6967 — shipped | A bid's count rows as the Count Sheet writes them: a row added, changed or removed by the sheet's own key (one row a fixture in the base bid or in an alternate), on the active version, an alternate joined to the bid's; a faulty row held and the rest going on. PR 2 of the bid train. |\n| `plan_file_plans` / `apply_file_plans` | v2.6185 — shipped |", 'todo verb row'],
  ['2. **`plan_bid_counts` / `apply_bid_counts`** — rows', '2. **`plan_bid_counts` / `apply_bid_counts`** (**built, v2.6967**, `_shared/devMcpBidCounts.ts`; as built the key is the sheet\'s own, one row a fixture in the base bid or in an alternate, so an area is the row\'s group and never a second row; twin-mcp\'s `paste_counts` keeps its inline copy of the row shaping, held to the app\'s by the test, and switches to the shared kernel in its own PR) — rows', 'todo section item'],
])
console.log('docs ok')
