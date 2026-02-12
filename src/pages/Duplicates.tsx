import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Database } from '../types/database'

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

// Levenshtein distance for string similarity
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function nameSimilarity(a: string, b: string): number {
  const na = a.trim().toLowerCase()
  const nb = b.trim().toLowerCase()
  if (na === nb) return 1
  if (na.length === 0 || nb.length === 0) return 0
  const maxLen = Math.max(na.length, nb.length)
  const dist = levenshteinDistance(na, nb)
  return 1 - dist / maxLen
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
  const [parts, setParts] = useState<MaterialPart[]>([])
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
        <Link to="/materials" style={{ fontSize: '0.875rem', color: '#3b82f6' }}>
          ← Back to Materials
        </Link>
      </div>

      <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
        Parts with matching names or 80%+ name similarity are grouped below. Delete duplicates to clean up the price book.
      </p>

      {!loading && duplicateGroups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
            <input
              type="checkbox"
              checked={onlyExactMatch}
              onChange={(e) => setOnlyExactMatch(e.target.checked)}
            />
            Only show 100% name match
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#374151' }}>
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
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : duplicateGroups.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No duplicate materials found.</p>
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
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 500 }}>
                {group.length} duplicates
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ background: '#f3f4f6' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Manufacturer</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Part Type</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Service Type</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Best Price</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Supply House</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((part) => {
                    const best = bestPriceByPartId[part.id]
                    return (
                    <tr key={part.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{part.name}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{part.manufacturer ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{partTypeMap[part.part_type_id]?.name ?? '—'}</td>
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
                          style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#b91c1c' }}>Delete material</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#374151' }}>
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
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem' }}
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
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
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
