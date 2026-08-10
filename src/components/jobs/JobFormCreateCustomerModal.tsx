import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { computeSimilarCustomersForCreate } from '../../lib/jobs/similarCustomersForCreate'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

type JobFormCreateCustomerModalProps = {
  /** Shell-owned: the section's button AND the edit-init `alsoOpenCreateCustomerModal` gate open it. */
  open: boolean
  onClose: () => void
  customerName: string
  jobAddress: string
  customerEmail: string
  customerPhone: string
  /** Shell-owned busy flag (the create handler sets it around its DB writes). */
  creatingCustomerFromJob: boolean
  /** Shell handler: inserts the customer (job's master), links it in edit mode, closes the modal. */
  onCreate: (customerType: 'residential' | 'commercial') => void
  /** Shell handler: links the picked existing customer (immediate DB write in edit mode), closes the modal. */
  onLinkSimilar: (c: CustomerRow) => void
  /**
   * Shell resolver for the JOB's master (edit: resolveEditJobMasterUserId; new:
   * resolveEffectiveJobMasterUserId). The match list only offers that master's
   * customers — the jobs_ledger_customer_master_match trigger rejects any other
   * pick at link time. Null skips the filter.
   */
  resolveJobMasterUserId: () => Promise<string | null>
  overlayZIndex: number
}

/**
 * The "Create customer from job" modal of the New/Edit Job form: customer-type
 * toggle plus a similar-customers list ("link instead") loaded whenever the
 * modal opens. Always mounted so the type toggle and match list survive
 * close/reopen within one form mount (pre-extraction behavior — the state
 * lived in the shell). The DB-writing handlers stay in the shell.
 */
export function JobFormCreateCustomerModal({
  open,
  onClose,
  customerName,
  jobAddress,
  customerEmail,
  customerPhone,
  creatingCustomerFromJob,
  onCreate,
  onLinkSimilar,
  resolveJobMasterUserId,
  overlayZIndex,
}: JobFormCreateCustomerModalProps) {
  const { user: authUser } = useAuth()
  const [createCustomerFromJobType, setCreateCustomerFromJobType] = useState<'residential' | 'commercial'>('residential')
  const [similarCustomersForCreate, setSimilarCustomersForCreate] = useState<CustomerRow[]>([])
  const [createCustomerFromJobModalLoading, setCreateCustomerFromJobModalLoading] = useState(false)
  const resolveJobMasterUserIdRef = useRef(resolveJobMasterUserId)
  resolveJobMasterUserIdRef.current = resolveJobMasterUserId

  useEffect(() => {
    if (!open || !authUser?.id) return
    setCreateCustomerFromJobModalLoading(true)
    ;(async () => {
      const name = customerName.trim()
      if (!name) {
        setSimilarCustomersForCreate([])
        setCreateCustomerFromJobModalLoading(false)
        return
      }
      const [{ data }, jobMasterUserId] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
          .order('name'),
        resolveJobMasterUserIdRef.current(),
      ])
      const all = (data as CustomerRow[]) ?? []
      setSimilarCustomersForCreate(computeSimilarCustomersForCreate(all, name, jobMasterUserId))
      setCreateCustomerFromJobModalLoading(false)
    })()
  }, [open, authUser?.id, customerName])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: overlayZIndex }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Create customer from job</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {customerName.trim() || '—'} · {jobAddress.trim() || '—'}
          {(customerEmail.trim() || customerPhone.trim()) && (
            <span> · {customerEmail.trim() || customerPhone.trim()}</span>
          )}
        </p>
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Customer type</span>
          <div style={{ display: 'flex', gap: 0 }}>
            <button
              type="button"
              onClick={() => setCreateCustomerFromJobType('residential')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: '4px 0 0 4px',
                background: createCustomerFromJobType === 'residential' ? '#3b82f6' : 'var(--surface)',
                color: createCustomerFromJobType === 'residential' ? 'white' : 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              Residential
            </button>
            <button
              type="button"
              onClick={() => setCreateCustomerFromJobType('commercial')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: '0 4px 4px 0',
                background: createCustomerFromJobType === 'commercial' ? '#3b82f6' : 'var(--surface)',
                color: createCustomerFromJobType === 'commercial' ? 'white' : 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              Commercial
            </button>
          </div>
        </label>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Possible matches – link instead?</span>
          {createCustomerFromJobModalLoading ? (
            <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
          ) : similarCustomersForCreate.length > 0 ? (
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: 160, overflowY: 'auto' }}>
              {similarCustomersForCreate.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onLinkSimilar(c)}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                >
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  {c.address && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.address}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>No similar customers found</div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!customerName.trim() || creatingCustomerFromJob}
            onClick={() => onCreate(createCustomerFromJobType)}
            style={{ padding: '0.5rem 1rem', background: !customerName.trim() || creatingCustomerFromJob ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: !customerName.trim() || creatingCustomerFromJob ? 'not-allowed' : 'pointer' }}
          >
            {creatingCustomerFromJob ? 'Creating…' : 'Create new customer'}
          </button>
        </div>
      </div>
    </div>
  )
}
