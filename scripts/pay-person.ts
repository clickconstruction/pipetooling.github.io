#!/usr/bin/env vite-node
/**
 * Person admin from a terminal (v2.3584): clear or set hours, void pay reports, change the pay
 * setup, tie a bank name to a person — each with a reason, each through a function that writes
 * the audit row. Dry run by default: prints what it finds and would do; `--apply` does it and
 * prints the person's position after.
 *
 *   npm run pay:person -- --person "Mike Z" --reason "listed hourly while not working" \
 *       [--clear-hours 2026-03-22..2026-05-16] [--hours 2026-05-04..2026-05-05=6] \
 *       [--void-reports 2026-03-22..2026-05-16] [--config hourly_wage=null,show_in_hours=false] \
 *       [--alias "Michael Zinna"=not_staff | --alias "Jessie Lopez"=Jesse] [--apply]
 *
 * Order on apply: hours, reports, config, alias. A report whose payment carries a real send is
 * refused by the function; unlink or move it first.
 */

import { money, signInAsOwner } from './lib/paySession'

type Range = { from: string; to: string }
type Args = { person: string | null; reason: string | null; clearHours: Range | null; hours: (Range & { hours: number }) | null; voidReports: Range | null; config: Record<string, string | number | boolean | null> | null; aliases: Array<{ counterparty: string; person: string | null; notStaff: boolean }>; apply: boolean }

