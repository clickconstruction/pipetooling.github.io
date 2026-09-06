/**
 * The Bid Room staff panel (Signable Bids Phase 1, v2.2468). Lives beside "Mark sent" on the
 * Cover Letter's per-GC studio: publish the current letter into the GC's durable room link,
 * copy/open/send that link, attach the Google Docs letter, and read the room's state at a glance.
 * The room link is permanent (owner decision 8) — revisions are explicit publishes (decision
 * 6), never re-sends.
 *
 * Journey-map Tier-2 #31: the link comes first. "Get the link" mints the room without emailing
 * anyone; Copy link / Open work from that moment; "Send to GC" is the optional second action.
 * Which buttons render is `bidRoomPanelActions` (pure, tested).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  buildBidRoomRevisionPayload,
  newBidRoomToken,
  type RoomSectionInput,
} from '../../lib/bids/bidRoomPayload'
import { extractContactFromCustomer } from '../../lib/customerContactDisplay'
import { roomGcKey, roomStateChipLabel, type BidRoomStateSummary } from '../../lib/bids/bidRoomState'
import { fetchBidRoomStates } from '../../lib/bids/fetchBidRoomStates'
import { BidRoomStateChip } from './BidRoomStateChip'
import { Link } from 'react-router-dom'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { bidRoomPanelActions, looksLikeEmail } from '../../lib/bids/bidRoomPanelActions'
import { withPreviewFlag } from '../../lib/publicViewCounting'
import { recordNavClick } from '../../lib/navClickTelemetry'
import type { Tables } from '../../types/database'

type RoomRow = Tables<'bid_proposal_rooms'>

export type BidRoomPanelProps = {
  bidId: string
  /** Null = the bid's own GC (gcPackets semantics). */
  gcCustomerId: string | null
  gcName: string
  projectName: string
  projectAddress: string
  serviceTypeName: string
  sections: RoomSectionInput[]
  inclusions: string
  exclusions: string
  terms: string
  /** The customers.id whose CRM email prefills the send box (owner decision 4); editable per send. */
  crmCustomerId: string | null
  /** Called after the FIRST link send from the app so the tab stamps bid_version_sends (same as Mark sent). Getting the link alone never fires it. */
  onFirstLinkSent: () => void
  /**
   * vv2.2716: controlled mode. When the parent passes `onRoomPresence`, the panel hides itself while
   * the GC has no room and the controls are closed — the parent shows `BidRoomSetupButton` beside
   * Mark sent instead, and opens the panel through `open` / `onOpenChange`.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onRoomPresence?: (hasRoom: boolean) => void
}

/** The solid "Setup bid room" button the Cover Letter shows beside Mark sent while a GC has no room yet (vv2.2716). */
export function BidRoomSetupButton(props: { onClick: () => void; gcShort?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={btn('blue')}
      title={`Open a durable, signable link for ${props.gcShort ?? 'this GC'} — the letter, always current`}
    >
      ✍ Setup bid room
    </button>
  )
}

