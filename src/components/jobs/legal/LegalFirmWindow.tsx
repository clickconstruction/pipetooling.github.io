import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import LegalFirmSettingsBlock from '../../settings/LegalFirmSettingsBlock'
import LegalFirmReplacePanel from './LegalFirmReplacePanel'
import LegalFirmCoverage from './LegalFirmCoverage'
import LegalFirmHandOffSheet from './LegalFirmHandOffSheet'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { legalFirmFacts, legalFirmFactsWords } from '../../../lib/legal/legalFirmFacts'
import type { LegalMapCase } from '../../../lib/legal/firmMap'
import type { Coverage } from '../../../lib/legal/firmCounties'
import { coveredBy, handOffErrorWords, retireHold, retireReadyWords } from '../../../lib/legal/firmHandOff'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import { legalIntakeAnswerRows, legalIntakeSentWords, legalIntakeUnseen, shapeLegalFirmIntake } from '../../../lib/legal/legalFirmIntake'
import { companyShortName } from '../../../lib/legal/legalPortalStart'
import { PORTAL_COMPANY } from '../../../../supabase/functions/_shared/portalCompany'
import { legalOfficeContactPrintLines, legalOfficeContactsGap, type LegalOfficeContacts } from '../../../lib/legal/legalOfficeContacts'
import { readLegalOfficeContacts } from '../../../lib/legal/legalOfficeContactsIo'
import type { LegalFirmRow, LegalMatterRow, LegalRecipientRow } from '../../../lib/legal/legalMatters'

const db = supabase as unknown as SupabaseClient

/** Where Settings keeps the firm: the Jobs & billing tab, at the block's anchor. */
export const LEGAL_FIRM_SETTINGS_HREF = '/settings?tab=settings-jobs#settings-legal-firm'

/**
 * The collections law firm, opened from its name in the Legal desk's header (v2.4711).
 * A window over the desk, so the account list keeps its place. A dev gets the Settings
 * block itself (`LegalFirmSettingsBlock inWindow`), so the two can never disagree, and a
 * save reloads the desk's firm (`onSaved`). Everyone else on the desk reads the firm
 * here: the database lets only a dev change it. Above the save, what hangs on the firm
 * now — its open accounts, its email list, its link — because a rename keeps all of it.
 * Under it, a dev's *Replace with a new firm…* (v2.4712, `LegalFirmReplacePanel`).
 *
 * Since v2.6195 (punch list #222, PR 1) the window is titled with the firm's name and opens on
 * **Where <firm> covers** (`LegalFirmCoverage`): the county map with this firm's counties in color and
 * the other firms' faint, a row per county with its cases and open dollars (the Map view's own
 * numbers), *Show on the desk map ›*, and, while no county is colored for any firm, the nudge that
 * names the bridge. Since v2.6221 (PR 2) a dev extends the firm's counties there, in place. The
 * details and Click's particulars fold to one line each inside the Settings block.
 */
