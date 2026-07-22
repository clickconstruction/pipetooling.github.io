import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * Settings → Your account → "Company documents" (office roles): dev-maintained
 * name+link rows (Bank Deposit Details, I-9, Certificate of Insurance, …).
 * Staff click to open the most recent copy; devs manage the list inline.
 * RLS: office roles read, devs write (company_documents, v2.941).
 */

type CompanyDocument = {
  id: string
  name: string
  link_url: string
  position: number
  updated_at: string | null
}

function freshnessLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function SettingsCompanyDocumentsSection({ isDev }: { isDev: boolean }) {
  const { showToast } = useToastContext()
  const [docs, setDocs] = useState<CompanyDocument[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { name: string; link_url: string }>>({})
  const [newName, setNewName] = useState('')
  const [newLink, setNewLink] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('company_documents')
      .select('id, name, link_url, position, updated_at')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    setDocs((data ?? []) as CompanyDocument[])
    setLoaded(true)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function addDoc() {
    if (busy || !newName.trim() || !newLink.trim()) return
    setBusy(true)
    const url = /^https?:\/\//i.test(newLink.trim()) ? newLink.trim() : `https://${newLink.trim()}`
    const maxPos = docs.reduce((m, d) => Math.max(m, d.position), 0)
    const { error } = await supabase.from('company_documents').insert({ name: newName.trim(), link_url: url, position: maxPos + 1 })
    setBusy(false)
    if (error) {
      showToast(`Failed to add: ${error.message}`, 'error')
      return
    }
    setNewName('')
    setNewLink('')
    await load()
  }

  async function saveDoc(id: string) {
    const d = drafts[id]
    if (busy || !d || !d.name.trim() || !d.link_url.trim()) return
    setBusy(true)
    const url = /^https?:\/\//i.test(d.link_url.trim()) ? d.link_url.trim() : `https://${d.link_url.trim()}`
    const { error } = await supabase.from('company_documents').update({ name: d.name.trim(), link_url: url }).eq('id', id)
    setBusy(false)
    if (error) {
      showToast(`Failed to save: ${error.message}`, 'error')
      return
    }
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await load()
  }

  async function moveDoc(id: string, delta: -1 | 1) {
    if (busy) return
    const idx = docs.findIndex((d) => d.id === id)
    const other = docs[idx + delta]
    if (!other) return
    setBusy(true)
    const results = await Promise.all([
      supabase.from('company_documents').update({ position: idx + delta + 1 }).eq('id', id),
      supabase.from('company_documents').update({ position: idx + 1 }).eq('id', other.id),
    ])
    setBusy(false)
    const err = results.find((r) => r.error)?.error
    if (err) showToast(`Failed to reorder: ${err.message}`, 'error')
    await load()
  }

  async function deleteDoc(id: string) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.from('company_documents').delete().eq('id', id)
    setBusy(false)
    if (error) {
      showToast(`Failed to delete: ${error.message}`, 'error')
      return
    }
    await load()
  }

  if (loaded && docs.length === 0 && !isDev) return null

  return (
    <div style={{ marginTop: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem' }}>
      <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>Company documents</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        The current copy of each document — click to open{isDev ? '. You (dev) manage the list; office staff see these links.' : '.'}
      </p>
      {!loaded ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {docs.map((doc, idx) => {
            const d = drafts[doc.id] ?? { name: doc.name, link_url: doc.link_url }
            const dirty = d.name !== doc.name || d.link_url !== doc.link_url
            return (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a
                  href={doc.link_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.8rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 8,
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-link)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                  }}
                >
                  📄 {doc.name}
                </a>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{freshnessLabel(doc.updated_at)}</span>
                {isDev && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [doc.id]: { ...d, name: e.target.value } }))}
                      aria-label={`Document ${idx + 1} name`}
                      style={{ width: '10rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                    />
                    <input
                      type="url"
                      value={d.link_url}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [doc.id]: { ...d, link_url: e.target.value } }))}
                      aria-label={`Document ${idx + 1} link`}
                      style={{ width: '14rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }}
                    />
                    {dirty && (
                      <button type="button" disabled={busy} onClick={() => void saveDoc(doc.id)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.8125rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                        Save
                      </button>
                    )}
                    <button type="button" disabled={busy || idx === 0} onClick={() => void moveDoc(doc.id, -1)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      ↑
                    </button>
                    <button type="button" disabled={busy || idx === docs.length - 1} onClick={() => void moveDoc(doc.id, 1)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      ↓
                    </button>
                    <button type="button" disabled={busy} onClick={() => void deleteDoc(doc.id)} style={{ padding: '0.2rem 0.45rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-red-600)', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </span>
                )}
              </div>
            )
          })}
          {docs.length === 0 && <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No documents yet.</p>}
          {isDev && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem', borderTop: '1px dashed var(--border)', paddingTop: '0.6rem' }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name — e.g. Bank Deposit Details"
                aria-label="New document name"
                style={{ width: '13rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
              <input
                type="url"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="Link to the current copy"
                aria-label="New document link"
                style={{ flex: '1 1 14rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
              <button
                type="button"
                disabled={busy || !newName.trim() || !newLink.trim()}
                onClick={() => void addDoc()}
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.875rem', background: busy || !newName.trim() || !newLink.trim() ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy || !newName.trim() || !newLink.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                + Add document
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
