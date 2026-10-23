import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useAuth } from '../../hooks/useAuth'
import { useHoldsUnsavedWork } from '../../hooks/useHoldsUnsavedWork'
import { useReloadDraft } from '../../hooks/useReloadDraft'
import { DRAFT_RESTORED_TOAST, draftStorageKey } from '../../lib/reloadDraft'
import { particularsFilled } from '../../lib/legal/legalFirmFacts'
import {
  changedWords,
  countiesOf,
  countyChanges,
  countyWritePlan,
  firmHues,
  firmLegend,
  moveCounty,
  moveQuestion,
  movedWords,
  pressCounty,
  pressWords,
  savedAssignments,
  savedWords,
  type LegalFirmCountyRow,
} from '../../lib/legal/firmCounties'
import type { LegalFirmRow } from '../../lib/legal/legalMatters'
import { useLegalFirmMapCases } from '../../hooks/useLegalFirmMapCases'
import type { LegalMapCase } from '../../lib/legal/firmMap'
import LegalFirmCard from './LegalFirmCard'
import LegalFirmCountyMap from './LegalFirmCountyMap'
import LegalCountyContentsCard from './LegalCountyContentsCard'

const db = supabase as unknown as SupabaseClient

/**
 * Settings → Jobs & billing → **Collections law firms** (Legal portal PR 2, v2.3313; plural
 * since v2.5756, punch list #144 PR 1). Dev-only (RLS). A card per active firm on the left,
 * the Texas county map on the right: press a card to pick its firm, click counties to color
 * them for it, click again to clear; a county another firm holds asks before it moves.
 * Nothing writes until **Save counties** (`legal_firm_counties`: the old live row closed,
 * a new one inserted, by `countyWritePlan`). Since PR 1b the map zooms and pans, draws
 * today's cases as faint dots (`useLegalFirmMapCases`), and a contents card under the firm
 * cards lists the county under the pointer; a dot click holds its case there and never
 * colors. Under it, Click's particulars for filing, shared by every firm. Since v2.4711 the Legal desk's firm window mounts it too
 * (`inWindow` with `firmId`: that firm's form alone, the window's facts under it, `onSaved`
 * so the desk reloads the firm the moment it is saved).
 */
type Particulars = { entity: string; license: string; agent: string; custodian: string; affiant: string; phone: string; email: string; w9: string }
const EMPTY_PARTICULARS: Particulars = { entity: '', license: '', agent: '', custodian: '', affiant: '', phone: '', email: '', w9: '' }
const PARTICULARS_KEY = 'legal_particulars_v1'
const FIRM_COLUMNS = 'id, name, handling_name, email, phone, contingency_pct, filing_cost, active, created_at'