export default function LegalFirmWindow({ firm, matters, recipients, canEdit, onClose, onSaved, onShowAccount, zIndex, firms = [], coverage = null, cases = [], onShowOnMap }: {
  firm: LegalFirmRow | null
  matters: ReadonlyArray<LegalMatterRow>
  recipients: ReadonlyArray<LegalRecipientRow>
  canEdit: boolean
  onClose: () => void
  onSaved: () => void
  /** Close the window and select an account on the desk (the replace panel's way to *Pull back*). */
  onShowAccount?: (payerKey: string) => void
  zIndex: number
  /** The active firms, as `useLegalMatters.activeFirms`, for the map's hues (punch list #222, PR 1). */
  firms?: ReadonlyArray<LegalFirmRow>
  /** county → first call and the firms that also cover it (v2.6227); null draws no coverage section (a mount without the desk's data). */
  coverage?: Coverage | null
  /** The desk's cases on the map (`useLegalMapCases`), for the rows' counts and the dots. */
  cases?: ReadonlyArray<LegalMapCase>
  /** *Show on the desk map ›*: the desk opens its Map view with this firm lit. */
  onShowOnMap?: (firmId: string) => void
}) {
  const [linkLive, setLinkLive] = useState<boolean | null>(null)
  const firmId = firm?.id ?? null

  useEffect(() => {
    if (!firmId) return
    let cancelled = false
    void db
      .from('legal_portal_links')
      .select('id')
      .eq('firm_id', firmId)
      .is('revoked_at', null)
      .limit(1)
      .then(({ data, error }) => {
        if (!cancelled) setLinkLive(error ? null : (data ?? []).length > 0)
      })
    return () => {
      cancelled = true
    }
  }, [firmId])

  // Esc closes this window and nothing under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Who the firm's page tells the firm to call (v2.4755), and the gap when it cannot name a controller.
  const [officeContacts, setOfficeContacts] = useState<LegalOfficeContacts | null>(null)
  useEffect(() => {
    let alive = true
    void readLegalOfficeContacts(db).then((c) => { if (alive) setOfficeContacts(c) })
    return () => { alive = false }
  }, [])
  const reachGap = officeContacts ? legalOfficeContactsGap(officeContacts) : null
  const reachLine = officeContacts ? (
    <div data-legal-firm-reach style={{ fontSize: '0.8rem', flexBasis: '100%' }}>
      <span style={{ color: 'var(--text-muted)' }}>The firm's page says to call: </span>
      {legalOfficeContactPrintLines(officeContacts).map((l) => l.replace(/^Reach the office: /, '')).join(' · ') || 'nobody — no office number'}
      {reachGap ? <div style={{ color: 'var(--text-amber-700)', marginTop: 2 }}>{reachGap} A phone goes on their person on Settings → People.</div> : null}
    </div>
  ) : null
  const facts = firm ? legalFirmFacts(firm.id, matters, recipients, linkLive) : null
  /** How many counties this firm covers, first call or not (v2.6233): hand-off and retire read it. */
  const countiesHeld = firm && coverage ? coveredBy(coverage, firm.id).length : 0
  const [handOffOpen, setHandOffOpen] = useState(false)
  const factsLine = facts ? (
    <div data-legal-firm-facts style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>On this firm now:</span>
      {legalFirmFactsWords(facts).map((w) => (
        <span key={w} style={chip}>{w}</span>
      ))}
      {reachLine}
    </div>
  ) : null

  return (
    <div role="presentation" onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      <div role="dialog" aria-modal="true" aria-label="The collections law firm" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, width: '100%', maxWidth: 760, maxHeight: '100%', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <span aria-hidden>⚖</span>
          <div style={{ flex: 1, fontWeight: 600, minWidth: 0 }} data-legal-firm-title>
            {firm ? firm.name : 'The collections law firm'}
            {firm ? <span style={{ display: 'block', fontWeight: 400, fontSize: '0.74rem', color: 'var(--text-muted)' }}>the collections law firm</span> : null}
          </div>
          {canEdit ? (
            <a href={LEGAL_FIRM_SETTINGS_HREF} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }} title="The same block on its Settings page, in a new tab">Open in Settings ↗</a>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close the firm window" style={{ ...btn, width: 30, height: 30, padding: 0, justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          {firm ? <FirmIntakeAnswers key={firm.id} firm={firm} onSeen={onSaved} /> : null}
          {/* The facts first for a dev (the block's details fold now, and the facts must not fold with them); the read-only view keeps them under its rows. */}
          {canEdit && factsLine ? <div style={{ marginBottom: 12 }}>{factsLine}</div> : null}
          {firm && coverage ? (
            <LegalFirmCoverage key={`coverage-${firm.id}`} firm={firm} firms={firms} coverage={coverage} cases={cases} canEdit={canEdit} onShowOnMap={onShowOnMap} onSaved={onSaved} onHandOff={canEdit && countiesHeld > 0 ? () => setHandOffOpen(true) : undefined} />
          ) : null}
          {canEdit ? (
            <div style={{ marginTop: coverage ? 16 : 0, paddingTop: coverage ? 14 : 0, borderTop: coverage ? '1px solid var(--border)' : undefined }}>
              {/* Keyed on the firm, so a replace remounts the block on the new one. */}
              <LegalFirmSettingsBlock key={firm?.id ?? 'none'} inWindow firmId={firm?.id ?? null} onSaved={onSaved} />
              {/* v2.6233 (punch list #222, PR 4): a firm that covers counties hands them off instead; Replace stays for the one that covers none (the bridge's stand-in). */}
              {firm && facts && countiesHeld === 0 ? <LegalFirmReplacePanel key={`replace-${firm.id}`} firm={firm} facts={facts} onReplaced={onSaved} onShowAccount={onShowAccount} /> : null}
              {firm && facts && coverage ? <RetireFirmRow key={`retire-${firm.id}`} firm={firm} countiesLeft={countiesHeld} liveMatters={facts.withFirm} otherFirms={firms.filter((f) => f.active && f.id !== firm.id).length} onRetired={onSaved} /> : null}
            </div>
          ) : (
            <div style={{ marginTop: coverage ? 16 : 0 }}>
              <ReadOnlyFirm firm={firm} factsLine={factsLine} />
            </div>
          )}
        </div>
      </div>
      {handOffOpen && firm && coverage && facts ? (
        <LegalFirmHandOffSheet firm={firm} firms={firms} coverage={coverage} cases={cases} liveMatters={facts.withFirm} zIndex={zIndex + 2} onCancel={() => setHandOffOpen(false)} onDone={() => { setHandOffOpen(false); onSaved() }} />
      ) : null}
    </div>
  )
}

/**
 * Retire this firm, the window's last section (punch list #222, PR 4, v2.6233): its own step, dead with its reason
 * while the firm covers a county, holds an account, or is the only firm that stands; ready, it asks once and
 * retires through `legal_retire_firm`. The link stops, the people stop getting emails, the history stays.
 */
