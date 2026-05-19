import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { formatProjectNumberLabel } from '../../lib/projectNumberLabel'
import type { Database } from '../../types/database'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers'

const PROJECT_STATUSES: ProjectRow['status'][] = [
  'awaiting_start',
  'active',
  'completed',
  'on_hold',
]

const STATUS_LABELS: Record<ProjectRow['status'], string> = {
  awaiting_start: 'Awaiting start',
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On hold',
}

/** Z-index for the inline delete-confirm overlay. Must sit ABOVE the host
 *  EditProjectModal (z-index 1200) so the confirm dialog is interactive when
 *  the form is rendered inside the modal. */
const DELETE_CONFIRM_Z_INDEX = 1300

const INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
}
const INPUT_DISABLED_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  background: '#f3f4f6',
  color: '#4b5563',
  cursor: 'not-allowed',
}
const LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
  fontSize: '0.875rem',
}
const HELPER_STYLE: CSSProperties = {
  fontSize: '0.8125rem',
  color: '#6b7280',
  marginTop: 4,
}
const BUTTON_PRIMARY_STYLE: CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
}
const BUTTON_NEUTRAL_STYLE: CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'white',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.875rem',
}
const BUTTON_DANGER_OUTLINE_STYLE: CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'white',
  color: '#b91c1c',
  border: '1px solid #b91c1c',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.875rem',
}
const BUTTON_DANGER_SOLID_STYLE: CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#b91c1c',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
}
const ERROR_BANNER_STYLE: CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 4,
  color: '#b91c1c',
  fontSize: '0.875rem',
  margin: 0,
}

const REQUIRED_MARK = <span style={{ color: '#b91c1c' }}>*</span>

type Props = {
  projectId: string
  onSaved: () => void
  onCancel: () => void
  onDeleted: () => void
}

/**
 * Edit-project form, extracted from the legacy `/projects/:id/edit` page so it
 * can be hosted inside `EditProjectModal`. Pure props, no router hooks; the
 * caller decides what happens on save / cancel / delete.
 */