function roomLink(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/bid-room?t=${encodeURIComponent(token)}`
}

const btn = (kind: 'blue' | 'ghost'): React.CSSProperties => ({
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '0.3rem 0.7rem',
  borderRadius: 5,
  border: kind === 'ghost' ? '1px solid var(--border-strong)' : 'none',
  background: kind === 'blue' ? '#3b82f6' : 'var(--surface)',
  color: kind === 'blue' ? '#fff' : 'var(--text-700)',
  cursor: 'pointer',
})

export function BidRoomPanel(props: BidRoomPanelProps) {
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [room, setRoom] = useState<RoomRow | null>(null)
  const [latestRev, setLatestRev] = useState<{ rev_number: number; published_at: string } | null>(null)
  const [state, setState] = useState<BidRoomStateSummary | null>(null)
  const [everSent, setEverSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openLocal, setOpenLocal] = useState(false)
  const open = props.open ?? openLocal
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const v = typeof next === 'function' ? next(open) : next
    setOpenLocal(v)
    props.onOpenChange?.(v)
  }
  // Presence goes through a ref so the parent's callback identity never re-triggers `load`.
  const presenceRef = useRef(props.onRoomPresence)
  presenceRef.current = props.onRoomPresence
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')
  const [attachUrl, setAttachUrl] = useState('')

  const load = useCallback(async () => {
    let q = supabase.from('bid_proposal_rooms').select('*').eq('bid_id', props.bidId).is('closed_at', null)
    q = props.gcCustomerId ? q.eq('customer_id', props.gcCustomerId) : q.is('customer_id', null)
    const { data } = await q.maybeSingle()
    const r = (data as RoomRow | null) ?? null
    setRoom(r)
    presenceRef.current?.(r != null)
    const crmEmail = async () => {
      if (!props.crmCustomerId) return ''
      const { data: c } = await supabase.from('customers').select('contact_info').eq('id', props.crmCustomerId).maybeSingle()
      return c ? extractContactFromCustomer(c as { contact_info: string | null }).email.trim() : ''
    }
    if (!r) {
      setLatestRev(null)
      setState(null)
      setEverSent(false)
      const em = await crmEmail()
      if (em) setEmail((prev) => prev || em)
      return
    }
    const em = r.recipient_email || (await crmEmail())
    if (em) setEmail((prev) => prev || em)
    setAttachUrl(r.attachment_url ?? '')
    const [{ data: revs }, states] = await Promise.all([
      supabase
        .from('bid_proposal_room_revisions')
        .select('rev_number, published_at')
        .eq('room_id', r.id)
        .order('rev_number', { ascending: false })
        .limit(1),
      fetchBidRoomStates(props.bidId),
    ])
    setLatestRev((revs?.[0] as { rev_number: number; published_at: string } | undefined) ?? null)
    const st = states[roomGcKey(props.gcCustomerId)] ?? null
    setState(st)
    setEverSent(st?.everSent ?? false)
  }, [props.bidId, props.gcCustomerId, props.crmCustomerId])

  useEffect(() => {
    void load()
  }, [load])

  async function resolveMaster(): Promise<string | null> {
    if (!user) return null
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (me as { role?: string } | null)?.role
    if (role === 'dev' || role === 'master_technician') return user.id
    const { data: link } = await supabase.from('master_assistants').select('master_id').eq('assistant_id', user.id).maybeSingle()
    return (link as { master_id?: string } | null)?.master_id ?? user.id
  }

  /**
   * Publish the current letter into the room (creating the room on first publish). Never emails.
   * `viaSend` only labels the mint telemetry: `bid_room_published` `#sent_by_app:1|0` — did the
   * room start life through "Send to GC" or through "Get the link"?
   */
  async function publish(opts: { viaSend?: boolean } = {}): Promise<RoomRow | null> {
    const payload = buildBidRoomRevisionPayload({
      projectName: props.projectName,
      projectAddress: props.projectAddress,
      gcName: props.gcName,
      serviceTypeName: props.serviceTypeName,
      sections: props.sections,
      inclusions: props.inclusions,
      exclusions: props.exclusions,
      terms: props.terms,
    })
    if (!payload) {
      showToast('Nothing to publish until this GC has a priced base — same rule as the letter.', 'error')
      return null
    }
    setBusy(true)
    try {
      let r = room
      if (!r) {
        const masterId = await resolveMaster()
        if (!masterId) {
          showToast('Not signed in', 'error')
          return null
        }
        const { data, error } = await supabase
          .from('bid_proposal_rooms')
          .insert({
            bid_id: props.bidId,
            customer_id: props.gcCustomerId,
            public_token: newBidRoomToken(),
            master_user_id: masterId,
            created_by: user?.id ?? null,
            attachment_url: attachUrl.trim() || null,
          })
          .select('*')
          .single()
        if (error) {
          showToast(formatErrorMessage(error, 'Could not create the room'), 'error')
          return null
        }
        r = data as RoomRow
        setRoom(r)
        recordNavClick(user?.id, role, 'bid_room_published', `#sent_by_app:${opts.viaSend ? 1 : 0}`)
      } else if ((r.attachment_url ?? '') !== (attachUrl.trim() || null ? attachUrl.trim() : null)) {
        await supabase.from('bid_proposal_rooms').update({ attachment_url: attachUrl.trim() || null }).eq('id', r.id)
      }
      const nextRev = (latestRev?.rev_number ?? 0) + 1
      const { error: revErr } = await supabase.from('bid_proposal_room_revisions').insert({
        room_id: r.id,
        rev_number: nextRev,
        note: note.trim(),
        payload,
        published_by: user?.id ?? null,
      })
      if (revErr) {
        showToast(formatErrorMessage(revErr, 'Could not publish'), 'error')
        return null
      }
      setNote('')
      window.dispatchEvent(new Event('bid-room-changed'))
      await load()
      showToast(`Published rev ${nextRev} to ${props.gcName}'s room.`, 'success')
      return r
    } finally {
      setBusy(false)
    }
  }

  /** The primary first action: mint the room + rev 1, hand back the link — no email goes out. */
  async function getLink() {
    const r = await publish()
    if (!r) return
    try {
      await navigator.clipboard.writeText(roomLink(r.public_token))
      showToast('Room link copied — paste it into your own email to the GC, or press Send to GC.', 'success')
    } catch {
      /* the link row below shows it; Copy link is one press away */
    }
  }

  /**
   * Email the room link from the app. Publishes rev 1 first when no revision exists yet; otherwise
   * sends the current link as-is (publishing is its own button). The FIRST send stamps the packet
   * sent (`onFirstLinkSent`) — whichever path minted the room.
   */
  async function send() {
    const to = email.trim()
    if (!looksLikeEmail(to)) {
      showToast('Enter the GC contact email to send the link to.', 'error')
      return
    }
    let r = room
    if (!r || !latestRev) {
      r = await publish({ viaSend: true })
      if (!r) return
    }
    setBusy(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-bid-room-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ room_id: r.id, email: to, public_origin: window.location.origin }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; emailed?: boolean }
      if (!res.ok || !json.ok) {
        showToast(json.error || 'Could not send the room link.', 'error')
        return
      }
      const firstSend = !everSent
      window.dispatchEvent(new Event('bid-room-changed'))
      await load()
      showToast(json.emailed === false ? 'Link ready (email not configured) — copy it from the panel.' : `Room link emailed to ${to}.`, 'success')
      if (firstSend) props.onFirstLinkSent()
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!room) return
    try {
      await navigator.clipboard.writeText(roomLink(room.public_token))
      showToast('Room link copied.', 'success')
    } catch {
      showToast(roomLink(room.public_token), 'info')
    }
  }

  async function closeRoom() {
    if (!room) return
    if (
      !(await confirmDialog({
        message: `Close ${props.gcName}'s room? Their link will show "this proposal has been withdrawn."`,
        confirmLabel: 'Close room',
        danger: true,
      }))
    )
      return
    await supabase.from('bid_proposal_rooms').update({ closed_at: new Date().toISOString() }).eq('id', room.id)
    window.dispatchEvent(new Event('bid-room-changed'))
    setRoom(null)
    await load()
    showToast('Room closed — the link is dead until you publish a new room.', 'success')
  }

  const answered = state?.outcome != null
  const chipLabel = roomStateChipLabel(state)
  const actions = bidRoomPanelActions({
    hasRoom: room != null,
    published: room != null && latestRev != null,
    everSent,
    hasEmail: looksLikeEmail(email),
    answered,
  })
  const link = room ? roomLink(room.public_token) : ''

  // Controlled mode: no room and nothing open → the parent's Setup button is the whole UI.
  if (props.onRoomPresence && !room && !open) return null

  return (
    <div style={{ marginTop: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.5rem 0.65rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          ✍ Bid room
        </span>
        {chipLabel ? (
          <BidRoomStateChip state={state} />
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            one durable link for {props.gcName} — the letter, signable, always current
          </span>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...btn('ghost'), marginLeft: 'auto' }}>
          {open ? 'Close' : room ? 'Manage' : 'Set up'}
        </button>
      </div>
      {open ? (
        <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.55rem' }}>
          {answered ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>
              {state?.outcome === 'signed' ? (
                <>
                  Signed{state.outcomeMeta.printed_name ? ` by ${state.outcomeMeta.printed_name}` : ''}
                  {state.outcomeMeta.option_name ? ` — “${state.outcomeMeta.option_name}”` : ''}.{' '}
                  {typeof state.outcomeMeta.estimate_number === 'number' ? (
                    <Link to={`/estimates/${state.outcomeMeta.estimate_number}`} style={{ fontWeight: 600 }}>
                      View the signed record →
                    </Link>
                  ) : null}
                </>
              ) : (
                <>Declined — the reason is on the packet (Why we lost). The room stays viewable for the GC.</>
              )}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {actions.primary ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void (actions.primary?.id === 'get_link' ? getLink() : publish())}
                style={btn('blue')}
                title={actions.primary.title}
              >
                {busy ? 'Working…' : actions.primary.id === 'get_link' ? `✍ ${actions.primary.label}` : actions.primary.label}
              </button>
            ) : null}
            {actions.showLink ? (
              <>
                <button type="button" onClick={() => void copyLink()} style={btn('ghost')} title="Copy the GC's link — the same one Send to GC emails">
                  Copy link
                </button>
                <a
                  href={withPreviewFlag(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...btn('ghost'), textDecoration: 'none', display: 'inline-block' }}
                  title="Open the GC's page in a new tab — your own opens don't count as the GC looking"
                >
                  Open ↗
                </a>
              </>
            ) : null}
            {actions.closeRoom ? (
              <button type="button" disabled={busy} onClick={() => void closeRoom()} style={{ ...btn('ghost'), color: 'var(--text-red-700)' }} title="Withdraw — the link shows a polite closed page until a new room is published">
                Close room
              </button>
            ) : null}
          </div>
          {actions.showLink ? (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 0 }}>
              <span style={{ flex: 'none' }}>Link</span>
              <code data-testid="bid-room-link" style={{ font: 'inherit', color: 'var(--text-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all' }}>
                {link}
              </code>
            </div>
          ) : null}
          {actions.send ? (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="GC contact email"
                aria-label="GC contact email"
                style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-strong)', width: '15rem' }}
              />
              <button type="button" disabled={busy || !actions.send.enabled} onClick={() => void send()} style={{ ...btn('ghost'), opacity: actions.send.enabled ? 1 : 0.6, cursor: actions.send.enabled ? 'pointer' : 'not-allowed' }} title={actions.send.title}>
                {actions.send.label}
              </button>
            </div>
          ) : null}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Revision note the GC sees — "per addendum 2"…'
            aria-label="Revision note"
            style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          <input
            type="url"
            value={attachUrl}
            onChange={(e) => setAttachUrl(e.target.value)}
            placeholder="Google Docs letter link (optional — rides along in the room)"
            aria-label="Google Docs letter link"
            style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {actions.showLink
              ? 'Publishing pins the letter as the room’s next revision — the GC’s link never changes. Nothing is emailed unless you press Send.'
              : 'Get the link mints the room and pins the letter as rev 1 — paste it into your own email, or Send to GC from here.'}{' '}
            The first send from here also stamps this packet sent, like Mark sent today.
          </div>
        </div>
      ) : null}
    </div>
  )
}
