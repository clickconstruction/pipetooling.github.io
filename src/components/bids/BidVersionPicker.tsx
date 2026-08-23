import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { BidVersion } from '../../lib/bids/bidPricingEngineTypes'
import { formatSendBadge, latestSendByVersion, type VersionSendRow } from '../../lib/bids/versionSends'

type BidVersionPickerProps = {
  bidId: string
  bidVersions: BidVersion[]
  selectedBidVersionId: string | null
  /** Active pricing facet id — the "copy current pricing" source. */
  currentPricingId: string | null
  /** Fallback pricing source (a template) when the bid has no current pricing yet. */
  fallbackPricingSourceId: string | null
  /** When the bid uses the 'exact' materials model, show the shared-PO caveat. */
  isExactMaterials?: boolean
  /** Activate a Version (hook switchActiveVersion). */
  onSwitch: (versionId: string) => void
  /** Reload the versions list after create/rename/delete. */
  reloadVersions: () => Promise<void>
  /** "Send… →" jump to the Cover Letter tab, where versions bundle into the submission (v2.2110). */
  onGoToCoverLetter?: () => void
  /** Scenario names by id (bid pricings + templates), so the split modal can say which name the clone keeps (v2.2123). */
  pricingSourceNames?: Record<string, string>
  /** The bid's own GC / builder name — the group a version with no override belongs to (G2, v2.2161). */
  bidGcName?: string | null
  /** bids.bid_date_sent — shown on every GC group when the bid has no per-version sends yet (pre-v2.2124 bids). */
  bidDateSent?: string | null
}

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.35rem 0.5rem',
  borderRadius: 4,
  cursor: 'pointer',
}

/**
 * Bid-level Version picker shown across Takeoff / Pricing / Cover Letter. A Version is a named
 * variant (its own takeoff + optional pricing). The first "+ New version" splits the bid: it
 * names the current setup AND the new variant (so nothing stays unnamed).
 */
