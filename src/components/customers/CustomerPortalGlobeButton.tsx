import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  buildPortalTimeline,
  portalGlobeInitialState,
  type PortalLinkRow,
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
import { formatPortalDate, formatPortalUsd, parsePortalPayload, PORTAL_TRADE_COLORS, type PortalTradeTag } from '../../lib/portal/portalPayload'
import { buildStatementBillRows, type StatementBillRow } from '../../lib/portal/portalStatementJobLinks'
import { setPortalMainOff, usePortalLinkOff } from '../../hooks/usePortalOffStates'
import { staffAwarePublicHeaders } from '../../lib/publicFunctionStaffHeaders'
import { withPreviewFlag } from '../../lib/publicViewCounting'
import { parseOfficeViewStats, portalOpenedLabel, type OfficeViewStats } from '../../lib/portal/portalOpenedLabel'
import type {
  MarkCustomerPortalSlugSharedResult,
  MintCustomerPortalLinkResult,
  SetCustomerPortalSlugResult,
} from '../../types/database-functions'

/**
 * 🌐 next to a customer's name (portal train PR 4; custom-links rework
 * v2.2009): office staff manage the customer's no-login merged portal. The
 * hero is the custom address (editable until first shared, then locked with
 * editing behind the gear) + Copy / Preview / live preview of the merged
 * statement. The gear is ONE FLAT label-per-row table: Direct link · Address
 * · Separate views (scoped GC-only / own-jobs-only links, on demand) · Reset
 * (Rotate / Turn off) · History (links + address events). A turned-off main
 * portal paints the globe red app-wide, and opening the modal never silently
 * re-mints a portal that was deliberately turned off — nor mints one for a
 * never-shared customer (journey-map #14(b) / J21-F7): that opens into a
 * "No portal link yet" state and the link is created only on "Create their
 * link". Self-contained (button + modal); renders nothing for non-office roles.
 */

type Audience = 'customer' | 'gc' | 'all'
type MainState =
  | { kind: 'loading' }
  | { kind: 'unminted' }
  | { kind: 'active'; token: string }
  | { kind: 'off' }
  | { kind: 'error'; message: string }
type ScopedLink = { token: string; createdAt: string }

