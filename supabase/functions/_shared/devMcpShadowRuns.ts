// How the dev seat reads the robots' shadow runs (v2.7947). twin_shadow_runs has no SELECT policy for a signed-in
// person: migration 20260901010000 dropped it so nobody reads a sealed number off the table, and staff read through
// list_shadow_runs(), which keeps the money null until a run is scored. A REST read of the table as the dev is
// therefore not refused: it answers no rows, and a count over it reads zero. Three plans did that on their first live
// run (2026-11-19) and each said nothing moved where something did. Every read of the runs in this seat goes through
// this path, and src/lib/devMcp/devMcpShadowRuns.test.ts refuses a direct one.

/** The path the seat GETs for the runs: the staff RPC, filtered and narrowed like a table. */
export const SHADOW_RUNS_READ = 'rpc/list_shadow_runs'

/** The columns of the RPC's answer the seat's plans read. */
export const SHADOW_RUNS_COLUMNS = ['status', 'axis', 'teacher_name', 'assisted_at', 'shadow_bid_number'] as const