export default function LegalFirmSettingsBlock({ onSaved, inWindow = false, firmFacts = null, firmId = null }: { onSaved?: () => void; inWindow?: boolean; firmFacts?: ReactNode; firmId?: string | null } = {}) {
  const { role, user } = useAuth()
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const [firms, setFirms] = useState<LegalFirmRow[]>([])
  const [countyRows, setCountyRows] = useState<LegalFirmCountyRow[]>([])
  const [countiesAvailable, setCountiesAvailable] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [available, setAvailable] = useState(true)
  const [adding, setAdding] = useState(false)
  const [pickedFirmId, setPickedFirmId] = useState<string | null>(null)
  const [cardCounty, setCardCounty] = useState<string | null>(null)
  const [heldCase, setHeldCase] = useState<LegalMapCase | null>(null)
  const [draft, setDraft] = useState<Map<string, string>>(new Map())
  const [savingCounties, setSavingCounties] = useState(false)
  const [particulars, setParticulars] = useState<Particulars>(EMPTY_PARTICULARS)
  const [pDirty, setPDirty] = useState(false)
  const [pSaving, setPSaving] = useState(false)
  const pDraft = useReloadDraft<Particulars>(draftStorageKey('legal-firm', 'particulars'))
  useEffect(() => {
    if (pDirty) pDraft.write(particulars)
  }, [pDirty, particulars, pDraft])

  const activeFirms = useMemo(() => firms.filter((f) => f.active), [firms])
  const saved = useMemo(() => savedAssignments(countyRows, new Set(activeFirms.map((f) => f.id))), [countyRows, activeFirms])
  const changes = useMemo(() => countyChanges(saved, draft), [saved, draft])
  // The map's draft is not kept across a reload, so the gate holds while counties are unsaved (v2.3742).
  useHoldsUnsavedWork(changes.length > 0 || savingCounties || pSaving, 'Law firm counties')
  const hues = useMemo(() => firmHues(activeFirms), [activeFirms])
  const firmNames = useMemo(() => new Map(firms.map((f) => [f.id, f.name] as const)), [firms])
  const legend = useMemo(() => firmLegend(activeFirms, draft), [activeFirms, draft])
  const { cases } = useLegalFirmMapCases(role === 'dev' && !inWindow && loaded && available, firmNames)

  const load = useCallback(async () => {
    const q = db.from('legal_firms').select(FIRM_COLUMNS).eq('active', true).order('created_at')
    const [f, c] = await Promise.all([inWindow && firmId ? db.from('legal_firms').select(FIRM_COLUMNS).eq('id', firmId) : q, db.from('legal_firm_counties').select('*').is('until', null)])
    if (f.error) {
      setAvailable(false)
      setLoaded(true)
      return
    }
    const rows = (f.data ?? []) as LegalFirmRow[]
    setFirms(rows)
    // The counties table lands with the v2.5756 migration; before the push the map reads, and says a save needs it.
    setCountiesAvailable(!c.error)
    const counties = c.error ? [] : ((c.data ?? []) as LegalFirmCountyRow[])
    setCountyRows(counties)
    setDraft(savedAssignments(counties, new Set(rows.filter((r) => r.active).map((r) => r.id))))
    setPickedFirmId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : rows[0]?.id ?? null))
    setLoaded(true)
  }, [inWindow, firmId])

  useEffect(() => {
    if (role !== 'dev') return
    void load()
  }, [role, load])

  useEffect(() => {
    if (role !== 'dev') return
    void (async () => {
      const { data } = await db.from('app_settings').select('value_text').eq('key', PARTICULARS_KEY).maybeSingle()
      try {
        const parsed = JSON.parse(((data as { value_text?: string | null } | null)?.value_text ?? '') || '{}') as Partial<Particulars>
        setParticulars({ ...EMPTY_PARTICULARS, ...parsed })
      } catch {
        setParticulars(EMPTY_PARTICULARS)
      }
      const kept = pDraft.read()
      if (kept) {
        setParticulars({ ...EMPTY_PARTICULARS, ...kept })
        setPDirty(true)
        showToast(DRAFT_RESTORED_TOAST, 'success')
      }
    })()
  }, [role, pDraft, showToast])

  if (role !== 'dev') return null

  const firmSaved = (row: LegalFirmRow) => {
    setFirms((list) => (list.some((f) => f.id === row.id) ? list.map((f) => (f.id === row.id ? { ...f, ...row } : f)) : [...list, row]))
    setAdding(false)
    setPickedFirmId((cur) => cur ?? row.id)
    onSaved?.()
  }

  const hoverCounty = (county: string | null) => {
    // A held case keeps the card on its county until another dot is clicked.
    if (heldCase) return
    if (county) setCardCounty(county)
  }
  const pressCase = (c: LegalMapCase) => {
    setHeldCase(c)
    setCardCounty(c.county)
  }
  const holdFromCard = (c: LegalMapCase) => setHeldCase((cur) => (cur?.id === c.id ? null : c))

  const pressCountyOnMap = async (county: string) => {
    setHeldCase(null)
    setCardCounty(county)
    if (!pickedFirmId) {
      showToast('Pick a firm on the left first.', 'error')
      return
    }
    const firmName = firmNames.get(pickedFirmId) ?? 'the firm'
    const { next, press } = pressCounty(draft, county, pickedFirmId)
    if (press.kind !== 'held') {
      setDraft(next)
      showToast(pressWords(press, county, firmName), 'success')
      return
    }
    const holderName = firmNames.get(press.byFirmId) ?? 'another firm'
    const yes = await confirm({ title: `${county} County`, message: moveQuestion(county, holderName, firmName), confirmLabel: `Move it to ${firmName}`, cancelLabel: 'Leave it', cancelIsSafe: true })
    if (!yes) return
    setDraft(moveCounty(draft, county, pickedFirmId))
    showToast(movedWords(county, firmName), 'success')
  }

  const saveCounties = async () => {
    if (changes.length === 0) return
    const plan = countyWritePlan(changes, user?.id ?? null)
    setSavingCounties(true)
    try {
      const now = new Date().toISOString()
      for (const county of plan.close) {
        const { error } = await db.from('legal_firm_counties').update({ until: now }).eq('county', county).is('until', null)
        if (error) {
          showToast(`Could not save ${county}: ${error.message}`, 'error')
          await load()
          return
        }
      }
      if (plan.insert.length > 0) {
        const { error } = await db.from('legal_firm_counties').insert(plan.insert.map((r) => ({ ...r, since: now })))
        if (error) {
          showToast(error.code === '23505' ? 'Another tab saved a county first. The map shows what stands now.' : `Could not save: ${error.message}`, 'error')
          await load()
          return
        }
      }
      await load()
      showToast(savedWords(changes.length), 'success')
      onSaved?.()
    } finally {
      setSavingCounties(false)
    }
  }

  const setP = (k: keyof Particulars) => (e: { target: { value: string } }) => {
    setParticulars((p) => ({ ...p, [k]: e.target.value }))
    setPDirty(true)
  }
  const saveParticulars = async () => {
    setPSaving(true)
    try {
      const { error } = await db.from('app_settings').upsert([{ key: PARTICULARS_KEY, value_text: JSON.stringify(particulars) }])
      if (error) {
        showToast(`Could not save: ${error.message}`, 'error')
        return
      }
      setPDirty(false)
      pDraft.clear()
      showToast('Particulars saved. The firm’s portal shows them now.', 'success')
    } finally {
      setPSaving(false)
    }
  }

  const input = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem' } as const
  const label = { display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' } as const
  const windowFirm = inWindow ? (firmId ? firms.find((f) => f.id === firmId) ?? null : activeFirms[0] ?? null) : null
  const dirtyCounties = changes.length > 0

  return (
    <div id={inWindow ? undefined : 'settings-legal-firm'} data-legal-firm-block={inWindow ? 'window' : 'settings'} style={inWindow ? undefined : { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
      {inWindow ? (
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Who we release accounts to</h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This firm’s name and handling person print on every release and on the firm’s portal. Its counties are set on Settings → Jobs & billing.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>⚖ Collections law firms</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Who the Legal desk releases accounts to, by county. Each firm keeps its own fee model behind “Click keeps”. A county nobody covers stays gray, and the desk says so on the account.</span>
        </div>
      )}
      {!available ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>The legal tables aren’t on this database yet — apply the v2.3313 migration first.</p>
      ) : !loaded ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>Loading…</p>
      ) : inWindow ? (
        <>
          <LegalFirmCard key={windowFirm?.id ?? 'none'} firm={windowFirm} bare firmFacts={firmFacts} onSaved={firmSaved} />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: '0.75rem', alignItems: 'flex-start' }}>
            <div data-legal-firm-cards style={{ flex: '1 1 260px', maxWidth: 360, display: 'grid', gap: 10 }}>
              {activeFirms.map((firm) => (
                <LegalFirmCard key={firm.id} firm={firm} hue={hues.get(firm.id)} counties={countiesOf(draft, firm.id)} picked={pickedFirmId === firm.id} onPick={() => setPickedFirmId(firm.id)} onSaved={firmSaved} />
              ))}
              {adding ? (
                <LegalFirmCard key="new" firm={null} startOpen onSaved={firmSaved} onDiscard={() => setAdding(false)} />
              ) : (
                <button type="button" onClick={() => setAdding(true)} style={{ justifySelf: 'start', padding: '0.35rem 0.8rem', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.84rem', cursor: 'pointer' }}>
                  {activeFirms.length === 0 ? 'Add the firm' : 'Add a firm'}
                </button>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void saveCounties()} disabled={!dirtyCounties || savingCounties || !countiesAvailable} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: dirtyCounties && countiesAvailable ? 'var(--text-700)' : 'var(--bg-muted)', color: dirtyCounties && countiesAvailable ? 'var(--surface)' : 'var(--text-muted)', fontSize: '0.86rem', cursor: dirtyCounties && countiesAvailable ? 'pointer' : 'default' }}>
                  {savingCounties ? 'Saving…' : 'Save counties'}
                </button>
                <button type="button" onClick={() => setDraft(new Map(saved))} disabled={!dirtyCounties || savingCounties} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: dirtyCounties ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.86rem', cursor: dirtyCounties ? 'pointer' : 'default' }}>
                  Undo changes
                </button>
              </div>
              <span data-legal-counties-pending style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{countiesAvailable ? changedWords(changes.length) : 'The counties table isn’t on this database yet — push the v2.5756 migration, then save.'}</span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Changing a county affects new releases only. A matter stays with the firm it went to.</p>
              <LegalCountyContentsCard county={cardCounty} cases={cases} assignments={draft} firmNames={firmNames} heldId={heldCase?.id ?? null} onHold={holdFromCard} />
            </div>
            <div style={{ flex: '2 1 340px', minWidth: 0 }}>
              <LegalFirmCountyMap assignments={draft} hues={hues} firmNames={firmNames} legend={legend} pickedFirmId={pickedFirmId} cases={cases} heldCaseId={heldCase?.id ?? null} onPress={(county) => void pressCountyOnMap(county)} onHoverCounty={hoverCounty} onPressCase={pressCase} />
            </div>
          </div>
        </>
      )}
      {available && loaded ? (
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Click’s particulars for filing</h4>
            <ParticularsCount particulars={particulars} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>What a petition or lien affidavit needs from the claimant — shown on every firm’s portal.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: '0.75rem' }}>
            <label style={label}>Legal entity<input style={input} value={particulars.entity} onChange={setP('entity')} placeholder="Click Plumbing and Electrical, LLC" /></label>
            <label style={label}>License<input style={input} value={particulars.license} onChange={setP('license')} placeholder="TX RMP M-…" /></label>
            <label style={label}>Registered agent<input style={input} value={particulars.agent} onChange={setP('agent')} /></label>
            <label style={label}>Custodian of records<input style={input} value={particulars.custodian} onChange={setP('custodian')} placeholder="Who signs the business-records affidavit" /></label>
            <label style={label}>Affiant for sworn accounts<input style={input} value={particulars.affiant} onChange={setP('affiant')} /></label>
            <label style={label}>Office phone<input style={input} value={particulars.phone} onChange={setP('phone')} /></label>
            <label style={label}>Office email<input style={input} value={particulars.email} onChange={setP('email')} /></label>
            <label style={label}>W-9 / EIN note<input style={input} value={particulars.w9} onChange={setP('w9')} placeholder="on request from the office" /></label>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={() => void saveParticulars()} disabled={!pDirty || pSaving} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: pDirty ? 'var(--text-700)' : 'var(--bg-muted)', color: pDirty ? 'var(--surface)' : 'var(--text-muted)', fontSize: '0.86rem', cursor: pDirty ? 'pointer' : 'default' }}>
              {pSaving ? 'Saving…' : 'Save particulars'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** `3 of 8 filled`: how much of the company's filing details the firm can read today (v2.4711). */
function ParticularsCount({ particulars }: { particulars: Particulars }) {
  const { filled, total } = particularsFilled(particulars)
  const done = filled === total
  return (
    <span data-legal-particulars-count style={{ fontSize: '0.74rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, border: `1px solid ${done ? 'var(--border-green)' : 'var(--border-amber-soft)'}`, background: done ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', color: done ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
      {filled} of {total} filled
    </span>
  )
}
