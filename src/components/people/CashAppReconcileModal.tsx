import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows } from '../../lib/supabasePaging'
import { useToastContext } from '../../contexts/ToastContext'
import type { Database } from '../../types/database'
import { AmountSmallCents } from '../AmountSmallCents'
import { isStaffOutflow, parseCashAppCsv, type CashAppCsvRow } from '../../lib/cashapp/parseCashAppCsv'
import { aliasKey, resolveCashAppPerson, unresolvedCounterparties, type CashAppAlias } from '../../lib/cashapp/cashAppAliases'
import { CASHAPP_LANE_LABEL, classifyCashAppNote, type CashAppLane } from '../../lib/cashapp/cashAppLane'
import { matchCashAppTransactions, type CashAppTxForMatch } from '../../lib/cashapp/matchCashAppTransactions'
import {
  buildAgentSummary,
  countLanes,
  firstReportStarts,
  laneForMatchResult,
  personNameOptions,
  recordedPaymentsForMatch,
  type PaymentForInputs,
  type StubForInputs,
} from '../../lib/cashapp/cashAppReconcileInputs'
import { advanceOffsetInsert, cashAppPaymentMemo, clampRecordAmount, suggestReportForSend, type OpenReportForSend } from '../../lib/cashapp/cashAppDecisions'

type TxRow = Database['public']['Tables']['cashapp_transactions']['Row']
type TxInsert = Database['public']['Tables']['cashapp_transactions']['Insert']
type AliasRow = Database['public']['Tables']['cashapp_aliases']['Row']

export type CashAppReconcileModalProps = {
  stubs: StubForInputs[]
  /** Every report with what it can still take — the Record action's pick list. */
  openReports: OpenReportForSend[]
  paymentsByStubId: Record<string, PaymentForInputs[]>
  users: { name: string | null }[]
  payConfigNames: string[]
  authUser: User | null
  zIndex: number
  onClose: () => void
  /** A payment was recorded on a report — the tab reloads its reports and payments. */
  onRecorded: () => Promise<unknown>
}

type Step = 'upload' | 'names' | 'summary'
type AliasDraft = { personName: string; notStaff: boolean; proxy: boolean; noteContains: string; notePersonName: string }

const btn: CSSProperties = { font: 'inherit', fontSize: '0.875rem', fontWeight: 600, padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'var(--surface)' }
const btnSm: CSSProperties = { ...btn, fontSize: '0.75rem', padding: '0.2rem 0.55rem', whiteSpace: 'nowrap' }
const btnSmGreen: CSSProperties = { ...btnSm, background: 'var(--text-green-700)', borderColor: 'var(--text-green-700)', color: 'var(--surface)' }
const cellRight: CSSProperties = { padding: '0.4rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const cell: CSSProperties = { padding: '0.4rem 0.6rem' }
const inputStyle: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }

function aliasFromRow(a: AliasRow): CashAppAlias {
  return { counterpartyKey: a.counterparty_key, personName: a.person_name, notStaff: a.not_staff, noteContains: a.note_contains, notePersonName: a.note_person_name }
}

function txForMatch(t: Pick<TxRow, 'id' | 'occurred_date' | 'amount' | 'note' | 'counterparty'>, aliases: Map<string, CashAppAlias>): CashAppTxForMatch & { resolution: ReturnType<typeof resolveCashAppPerson> } {
  const resolution = resolveCashAppPerson({ counterparty: t.counterparty, note: t.note }, aliases)
  const alias = aliases.get(aliasKey(t.counterparty))
  const person = resolution.kind === 'person' ? resolution.personName : null
  // A proxy account (Taunya's) may be paying its owner or the note person; try both.
  const alt = alias?.notePersonName && person && alias.personName && alias.personName !== person ? [alias.personName] : alias?.notePersonName && person === alias.personName ? [alias.notePersonName] : []
  return { id: t.id, occurredDate: t.occurred_date, amountSent: Math.abs(Number(t.amount)), note: t.note, personName: person, altPersonNames: alt, resolution }
}

/** Every stored row — paged, because the first export alone is past PostgREST's 1,000-row cap. */
async function loadAllTransactions(): Promise<TxRow[]> {
  return fetchAllRows<TxRow>(
    (from, to) => supabase.from('cashapp_transactions').select('*').order('occurred_date', { ascending: false }).order('id', { ascending: true }).range(from, to),
    'cashapp_transactions',
  )
}

