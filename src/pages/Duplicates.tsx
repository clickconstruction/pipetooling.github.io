import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Database } from '../types/database'
import { nameSimilarity } from '../utils/nameSimilarity'

type MaterialPart = Database['public']['Tables']['material_parts']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator'

interface PartType {
  id: string
  name: string
  service_type_id: string
}
interface ServiceType {
  id: string
  name: string
}

// Union-Find for grouping similar parts
function find(parent: Map<string, string>, x: string): string {
  if (!parent.has(x)) parent.set(x, x)
  if (parent.get(x) !== x) {
    parent.set(x, find(parent, parent.get(x)!))
  }
  return parent.get(x)!
}

function union(parent: Map<string, string>, x: string, y: string) {
  const px = find(parent, x)
  const py = find(parent, y)
  if (px !== py) parent.set(px, py)
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isExactNameMatch(group: MaterialPart[]): boolean {
  if (group.length < 2) return false
  const first = group[0]!.name.trim().toLowerCase()
  return group.every((p) => p.name.trim().toLowerCase() === first)
}

export default function Duplicates() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setParts] = useState<MaterialPart[]>([])
  const [partTypes, setPartTypes] = useState<PartType[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [duplicateGroups, setDuplicateGroups] = useState<MaterialPart[][]>([])
  const [bestPriceByPartId, setBestPriceByPartId] = useState<Record<string, { price: number; supplyHouseName: string }>>({})
  const [deleteConfirmPart, setDeleteConfirmPart] = useState<MaterialPart | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [onlyExactMatch, setOnlyExactMatch] = useState(false)
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyRole((data as { role: UserRole } | null)?.role ?? null))
  }, [user?.id])

  useEffect(() => {
    if (myRole !== 'dev') {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('material_parts').select('*').order('name'),
      supabase.from('part_types').select('id, name, service_type_id'),
      supabase.from('service_types').select('id, name'),
      supabase.from('material_part_prices').select('part_id, price, supply_houses(name)').order('price', { ascending: true }),
    ]).then(([partsRes, ptRes, stRes, pricesRes]) => {
      if (cancelled) return
      if (partsRes.error) {
        setError(partsRes.error.message)
        setLoading(false)
        return
      }
      setParts((partsRes.data as MaterialPart[]) ?? [])
      setPartTypes((ptRes.data as PartType[]) ?? [])
      setServiceTypes((stRes.data as ServiceType[]) ?? [])

      // Build best price map (first/lowest price per part)
      const bestByPart: Record<string, { price: number; supplyHouseName: string }> = {}
      for (const row of (pricesRes.data ?? []) as { part_id: string; price: number; supply_houses: { name: string } | null }[]) {
        if (!bestByPart[row.part_id]) {
          bestByPart[row.part_id] = {
            price: row.price,
            supplyHouseName: row.supply_houses?.name ?? '—',
          }
        }
      }
      setBestPriceByPartId(bestByPart)

      // Build duplicate groups
      const all = (partsRes.data as MaterialPart[]) ?? []
      const parent = new Map<string, string>()
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const sim = nameSimilarity(all[i]!.name, all[j]!.name)
          if (sim >= 0.8) {
            union(parent, all[i]!.id, all[j]!.id)
          }
        }
      }
      const groupsByRoot = new Map<string, MaterialPart[]>()
      for (const p of all) {
        const root = find(parent, p.id)
        if (!groupsByRoot.has(root)) groupsByRoot.set(root, [])
        groupsByRoot.get(root)!.push(p)
      }
      const groups = Array.from(groupsByRoot.values()).filter((g) => g.length >= 2)
      setDuplicateGroups(groups)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [myRole])

  async function handleDelete() {
    if (!deleteConfirmPart) return
    if (deleteConfirmName.trim() !== deleteConfirmPart.name.trim()) {
      setError('Type the part name exactly to confirm deletion.')
      return
    }
    setDeleting(true)
    setError(null)
    const { error: err } = await supabase.from('material_parts').delete().eq('id', deleteConfirmPart.id)
    setDeleting(false)
    if (err) {
      const msg =
        (err as { code?: string }).code === '23503'
          ? 'Cannot delete because this part is referenced in assemblies, purchase orders, or prices. Remove those references first.'
          : err.message
      setError(msg)
      return
    }
    setDeleteConfirmPart(null)
    setDeleteConfirmName('')
    setParts((prev) => prev.filter((p) => p.id !== deleteConfirmPart.id))
    setDuplicateGroups((prev) =>
      prev
        .map((g) => g.filter((p) => p.id !== deleteConfirmPart.id))
        .filter((g) => g.length >= 2)
    )
  }

  useEffect(() => {
    if (myRole && myRole !== 'dev') {
      navigate('/settings', { replace: true })
    }
  }, [myRole, navigate])

  if (myRole !== 'dev' && myRole !== null) {
    return null
  }

  if (myRole !== 'dev') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  const partTypeMap = Object.fromEntries(partTypes.map((pt) => [pt.id, pt]))
  const serviceTypeMap = Object.fromEntries(serviceTypes.map((st) => [st.id, st]))

  return (
    <div style={{ padding: '2rem', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Duplicate Materials</h1>
        <Link to="/materials" style={{ fontSize: '0.875rem', color: 'var(--text-blue-500)' }}>
          ← Back to Materials
        </Link>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Parts with matching names or 80%+ name similarity are grouped below. Delete duplicates to clean up the Parts Book.
      </p>

      {!loading && duplicateGroups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
            <input
              type="checkbox"
              checked={onlyExactMatch}
              onChange={(e) => setOnlyExactMatch(e.target.checked)}
            />
            Only show 100% name match
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
            <span>Only show service types:</span>
            {serviceTypes.map((st) => (
              <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedServiceTypeIds.has(st.id)}
                  onChange={(e) => {
                    setSelectedServiceTypeIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(st.id)
                      else next.delete(st.id)
                      return next
                    })
                  }}
                />
                {st.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : duplicateGroups.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No duplicate materials found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {(() => {
            let filtered = onlyExactMatch ? duplicateGroups.filter(isExactNameMatch) : duplicateGroups
            if (selectedServiceTypeIds.size > 0) {
              filtered = filtered.filter((group) =>
                group.some((p) => selectedServiceTypeIds.has(p.service_type_id))
              )
            }
            return filtered.map((group, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--surface)',
              }}
            >
              <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                {group.length} duplicates
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: 'var(--bg-muted)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Manufacturer</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Part Type</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Service Type</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Best Price</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Supply House</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((part) => {
                    const best = bestPriceByPartId[part.id]
                    return (
                    <tr key={part.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{part.name}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{part.manufacturer ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{(part.part_type_id ? partTypeMap[part.part_type_id]?.name : null) ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{serviceTypeMap[part.service_type_id]?.name ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{best ? `$${formatCurrency(best.price)}` : '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{best?.supplyHouseName ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirmPart(part)
                            setDeleteConfirmName('')
                            setError(null)
                          }}
                          style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            ))
          })()}
        </div>
      )}

      {deleteConfirmPart && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 1rem', color: 'var(--text-red-700)' }}>Delete material</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
              Type <strong>{deleteConfirmPart.name}</strong> to confirm. All prices for this part will also be removed.
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => {
                setDeleteConfirmName(e.target.value)
                setError(null)
              }}
              placeholder={deleteConfirmPart.name}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmPart(null)
                  setDeleteConfirmName('')
                  setError(null)
                }}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteConfirmName.trim() !== deleteConfirmPart.name.trim() || deleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: deleteConfirmName.trim() === deleteConfirmPart.name.trim() && !deleting ? '#dc2626' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deleteConfirmName.trim() === deleteConfirmPart.name.trim() && !deleting ? 'pointer' : 'not-allowed',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