export function BidVersionPicker({
  bidId,
  bidVersions,
  selectedBidVersionId,
  currentPricingId,
  fallbackPricingSourceId,
  isExactMaterials,
  onSwitch,
  reloadVersions,
  onGoToCoverLetter,
  pricingSourceNames,
  bidGcName,
  bidDateSent,
}: BidVersionPickerProps) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const isUnsplit = bidVersions.length === 0

  const [modalOpen, setModalOpen] = useState(false)
  const [currentName, setCurrentName] = useState('') // first-split only: name for the existing setup
  const [newName, setNewName] = useState('')
  const [clonePricing, setClonePricing] = useState(true)
  const [busy, setBusy] = useState(false)

  const [renaming, setRenaming] = useState<BidVersion | null>(null)
  // G2 (v2.2161): "+ Another GC…" — GC-first packet creation; "+ version" inside a GC group.
  const [addGc, setAddGc] = useState<{ gcId: string; fromVersionId: string; name: string } | null>(null)
  const [newForGcId, setNewForGcId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Per-version GC override (v2.1159). '' = use the bid-level GC.
  const [renameGcCustomerId, setRenameGcCustomerId] = useState('')
  const [gcCustomers, setGcCustomers] = useState<Array<{ id: string; name: string }> | null>(null)
  const [gcNamesById, setGcNamesById] = useState<Record<string, string>>({})

  // Chip tags need names for overridden versions without loading every customer.
  useEffect(() => {
    const missing = [...new Set(bidVersions.map((v) => v.customer_id).filter((id): id is string => !!id))].filter(
      (id) => gcNamesById[id] === undefined,
    )
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('customers').select('id, name').in('id', missing)
      if (cancelled || !data) return
      setGcNamesById((prev) => {
        const next = { ...prev }
        for (const c of data) next[c.id] = c.name ?? '—'
        return next
      })
    })()
    return () => { cancelled = true }
  }, [bidVersions, gcNamesById])

  // Full pick-list only once the edit dialog opens.
  useEffect(() => {
    if ((!renaming && !addGc) || gcCustomers !== null) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('customers').select('id, name').order('name')
      if (!cancelled) setGcCustomers((data ?? []).map((c) => ({ id: c.id, name: c.name ?? '—' })))
    })()
    return () => { cancelled = true }
  }, [renaming, addGc, gcCustomers])

  // Per-version sends (v2.2124) → "sent 7/7 · $X" on each chip.
  const [sends, setSends] = useState<VersionSendRow[]>([])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bidId)
      if (!cancelled) setSends(error ? [] : ((data ?? []) as VersionSendRow[]))
    }
    void load()
    const onChanged = () => { void load() }
    window.addEventListener('bid-version-sends-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('bid-version-sends-changed', onChanged) }
  }, [bidId])
  const latestSends = latestSendByVersion(sends)

  function openNewVersion(forGcId: string | null = null) {
    setCurrentName(isUnsplit ? (bidGcName ?? 'To Plans') : '')
    setNewName(isUnsplit ? 'Value Engineered' : '')
    setClonePricing(true)
    setNewForGcId(forGcId)
    setModalOpen(true)
  }
  /** Record a GC a version points at as a bid recipient (best-effort, as the rename dialog does). */
  async function stampVersionGc(versionId: string, gcId: string) {
    await supabase.from('bid_versions').update({ customer_id: gcId }).eq('id', versionId)
    try {
      const { data: bidRow } = await supabase.from('bids').select('customer_id').eq('id', bidId).single()
      if ((bidRow?.customer_id ?? null) !== gcId) {
        await (supabase as never as { from: (t: string) => { upsert: (v: object, o: object) => Promise<{ error: { message: string } | null }> } })
          .from('bid_gc_recipients')
          .upsert({ bid_id: bidId, customer_id: gcId, source: 'version' }, { onConflict: 'bid_id,customer_id', ignoreDuplicates: true })
      }
    } catch { /* recipients table is best-effort */ }
  }
  /** G2: "+ Another GC…" — a packet for that GC, starting as a copy of a chosen version (or the unsplit bid). */
  async function submitAddGc() {
    if (!addGc || !addGc.gcId) return
    const gcName = gcCustomers?.find((c) => c.id === addGc.gcId)?.name ?? 'GC'
    const name = addGc.name.trim() || gcName
    setBusy(true)
    try {
      let newId: string | null = null
      if (isUnsplit) {
        const { data, error } = await supabase.rpc('split_bid_into_versions', {
          p_bid_id: bidId,
          p_current_name: bidGcName ?? 'To Plans',
          p_new_name: name,
          p_clone_pricing: !!pricingSource,
          p_pricing_source_version_id: (pricingSource ?? null) as string,
        })
        if (error) { showToast(`Failed: ${error.message}`, 'error'); return }
        newId = data as string
      } else {
        const src = bidVersions.find((v) => v.id === addGc.fromVersionId) ?? bidVersions[0]
        if (!src) return
        const srcPricing = src.starred_price_book_version_id ?? (src.id === selectedBidVersionId ? pricingSource : null)
        const { data, error } = await supabase.rpc('create_bid_version', {
          p_bid_id: bidId,
          p_name: name,
          p_source_bid_version_id: src.id,
          p_clone_pricing: !!srcPricing,
          p_pricing_source_version_id: (srcPricing ?? null) as string,
        })
        if (error) { showToast(`Failed: ${error.message}`, 'error'); return }
        newId = data as string
      }
      if (newId) await stampVersionGc(newId, addGc.gcId)
      await reloadVersions()
      if (newId) onSwitch(newId)
      setAddGc(null)
      showToast(`${gcName} added — their packet starts as a copy. Price it, then send from the Cover Letter.`, 'success')
    } finally {
      setBusy(false)
    }
  }

  // The Workbench's "Try a variant…" door (v2.2104) opens this picker's
  // new-version modal from below via a window event — no prop drilling
  // through Bids.tsx.
  useEffect(() => {
    const open = () => openNewVersion(null)
    // 'bid-version-picker-reload' (v2.2133): "Adopt an existing bid" created versions outside this component.
    const reload = () => { void reloadVersions() }
    window.addEventListener('bid-version-picker-open-new', open)
    window.addEventListener('bid-version-picker-reload', reload)
    return () => {
      window.removeEventListener('bid-version-picker-open-new', open)
      window.removeEventListener('bid-version-picker-reload', reload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnsplit])

  const pricingSource = currentPricingId ?? fallbackPricingSourceId ?? null
  /** Name of the scenario the new version's prices start from (v2.2123: the clone keeps this name). */
  const pricingSourceName = pricingSourceNames?.[pricingSource ?? ''] ?? null

  async function submitNewVersion() {
    const variantName = newName.trim()
    if (!variantName) return
    if (!isUnsplit && !selectedBidVersionId) return // defensive: a split bid always has an active version
    const willClonePricing = clonePricing && !!pricingSource
    if (clonePricing && !pricingSource) {
      showToast('No pricing to copy yet — the version will be created without pricing.', 'info')
    }
    setBusy(true)
    try {
      let newId: string | null = null
      if (isUnsplit) {
        // Atomic: materialize the current setup as a named version AND create the variant in one tx.
        const { data, error } = await supabase.rpc('split_bid_into_versions', {
          p_bid_id: bidId,
          p_current_name: currentName.trim() || 'Version 1',
          p_new_name: variantName,
          p_clone_pricing: willClonePricing,
          // nullable uuid in SQL; generated type marks it required.
          p_pricing_source_version_id: (willClonePricing ? pricingSource : null) as string,
        })
        if (error) {
          showToast(`Failed to split into versions: ${error.message}`, 'error')
          await reloadVersions()
          setBusy(false)
          return
        }
        newId = data as string
      } else {
        const { data, error } = await supabase.rpc('create_bid_version', {
          p_bid_id: bidId,
          p_name: variantName,
          p_source_bid_version_id: selectedBidVersionId as string,
          p_clone_pricing: willClonePricing,
          p_pricing_source_version_id: (willClonePricing ? pricingSource : null) as string,
        })
        if (error) {
          showToast(`Failed to create version: ${error.message}`, 'error')
          setBusy(false)
          return
        }
        newId = data as string
      }
      if (newId && newForGcId) await stampVersionGc(newId, newForGcId)
      await reloadVersions()
      if (newId) onSwitch(newId)
      setModalOpen(false)
      setNewForGcId(null)
      showToast(`Created version "${variantName}".`, 'success')
    } finally {
      setBusy(false)
    }
  }

  async function submitRename() {
    if (!renaming) return
    const name = renameValue.trim()
    if (!name) return
    setBusy(true)
    try {
      // Update the Version and mirror onto its pricing facet so the submission bundle label matches.
      const [{ error: vErr }, { error: pErr }] = await Promise.all([
        supabase.from('bid_versions').update({ name, customer_id: renameGcCustomerId || null }).eq('id', renaming.id),
        supabase.from('price_book_versions').update({ name }).eq('bid_version_id', renaming.id),
      ])
      if (vErr || pErr) {
        showToast(`Failed to rename: ${(vErr ?? pErr)?.message}`, 'error')
        setBusy(false)
        return
      }
      // Best-effort: a version pointed at a GC records that GC as a bid
      // recipient (bid_gc_recipients, source 'version') so the followup
      // surfaces can queue a call to every GC the bid actually went to.
      if (renameGcCustomerId) {
        try {
          const { data: bidRow } = await supabase.from('bids').select('customer_id').eq('id', bidId).single()
          if ((bidRow?.customer_id ?? null) !== renameGcCustomerId) {
            await (supabase as never as {
              from: (t: string) => { upsert: (v: object, o: object) => Promise<{ error: { message: string } | null }> }
            })
              .from('bid_gc_recipients')
              .upsert(
                { bid_id: bidId, customer_id: renameGcCustomerId, source: 'version' },
                { onConflict: 'bid_id,customer_id', ignoreDuplicates: true },
              )
          }
        } catch {
          // Table may not be deployed yet — the migration's backfill covers these rows.
        }
      }
      await reloadVersions()
      setRenaming(null)
    } finally {
      setBusy(false)
    }
  }

  async function deleteVersion(v: BidVersion) {
    if (bidVersions.length <= 1) {
      showToast('Can’t delete the only version. Add another first.', 'info')
      return
    }
    if (
      !(await confirmDialog({
        message: `Delete version "${v.name}"? Its takeoff and pricing are removed. This can’t be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    setBusy(true)
    try {
      const { error } = await supabase.from('bid_versions').delete().eq('id', v.id)
      if (error) {
        showToast(`Failed to delete: ${error.message}`, 'error')
        setBusy(false)
        return
      }
      await reloadVersions()
      if (selectedBidVersionId === v.id) {
        const next = bidVersions.find((x) => x.id !== v.id)
        if (next) onSwitch(next.id)
      }
      setRenaming(null)
    } finally {
      setBusy(false)
    }
  }

  // G2: group versions by the GC they go to (no override = the bid's GC).
  const groups: Array<{ key: string; gcId: string | null; name: string; versions: BidVersion[] }> = []
  for (const v of [...bidVersions].sort((a, b) => a.sort_order - b.sort_order)) {
    const key = v.customer_id ?? ''
    let g = groups.find((x) => x.key === key)
    if (!g) { g = { key, gcId: v.customer_id ?? null, name: v.customer_id ? (gcNamesById[v.customer_id] ?? '…') : (bidGcName ?? 'the GC'), versions: [] }; groups.push(g) }
    g.versions.push(v)
  }
  if (groups.length === 0) groups.push({ key: '', gcId: null, name: bidGcName ?? 'the GC', versions: [] })
  groups.sort((a, b) => (a.key === '' ? -1 : b.key === '' ? 1 : 0))
  const anySends = Object.keys(latestSends).length > 0
  // Pre-v2.2124 bids have no per-version sends: fall back to the bid's sent date, but only for
  // versions that already existed then (a packet added later was not part of that send).
  const gcSentOn = (g: { versions: BidVersion[] }) => {
    let best: string | null = null
    for (const v of g.versions) { const so = latestSends[v.id]?.sentOn; if (so && (!best || so > best)) best = so }
    if (best) return best
    if (anySends || !bidDateSent) return null
    const existedThen = g.versions.some((v) => !v.created_at || v.created_at.slice(0, 10) <= bidDateSent)
    return existedThen ? bidDateSent : null
  }
  const fmtSent = (ymd: string) => { const [, m, d] = ymd.split('-'); return m && d ? `${Number(m)}/${Number(d)}` : ymd }
  const starNameOf = (v: BidVersion) => (v.starred_price_book_version_id ? pricingSourceNames?.[v.starred_price_book_version_id] ?? null : null)

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Send to</span>
        {groups.map((g) => {
          const groupActive = !isUnsplit && g.versions.some((v) => v.id === selectedBidVersionId)
          const sentOn = gcSentOn(g)
          const first = g.versions[0]
          const star = first ? starNameOf(first) : null
          return (
            <div
              key={g.key || 'bid-default'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.4rem', border: groupActive || isUnsplit ? '1px solid #3b82f6' : '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', boxShadow: groupActive ? 'inset 0 0 0 1px #3b82f6' : 'none' }}
            >
              <button
                type="button"
                onClick={() => { if (first && first.id !== selectedBidVersionId) onSwitch(first.id) }}
                title={isUnsplit ? 'This bid goes to this GC' : `Switch to ${g.name}'s packet`}
                style={{ background: 'none', border: 'none', cursor: first ? 'pointer' : 'default', padding: '0 0.3rem', textAlign: 'left', color: 'var(--text-strong)' }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.82rem', display: 'block' }}>{g.name}</span>
                <span style={{ display: 'block', fontSize: '0.625rem', color: sentOn ? 'var(--text-green-600)' : 'var(--text-muted)' }}>
                  {sentOn ? `sent ${fmtSent(sentOn)}` : 'not sent'}{star ? ` · ★ ${star}` : isUnsplit ? ' · one bid' : ''}{g.versions.length > 1 ? ` · ${g.versions.length} versions` : ''}
                </span>
              </button>
              {g.versions.map((v) => {
                const active = selectedBidVersionId === v.id
                return (
                  <span key={v.id} style={{ ...chipBase, background: active ? 'var(--bg-blue-200)' : 'var(--bg-muted)', border: active ? '1px solid #3b82f6' : '1px solid var(--border-strong)' }}>
                    <button type="button" onClick={() => onSwitch(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: active ? 600 : 400, padding: 0, textAlign: 'left' }}>
                      {v.name}
                      <span style={{ display: 'block', fontSize: '0.625rem', color: v.include_in_submission ? 'var(--text-green-600)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {v.include_in_submission ? `in letter ✓ · ${v.is_alternate ? 'alternate' : 'base'}` : 'not in letter'}
                      </span>
                      {(() => { const b = formatSendBadge(latestSends[v.id]); return b ? <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)' }}>{b}</span> : null })()}
                    </button>
                    <button type="button" onClick={() => { setRenaming(v); setRenameValue(v.name); setRenameGcCustomerId(v.customer_id ?? '') }} style={{ padding: '0.15rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }} title="Rename / delete version">✎</button>
                  </span>
                )
              })}
              <button
                type="button"
                onClick={() => openNewVersion(g.gcId)}
                title={`Another version for ${g.name} — its own takeoff and prices (e.g. a VE)`}
                style={{ padding: '0.2rem 0.45rem', background: 'none', border: '1px dashed var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-muted)' }}
              >
                + version
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setAddGc({ gcId: '', fromVersionId: selectedBidVersionId ?? bidVersions[0]?.id ?? '', name: '' })}
          style={{ padding: '0.35rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
          title="Send this bid to another GC — a packet that starts as a copy"
        >
          ＋ Another GC…
        </button>
        {!isUnsplit ? (
          <button
            type="button"
            onClick={() => {
              // v2.2117: "Send… →" lands on the Cover Letter's New view (the one that bundles bids).
              try { window.localStorage.setItem('bids_cover_letter_view_v1', 'new') } catch { /* device just won't remember */ }
              onGoToCoverLetter?.()
            }}
            style={{ marginLeft: 'auto', padding: '0.35rem 0.6rem', background: 'none', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-strong)' }}
            title="Send from the Cover Letter — one letter per GC"
          >
            Send… →
          </button>
        ) : null}
      </div>
      {isExactMaterials && !isUnsplit && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', borderRadius: 4, padding: '0.35rem 0.5rem' }}>
          This bid uses By-Stage materials — material totals come from shared purchase orders and aren’t versioned.
        </div>
      )}

      {modalOpen && (
        <Overlay onClose={() => !busy && setModalOpen(false)}>
          <h3 style={{ margin: '0 0 1rem' }}>{isUnsplit ? 'Split into two versions' : newForGcId ? `Another version for ${gcNamesById[newForGcId] ?? 'this GC'}` : 'Another version'}</h3>
          {isUnsplit && (
            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-600)', fontSize: '0.875rem' }}>
              Name what you have now, then the new one. Each becomes its own bid — its own counts, takeoff and prices from here — sendable separately or bundled in one cover letter.
            </p>
          )}
          {isUnsplit && (
            <label style={{ display: 'block', marginBottom: '0.75rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Name this bid</span>
              <input value={currentName} onChange={(e) => setCurrentName(e.target.value)} placeholder="e.g. To Plans"
                style={inputStyle} />
            </label>
          )}
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>{isUnsplit ? 'Name the new bid' : 'Name'}</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Value Engineered" autoFocus
              style={inputStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            <input type="checkbox" checked={clonePricing} onChange={(e) => setClonePricing(e.target.checked)} />
            Start its prices from this bid&apos;s ★{pricingSourceName ? <> — <strong>{pricingSourceName}</strong> stays named {pricingSourceName}</> : null}
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} disabled={busy} style={btnGhost}>Cancel</button>
            <button type="button" onClick={submitNewVersion} disabled={busy || !newName.trim()} style={btnPrimary}>
              {busy ? 'Working…' : isUnsplit ? 'Split' : 'Create'}
            </button>
          </div>
        </Overlay>
      )}

      {addGc && (
        <Overlay onClose={() => !busy && setAddGc(null)}>
          <h3 style={{ margin: '0 0 0.5rem' }}>Send this bid to another GC</h3>
          <p style={{ margin: '0 0 0.75rem', color: 'var(--text-600)', fontSize: '0.875rem' }}>
            Makes a packet for that GC — a version named after them, pointed at them, starting as a copy. Their letter, sends and outcome are tracked on their own.
          </p>
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>GC / builder</span>
            <select value={addGc.gcId} onChange={(e) => setAddGc((st) => st && { ...st, gcId: e.target.value })} style={inputStyle} autoFocus>
              <option value="">{gcCustomers ? 'Pick a GC…' : 'Loading…'}</option>
              {(gcCustomers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {!isUnsplit ? (
            <label style={{ display: 'block', marginBottom: '0.75rem' }}>
              <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Start from</span>
              <select value={addGc.fromVersionId} onChange={(e) => setAddGc((st) => st && { ...st, fromVersionId: e.target.value })} style={inputStyle}>
                {bidVersions.map((v) => <option key={v.id} value={v.id}>{(v.customer_id ? gcNamesById[v.customer_id] ?? '…' : bidGcName ?? 'bid GC')} · {v.name}{starNameOf(v) ? ` · ★ ${starNameOf(v)}` : ' · no prices'}</option>)}
              </select>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>copies its counts, takeoff and prices</span>
            </label>
          ) : (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>This bid isn't split yet — its current setup becomes <strong>{bidGcName ?? 'To Plans'}</strong>'s packet and the new GC starts as a copy of it.</p>
          )}
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Name (optional)</span>
            <input value={addGc.name} onChange={(e) => setAddGc((st) => st && { ...st, name: e.target.value })} placeholder={gcCustomers?.find((c) => c.id === addGc.gcId)?.name ?? 'defaults to the GC name'} style={inputStyle} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setAddGc(null)} disabled={busy} style={btnGhost}>Cancel</button>
            <button type="button" onClick={() => void submitAddGc()} disabled={busy || !addGc.gcId} style={btnPrimary}>{busy ? 'Working…' : 'Add GC'}</button>
          </div>
        </Overlay>
      )}

      {renaming && (
        <Overlay onClose={() => !busy && setRenaming(null)}>
          <h3 style={{ margin: '0 0 1rem' }}>Version</h3>
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Name</span>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus style={inputStyle} />
          </label>
          <label style={{ display: 'block', marginBottom: '0.35rem' }}>
            <span style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>GC/Builder (customer) for this version</span>
            <select value={renameGcCustomerId} onChange={(e) => setRenameGcCustomerId(e.target.value)} style={inputStyle}>
              <option value="">Use bid default</option>
              {(gcCustomers ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Cover letters group versions by GC — each GC gets its own document with only their pricing.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <button type="button" onClick={() => deleteVersion(renaming)} disabled={busy}
              style={{ ...btnGhost, color: 'var(--text-red-700)', borderColor: '#fecaca' }}>Delete</button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => setRenaming(null)} disabled={busy} style={btnGhost}>Cancel</button>
              <button type="button" onClick={submitRename} disabled={busy || !renameValue.trim()} style={btnPrimary}>Save</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }
const btnGhost: React.CSSProperties = { padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 360, maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
