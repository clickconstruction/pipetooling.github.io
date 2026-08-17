import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { normalizeCustomerName } from '../../lib/customerSimilarity'
import {
  proposeJobCustomerLinks,
  type LinkCustomerInput,
  type ProposedLinkGroup,
  type UnlinkedJobInput,
} from '../../lib/customers/matchUnlinkedJobs'

/**
 * Link-jobs sweep (Customer Hub follow-up): every jobs_ledger row with no
 * customer_id, grouped by the name it carries, with a proposed customer per
 * group. Exact matches arrive pre-checked; prefix proposals and aliases need
 * a look. One Apply runs the batched UPDATEs — nothing writes before it.
 */

type CustomerRowLite = { id: string; name: string | null; archived_at: string | null; master_user_id: string | null }

const UPDATE_CHUNK = 100

function confidenceBadge(c: ProposedLinkGroup['confidence']): { label: string; bg: string; fg: string } {
  switch (c) {
    case 'customer_name':
      return { label: 'name match', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'job_name':
      return { label: 'job-name match', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'prefix':
      return { label: 'starts with', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    case 'none':
      return { label: 'no match', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }
  }
}

export default function LinkJobsToCustomersModal({
  onClose,
  onApplied,
}: {
  onClose: () => void
  onApplied: () => void
}) {
  const { showToast } = useToastContext()
  const [groups, setGroups] = useState<ProposedLinkGroup[] | null>(null)
  const [customers, setCustomers] = useState<CustomerRowLite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Per-group override/confirm state, keyed by group index. */
  const [chosen, setChosen] = useState<Record<number, string | null>>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  /** Group index whose picker is open, plus its filter text. */
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [pickerText, setPickerText] = useState('')
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [jobsRows, customerRows, userRows] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger')
                .select('id, customer_name, job_name, hcp_number, click_number, master_user_id')
                .is('customer_id', null),
            'link jobs: unlinked jobs',
          ),
          withSupabaseRetry(
            async () => supabase.from('customers').select('id, name, archived_at, master_user_id').order('name'),
            'link jobs: customers',
          ),
          supabase.from('users').select('id, name'),
        ])
        if (cancelled) return
        const custs = (customerRows ?? []) as CustomerRowLite[]
        const proposed = proposeJobCustomerLinks((jobsRows ?? []) as UnlinkedJobInput[], custs as LinkCustomerInput[])
        setCustomers(custs)
        setUserNames(
          Object.fromEntries(
            ((userRows.data ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, (u.name ?? '').trim()]),
          ),
        )
        setGroups(proposed)
        const custMasterById = new Map(custs.map((c) => [c.id, c.master_user_id]))
        const initialChosen: Record<number, string | null> = {}
        const initialChecked: Record<number, boolean> = {}
        proposed.forEach((g, i) => {
          initialChosen[i] = g.proposedCustomerId
          // Ownership mismatches are never pre-checked — linking them also
          // moves the job to the customer's owner, so the user confirms.
          const mismatch =
            g.proposedCustomerId != null && custMasterById.get(g.proposedCustomerId) !== g.jobMasterUserId
          initialChecked[i] = !mismatch && (g.confidence === 'customer_name' || g.confidence === 'job_name')
        })
        setChosen(initialChosen)
        setChecked(initialChecked)
      } catch (e: unknown) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load unlinked jobs'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const pickerMatches = useMemo(() => {
    if (pickerFor == null) return []
    const q = normalizeCustomerName(pickerText)
    const pool = customers.filter((c) => !c.archived_at)
    if (!q) return pool.slice(0, 8)
    return pool.filter((c) => normalizeCustomerName(c.name).includes(q)).slice(0, 8)
  }, [pickerFor, pickerText, customers])

  const applyCount = groups
    ? groups.reduce((sum, g, i) => (checked[i] && chosen[i] ? sum + g.jobIds.length : sum), 0)
    : 0

  async function apply() {
    if (!groups) return
    setSaving(true)
    let linked = 0
    const failures: string[] = []
    const custById = new Map(customers.map((c) => [c.id, c]))
    for (let i = 0; i < groups.length; i++) {
      const customerId = checked[i] ? chosen[i] : null
      if (!customerId) continue
      const cust = custById.get(customerId)
      const name = (cust?.name ?? '').trim() || null
      // Jobs follow their customer's owner (the v2.1685 invariant): when the
      // owners differ, the link also moves the job to the customer's master.
      const alignMaster = cust?.master_user_id != null && cust.master_user_id !== groups[i]!.jobMasterUserId
      const patch: { customer_id: string; customer_name: string | null; master_user_id?: string } = {
        customer_id: customerId,
        customer_name: name,
      }
      if (alignMaster && cust?.master_user_id) patch.master_user_id = cust.master_user_id
      const ids = groups[i]!.jobIds
      let groupFailed = false
      for (let o = 0; o < ids.length && !groupFailed; o += UPDATE_CHUNK) {
        const chunk = ids.slice(o, o + UPDATE_CHUNK)
        const { error: err } = await supabase.from('jobs_ledger').update(patch).in('id', chunk)
        if (err) {
          groupFailed = true
          failures.push(`${groups[i]!.displayName}: ${err.message}`)
        } else {
          linked += chunk.length
        }
      }
    }
    if (failures.length === 0) {
      showToast(`Linked ${linked} job${linked === 1 ? '' : 's'} to customers.`, 'success')
    } else {
      showToast(
        `Linked ${linked} job${linked === 1 ? '' : 's'} · ${failures.length} group${failures.length === 1 ? '' : 's'} failed — ${failures[0]}${failures.length > 1 ? ` (+${failures.length - 1} more)` : ''}`,
        'error',
      )
    }
    onApplied()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Link jobs to customers"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: 'min(680px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.98rem' }}>
            Link jobs to customers
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            One row per name — linking a row links all its jobs. Green matches are pre-checked; "starts with" and
            "no match" rows wait for you. Unchecked rows are skipped.
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {error ? (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-red-600)' }}>{error}</p>
          ) : groups == null ? (
            <p role="status" style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Matching jobs to your customer book…
            </p>
          ) : groups.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Every job has a customer. 🎉
            </p>
          ) : (
            groups.map((g, i) => {
              const badge = confidenceBadge(g.confidence)
              const chosenId = chosen[i]
              const chosenCust = chosenId ? customers.find((c) => c.id === chosenId) : null
              const chosenName = chosenCust ? (chosenCust.name ?? '').trim() : null
              const ownerMove =
                chosenCust != null && chosenCust.master_user_id != null && chosenCust.master_user_id !== g.jobMasterUserId
              return (
                <div key={`${g.displayName}:${i}`} style={{ borderBottom: '1px solid var(--border)', padding: '7px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={!!checked[i] && !!chosenId}
                      disabled={!chosenId}
                      aria-label={`Link ${g.displayName}`}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [i]: e.target.checked }))}
                      style={{ margin: 0, cursor: chosenId ? 'pointer' : 'not-allowed' }}
                    />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-strong)', fontWeight: 600 }}>
                      {g.displayName}
                      <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>
                        {' '}· {g.jobIds.length} job{g.jobIds.length === 1 ? '' : 's'}
                        {g.sampleLabels.length > 0 ? ` (${g.sampleLabels.join(', ')}${g.jobIds.length > g.sampleLabels.length ? '…' : ''})` : ''}
                      </span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 9999, fontSize: '0.64rem', fontWeight: 700, background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>
                      {badge.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerFor((prev) => (prev === i ? null : i))
                        setPickerText('')
                      }}
                      style={{ border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: chosenName ? 'var(--text-link)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', cursor: 'pointer', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {chosenName ? `→ ${chosenName}` : 'pick customer…'}
                    </button>
                  </div>
                  {ownerMove ? (
                    <p style={{ margin: '3px 0 0 26px', fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>
                      Also moves {g.jobIds.length === 1 ? 'this job' : `these ${g.jobIds.length} jobs`} from{' '}
                      {(g.jobMasterUserId && userNames[g.jobMasterUserId]) || 'their current owner'} to{' '}
                      {(chosenCust?.master_user_id && userNames[chosenCust.master_user_id]) || "the customer's owner"} — jobs
                      follow their customer's owner.
                    </p>
                  ) : null}
                  {pickerFor === i ? (
                    <div style={{ margin: '6px 0 3px 26px', maxWidth: 380 }}>
                      <input
                        autoFocus
                        type="text"
                        value={pickerText}
                        onChange={(e) => setPickerText(e.target.value)}
                        placeholder="Search customers…"
                        style={{ width: '100%', padding: '4px 9px', border: '1px solid var(--border-strong)', borderRadius: 5, fontSize: '0.8rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-700)' }}
                      />
                      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px', background: 'var(--surface)' }}>
                        {pickerMatches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setChosen((prev) => ({ ...prev, [i]: c.id }))
                              setChecked((prev) => ({ ...prev, [i]: true }))
                              setPickerFor(null)
                            }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 9px', border: 'none', background: 'none', fontSize: '0.8rem', color: 'var(--text-700)', cursor: 'pointer' }}
                          >
                            {(c.name ?? '').trim() || '(unnamed)'}
                          </button>
                        ))}
                        {pickerMatches.length === 0 ? (
                          <p style={{ margin: 0, padding: '4px 9px', fontSize: '0.75rem', color: 'var(--text-faint)' }}>No customers match.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {applyCount} job{applyCount === 1 ? '' : 's'} will be linked
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.4rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={saving || applyCount === 0}
              style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: 5, background: '#2563eb', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: applyCount === 0 ? 0.6 : 1 }}
            >
              {saving ? 'Linking…' : `Link ${applyCount} job${applyCount === 1 ? '' : 's'}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
