import { useCallback, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  buildPortalTimeline,
  portalGlobeInitialState,
  type PortalSlugEventRow,
  type PortalTimelineEntry,
} from '../../lib/portal/portalLinkState'
import { recordNavClick } from '../../lib/navClickTelemetry'
import {
  appendRandomTail,
  isValidSlug,
  normalizeSlugInput,
  slugGuessability,
  suggestSlugFromName,
} from '../../lib/portal/portalSlug'
import { PORTAL_SHORT_ORIGIN, portalShortUrl } from '../../lib/portal/portalShortOrigin'
import { setSubPortalOff, useSubPortalLinkOff } from '../../hooks/useSubPortalOffStates'

/**
 * 🌐 next to a sub's name (sub-portal train): office staff manage the sub's
 * no-login Work & Pay portal. A deliberate near-clone of
 * CustomerPortalGlobeButton minus audiences (a sub has exactly one view):
 * hero = the custom address (editable until first shared) + Copy / Preview /
 * gear (Direct link · Address · Reset · History) + a scaled live preview.
 * A turned-off portal paints the globe red app-wide, and opening the modal
 * never silently re-mints a portal that was deliberately turned off — nor
 * mints one for a never-shared sub (journey-map #14(b)): that opens into
 * "No portal link yet" and the link is created only on "Create their link".
 * Self-contained; renders nothing for non-office roles.
 */

type MainState =
  | { kind: 'loading' }
  | { kind: 'unminted' }
  | { kind: 'active'; token: string }
  | { kind: 'off' }
  | { kind: 'error'; message: string }

type SubLinkRow = {
  person_id: string
  token: string | null
  created_at: string
  revoked_at: string | null
  created_by: string | null
}

type MintResult = { token?: string; activeSince?: string; error?: string }
type SlugResult = { slug?: string; unchanged?: boolean; error?: string }

