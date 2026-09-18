#!/usr/bin/env vite-node
/**
 * Record one pay send through `record_pay_send`, or read where someone stands (v2.3580).
 *
 *   npm run pay:record -- --person Tristen                                   where they stand
 *   npm run pay:record -- --person Tristen --kind apple_pay --amount 1067.23 --date 2026-09-17 \
 *                          --source <mercury_transactions.id> --note "Tristen" [--apply]
 *
 * Kinds: cashapp (source = the Cash App transaction id), mercury / apple_pay (source = the app's
 * mercury_transactions id; apple_pay may go without one until the row posts), client_direct, other.
 * Without `--apply` the function's dry run prints the plan — oldest open report first, the part
 * memo on each row when the send lands on several, any leftover to an advance offset — and
 * writes nothing. With it, the rows are written and the person's position is printed after.
 * Signs in as the owner through dev-login (see scripts/lib/paySession.ts).
 */

import { money, signInAsOwner } from './lib/paySession'
import { isPaySourceKind } from '../src/lib/people/paySources'

type Args = { person: string | null; kind: string | null; amount: number | null; date: string | null; source: string | null; note: string | null; apply: boolean }

function parseArgs(argv: string[]): Args {
  const a: Args = { person: null, kind: null, amount: null, date: null, source: null, note: null, apply: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = () => argv[++i] ?? null
    if (k === '--person') a.person = v()
    else if (k === '--kind') a.kind = v()
    else if (k === '--amount') a.amount = Number(v())
    else if (k === '--date') a.date = v()
    else if (k === '--source') a.source = v()
    else if (k === '--note') a.note = v()
    else if (k === '--apply') a.apply = true
    else if (k === '--help' || k === '-h') {
      console.log('usage: npm run pay:record -- --person <name> [--kind <kind> --amount <n> --date YYYY-MM-DD [--source <id>] [--note <text>] [--apply]]')
      process.exit(0)
    } else throw new Error(`unknown argument ${k}`)
  }
  return a
}

type Report = { period_start: string; period_end: string; net: number; paid: number; remaining: number; payments: Array<{ amount: number; paid_at: string; memo: string | null; source_kind: string | null; source_id: string | null }> }
type Position = { person: string; reports: Report[]; open_total: number; pending_offsets: Array<{ type: string; amount: number; occurred_date: string; description: string | null }>; queue: Array<{ id: string; occurred_date: string; amount: number; note: string | null; lane: string }> }

function printPosition(pos: Position) {
  console.log(`\n${pos.person} — open ${money(pos.open_total)}`)
  for (const r of pos.reports.filter((x) => Number(x.remaining) > 0.005 || x.payments.some((p) => p.paid_at.slice(0, 10) >= new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10)))) {
    console.log(`  ${r.period_start} → ${r.period_end}  net ${money(r.net)}  paid ${money(r.paid)}  remaining ${money(r.remaining)}`)
    for (const p of r.payments) console.log(`      ${p.paid_at.slice(0, 10)}  ${money(p.amount).padStart(10)}  ${p.memo ?? ''}${p.source_kind ? `  [${p.source_kind}${p.source_id ? ' ' + p.source_id.slice(0, 12) : ''}]` : ''}`)
  }
  for (const o of pos.pending_offsets) console.log(`  pending ${o.type} ${money(o.amount)} ${o.occurred_date} ${o.description ?? ''}`)
  for (const q of pos.queue) console.log(`  queue ${q.lane} ${q.occurred_date} ${money(Math.abs(Number(q.amount)))} "${q.note ?? ''}" ${q.id}`)
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (!a.person) throw new Error('--person is required')
  const supabase = await signInAsOwner()

  const position = async () => {
    const { data, error } = await supabase.rpc('pay_position', { p_person: a.person! })
    if (error) throw new Error(`pay_position: ${error.message}`)
    return data as unknown as Position
  }

  if (a.kind === null && a.amount === null) {
    printPosition(await position())
    await supabase.auth.signOut()
    return
  }

  if (!a.kind || !isPaySourceKind(a.kind)) throw new Error('--kind must be cashapp, mercury, apple_pay, client_direct or other')
  if (a.amount === null || !(a.amount > 0)) throw new Error('--amount must be greater than zero')
  if (!a.date || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('--date must be YYYY-MM-DD')

  const call = async (dry: boolean) => {
    const { data, error } = await supabase.rpc('record_pay_send', {
      p_source_kind: a.kind!,
      // the generated type says string (no SQL default); the function takes NULL for apple_pay / client_direct / other
      p_source_id: (a.source ?? null) as unknown as string,
      p_person: a.person!,
      p_amount: a.amount!,
      p_paid_on: a.date!,
      p_note: a.note ?? undefined,
      p_dry_run: dry,
    })
    if (error) throw new Error(`record_pay_send: ${error.message}`)
    return data as unknown as { status: string; memo: string; parts: number; allocations?: Array<{ period_start: string; period_end: string; amount: number; memo: string }>; rows?: Array<{ pay_stub_id: string; amount: number; memo: string; payment_id: string }>; leftover_to_advance: number; offset_description: string | null; cashapp_lane: string | null }
  }

  const plan = await call(true)
  console.log(`\n${a.apply ? 'Recording' : 'Dry run'}: ${a.kind} ${money(a.amount)} to ${a.person} on ${a.date}${a.source ? ` (source ${a.source})` : ''}`)
  console.log(`  status ${plan.status} · memo ${plan.memo} · parts ${plan.parts}`)
  for (const x of plan.allocations ?? []) console.log(`    ${x.period_start} → ${x.period_end}  ${money(x.amount).padStart(10)}  ${x.memo}`)
  if (Number(plan.leftover_to_advance) > 0) console.log(`    advance offset ${money(plan.leftover_to_advance)}  ${plan.offset_description ?? ''}`)
  if (plan.cashapp_lane) console.log(`    cash app queue row → ${plan.cashapp_lane}`)
  if (plan.status === 'already_recorded') console.log('  (already recorded — nothing to do)')

  if (a.apply && plan.status === 'planned') {
    const done = await call(false)
    console.log(`\n  ${done.status}: ${(done.rows ?? []).length} row(s)${Number(done.leftover_to_advance) > 0 ? ` + advance ${money(done.leftover_to_advance)}` : ''}`)
    for (const r of done.rows ?? []) console.log(`    ${r.payment_id}  ${money(r.amount).padStart(10)}  ${r.memo}`)
    printPosition(await position())
  } else if (!a.apply) {
    console.log('\n  nothing written — add --apply to record')
  }
  await supabase.auth.signOut()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
