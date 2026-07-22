import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'

/**
 * Company documents (company_documents, v2.941): dev-maintained name+link rows
 * (Bank Deposit Details, I-9, Certificate of Insurance, …) that office staff
 * click to open the most recent copy.
 *
 * v2.943: the list itself is read-only everywhere; dev management lives behind
 * a ⚙ gear at the top-right of the Documents → Company tab (`showManage`),
 * opening a modal editor. The Settings → Your account block stays view-only
 * with a pointer for devs.
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

export default function SettingsCompanyDocumentsSection({
  isDev,
  showManage = false,
}: {
  isDev: boolean
  /** Documents → Company tab: render the dev ⚙ manage button (top-right). */
  showManage?: boolean
}) {
  const { showToast } = useToastContext()
  const [docs, setDocs] = useState<CompanyDocument[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
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
    <div style={{ marginTop: showManage ? 0 : '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>Company documents</h2>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            The current copy of each document — click to open.
            {isDev && !showManage ? ' Manage the list on Documents → Company (⚙).' : ''}
          </p>
        </div>
        {isDev && showManage ? (
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            title="Manage company documents"
            aria-label="Manage company documents"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem', padding: '0 0.25rem', lineHeight: 1 }}
          >
            ⚙
          </button>
        ) : null}
      </div>
      {!loaded ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : docs.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          No documents yet.{isDev && showManage ? ' Add the first with the ⚙ above.' : ''}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {docs.map((doc) => (
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
            </div>
          ))}
        </div>
      )}

      {manageOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Manage company documents"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
        >
          <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 640, width: 'calc(100vw - 2rem)', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>Manage company documents</h2>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Swap a link when a new version exists — the &ldquo;updated&rdquo; date refreshes automatically. Office staff see changes immediately.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
              {docs.length === 0 && <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No documents yet — add the first below.</p>}
              {docs.map((doc, idx) => {
                const d = drafts[doc.id] ?? { name: doc.name, link_url: doc.link_url }
                const dirty = d.name !== doc.name || d.link_url !== doc.link_url
                return (
                  <div key={doc.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [doc.id]: { ...d, name: e.target.value } }))}
                      aria-label={`Document ${idx + 1} name`}
                      style={{ padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                    <input
                      type="url"
                      value={d.link_url}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [doc.id]: { ...d, link_url: e.target.value } }))}
                      aria-label={`Document ${idx + 1} link`}
                      style={{ padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                    />
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button type="button" disabled={busy || idx === 0} onClick={() => void moveDoc(doc.id, -1)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        ↑
                      </button>
                      <button type="button" disabled={busy || idx === docs.length - 1} onClick={() => void moveDoc(doc.id, 1)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        ↓
                      </button>
                      <span style={{ flex: 1 }} />
                      {dirty && (
                        <button type="button" disabled={busy || !d.name.trim() || !d.link_url.trim()} onClick={() => void saveDoc(doc.id)} style={{ padding: '0.25rem 0.7rem', fontSize: '0.8125rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                          Save
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => void deleteDoc(doc.id)} style={{ padding: '0.25rem 0.7rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-red-600)', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name — e.g. Bank Deposit Details"
                aria-label="New document name"
                style={{ padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              <input
                type="url"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="Link to the current copy"
                aria-label="New document link"
                style={{ padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={busy || !newName.trim() || !newLink.trim()}
                  onClick={() => void addDoc()}
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: busy || !newName.trim() || !newLink.trim() ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: busy || !newName.trim() || !newLink.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                >
                  + Add document
                </button>
                <button
                  type="button"
                  onClick={() => setManageOpen(false)}
                  disabled={busy}
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