/** Local noon on the send's calendar day, so paid_at lands on that day in any zone. */
function paidAtFromDate(ymd: string): string {
  return new Date(ymd + 'T12:00:00').toISOString()
}

function periodShort(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00'), e = new Date(end + 'T12:00:00')
  const endLabel = s.getMonth() === e.getMonth() ? `${e.getDate()}` : `${e.getMonth() + 1}/${e.getDate()}`
  return `${s.getMonth() + 1}/${s.getDate()}–${endLabel}`
}

/**
 * Import the Cash App activity export and reconcile it against recorded pay-report payments.
 * Three steps: upload (parse + what's new), names (tie unknown Cash App names to people, with an
 * optional proxy rule), and the summary (lanes, the to-review list with one-click decisions, and
 * an agent-readable text). Every import re-runs the matcher only over rows still in review, so
 * decisions already made are never undone.
 */
export function CashAppReconcileModal({ stubs, openReports, paymentsByStubId, users, payConfigNames, authUser, zIndex, onClose, onRecorded }: CashAppReconcileModalProps) {
  const { showToast } = useToastContext()
  const [step, setStep] = useState<Step>('upload')
  const [existing, setExisting] = useState<TxRow[] | null>(null)
  const [aliasRows, setAliasRows] = useState<AliasRow[]>([])
  const [parsed, setParsed] = useState<{ fileName: string; rows: CashAppCsvRow[]; warnings: string[] } | null>(null)
  const [aliasDraft, setAliasDraft] = useState<Record<string, AliasDraft>>({})
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  /** The review row whose Record editor is open, and its draft. */
  const [recordFor, setRecordFor] = useState<{ txId: string; reportId: string; amount: string } | null>(null)
  const [deciding, setDeciding] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const aliases = useMemo(() => new Map(aliasRows.map((a) => [a.counterparty_key, aliasFromRow(a)])), [aliasRows])
  const names = useMemo(() => personNameOptions({ users, payConfigNames, stubs }), [users, payConfigNames, stubs])

  const load = useCallback(async () => {
    const [tx, al] = await Promise.all([
      loadAllTransactions(),
      withSupabaseRetry(async () => await supabase.from('cashapp_aliases').select('*'), 'load cashapp aliases'),
    ])
    setExisting(tx)
    setAliasRows((al ?? []) as AliasRow[])
  }, [])

  useEffect(() => {
    void load().catch((e) => showToast(e instanceof Error ? e.message : 'Failed to load Cash App data', 'error'))
  }, [load, showToast])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Which uploaded rows are new (by Cash App id)?
  const existingIds = useMemo(() => new Set((existing ?? []).map((t) => t.id)), [existing])
  const newRows = useMemo(() => (parsed ? parsed.rows.filter((r) => !existingIds.has(r.id)) : []), [parsed, existingIds])
  const newStaff = useMemo(() => newRows.filter(isStaffOutflow), [newRows])

  // Unknown names across what is about to be imported and what already sits unresolved.
  const unresolved = useMemo(() => {
    const pool = [
      ...newStaff.map((r) => ({ counterparty: r.counterparty, note: r.note, amount: r.amount })),
      ...(existing ?? []).filter((t) => t.lane === 'review' && !t.person_name).map((t) => ({ counterparty: t.counterparty, note: t.note, amount: Number(t.amount) })),
    ]
    return unresolvedCounterparties(pool, aliases)
  }, [newStaff, existing, aliases])

  const onFile = async (file: File) => {
    const text = await file.text()
    const out = parseCashAppCsv(text)
    if (out.rows.length === 0) {
      showToast(out.warnings[0] ?? 'No rows found', 'error')
      return
    }
    setParsed({ fileName: file.name, rows: out.rows, warnings: out.warnings })
  }

  const setDraft = (counterparty: string, patch: Partial<AliasDraft>) =>
    setAliasDraft((prev) => ({ ...prev, [counterparty]: { ...(prev[counterparty] ?? { personName: '', notStaff: false, proxy: false, noteContains: '', notePersonName: '' }), ...patch } }))

  const saveAliasesAndImport = async () => {
    if (existing === null) return
    setBusy(true)
    try {
      // 1. aliases from the names step
      const upserts = Object.entries(aliasDraft)
        .filter(([, v]) => v.notStaff || v.personName.trim())
        .map(([counterparty, v]) => {
          const proxyOn = !v.notStaff && v.proxy && v.noteContains.trim() && v.notePersonName.trim()
          return {
            counterparty_key: aliasKey(counterparty),
            counterparty: counterparty.trim(),
            person_name: v.notStaff ? null : v.personName.trim(),
            not_staff: v.notStaff,
            note_contains: proxyOn ? v.noteContains.trim() : null,
            note_person_name: proxyOn ? v.notePersonName.trim() : null,
            updated_at: new Date().toISOString(),
            updated_by: authUser?.id ?? null,
          }
        })
      if (upserts.length) {
        await withSupabaseRetry(async () => await supabase.from('cashapp_aliases').upsert(upserts, { onConflict: 'counterparty_key' }), 'save cashapp aliases')
      }
      const aliasList = (await withSupabaseRetry(async () => await supabase.from('cashapp_aliases').select('*'), 'reload cashapp aliases')) ?? []
      const aliasMap = new Map((aliasList as AliasRow[]).map((a) => [a.counterparty_key, aliasFromRow(a)]))

      // 2. insert new rows (every row, not only staff sends — the export is the record)
      if (newRows.length) {
        const inserts: TxInsert[] = newRows.map((r) => {
          const staff = isStaffOutflow(r)
          const res = staff ? resolveCashAppPerson({ counterparty: r.counterparty, note: r.note }, aliasMap) : null
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
            lane: !staff ? 'ignored' : res?.kind === 'not_staff' ? 'not_staff' : 'review',
            person_name: res?.kind === 'person' ? res.personName : null,
            imported_by: authUser?.id ?? null,
          }
        })
        for (let i = 0; i < inserts.length; i += 200) {
          const chunk = inserts.slice(i, i + 200)
          await withSupabaseRetry(async () => await supabase.from('cashapp_transactions').upsert(chunk, { onConflict: 'id', ignoreDuplicates: true }), 'import cashapp transactions')
        }
      }

      // 3. re-match everything still in review
      const all = await loadAllTransactions()
      const review = all.filter((t) => t.lane === 'review')
      const linkedPaymentIds = new Set(all.filter((t) => t.pay_stub_payment_id).map((t) => t.pay_stub_payment_id as string))
      const payments = recordedPaymentsForMatch(stubs, paymentsByStubId).filter((p) => !linkedPaymentIds.has(p.id))
      const { byPerson, earliest } = firstReportStarts(stubs)
      const txs = review.map((t) => txForMatch(t, aliasMap))
      const { results } = matchCashAppTransactions(txs, payments, { firstReportStartByPerson: byPerson, recordsBeginYmd: earliest ?? undefined })
      const now = new Date().toISOString()
      const updates: Array<Partial<TxRow> & { id: string }> = []
      for (const [i, r] of results.entries()) {
        const t = txs[i]!
        const resolvedPerson = t.resolution.kind === 'person' ? t.resolution.personName : null
        if (t.resolution.kind === 'not_staff') {
          updates.push({ id: r.txId, lane: 'not_staff', person_name: null, decided_at: now, decided_by: authUser?.id ?? null })
          continue
        }
        const { lane, matchRule, paymentId } = laneForMatchResult(r)
        const personName = r.outcome === 'matched' ? r.personName : resolvedPerson
        const current = review.find((x) => x.id === r.txId)
        if (current && current.lane === lane && current.person_name === personName && current.match_rule === matchRule && current.pay_stub_payment_id === paymentId) continue
        updates.push({ id: r.txId, lane, person_name: personName, match_rule: matchRule, pay_stub_payment_id: paymentId, decided_at: lane === 'review' ? null : now, decided_by: null })
      }
      // One upsert per 200 rows instead of one update per row (the first import files ~1,000).
      const byId = new Map(all.map((t) => [t.id, t]))
      const fullRows = updates.map((u) => ({ ...(byId.get(u.id) as TxRow), ...u }))
      for (let i = 0; i < fullRows.length; i += 200) {
        const chunk = fullRows.slice(i, i + 200)
        await withSupabaseRetry(async () => await supabase.from('cashapp_transactions').upsert(chunk, { onConflict: 'id' }), 'file cashapp transactions')
      }
      await load()
      setParsed(null)
      setAliasDraft({})
      setStep('summary')
      showToast(`${newRows.length} new row${newRows.length === 1 ? '' : 's'} imported · ${updates.filter((u) => u.lane === 'recorded').length} matched to recorded payments`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ---- decisions on a review row ----
  /** File a row without writing money anywhere: expense, skipped, or already on a report under another amount. */
  const decideLane = async (t: TxRow, lane: 'expense' | 'ignored' | 'recorded') => {
    setDeciding(t.id)
    try {
      const patch = { lane, match_rule: lane === 'recorded' ? ('manual' as const) : t.match_rule, decided_at: new Date().toISOString(), decided_by: authUser?.id ?? null }
      await withSupabaseRetry(async () => await supabase.from('cashapp_transactions').update(patch).eq('id', t.id), 'file cashapp transaction')
      setExisting((prev) => (prev ? prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) : prev))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not file it', 'error')
    } finally {
      setDeciding(null)
    }
  }

  const fileAdvance = async (t: TxRow) => {
    if (!t.person_name) return
    setDeciding(t.id)
    try {
      const ins = advanceOffsetInsert({ personName: t.person_name, txId: t.id, note: t.note, amountSent: Math.abs(Number(t.amount)), occurredDate: t.occurred_date })
      const { data, error } = await supabase.from('person_offsets').insert(ins).select('id').single()
      if (error) throw new Error(error.message)
      const offsetId = (data as { id: string }).id
      await withSupabaseRetry(
        async () => await supabase.from('cashapp_transactions').update({ lane: 'advance', person_offset_id: offsetId, decided_at: new Date().toISOString(), decided_by: authUser?.id ?? null }).eq('id', t.id),
        'file cashapp advance',
      )
      setExisting((prev) => (prev ? prev.map((x) => (x.id === t.id ? { ...x, lane: 'advance', person_offset_id: offsetId } : x)) : prev))
      showToast(`Advance filed for ${t.person_name} — it will be offered as a Less line on their next report.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not file the advance', 'error')
    } finally {
      setDeciding(null)
    }
  }

  const recordPayment = async (t: TxRow) => {
    if (!recordFor || recordFor.txId !== t.id || !t.person_name) return
    const report = openReports.find((r) => r.id === recordFor.reportId)
    if (!report) return
    const amount = clampRecordAmount(recordFor.amount, report.remaining)
    if (amount === null) {
      showToast('Enter an amount greater than zero.', 'warning')
      return
    }
    setDeciding(t.id)
    try {
      const { data, error } = await supabase
        .from('pay_stub_payments')
        .insert({ pay_stub_id: report.id, amount, paid_at: paidAtFromDate(t.occurred_date), memo: cashAppPaymentMemo(t.id, t.note), created_by: authUser?.id ?? null })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      const paymentId = (data as { id: string }).id
      await withSupabaseRetry(
        async () =>
          await supabase
            .from('cashapp_transactions')
            .update({ lane: 'recorded', match_rule: 'manual', pay_stub_payment_id: paymentId, decided_at: new Date().toISOString(), decided_by: authUser?.id ?? null })
            .eq('id', t.id),
        'link cashapp payment',
      )
      setExisting((prev) => (prev ? prev.map((x) => (x.id === t.id ? { ...x, lane: 'recorded', match_rule: 'manual', pay_stub_payment_id: paymentId } : x)) : prev))
      setRecordFor(null)
      showToast(`Recorded $${amount.toFixed(2)} on ${t.person_name}'s ${periodShort(report.periodStart, report.periodEnd)} report.`, 'success')
      await onRecorded()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not record the payment', 'error')
    } finally {
      setDeciding(null)
    }
  }

  // Summary data
  const staffRows = useMemo(() => (existing ?? []).filter((t) => t.lane !== 'ignored'), [existing])
  const counts = useMemo(() => countLanes(staffRows.map((t) => ({ lane: t.lane as CashAppLane, amount: Number(t.amount) }))), [staffRows])
  const reviewRows = useMemo(
    // Known people first (A→Z), unknown names after them; oldest send first within a person.
    () =>
      [...staffRows.filter((t) => t.lane === 'review')].sort(
        (a, b) => Number(!a.person_name) - Number(!b.person_name) || (a.person_name ?? a.counterparty).localeCompare(b.person_name ?? b.counterparty) || a.occurred_date.localeCompare(b.occurred_date),
      ),
    [staffRows],
  )
  const latestDate = useMemo(() => (existing && existing.length ? existing.reduce((m, t) => (t.occurred_date > m ? t.occurred_date : m), existing[0]!.occurred_date) : null), [existing])
  const summaryText = useMemo(
    () =>
      buildAgentSummary({
        counts,
        review: reviewRows.map((t) => ({ id: t.id, occurredDate: t.occurred_date, personName: t.person_name, counterparty: t.counterparty, amount: Number(t.amount), note: t.note })),
        unknownNames: unresolved.map((u) => ({ counterparty: u.counterparty, count: u.count, total: u.total })),
        latestImportDate: latestDate,
      }),
    [counts, reviewRows, unresolved, latestDate],
  )

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast('Copy failed — select the text and copy it', 'error')
    }
  }

  // First open with nothing imported yet → stay on upload; otherwise open on the summary.
  useEffect(() => {
    if (existing && existing.length > 0 && step === 'upload' && !parsed) setStep('summary')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first load
  }, [existing === null])

  const stepPill = (s: Step, label: string) => (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 999, background: step === s ? 'var(--text-link)' : 'var(--bg-subtle)', color: step === s ? 'var(--surface)' : 'var(--text-muted)' }}>{label}</span>
  )

  const openRecordEditor = (t: TxRow) => {
    if (!t.person_name) return
    const s = suggestReportForSend({ personName: t.person_name, sendDate: t.occurred_date, amountSent: Math.abs(Number(t.amount)), reports: openReports })
    if (!s.suggestedId) {
      showToast(`${t.person_name} has no report with anything left to pay — file it as an advance, or generate their report first.`, 'warning')
      return
    }
    setRecordFor({ txId: t.id, reportId: s.suggestedId, amount: s.suggestedAmount.toFixed(2) })
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashapp-reconcile-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) onClose()
        }}
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 960, width: '100%', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="cashapp-reconcile-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              Cash App reconcile
            </h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Upload the Cash App activity export; sends to staff are matched to recorded pay-report payments, and what's left is listed to review.
            </p>
          </div>
          <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
            {stepPill('upload', '1 Upload')}
            {stepPill('names', '2 Names')}
            {stepPill('summary', '3 Summary')}
          </div>
          <button type="button" onClick={onClose} disabled={busy} title="Close" aria-label="Close" style={{ ...btn, padding: '0.35rem 0.65rem' }}>
            ×
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          {existing === null ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : step === 'upload' ? (
            <div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                In Cash App: <b>Activity → Statements → Export CSV</b>. Upload the file as it comes; every row is kept and keyed by its Transaction ID, so a bigger export later only adds what's new.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onFile(f)
                }}
                style={{ font: 'inherit', fontSize: '0.875rem' }}
              />
              {parsed ? (
                <div style={{ marginTop: '0.9rem', padding: '0.75rem 0.9rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 600 }}>{parsed.fileName}</div>
                  <div style={{ color: 'var(--text-700)', marginTop: 4 }}>
                    {parsed.rows.length} rows · <b>{newRows.length} new</b> ({newStaff.length} sends to staff) · {parsed.rows.length - newRows.length} already imported
                  </div>
                  {parsed.warnings.map((w) => (
                    <div key={w} style={{ color: 'var(--text-amber-700)', marginTop: 4 }}>
                      {w}
                    </div>
                  ))}
                  {existing.length > 0 && newRows.length === 0 ? <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Nothing new in this file.</div> : null}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                {existing.length > 0 ? (
                  <button type="button" style={btn} onClick={() => setStep('summary')}>
                    Skip to summary
                  </button>
                ) : null}
                <button type="button" style={btnPrimary} disabled={!parsed} onClick={() => setStep('names')}>
                  Next: names →
                </button>
              </div>
            </div>
          ) : step === 'names' ? (
            <div>
              {unresolved.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>Every Cash App name in this batch is already tied to a person.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                    {unresolved.length} Cash App name{unresolved.length === 1 ? '' : 's'} not tied to a person yet. Pick who each one is, or mark it not staff. Leave one blank to decide later. <b>Proxy</b> is for an account that also pays someone else when the note says so.
                  </p>
                  <datalist id="cashapp-person-names">
                    {names.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ ...cell, textAlign: 'left' }}>Cash App name</th>
                        <th style={cellRight}>Sends</th>
                        <th style={cellRight}>Total</th>
                        <th style={{ ...cell, textAlign: 'left' }}>Notes seen</th>
                        <th style={{ ...cell, textAlign: 'left' }}>Is</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unresolved.map((u) => {
                        const d = aliasDraft[u.counterparty] ?? { personName: '', notStaff: false, proxy: false, noteContains: '', notePersonName: '' }
                        return (
                          <tr key={u.counterparty} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={cell}>{u.counterparty}</td>
                            <td style={cellRight}>{u.count}</td>
                            <td style={cellRight}>
                              <AmountSmallCents value={u.total} />
                            </td>
                            <td style={{ ...cell, color: 'var(--text-muted)', fontSize: '0.75rem' }}>{u.notes.join(' · ')}</td>
                            <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                              <input list="cashapp-person-names" value={d.personName} disabled={d.notStaff} placeholder="Person…" aria-label={`Person for ${u.counterparty}`} onChange={(e) => setDraft(u.counterparty, { personName: e.target.value, notStaff: false })} style={{ ...inputStyle, width: 150 }} />
                              <label style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={d.notStaff} onChange={(e) => setDraft(u.counterparty, { personName: '', notStaff: e.target.checked, proxy: false })} /> not staff
                              </label>
                              {!d.notStaff ? (
                                <label style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                  <input type="checkbox" checked={d.proxy} onChange={(e) => setDraft(u.counterparty, { proxy: e.target.checked })} /> proxy
                                </label>
                              ) : null}
                              {d.proxy && !d.notStaff ? (
                                <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  when the note contains{' '}
                                  <input value={d.noteContains} placeholder="tristen" aria-label={`Note word for ${u.counterparty}`} onChange={(e) => setDraft(u.counterparty, { noteContains: e.target.value })} style={{ ...inputStyle, width: 90 }} /> it's for{' '}
                                  <input list="cashapp-person-names" value={d.notePersonName} placeholder="Person…" aria-label={`Note person for ${u.counterparty}`} onChange={(e) => setDraft(u.counterparty, { notePersonName: e.target.value })} style={{ ...inputStyle, width: 130 }} />
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button type="button" style={btn} onClick={() => setStep('upload')} disabled={busy}>
                  ← Back
                </button>
                <button type="button" style={btnPrimary} onClick={() => void saveAliasesAndImport()} disabled={busy}>
                  {busy ? 'Importing…' : parsed ? `Import ${newRows.length} new and match →` : 'Save names and re-match →'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {(['recorded', 'review', 'advance', 'expense', 'before_records', 'not_staff'] as const).map((lane) => (
                  <span key={lane} title={CASHAPP_LANE_LABEL[lane]} style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: lane === 'review' && counts.review.count ? 'var(--bg-amber-tint)' : 'var(--surface)', color: lane === 'review' && counts.review.count ? 'var(--text-amber-700)' : 'var(--text-700)' }}>
                    {CASHAPP_LANE_LABEL[lane]} <b>{counts[lane].count}</b> · <AmountSmallCents value={counts[lane].amount} />
                  </span>
                ))}
              </div>
              {unresolved.length ? (
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>
                  {unresolved.length} Cash App name{unresolved.length === 1 ? '' : 's'} still not tied to a person —{' '}
                  <button type="button" onClick={() => setStep('names')} style={{ ...btn, padding: '0.1rem 0.5rem', fontSize: '0.78rem' }}>
                    tie them
                  </button>
                </p>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <h3 style={{ margin: '0.25rem 0 0.4rem', fontSize: '0.9375rem' }}>To review · {reviewRows.length}</h3>
                <span style={{ display: 'inline-flex', gap: '0.5rem' }}>
                  <button type="button" style={btn} onClick={() => void copySummary()}>
                    {copied ? 'Copied' : 'Copy summary'}
                  </button>
                  <button type="button" style={btn} onClick={() => setStep('upload')}>
                    Import another export
                  </button>
                </span>
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <b>Record</b> writes the send as a payment on one of the person's reports (the memo keeps the Cash App ID). <b>Advance</b> files it as a pending offset, offered as a Less line on their next report. <b>Already recorded</b> is for money that sits on a report under a different amount or date. <b>Not pay</b> and <b>Skip</b> just file it.
              </p>
              {reviewRows.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nothing waiting. Every send to staff is recorded, filed, or before records began.</p>
              ) : (
                <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ ...cell, textAlign: 'left' }}>Date</th>
                        <th style={{ ...cell, textAlign: 'left' }}>Person</th>
                        <th style={cellRight}>Sent</th>
                        <th style={{ ...cell, textAlign: 'left' }}>Note</th>
                        <th style={{ ...cell, textAlign: 'left' }}>Cash App ID</th>
                        <th style={{ ...cell, textAlign: 'left' }}>Decide</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewRows.map((t) => {
                        const kind = classifyCashAppNote(t.note)
                        const editing = recordFor?.txId === t.id ? recordFor : null
                        const isBusy = deciding === t.id
                        const options = editing ? suggestReportForSend({ personName: t.person_name ?? '', sendDate: t.occurred_date, amountSent: Math.abs(Number(t.amount)), reports: openReports }).options : []
                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', opacity: isBusy ? 0.6 : 1 }}>
                            <td style={{ ...cell, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{t.occurred_date}</td>
                            <td style={cell}>{t.person_name ?? <span style={{ color: 'var(--text-amber-700)' }}>? {t.counterparty}</span>}</td>
                            <td style={cellRight}>
                              <AmountSmallCents value={Math.abs(Number(t.amount))} />
                            </td>
                            <td style={cell}>
                              {t.note}
                              {kind !== 'pay' ? <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>({kind})</span> : null}
                            </td>
                            <td style={{ ...cell, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.id}</td>
                            <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                              {editing ? (
                                <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                                  <select value={editing.reportId} aria-label="Report to record on" onChange={(e) => setRecordFor({ ...editing, reportId: e.target.value })} style={{ ...inputStyle, maxWidth: 200 }}>
                                    {options.map((o) => (
                                      <option key={o.id} value={o.id}>
                                        {periodShort(o.periodStart, o.periodEnd)} · ${o.remaining.toFixed(2)} left
                                      </option>
                                    ))}
                                  </select>
                                  <input value={editing.amount} aria-label="Amount to record" onChange={(e) => setRecordFor({ ...editing, amount: e.target.value })} style={{ ...inputStyle, width: 80, textAlign: 'right' }} />
                                  <button type="button" style={btnSmGreen} disabled={isBusy} onClick={() => void recordPayment(t)}>
                                    Save
                                  </button>
                                  <button type="button" style={btnSm} disabled={isBusy} onClick={() => setRecordFor(null)}>
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', gap: '0.3rem' }}>
                                  <button type="button" style={btnSmGreen} disabled={isBusy || !t.person_name} title={t.person_name ? 'Record this send as a payment on one of their reports' : 'Tie the name to a person first'} onClick={() => openRecordEditor(t)}>
                                    Record
                                  </button>
                                  <button type="button" style={btnSm} disabled={isBusy || !t.person_name} title="File as an advance: a pending offset, offered as a Less line on their next report" onClick={() => void fileAdvance(t)}>
                                    Advance
                                  </button>
                                  <button type="button" style={btnSm} disabled={isBusy} title="Its money is already on a report under a different amount or date — count it as recorded without writing a payment" onClick={() => void decideLane(t, 'recorded')}>
                                    Already recorded
                                  </button>
                                  <button type="button" style={btnSm} disabled={isBusy} title="Not pay (gas, reimbursement, …)" onClick={() => void decideLane(t, 'expense')}>
                                    Not pay
                                  </button>
                                  <button type="button" style={btnSm} disabled={isBusy} title="Leave it out of the estimate" onClick={() => void decideLane(t, 'ignored')}>
                                    Skip
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-link)' }}>Summary as text (what Copy summary gives an agent)</summary>
                <pre style={{ margin: '0.5rem 0 0', padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto' }}>{summaryText}</pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
