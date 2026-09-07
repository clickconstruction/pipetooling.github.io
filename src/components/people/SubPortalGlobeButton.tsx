import { useCallback, useMemo, useRef, useState } from 'react'
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
  slugGuessabilityDetail,
  slugGuessabilityLabel,
  suggestSlugFromName,
  suggestSlugWithTail,
} from '../../lib/portal/portalSlug'
import { PORTAL_SHORT_ORIGIN, portalShortUrl } from '../../lib/portal/portalShortOrigin'
import { setSubPortalGlobeState, useSubPortalGlobeState } from '../../hooks/useSubPortalOffStates'
import { portalGlobeTint, portalGlobeTitle } from '../../lib/portal/portalGlobeTint'
import PortalGlobeIcon from '../shared/PortalGlobeIcon'
import { withPreviewFlag } from '../../lib/publicViewCounting'
import { useSubPortalVisitSummaries } from '../../hooks/useSubPortalVisitSummaries'
import { visitLine, whenWord } from '../../lib/portal/subPortalVisits'
import { SubPortalVisitsModal } from './SubPortalVisitsModal'

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
  // SP-1 (v2.3067): once an address is live, show it as text; the editor hides behind "Change address…".
  const [changeOpen, setChangeOpen] = useState(false)
  const [timeline, setTimeline] = useState<PortalTimelineEntry[]>([])
  // Did they look? (v2.2922) — one summary row while the card is open; the visits modal holds the trail.
  const visitIds = useMemo(() => [personId], [personId])
  const visits = useSubPortalVisitSummaries(visitIds, open)
  const [visitsOpen, setVisitsOpen] = useState(false)
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const diceBase = useRef<{ base: string; out: string } | null>(null)
  const globeState = useSubPortalGlobeState(personId)
  const globeTint = portalGlobeTint(globeState)

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
      if (slugRow?.slug) {
        setSlugInput(slugRow.slug)
      } else {
        // Default = their name + a random tail (journey-map B18 / J21-F6); remember the
        // base so the hero 🎲 re-rolls the tail instead of stacking one.
        const suggested = suggestSlugWithTail(personName)
        setSlugInput(suggested.slug)
        diceBase.current = suggested.slug ? { base: suggested.base, out: suggested.slug } : null
      }
      setAddrInput(slugRow?.slug ?? '')

      const active = rows.find((r) => r.revoked_at === null)
      const verdict = portalGlobeInitialState(adapted, personId)
      if (verdict === 'active' && active?.token) {
        setMain({ kind: 'active', token: active.token })
        setSubPortalGlobeState(personId, 'active')
        return
      }
      if (verdict === 'off') {
        setMain({ kind: 'off' })
        setSubPortalGlobeState(personId, 'off')
        return
      }
      // Never-minted (the adapter has no legacy audiences, so nothing else is
      // left): open into the unminted state — the mint waits for a click.
      setMain({ kind: 'unminted' })
      setSubPortalGlobeState(personId, 'unminted')
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
  // Office openers (Preview, the live iframe) carry `?preview=1` so the load is not counted as the
  // sub looking (journey-map #37). The copyable link above never carries it.
  const previewUrl = tokenUrl ? withPreviewFlag(tokenUrl) : null

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
    // The live address wins whenever there is one — the input can never hand out a different tail.
    const value = slugSaved && !changeOpen ? slugSaved : slugInput.replace(/-+$/, '')
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

  const rollDice = (current: string, apply: (v: string) => void) => {
    const trimmed = current.replace(/-+$/, '')
    const base = diceBase.current && diceBase.current.out === current ? diceBase.current.base : trimmed
    const out = appendRandomTail(base)
    diceBase.current = { base, out }
    apply(out)
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
      setSubPortalGlobeState(personId, 'off')
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
      setSubPortalGlobeState(personId, 'active')
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
      setSubPortalGlobeState(personId, 'active')
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
  // The meter knows the name-derived suggestion, so the bare name grades easy however long it is.
  const guess = isValidSlug(slugInput.replace(/-+$/, '')) ? slugGuessabilityDetail(slugInput, suggestSlugFromName(personName)) : null

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
        title={portalGlobeTitle(personName, globeState)}
        aria-label={`Manage ${personName}'s sub portal`}
        data-portal-tone={globeTint.tone}
        onClick={openModal}
        style={{
          background: 'none',
          border: 'none',
          padding: 2,
          cursor: 'pointer',
          color: globeTint.color,
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
        }}
      >
        <PortalGlobeIcon size={size} />
      </button>
      <SubPortalVisitsModal personId={visitsOpen ? personId : null} personName={personName} onClose={() => { setVisitsOpen(false); visits.reload() }} />
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
                {slugSaved && !changeOpen ? (
                  <div style={{ marginTop: '0.7rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>Their address</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span data-testid="sub-portal-live-address" style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {SHORT_PREFIX}/{slugSaved}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSlugInput(slugSaved); setChangeOpen(true) }}
                        style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', background: 'var(--surface)', color: 'var(--text-900)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}
                      >
                        Change address…
                      </button>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {slugLocked ? 'Shared — this is what resolves and what Copy link copies.' : 'Saved but not yet shared — Copy link shares it as is.'}
                    </p>
                  </div>
                ) : (
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
                    {!slugLocked && (
                      <button
                        type="button"
                        onClick={() => rollDice(slugInput, setSlugInput)}
                        title="New random tail"
                        aria-label="New random tail"
                        style={{ border: 'none', borderLeft: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', padding: '0.45rem 0.6rem', fontSize: '0.85rem', cursor: 'pointer', flex: 'none' }}
                      >
                        🎲
                      </button>
                    )}
                  </div>
                  {!slugLocked && guess ? (
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: guess.grade === 'hard' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>
                      {slugGuessabilityLabel(guess)}
                      {guess.grade === 'hard' ? ' — safe to print on paper' : ' — press 🎲 for a random tail'}
                    </p>
                  ) : null}
                </div>
                )}
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
                    onClick={() => previewUrl && window.open(previewUrl, '_blank', 'noopener')}
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
                        {smallBtn('🎲', () => rollDice(addrInput, setAddrInput))}
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
                    {(() => {
                      const s = visits.byPerson.get(personId)
                      const line = visitLine(s, { hasLink: main.kind === 'active' })
                      return (
                        <>
                          {gearRow(
                            'Opened',
                            <div>
                              <span style={{ fontSize: '0.8rem', color: line?.tone === 'green' ? 'var(--text-700)' : 'var(--text-muted)' }}>{s ? (s.outsideOpens > 0 && s.lastOutsideAt ? `Opened ${s.outsideOpens === 1 ? 'once' : s.outsideOpens === 2 ? 'twice' : `${s.outsideOpens} times`} · last ${whenWord(s.lastOutsideAt)}` : 'Not opened yet') : '—'}</span>
                              <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Outside opens — the sub, or whoever they sent the link to. Your previews don't count.</p>
                            </div>,
                          )}
                          {gearRow(
                            'Team',
                            <div>
                              <span style={{ fontSize: '0.8rem', color: line?.team ? 'var(--text-700)' : 'var(--text-muted)' }}>{s ? (s.staffLooks > 0 && s.lastStaffAt ? `Last looked: ${s.lastStaffName ?? 'a teammate'} · ${whenWord(s.lastStaffAt)}` : 'Nobody on the team yet') : '—'}</span>
                              <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Signed-in teammates opening the real link. Kept apart from the sub's own opens.</p>
                            </div>,
                          )}
                          {gearRow(
                            'Trail',
                            <span>{smallBtn('All visits ›', () => setVisitsOpen(true))}</span>,
                          )}
                        </>
                      )
                    })()}
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
                {previewUrl && (
                  <div style={{ marginTop: '0.9rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', height: 260 }}>
                    <iframe
                      title={`${personName}'s portal preview`}
                      src={previewUrl}
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
