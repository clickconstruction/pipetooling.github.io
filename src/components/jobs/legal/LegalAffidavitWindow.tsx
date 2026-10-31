import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'
import {
  AFFIDAVIT_FORMS, FORM_HELP_WORDS, STATEMENT_BODY_MAX,
  defaultStatementForm, defaultVenueCounty, incidentSpanWords, recordCheckHeading, statementChipWords, statementDraftProblem, statementFaceWords, statementMetaOf, statementOpener, statementShortDay, suggestedStatementTitle, venueChoices,
  STATEMENT_FACES,
  type AffiantKind, type AffidavitForm, type DeclarantDetails, type StatementAffiant, type StatementDraft, type StatementFace, type StatementMeta,
} from '../../../lib/legal/affidavitPaper'
import { statementPrintRecordText } from '../../../lib/legal/statementPrint'
import LegalStatementPrintSheet from './LegalStatementPrintSheet'
import { rosterForPick, rosterRoleLine, type RosterUser } from '../../../lib/legal/statementRoster'
import { useStatementRecordCheck } from './useStatementRecordCheck'
import { btn, btnPrimary, MUTED, pill } from './legalDeskShared'

/**
 * Swear a statement (punch list #220, v2.6210): one window on the Legal desk that drafts an affidavit or an unsworn
 * declaration — who swears it, the day it is about, how it is signed, the county on the venue line, the paragraphs —
 * and saves it to the Timeline's Said lane as a draft. Beside the statement, what the record says about those days,
 * so a date is caught before anyone swears to it. The print faces (PR 4) and filing the signed copy (PR 5) join here.
 *
 * The office has notaries on staff and signs everything in person (the owner, 2026-10-30), so every affiant defaults
 * to *Before a notary*; the venue line defaults to the office's county (Guadalupe, a setting), with *Leave it blank
 * for the notary* one press away. A witness is typed, not picked; a team member comes from the roster with the RMP
 * first and the role line filled in.
 *
 * A click on the dim closes the window only while nothing has been typed: a statement is pages, and a slip of the
 * hand must never lose it. ✕ and Cancel ask first once the draft has words.
 */
export type LegalAffidavitWindowProps = {
  /** The statement being changed, or null for a new one. */
  entry: LegalEntryRow | null
  /** The day the composer was on when it opened the window (a new statement). */
  initialOn?: string | null
  account: { payerName: string; jobs: ReadonlyArray<{ id: string; label: string }>; propertyCounty: string | null }
  roster: ReadonlyArray<RosterUser>
  officeCounty: string
  todayYmd: string
  busy: boolean
  /** Save the draft; the entry's id when it saved (a new one's from the database), null when it did not (the desk toasts and reloads). */
  onSave: (draft: StatementDraft, entryId: string | null) => Promise<string | null>
  /** Note a print on the row (v2.6211, `legal_statement_print`): which face, and the text as printed. */
  onPrint?: (entryId: string, face: StatementFace, text: string) => Promise<boolean>
  /** The declarant's details for this statement, held by the desk for the session, never saved (v2.6211). */
  declarant?: DeclarantDetails | null
  onDeclarant?: (entryId: string, details: DeclarantDetails) => void
  /** Open on the print sheet, on this face (a row's Print). */
  initialPrint?: StatementFace | null
  onClose: () => void
  zIndex: number
  /** Opens the Timeline's row (an edit window's door back). */
  onShowTimeline?: () => void
}

const WITNESS = '__witness'
const label: CSSProperties = { display: 'grid', gap: 3, fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }
const input: CSSProperties = { font: 'inherit', fontSize: '0.86rem', padding: '6px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', minWidth: 0, width: '100%', fontWeight: 400 }
const help: CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400, lineHeight: 1.4 }
const segOn: CSSProperties = { background: 'var(--text-700)', color: 'var(--surface)', borderColor: 'var(--text-700)' }

function draftFromEntry(e: LegalEntryRow, meta: StatementMeta): StatementDraft {
  return { title: meta.title, affiant: meta.affiant, incidentOn: e.occurred_on, incidentTo: meta.incidentTo ?? '', form: meta.form, venueCounty: meta.venueCounty ?? '', body: e.body }
}

