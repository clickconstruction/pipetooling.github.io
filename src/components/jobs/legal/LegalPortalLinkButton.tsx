import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { readEdgeFunctionErrorBody } from '../../../lib/readEdgeFunctionErrorBody'
import { LEGAL_FIRM_LINK_KIND, legalFirmLinkAddresses, legalFirmLinkSentLine, type LegalFirmLinkSentRow } from '../../../lib/legal/legalFirmLink'
import { rotateLinkMessage, turnOffLinkMessage } from '../../../lib/legal/legalPortalLinkWords'
import {
  groupLegalPortalLinks,
  legalLinkAddress,
  legalLinkIsOldShape,
  legalLinkName,
  legalLinkPastLine,
  legalLinkSinceLine,
  legalLinksSummary,
  parseLegalPortalLinks,
  type LegalPortalLinkRow,
} from '../../../lib/legal/legalPortalLinks'
import { isLegalPortalSlugKey, LEGAL_PORTAL_SHORT_ORIGIN, legalPortalAddressWords } from '../../../lib/legal/legalPortalAddress'
import { cleanBase, composeLegalAddress, legalAddressBase, legalAddressProblem, rollLegalTail, splitLegalAddress } from '../../../lib/legal/legalPortalAddressDraft'

const db = supabase as unknown as SupabaseClient

/**
 * The firm's links (Legal portal PR 3; v2.4750 the owner's rework), on the Legal desk header.
 * A firm holds its own link — the one every email carries — and any number of links for the
 * people at the firm, each turned off alone. Every link the firm ever had is listed from one
 * read of `list_legal_portal_links`: live ones with their address, read back from Vault on
 * the server (the table keeps only the hash, punch list #85 item 22), dead ones with when,
 * why and by whom. A new key reads like a GC's address, my.clickplumbing.com/<firm>-<tail>.
 *
 * Per live link: Copy · Send… · Change address… · Rotate · Turn off. Preview is the office's, by
 * the firm's id, signed in. Never mints on open: "No link yet" until the office creates it.
 *
 * v2.4756 (the owner's call): the address is short and custom — the office types the name part and
 * rolls a three-character tail, my.clickplumbing.com/snell-law-f6a (`legalPortalAddressDraft.ts`);
 * the server checks the shape and that no customer or sub holds it. Rotate keeps the name part
 * and rolls the tail; Change address… is a rotate to the address typed.
 *
 * v2.4624 (punch list #85 item 21): **Send … their link** — the welcome email
 * (`legal-send-firm-link`) to the firm's address on file and/or typed ones, filed in
 * `sent_documents` under the link it carried, where *Sent to … on …* reads back from.
 */