const SHORT_PREFIX = PORTAL_SHORT_ORIGIN.replace(/^https:\/\//, '')

export default function CustomerPortalGlobeButton({
  customerId,
  customerName,
  size = 15,
}: {
  customerId: string
  customerName: string
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
  const [scoped, setScoped] = useState<Record<'customer' | 'gc', ScopedLink | null>>({ customer: null, gc: null })
  const [timeline, setTimeline] = useState<PortalTimelineEntry[]>([])
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const diceBase = useRef<{ base: string; out: string } | null>(null)
  const mainOff = usePortalLinkOff(customerId)
  const navigate = useNavigate()
  const [billRows, setBillRows] = useState<StatementBillRow[]>([])
  const [previewExpanded, setPreviewExpanded] = useState(false)
  // "Opened N times · last <date>" (journey-map #37): customer opens on record, returned by the
  // edge function only to a verified staff session. null = not available (old function build).
  const [viewStats, setViewStats] = useState<OfficeViewStats | null>(null)

  // Office-only Edit-Job chips under the live preview (v2.2054): the public
  // payload carries job NUMBERS only (no ids, by design), so match them to
  // the office's own jobs_ledger rows client-side. Failures just hide the
  // strip — it is a shortcut, never a load-bearing surface.
  const activeToken = main.kind === 'active' ? main.token : null
  useEffect(() => {
    if (!open || !activeToken) {
      setBillRows([])
      setViewStats(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        // `?preview=1` + the office session: this fetch is a staff peek, never a customer view
        // (journey-map #37 — it used to write one of the two "view" rows per modal open).
        const res = await fetch(
          withPreviewFlag(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/customer-portal?token=${encodeURIComponent(activeToken)}`),
          { headers: await staffAwarePublicHeaders() },
        )
        const body: unknown = await res.json().catch(() => null)
        if (cancelled || !res.ok) return
        setViewStats(parseOfficeViewStats(body))
        const payload = parsePortalPayload(body)
        if (!payload || payload.bills.length === 0) return
        const { data: jobRows } = await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number')
          .or(`customer_id.eq.${customerId},gc_customer_id.eq.${customerId}`)
        if (cancelled || !jobRows) return
        setBillRows(buildStatementBillRows(payload.bills, jobRows))
      } catch {
        // Preview strip only — stay silent.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, activeToken, customerId])

  const mint = useCallback(
    async (aud: Audience, rotate: boolean): Promise<string | null> => {
      const { data, error } = await supabase.rpc('mint_customer_portal_link' as never, {
        p_customer_id: customerId,
        p_audience: aud,
        p_rotate: rotate,
      } as never)
      if (error) throw error
      const res = data as unknown as MintCustomerPortalLinkResult
      if (res.error) throw new Error(res.error)
      return res.token ?? null
    },
    [customerId],
  )

  /**
   * Resolve everything WITHOUT writing: link rows are read first; an active
   * 'all' row supplies the token; a main-off verdict (kernel: 'all' rows all
   * revoked, or legacy-only rows all revoked) is the deliberate OFF state; a
   * never-minted customer opens into 'unminted' (the mint waits for "Create
   * their link"); only a customer whose legacy scoped link is still active
   * auto-mints — the merged link is that live link's continuation.
   */
  const loadState = useCallback(async () => {
    setMain({ kind: 'loading' })
    try {
      const [linksRes, slugRes, eventsRes] = await Promise.all([
        supabase
          .from('customer_portal_links')
          .select('customer_id, audience, token, created_at, revoked_at, created_by')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false }),
        supabase.from('customer_portal_slugs').select('slug, locked_at').eq('customer_id', customerId).maybeSingle(),
        supabase
          .from('customer_portal_slug_events')
          .select('event, slug, created_at, created_by')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(25),
      ])
      if (linksRes.error) throw linksRes.error
      const rows: Array<PortalLinkRow & { token: string | null }> = linksRes.data ?? []
      const slugEvents: PortalSlugEventRow[] = eventsRes.data ?? []
      setTimeline(buildPortalTimeline(rows, slugEvents))

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
      setSlugInput(slugRow?.slug ?? suggestSlugFromName(customerName))
      setAddrInput(slugRow?.slug ?? '')

      const activeFor = (aud: Audience) => rows.find((r) => r.audience === aud && r.revoked_at === null)
      const activeCustomer = activeFor('customer')
      const activeGc = activeFor('gc')
      setScoped({
        customer: activeCustomer?.token ? { token: activeCustomer.token, createdAt: activeCustomer.created_at } : null,
        gc: activeGc?.token ? { token: activeGc.token, createdAt: activeGc.created_at } : null,
      })

      const activeAll = activeFor('all')
      const verdict = portalGlobeInitialState(rows, customerId)
      if (verdict === 'active' && activeAll?.token) {
        setMain({ kind: 'active', token: activeAll.token })
        setPortalMainOff(customerId, false)
        return
      }
      if (verdict === 'off') {
        setMain({ kind: 'off' })
        setPortalMainOff(customerId, true)
        return
      }
      if (verdict === 'unminted') {
        setMain({ kind: 'unminted' })
        setPortalMainOff(customerId, false)
        return
      }
      // 'legacy-active': continue the live pre-merge link as the merged one.
      const token = await mint('all', false)
      if (!token) throw new Error('No link returned')
      setMain({ kind: 'active', token })
      setPortalMainOff(customerId, false)
      setTimeline((prev) => [
        { kind: 'link', at: new Date().toISOString(), createdBy: null, audience: 'all', outcome: 'active', revokedAt: null },
        ...prev,
      ])
    } catch (e) {
      setMain({ kind: 'error', message: formatErrorMessage(e, 'Could not load the portal link') })
    }
  }, [customerId, customerName, mint])

  const canManage = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  if (!canManage) return null

  const openModal = () => {
    setOpen(true)
    setGearOpen(false)
    diceBase.current = null
    void loadState()
  }

  const tokenUrl = main.kind === 'active' ? `${window.location.origin}/portal?t=${main.token}` : null
  // Office openers (Preview as customer, Full screen, the live iframe) carry `?preview=1` so the
  // load is not counted as the customer looking (journey-map #37). Copy never uses this URL.
  const previewUrl = tokenUrl ? withPreviewFlag(tokenUrl) : null
  const openedLine = portalOpenedLabel(viewStats)

  const saveSlug = async (value: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('set_customer_portal_slug' as never, {
      p_customer_id: customerId,
      p_slug: value,
    } as never)
    if (error) throw error
    const res = data as unknown as SetCustomerPortalSlugResult
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
        const { data, error } = await supabase.rpc('mark_customer_portal_slug_shared' as never, {
          p_customer_id: customerId,
        } as never)
        if (error) throw error
        const res = data as unknown as MarkCustomerPortalSlugSharedResult
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

  const createScoped = async (aud: 'customer' | 'gc') => {
    setBusy(true)
    try {
      await mint(aud, false)
      await loadState()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const revokeAudience = async (aud: Audience) => {
    const { data, error } = await supabase.rpc('revoke_customer_portal_link' as never, {
      p_customer_id: customerId,
      p_audience: aud,
    } as never)
    if (error) throw error
    const res = data as unknown as { revoked?: number; error?: string }
    if (res.error) throw new Error(res.error)
  }

  const turnOffScoped = async (aud: 'customer' | 'gc') => {
    const label = aud === 'gc' ? 'GC bills only' : 'their own jobs only'
    if (!(await confirmDialog({ message: `Turn off the "${label}" link? Anyone holding it loses access immediately.` }))) return
    setBusy(true)
    try {
      await revokeAudience(aud)
      showToast('Separate view turned off.', 'success')
      await loadState()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not turn off the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const rotate = async () => {
    if (!(await confirmDialog({ message: `Rotate ${customerName}'s portal link? The current link stops working immediately — the custom address follows to the new one.` }))) return
    setBusy(true)
    try {
      await mint('all', true)
      showToast('New link created — the old one no longer works.', 'success')
      await loadState()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not rotate the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (!(await confirmDialog({ message: `Turn off ${customerName}'s portal? Nobody can open their page — including separate views — until it's turned back on.` }))) return
    setBusy(true)
    try {
      await revokeAudience('all')
      if (scoped.customer) await revokeAudience('customer')
      if (scoped.gc) await revokeAudience('gc')
      showToast('Portal turned off.', 'success')
      setPortalMainOff(customerId, true)
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
      const token = await mint('all', false)
      if (!token) throw new Error('No link returned')
      showToast('Portal turned back on — this is a brand-new link.', 'success')
      setPortalMainOff(customerId, false)
      await loadState()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not turn the portal back on'), 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * The ONE place a never-shared customer's link comes into being (v2.2850):
   * an explicit click, a toast, and a telemetry row — never a side effect of
   * opening the modal.
   */
  const createLink = async () => {
    setBusy(true)
    try {
      const token = await mint('all', false)
      if (!token) throw new Error('No link returned')
      setMain({ kind: 'active', token })
      setPortalMainOff(customerId, false)
      setTimeline((prev) => [
        { kind: 'link', at: new Date().toISOString(), createdBy: user?.id ?? null, audience: 'all', outcome: 'active', revokedAt: null },
        ...prev,
      ])
      showToast('Portal link created.', 'success')
      recordNavClick(user?.id, role, 'portal_link_minted', '#customer-globe')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create the link'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  const who = (id: string | null) => (id ? creatorNames[id] : null)

  const timelineLine = (e: PortalTimelineEntry): string => {
    const by = who(e.createdBy)
    const byPart = by ? ` by ${by}` : ''
    if (e.kind === 'slug') {
      if (e.event === 'locked') return `Address locked (first shared) ${fmtWhen(e.at)}${byPart}`
      const verb = e.event === 'created' ? 'set to' : 'changed to'
      return `Address ${verb} "${e.slug ?? ''}" ${fmtWhen(e.at)}${byPart}`
    }
    const label =
      e.audience === 'all' ? 'Link' : e.audience === 'gc' ? 'Separate view (GC bills only)' : 'Separate view (their own jobs)'
    const made = `${label} created ${fmtWhen(e.at)}${byPart}`
    if (e.outcome === 'active') return `${made} — active now`
    if (e.outcome === 'rotated') return `${made} — rotated ${e.revokedAt ? fmtWhen(e.revokedAt) : ''}`
    return `${made} — turned off ${e.revokedAt ? fmtWhen(e.revokedAt) : ''}`
  }

  const secondaryBtn: React.CSSProperties = {
    padding: '0.35rem 0.7rem',
    fontSize: '0.8125rem',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'var(--text-700)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
  const primaryBtn: React.CSSProperties = { ...secondaryBtn, background: '#2563eb', color: 'white', border: 'none', fontWeight: 600 }
  const rowLabel: React.CSSProperties = {
    fontSize: '0.68rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    fontWeight: 600,
    paddingTop: '0.15rem',
    whiteSpace: 'nowrap',
  }
  const rowHint: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-faint)', margin: '0.3rem 0 0' }
  const monoBox: React.CSSProperties = {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.78rem',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '0.5rem 0.6rem',
  }

  const guess = slugInput.replace(/-+$/, '') ? slugGuessability(slugInput.replace(/-+$/, '')) : null

  // Expand grows the preview in place (v2.2064); Full screen opens a tab.
  const previewScale = previewExpanded ? 0.85 : 0.62
  const previewHeight = previewExpanded ? 560 : 300

  const gearRow = (label: string, body: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.7rem', padding: '0.6rem 0', borderTop: '1px solid var(--border)' }}>
      <span style={rowLabel}>{label}</span>
      <div style={{ minWidth: 0 }}>{body}</div>
    </div>
  )

  const scopedRow = (aud: 'customer' | 'gc') => {
    const link = scoped[aud]
    const label = aud === 'gc' ? 'GC bills only' : 'Their own jobs only'
    if (!link) {
      return (
        <button key={aud} type="button" onClick={() => void createScoped(aud)} disabled={busy} style={{ ...secondaryBtn, fontSize: '0.75rem' }}>
          {label}
        </button>
      )
    }
    const url = `${window.location.origin}/portal?t=${link.token}`
    return (
      <div key={aud} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ ...monoBox, padding: '0.25rem 0.45rem', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {`${url.slice(0, 34)}…${link.token.slice(-6)}`}
        </span>
        <button type="button" onClick={() => void copyText(url, 'Link')} style={{ ...secondaryBtn, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>
          Copy
        </button>
        <button type="button" onClick={() => void turnOffScoped(aud)} disabled={busy} style={{ ...secondaryBtn, padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--text-red-600)' }}>
          Turn off
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openModal()
        }}
        title={
          mainOff
            ? `Portal is turned off for ${customerName} — click to manage`
            : `Customer portal — copy or preview what ${customerName} sees`
        }
        aria-label={`Open ${customerName}'s customer portal link`}
        style={{
          padding: '0.15rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: mainOff ? 'var(--text-red-600)' : 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill="currentColor" aria-hidden>
          <path d="M415.9 344L225 344C227.9 408.5 242.2 467.9 262.5 511.4C273.9 535.9 286.2 553.2 297.6 563.8C308.8 574.3 316.5 576 320.5 576C324.5 576 332.2 574.3 343.4 563.8C354.8 553.2 367.1 535.8 378.5 511.4C398.8 467.9 413.1 408.5 416 344zM224.9 296L415.8 296C413 231.5 398.7 172.1 378.4 128.6C367 104.2 354.7 86.8 343.3 76.2C332.1 65.7 324.4 64 320.4 64C316.4 64 308.7 65.7 297.5 76.2C286.1 86.8 273.8 104.2 262.4 128.6C242.1 172.1 227.8 231.5 224.9 296zM176.9 296C180.4 210.4 202.5 130.9 234.8 78.7C142.7 111.3 74.9 195.2 65.5 296L176.9 296zM65.5 344C74.9 444.8 142.7 528.7 234.8 561.3C202.5 509.1 180.4 429.6 176.9 344L65.5 344zM463.9 344C460.4 429.6 438.3 509.1 406 561.3C498.1 528.6 565.9 444.8 575.3 344L463.9 344zM575.3 296C565.9 195.2 498.1 111.3 406 78.7C438.3 130.9 460.4 210.4 463.9 296L575.3 296z" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${customerName} portal link`}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem 1.4rem', borderRadius: 8, width: 'min(600px, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{customerName} — portal</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', padding: 4 }}>
                ×
              </button>
            </div>
            <p style={{ margin: '0.3rem 0 0.8rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Everything they owe in one statement, plus visit &amp; bid request forms. No login — the link is the key.
            </p>

            {main.kind === 'loading' ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.6rem 0' }} aria-busy>
                Fetching the link…
              </div>
            ) : main.kind === 'error' ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)', padding: '0.6rem 0' }}>{main.message}</div>
            ) : main.kind === 'off' ? (
              <div style={{ border: '1px solid var(--text-red-600)', borderRadius: 6, padding: '0.75rem 0.9rem', marginBottom: '0.8rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-red-600)' }}>This portal is turned off.</div>
                <p style={{ margin: '0.3rem 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {customerName} can't open their page — old links show "no longer active." Turning it back on makes a brand-new link.
                </p>
                <button type="button" onClick={() => void turnBackOn()} disabled={busy} style={primaryBtn}>
                  Turn portal back on
                </button>
              </div>
            ) : main.kind === 'unminted' ? (
              <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '0.75rem 0.9rem', marginBottom: '0.8rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-900)' }}>No portal link yet.</div>
                <p style={{ margin: '0.3rem 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {customerName} has never been given a portal page. Creating the link makes their page live — you decide when to share it. Just looking? Close this and nothing is created.
                </p>
                <button type="button" onClick={() => void createLink()} disabled={busy} style={primaryBtn}>
                  {busy ? 'Creating…' : 'Create their link'}
                </button>
              </div>
            ) : tokenUrl ? (
              <>
                {/* Hero: the custom address */}
                <div style={{ ...monoBox, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{SHORT_PREFIX}</span>
                  {slugLocked ? (
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slugSaved ?? slugInput}</span>
                  ) : (
                    <input
                      value={slugInput}
                      onChange={(e) => setSlugInput(normalizeSlugInput(e.target.value))}
                      aria-label="Portal address"
                      spellCheck={false}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: 'var(--text-900, inherit)',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 600,
                        borderBottom: '1px dashed var(--border)',
                        padding: 0,
                      }}
                    />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.3rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                    {slugLocked ? '' : 'Editable until first shared'}
                  </span>
                  {guess && (
                    <span style={{ fontSize: '0.72rem', color: guess === 'hard' ? 'var(--text-green-600, #16a34a)' : 'var(--text-amber-600, #d97706)' }}>
                      {guess === 'hard' ? '✓ hard to guess' : '⚠ easy to guess'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" onClick={() => void copyAddress()} disabled={busy} style={primaryBtn}>
                    Copy link
                  </button>
                  <button type="button" onClick={() => window.open(previewUrl ?? undefined, '_blank', 'noopener')} style={secondaryBtn}>
                    Preview as customer
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => setGearOpen((v) => !v)}
                    aria-pressed={gearOpen}
                    aria-label="Advanced settings"
                    title="Advanced — direct link, address, separate views, reset, history"
                    style={{ ...secondaryBtn, padding: '0.3rem 0.45rem', display: 'inline-flex', alignItems: 'center', background: gearOpen ? 'var(--bg-subtle)' : 'var(--surface)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={15} height={15} fill="currentColor" aria-hidden>
                      <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
                    </svg>
                  </button>
                </div>

                {gearOpen && (
                  <div style={{ marginTop: '0.9rem' }}>
                    {gearRow(
                      'Direct link',
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                          <span style={{ ...monoBox, padding: '0.25rem 0.45rem', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                            {`${tokenUrl.slice(0, 40)}…${main.token.slice(-6)}`}
                          </span>
                          <button type="button" onClick={() => void copyText(tokenUrl, 'Direct link')} style={{ ...secondaryBtn, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>
                            Copy
                          </button>
                        </div>
                        <p style={rowHint}>Always works, even while the address changes.</p>
                      </div>,
                    )}
                    {gearRow(
                      'Address',
                      slugLocked ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ ...monoBox, padding: '0.25rem 0.45rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
                              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{SHORT_PREFIX}</span>
                              <input
                                value={addrInput}
                                onChange={(e) => setAddrInput(normalizeSlugInput(e.target.value))}
                                aria-label="New portal address"
                                spellCheck={false}
                                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
                              />
                            </span>
                            <button type="button" onClick={() => rollDice(addrInput, setAddrInput)} title="Add a hard-to-guess tail" style={{ ...secondaryBtn, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>
                              🎲
                            </button>
                            <button type="button" onClick={() => void saveAddressChange()} disabled={busy || addrInput.replace(/-+$/, '') === slugSaved} style={{ ...secondaryBtn, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>
                              Save
                            </button>
                          </div>
                          <p style={rowHint}>Saving a new address makes the old one stop working — printed or texted copies go stale.</p>
                        </div>
                      ) : (
                        <div>
                          <button type="button" onClick={() => rollDice(slugInput, setSlugInput)} style={{ ...secondaryBtn, fontSize: '0.75rem' }}>
                            🎲 Random tail
                          </button>
                          <p style={rowHint}>🎲 adds a hard-to-guess tail to the address above.</p>
                        </div>
                      ),
                    )}
                    {gearRow(
                      'Separate views',
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                          {(['gc', 'customer'] as const).map((aud) => scopedRow(aud))}
                        </div>
                        <p style={rowHint}>Extra links showing part of the statement — only if their office asks for a split.</p>
                      </div>,
                    )}
                    {gearRow(
                      'Reset',
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => void rotate()} disabled={busy} style={secondaryBtn}>
                            Rotate
                          </button>
                          <button type="button" onClick={() => void turnOff()} disabled={busy} style={{ ...secondaryBtn, color: 'var(--text-red-600)' }}>
                            Turn off
                          </button>
                        </div>
                        <p style={rowHint}>Rotate = new link, old one dies. Turn off = no portal at all.</p>
                      </div>,
                    )}
                    {openedLine &&
                      gearRow(
                        'Opened',
                        <div>
                          <span style={{ fontSize: '0.8rem', color: viewStats && viewStats.opens > 0 ? 'var(--text-700)' : 'var(--text-muted)' }}>{openedLine}</span>
                          <p style={rowHint}>Customer opens of this portal. Your previews and staff opens don't count.</p>
                        </div>,
                      )}
                    {timeline.length > 0 &&
                      gearRow(
                        'History',
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {timeline.map((e, i) => (
                            <li key={i} style={{ fontSize: '0.75rem', color: e.kind === 'link' && e.outcome === 'active' ? 'var(--text-700)' : 'var(--text-muted)' }}>
                              {timelineLine(e)}
                            </li>
                          ))}
                        </ul>,
                      )}
                  </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                      Live preview — what this link opens
                    </span>
                    <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => setPreviewExpanded((v) => !v)}
                        aria-pressed={previewExpanded}
                        title={previewExpanded ? 'Shrink the preview' : 'Grow the preview inside this modal'}
                        style={{ ...secondaryBtn, padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
                      >
                        {previewExpanded ? '⤡ Shrink' : '⤢ Expand'}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(previewUrl ?? undefined, '_blank', 'noopener')}
                        title="Open the portal page full screen in a new tab"
                        style={{ ...secondaryBtn, padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
                      >
                        Full screen ↗
                      </button>
                    </span>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', height: previewHeight, background: '#f6f3ec' }}>
                    <iframe
                      src={previewUrl ?? undefined}
                      title={`Portal preview — ${customerName}`}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                      style={{
                        width: `${100 / previewScale}%`,
                        height: previewHeight / previewScale,
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                        border: 'none',
                        display: 'block',
                        background: '#f6f3ec',
                      }}
                    />
                  </div>
                </div>

                {billRows.length > 0 && (
                  <div style={{ marginTop: '0.6rem', border: '1px dashed var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem 0.15rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
                        Jobs on this statement
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                        only you see this — not on their page
                      </span>
                    </div>
                    {/* One row per statement bill, same order — the strip is the statement's mirror (v2.2064). */}
                    {billRows.map((l, i) => (
                      <div
                        key={`${l.jobId}-${i}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.32rem 0.1rem', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: '0.75rem' }}
                      >
                        <span style={{ color: 'var(--text-faint)', width: 46, flex: 'none' }}>
                          {formatPortalDate(l.billedOn)?.replace(/, \d{4}$/, '') ?? '—'}
                        </span>
                        {l.serviceTag && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em', color: PORTAL_TRADE_COLORS[l.serviceTag as PortalTradeTag] ?? 'var(--text-faint)' }}>
                            {l.serviceTag.toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontWeight: 700 }}>{l.jobNumber}</span>
                        <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatPortalUsd(l.amount)}</span>
                        <span style={{ flex: 1 }} />
                        {l.payUrl ? (
                          <a
                            href={l.payUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open this bill's Stripe pay page"
                            style={{ color: '#635bff', fontWeight: 700, fontSize: '0.72rem', textDecoration: 'none' }}
                          >
                            Pay ↗
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem', fontStyle: 'italic' }}>no pay link</span>
                        )}
                        <button
                          type="button"
                          title={`Open Job ${l.jobNumber} in Edit Job`}
                          onClick={() => {
                            setOpen(false)
                            navigate(`/jobs?tab=stages&edit=${encodeURIComponent(l.jobId)}`)
                          }}
                          style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, padding: '0.18rem 0.55rem', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-link)', fontWeight: 700 }}
                        >
                          Edit ↗
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
