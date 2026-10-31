import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useHoldsUnsavedWork } from '../../hooks/useHoldsUnsavedWork'
import { useReloadDraft } from '../../hooks/useReloadDraft'
import { DRAFT_RESTORED_TOAST, draftStorageKey } from '../../lib/reloadDraft'
import { legalFirmDetailsLine, particularsFilled } from '../../lib/legal/legalFirmFacts'
import {
  changedWords,
  alsoCountiesOf,
  alsoCovers,
  answerHeld,
  countiesByFirmOfCoverage,
  countyChanges,
  firmHues,
  firmLegend,
  firstCalls,
  heldDoneWords,
  pressCounty,
  pressWords,
  savedCoverage,
  savedWords,
  type CountyCover,
  type HeldAnswer,
  type LegalFirmCountyRow,
} from '../../lib/legal/firmCounties'
import type { LegalFirmRow } from '../../lib/legal/legalMatters'
import { saveCountyChanges } from '../../lib/legal/firmCountiesSave'
import { useLegalFirmMapCases } from '../../hooks/useLegalFirmMapCases'
import type { LegalMapCase } from '../../lib/legal/firmMap'
import LegalFirmCard from './LegalFirmCard'
import LegalFirmCountyMap from './LegalFirmCountyMap'
import LegalCountyContentsCard from './LegalCountyContentsCard'
import LegalCountyHeldSheet from './LegalCountyHeldSheet'

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

