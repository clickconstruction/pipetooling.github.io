import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { fetchDispatchModeDayBlocks, type DispatchModeAgendaBlock } from '../../lib/dispatchModeSchedule'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import SwipeToConfirm from '../shared/SwipeToConfirm'
import { PO_LONG_PRESS_MS, applyOtherMoveLocally, otherIdSet, partitionByOther } from '../../lib/dispatchPoOther'
import type { DispatchPoOtherKind, DispatchPoOtherRow } from '../../lib/dispatchPoOther'

/**
 * Dispatch Mode → PO tab (gear-menu opt-in): mint a material PO code from a
 * phone in three taps — job (today's schedule first), who it's for (people on
 * that job first), optional supply house — then hand the big code off by copy
 * or text. Uses the same `insert_material_po_generator_entry` RPC and ledger
 * as Materials → PO Generator (dev/master/assistant only, enforced there too).
 */

type PoJobPick = {
  id: string
  hcpNumber: string | null
  jobName: string
  jobAddress: string
  customerName: string
  serviceTypeName: string | null
}

type PoPersonPick = { id: string; name: string; phone: string | null }

type PoSupplyHousePick = { id: string; name: string }

type PoLedgerRow = {
  id: string
  po_code: number
  notes: string | null
  created_at: string | null
  job: { hcp_number: string | null; job_name: string | null } | null
  for_user: { name: string | null } | null
  supply_house: { name: string | null } | null
}

type PoResult = {
  code: number
  jobLabel: string
  personName: string
  personPhone: string | null
  supplyHouseName: string | null
}

const LAST_SUPPLY_HOUSE_KEY_PREFIX = 'dispatch_po_last_sh_'

/** Haptic tick where supported (Android Chrome; iOS Safari ignores). */
function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // ignore
  }
}

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    // Selected = bold orange ring (v2.957); padding compensates the wider border so chips don't shift.
    padding: selected ? 'calc(0.45rem - 1px) calc(0.8rem - 1px)' : '0.45rem 0.8rem',
    fontSize: '0.875rem',
    fontWeight: selected ? 700 : 500,
    border: selected ? '2px solid #f97316' : '1px solid var(--border-strong)',
    borderRadius: 999,
    background: selected ? 'var(--bg-subtle)' : 'var(--surface)',
    color: selected ? 'var(--text-strong)' : 'var(--text-700)',
    cursor: 'pointer',
  }
}

function stepLabel(n: number, text: string) {
  return (
    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', margin: '1rem 0 0.4rem' }}>
      {n}. {text}
    </div>
  )
}