export default function EditProjectForm({
  projectId,
  onSaved,
  onCancel,
  onDeleted,
}: Props) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()

  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [housecallproNumber, setHousecallproNumber] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [status, setStatus] = useState<ProjectRow['status']>('active')
  const [projectNumber, setProjectNumber] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [customersLoading, setCustomersLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [myRole, setMyRole] = useState<UserRole | null>(null)

  useEffect(() => {
    if (!authUser?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()
      .then(({ data }) => setMyRole((data as { role: UserRole } | null)?.role ?? null))
  }, [authUser?.id])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, master_user_id')
        .or('customer_type.is.null,customer_type.eq.commercial')
        .order('name')
      setCustomers((data as CustomerRow[]) ?? [])
      setCustomersLoading(false)
    })()
  }, [])

  function getCustomerDisplay(customer: CustomerRow): string {
    if (customer.address) {
      return `${customer.name} - ${customer.address}`
    }
    return customer.name
  }

  useEffect(() => {
    if (customerId && customers.length > 0) {
      const selectedCustomer = customers.find((c) => c.id === customerId)
      if (selectedCustomer) {
        setCustomerSearch(getCustomerDisplay(selectedCustomer))
      }
    }
  }, [customerId, customers])

  useEffect(() => {
    ;(async () => {
      const { data, error: err } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (err) {
        setError(err.message)
        setFetching(false)
        return
      }
      const row = data as ProjectRow
      setName(row.name)
      setAddress(row.address ?? '')
      setDescription(row.description ?? '')
      setHousecallproNumber(row.housecallpro_number ?? '')
      setPlansLink(row.plans_link ?? '')
      setStatus(row.status)
      setCustomerId(row.customer_id)
      setProjectNumber(row.project_number ?? '')
      setFetching(false)
    })()
  }, [projectId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload: {
      name: string
      address: string | null
      description: string | null
      housecallpro_number: string | null
      plans_link: string | null
      status: ProjectRow['status']
      customer_id: string
    } = {
      name: name.trim(),
      address: address.trim() || null,
      description: description.trim() || null,
      housecallpro_number: housecallproNumber.trim() || null,
      plans_link: plansLink.trim() || null,
      status,
      customer_id: customerId,
    }

    try {
      await withSupabaseRetry(
        async () => supabase.from('projects').update(payload).eq('id', projectId),
        `update project ${projectId}`,
      )
      showToast('Project saved', 'success')
      onSaved()
    } catch (err) {
      const message = formatErrorMessage(err, 'Failed to save project')
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openDelete() {
    setDeleteOpen(true)
    setDeleteConfirm('')
    setError(null)
  }

  function closeDelete() {
    setDeleteOpen(false)
  }

  async function handleDelete() {
    if (deleteConfirm.trim() !== name.trim()) return
    setDeleting(true)
    setError(null)

    try {
      const wfRows = await withSupabaseRetry<{ id: string }[]>(
        async () => supabase.from('project_workflows').select('id').eq('project_id', projectId),
        `load workflows for project ${projectId}`,
      )
      const wfIds = (wfRows ?? []).map((w) => w.id)

      if (wfIds.length > 0) {
        const stepRows = await withSupabaseRetry<{ id: string }[]>(
          async () =>
            supabase.from('project_workflow_steps').select('id').in('workflow_id', wfIds),
          `load workflow steps for project ${projectId}`,
        )
        const stepIds = (stepRows ?? []).map((s) => s.id)

        for (const sid of stepIds) {
          await withSupabaseRetry(
            async () =>
              supabase.from('workflow_step_dependencies').delete().eq('step_id', sid),
            `delete step dependencies (forward) ${sid}`,
          )
          await withSupabaseRetry(
            async () =>
              supabase
                .from('workflow_step_dependencies')
                .delete()
                .eq('depends_on_step_id', sid),
            `delete step dependencies (reverse) ${sid}`,
          )
        }

        await withSupabaseRetry(
          async () =>
            supabase.from('project_workflow_steps').delete().in('workflow_id', wfIds),
          `delete workflow steps for project ${projectId}`,
        )
      }

      await withSupabaseRetry(
        async () => supabase.from('project_workflows').delete().eq('project_id', projectId),
        `delete workflows for project ${projectId}`,
      )

      await withSupabaseRetry(
        async () => supabase.from('projects').delete().eq('id', projectId),
        `delete project ${projectId}`,
      )

      closeDelete()
      showToast('Project deleted', 'success')
      onDeleted()
    } catch (err) {
      const message = formatErrorMessage(err, 'Failed to delete project')
      setError(message)
      showToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (customersLoading) return <p>Loading…</p>
  if (fetching) return <p>Loading…</p>

  const missingFields: string[] = []
  if (!name.trim()) missingFields.push('Project Name')
  const canSubmit = missingFields.length === 0

  const canDelete = myRole === 'dev' || myRole === 'master_technician'

  const projectNumberLabel = formatProjectNumberLabel(projectNumber)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem',
          margin: '0 0 0.75rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit project</h2>
        {projectNumberLabel && (
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#1d4ed8',
              background: '#eff6ff',
              padding: '0.15rem 0.5rem',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            {projectNumberLabel}
          </span>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
      >
        <div>
          <label htmlFor="customer" style={LABEL_STYLE}>
            Customer {REQUIRED_MARK}
          </label>
          <input
            id="customer"
            type="text"
            value={customerSearch}
            disabled
            style={INPUT_DISABLED_STYLE}
          />
          <div style={HELPER_STYLE}>Customer cannot be changed when editing.</div>
        </div>

        <div>
          <label htmlFor="address" style={LABEL_STYLE}>
            Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        <div>
          <label htmlFor="name" style={LABEL_STYLE}>
            Project Name {REQUIRED_MARK}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={INPUT_STYLE}
          />
          <div style={HELPER_STYLE}>
            [Street / Town+Building] + [Remodel / New Build / Re-Pipe]
          </div>
        </div>

        <div>
          <label htmlFor="description" style={LABEL_STYLE}>
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={INPUT_STYLE}
          />
        </div>

        <div>
          <label htmlFor="housecallpro-number" style={LABEL_STYLE}>
            HouseCallPro #
          </label>
          <input
            id="housecallpro-number"
            type="text"
            value={housecallproNumber}
            onChange={(e) => setHousecallproNumber(e.target.value)}
            placeholder="#777"
            style={INPUT_STYLE}
          />
        </div>

        <div>
          <label htmlFor="plans-link" style={LABEL_STYLE}>
            Link to plans
          </label>
          <input
            id="plans-link"
            type="url"
            value={plansLink}
            onChange={(e) => setPlansLink(e.target.value)}
            placeholder="https://..."
            style={INPUT_STYLE}
          />
        </div>

        <div>
          <label htmlFor="status" style={LABEL_STYLE}>
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectRow['status'])}
            style={INPUT_STYLE}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {error && <p style={ERROR_BANNER_STYLE}>{error}</p>}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            paddingTop: '0.75rem',
            marginTop: '0.5rem',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          {canDelete && (
            <button
              type="button"
              onClick={openDelete}
              disabled={loading}
              style={{ ...BUTTON_DANGER_OUTLINE_STYLE, marginRight: 'auto' }}
            >
              Delete project
            </button>
          )}
          {!canSubmit && !loading && missingFields.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: '#FF6600' }}>
              <span style={{ display: 'block' }}>Required:</span>
              {missingFields.map((f) => (
                <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>
                  {f}
                </span>
              ))}
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={BUTTON_NEUTRAL_STYLE}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || loading}
            title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined}
            style={{
              ...BUTTON_PRIMARY_STYLE,
              opacity: !canSubmit || loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {deleteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: DELETE_CONFIRM_Z_INDEX,
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) closeDelete()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete project"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              padding: '1.25rem 1.5rem',
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 420,
              width: '100%',
              border: '1px solid #e5e7eb',
              boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Delete project</h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#374151' }}>
              Type the project name <strong>{name}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => {
                setDeleteConfirm(e.target.value)
                setError(null)
              }}
              placeholder="Project name"
              disabled={deleting}
              autoComplete="off"
              style={INPUT_STYLE}
            />
            {error && (
              <p style={{ ...ERROR_BANNER_STYLE, marginTop: '0.75rem' }}>{error}</p>
            )}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end',
                marginTop: '1rem',
              }}
            >
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                style={BUTTON_NEUTRAL_STYLE}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm.trim() !== name.trim()}
                style={{
                  ...BUTTON_DANGER_SOLID_STYLE,
                  opacity:
                    deleting || deleteConfirm.trim() !== name.trim() ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
