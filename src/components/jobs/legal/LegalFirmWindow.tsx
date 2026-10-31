import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import LegalFirmSettingsBlock from '../../settings/LegalFirmSettingsBlock'
import LegalFirmCountyMap from '../../settings/LegalFirmCountyMap'
import LegalFirmReplacePanel from './LegalFirmReplacePanel'
import { legalFirmFacts, legalFirmFactsWords } from '../../../lib/legal/legalFirmFacts'
import { assignmentsFromCountiesByFirm, countyWords, firmHues, firmLegend } from '../../../lib/legal/firmCounties'
import { uncoveredWords, type LegalMapCase } from '../../../lib/legal/firmMap'
import { coverageCasesChip, coverageCountyChip, coverageHintWords, coverageNudgeButton, coverageNudgeWords, coverageState, coverageSumWords, firmWindowCoverage } from '../../../lib/legal/firmWindowCoverage'
import { formatLegalMoney } from '../../../lib/legal/legalPacket'
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
 * **Where <firm> covers** (`FirmCoverage`): the county map with this firm's counties in color and
 * the other firms' faint, a row per county with its cases and open dollars (the Map view's own
 * numbers), *Show on the desk map ›*, and, while no county is colored for any firm, the nudge that
 * names the bridge with *Color its counties…*. The details and Click's particulars fold to one
 * line each inside the Settings block.
 */
