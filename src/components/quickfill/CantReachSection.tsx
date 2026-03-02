import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type Prospect = {
  id: string
  company_name: string | null
  contact_name: string | null
  phone_number: string | null
  email: string | null
  links_to_website: string | null
  last_contact: string | null
  prospect_fit_status: string | null
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
}

function formatDaysSince(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return ' (today)'
  if (diffDays === 1) return ' (1 day ago)'
  return ` (${diffDays} days ago)`
}

function formatWebsiteDisplay(url: string | null): string {
  if (!url || !url.trim()) return '—'
  let s = url.trim()
  s = s.replace(/^https?:\/\//i, '')
  s = s.replace(/^www\./i, '')
  s = s.replace(/\/+$/, '')
  return s || '—'
}

function getWebsiteHref(url: string | null): string {
  if (!url || !url.trim()) return '#'
  const s = url.trim()
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s
}

export function CantReachSection() {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOpen, setIsOpen] = useState(true)

  const canAccess = role === 'dev' || role === 'master_technician' || role === 'assistant'

  async function loadCantReach() {
    if (!authUser?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('prospects')
      .select('id, company_name, contact_name, phone_number, email, links_to_website, last_contact, prospect_fit_status')
      .eq('prospect_fit_status', 'cant_reach')
      .order('last_contact', { ascending: false, nullsFirst: false })
    if (error) {
      setProspects([])
    } else {
      setProspects((data ?? []) as Prospect[])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (canAccess && authUser?.id) loadCantReach()
  }, [canAccess, authUser?.id])

  if (!canAccess) return null

  async function handleSendBack(p: Prospect) {
    if (saving) return
    setSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: null })
      .eq('id', p.id)
    if (!error) await loadCantReach()
    setSaving(false)
  }

  async function handleNotAFitFromList(p: Prospect) {
    if (saving) return
    setSaving(true)
    const { error } = await supabase
      .from('prospects')
      .update({ prospect_fit_status: 'not_a_fit' })
      .eq('id', p.id)
    if (!error) await loadCantReach()
    setSaving(false)
  }

  async function handleDeleteFromList(p: Prospect) {
    if (saving) return
    if (!confirm(`Delete prospect "${p.company_name || 'Unknown'}"? This cannot be undone.`)) return
    setSaving(true)
    const { error } = await supabase.from('prospects').delete().eq('id', p.id)
    if (!error) await loadCantReach()
    setSaving(false)
  }

  function handleEdit(p: Prospect) {
    navigate(`/prospects?tab=prospect-list&prospect_id=${p.id}`)
  }

  if (loading && prospects.length === 0) return null
  if (prospects.length === 0) return null

  return (
    <section style={{ marginBottom: '2rem' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        style={{ margin: '0 0 0.5rem', width: '100%', fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
      >
        <span aria-hidden>{isOpen ? '\u25BC' : '\u25B6'}</span>
        Can&apos;t reach ({prospects.length})
      </button>
      {isOpen && (
        <div className="prospectListWrapper">
          <div className="prospectListDesktop">
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Company Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Contact Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Phone</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Last Contact</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Email / Links</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem' }}>{p.company_name || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{p.contact_name || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {p.phone_number ? (
                        <a href={`tel:${encodeURIComponent(p.phone_number)}`} style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
                          {p.phone_number}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{formatDateTime(p.last_contact)}{formatDaysSince(p.last_contact)}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div>
                          {p.email ? (
                            <a href={`mailto:${encodeURIComponent(p.email)}`} style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
                              {p.email}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                        <div>
                          {p.links_to_website ? (
                            <a
                              href={getWebsiteHref(p.links_to_website)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              {formatWebsiteDisplay(p.links_to_website)}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => handleEdit(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Edit</button>
                        <button type="button" onClick={() => handleSendBack(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Send back</button>
                        <button type="button" onClick={() => handleNotAFitFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Not a fit</button>
                        <button type="button" onClick={() => handleDeleteFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #dc2626', borderRadius: 4, background: 'white', color: '#dc2626', cursor: saving ? 'not-allowed' : 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="prospectListMobile">
            {prospects.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                <div className="prospectListMobileCard" style={{ paddingBottom: '3rem' }}>
                  <div className="prospectListMobileCardTitle">{p.company_name || '—'}</div>
                  <div className="prospectListMobileCardRow">
                    <span className="prospectListMobileCardLabel">Contact</span>
                    <span>{p.contact_name || '—'}</span>
                  </div>
                  <div className="prospectListMobileCardRow">
                    <span className="prospectListMobileCardLabel">Phone</span>
                    <span>
                      {p.phone_number ? (
                        <a href={`tel:${encodeURIComponent(p.phone_number)}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                          {p.phone_number}
                        </a>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                  <div className="prospectListMobileCardRow">
                    <span className="prospectListMobileCardLabel">Last Contact</span>
                    <span>{formatDateTime(p.last_contact)}{formatDaysSince(p.last_contact)}</span>
                  </div>
                  <div className="prospectListMobileCardRow">
                    <span className="prospectListMobileCardLabel">Email / Links</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>
                        {p.email ? (
                          <a href={`mailto:${encodeURIComponent(p.email)}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {p.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </span>
                      <span>
                        {p.links_to_website ? (
                          <a
                            href={getWebsiteHref(p.links_to_website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb', textDecoration: 'underline' }}
                          >
                            {formatWebsiteDisplay(p.links_to_website)}
                          </a>
                        ) : (
                          '—'
                        )}
                      </span>
                    </span>
                  </div>
                  <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleEdit(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => handleSendBack(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Send back</button>
                    <button type="button" onClick={() => handleNotAFitFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>Not a fit</button>
                    <button type="button" onClick={() => handleDeleteFromList(p)} disabled={saving} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #dc2626', borderRadius: 4, background: 'white', color: '#dc2626', cursor: saving ? 'not-allowed' : 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