const SHORT_PREFIX = PORTAL_SHORT_ORIGIN.replace(/^https:\/\//, '')

export default function SubPortalGlobeButton({
  personId,
  personName,
  size = 15,
}: {
  personId: string
  personName: string
  size?: number
}) {
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [main, setMain] = useState<MainState>({ kind: 'loading' })
  const [gearOpen, setGearOpen] = useState(false)
  const [slugInput, setSlugInput] = useState('')
  const [slugSaved, setSlugSaved] = useState<string | null>(null)
  const [slugLocked, setSlugLocked] = useState(false)
  const [addrInput, setAddrInput] = useState('')
  const [timeline, setTimeline] = useState<PortalTimelineEntry[]>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const diceBase = useRef<{ base: string; out: string } | null>(null)
  const mainOff = useSubPortalLinkOff(personId)

  const mint = useCallback(
    async (rotate: boolean): Promise<string | null> => {
      const { data, error } = await supabase.rpc('mint_sub_portal_link' as never, {
        p_person_id: personId,
        p_rotate: rotate,
      } as never)
      if (error) throw error
      const res = data as unknown as MintResult
      if (res.error) throw new Error(res.error)
      return res.token ?? null
    },
    [personId],
  )

  /** Resolve state WITHOUT reviving a deliberately turned-off portal. */
  const loadState = useCallback(async () => {
    setMain({ kind: 'loading' })
    try {
      const [linksRes, slugRes, eventsRes] = await Promise.all([
        supabase
          .from('sub_portal_links' as never)
          .select('person_id, token, created_at, revoked_at, created_by')
          .eq('person_id', personId)
          .order('created_at', { ascending: false }),
        supabase
          .from('sub_portal_slugs' as never)
          .select('slug, locked_at')
          .eq('person_id', personId)
          .maybeSingle(),
        supabase
          .from('sub_portal_slug_events' as never)
          .select('event, slug, created_at, created_by')
          .eq('person_id', personId)
          .order('created_at', { ascending: false })
          .limit(25),
      ])
      if (linksRes.error) throw linksRes.error
      const rows = (linksRes.data ?? []) as unknown as SubLinkRow[]
      const slugEvents = ((eventsRes.data ?? []) as unknown as PortalSlugEventRow[])
      // Adapt into the customer kernels' shape (audience 'all') — one tested
      // timeline/off-verdict implementation, two portals.
      const adapted = rows.map((r) => ({
        customer_id: r.person_id,
        audience: 'all',
        token: r.token,
        created_at: r.created_at,
        revoked_at: r.revoked_at,
        created_by: r.created_by,
      }))
      setTimeline(buildPortalTimeline(adapted, slugEvents))

      const creatorIds = [
        ...new Set(
          [...rows.map((r) => r.created_by), ...slugEvents.map((e) => e.created_by)].filter((v): v is string => !!v),
        ),
      ]
      if (creatorIds.length > 0) {
        void supabase
          .from('users')
          .select('id, name')
          .in('id', creatorIds)
          .then(({ data: users }) => {
            if (!users) return
            setCreatorNames((prev) => {
              const next = { ...prev }
              for (const u of users) {
                if (u.name) next[u.id] = u.name
              }
              return next
            })
          })
      }

      const slugRow = (slugRes.data ?? null) as { slug: string; locked_at: string | null } | null
      setSlugSaved(slugRow?.slug ?? null)
      setSlugLocked(!!slugRow?.locked_at)
      setSlugInput(slugRow?.slug ?? suggestSlugFromName(personName))
      setAddrInput(slugRow?.slug ?? '')

      const active = rows.find((r) => r.revoked_at === null)
      const verdict = portalGlobeInitialState(adapted, personId)
      if (verdict === 'active' && active?.token) {
        setMain({ kind: 'active', token: active.token })
        setSubPortalOff(personId, false)
        return
      }
      if (verdict === 'off') {
        setMain({ kind: 'off' })
        setSubPortalOff(personId, true)
        return
      }
      // Never-minted (the adapter has no legacy audiences, so nothing else is
      // left): open into the unminted state — the mint waits for a click.
      setMain({ kind: 'unminted' })
      setSubPortalOff(personId, false)
    } catch (e) {
      setMain({ kind: 'error', message: formatErrorMessage(e, 'Could not load the portal link') })
    }
  }, [personId, personName, mint])

  const canManage = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  if (!canManage) return null

  const openModal = () => {
    setOpen(true)
    setGearOpen(false)
    diceBase.current = null
    void loadState()
  }

  const tokenUrl = main.kind === 'active' ? `${window.location.origin}/sub?t=${main.token}` : null

  const saveSlug = async (value: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('set_sub_portal_slug' as never, {
      p_person_id: personId,
      p_slug: value,
    } as never)
    if (error) throw error
    const res = data as unknown as SlugResult
    if (res.error) {
      showToast(res.error, 'error')
      return false
    }
    setSlugSaved(res.slug ?? value)
    return true
  }

  const copyAddress = async () => {
    const value = slugInput.replace(/-+$/, '')
    if (!isValidSlug(value)) {
      showToast('Addresses are 3-60 characters: letters, numbers, and dashes.', 'error')
      return
    }
    setBusy(true)
    try {
      if (slugSaved !== value) {
        if (!(await saveSlug(value))) return
      }
      if (!slugLocked) {
        const { data, error } = await supabase.rpc('mark_sub_portal_slug_shared' as never, {
          p_person_id: personId,
        } as never)
        if (error) throw error
        const res = data as unknown as { locked?: boolean; error?: string }
        if (res.error) throw new Error(res.error)
        setSlugLocked(true)
        setSlugInput(value)
        setAddrInput(value)
      }
      await navigator.clipboard.writeText(portalShortUrl(value))
      showToast('Portal address copied.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not copy the address'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label} copied.`, 'success')
    } catch {
      showToast('Could not copy — select the link text instead.', 'error')
    }
  }

  const rollDice = () => {
    const trimmed = addrInput.replace(/-+$/, '')
    const base = diceBase.current && diceBase.current.out === addrInput ? diceBase.current.base : trimmed
    const out = appendRandomTail(base)
    diceBase.current = { base, out }
    setAddrInput(out)
  }

  const saveAddressChange = async () => {
    const value = addrInput.replace(/-+$/, '')
    if (!isValidSlug(value)) {
      showToast('Addresses are 3-60 characters: letters, numbers, and dashes.', 'error')
      return
    }
    if (value === slugSaved) return
    if (
      !(await confirmDialog({
        message: 'Saving a new address makes the old one stop working — printed or texted copies go stale. Save it?',
      }))
    )
      return
    setBusy(true)
    try {
      if (await saveSlug(value)) {
        setSlugInput(value)
        showToast('Portal address changed.', 'success')
        await loadState()
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not change the address'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rotate = async () => {
    if (
      !(await confirmDialog({
        message: `Rotate ${personName}'s portal link? The current link stops working immediately — the custom address follows to the new one.`,
      }))
    )
      return
    setBusy(true)
    try {
      await mint(true)
      showToast('New link created — the old one no longer works.', 'success')
      await loadState()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not rotate the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (
      !(await confirmDialog({
        message: `Turn off ${personName}'s portal? Nobody can open their page until it's turned back on.`,
      }))
    )
      return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('revoke_sub_portal_link' as never, {
        p_person_id: personId,
      } as never)
      if (error) throw error
      const res = data as unknown as { revoked?: number; error?: string }
      if (res.error) throw new Error(res.error)
      showToast('Portal turned off.', 'success')
      setSubPortalOff(personId, true)
      await loadState()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not turn off the portal'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const turnBackOn = async () => {
    setBusy(true)
    try {
      const token = await mint(false)
      if (!token) throw new Error('No link returned')
      showToast('Portal turned back on — this is a brand-new link.', 'success')
      setSubPortalOff(personId, false)
      await loadState()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not turn the portal back on'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** The ONE place a never-shared sub's link comes into being: a click, a toast, a telemetry row. */
  const createLink = async () => {
    setBusy(true)
    try {
      const token = await mint(false)
      if (!token) throw new Error('No link returned')
      setMain({ kind: 'active', token })
      setSubPortalOff(personId, false)
      setTimeline((prev) => [
        { kind: 'link', at: new Date().toISOString(), createdBy: user?.id ?? null, audience: 'all', outcome: 'active', revokedAt: null },
        ...prev,
      ])
      showToast('Portal link created.', 'success')
      recordNavClick(user?.id, role, 'portal_link_minted', '#sub-globe')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const firstName = personName.trim().split(/\s+/)[0] || 'the sub'
  const guess = isValidSlug(slugInput.replace(/-+$/, '')) ? slugGuessability(slugInput.replace(/-+$/, '')) : null

  const gearRow = (label: string, body: React.ReactNode) => (
    <div style={{ display: 'flex', gap: '0.8rem', padding: '0.5rem 0', borderBottom: '1px dotted var(--border)', fontSize: '0.82rem' }}>
      <span style={{ width: 92, flexShrink: 0, fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', paddingTop: 2 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
    </div>
  )

  const smallBtn = (label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      style={{
        padding: '0.3rem 0.7rem',
        fontSize: '0.78rem',
        fontWeight: 600,
        border: danger ? '1px solid #f1c4bf' : '1px solid var(--border-strong)',
        background: 'var(--surface)',
        color: danger ? '#b42318' : 'var(--text-900)',
        borderRadius: 6,
        cursor: busy ? 'wait' : 'pointer',
        marginRight: 6,
      }}
    >
      {label}
    </button>
  )

  return (
    <>
      <button
        type="button"
        title={mainOff ? `${personName}'s portal (turned off)` : `${personName}'s portal`}
        aria-label={`Manage ${personName}'s sub portal`}
        onClick={openModal}
        style={{
          background: 'none',
          border: 'none',
          padding: 2,
          cursor: 'pointer',
          fontSize: size,
          lineHeight: 1,
          filter: mainOff ? 'grayscale(1) sepia(1) saturate(6) hue-rotate(-40deg)' : undefined,
        }}
      >
        🌐
      </button>
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: '1rem' }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${personName}'s portal`}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 10,
              padding: '1.1rem 1.2rem',
              width: 'min(94vw, 560px)',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{personName}&#8217;s portal</h2>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {main.kind === 'loading' && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading…</p>}
            {main.kind === 'error' && <p style={{ fontSize: '0.85rem', color: 'var(--text-red-700)' }}>{main.message}</p>}
            {main.kind === 'off' && (
              <div style={{ marginTop: '0.6rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  This portal is <strong style={{ color: '#b42318' }}>turned off</strong> — nobody can open {firstName}&#8217;s page.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void turnBackOn()}
                  style={{ padding: '0.45rem 1rem', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
                >
                  Turn portal back on
                </button>
              </div>
            )}

            {main.kind === 'unminted' && (
              <div style={{ marginTop: '0.6rem', border: '1px dashed var(--border-strong)', borderRadius: 7, padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-900)' }}>No portal link yet.</div>
                <p style={{ margin: '0.3rem 0 0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {personName} has never been given a portal page. Creating the link makes their page live — you decide when to text it. Just looking? Close this and nothing is created.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createLink()}
                  style={{ padding: '0.45rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
                >
                  {busy ? 'Creating…' : 'Create their link'}
                </button>
              </div>
            )}

            {main.kind === 'active' && (
              <>
                <div style={{ marginTop: '0.7rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>
                    Easy address
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border-strong)', borderRadius: 7, overflow: 'hidden' }}>
                    <span style={{ padding: '0.45rem 0 0.45rem 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{SHORT_PREFIX}</span>
                    <input
                      type="text"
                      value={slugInput}
                      readOnly={slugLocked}
                      onChange={(e) => setSlugInput(normalizeSlugInput(e.target.value))}
                      style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '0.45rem 0.6rem 0.45rem 0', fontSize: '0.85rem', fontWeight: 700, background: 'transparent', color: 'var(--text-900)' }}
                    />
                  </div>
                  {!slugLocked && guess ? (
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: guess === 'hard' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>
                      Guessability: {guess} {guess === 'hard' ? '✓ — safe to print on paper' : '— consider adding a 🎲 tail in the gear'}
                    </p>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void copyAddress()}
                    style={{ padding: '0.45rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: busy ? 'wait' : 'pointer' }}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => tokenUrl && window.open(tokenUrl, '_blank', 'noopener')}
                    style={{ padding: '0.45rem 1rem', background: 'var(--surface)', color: 'var(--text-900)', border: '1px solid var(--border-strong)', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Preview as {firstName}
                  </button>
                  <button
                    type="button"
                    aria-label="More options"
                    aria-expanded={gearOpen}
                    onClick={() => setGearOpen((g) => !g)}
                    style={{ padding: '0.45rem 0.7rem', background: gearOpen ? 'var(--bg-subtle)' : 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}
                  >
                    ⚙
                  </button>
                </div>

                {gearOpen && (
                  <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border)' }}>
                    {gearRow(
                      'Direct link',
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{tokenUrl}</span>
                        {smallBtn('Copy', () => void copyText(tokenUrl ?? '', 'Direct link'))}
                      </span>,
                    )}
                    {gearRow(
                      'Address',
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={addrInput}
                          onChange={(e) => setAddrInput(normalizeSlugInput(e.target.value))}
                          style={{ flex: 1, minWidth: 140, padding: '0.3rem 0.5rem', fontSize: '0.78rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-900)' }}
                        />
                        {smallBtn('🎲', rollDice)}
                        {smallBtn('Save', () => void saveAddressChange())}
                      </span>,
                    )}
                    {gearRow(
                      'Reset',
                      <span>
                        {smallBtn('Rotate link', () => void rotate())}
                        {smallBtn('Turn off portal', () => void turnOff(), true)}
                      </span>,
                    )}
                    {gearRow(
                      'History',
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.6 }}>
                        {timeline.length === 0
                          ? '—'
                          : timeline.slice(0, 8).map((entry, i) => (
                              <div key={i}>
                                {entry.kind === 'link' ? (
                                  <>
                                    Link created {fmtWhen(entry.at)}
                                    {entry.createdBy && creatorNames[entry.createdBy] ? ` by ${creatorNames[entry.createdBy]}` : ''}
                                    {entry.outcome === 'rotated' && entry.revokedAt ? ` — rotated ${fmtWhen(entry.revokedAt)}` : ''}
                                    {entry.outcome === 'turned-off' && entry.revokedAt ? ` — turned off ${fmtWhen(entry.revokedAt)}` : ''}
                                  </>
                                ) : (
                                  <>
                                    Address {entry.event === 'locked' ? 'locked (first shared)' : entry.event}
                                    {entry.slug ? ` "${entry.slug}"` : ''} {fmtWhen(entry.at)}
                                    {entry.createdBy && creatorNames[entry.createdBy] ? ` by ${creatorNames[entry.createdBy]}` : ''}
                                  </>
                                )}
                              </div>
                            ))}
                      </div>,
                    )}
                  </div>
                )}

                {/* Live preview — the sub's actual page, scaled down. */}
                {tokenUrl && (
                  <div style={{ marginTop: '0.9rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', height: 260 }}>
                    <iframe
                      title={`${personName}'s portal preview`}
                      src={tokenUrl}
                      sandbox="allow-scripts allow-same-origin"
                      style={{ width: '161%', height: 420, border: 'none', transform: 'scale(0.62)', transformOrigin: 'top left', pointerEvents: 'none' }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