export default function LegalFirmSettingsBlock({ onSaved, inWindow = false, firmFacts = null, firmId = null }: {
  onSaved?: () => void
  inWindow?: boolean
  firmFacts?: ReactNode
  firmId?: string | null
} = {}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [firms, setFirms] = useState<LegalFirmRow[]>([])
  const [countyRows, setCountyRows] = useState<LegalFirmCountyRow[]>([])
  const [countiesAvailable, setCountiesAvailable] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [available, setAvailable] = useState(true)
  const [adding, setAdding] = useState(false)
  const [pickedFirmId, setPickedFirmId] = useState<string | null>(null)
  const [cardCounty, setCardCounty] = useState<string | null>(null)
  const [heldCase, setHeldCase] = useState<LegalMapCase | null>(null)
  const [draft, setDraft] = useState<Map<string, CountyCover>>(new Map())
  /** A county only other firms cover, pressed: the three-answer sheet is open on it (v2.6227). */
  const [heldCounty, setHeldCounty] = useState<{ county: string; holderId: string; firmId: string } | null>(null)
  const [savingCounties, setSavingCounties] = useState(false)
  const [particulars, setParticulars] = useState<Particulars>(EMPTY_PARTICULARS)
  const [pDirty, setPDirty] = useState(false)
  // The window's two folds (punch list #222, PR 1); on Settings both sections sit open as before.
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [particularsOpen, setParticularsOpen] = useState(false)
  const [pSaving, setPSaving] = useState(false)
  const pDraft = useReloadDraft<Particulars>(draftStorageKey('legal-firm', 'particulars'))
  useEffect(() => {
    if (pDirty) pDraft.write(particulars)
  }, [pDirty, particulars, pDraft])

  const activeFirms = useMemo(() => firms.filter((f) => f.active), [firms])
  const saved = useMemo(() => savedCoverage(countyRows, new Set(activeFirms.map((f) => f.id))), [countyRows, activeFirms])
  const draftFirst = useMemo(() => firstCalls(draft), [draft])
  const draftAlso = useMemo(() => alsoCovers(draft), [draft])
  const draftByFirm = useMemo(() => countiesByFirmOfCoverage(draft), [draft])
  const changes = useMemo(() => countyChanges(saved, draft), [saved, draft])
  // The map's draft is not kept across a reload, so the gate holds while counties are unsaved (v2.3742).
  useHoldsUnsavedWork(changes.length > 0 || savingCounties || pSaving, 'Law firm counties')
  const hues = useMemo(() => firmHues(activeFirms), [activeFirms])
  const firmNames = useMemo(() => new Map(firms.map((f) => [f.id, f.name] as const)), [firms])
  const legend = useMemo(() => firmLegend(activeFirms, draftFirst), [activeFirms, draftFirst])
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
    setDraft(savedCoverage(counties, new Set(rows.filter((r) => r.active).map((r) => r.id))))
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
    // A county only other firms cover: share it, take first call, or move it (v2.6227).
    setHeldCounty({ county, holderId: press.byFirmId, firmId: pickedFirmId })
  }
  const answerHeldCounty = (a: HeldAnswer) => {
    if (!heldCounty) return
    setDraft(answerHeld(draft, heldCounty.county, heldCounty.firmId, a))
    showToast(heldDoneWords(a, heldCounty.county, firmNames.get(heldCounty.firmId) ?? 'the firm', firmNames.get(heldCounty.holderId) ?? 'another firm'), 'success')
    setHeldCounty(null)
  }

  const saveCounties = async () => {
    if (changes.length === 0) return
    setSavingCounties(true)
    try {
      // One write for every door (punch list #222, PR 2): the firm window's Extend coverage saves through it too.
      const r = await saveCountyChanges(db, changes)
      if (!r.ok) {
        showToast(r.message, 'error')
        await load()
        return
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
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This firm’s name and handling person print on every release and on the firm’s portal. Its counties are colored under Firms… and read above.</span>
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
          {/* Punch list #222, PR 1: the details fold to one line; Edit details opens the form in place (hidden, not unmounted, so a half-typed edit never leaves). A new firm opens on the form. */}
          {/* With no firm there is no line: the form below opens on its own, as Add firm. */}
          {windowFirm ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: '0.82rem' }}>
              <span data-legal-firm-details-line style={{ color: 'var(--text-muted)' }}>{legalFirmDetailsLine(windowFirm)}</span>
              <button type="button" onClick={() => setDetailsOpen((v) => !v)} aria-expanded={detailsOpen} style={foldBtn}>{detailsOpen ? 'Hide details' : 'Edit details'}</button>
            </div>
          ) : null}
          <div hidden={Boolean(windowFirm) && !detailsOpen}>
            <LegalFirmCard key={windowFirm?.id ?? 'none'} firm={windowFirm} bare firmFacts={firmFacts} onSaved={firmSaved} />
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: '0.75rem', alignItems: 'flex-start' }}>
            <div data-legal-firm-cards style={{ flex: '1 1 260px', maxWidth: 360, display: 'grid', gap: 10 }}>
              {activeFirms.map((firm) => (
                <LegalFirmCard key={firm.id} firm={firm} hue={hues.get(firm.id)} counties={draftByFirm.get(firm.id) ?? []} alsoIn={alsoCountiesOf(draft, firm.id)} picked={pickedFirmId === firm.id} onPick={() => setPickedFirmId(firm.id)} onSaved={firmSaved} />
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
              <LegalCountyContentsCard county={cardCounty} cases={cases} assignments={draftFirst} also={draftAlso} firmNames={firmNames} heldId={heldCase?.id ?? null} onHold={holdFromCard} />
            </div>
            <div style={{ flex: '2 1 340px', minWidth: 0 }}>
              <LegalFirmCountyMap assignments={draftFirst} also={draftAlso} hues={hues} firmNames={firmNames} legend={legend} pickedFirmId={pickedFirmId} cases={cases} heldCaseId={heldCase?.id ?? null} onPress={(county) => void pressCountyOnMap(county)} onHoverCounty={hoverCounty} onPressCase={pressCase} />
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
            {/* In the window the eight fields fold (punch list #222, PR 1): they are Click's, the same on every firm's portal, and read as the firm's when they sit open. A half-typed edit keeps them open. */}
            {inWindow ? (
              <button type="button" onClick={() => setParticularsOpen((v) => !v)} aria-expanded={particularsOpen || pDirty} style={foldBtn}>{particularsOpen || pDirty ? 'Hide particulars' : 'Edit particulars'}</button>
            ) : null}
          </div>
          <div hidden={inWindow && !particularsOpen && !pDirty} style={{ display: inWindow && !particularsOpen && !pDirty ? undefined : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: '0.75rem' }}>
            <label style={label}>Legal entity<input style={input} value={particulars.entity} onChange={setP('entity')} placeholder="Click Plumbing and Electrical, LLC" /></label>
            <label style={label}>License<input style={input} value={particulars.license} onChange={setP('license')} placeholder="TX RMP M-…" /></label>
            <label style={label}>Registered agent<input style={input} value={particulars.agent} onChange={setP('agent')} /></label>
            <label style={label}>Custodian of records<input style={input} value={particulars.custodian} onChange={setP('custodian')} placeholder="Who signs the business-records affidavit" /></label>
            <label style={label}>Affiant for sworn accounts<input style={input} value={particulars.affiant} onChange={setP('affiant')} /></label>
            <label style={label}>Office phone<input style={input} value={particulars.phone} onChange={setP('phone')} /></label>
            <label style={label}>Office email<input style={input} value={particulars.email} onChange={setP('email')} /></label>
            <label style={label}>W-9 / EIN note<input style={input} value={particulars.w9} onChange={setP('w9')} placeholder="on request from the office" /></label>
          </div>
          <div hidden={inWindow && !particularsOpen && !pDirty} style={{ marginTop: 10 }}>
            <button type="button" onClick={() => void saveParticulars()} disabled={!pDirty || pSaving} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: pDirty ? 'var(--text-700)' : 'var(--bg-muted)', color: pDirty ? 'var(--surface)' : 'var(--text-muted)', fontSize: '0.86rem', cursor: pDirty ? 'pointer' : 'default' }}>
              {pSaving ? 'Saving…' : 'Save particulars'}
            </button>
          </div>
        </div>
      ) : null}
      {heldCounty ? (
        <LegalCountyHeldSheet county={heldCounty.county} holderName={firmNames.get(heldCounty.holderId) ?? 'another firm'} firmName={firmNames.get(heldCounty.firmId) ?? 'the firm'} onAnswer={answerHeldCounty} onCancel={() => setHeldCounty(null)} />
      ) : null}
    </div>
  )
}

/** The fold's door in the window: a link-styled press, `Edit details` · `Hide details`. */
const foldBtn = { padding: 0, background: 'none', border: 'none', color: 'var(--text-link)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' } as const

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