export default function DispatchModePo() {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const todayYmd = useMemo(() => denverCalendarDayKey(Date.now()), [])

  const [todayBlocks, setTodayBlocks] = useState<DispatchModeAgendaBlock[]>([])
  const [supplyHouses, setSupplyHouses] = useState<PoSupplyHousePick[]>([])
  const [ledger, setLedger] = useState<PoLedgerRow[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(true)

  const [job, setJob] = useState<PoJobPick | null>(null)
  const [jobSearch, setJobSearch] = useState('')
  const [jobResults, setJobResults] = useState<PoJobPick[]>([])
  const [jobSearching, setJobSearching] = useState(false)
  const [person, setPerson] = useState<PoPersonPick | null>(null)
  const [people, setPeople] = useState<PoPersonPick[]>([])
  const [supplyHouse, setSupplyHouse] = useState<PoSupplyHousePick | null>(null)
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<PoResult | null>(null)

  // "Other" buckets (v2.955): company-wide demotion flags for the For / Supply house pickers.
  const [otherRows, setOtherRows] = useState<DispatchPoOtherRow[]>([])
  const [otherListOpen, setOtherListOpen] = useState<DispatchPoOtherKind | null>(null)
  const [moveTarget, setMoveTarget] = useState<{ kind: DispatchPoOtherKind; id: string; name: string; direction: 'to-other' | 'to-main' } | null>(null)
  const pressStartRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)

  // Long-press fires ON RELEASE (matches Quick Assign): opening a modal
  // mid-hold would put it under the pointer; pointercancel clears mid-scroll.
  const longPressHandlers = (kind: DispatchPoOtherKind, id: string, name: string, direction: 'to-other' | 'to-main') => ({
    onPointerDown: () => {
      longPressFiredRef.current = false
      pressStartRef.current = Date.now()
    },
    onPointerUp: () => {
      const start = pressStartRef.current
      pressStartRef.current = null
      if (start != null && Date.now() - start >= PO_LONG_PRESS_MS) {
        longPressFiredRef.current = true
        buzz(10)
        setMoveTarget({ kind, id, name, direction })
      }
    },
    onPointerLeave: () => {
      pressStartRef.current = null
    },
    onPointerCancel: () => {
      pressStartRef.current = null
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })

  /** True once per long-press: the click that follows it must not also select. */
  const consumeLongPress = () => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return true
    }
    return false
  }

  const loadOtherRows = useCallback(async () => {
    // Additive UI — a load error (e.g. migration not applied yet) just means no Other buckets.
    const { data, error } = await supabase.from('dispatch_po_other_items').select('id, kind, item_id')
    setOtherRows(error ? [] : ((data ?? []) as DispatchPoOtherRow[]))
  }, [])

  /**
   * Move an option into or out of Other — OPTIMISTIC (v2.958): the list flips
   * and the modal closes the instant the swipe lands; the write runs behind
   * it and rolls back with a toast if it fails. Insert/delete only — no
   * destructive path.
   */
  function executeMove(target: { kind: DispatchPoOtherKind; id: string; direction: 'to-other' | 'to-main' }) {
    const previous = otherRows
    setOtherRows(applyOtherMoveLocally(previous, target.kind, target.id, target.direction))
    setMoveTarget(null)
    buzz(15)
    void (async () => {
      try {
        if (target.direction === 'to-other') {
          const { error } = await supabase
            .from('dispatch_po_other_items')
            .upsert({ kind: target.kind, item_id: target.id, created_by: authUser?.id ?? null }, { onConflict: 'kind,item_id' })
          if (error) throw error
        } else {
          const { error } = await supabase.from('dispatch_po_other_items').delete().eq('kind', target.kind).eq('item_id', target.id)
          if (error) throw error
        }
        // Reconcile the synthetic optimistic row with the real one.
        await loadOtherRows()
      } catch (e) {
        setOtherRows(previous)
        showToast(formatErrorMessage(e, 'Failed to move — change undone'), 'error')
      }
    })()
  }

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true)
    try {
      const rows = await withSupabaseRetry(
        () =>
          supabase
            .from('material_po_generator_entries')
            .select(
              `id, po_code, notes, created_at,
              job:jobs_ledger(hcp_number, job_name),
              for_user:users!material_po_generator_entries_for_user_id_fkey(name),
              supply_house:supply_houses(name)`,
            )
            .order('created_at', { ascending: false })
            .limit(25),
        'dispatch mode po ledger',
      )
      setLedger((rows ?? []) as unknown as PoLedgerRow[])
    } catch {
      setLedger([])
    } finally {
      setLedgerLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLedger()
    void loadOtherRows()
    void fetchDispatchModeDayBlocks(todayYmd).then(({ data }) => setTodayBlocks(data))
    void withSupabaseRetry(
      () => supabase.from('supply_houses').select('id, name').order('name'),
      'dispatch mode po supply houses',
    )
      .then((rows) => {
        const list = ((rows ?? []) as PoSupplyHousePick[]).filter((r) => r.name?.trim())
        setSupplyHouses(list)
        // Dispatchers usually order from the same counter — preselect the last one used on this device.
        try {
          const lastId = localStorage.getItem(`${LAST_SUPPLY_HOUSE_KEY_PREFIX}${authUser?.id ?? ''}`)
          const last = list.find((s) => s.id === lastId)
          if (last) setSupplyHouse(last)
        } catch {
          // ignore
        }
      })
      .catch(() => setSupplyHouses([]))
    void withSupabaseRetry(
      () =>
        supabase
          .from('users')
          .select('id, name, phone, role')
          .is('archived_at', null)
          .in('role', ['subcontractor', 'helpers', 'master_technician', 'superintendent', 'assistant'])
          .order('name'),
      'dispatch mode po people',
    )
      .then((rows) =>
        setPeople(
          ((rows ?? []) as Array<{ id: string; name: string | null; phone: string | null }>).map((u) => ({
            id: u.id,
            name: (u.name ?? '').trim() || 'Unknown',
            phone: u.phone,
          })),
        ),
      )
      .catch(() => setPeople([]))
  }, [todayYmd, authUser?.id, loadLedger, loadOtherRows])

  // Job search (debounced) via the same RPC the desktop PO Generator uses.
  useEffect(() => {
    const q = jobSearch.trim()
    if (!q) {
      setJobResults([])
      setJobSearching(false)
      return
    }
    setJobSearching(true)
    const t = setTimeout(() => {
      void withSupabaseRetry(() => supabase.rpc('search_jobs_ledger', { search_text: q }), 'dispatch po job search')
        .then(async (jobRows) => {
          const jobs = (jobRows ?? []) as Array<{ id: string; hcp_number: string | null; job_name: string | null; job_address: string | null }>
          const ids = jobs.map((j) => j.id)
          const meta = ids.length
            ? await withSupabaseRetry(
                () =>
                  supabase
                    .from('jobs_ledger')
                    .select('id, customer_name, service_type:service_types(name)')
                    .in('id', ids),
                'dispatch po job meta',
              )
            : []
          const metaById = new Map(
            ((meta ?? []) as Array<{ id: string; customer_name: string | null; service_type: { name: string | null } | null }>).map((m) => [m.id, m]),
          )
          setJobResults(
            jobs.slice(0, 12).map((j) => ({
              id: j.id,
              hcpNumber: j.hcp_number,
              jobName: (j.job_name ?? '').trim() || '—',
              jobAddress: (j.job_address ?? '').trim(),
              customerName: (metaById.get(j.id)?.customer_name ?? '').trim(),
              serviceTypeName: metaById.get(j.id)?.service_type?.name ?? null,
            })),
          )
        })
        .catch(() => setJobResults([]))
        .finally(() => setJobSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [jobSearch])

  /** Today's schedule, one entry per job (the job Taunya needs is usually already on the board). */
  const todaysJobs = useMemo((): PoJobPick[] => {
    const seen = new Set<string>()
    const out: PoJobPick[] = []
    for (const b of todayBlocks) {
      if (seen.has(b.jobId)) continue
      seen.add(b.jobId)
      out.push({
        id: b.jobId,
        hcpNumber: b.hcpNumber,
        jobName: b.jobName,
        jobAddress: b.jobAddress,
        customerName: b.customerName,
        serviceTypeName: b.serviceTypeName,
      })
    }
    return out
  }, [todayBlocks])

  /** People scheduled on the picked job today float first — usually a one-tap pick. */
  const orderedPeople = useMemo(() => {
    if (!job) return people
    const onJob = new Set(todayBlocks.filter((b) => b.jobId === job.id).map((b) => b.assigneeUserId))
    return [...people.filter((p) => onJob.has(p.id)), ...people.filter((p) => !onJob.has(p.id))]
  }, [people, job, todayBlocks])

  /** Main vs Other split for the For picker; today's crew on the picked job never hides under Other. */
  const peoplePartition = useMemo(() => {
    const crewIds = job ? new Set(todayBlocks.filter((b) => b.jobId === job.id).map((b) => b.assigneeUserId)) : undefined
    return partitionByOther(orderedPeople, otherIdSet(otherRows, 'for_person'), crewIds)
  }, [orderedPeople, otherRows, job, todayBlocks])

  const supplyHousePartition = useMemo(
    () => partitionByOther(supplyHouses, otherIdSet(otherRows, 'supply_house')),
    [supplyHouses, otherRows],
  )

  async function generate() {
    if (!job || !person || generating) return
    setGenerating(true)
    try {
      const rows = await withSupabaseRetry(
        () =>
          supabase.rpc('insert_material_po_generator_entry', {
            p_job_ledger_id: job.id,
            p_for_user_id: person.id,
            p_supply_house_id: supplyHouse?.id ?? undefined,
            p_notes: notes.trim() || undefined,
          }),
        'dispatch mode generate po',
      )
      const row = (rows as { out_id: string; out_po_code: number }[] | null | undefined)?.[0]
      if (!row) throw new Error('No PO code returned')
      try {
        if (supplyHouse) localStorage.setItem(`${LAST_SUPPLY_HOUSE_KEY_PREFIX}${authUser?.id ?? ''}`, supplyHouse.id)
      } catch {
        // ignore
      }
      setResult({
        code: row.out_po_code,
        jobLabel: `${(buildServiceTypeTradePill(job.serviceTypeName)?.label ?? 'JOB')} ${job.hcpNumber?.trim() || '—'} · ${job.jobName}`,
        personName: person.name,
        personPhone: person.phone,
        supplyHouseName: supplyHouse?.name ?? null,
      })
      setNotes('')
      void loadLedger()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to generate PO'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  function resultSummary(r: PoResult): string {
    return `PO ${r.code}${r.supplyHouseName ? ` — ${r.supplyHouseName}` : ''} — ${r.jobLabel} — for ${r.personName}`
  }

  if (result) {
    const smsDigits = (result.personPhone ?? '').replace(/[^0-9+]/g, '')
    return (
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
        <p style={{ margin: '1.5rem 0 0', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>Purchase order</p>
        <div style={{ fontSize: '4.5rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>
          {result.code}
        </div>
        <div style={{ fontSize: '1rem', color: 'var(--text-strong)', fontWeight: 600 }}>{result.jobLabel}</div>
        <div style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
          for {result.personName}
          {result.supplyHouseName ? ` · ${result.supplyHouseName}` : ''}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(resultSummary(result)).then(
                () => showToast('Copied', 'success'),
                () => showToast('Copy failed', 'error'),
              )
            }}
            style={{ padding: '0.6rem 1.2rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', fontWeight: 600, cursor: 'pointer' }}
          >
            Copy
          </button>
          {smsDigits ? (
            <a
              href={`sms:${smsDigits}?body=${encodeURIComponent(resultSummary(result))}`}
              style={{ padding: '0.6rem 1.2rem', border: 'none', borderRadius: 8, background: '#16a34a', color: 'white', fontWeight: 600, textDecoration: 'none' }}
            >
              Text to {result.personName}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setResult(null)}
            style={{ padding: '0.6rem 1.2rem', border: 'none', borderRadius: 8, background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-strong)', textAlign: 'center' }}>PO Generator</h1>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center' }}>
        Hold down a name to sort it into Other
      </p>

      {stepLabel(1, 'Job (On schedule today)')}
      {job ? (
        <button type="button" onClick={() => setJob(null)} className="dispatch-po-chip" style={{ ...chipStyle(true), textAlign: 'left' }}>
          {(buildServiceTypeTradePill(job.serviceTypeName)?.label ?? '').toUpperCase()} {job.hcpNumber?.trim() || '—'} · {job.jobName}
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
            {job.jobAddress || job.customerName} — tap to change
          </span>
        </button>
      ) : (
        <>
          {todaysJobs.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {todaysJobs.map((j) => (
                <button key={j.id} type="button" onClick={() => setJob(j)} className="dispatch-po-chip" style={chipStyle(false)}>
                  {j.hcpNumber?.trim() || '—'} · {j.jobName}
                </button>
              ))}
            </div>
          )}
          <input
            type="search"
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
            placeholder="Search any job — number, name, address…"
            aria-label="Search jobs for the PO"
            style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, boxSizing: 'border-box' }}
          />
          {jobSearching && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>}
          {jobResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
              {jobResults.map((j) => (
                <button key={j.id} type="button" onClick={() => { setJob(j); setJobSearch(''); setJobResults([]) }} className="dispatch-po-chip" style={{ ...chipStyle(false), borderRadius: 8, textAlign: 'left' }}>
                  {j.hcpNumber?.trim() || '—'} · {j.jobName}
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    {[j.customerName, j.jobAddress].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {stepLabel(2, 'For')}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {/* A pick from the Other sheet isn't in the main list — show just that name; deselecting restores the full list (v2.957). */}
        {person && peoplePartition.other.some((p) => p.id === person.id) ? (
          <button
            key={person.id}
            type="button"
            onClick={() => {
              if (consumeLongPress()) return
              setPerson(null)
            }}
            aria-pressed
            title="Tap to change · hold to move back to the main list"
            className="dispatch-po-chip" style={{ ...chipStyle(true), touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
            {...longPressHandlers('for_person', person.id, person.name, 'to-main')}
          >
            {person.name}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> — tap to change</span>
          </button>
        ) : (
          <>
        {peoplePartition.main.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              if (consumeLongPress()) return
              setPerson(person?.id === p.id ? null : p)
            }}
            aria-pressed={person?.id === p.id}
            title="Hold to move to Other"
            className="dispatch-po-chip" style={{ ...chipStyle(person?.id === p.id), touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
            {...longPressHandlers('for_person', p.id, p.name, 'to-other')}
          >
            {p.name}
          </button>
        ))}
        {peoplePartition.other.length > 0 && (
          <button type="button" onClick={() => setOtherListOpen('for_person')} className="dispatch-po-chip" style={{ ...chipStyle(false), color: 'var(--text-muted)' }}>
            Other ({peoplePartition.other.length})
          </button>
        )}
          </>
        )}
      </div>

      {stepLabel(3, 'Supply house (optional)')}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {supplyHouse && supplyHousePartition.other.some((s) => s.id === supplyHouse.id) ? (
          <button
            key={supplyHouse.id}
            type="button"
            onClick={() => {
              if (consumeLongPress()) return
              setSupplyHouse(null)
            }}
            aria-pressed
            title="Tap to change · hold to move back to the main list"
            className="dispatch-po-chip" style={{ ...chipStyle(true), touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
            {...longPressHandlers('supply_house', supplyHouse.id, supplyHouse.name, 'to-main')}
          >
            {supplyHouse.name}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> — tap to change</span>
          </button>
        ) : (
          <>
        {supplyHousePartition.main.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (consumeLongPress()) return
              setSupplyHouse(supplyHouse?.id === s.id ? null : s)
            }}
            aria-pressed={supplyHouse?.id === s.id}
            title="Hold to move to Other"
            className="dispatch-po-chip" style={{ ...chipStyle(supplyHouse?.id === s.id), touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
            {...longPressHandlers('supply_house', s.id, s.name, 'to-other')}
          >
            {s.name}
          </button>
        ))}
        {supplyHousePartition.other.length > 0 && (
          <button type="button" onClick={() => setOtherListOpen('supply_house')} className="dispatch-po-chip" style={{ ...chipStyle(false), color: 'var(--text-muted)' }}>
            Other ({supplyHousePartition.other.length})
          </button>
        )}
          </>
        )}
      </div>

      {stepLabel(4, 'Note (optional)')}
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. 40ft of 3/4 PEX"
        aria-label="PO note"
        style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, boxSizing: 'border-box' }}
      />

      <button
        type="button"
        onClick={() => void generate()}
        disabled={!job || !person || generating}
        style={{
          marginTop: '1rem',
          padding: '0.85rem',
          fontSize: '1.0625rem',
          fontWeight: 700,
          border: 'none',
          borderRadius: 10,
          background: !job || !person || generating ? '#9ca3af' : '#2563eb',
          color: 'white',
          cursor: !job || !person || generating ? 'not-allowed' : 'pointer',
        }}
      >
        {generating ? 'Generating…' : 'Generate PO'}
      </button>

      <div style={{ margin: '1.5rem 0 0.4rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>Recent POs</div>
      {ledgerLoading ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : ledger.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>None yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {ledger.map((r) => (
            <li key={r.id} style={{ padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', fontSize: '0.8125rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>PO {r.po_code}</span>
              <span>
                {r.job?.hcp_number?.trim() || '—'} · {r.job?.job_name?.trim() || '—'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>for {r.for_user?.name ?? '—'}</span>
              {r.supply_house?.name ? <span style={{ color: 'var(--text-muted)' }}>@ {r.supply_house.name}</span> : null}
              {r.notes ? <span style={{ color: 'var(--text-muted)' }}>— {r.notes}</span> : null}
              <span style={{ marginLeft: 'auto', color: 'var(--text-faint)' }}>
                {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {otherListOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Other options"
          className="dispatch-po-overlay"
          onClick={() => setOtherListOpen(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1010, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            className="dispatch-po-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, maxHeight: '70vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: '12px 12px 0 0', padding: '1rem', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <span style={{ fontWeight: 700 }}>Other {otherListOpen === 'for_person' ? 'people' : 'supply houses'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>tap to use · hold to move back to the main list</span>
              <button type="button" onClick={() => setOtherListOpen(null)} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {(otherListOpen === 'for_person' ? peoplePartition.other : supplyHousePartition.other).map((item) => {
                const selected = otherListOpen === 'for_person' ? person?.id === item.id : supplyHouse?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (consumeLongPress()) return
                      if (otherListOpen === 'for_person') setPerson(item as PoPersonPick)
                      else setSupplyHouse(item as PoSupplyHousePick)
                      setOtherListOpen(null)
                    }}
                    aria-pressed={selected}
                    title="Hold to move back to the main list"
                    className="dispatch-po-chip" style={{ ...chipStyle(selected), touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
                    {...longPressHandlers(otherListOpen, item.id, item.name, 'to-main')}
                  >
                    {item.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {moveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm move"
          className="dispatch-po-overlay"
          onClick={() => setMoveTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1011, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div className="dispatch-po-dialog" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', borderRadius: 12, padding: '1rem', boxSizing: 'border-box' }}>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 700 }}>
              {moveTarget.direction === 'to-other' ? `Move ${moveTarget.name} to Other?` : `Move ${moveTarget.name} back to the main list?`}
            </p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              This changes the list for everyone. Nothing is deleted — it can always be moved back.
            </p>
            <SwipeToConfirm
              label={moveTarget.direction === 'to-other' ? 'Slide to move to Other' : 'Slide to move back'}
              onConfirm={() => void executeMove(moveTarget)}
            />
            <button
              type="button"
              onClick={() => setMoveTarget(null)}
              style={{ marginTop: '0.75rem', width: '100%', padding: '0.6rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