type ListState = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'ready'; rows: LegalPortalLinkRow[] }
type Draft = { base: string; tail: string }

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 0.55rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.74rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }
const dark: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const field: CSSProperties = { font: 'inherit', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const head: CSSProperties = { fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const muted: CSSProperties = { fontSize: '0.76rem', color: 'var(--text-muted)' }
const SHORT_HOST = LEGAL_PORTAL_SHORT_ORIGIN.replace(/^https:\/\//, '')

/** The address editor: the short host, the name part the office types, the three-character tail and its dice. */
function AddressEditor({ draft, onChange, disabled, label }: { draft: Draft; onChange: (d: Draft) => void; disabled: boolean; label: string }) {
  const address = composeLegalAddress(draft.base, draft.tail)
  const problem = legalAddressProblem(address)
  return (
    <div data-legal-address-editor style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>{SHORT_HOST}</span>
        <input aria-label={label} value={draft.base} onChange={(e) => onChange({ ...draft, base: cleanBase(e.target.value) })} disabled={disabled} spellCheck={false} style={{ ...field, width: 'auto', flex: '1 1 10ch', minWidth: '8ch', fontFamily: 'inherit', fontSize: 'inherit', padding: '4px 6px' }} />
        <span>-{draft.tail}</span>
        <button type="button" onClick={() => onChange({ ...draft, tail: rollLegalTail() })} disabled={disabled} title="Roll the three characters again" aria-label="Roll the tail again" style={{ ...btn, height: 24, padding: '0 0.4rem' }}>🎲</button>
      </div>
      {problem ? <div style={{ fontSize: '0.74rem', color: '#b42318' }}>{problem}</div> : null}
    </div>
  )
}

export default function LegalPortalLinkButton({ firmId, firmName }: { firmId: string; firmName: string }) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<ListState>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [onFile, setOnFile] = useState('')
  const [useOnFile, setUseOnFile] = useState(true)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const [newLabel, setNewLabel] = useState('')
  /** The address for the firm's own link, when it is about to be created; for a person's link; and the one being changed. */
  const [firmDraft, setFirmDraft] = useState<Draft>({ base: '', tail: '' })
  const [personDraft, setPersonDraft] = useState<Draft>({ base: '', tail: '' })
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null)
  /** Which live link the send form sends; the firm's own by default. */
  const [sendTarget, setSendTarget] = useState<string | null>(null)
  const [sentLines, setSentLines] = useState<Record<string, string>>({})
  const [sendError, setSendError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setList({ kind: 'loading' })
    // The firm's address on file (Settings → Collections law firm), offered as a ticked box.
    void db.from('legal_firms').select('email').eq('id', firmId).maybeSingle().then(({ data: f }) => setOnFile(String((f as { email?: string | null } | null)?.email ?? '').trim()))
    const { data, error } = await db.rpc('list_legal_portal_links', { p_firm_id: firmId })
    const rows = error ? null : parseLegalPortalLinks(data)
    if (!rows) {
      setList({ kind: 'unavailable' })
      return
    }
    setList({ kind: 'ready', rows })
    setFirmDraft({ base: legalAddressBase(firmName), tail: rollLegalTail() })
    setPersonDraft({ base: legalAddressBase(firmName), tail: rollLegalTail() })
    setEditing(null)
    const view = groupLegalPortalLinks(rows)
    const live = [view.firm, ...view.people].filter((r): r is LegalPortalLinkRow => Boolean(r))
    setSendTarget((cur) => (cur && live.some((r) => r.id === cur) ? cur : (live[0]?.id ?? null)))
    if (!live.length) {
      setSentLines({})
      return
    }
    // Each link's welcome email, from its filed copy (fail-soft: no line when it cannot be read).
    const sent = await db.from('sent_documents').select('source_id, recipient_emails, sent_at, sent_by_name').eq('kind', LEGAL_FIRM_LINK_KIND).eq('source_table', 'legal_portal_links').in('source_id', live.map((r) => r.id))
    const lines: Record<string, string> = {}
    if (!sent.error) {
      for (const r of live) {
        const mine = ((sent.data ?? []) as Array<LegalFirmLinkSentRow & { source_id?: string }>).filter((d) => d.source_id === r.id)
        const line = legalFirmLinkSentLine(mine, calendarYmdInAppTzFromIso)
        if (line) lines[r.id] = line
      }
    }
    setSentLines(lines)
  }, [firmId, firmName])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const view = list.kind === 'ready' ? groupLegalPortalLinks(list.rows) : null
  const live = view ? [view.firm, ...view.people].filter((r): r is LegalPortalLinkRow => Boolean(r)) : []
  const target = live.find((r) => r.id === sendTarget) ?? null
  const origin = window.location.origin
  const previewUrl = `${origin}/legal?firm=${encodeURIComponent(firmId)}&preview=1`

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } finally {
      setBusy(false)
    }
  }
  const rpcError = (data: unknown, error: { message: string } | null): string | null => error?.message ?? ((data as { error?: string } | null)?.error ?? null)

  const create = (label: string | null, draft: Draft) =>
    run(async () => {
      const address = composeLegalAddress(draft.base, draft.tail)
      const { data, error } = await db.rpc('create_legal_portal_link', { p_firm_id: firmId, p_label: label, p_address: address })
      const bad = rpcError(data, error)
      if (bad) {
        showToast(`Could not create the link: ${bad}`, 'error')
        return
      }
      setNewLabel('')
      await load()
      showToast(label ? `${label}’s link is ready. Copy it or send it from the list.` : 'The firm’s link is ready. Copy it or send it below.', 'success')
    })

  /** The address a plain Rotate mints: the same name part with a fresh tail; a key made before v2.4756 gets a default one. */
  const rolledAddress = (row: LegalPortalLinkRow): string | null => {
    if (!row.token || !isLegalPortalSlugKey(row.token)) return null
    const { base, tail } = splitLegalAddress(row.token)
    return tail ? composeLegalAddress(base, rollLegalTail()) : null
  }

  const rotate = async (row: LegalPortalLinkRow, address: string | null = rolledAddress(row)) => {
    const firmOwn = row.purpose === 'firm'
    const holder = firmOwn ? firmName : legalLinkName(row, firmName)
    const ok = await confirmDialog({ title: `Mint a new link for ${holder}?`, message: rotateLinkMessage(holder, firmOwn), confirmLabel: 'Mint a new link', danger: true })
    if (!ok) return
    await run(async () => {
      const { data, error } = await db.rpc('rotate_legal_portal_link', { p_link_id: row.id, p_address: address })
      const bad = rpcError(data, error)
      if (bad) {
        showToast(`Could not rotate it: ${bad}`, 'error')
        return
      }
      await load()
      showToast(`New link minted. The old one no longer opens, so send ${holder} the new one.`, 'success')
    })
  }

  const turnOff = async (row: LegalPortalLinkRow) => {
    const firmOwn = row.purpose === 'firm'
    const holder = firmOwn ? firmName : legalLinkName(row, firmName)
    const ok = await confirmDialog({ title: firmOwn ? 'Turn the firm’s portal off?' : `Turn ${holder}’s link off?`, message: turnOffLinkMessage(holder, firmOwn), confirmLabel: 'Turn off', danger: true })
    if (!ok) return
    await run(async () => {
      const { data, error } = await db.rpc('revoke_legal_portal_link_by_id', { p_link_id: row.id })
      const bad = rpcError(data, error)
      if (bad) {
        showToast(`Could not turn it off: ${bad}`, 'error')
        return
      }
      await load()
      showToast(firmOwn ? 'The firm’s portal is off.' : `${holder}’s link is off.`, 'info')
    })
  }

  const copy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      showToast('Link copied — send it however you like.', 'success')
    } catch {
      showToast('Could not copy; select the link and copy it by hand.', 'error')
    }
  }

  const pickSendTarget = (row: LegalPortalLinkRow) => {
    setSendTarget(row.id)
    setUseOnFile(row.purpose === 'firm')
    setSendError(null)
    document.querySelector('[data-legal-send-link]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const addresses = legalFirmLinkAddresses({ onFile, useOnFile, typed })
  const send = async () => {
    if (!target) return
    if (addresses.error) {
      setSendError(addresses.error)
      return
    }
    setSendError(null)
    await run(async () => {
      const { data, error } = await supabase.functions.invoke('legal-send-firm-link', { body: { firmId, linkId: target.id, useOnFile, typed, note, ...(target.token ? { token: target.token } : {}) } })
      const res = (data ?? {}) as { ok?: boolean; error?: string; sentTo?: string[] }
      if (error || !res.ok) {
        setSendError((error ? await readEdgeFunctionErrorBody(error) : null) ?? res.error ?? 'The email did not go. Try again in a minute.')
        return
      }
      setTyped('')
      setNote('')
      showToast(`Sent to ${(res.sentTo ?? addresses.emails).join(', ')}.`, 'success')
      await load()
    })
  }

  /** The editor's start for a live link: its own name part with a fresh tail, or the firm's default when the key is an old shape. */
  const startDraft = (row: LegalPortalLinkRow): Draft => {
    const { base, tail } = row.token && isLegalPortalSlugKey(row.token) ? splitLegalAddress(row.token) : { base: '', tail: '' }
    return { base: tail ? base : legalAddressBase(firmName), tail: rollLegalTail() }
  }

  const linkRow = (row: LegalPortalLinkRow) => {
    const address = legalLinkAddress(row, origin)
    const name = legalLinkName(row, firmName)
    const sent = sentLines[row.id] ?? null
    return (
      <div key={row.id} data-legal-link-row={row.purpose} style={{ display: 'grid', gap: 5, padding: '8px 0', borderTop: row.purpose === 'person' ? '1px solid var(--border)' : undefined }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{name}</span>
          {row.purpose === 'firm' ? <span style={muted}>in every email the firm gets</span> : null}
        </div>
        {address ? (
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px', wordBreak: 'break-all' }}>{legalPortalAddressWords(origin, row.token!)}</div>
        ) : (
          <div data-legal-link-hidden style={{ ...muted, background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 8px' }}>The link is live, but its address cannot be read back. Rotate for a new one.</div>
        )}
        {legalLinkIsOldShape(row) ? <div style={muted}>Made before addresses were short. Rotate, or press Change address… to pick one.</div> : null}
        <div style={{ ...muted, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{legalLinkSinceLine(row, calendarYmdInAppTzFromIso)}</span>
          {sent ? <span data-legal-link-sent style={{ color: '#067647' }}>✓ {sent}</span> : <span>not sent from here yet</span>}
        </div>
        {editing?.id === row.id ? (
          <div data-legal-change-address style={{ display: 'grid', gap: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 5 }}>
            <AddressEditor draft={editing.draft} onChange={(draft) => setEditing({ id: row.id, draft })} disabled={busy} label="New address" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void rotate(row, composeLegalAddress(editing.draft.base, editing.draft.tail))} disabled={busy || Boolean(legalAddressProblem(composeLegalAddress(editing.draft.base, editing.draft.tail)))} style={dark}>Save the new address</button>
              <button type="button" onClick={() => setEditing(null)} disabled={busy} style={btn}>Cancel</button>
              <span style={muted}>The old address stops working the moment this one is saved.</span>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {address ? <button type="button" onClick={() => void copy(address)} style={dark}>Copy</button> : null}
          <button type="button" onClick={() => pickSendTarget(row)} disabled={busy} style={btn}>Send…</button>
          <button type="button" onClick={() => setEditing(editing?.id === row.id ? null : { id: row.id, draft: startDraft(row) })} disabled={busy} style={btn}>Change address…</button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => void rotate(row)} disabled={busy} style={btn} title="The same name, three new characters">Rotate</button>
          <button type="button" onClick={() => void turnOff(row)} disabled={busy} style={{ ...btn, color: '#b42318', borderColor: '#b42318' }}>Turn off</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={btn} title="The firm’s no-login portal links">🌐 Firm’s link</button>
      {open ? (
        <div role="presentation" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 775, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
          <div role="dialog" aria-modal="true" aria-label="The firm’s portal links" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 600, width: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>🌐 {firmName}’s portal links</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 10px' }}>Private links, no sign-in. Each one opens every account a dev has marked attorney-ready and nothing else. Turn a link off and it stops that minute. Rotate gives it a new address and kills the old one.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: '0.84rem' }}>{list.kind === 'loading' ? 'Loading…' : list.kind === 'unavailable' ? 'The links list needs a database update that is not live yet. Ask a dev.' : legalLinksSummary(view!)}</span>
              <span style={{ flex: 1 }} />
              <a href={previewUrl} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }} title="What the firm sees, without counting as their visit">Preview ↗</a>
            </div>

            {view ? (
              <>
                <section data-legal-links-firm style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={head}>The firm’s own link</div>
                  {view.firm ? (
                    linkRow(view.firm)
                  ) : (
                    <div style={{ display: 'grid', gap: 8, padding: '8px 0' }}>
                      <span style={{ fontSize: '0.84rem' }}>{view.past.some((r) => r.purpose === 'firm') ? 'The firm’s link is off.' : 'No link yet.'} Pick its address, then create it.</span>
                      <AddressEditor draft={firmDraft} onChange={setFirmDraft} disabled={busy} label="The firm’s address" />
                      <div><button type="button" onClick={() => void create(null, firmDraft)} disabled={busy || Boolean(legalAddressProblem(composeLegalAddress(firmDraft.base, firmDraft.tail)))} style={dark}>Create the firm’s link</button></div>
                    </div>
                  )}
                </section>

                <section data-legal-links-people style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={head}>One person’s link</div>
                  <div style={{ ...muted, margin: '4px 0 2px' }}>A link for one person at the firm, so that person can be turned off without touching the firm’s own link.</div>
                  {view.people.map(linkRow)}
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    <input aria-label="Who it is for" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Who it is for, such as Jane Doe, paralegal" maxLength={80} style={field} />
                    <AddressEditor draft={personDraft} onChange={setPersonDraft} disabled={busy} label="The person’s address" />
                    <div><button type="button" onClick={() => void create(newLabel.trim(), personDraft)} disabled={busy || !newLabel.trim() || Boolean(legalAddressProblem(composeLegalAddress(personDraft.base, personDraft.tail)))} style={btn}>Add a link</button></div>
                  </div>
                </section>

                {view.past.length ? (
                  <section data-legal-links-past style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={head}>Turned off</div>
                    <div style={{ display: 'grid', gap: 3, marginTop: 4 }}>
                      {view.past.map((r) => (
                        <div key={r.id} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--text-700)' }}>{legalLinkName(r, firmName)}</span> · {legalLinkPastLine(r, calendarYmdInAppTzFromIso)}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {target ? (
                  <div data-legal-send-link style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'grid', gap: 8 }}>
                    <div style={head}>Send {target.purpose === 'firm' ? 'the firm' : legalLinkName(target, firmName)} their link</div>
                    {live.length > 1 ? (
                      <label style={{ ...muted, display: 'flex', gap: 6, alignItems: 'center' }}>
                        Which link
                        <select aria-label="Which link" value={target.id} onChange={(e) => { const r = live.find((x) => x.id === e.target.value); if (r) pickSendTarget(r) }} style={{ ...field, width: 'auto' }}>
                          {live.map((r) => <option key={r.id} value={r.id}>{legalLinkName(r, firmName)}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {onFile ? (
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.84rem' }}>
                        <input type="checkbox" checked={useOnFile} onChange={(e) => setUseOnFile(e.target.checked)} /> {onFile} <span style={{ color: 'var(--text-muted)' }}>· on file</span>
                      </label>
                    ) : null}
                    <input aria-label="Another address" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={onFile && useOnFile ? 'Another address (optional)' : target.purpose === 'firm' ? 'The firm’s email address' : 'Their email address'} style={field} />
                    <textarea aria-label="A line for the email" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a line to the email (optional)" style={{ ...field, resize: 'vertical' }} />
                    {sendError ? <div role="alert" style={{ fontSize: '0.8rem', color: '#b42318' }}>{sendError}</div> : null}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => void send()} disabled={busy || Boolean(addresses.error)} style={dark}>{sentLines[target.id] ? 'Send it again' : 'Send the link'}</button>
                      <span style={muted}>From the company, signed by you. A reply comes to you. It asks the firm to add the people who should get our emails.</span>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={() => setOpen(false)} style={btn}>Close</button></div>
          </div>
        </div>
      ) : null}
    </>
  )
}