const DATE = /^\d{4}-\d{2}-\d{2}$/
function range(s: string): Range {
  const [from, to] = s.split('..')
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) throw new Error(`range must be YYYY-MM-DD..YYYY-MM-DD, got "${s}"`)
  return { from, to }
}
function parseArgs(argv: string[]): Args {
  const a: Args = { person: null, reason: null, clearHours: null, hours: null, voidReports: null, config: null, aliases: [], apply: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = () => argv[++i] ?? ''
    if (k === '--person') a.person = v()
    else if (k === '--reason') a.reason = v()
    else if (k === '--clear-hours') a.clearHours = range(v())
    else if (k === '--hours') {
      const [r, h] = v().split('=')
      if (!r || h === undefined || !(Number(h) >= 0)) throw new Error('--hours takes from..to=N')
      a.hours = { ...range(r), hours: Number(h) }
    } else if (k === '--void-reports') a.voidReports = range(v())
    else if (k === '--config') {
      a.config = {}
      for (const pair of v().split(',')) {
        const [key, raw] = pair.split('=')
        if (!key || raw === undefined) throw new Error('--config takes key=value[,key=value]')
        a.config[key.trim()] = raw === 'null' ? null : raw === 'true' ? true : raw === 'false' ? false : Number.isFinite(Number(raw)) ? Number(raw) : raw
      }
    } else if (k === '--alias') {
      const s = v()
      const eq = s.lastIndexOf('=')
      if (eq < 1) throw new Error('--alias takes "Counterparty"=Person or "Counterparty"=not_staff')
      const counterparty = s.slice(0, eq)
      const target = s.slice(eq + 1)
      a.aliases.push({ counterparty, person: target === 'not_staff' ? null : target, notStaff: target === 'not_staff' })
    } else if (k === '--apply') a.apply = true
    else if (k === '--help' || k === '-h') {
      console.log('usage: npm run pay:person -- --person <name> --reason <text> [--clear-hours from..to] [--hours from..to=N] [--void-reports from..to] [--config k=v,...] [--alias "Name"=Person|not_staff] [--apply]')
      process.exit(0)
    } else throw new Error(`unknown argument ${k}`)
  }
  return a
}

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (!a.person) throw new Error('--person is required')
  const wants = !!(a.clearHours || a.hours || a.voidReports || a.config || a.aliases.length)
  if (wants && !a.reason?.trim()) throw new Error('--reason is required for any change')
  const supabase = await signInAsOwner()
  const reason = a.reason ?? ''
  // the v2.3584 functions enter the generated types with the regen after the push; until then, call by name
  const rpc = (name: string, args: Record<string, unknown>) =>
    (supabase as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(name, args)

  // ---- what is there
  const [cfg, stubs, hoursRows, aliasRows] = await Promise.all([
    supabase.from('people_pay_config').select('*').eq('person_name', a.person).maybeSingle(),
    supabase.from('pay_stubs').select('id, period_start, period_end, gross_pay, hours_total, pay_stub_payments(id, amount, paid_at, memo, source_kind, source_id)').eq('person_name', a.person).order('period_start'),
    supabase.from('people_hours').select('work_date, hours').eq('person_name', a.person).order('work_date'),
    a.aliases.length ? supabase.from('cashapp_aliases').select('counterparty, counterparty_key, person_name, not_staff') : Promise.resolve({ data: [] as Array<{ counterparty: string; counterparty_key: string; person_name: string | null; not_staff: boolean }>, error: null }),
  ])
  for (const r of [cfg, stubs, hoursRows, aliasRows]) if (r.error) throw new Error(r.error.message)

  console.log(`\n${a.person} — ${a.apply ? 'APPLY' : 'dry run'}${reason ? ` · reason: ${reason}` : ''}`)
  const c = cfg.data
  console.log(`  pay setup: ${c ? `hourly ${c.hourly_wage ?? '—'} · salary ${c.is_salary} · show in hours ${c.show_in_hours}` : '(no row)'}`)

  const inRange = (d: string, r: Range) => d >= r.from && d <= r.to
  const plan: Array<() => Promise<string>> = []

  if (a.clearHours || a.hours) {
    const r = (a.clearHours ?? a.hours)!
    const rows = (hoursRows.data ?? []).filter((h) => inRange(h.work_date, r))
    const total = rows.reduce((s, h) => s + Number(h.hours), 0)
    console.log(`\n  hours ${r.from}..${r.to}: ${rows.length} row(s), ${total} h${rows.length ? ' — ' + rows.map((h) => `${h.work_date} ${h.hours}h`).join(', ') : ''}`)
    if (a.clearHours) console.log(`    → set all ${rows.length} to 0 h (the grid's convention; rows stay)`)
    else console.log(`    → set every day to ${a.hours!.hours} h`)
    plan.push(async () => {
      const { data, error } = await rpc('set_person_hours', { p_person: a.person!, p_from: r.from, p_to: r.to, p_hours: a.clearHours ? 0 : a.hours!.hours, p_reason: reason })
      if (error) throw new Error(`set_person_hours: ${error.message}`)
      const d = data as { status: string; zeroed: number; set: number; existing: number }
      return `hours ${d.status}: ${d.zeroed} of ${d.existing} row(s) set to 0, ${d.set} day(s) set`
    })
  }

  if (a.voidReports) {
    const r = a.voidReports
    const targets = (stubs.data ?? []).filter((s) => inRange(s.period_start, r) || inRange(s.period_end, r))
    console.log(`\n  reports ${r.from}..${r.to}: ${targets.length}`)
    for (const s of targets) {
      const paid = s.pay_stub_payments.reduce((x, p) => x + Number(p.amount), 0)
      const sourced = s.pay_stub_payments.filter((p) => p.source_id).length
      console.log(`    ${s.period_start} → ${s.period_end}  ${Number(s.hours_total)} h  gross ${money(s.gross_pay)}  paid ${money(paid)} (${s.pay_stub_payments.length} row${s.pay_stub_payments.length === 1 ? '' : 's'}${sourced ? `, ${sourced} tied to a real send — the function will refuse this one` : ''})  ${s.id.slice(0, 8)}`)
    }
    const totalPaid = targets.reduce((x, s) => x + s.pay_stub_payments.reduce((y, p) => y + Number(p.amount), 0), 0)
    console.log(`    → void ${targets.length} report(s); ${money(totalPaid)} of recorded payments go with them (every row lands in the deleted-records archive)`)
    for (const s of targets) plan.push(async () => {
      const { data, error } = await rpc('void_pay_report', { p_stub: s.id, p_reason: reason })
      if (error) throw new Error(`void_pay_report ${s.period_start}: ${error.message}`)
      const d = data as { paid: number; payments: number }
      return `voided ${s.period_start} → ${s.period_end} (${d.payments} payment row(s), ${money(d.paid)})`
    })
  }

  if (a.config) {
    console.log(`\n  pay setup → ${Object.entries(a.config).map(([k, v]) => `${k}=${v === null ? 'null' : String(v)}`).join(', ')}`)
    plan.push(async () => {
      const { data, error } = await rpc('set_pay_config', { p_person: a.person!, p_changes: a.config!, p_reason: reason })
      if (error) throw new Error(`set_pay_config: ${error.message}`)
      const d = data as { after: Record<string, unknown> }
      return `pay setup updated: hourly ${d.after.hourly_wage ?? '—'} · salary ${d.after.is_salary} · show in hours ${d.after.show_in_hours}`
    })
  }

  for (const al of a.aliases) {
    const key = al.counterparty.trim().toLowerCase().replace(/\s+/g, ' ')
    const before = (aliasRows.data ?? []).find((x) => x.counterparty_key === key)
    console.log(`\n  alias "${al.counterparty}": ${before ? `${before.not_staff ? 'not staff' : before.person_name}` : '(none)'} → ${al.notStaff ? 'not staff' : al.person}`)
    plan.push(async () => {
      // every argument named, null included — PostgREST resolves the function by the set of names given
      const { error } = await rpc('set_cashapp_alias', { p_counterparty: al.counterparty, p_person: al.person, p_not_staff: al.notStaff, p_reason: reason })
      if (error) throw new Error(`set_cashapp_alias: ${error.message}`)
      return `alias "${al.counterparty}" → ${al.notStaff ? 'not staff' : al.person}`
    })
  }

  if (!wants) {
    console.log(`\n  reports: ${(stubs.data ?? []).length}; hours rows: ${(hoursRows.data ?? []).length}`)
    for (const s of stubs.data ?? []) console.log(`    ${s.period_start} → ${s.period_end}  ${Number(s.hours_total)} h  gross ${money(s.gross_pay)}  paid ${money(s.pay_stub_payments.reduce((x, p) => x + Number(p.amount), 0))}`)
  } else if (!a.apply) {
    console.log('\n  nothing written — add --apply')
  } else {
    console.log('\n  applying…')
    for (const step of plan) console.log(`    ${await step()}`)
    const { data, error } = await supabase.rpc('pay_position', { p_person: a.person })
    if (error) throw new Error(`pay_position: ${error.message}`)
    const pos = data as { open_total: number; reports: unknown[] }
    console.log(`\n  ${a.person} now: ${pos.reports.length} report(s), open ${money(pos.open_total)}`)
  }
  await supabase.auth.signOut()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
