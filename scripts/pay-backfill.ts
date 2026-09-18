#!/usr/bin/env vite-node
/**
 * Backfill pay sends from the Cash App export and the Mercury payouts (v2.3579).
 *
 *   npm run pay:backfill -- [--csv <cash app export.csv>] [--person <name>] [--out plan.md]
 *                            [--record-review] [--apply]
 *
 * Signs in as the owner through the dev-login function (the secret in `.env.local`), so every
 * write is an ordinary authenticated call — RLS, the read-only blocks and the payroll gate all
 * apply, and rows say who recorded them.
 *
 * Without `--apply` nothing is written: the plan prints (and lands in `--out`). With it:
 *   1. `--csv`: new rows go into cashapp_transactions the way the reconcile modal imports them
 *      (every row; staff sends resolved through cashapp_aliases; unknown counterparties listed
 *      for the modal's names step — the script never invents an alias).
 *   2. Cash App sends and Mercury outgoing payments (alias-resolved) are matched to recorded payments
 *      (`src/lib/cashapp/backfillPlan.ts`): link · correct within $5 · split · file lanes.
 *   3. `--record-review`: sends whose note says pay or advance and that no payment records are
 *      planned through `record_pay_send` (dry run without `--apply`).
 * Every write goes through the v2.3578 functions; each is idempotent on the send, so re-running
 * is safe.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Database } from '../src/types/database'
import { readEnvLocal, signInAsOwner } from './lib/paySession'
import { parseCashAppCsv, isStaffOutflow } from '../src/lib/cashapp/parseCashAppCsv'
import { aliasKey, resolveCashAppPerson, type CashAppAlias } from '../src/lib/cashapp/cashAppAliases'
import { firstReportStarts } from '../src/lib/cashapp/cashAppReconcileInputs'
import { buildBackfillPlan, guessPersonByName, renderBackfillPlan, renderByPerson, summarizeBackfillByPerson, type BackfillAction, type BackfillPayment, type BackfillSend, type MercurySend } from '../src/lib/cashapp/backfillPlan'
import type { CashAppLane } from '../src/lib/cashapp/cashAppLane'
import { PAY_BACKFILL_SINCE, type PaySourceKind } from '../src/lib/people/paySources'

type Args = { csv: string | null; person: string | null; out: string | null; apply: boolean; recordReview: boolean; since: string; only: Set<'link' | 'split' | 'lane'> | null }

function parseArgs(argv: string[]): Args {
  const a: Args = { csv: null, person: null, out: null, apply: false, recordReview: false, since: PAY_BACKFILL_SINCE, only: null }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (k === '--csv') a.csv = argv[++i] ?? null
    else if (k === '--person') a.person = argv[++i] ?? null
    else if (k === '--out') a.out = argv[++i] ?? null
    else if (k === '--apply') a.apply = true
    else if (k === '--record-review') a.recordReview = true
    else if (k === '--since') a.since = argv[++i] ?? PAY_BACKFILL_SINCE
    else if (k === '--only') {
      const kinds = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      if (!kinds.length || kinds.some((x) => !['link', 'split', 'lane'].includes(x))) throw new Error('--only takes a comma list of link, split, lane')
      a.only = new Set(kinds as Array<'link' | 'split' | 'lane'>)
    }
    else if (k === '--help' || k === '-h') {
      console.log('usage: npm run pay:backfill -- [--csv file] [--person name] [--since YYYY-MM-DD] [--only link,split,lane] [--out plan.md] [--record-review] [--apply]')
      process.exit(0)
    } else throw new Error(`unknown argument ${k}`)
  }
  return a
}

const ymd = (iso: string | null) => (iso ?? '').slice(0, 10)

type TxRow = Database['public']['Tables']['cashapp_transactions']['Row']
type AliasRow = Database['public']['Tables']['cashapp_aliases']['Row']

function aliasFromRow(a: AliasRow): CashAppAlias {
  return { counterpartyKey: a.counterparty_key, personName: a.person_name, notStaff: a.not_staff, noteContains: a.note_contains, notePersonName: a.note_person_name }
}

/** The people a proxy account can pay besides its own person (every note-rule target for that counterparty). */
function altPeopleFor(counterparty: string, aliases: ReadonlyMap<string, CashAppAlias>): string[] {
  const a = aliases.get(aliasKey(counterparty))
  return a?.notePersonName && a.personName && a.notePersonName !== a.personName ? [a.notePersonName] : []
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = readEnvLocal()
  const supabase = await signInAsOwner(env)
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null

  // ---- aliases
  const aliasRows = (await supabase.from('cashapp_aliases').select('*')).data ?? []
  const aliases = new Map(aliasRows.map((a) => [a.counterparty_key, aliasFromRow(a)]))

  // ---- 1. import
  let imported = 0
  const unresolved = new Map<string, { count: number; amount: number }>()
  if (args.csv) {
    const text = readFileSync(resolve(args.csv), 'utf8')
    const parsed = parseCashAppCsv(text)
    for (const w of parsed.warnings) console.warn(`csv: ${w}`)
    const existingIds = new Set(((await supabase.from('cashapp_transactions').select('id')).data ?? []).map((r) => r.id))
    const fresh = parsed.rows.filter((r) => !existingIds.has(r.id))
    const inserts = fresh.map((r) => {
      const staff = isStaffOutflow(r)
      const res = staff ? resolveCashAppPerson({ counterparty: r.counterparty, note: r.note }, aliases) : null
      if (staff && res?.kind === 'unknown') {
        const u = unresolved.get(r.counterparty) ?? { count: 0, amount: 0 }
        unresolved.set(r.counterparty, { count: u.count + 1, amount: u.amount + Math.abs(r.amount) })
      }
      return {
        id: r.id,
        occurred_at_text: r.occurredAtText,
        occurred_date: r.occurredDate,
        tx_type: r.txType,
        status: r.status,
        currency: r.currency,
        amount: r.amount,
        fee: r.fee,
        net_amount: r.netAmount,
        counterparty: r.counterparty,
        note: r.note,
        account: r.account,
        lane: (!staff ? 'ignored' : res?.kind === 'not_staff' ? 'not_staff' : 'review') as CashAppLane,
        person_name: res?.kind === 'person' ? res.personName : null,
        imported_by: uid,
      }
    })
    console.log(`csv: ${parsed.rows.length} rows, ${fresh.length} new${args.apply ? '' : ' (not written — dry run)'}`)
    if (args.apply) {
      for (let i = 0; i < inserts.length; i += 200) {
        const { error } = await supabase.from('cashapp_transactions').upsert(inserts.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true })
        if (error) throw new Error(`import: ${error.message}`)
      }
      imported = inserts.length
    }
  }

  // ---- 2. load both sides
  const stubs = (await supabase.from('pay_stubs').select('id, person_name, period_start')).data ?? []
  const personFilter = args.person ? new Set([args.person]) : null
  const reportPeople = [...new Set(stubs.map((s) => s.person_name))]
  // no alias → the one person whose first name matches, strictly (see guessPersonByName); nicknames stay an alias to add
  const resolvePerson = (counterparty: string, note: string): { personName: string | null; guessed: boolean } => {
    const res = resolveCashAppPerson({ counterparty, note }, aliases)
    if (res.kind === 'person') return { personName: res.personName, guessed: false }
    if (res.kind === 'not_staff') return { personName: null, guessed: false }
    const g = guessPersonByName(counterparty, reportPeople)
    return { personName: g, guessed: g !== null }
  }
  let guessedSends = 0
  const stubById = new Map(stubs.map((s) => [s.id, s]))
  const payRows = (await supabase.from('pay_stub_payments').select('id, pay_stub_id, amount, paid_at, memo, source_kind, source_id')).data ?? []
  const payments: BackfillPayment[] = payRows
    .map((p) => {
      const s = stubById.get(p.pay_stub_id)
      return s
        ? { id: p.id, payStubId: p.pay_stub_id, personName: s.person_name, amount: Number(p.amount), paidAt: ymd(p.paid_at), memo: p.memo, sourceKind: (p.source_kind as PaySourceKind | null) ?? null, sourceId: p.source_id ?? null }
        : null
    })
    .filter((p): p is BackfillPayment => !!p && (!personFilter || personFilter.has(p.personName)))

  const txRows: TxRow[] = (await supabase.from('cashapp_transactions').select('*')).data ?? []
  const staffTx = txRows.filter((t) => t.amount < 0 && t.status === 'COMPLETE' && t.tx_type === 'P2P' && t.lane !== 'ignored' && t.lane !== 'not_staff')
  const sends: BackfillSend[] = staffTx
    .map((t) => {
      const res = resolvePerson(t.counterparty ?? '', t.note ?? '')
      if (!t.person_name && res.guessed) guessedSends++
      const personName = t.person_name ?? res.personName
      return { id: t.id, occurredDate: t.occurred_date, amountSent: Math.abs(Number(t.amount)), note: t.note ?? '', counterparty: t.counterparty ?? '', lane: t.lane as CashAppLane, personName, altPersonNames: altPeopleFor(t.counterparty ?? '', aliases) }
    })
    .filter((s) => !personFilter || (s.personName && personFilter.has(s.personName)) || (s.altPersonNames ?? []).some((n) => personFilter.has(n)))

  // Mercury payouts to people are outgoing payments to a named counterparty; the Tally payroll
  // flag marks the debit-card side of the Cash App sends instead (every flagged row is a card
  // charge to "Cash App"), so it cannot pick these — the Cash App aliases resolve the names.
  const { byPerson, earliest } = firstReportStarts(stubs)
  const mercuryRows = earliest
    ? (
        await supabase
          .from('mercury_transactions')
          .select('id, posted_at, amount, counterparty_name, external_memo, note, status, kind')
          .eq('kind', 'outgoingPayment')
          .lt('amount', 0)
          .gte('posted_at', earliest)
          .order('posted_at')
      ).data ?? []
    : []
  const mercury: MercurySend[] = []
  for (const m of mercuryRows) {
    if (m.status && !['sent', 'pending'].includes(m.status)) continue
    const counterparty = m.counterparty_name ?? ''
    const memo = m.external_memo ?? m.note ?? ''
    const alias = resolveCashAppPerson({ counterparty, note: memo }, aliases)
    if (alias.kind === 'not_staff') continue
    const res = resolvePerson(counterparty, memo)
    if (res.guessed) guessedSends++
    const personName = res.personName
    const send: MercurySend = { id: m.id, postedDate: ymd(m.posted_at), amountSent: Math.abs(Number(m.amount)), counterparty, memo, personName, altPersonNames: altPeopleFor(counterparty, aliases) }
    if (!personFilter || (personName && personFilter.has(personName)) || (send.altPersonNames ?? []).some((n) => personFilter.has(n))) mercury.push(send)
  }

  // ---- 3. plan
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.since)) throw new Error('--since must be YYYY-MM-DD')
  const plan = buildBackfillPlan({ sends, payments, mercury, firstReportStartByPerson: byPerson, recordsBeginYmd: earliest ?? undefined, sinceYmd: args.since })
  const lines: string[] = [renderBackfillPlan(plan, { title: `Pay backfill plan — ${new Date().toISOString().slice(0, 10)}${args.person ? ` — ${args.person}` : ''} — since ${args.since}` })]
  // ---- 3b. where each person stands — the app's open balance (net, from pay_position) corrected by the plan
  const people = [...new Set(stubs.map((s) => s.person_name))].filter((n) => !personFilter || personFilter.has(n)).sort()
  const openByPerson: Record<string, number> = {}
  for (const person of people) {
    const { data, error } = await supabase.rpc('pay_position', { p_person: person })
    if (error) throw new Error(`pay_position(${person}): ${error.message}`)
    // open = what is still owed on reports that end on or after the tracking start
    const reports = ((data as { reports?: Array<{ period_end: string; remaining: number }> } | null)?.reports ?? []).filter((r) => r.period_end >= args.since)
    openByPerson[person] = Math.round(reports.reduce((s, r) => s + Math.max(0, Number(r.remaining)), 0) * 100) / 100
  }
  lines.push('', renderByPerson(summarizeBackfillByPerson({ plan, payments, openByPerson })))
  if (guessedSends) lines.push('', `_${guessedSends} send(s) resolved by first name (no alias row) — add the alias in the reconcile modal to make it permanent._`)
  if (unresolved.size) {
    lines.push('', `## Counterparties with no alias (${unresolved.size}) — name them in the reconcile modal`, '')
    for (const [c, u] of [...unresolved].sort((a, b) => b[1].amount - a[1].amount)) lines.push(`- ${c}: ${u.count} sends, $${u.amount.toFixed(2)}`)
  }

  // ---- 4. record_pay_send plans for the review sends (dry run unless --apply)
  const records = plan.actions.filter((a): a is Extract<BackfillAction, { kind: 'record' }> => a.kind === 'record')
  if (args.recordReview && records.length) {
    lines.push('', `## record_pay_send (${records.length}) — ${args.apply ? 'applied' : 'dry run'}`, '')
    if (!args.apply) lines.push('_Each dry-run plan reads the reports as they are now; on apply the sends run oldest first and each later one sees the earlier ones._', '')
    for (const r of records.sort((a, b) => a.occurredDate.localeCompare(b.occurredDate))) {
      const { data, error } = await supabase.rpc('record_pay_send', { p_source_kind: 'cashapp', p_source_id: r.txId, p_person: r.personName, p_amount: r.amountSent, p_paid_on: r.occurredDate, p_note: r.note, p_dry_run: !args.apply })
      if (error) {
        lines.push(`- ${r.personName} ${r.occurredDate} $${r.amountSent.toFixed(2)} "${r.note}" · ERROR ${error.message}`)
        continue
      }
      const d = data as { status: string; allocations?: Array<{ period_start: string; amount: number }>; rows?: Array<{ pay_stub_id: string; amount: number }>; leftover_to_advance: number; cashapp_lane: string | null }
      const alloc = (d.allocations ?? d.rows ?? []).map((x) => `$${Number(x.amount).toFixed(2)}${'period_start' in x ? ` on ${x.period_start}` : ''}`).join(' + ')
      lines.push(`- ${r.personName} ${r.occurredDate} $${r.amountSent.toFixed(2)} "${r.note}" · ${d.status}: ${alloc || 'nothing open'}${Number(d.leftover_to_advance) > 0 ? ` · $${Number(d.leftover_to_advance).toFixed(2)} → advance offset` : ''} · lane ${d.cashapp_lane ?? '-'}`)
    }
  }

  // ---- 5. apply links · splits · lanes
  if (args.apply) {
    lines.push('', `## Applied${args.only ? ` (only ${[...args.only].join(', ')})` : ''}`, '')
    let ok = 0
    let failed = 0
    for (const a of plan.actions) {
      if (args.only && !(args.only as Set<string>).has(a.kind)) continue
      try {
        if (a.kind === 'link') {
          const { error } = await supabase.rpc('link_pay_send', { p_payment_id: a.paymentId, p_source_kind: a.sourceKind, p_source_id: a.sourceId, p_amount: a.amountAfter !== a.amountBefore ? a.amountAfter : undefined })
          if (error) throw new Error(error.message)
        } else if (a.kind === 'split') {
          const { error } = await supabase.rpc('split_pay_payment', { p_payment_id: a.paymentId, p_parts: a.parts })
          if (error) throw new Error(error.message)
        } else if (a.kind === 'lane') {
          const { error } = await supabase.rpc('set_cashapp_lane', { p_id: a.txId, p_lane: a.lane, p_person: a.personName ?? undefined, p_note: a.why })
          if (error) throw new Error(error.message)
        } else continue
        ok++
      } catch (e) {
        failed++
        lines.push(`- FAILED ${a.kind} ${'paymentId' in a ? a.paymentId : 'txId' in a ? a.txId : ''}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    lines.push(`- ${ok} applied, ${failed} failed${imported ? `, ${imported} rows imported` : ''}`)
  } else {
    const would = plan.actions.filter((a) => (a.kind === 'link' || a.kind === 'split' || a.kind === 'lane') && (!args.only || (args.only as Set<string>).has(a.kind)))
    lines.push('', `_Dry run — nothing written. \`--apply\` would run ${would.length} action(s)${args.only ? ` (only ${[...args.only].join(', ')})` : ''}; \`--record-review\` plans the pay/advance sends through record_pay_send._`)
  }

  const text = lines.join('\n')
  console.log(text)
  if (args.out) {
    writeFileSync(resolve(args.out), text + '\n')
    console.log(`\nwrote ${args.out}`)
  }
  await supabase.auth.signOut()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