function RetireFirmRow({ firm, countiesLeft, liveMatters, otherFirms, onRetired }: {
  firm: LegalFirmRow
  countiesLeft: number
  liveMatters: ReadonlyArray<{ payerName: string }>
  otherFirms: number
  onRetired: () => void
}) {
  const confirm = useConfirmDialog()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hold = retireHold(firm.name, countiesLeft, liveMatters, otherFirms)
  const press = async () => {
    if (hold || busy) return
    const yes = await confirm({ title: `Retire ${firm.name}`, message: retireReadyWords(firm.name), confirmLabel: `Retire ${firm.name}`, cancelLabel: 'Keep it', danger: true, cancelIsSafe: true })
    if (!yes) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: rpcError } = await db.rpc('legal_retire_firm', { p_firm_id: firm.id })
      if (rpcError) {
        setError(handOffErrorWords(rpcError))
        return
      }
      const answer = (data ?? {}) as { error?: string }
      if (answer.error) {
        setError(answer.error)
        return
      }
      showToast(`${firm.name} is retired. Its history stays.`, 'success')
      onRetired()
    } finally {
      setBusy(false)
    }
  }
  const dead = Boolean(hold) || busy
  return (
    <section data-legal-firm-retire={hold ? 'held' : 'ready'} style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
      <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Retire this firm</h4>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
        <button type="button" onClick={() => void press()} disabled={dead} style={dead ? { ...btn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: DEAD_PRESS_FILL, cursor: 'default' } : btn} data-legal-firm-retire-press>{busy ? 'Retiring…' : `Retire ${firm.name}`}</button>
        <span data-legal-firm-retire-why style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{hold ?? retireReadyWords(firm.name)}</span>
      </div>
      {error ? <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.84rem', margin: '8px 0 0' }}>{error}</p> : null}
    </section>
  )
}

/**
 * The firm's answers to Start here (v2.4821): each question with its answer, when and by whom. New
 * answers wear *New* and are stamped read on open (`legal_firm_intake_seen`), which takes the dot off
 * the desk's firm door once the desk reloads.
 */
function FirmIntakeAnswers({ firm, onSeen }: { firm: LegalFirmRow; onSeen: () => void }) {
  const [wasNew] = useState(() => legalIntakeUnseen(firm))
  useEffect(() => {
    if (!wasNew) return
    let cancelled = false
    void db.rpc('legal_firm_intake_seen', { p_firm_id: firm.id }).then(({ error }) => {
      // A training-mode user's stamp is refused; the dot stays for someone who can read it.
      if (!cancelled && !error) onSeen()
    })
    return () => {
      cancelled = true
    }
    // Once per open: the reload this triggers must not stamp again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const sent = legalIntakeSentWords(firm.intake_sent_at, firm.intake_sent_by)
  const rows = firm.intake_sent_at ? legalIntakeAnswerRows(shapeLegalFirmIntake(firm.intake), companyShortName(PORTAL_COMPANY.name)) : []
  return (
    <div data-legal-firm-intake={wasNew ? 'new' : sent ? 'read' : 'none'} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: '0.82rem' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.9rem' }}>Their answers to Start here</b>
        {wasNew ? <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0 7px', borderRadius: 999, background: '#9a5b2b', color: '#fff' }}>New</span> : null}
        <span style={{ color: 'var(--text-muted)' }}>{sent || 'Not answered yet. The firm answers on its portal, under Start here.'}</span>
      </div>
      {rows.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '4px 14px', marginTop: 8 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'contents' }}>
              <span style={{ color: 'var(--text-muted)' }}>{r.question}</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{r.answer}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** The office and masters on the desk: the firm as text, and who can change it. */
function ReadOnlyFirm({ firm, factsLine }: { firm: LegalFirmRow | null; factsLine: ReactNode }) {
  const rows: Array<[string, string]> = firm
    ? [
        ['Firm', firm.name],
        ['Handling person', firm.handling_name || '—'],
        ['Email', firm.email || '—'],
        ['Phone', firm.phone || '—'],
        ['Contingency %', String(firm.contingency_pct)],
        ['Filing cost ($)', String(firm.filing_cost)],
      ]
    : []
  return (
    <div data-legal-firm-readonly>
      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Who we release accounts to</h4>
      {firm ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 10 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {k}
              <div style={{ padding: '0.4rem 0.5rem', border: '1px dashed var(--border)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.9rem' }}>{v}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: '0.86rem', margin: '8px 0 0' }}>No collections law firm is set up yet.</p>
      )}
      {factsLine ? <div style={{ marginTop: 12 }}>{factsLine}</div> : null}
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '12px 0 0' }}>Only a dev can change the firm. Ask a dev to update it.</p>
    </div>
  )
}

// Longhands: Retire flips between its dead and live styles, and React drops a border shorthand under a changing borderColor.
const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const chip: CSSProperties = { border: '1px solid var(--border)', borderRadius: 999, padding: '1px 9px', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.8rem' }
