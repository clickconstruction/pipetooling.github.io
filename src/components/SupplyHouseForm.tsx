import type { Database } from '../types/database'

type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary'

export interface SupplyHouseFormData {
  name: string
  contact_name: string
  phone: string
  email: string
  address: string
  notes: string
}

interface SupplyHouseFormProps {
  editingSupplyHouse: SupplyHouse | null
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  notes: string
  onChange: (field: keyof SupplyHouseFormData, value: string) => void
  onSubmit: (data: SupplyHouseFormData) => Promise<void>
  onClose: () => void
  onDelete?: () => void
  saving: boolean
  myRole: UserRole | null
  variant?: 'modal' | 'inline'
}

const fieldStyles = { width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 } as const
const labelStyles = { display: 'block', marginBottom: '0.25rem', fontWeight: 500 } as const
const rowStyles = { marginBottom: '0.75rem' } as const

export function SupplyHouseForm({
  editingSupplyHouse,
  name,
  contactName,
  phone,
  email,
  address,
  notes,
  onChange,
  onSubmit,
  onClose,
  onDelete,
  saving,
  myRole,
  variant = 'modal',
}: SupplyHouseFormProps) {
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit({
      name: name.trim(),
      contact_name: contactName.trim() || '',
      phone: phone.trim() || '',
      email: email.trim() || '',
      address: address.trim() || '',
      notes: notes.trim() || '',
    })
  }

  const formContent = (
    <form onSubmit={handleSubmit} style={variant === 'inline' ? { marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: 4 } : undefined}>
      <h3 style={{ margin: variant === 'inline' ? 0 : undefined, marginBottom: '1rem' }}>{editingSupplyHouse ? 'Edit Supply House' : 'Add Supply House'}</h3>
      <div style={rowStyles}>
        <label style={labelStyles}>Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          required
          style={fieldStyles}
        />
      </div>
      <div style={rowStyles}>
        <label style={labelStyles}>Contact Name</label>
        <input type="text" value={contactName} onChange={(e) => onChange('contact_name', e.target.value)} style={fieldStyles} />
      </div>
      <div style={rowStyles}>
        <label style={labelStyles}>Phone</label>
        <input type="tel" value={phone} onChange={(e) => onChange('phone', e.target.value)} style={fieldStyles} />
      </div>
      <div style={rowStyles}>
        <label style={labelStyles}>Email</label>
        <input type="email" value={email} onChange={(e) => onChange('email', e.target.value)} style={fieldStyles} />
      </div>
      <div style={rowStyles}>
        <label style={labelStyles}>Address</label>
        <textarea value={address} onChange={(e) => onChange('address', e.target.value)} rows={2} style={fieldStyles} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyles}>Notes</label>
        <textarea value={notes} onChange={(e) => onChange('notes', e.target.value)} rows={2} style={fieldStyles} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        {editingSupplyHouse && myRole === 'dev' && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            style={{ padding: '0.5rem 1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer' }}
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : editingSupplyHouse ? 'Update' : 'Add'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )

  if (variant === 'modal') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%' }}>
          {formContent}
        </div>
      </div>
    )
  }

  return formContent
}