export default function LegalAffidavitWindow({ entry, initialOn = null, account, roster, officeCounty, todayYmd, busy, onSave, onPrint, declarant = null, onDeclarant, initialPrint = null, onClose, zIndex, onShowTimeline }: LegalAffidavitWindowProps) {
  const isMobile = useIsMobile()
  const meta = useMemo(() => (entry ? statementMetaOf(entry.meta) : null), [entry])
  const picks = useMemo(() => rosterForPick(roster), [roster])
  const fresh = (): StatementDraft => {
    const form = defaultStatementForm('team')
    return { title: '', affiant: { kind: 'team', userId: null, name: '', role: '' }, incidentOn: initialOn && initialOn <= todayYmd ? initialOn : todayYmd, incidentTo: '', form, venueCounty: defaultVenueCounty({ officeCounty, propertyCounty: account.propertyCounty, form }), body: '' }
  }
  const [draft, setDraft] = useState<StatementDraft>(() => (entry && meta ? draftFromEntry(entry, meta) : fresh()))
  // The title and the county follow the picks until the person types their own.
  const [titleTouched, setTitleTouched] = useState(Boolean(entry))
  const [countyTouched, setCountyTouched] = useState(Boolean(entry))
  const [roleTouched, setRoleTouched] = useState(Boolean(entry))
  const [touched, setTouched] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  // v2.6211: the print sheet, open on a face; the id a new statement got when Print saved it first.
  const [sheet, setSheet] = useState<StatementFace | null>(entry && initialPrint ? initialPrint : null)
  const [facesOpen, setFacesOpen] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(entry?.id ?? null)
  useEffect(() => {
    if (entry && meta) setDraft(draftFromEntry(entry, meta))
    // A new entry opens on its own words; the fresh draft is built once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id])

  const dirty = entry && meta ? JSON.stringify(draft) !== JSON.stringify(draftFromEntry(entry, meta)) : Boolean(draft.body.trim() || draft.title.trim() || draft.affiant.name.trim())
  const problem = statementDraftProblem(draft, todayYmd)
  const counties = venueChoices({ officeCounty, propertyCounty: account.propertyCounty, form: draft.form })
  const countyNote = counties.find((c) => c.value === draft.venueCounty)?.note ?? counties[counties.length - 1]!.note
  const opener = statementOpener(draft.affiant, draft.form)
  const signed = meta?.state === 'signed'
  const check = useStatementRecordCheck({ jobs: account.jobs, incidentOn: draft.incidentOn, incidentTo: draft.incidentTo, affiant: draft.affiant, users: roster, enabled: !signed })

  const setAffiant = (a: StatementAffiant) => setDraft((d) => {
    const form = d.form
    const next: StatementDraft = { ...d, affiant: a }
    if (!titleTouched) next.title = suggestedStatementTitle(a, form)
    return next
  })
  const pickTeam = (value: string) => {
    if (value === WITNESS) {
      setRoleTouched(false)
      setAffiant({ kind: 'witness', userId: null, name: '', role: '' })
      return
    }
    const u = picks.find((p) => p.id === value)
    if (!u) {
      setAffiant({ kind: 'team', userId: null, name: '', role: '' })
      return
    }
    setRoleTouched(false)
    setAffiant({ kind: 'team', userId: u.id, name: (u.name ?? '').trim(), role: rosterRoleLine(u) })
  }
  const setForm = (form: AffidavitForm) => setDraft((d) => {
    const next: StatementDraft = { ...d, form }
    if (!countyTouched) next.venueCounty = defaultVenueCounty({ officeCounty, propertyCounty: account.propertyCounty, form })
    if (!titleTouched) next.title = suggestedStatementTitle(d.affiant, form)
    return next
  })
  const trimmed = (): StatementDraft => ({ ...draft, title: draft.title.trim(), body: draft.body.trim(), affiant: { ...draft.affiant, name: draft.affiant.name.trim(), role: draft.affiant.role.trim() } })
  const save = async () => {
    setTouched(true)
    if (problem) return
    const id = await onSave(trimmed(), entry?.id ?? savedId)
    if (id) onClose()
  }
  /** Print ▾ (v2.6211): a new or changed draft is saved first, so the paper and the row agree; then the sheet opens on the face. */
  const openPrint = async (face: StatementFace) => {
    setFacesOpen(false)
    let id = entry?.id ?? savedId
    if (!id || dirty) {
      setTouched(true)
      if (problem) return
      id = await onSave(trimmed(), id)
      if (!id) return
      setSavedId(id)
    }
    setSheet(face)
  }
  const printed = async (face: StatementFace) => {
    const id = entry?.id ?? savedId
    if (id && onPrint) await onPrint(id, face, statementPrintRecordText(trimmed(), face))
  }
  const close = () => {
    if (dirty && !confirmClose) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  const kindOf: AffiantKind = draft.affiant.kind
  const pickValue = kindOf === 'witness' ? WITNESS : (draft.affiant.userId ?? '')
  const chip = meta ? statementChipWords(meta, calendarYmdInAppTzFromIso) : 'draft · not signed'
  const spanWords = /^\d{4}-\d{2}-\d{2}$/.test(draft.incidentOn) ? incidentSpanWords(draft.incidentOn, draft.incidentTo || null) : 'the day it is about'
  const accountWords = `${account.payerName}${account.jobs.length ? ` · job${account.jobs.length === 1 ? '' : 's'} ${account.jobs.map((j) => j.label).filter(Boolean).join(', ')}` : ''}`

  return (
    <div role="presentation" data-legal-affidavit-backdrop onClick={(e) => { e.stopPropagation(); if (!dirty) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(14px + var(--app-top-chrome, 0px)) 14px 14px' }}>
      <div role="dialog" aria-modal="true" aria-label={entry ? 'Change the statement' : 'Swear a statement'} data-legal-affidavit-window onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: isMobile ? 0 : 12, width: '100%', maxWidth: isMobile ? 'none' : 1040, maxHeight: '100%', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.28)', display: 'grid', gridTemplateRows: 'auto 1fr auto', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{entry ? 'The statement' : 'Swear a statement'}</h3>
          <span data-legal-affidavit-account style={{ ...MUTED, fontSize: '0.78rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 160px' }}>{accountWords}</span>
          <span data-legal-affidavit-chip>{pill(chip, signed ? 'ok' : meta && meta.prints.length ? 'warn' : 'neutral')}</span>
          <button type="button" aria-label="Close" onClick={close} style={{ ...btn, minWidth: 30, justifyContent: 'center' }}>✕</button>
        </div>
        {sheet ? (
          <div style={{ padding: '12px 16px', minWidth: 0 }}>
            <LegalStatementPrintSheet draft={trimmed()} face={sheet} onFace={setSheet} accountWords={accountWords} declarant={declarant} onDeclarant={(d) => { const id = entry?.id ?? savedId; if (id) onDeclarant?.(id, d) }} onPrinted={printed} onBack={() => setSheet(null)} busy={busy} />
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 18, padding: '12px 16px', minWidth: 0, alignContent: 'start' }}>
          <div style={{ display: 'grid', gap: 12, minWidth: 0, alignContent: 'start' }}>
            <label style={label}>
              Title
              <input aria-label="Title" value={draft.title} onChange={(e) => { setTitleTouched(true); setDraft({ ...draft, title: e.target.value }) }} placeholder="Affidavit of …" disabled={signed} style={input} />
              <span style={help}>Reads on the paper, the Timeline and the Evidence row.</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, minWidth: 0 }}>
              <label style={label}>
                Who swears it
                <select aria-label="Who swears it" value={pickValue} onChange={(e) => pickTeam(e.target.value)} disabled={signed} style={input}>
                  <option value="">Pick one of our team</option>
                  {picks.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role === 'master_technician' ? ' · RMP' : ''}</option>)}
                  <option value={WITNESS}>Someone else, a witness…</option>
                </select>
                <span style={help}>One of our team from the roster, or a witness you type.</span>
              </label>
              {kindOf === 'witness' ? (
                <label style={label}>
                  The witness’s name
                  <input aria-label="The witness’s name" value={draft.affiant.name} onChange={(e) => setAffiant({ ...draft.affiant, name: e.target.value })} placeholder="Thanh Nguyen" disabled={signed} style={input} />
                  <span style={help}>As it will read on the paper.</span>
                </label>
              ) : null}
            </div>
            <label style={label}>
              Their role, one line
              <input aria-label="Their role, one line" value={draft.affiant.role} onChange={(e) => { setRoleTouched(true); setAffiant({ ...draft.affiant, role: e.target.value }) }} placeholder={kindOf === 'witness' ? 'the foreman for Brightline Electric, the electrical subcontractor on the job' : 'Responsible Master Plumber of record for Click Plumbing and Electrical, License No. …'} disabled={signed} style={input} />
              <span style={help}>{kindOf === 'witness' ? 'Who they are and why they were there. The paper adds that they have no stake.' : roleTouched ? 'Edited. The paper reads it as typed.' : 'Prefilled from the roster. Edit it.'}</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'auto auto minmax(0, 1fr)', gap: 10, alignItems: 'end', minWidth: 0 }}>
              <label style={label}>
                The day it is about
                <input type="date" aria-label="The day it is about" value={draft.incidentOn} max={todayYmd} onChange={(e) => setDraft({ ...draft, incidentOn: e.target.value })} disabled={signed} style={input} />
              </label>
              <label style={label}>
                to
                <input type="date" aria-label="The last day of the span" value={draft.incidentTo} min={draft.incidentOn || undefined} max={todayYmd} onChange={(e) => setDraft({ ...draft, incidentTo: e.target.value })} disabled={signed} style={input} />
              </label>
              <span style={{ ...help, alignSelf: 'end', paddingBottom: 6 }}>Where the statement sits on the Timeline. The signing day is not typed here. The notary writes it on the paper and you read it off the scan.</span>
            </div>
            <div style={label}>
              How it is signed
              <div role="group" aria-label="How it is signed" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AFFIDAVIT_FORMS.map((f) => <button key={f.form} type="button" aria-pressed={draft.form === f.form} data-legal-affidavit-form={f.form} disabled={signed} onClick={() => setForm(f.form)} style={{ ...btn, height: 28, ...(draft.form === f.form ? segOn : null) }}>{f.label}</button>)}
              </div>
              <span style={help}>{FORM_HELP_WORDS}</span>
            </div>
            <div style={label}>
              Signed in
              <div role="group" aria-label="Signed in" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {counties.map((c) => <button key={c.value || 'blank'} type="button" aria-pressed={draft.venueCounty === c.value} data-legal-affidavit-county={c.value || 'blank'} disabled={signed} onClick={() => { setCountyTouched(true); setDraft({ ...draft, venueCounty: c.value }) }} style={{ ...btn, height: 28, ...(draft.venueCounty === c.value ? segOn : null) }}>{c.words}</button>)}
              </div>
              <span style={help}>{countyNote}</span>
            </div>
            <div style={label}>
              The statement
              <div data-legal-affidavit-opener style={{ fontSize: '0.84rem', lineHeight: 1.5, padding: '8px 10px', border: '1px dashed var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text)', fontWeight: 400 }}>
                <span style={{ ...MUTED, marginRight: 6 }}>1.</span>{opener}
              </div>
              <textarea aria-label="The statement" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={isMobile ? 9 : 12} maxLength={STATEMENT_BODY_MAX} disabled={signed} placeholder={'2. I am the plumber in charge of the rough-in at …\n3. On September 3, 2026, at about 7:40 in the morning, …'} style={{ ...input, resize: 'vertical', lineHeight: 1.5, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '0.92rem' }} />
              <span style={help}>Paragraph 1 is written for you. It changes for a witness and for the declaration. Everything else is yours. One paragraph per line. The paper numbers them.</span>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
            <div data-legal-affidavit-record-check style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 6, minWidth: 0 }}>
              <b style={{ fontSize: '0.8rem' }}>{recordCheckHeading(draft.incidentOn, draft.incidentTo || null)}</b>
              {check.loading ? <span style={{ ...MUTED, fontSize: '0.78rem' }}>Reading the clock, the reports and the job thread…</span> : null}
              {!check.loading && check.lines.length === 0 ? <span style={{ ...MUTED, fontSize: '0.78rem' }}>Pick the day it is about and the record for those days lists here.</span> : null}
              {check.lines.map((l, i) => (
                <div key={`${l.ymd}-${i}`} data-legal-record-line={l.kind} data-theirs={l.theirs ? 'yes' : 'no'} style={{ display: 'grid', gridTemplateColumns: '3.2rem minmax(0, 1fr)', gap: 8, fontSize: '0.78rem', lineHeight: 1.4, color: l.text.startsWith('Nothing recorded') ? 'var(--text-amber-700)' : 'var(--text)', fontWeight: l.theirs ? 600 : 400 }}>
                  <span style={{ ...MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{statementShortDay(l.ymd)}</span>
                  <span style={{ overflowWrap: 'anywhere' }}>{l.text}</span>
                </div>
              ))}
              {check.failed.length ? <span role="status" style={{ fontSize: '0.76rem', color: 'var(--text-amber-700)' }}>Could not read {check.failed.join('; ')}. The days may not be as clean as they look.</span> : null}
              <span style={help}>From the account’s clock sessions, field reports and job thread in the span, the affiant’s own first. Nothing here goes on the paper. It is a check, so a date is caught before anyone swears to it.</span>
            </div>
            <div data-legal-affidavit-prints style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 4 }}>
              <b style={{ fontSize: '0.8rem' }}>Prints of this draft</b>
              {!meta || meta.prints.length === 0 ? <span style={{ ...MUTED, fontSize: '0.78rem' }}>None yet. Each print adds a line here: when, by whom, which face.</span> : meta.prints.map((p, i) => (
                <div key={`${p.at}-${i}`} style={{ fontSize: '0.78rem', display: 'flex', gap: 8 }}>
                  <span style={{ ...MUTED, whiteSpace: 'nowrap' }}>{p.at ? statementShortDay(calendarYmdInAppTzFromIso(p.at)) : ''}</span>
                  <span>{statementFaceWords(p.face)}{p.by ? ` · ${roster.find((u) => u.id === p.by)?.name ?? 'the office'}` : ''}</span>
                </div>
              ))}
            </div>
            {signed ? <span style={{ ...MUTED, fontSize: '0.78rem' }}>The signed copy is filed. The sworn text cannot change. Swear a new statement for anything more.</span> : null}
          </div>
        </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px 14px', borderTop: '1px solid var(--border)' }}>
          {!signed && !sheet ? <button type="button" data-legal-affidavit-save disabled={busy || Boolean(problem)} title={problem ?? undefined} onClick={() => void save()} style={{ ...btnPrimary, opacity: busy || problem ? 0.6 : 1 }}>{entry ? 'Save the statement' : 'Save the draft'}</button> : null}
          {!sheet ? (
            // v2.6211: Print prints the whole paper as the draft is set; ▾ offers the three faces. A new or changed draft saves first.
            <span style={{ display: 'inline-flex', position: 'relative' }}>
              <button type="button" data-legal-affidavit-print disabled={busy || (!signed && Boolean(problem))} title={!signed && problem ? problem : 'The whole paper, as the draft is set'} onClick={() => void openPrint('whole')} style={{ ...btn, borderTopRightRadius: 0, borderBottomRightRadius: 0, opacity: !signed && problem ? 0.6 : 1 }}>Print</button>
              <button type="button" aria-label="Which face to print" aria-haspopup="menu" aria-expanded={facesOpen} data-legal-affidavit-print-faces disabled={busy || (!signed && Boolean(problem))} onClick={() => setFacesOpen((o) => !o)} style={{ ...btn, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0, minWidth: 26, justifyContent: 'center', opacity: !signed && problem ? 0.6 : 1 }}>▾</button>
              {facesOpen ? (
                <div role="menu" data-legal-affidavit-faces-menu style={{ position: 'absolute', left: 0, bottom: '100%', zIndex: 5, marginBottom: 4, minWidth: 240, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 4, display: 'grid' }}>
                  {STATEMENT_FACES.map((f) => <button key={f.face} type="button" role="menuitem" onClick={() => void openPrint(f.face)} style={{ ...btn, border: 'none', justifyContent: 'flex-start', height: 28, borderRadius: 6 }}>{f.label}</button>)}
                </div>
              ) : null}
            </span>
          ) : null}
          {!sheet ? <button type="button" onClick={close} style={btn}>{signed ? 'Close' : 'Cancel'}</button> : <button type="button" onClick={onClose} style={btn}>Close</button>}
          {entry && onShowTimeline ? <button type="button" onClick={() => { onShowTimeline(); onClose() }} style={btn}>The statement on the Timeline ↗</button> : null}
          {confirmClose ? (
            <span role="alert" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.8rem' }}>
              Leave without saving?
              <button type="button" onClick={onClose} style={{ ...btn, color: 'var(--text-red-700)' }}>Leave it</button>
              <button type="button" onClick={() => setConfirmClose(false)} style={btn}>Keep typing</button>
            </span>
          ) : touched && problem ? <span role="alert" style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{problem}</span> : !signed && !sheet ? <span style={{ ...MUTED, fontSize: '0.78rem' }}>{entry ? 'Saves the change. Each print after this keeps the new text.' : `Saves to the Timeline’s Said lane on ${spanWords} as a draft. The firm reads it as a draft.`}</span> : null}
        </div>
      </div>
    </div>
  )
}