export default function LegalFirmWindow({ firm, matters, recipients, canEdit, onClose, onSaved, onShowAccount, zIndex, firms = [], countiesByFirm = null, cases = [], onShowOnMap, onColorCounties }: {
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
  /** Each firm's counties; null draws no coverage section (a mount without the desk's data). */
  countiesByFirm?: ReadonlyMap<string, ReadonlyArray<string>> | null
  /** The desk's cases on the map (`useLegalMapCases`), for the rows' counts and the dots. */
  cases?: ReadonlyArray<LegalMapCase>
  /** *Show on the desk map ›*: the desk opens its Map view with this firm lit. */
  onShowOnMap?: (firmId: string) => void
  /** *Color its counties…* under the nudge: the desk opens Firms… with this firm picked. A dev's door. */
  onColorCounties?: (firmId: string) => void
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
            {firm ? <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>the collections law firm</span> : null}
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
          {firm && countiesByFirm ? (
            <FirmCoverage key={`coverage-${firm.id}`} firm={firm} firms={firms} countiesByFirm={countiesByFirm} cases={cases} canEdit={canEdit} onShowOnMap={onShowOnMap} onColorCounties={onColorCounties} />
          ) : null}
          {canEdit ? (
            <div style={{ marginTop: countiesByFirm ? 16 : 0, paddingTop: countiesByFirm ? 14 : 0, borderTop: countiesByFirm ? '1px solid var(--border)' : undefined }}>
              {/* Keyed on the firm, so a replace remounts the block on the new one. */}
              <LegalFirmSettingsBlock key={firm?.id ?? 'none'} inWindow firmId={firm?.id ?? null} onSaved={onSaved} />
              {firm && facts ? <LegalFirmReplacePanel key={`replace-${firm.id}`} firm={firm} facts={facts} onReplaced={onSaved} onShowAccount={onShowAccount} counties={countiesByFirm?.get(firm.id) ?? []} /> : null}
            </div>
          ) : (
            <div style={{ marginTop: countiesByFirm ? 16 : 0 }}>
              <ReadOnlyFirm firm={firm} factsLine={factsLine} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Where the firm covers (punch list #222, PR 1, v2.6195): the county map in lens mode with this firm lit, one
 * row per county with the cases and open dollars that count for the firm (`firmWindowCoverage`, the Map
 * view's legend rule), the sum row, *Show on the desk map ›*, and in place of the map the nudge while no
 * county is colored for any firm, or the line that the firm covers none while others do. Everyone on the
 * desk reads it; only a dev gets *Color its counties…*.
 */
function FirmCoverage({ firm, firms, countiesByFirm, cases, canEdit, onShowOnMap, onColorCounties }: {
  firm: LegalFirmRow
  firms: ReadonlyArray<LegalFirmRow>
  countiesByFirm: ReadonlyMap<string, ReadonlyArray<string>>
  cases: ReadonlyArray<LegalMapCase>
  canEdit: boolean
  onShowOnMap?: (firmId: string) => void
  onColorCounties?: (firmId: string) => void
}) {
  const [county, setCounty] = useState<string | null>(null)
  const assignments = useMemo(() => assignmentsFromCountiesByFirm(countiesByFirm), [countiesByFirm])
  const hues = useMemo(() => firmHues(firms), [firms])
  const legend = useMemo(() => firmLegend(firms, assignments), [firms, assignments])
  const firmNames = useMemo(() => new Map(firms.map((f) => [f.id, f.name] as const)), [firms])
  const coverage = useMemo(() => firmWindowCoverage(firm.id, countiesByFirm, cases), [firm.id, countiesByFirm, cases])
  const state = coverageState(firm.id, countiesByFirm, firms.filter((f) => f.active).length)
  const nudge = coverageNudgeWords(firm.name, state)
  const flag = state.kind === 'covers' ? uncoveredWords(cases, assignments) : null
  const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '3px 6px', borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap' }
  const td: CSSProperties = { padding: '5px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
  const num: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  return (
    <section data-legal-firm-coverage={state.kind} style={{ marginTop: 2 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Where {firm.name} covers</h4>
        <span data-legal-firm-coverage-counties style={chip}>{coverageCountyChip(coverage.counties)}</span>
        <span data-legal-firm-coverage-cases style={chip}>{coverageCasesChip(coverage.cases, coverage.balance)}</span>
      </div>
      {nudge ? (
        <div data-legal-firm-nudge={state.kind} style={{ marginTop: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber-soft)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '10px 12px', fontSize: '0.84rem' }}>
          {nudge}
          {canEdit && onColorCounties ? (
            <div style={{ marginTop: 8 }}>
              <button type="button" onClick={() => onColorCounties(firm.id)} style={btnPrimary} data-legal-firm-color-counties>{coverageNudgeButton(firm.name)}</button>
            </div>
          ) : null}
        </div>
      ) : (
        <p style={{ margin: '2px 0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{coverageHintWords(firm.name)}</p>
      )}
      {state.kind === 'covers' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <LegalFirmCountyMap
              lens
              litFirmId={firm.id}
              assignments={assignments}
              hues={hues}
              firmNames={firmNames}
              legend={legend}
              pickedFirmId={null}
              cases={cases}
              heldCaseId={null}
              selectedCounty={county}
              onPress={setCounty}
              onHoverCounty={() => {}}
              onPressCase={(c) => setCounty(c.county)}
              idleWords={`${firm.name}’s counties in color, the other firms’ faint. Tap a county to hold it in the list.`}
            />
            {flag ? <div data-legal-firm-coverage-flag style={{ background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', marginTop: 8 }}>{flag}</div> : null}
          </div>
          <div style={{ minWidth: 0 }}>
            <table data-legal-firm-coverage-rows style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th style={th}>County</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cases</th>
                  <th style={{ ...th, textAlign: 'right' }}>Open</th>
                </tr>
              </thead>
              <tbody>
                {coverage.rows.map((r) => {
                  const held = county === r.county
                  return (
                    <tr key={r.county} data-legal-firm-coverage-row={r.county} data-held={held ? '1' : undefined} style={{ background: held ? 'var(--bg-subtle)' : undefined }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <button type="button" onClick={() => setCounty(held ? null : r.county)} aria-pressed={held} title={held ? 'Let go of the county' : `Hold ${countyWords(r.county)} on the map`} style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                          {countyWords(r.county)}
                        </button>
                      </td>
                      <td style={num}>{r.cases}</td>
                      <td style={{ ...num, color: r.cases ? undefined : 'var(--text-muted)' }}>{r.cases ? formatLegalMoney(r.balance) : '—'}</td>
                    </tr>
                  )
                })}
                <tr data-legal-firm-coverage-sum style={{ fontWeight: 600 }}>
                  <td style={{ ...td, borderBottom: 0 }}>{coverageSumWords(coverage)}</td>
                  <td style={{ ...num, borderBottom: 0 }}>{coverage.cases}</td>
                  <td style={{ ...num, borderBottom: 0, color: coverage.cases ? undefined : 'var(--text-muted)' }}>{coverage.cases ? formatLegalMoney(coverage.balance) : '—'}</td>
                </tr>
              </tbody>
            </table>
            {onShowOnMap ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => onShowOnMap(firm.id)} style={btn} data-legal-firm-show-on-map title="The desk’s Map view with this firm lit: its counties in color, the other firms’ faint">Show on the desk map ›</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
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

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary: CSSProperties = { ...btn, background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }
const chip: CSSProperties = { border: '1px solid var(--border)', borderRadius: 999, padding: '1px 9px', background: 'var(--bg-subtle)', color: 'var(--text)', fontSize: '0.8rem' }
