import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import AddInspectionModal from '../AddInspectionModal'
import { useToastContext } from '../../contexts/ToastContext'
import { cityMatchesQuery, filterPortalsByQuery, formatCitiesInput, matchPortalForInspectionAddress, parseCitiesInput } from '../../lib/inspectionPortalSearch'
import type { Database } from '../../types/database'

type InspectionRow = Database['public']['Tables']['inspections']['Row']

type QuickLinkRow = { id: string; label: string; url: string; sequence_order: number; cities: string[]; notes: string | null }
type PortalCredential = { username: string | null; password: string | null }

export type JobsInspectionsTabProps = {
  authUserId: string | null
  error: string | null
  onError: (msg: string | null) => void
}

export default function JobsInspectionsTab({ authUserId, error, onError }: JobsInspectionsTabProps) {
  const [addInspectionModalOpen, setAddInspectionModalOpen] = useState(false)
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [inspectionsLoading, setInspectionsLoading] = useState(false)
  const [inspectionsMonth, setInspectionsMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [inspectionsSelectedDay, setInspectionsSelectedDay] = useState<Date | null>(null)
  const [inspectionTypesModalOpen, setInspectionTypesModalOpen] = useState(false)
  const [inspectionTypesList, setInspectionTypesList] = useState<Array<{ name: string; sequence_order: number }>>([])
  const [inspectionTypesLoading, setInspectionTypesLoading] = useState(false)
  const [inspectionTypeFormOpen, setInspectionTypeFormOpen] = useState(false)
  const [editingInspectionTypeName, setEditingInspectionTypeName] = useState<string | null>(null)
  const [newInspectionTypeName, setNewInspectionTypeName] = useState('')
  const [inspectionTypeSaving, setInspectionTypeSaving] = useState(false)
  const [inspectionTypeDeletingName, setInspectionTypeDeletingName] = useState<string | null>(null)
  const [quickLinksModalOpen, setQuickLinksModalOpen] = useState(false)
  const [quickLinksList, setQuickLinksList] = useState<QuickLinkRow[]>([])
  const [quickLinksLoading, setQuickLinksLoading] = useState(false)
  const [quickLinkFormOpen, setQuickLinkFormOpen] = useState(false)
  const [editingQuickLinkId, setEditingQuickLinkId] = useState<string | null>(null)
  const [newQuickLinkLabel, setNewQuickLinkLabel] = useState('')
  const [newQuickLinkUrl, setNewQuickLinkUrl] = useState('')
  const [newQuickLinkCities, setNewQuickLinkCities] = useState('')
  const [newQuickLinkNotes, setNewQuickLinkNotes] = useState('')
  const [newQuickLinkUsername, setNewQuickLinkUsername] = useState('')
  const [newQuickLinkPassword, setNewQuickLinkPassword] = useState('')
  const [quickLinkSaving, setQuickLinkSaving] = useState(false)
  const [quickLinkDeletingId, setQuickLinkDeletingId] = useState<string | null>(null)
  // Credentials live in inspection_portal_credentials (RLS: Inspections-tab roles only).
  // Loaded separately and tolerated as absent — the table may not exist yet while the
  // client deploy precedes the migration push, and hidden roles just get an empty map.
  const [portalCredentials, setPortalCredentials] = useState<Record<string, PortalCredential>>({})
  const [portalSearch, setPortalSearch] = useState('')
  const [revealedPasswordLinkId, setRevealedPasswordLinkId] = useState<string | null>(null)
  const { showToast } = useToastContext()

  async function copyToClipboard(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${what} copied`, 'success')
    } catch {
      showToast(`Could not copy ${what.toLowerCase()}`, 'error')
    }
  }

  async function loadInspections(month?: Date) {
    if (!authUserId) return
    setInspectionsLoading(true)
    const m = month ?? inspectionsMonth
    const start = new Date(m.getFullYear(), m.getMonth() - 1, 1)
    const end = new Date(m.getFullYear(), m.getMonth() + 2, 0)
    const startStr = start.toLocaleDateString('en-CA')
    const endStr = end.toLocaleDateString('en-CA')
    const { data, error: err } = await supabase
      .from('inspections')
      .select('*')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true })
    if (err) {
      onError(`Failed to load inspections: ${err.message}`)
      setInspections([])
    } else {
      setInspections((data as InspectionRow[]) ?? [])
    }
    setInspectionsLoading(false)
  }

  async function loadInspectionTypes() {
    setInspectionTypesLoading(true)
    const { data, error: err } = await supabase.from('inspection_types').select('name, sequence_order').order('sequence_order')
    if (err) {
      onError(`Failed to load inspection types: ${err.message}`)
      setInspectionTypesList([])
    } else {
      setInspectionTypesList((data as Array<{ name: string; sequence_order: number }>) ?? [])
    }
    setInspectionTypesLoading(false)
  }

  function openInspectionTypesModal() {
    setInspectionTypesModalOpen(true)
    setInspectionTypeFormOpen(false)
    setEditingInspectionTypeName(null)
    loadInspectionTypes()
  }

  function openAddInspectionType() {
    setEditingInspectionTypeName(null)
    setNewInspectionTypeName('')
    setInspectionTypeFormOpen(true)
  }

  function openEditInspectionType(typeRow: { name: string; sequence_order: number }) {
    setEditingInspectionTypeName(typeRow.name)
    setNewInspectionTypeName(typeRow.name)
    setInspectionTypeFormOpen(true)
  }

  function closeInspectionTypeForm() {
    setInspectionTypeFormOpen(false)
    setEditingInspectionTypeName(null)
  }

  async function saveInspectionType(e: FormEvent) {
    e.preventDefault()
    const name = newInspectionTypeName.trim()
    if (!name) return
    setInspectionTypeSaving(true)
    onError(null)
    if (editingInspectionTypeName) {
      const { error: err } = await supabase.from('inspection_types').update({ name }).eq('name', editingInspectionTypeName)
      if (err) {
        onError(err.message)
        setInspectionTypeSaving(false)
        return
      }
    } else {
      const { error: err } = await supabase.from('inspection_types').insert({ name, sequence_order: inspectionTypesList.length })
      if (err) {
        onError(err.message)
        setInspectionTypeSaving(false)
        return
      }
    }
    await loadInspectionTypes()
    setInspectionTypeSaving(false)
    closeInspectionTypeForm()
  }

  async function deleteInspectionType(name: string) {
    if (!confirm(`Delete inspection type "${name}"? This will fail if any inspections use it.`)) return
    setInspectionTypeDeletingName(name)
    onError(null)
    const { error: err } = await supabase.from('inspection_types').delete().eq('name', name)
    if (err) {
      onError(err.message.includes('violates foreign key') ? `Cannot delete: inspections are using this type.` : err.message)
    } else {
      await loadInspectionTypes()
      closeInspectionTypeForm()
    }
    setInspectionTypeDeletingName(null)
  }

  async function loadQuickLinks() {
    setQuickLinksLoading(true)
    const { data, error: err } = await supabase
      .from('inspection_quick_links')
      .select('id, label, url, sequence_order, cities, notes')
      .order('sequence_order')
    if (err) {
      // Fallback for the client-deploys-first window before the cities/notes migration is pushed.
      const legacy = await supabase.from('inspection_quick_links').select('id, label, url, sequence_order').order('sequence_order')
      if (legacy.error) {
        onError(`Failed to load quick links: ${legacy.error.message}`)
        setQuickLinksList([])
      } else {
        setQuickLinksList(((legacy.data ?? []) as Array<{ id: string; label: string; url: string; sequence_order: number }>).map((l) => ({ ...l, cities: [], notes: null })))
      }
    } else {
      setQuickLinksList(
        ((data ?? []) as Array<{ id: string; label: string; url: string; sequence_order: number; cities: string[] | null; notes: string | null }>).map(
          (l) => ({ ...l, cities: l.cities ?? [], notes: l.notes ?? null }),
        ),
      )
    }
    // Credentials are separate and optional: table may not exist yet (pre-push) and
    // RLS hides it from non-office roles — both just mean an empty map, not an error.
    const cred = await supabase.from('inspection_portal_credentials').select('quick_link_id, username, password')
    if (!cred.error && Array.isArray(cred.data)) {
      const map: Record<string, PortalCredential> = {}
      for (const row of cred.data as Array<{ quick_link_id: string; username: string | null; password: string | null }>) {
        map[row.quick_link_id] = { username: row.username, password: row.password }
      }
      setPortalCredentials(map)
    } else {
      setPortalCredentials({})
    }
    setQuickLinksLoading(false)
  }

  function openQuickLinksModal() {
    setQuickLinksModalOpen(true)
    setQuickLinkFormOpen(false)
    setEditingQuickLinkId(null)
    loadQuickLinks()
  }

  function openAddQuickLink() {
    setEditingQuickLinkId(null)
    setNewQuickLinkLabel('')
    setNewQuickLinkUrl('')
    setNewQuickLinkCities('')
    setNewQuickLinkNotes('')
    setNewQuickLinkUsername('')
    setNewQuickLinkPassword('')
    setQuickLinkFormOpen(true)
  }

  function openEditQuickLink(link: QuickLinkRow) {
    setEditingQuickLinkId(link.id)
    setNewQuickLinkLabel(link.label)
    setNewQuickLinkUrl(link.url)
    setNewQuickLinkCities(formatCitiesInput(link.cities))
    setNewQuickLinkNotes(link.notes ?? '')
    const cred = portalCredentials[link.id]
    setNewQuickLinkUsername(cred?.username ?? '')
    setNewQuickLinkPassword(cred?.password ?? '')
    setQuickLinkFormOpen(true)
  }

  function closeQuickLinkForm() {
    setQuickLinkFormOpen(false)
    setEditingQuickLinkId(null)
  }

  async function saveQuickLink(e: FormEvent) {
    e.preventDefault()
    const label = newQuickLinkLabel.trim()
    const url = newQuickLinkUrl.trim()
    if (!label || !url) return
    setQuickLinkSaving(true)
    onError(null)
    const cities = parseCitiesInput(newQuickLinkCities)
    const notes = newQuickLinkNotes.trim() || null
    let linkId = editingQuickLinkId
    if (editingQuickLinkId) {
      const { error: err } = await supabase.from('inspection_quick_links').update({ label, url, cities, notes }).eq('id', editingQuickLinkId)
      if (err) {
        onError(err.message)
        setQuickLinkSaving(false)
        return
      }
    } else {
      const { data, error: err } = await supabase
        .from('inspection_quick_links')
        .insert({ label, url, cities, notes, sequence_order: quickLinksList.length })
        .select('id')
        .single()
      if (err) {
        onError(err.message)
        setQuickLinkSaving(false)
        return
      }
      linkId = (data as { id: string } | null)?.id ?? null
    }
    if (linkId) {
      const username = newQuickLinkUsername.trim() || null
      const password = newQuickLinkPassword.trim() || null
      const credErr =
        username || password
          ? (await supabase.from('inspection_portal_credentials').upsert({ quick_link_id: linkId, username, password, updated_at: new Date().toISOString() })).error
          : (await supabase.from('inspection_portal_credentials').delete().eq('quick_link_id', linkId)).error
      if (credErr) {
        onError(`Portal saved, but sign-in info did not save: ${credErr.message}`)
        setQuickLinkSaving(false)
        await loadQuickLinks()
        return
      }
    }
    await loadQuickLinks()
    setQuickLinkSaving(false)
    closeQuickLinkForm()
  }

  async function deleteQuickLink(id: string) {
    if (!confirm('Delete this quick link?')) return
    setQuickLinkDeletingId(id)
    onError(null)
    const { error: err } = await supabase.from('inspection_quick_links').delete().eq('id', id)
    if (err) {
      onError(err.message)
    } else {
      await loadQuickLinks()
      closeQuickLinkForm()
    }
    setQuickLinkDeletingId(null)
  }

  useEffect(() => {
    if (!authUserId) return
    const t = setTimeout(() => {
      loadInspections()
      loadQuickLinks()
    }, 80)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, inspectionsMonth])

  /** Sign-in strip under an inspection row: the portal matched from the address city, with open/copy actions. */
  function renderInspectionPortalStrip(address: string | null) {
    const portal = matchPortalForInspectionAddress(quickLinksList, address)
    if (!portal) return null
    const cred = portalCredentials[portal.id]
    const btn = {
      padding: '0.3rem 0.65rem',
      borderRadius: 6,
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      fontSize: '0.75rem',
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
    } as const
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
        <button
          type="button"
          onClick={() => openInExternalBrowser(portal.url)}
          style={{ ...btn, border: '1px solid #2563eb', color: 'var(--text-blue-700)', fontWeight: 600 }}
        >
          Open {portal.label} ↗
        </button>
        {cred?.username && (
          <button type="button" onClick={() => void copyToClipboard(cred.username ?? '', 'Username')} style={btn}>
            Copy user
          </button>
        )}
        {cred?.password && (
          <button type="button" onClick={() => void copyToClipboard(cred.password ?? '', 'Password')} style={btn}>
            Copy password
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div>
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setAddInspectionModalOpen(true)}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Add Inspection
          </button>
          <button
            type="button"
            onClick={openInspectionTypesModal}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Edit Inspection Types
          </button>
        </div>
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Permit Portals</h3>
            <button
              type="button"
              onClick={openQuickLinksModal}
              style={{ padding: '0.35rem 0.75rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Edit Portals
            </button>
          </div>
          <input
            type="search"
            value={portalSearch}
            onChange={(e) => setPortalSearch(e.target.value)}
            placeholder="Find your city — e.g. Buda"
            aria-label="Find your city"
            style={{ width: '100%', maxWidth: 400, padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: '0.6rem', fontSize: '0.875rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'inherit' }}
          />
          {quickLinksLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            (() => {
              const filtered = filterPortalsByQuery(quickLinksList, portalSearch)
              return filtered.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {quickLinksList.length === 0 ? 'No permit portals yet — add one with Edit Portals.' : `No portal matches “${portalSearch}”.`}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.6rem' }}>
                  {filtered.map((link) => {
                    const cred = portalCredentials[link.id]
                    const revealed = revealedPasswordLinkId === link.id
                    return (
                      <div key={link.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.8rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.label}</span>
                          <button
                            type="button"
                            onClick={() => openInExternalBrowser(link.url)}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid #2563eb', background: 'var(--surface)', color: 'var(--text-blue-700)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
                          >
                            Open portal ↗
                          </button>
                        </div>
                        {link.cities.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {link.cities.map((city) => {
                              const hit = cityMatchesQuery(city, portalSearch)
                              return (
                                <span
                                  key={city}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.1rem 0.5rem',
                                    borderRadius: 999,
                                    background: hit ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
                                    color: hit ? 'var(--text-blue-700)' : 'var(--text-muted)',
                                    fontWeight: hit ? 600 : 400,
                                  }}
                                >
                                  {city}
                                </span>
                              )
                            })}
                          </div>
                        )}
                        {link.notes?.trim() ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{link.notes}</div>
                        ) : null}
                        {(cred?.username || cred?.password) && (
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {cred?.username && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-600)' }}>{cred.username}</span>
                                <button
                                  type="button"
                                  onClick={() => void copyToClipboard(cred.username ?? '', 'Username')}
                                  style={{ marginLeft: 'auto', padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                >
                                  Copy user
                                </button>
                              </div>
                            )}
                            {cred?.password && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                                <span style={{ fontFamily: 'monospace', letterSpacing: revealed ? 'normal' : '2px', color: 'var(--text-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {revealed ? cred.password : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRevealedPasswordLinkId(revealed ? null : link.id)}
                                  style={{ marginLeft: 'auto', padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                >
                                  {revealed ? 'Hide' : 'Show'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void copyToClipboard(cred.password ?? '', 'Password')}
                                  style={{ padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                >
                                  Copy password
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )}
        </section>
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 600 }}>Upcoming</h3>
          {inspectionsLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
          ) : (
            (() => {
              const today = new Date()
              const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
              const endKey = (() => {
                const d = new Date(today)
                d.setDate(d.getDate() + 14)
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              })()
              const upcoming = inspections.filter((i) => i.scheduled_date >= todayKey && i.scheduled_date <= endKey).slice(0, 14)
              return upcoming.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No upcoming inspections in the next 14 days.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {upcoming.map((i) => {
                    const parts = i.scheduled_date.split('-').map(Number)
                    const scheduled = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
                    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                    const diffDays = Math.round((scheduled.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
                    const dayOfWeek = scheduled.toLocaleDateString('en-US', { weekday: 'long' })
                    const formatted = `${i.scheduled_date} (${diffDays}) ${dayOfWeek}`
                    return (
                      <li key={i.id} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', borderRadius: 4, fontSize: '0.875rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>{formatted}</span>
                          <span style={{ color: 'var(--text-600)' }}>{' - '}{i.inspection_type}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                          <span style={{ fontWeight: 500 }}>{i.address}</span>
                          {i.address?.trim() && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address.trim())}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInExternalBrowser(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.address.trim())}`) }}
                              title={`View ${i.address} on map`}
                              style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)', flexShrink: 0 }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 16, height: 16, fill: 'currentColor' }}>
                                <path d="M576 112C576 103.7 571.7 96 564.7 91.6C557.7 87.2 548.8 86.8 541.4 90.5L416.5 152.1L244 93.4C230.3 88.7 215.3 89.6 202.1 95.7L77.8 154.3C69.4 158.2 64 166.7 64 176L64 528C64 536.2 68.2 543.9 75.1 548.3C82 552.7 90.7 553.2 98.2 549.7L225.5 489.8L396.2 546.7C409.9 551.3 424.7 550.4 437.8 544.2L562.2 485.7C570.6 481.7 576 473.3 576 464L576 112zM208 146.1L208 445.1L112 490.3L112 191.3L208 146.1zM256 449.4L256 148.3L384 191.8L384 492.1L256 449.4zM432 198L528 150.6L528 448.8L432 494L432 198z" />
                              </svg>
                            </a>
                          )}
                        </div>
                        {renderInspectionPortalStrip(i.address)}
                      </li>
                    )
                  })}
                </ul>
              )
            })()
          )}
        </section>
        <section>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>Inspection Schedule</h3>
          {inspectionsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button type="button" onClick={() => setInspectionsMonth(new Date(inspectionsMonth.getFullYear(), inspectionsMonth.getMonth() - 1, 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>←</button>
                  <span style={{ minWidth: 180, textAlign: 'center', fontWeight: 500 }}>{inspectionsMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                  <button type="button" onClick={() => setInspectionsMonth(new Date(inspectionsMonth.getFullYear(), inspectionsMonth.getMonth() + 1, 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>→</button>
                </div>
                <button type="button" onClick={() => setInspectionsMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}>Today</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--bg-200)', border: '1px solid var(--border)' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} style={{ background: 'var(--surface)', padding: '0.5rem', textAlign: 'center', fontWeight: 500, fontSize: '0.875rem' }}>{d}</div>
                ))}
                {(() => {
                  const year = inspectionsMonth.getFullYear()
                  const month = inspectionsMonth.getMonth()
                  const firstDay = new Date(year, month, 1)
                  const lastDay = new Date(year, month + 1, 0)
                  const days: Date[] = []
                  const startDayOfWeek = firstDay.getDay()
                  for (let i = startDayOfWeek - 1; i >= 0; i--) days.push(new Date(year, month, -i))
                  for (let day = 1; day <= lastDay.getDate(); day++) days.push(new Date(year, month, day))
                  for (let day = 1; day <= 6 - lastDay.getDay(); day++) days.push(new Date(year, month + 1, day))
                  const today = new Date()
                  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                  return days.map((day, idx) => {
                    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                    const dayInspections = inspections.filter((i) => i.scheduled_date === dateKey)
                    const isCurrentMonth = day.getMonth() === month
                    const isToday = dateKey === todayKey
                    return (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => setInspectionsSelectedDay(day)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspectionsSelectedDay(day) } }}
                        style={{
                          background: 'var(--surface)',
                          minHeight: 100,
                          padding: '0.5rem',
                          border: isToday ? '2px solid #2563eb' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ fontSize: '0.875rem', color: isCurrentMonth ? 'var(--text-strong)' : 'var(--text-faint)', fontWeight: isToday ? 600 : 400, marginBottom: '0.25rem' }}>{day.getDate()}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', flex: 1, minHeight: 0 }}>
                          {dayInspections.slice(0, 3).map((i) => (
                            <div key={i.id} style={{ fontSize: '0.7rem', padding: '2px 4px', background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${i.address} - ${i.inspection_type}`}>
                              {i.address} - {i.inspection_type}
                            </div>
                          ))}
                          {dayInspections.length > 3 && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{dayInspections.length - 3} more</div>}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </>
          )}
        </section>
        {inspectionsSelectedDay && (() => {
          const dateKey = `${inspectionsSelectedDay.getFullYear()}-${String(inspectionsSelectedDay.getMonth() + 1).padStart(2, '0')}-${String(inspectionsSelectedDay.getDate()).padStart(2, '0')}`
          const dayInspections = inspections.filter((i) => i.scheduled_date === dateKey)
          const dateStr = inspectionsSelectedDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setInspectionsSelectedDay(null)}>
              <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{dateStr}</h3>
                  <button type="button" onClick={() => setInspectionsSelectedDay(null)} style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>Close</button>
                </div>
                {dayInspections.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No inspections on this day.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {dayInspections.map((i) => (
                      <li key={i.id} style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', borderRadius: 4 }}>
                        <div style={{ fontWeight: 500 }}>{i.address}</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-600)' }}>{i.inspection_type}</div>
                        {renderInspectionPortalStrip(i.address)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })()}
        {inspectionTypesModalOpen && (
          <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
              {inspectionTypeFormOpen ? (
                <>
                  <h3 style={{ margin: '0 0 1rem 0' }}>{editingInspectionTypeName ? 'Edit inspection type' : 'Add inspection type'}</h3>
                  <form onSubmit={saveInspectionType}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Name *</label>
                      <input type="text" value={newInspectionTypeName} onChange={(e) => setNewInspectionTypeName(e.target.value)} required placeholder="e.g. Plumbing Rough-In" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={closeInspectionTypeForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                        {editingInspectionTypeName && (
                          <button type="button" onClick={() => deleteInspectionType(editingInspectionTypeName)} disabled={!!inspectionTypeDeletingName} style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: 'none', borderRadius: 4, cursor: inspectionTypeDeletingName ? 'not-allowed' : 'pointer' }}>{inspectionTypeDeletingName === editingInspectionTypeName ? '…' : 'Delete'}</button>
                        )}
                      </div>
                      <button type="submit" disabled={inspectionTypeSaving || !newInspectionTypeName.trim()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: inspectionTypeSaving ? 'not-allowed' : 'pointer' }}>{inspectionTypeSaving ? 'Saving…' : 'Save'}</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Inspection Types</h3>
                    <button type="button" onClick={() => setInspectionTypesModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }} aria-label="Close">×</button>
                  </div>
                  <button type="button" onClick={openAddInspectionType} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add type</button>
                  {inspectionTypesLoading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
                  ) : inspectionTypesList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No inspection types yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {inspectionTypesList.map((t) => (
                        <li key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                          <span>{t.name}</span>
                          <button type="button" onClick={() => openEditInspectionType(t)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {quickLinksModalOpen && (
          <div style={{ position: 'fixed', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '90%', maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
              {quickLinkFormOpen ? (
                <>
                  <h3 style={{ margin: '0 0 1rem 0' }}>{editingQuickLinkId ? 'Edit portal' : 'Add portal'}</h3>
                  <form onSubmit={saveQuickLink}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Label *</label>
                      <input type="text" value={newQuickLinkLabel} onChange={(e) => setNewQuickLinkLabel(e.target.value)} required placeholder="e.g. MGO Connect" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>URL *</label>
                      <input type="url" value={newQuickLinkUrl} onChange={(e) => setNewQuickLinkUrl(e.target.value)} required placeholder="https://..." style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Cities served</label>
                      <input type="text" value={newQuickLinkCities} onChange={(e) => setNewQuickLinkCities(e.target.value)} placeholder="Buda, Cibolo, San Marcos…" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Comma-separated. Powers the city search and matches scheduled inspections to this portal by address.</div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Sign-in user</label>
                      <input type="text" value={newQuickLinkUsername} onChange={(e) => setNewQuickLinkUsername(e.target.value)} autoComplete="off" placeholder="office@clickplumbing.com" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Sign-in password</label>
                      <input type="text" value={newQuickLinkPassword} onChange={(e) => setNewQuickLinkPassword(e.target.value)} autoComplete="off" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Visible to everyone who can open the Inspections tab.</div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Notes</label>
                      <textarea value={newQuickLinkNotes} onChange={(e) => setNewQuickLinkNotes(e.target.value)} rows={2} placeholder="Anything the office should know about this portal" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={closeQuickLinkForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                        {editingQuickLinkId && (
                          <button type="button" onClick={() => deleteQuickLink(editingQuickLinkId)} disabled={!!quickLinkDeletingId} style={{ padding: '0.5rem 1rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', border: 'none', borderRadius: 4, cursor: quickLinkDeletingId ? 'not-allowed' : 'pointer' }}>{quickLinkDeletingId === editingQuickLinkId ? '…' : 'Delete'}</button>
                        )}
                      </div>
                      <button type="submit" disabled={quickLinkSaving || !newQuickLinkLabel.trim() || !newQuickLinkUrl.trim()} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: quickLinkSaving ? 'not-allowed' : 'pointer' }}>{quickLinkSaving ? 'Saving…' : 'Save'}</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Permit Portals</h3>
                    <button type="button" onClick={() => setQuickLinksModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }} aria-label="Close">×</button>
                  </div>
                  <button type="button" onClick={openAddQuickLink} style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Add portal</button>
                  {quickLinksLoading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
                  ) : quickLinksList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No portals yet.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {quickLinksList.map((link) => (
                        <li key={link.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                          <span>{link.label}</span>
                          <button type="button" onClick={() => openEditQuickLink(link)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <AddInspectionModal
        open={addInspectionModalOpen}
        onClose={() => setAddInspectionModalOpen(false)}
        onSaved={() => { setAddInspectionModalOpen(false); loadInspections(); }}
        authUserId={authUserId}
      />
    </>
  )
}
