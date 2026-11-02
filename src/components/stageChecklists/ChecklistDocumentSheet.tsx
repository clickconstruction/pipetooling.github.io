import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { SignatureTypeOrDrawInput, type SignatureTypeOrDrawHandle } from '../contracts/SignatureTypeOrDrawInput'
import { AGREED_LINE, answerOwes, checklistProgress, filedFootWords, PICK_GLYPH, PICK_WORDS, progressWords, recordId, signingWords, stampWords, type ChecklistItem, type ChecklistPick, type ChecklistSignature, type ChecklistSkip, type ChecklistVoided, type ChecklistWho, type StageChecklistKind } from '../../lib/jobs/checklistDocument'
import type { ChecklistDocumentsApi, FiledRecord } from '../../hooks/useChecklistDocuments'

/**
 * The phone's checklist sheet as the card's second pass describes it (design
 * spike, punch list #237): while the list is open, one row open at a time — a
 * progress line under the title, a strip of the job's stages to move between,
 * the next unanswered item as the one big row with its three presses and its
 * chips, every other row a statement with who asked it, its stamp, the ink
 * where it was signed and a thumbnail where there is a photo. A signature item
 * opens the signature sheet in place with the gravity words and the agreed
 * line; a signed No takes the note first. Taking a signed answer back needs a
 * reason and keeps the voided mark. Once every row is answered the stage files
 * itself and the sheet reads as paper, with what filing did on its foot.
 */
export type SheetStage = { fixtureId: string; name: string; kind: StageChecklistKind }
type Props = {
  jobLabel: string
  stage: SheetStage
  /** The job's stages, for the strip under the title; tapping one switches the sheet. */
  stages: SheetStage[]
  onSwitch: (stage: SheetStage) => void
  /** The job's Plans folder, the door a sheet chip opens. */
  plansUrl: string | null
  who: ChecklistWho
  canAdd: boolean
  api: ChecklistDocumentsApi
  onClose: () => void
}

const PICK_ON: Record<ChecklistPick, CSSProperties> = {
  yes: { background: 'var(--bg-green-tint)', borderColor: '#16a34a', color: 'var(--text-green-800)' },
  no: { background: 'var(--bg-red-tint)', borderColor: '#dc2626', color: 'var(--text-red-700)' },
  not_here: { background: 'var(--bg-subtle)', borderColor: 'var(--border-strong)', color: 'var(--text-700)' },
}
const press: CSSProperties = { minHeight: 44, flex: 1, borderRadius: 10, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }
const primary = (on: boolean): CSSProperties => ({ ...press, flex: 'none', padding: '0 0.9rem', minHeight: 40, background: on ? '#2563eb' : 'var(--bg-subtle)', color: on ? '#fff' : 'var(--text-muted)', borderColor: on ? '#2563eb' : 'var(--border)' })
const chip = (tone: 'amber' | 'blue' | 'red'): CSSProperties => ({ display: 'inline-block', padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: tone === 'amber' ? 'var(--bg-amber-tint)' : tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-blue-100)', color: tone === 'amber' ? 'var(--text-amber-800)' : tone === 'red' ? 'var(--text-red-700)' : 'var(--text-blue-700)', whiteSpace: 'nowrap', textDecoration: 'none' })
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }
const field: CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, font: 'inherit', fontSize: '0.9rem' }
const statement: CSSProperties = { display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: '0.25rem 0.5rem', padding: '0.55rem 0', borderTop: '1px solid var(--border)', fontSize: '0.9rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem' }

/** The 📐 chip: a door to the job's Plans folder when there is one, words otherwise. */
export function SheetChip({ sheet, plansUrl }: { sheet: string; plansUrl: string | null }) {
  return plansUrl ? (
    <a href={plansUrl} target="_blank" rel="noreferrer" style={chip('blue')} title="Opens the job's Plans folder">📐 {sheet} ↗</a>
  ) : (
    <span style={chip('blue')} title="The plan sheet this check comes from">📐 {sheet}</span>
  )
}

function Adder({ item }: { item: ChecklistItem }) {
  if (item.scope !== 'job') return <span style={muted}>the company's check</span>
  return <span style={muted}>asked by {item.addedBy || 'someone'}{item.why ? ` · ${item.why}` : ''}</span>
}

export function ChecklistDocumentSheet({ jobLabel, stage, stages, onSwitch, plansUrl, who, canAdd, api, onClose }: Props) {
  const items = api.stageItems(stage.kind, stage.fixtureId)
  const answers = api.stageAnswers(stage.fixtureId)
  const voided = api.stageVoided(stage.fixtureId)
  const state = api.stageState(stage.fixtureId)
  const progress = checklistProgress(items, answers)
  const [signing, setSigning] = useState<{ item: ChecklistItem; pick: ChecklistPick } | null>(null)
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [reopen, setReopen] = useState<string | null>(null)
  const [reason, setReason] = useState<{ itemId: string; kind: 'back' | 'off' | 'skip' } | null>(null)
  const skipped = api.stageSkipped(stage.kind, stage.fixtureId)
  const companyCount = items.filter((i) => i.scope === 'company').length
  const jobCount = items.length - companyCount
  const groupHeading = (words: string, count: number) => (
    <div style={{ ...muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem', marginTop: '0.3rem' }}>{words} · {count}</div>
  )
  const [adding, setAdding] = useState(false)
  const [filedNow, setFiledNow] = useState<FiledRecord | null>(null)

  useEffect(() => {
    setSigning(null)
    setReopen(null)
    setReason(null)
  }, [stage.fixtureId])

  // Files itself at the last answer.
  useEffect(() => {
    if (progress.complete && state.open) {
      const r = api.fileIfComplete(stage.fixtureId, stage.kind)
      if (r) setFiledNow(r)
    }
  }, [progress.complete, state.open, api, stage.fixtureId, stage.kind])

  const pickOn = (item: ChecklistItem, pick: ChecklistPick) => {
    if (item.needsSignature) {
      setSigning({ item, pick })
      return
    }
    api.answer(stage.fixtureId, item.id, pick, who)
    setReopen(null)
  }

  const strip = (
    <div data-testid="checklist-stage-strip" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
      {stages.map((s) => {
        const p = checklistProgress(api.stageItems(s.kind, s.fixtureId), api.stageAnswers(s.fixtureId))
        const st = api.stageState(s.fixtureId)
        const on = s.fixtureId === stage.fixtureId
        return (
          <button key={s.fixtureId} type="button" onClick={() => onSwitch(s)} aria-pressed={on} style={{ flex: 'none', borderRadius: 999, border: `1.5px solid ${on ? 'var(--text-strong)' : 'var(--border)'}`, background: on ? 'var(--text-strong)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text-700)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', cursor: 'pointer' }}>
            {s.name} · {st.filed ? 'filed' : p.asked === 0 ? 'no list' : `${p.answered} of ${p.asked}`}
          </button>
        )
      })}
    </div>
  )

  if (state.filed) return <FiledPaper jobLabel={jobLabel} stage={stage} strip={strip} record={state.filed} justNow={filedNow?.recordNo === state.filed.recordNo} onClose={onClose} />

  const openId = reopen ?? progress.next?.id ?? null
  const foot = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
      <span style={muted}>{progress.complete ? 'Every row answered.' : 'Every press saves by itself.'}</span>
      <button type="button" onClick={onClose} style={{ ...press, flex: 'none', padding: '0 1rem', minHeight: 40 }}>Close</button>
    </div>
  )

  return (
    <ResponsiveModalShell title={`${stage.name} checklist`} onRequestClose={onClose} footer={foot} maxWidthDesktop={520} zIndex={1150}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {strip}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>{progressWords(progress)}</span>
            <span>{jobLabel}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginTop: 4 }} aria-hidden>
            <i style={{ display: 'block', height: 6, width: `${progress.asked ? (progress.answered / progress.asked) * 100 : 0}%`, background: '#16a34a' }} />
          </div>
        </div>
        {items.length === 0 ? <p style={{ ...muted, margin: '0.5rem 0' }}>No checks on this stage yet. {canAdd ? 'Add the first one below.' : 'The office or the superintendent adds them.'}</p> : null}
        {items.map((item, idx) => {
          const a = answers.get(item.id)
          const owes = answerOwes(item, a)
          const isOpen = item.id === openId
          const itemVoided = voided.filter((v) => v.answer.itemId === item.id)
          const heading = idx === 0 && item.scope === 'company' ? groupHeading(`The company's ${stage.name} checks`, companyCount) : idx === companyCount && item.scope === 'job' ? groupHeading('Added for this job', jobCount) : null
          const skippedLines = idx === companyCount - 1 && skipped.length ? <SkippedLines rows={skipped} canAdd={canAdd} onPutBack={(id) => api.unskipItem(id, stage.fixtureId)} /> : null
          const wrap = (node: ReactNode) => (
            <div key={item.id} style={{ display: 'grid', gap: '0.5rem' }}>
              {heading}
              {node}
              {skippedLines}
            </div>
          )
          if (signing && signing.item.id === item.id) {
            return wrap(<SigningPanel key={item.id} jobLabel={jobLabel} stageName={stage.name} item={signing.item} pick={signing.pick} who={who} onCancel={() => setSigning(null)} onSigned={(sig, note) => { api.answer(stage.fixtureId, item.id, signing.pick, who, sig, note); setSigning(null); setReopen(null) }} />)
          }
          if (isOpen) {
            const asking = reason?.itemId === item.id ? reason.kind : null
            return wrap(
              <div data-testid="checklist-next" style={{ border: '1.5px solid var(--border-strong)', borderRadius: 12, padding: '0.7rem 0.75rem', display: 'grid', gap: '0.55rem', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={chip('blue')}>{a ? 'Open' : 'Next'}</span>
                  {item.needsSignature ? <span style={chip('amber')}>needs a signature</span> : null}
                  {item.asksPhoto ? <span style={chip('amber')}>photo</span> : null}
                  {item.sheet ? <SheetChip sheet={item.sheet} plansUrl={plansUrl} /> : null}
                  <Adder item={item} />
                </div>
                <div style={{ fontSize: '1.02rem', fontWeight: 600, lineHeight: 1.35 }}>{idx + 1}. {item.words}</div>
                {asking ? (
                  <ReasonBox
                    words={asking === 'back' ? (a?.signature ? 'Taking a signed answer back keeps the mark on the record. Say why.' : 'Say why, for the record.') : asking === 'skip' ? `Skipping it here leaves the company's ${stage.name} list whole; the record says it was not on this job. Say why.` : 'Taking this check off keeps its answer on the record. Say why.'}
                    confirmLabel={asking === 'back' ? 'Take it back' : asking === 'skip' ? 'Skip on this job' : 'Take it off'}
                    onConfirm={(why) => {
                      if (asking === 'back') api.takeBack(stage.fixtureId, item.id, who, why)
                      else if (asking === 'skip') api.skipItem(item.id, stage.fixtureId, who, why)
                      else api.retireItem(item.id, item.fixtureId, who, why)
                      setReason(null)
                      setReopen(null)
                    }}
                    onCancel={() => setReason(null)}
                  />
                ) : a && owes.length > 0 ? (
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <div style={{ fontSize: '0.85rem' }}>{PICK_GLYPH[a.pick]} {PICK_WORDS[a.pick]} · {stampWords(a.by, a.at)}{a.signature ? ' · signed' : ''}</div>
                    {owes.includes('photo') ? <button type="button" style={{ ...press, flex: 'none' }} onClick={() => api.markPhoto(stage.fixtureId, item.id)}>📷 Take the photo</button> : null}
                    <button type="button" style={link} onClick={() => setReason({ itemId: item.id, kind: 'back' })}>Take it back</button>
                  </div>
                ) : a?.signature ? (
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <div style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>{PICK_GLYPH[a.pick]} {PICK_WORDS[a.pick]} · {stampWords(a.by, a.at)} <Ink sig={a.signature} /></div>
                    <span style={muted}>A signed answer does not change in place. Take it back with a reason and answer again.</span>
                    <button type="button" style={{ ...link, justifySelf: 'start' }} onClick={() => setReason({ itemId: item.id, kind: 'back' })}>Take it back</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {(['yes', 'no', 'not_here'] as const).map((p) => (
                      <button key={p} type="button" style={{ ...press, ...(a?.pick === p ? PICK_ON[p] : null) }} aria-pressed={a?.pick === p} onClick={() => pickOn(item, p)}>{PICK_WORDS[p]}</button>
                    ))}
                  </div>
                )}
                {!asking && (noteOpen === item.id || (a && a.note)) ? (
                  <input type="text" value={a?.note ?? ''} placeholder="A note for the office" aria-label={`Note on ${item.words}`} maxLength={500} disabled={!a} onChange={(e) => api.setNote(stage.fixtureId, item.id, e.target.value)} style={field} />
                ) : !asking ? (
                  <button type="button" style={{ ...link, justifySelf: 'start' }} onClick={() => setNoteOpen(item.id)} disabled={!a} title={a ? undefined : 'Answer first, then add a note'}>Add a note</button>
                ) : null}
                {itemVoided.length ? <VoidedLines rows={itemVoided} /> : null}
                {!asking ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {reopen === item.id ? <button type="button" style={link} onClick={() => setReopen(null)}>Done</button> : null}
                    {canAdd && item.scope === 'job' ? <button type="button" style={{ ...link, color: 'var(--text-muted)' }} onClick={() => setReason({ itemId: item.id, kind: 'off' })}>Take this check off</button> : null}
                    {canAdd && item.scope === 'company' ? <button type="button" style={{ ...link, color: 'var(--text-muted)' }} onClick={() => setReason({ itemId: item.id, kind: 'skip' })}>Skip on this job</button> : null}
                  </div>
                ) : null}
              </div>,
            )
          }
          return wrap(
            <div data-testid="checklist-statement" style={statement}>
              <span style={{ fontWeight: 700, color: a ? (a.pick === 'yes' ? 'var(--text-green-700)' : a.pick === 'no' ? 'var(--text-red-700)' : 'var(--text-muted)') : 'var(--text-muted)' }}>{a ? PICK_GLYPH[a.pick] : '☐'}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ color: a ? 'inherit' : 'var(--text-muted)' }}>{idx + 1}. {item.words}</span>
                  <button type="button" style={link} onClick={() => setReopen(item.id)}>{a ? 'change' : 'answer'}</button>
                </div>
                <div style={{ ...muted, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Adder item={item} />
                  {item.needsSignature && !a ? <span style={chip('amber')}>needs a signature</span> : null}
                  {item.asksPhoto && !a ? <span style={chip('amber')}>photo</span> : null}
                  {item.sheet ? <SheetChip sheet={item.sheet} plansUrl={plansUrl} /> : null}
                </div>
                {a ? (
                  <div style={{ ...muted, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{stampWords(a.by, a.at)}</span>
                    {a.signature ? <Ink sig={a.signature} /> : null}
                    {a.photoTakenAt ? <span title="photo taken" style={{ width: 28, height: 20, borderRadius: 4, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'inline-block' }} /> : null}
                    {a.note ? <span>· {a.note}</span> : null}
                  </div>
                ) : null}
                {itemVoided.length ? <VoidedLines rows={itemVoided} /> : null}
              </div>
            </div>,
          )
        })}
        {items.length > 0 && companyCount === 0 && skipped.length ? <SkippedLines rows={skipped} canAdd={canAdd} onPutBack={(id) => api.unskipItem(id, stage.fixtureId)} /> : null}
        {canAdd ? (
          adding ? (
            <AddCheck who={who} onAdd={(words, needsSignature, asksPhoto, _scope, sheet, why) => api.addItem({ scope: 'job', kind: stage.kind, fixtureId: stage.fixtureId, words, sheet, why, needsSignature, asksPhoto, addedBy: who.name })} onDone={() => setAdding(false)} />
          ) : (
            <button type="button" style={{ ...link, justifySelf: 'start', marginTop: '0.25rem' }} onClick={() => setAdding(true)}>+ Add a check for this job</button>
          )
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}

/** Company checks skipped on this job's stage: struck through, with who and why, and Put it back. */
function SkippedLines({ rows, canAdd, onPutBack }: { rows: Array<{ skip: ChecklistSkip; item: ChecklistItem }>; canAdd: boolean; onPutBack: (itemId: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 2 }} data-testid="checklist-skipped">
      {rows.map(({ skip, item }) => (
        <div key={item.id} style={{ ...statement, color: 'var(--text-muted)' }}>
          <span>—</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <s>{item.words}</s>
              {canAdd ? <button type="button" style={link} onClick={() => onPutBack(item.id)}>Put it back</button> : null}
            </div>
            <div style={muted}>not on this job · {skip.by || 'someone'} · {skip.why}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function VoidedLines({ rows }: { rows: ChecklistVoided[] }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {rows.map((v, i) => (
        <div key={i} style={{ ...muted, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', textDecoration: 'none' }} data-testid="checklist-voided">
          <span style={{ textDecoration: 'line-through' }}>{PICK_GLYPH[v.answer.pick]} {PICK_WORDS[v.answer.pick]} · {stampWords(v.answer.by, v.answer.at)}</span>
          {v.answer.signature ? <span style={{ opacity: 0.6 }}><Ink sig={v.answer.signature} /></span> : null}
          <span>· taken back by {v.by || 'someone'} · {v.why}</span>
        </div>
      ))}
    </div>
  )
}

function ReasonBox({ words, confirmLabel, onConfirm, onCancel }: { words: string; confirmLabel: string; onConfirm: (why: string) => void; onCancel: () => void }) {
  const [why, setWhy] = useState('')
  const ok = why.trim().length > 2
  return (
    <div data-testid="checklist-reason" style={{ display: 'grid', gap: '0.4rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.6rem' }}>
      <span style={{ fontSize: '0.85rem' }}>{words}</span>
      <input type="text" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} aria-label="Why" placeholder="Why" style={field} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!ok} style={primary(ok)} onClick={() => onConfirm(why.trim())}>{confirmLabel}</button>
        <button type="button" style={link} onClick={onCancel}>Keep it</button>
      </div>
    </div>
  )
}

function Ink({ sig }: { sig: { mode: 'type' | 'draw'; printedName: string; pngDataUrl: string | null } }) {
  return sig.pngDataUrl ? (
    <img src={sig.pngDataUrl} alt={`signed by ${sig.printedName}`} style={{ height: 22, width: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 3 }} />
  ) : (
    <span style={{ fontFamily: '"Snell Roundhand", "Brush Script MT", cursive', fontSize: '1rem', color: 'var(--text-strong)' }}>{sig.printedName}</span>
  )
}

/** The signature sheet in place: the gravity words, the note first on a No, the mark, the agreed line, one press. */
function SigningPanel({ jobLabel, stageName, item, pick, who, onCancel, onSigned }: { jobLabel: string; stageName: string; item: ChecklistItem; pick: ChecklistPick; who: ChecklistWho; onCancel: () => void; onSigned: (sig: ChecklistSignature, note: string) => void }) {
  const [mode, setMode] = useState<'type' | 'draw'>('type')
  const [printedName, setPrintedName] = useState(who.name)
  const [note, setNote] = useState('')
  const [agreed, setAgreed] = useState(false)
  const pad = useRef<SignatureTypeOrDrawHandle>(null)
  const needsNote = pick === 'no'
  const can = printedName.trim().length > 1 && agreed && (!needsNote || note.trim().length > 2) && (mode === 'type' || !(pad.current?.isEmpty() ?? true))
  return (
    <div data-testid="checklist-signing" style={{ border: '1.5px solid var(--border-amber, #d97706)', borderRadius: 12, padding: '0.75rem', display: 'grid', gap: '0.6rem', background: 'var(--surface)' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-amber-800)' }}>Sign your answer</div>
      <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.4 }}>{signingWords(pick, item, jobLabel, stageName)}</p>
      {needsNote ? <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-label="Why No" placeholder="Why No, for the office" style={{ ...field, borderColor: 'var(--border-amber, #d97706)' }} /> : null}
      <input type="text" value={printedName} onChange={(e) => setPrintedName(e.target.value)} aria-label="Your printed name" placeholder="Your full name" style={field} />
      <SignatureTypeOrDrawInput ref={pad} mode={mode} onModeChange={setMode} printedName={printedName} align="left" maxWidth={380} />
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
        <span>{AGREED_LINE}</span>
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!can} style={{ ...press, background: can ? '#2563eb' : 'var(--bg-subtle)', color: can ? '#fff' : 'var(--text-muted)', borderColor: can ? '#2563eb' : 'var(--border)' }} onClick={() => onSigned({ mode, printedName: printedName.trim(), pngDataUrl: mode === 'draw' ? pad.current?.toDataURL() ?? null : null, at: new Date().toISOString() }, note.trim())}>
          Sign {PICK_WORDS[pick]}
        </button>
        <button type="button" style={{ ...press, flex: 'none', padding: '0 0.9rem' }} onClick={onCancel}>Not yet</button>
      </div>
    </div>
  )
}

/** The add box: it stays open after Add with an empty question, so a list goes in without re-opening; Done closes it. */
export function AddCheck({ who, onAdd, onDone, allowCompany = false, stageName = '' }: { who: ChecklistWho; onAdd: (words: string, needsSignature: boolean, asksPhoto: boolean, scope: 'job' | 'company', sheet: string | null, why: string | null) => void; onDone: () => void; allowCompany?: boolean; stageName?: string }) {
  const [words, setWords] = useState('')
  const [sheet, setSheet] = useState('')
  const [why, setWhy] = useState('')
  const [needsSignature, setNeedsSignature] = useState(false)
  const [asksPhoto, setAsksPhoto] = useState(false)
  const [scope, setScope] = useState<'job' | 'company'>('job')
  const [added, setAdded] = useState(0)
  const ok = words.trim().length > 2
  const add = () => {
    onAdd(words.trim(), needsSignature, asksPhoto, scope, sheet.trim() || null, why.trim() || null)
    setWords('')
    setSheet('')
    setWhy('')
    setNeedsSignature(false)
    setAsksPhoto(false)
    setAdded((n) => n + 1)
  }
  return (
    <div data-testid="checklist-add" style={{ border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.5rem' }}>
      <input type="text" value={words} onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) add() }} maxLength={200} aria-label="The check, as a question" placeholder="Did the final water test hold?" style={field} autoFocus />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input type="text" value={sheet} onChange={(e) => setSheet(e.target.value)} maxLength={40} aria-label="The plan sheet it comes from, optional" placeholder="Plan sheet · P-201 detail 4" style={{ ...field, fontSize: '0.85rem', flex: '1 1 150px' }} />
        <input type="text" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={80} aria-label="Why this check, optional" placeholder="Why · the slab pours Thursday" style={{ ...field, fontSize: '0.85rem', flex: '1 1 150px' }} />
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}><input type="checkbox" checked={needsSignature} onChange={(e) => setNeedsSignature(e.target.checked)} /> Needs a signature</label>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}><input type="checkbox" checked={asksPhoto} onChange={(e) => setAsksPhoto(e.target.checked)} /> Asks for a photo</label>
      </div>
      {allowCompany ? (
        <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}><input type="radio" name="checklist-scope" checked={scope === 'job'} onChange={() => setScope('job')} /> This job only</label>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}><input type="radio" name="checklist-scope" checked={scope === 'company'} onChange={() => setScope('company')} /> Every {stageName || 'stage of this kind'} in the company, from now on</label>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={!ok} style={primary(ok)} onClick={add}>Add the check</button>
        <button type="button" style={link} onClick={onDone}>Done</button>
        <span style={{ ...muted, marginLeft: 'auto' }}>{added ? `${added} added · ` : ''}by {who.name || 'you'}</span>
      </div>
    </div>
  )
}

/** The filed sheet reads as paper: the stage strip, nothing to press but a signed row's mark, and the foot says what filing did. */
function FiledPaper({ jobLabel, stage, strip, record, justNow, onClose }: { jobLabel: string; stage: { name: string }; strip: ReactNode; record: FiledRecord; justNow: boolean; onClose: () => void }) {
  const nos = record.rows.filter((r) => r.pick === 'no').length
  const foot = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
      <span style={muted}>Filed. Nothing here changes; the office can amend it as a new version.</span>
      <button type="button" onClick={onClose} style={{ ...press, flex: 'none', padding: '0 1rem', minHeight: 40 }}>Close</button>
    </div>
  )
  const jobNo = jobLabel.replace(/^J?/, '')
  return (
    <ResponsiveModalShell title={`${stage.name} · filed`} onRequestClose={onClose} footer={foot} maxWidthDesktop={520} zIndex={1150}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {strip}
        <div data-testid="checklist-paper" data-theme="light" style={{ background: '#fff', color: '#111', border: '1px solid #ddd', borderRadius: 6, padding: '0.9rem 1rem', display: 'grid', gap: '0.4rem', fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {justNow ? <div style={{ fontSize: '0.8rem', color: '#166534' }}>Filed as record {recordId(jobNo, record.recordNo)} with the last answer.</div> : null}
          <div style={{ fontSize: '0.8rem', color: '#555' }}>
            Record {recordId(jobNo, record.recordNo)} · v{record.version} · {stampWords('filed', record.filedAt).replace('filed · ', '')} · in the job's Drive folder · {record.answerCount} answers, {record.signedCount} signed{nos ? ` · ${nos} No` : ''}
          </div>
          {record.rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: '0.2rem 0.5rem', padding: '0.4rem 0', borderTop: '1px solid #eee', fontSize: '0.92rem' }}>
              <span style={{ fontWeight: 700, color: r.pick === 'no' ? '#b91c1c' : '#111' }}>{PICK_GLYPH[r.pick]}</span>
              <div>
                <div>{i + 1}. {r.words}{r.sheet ? <span style={{ fontSize: '0.78rem', color: '#555' }}> · {r.sheet}</span> : null}</div>
                <div style={{ fontSize: '0.78rem', color: '#555', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{PICK_WORDS[r.pick]} · {stampWords(r.by, r.at)}</span>
                  {r.signedBy ? <Ink sig={{ mode: r.signaturePng ? 'draw' : 'type', printedName: r.signedBy, pngDataUrl: r.signaturePng }} /> : null}
                  {r.photo ? <span>· photo</span> : null}
                  {r.note ? <span style={{ color: r.pick === 'no' ? '#b91c1c' : '#555' }}>· {r.note}</span> : null}
                </div>
              </div>
            </div>
          ))}
          {record.skipped?.length ? (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '0.4rem', fontSize: '0.78rem', color: '#555' }}>
              Not on this job: {record.skipped.map((s) => `${s.words.replace(/\?$/, '')} (${s.why}, ${s.by || 'someone'})`).join(' · ')}
            </div>
          ) : null}
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.4rem', fontSize: '0.8rem', color: nos ? '#b91c1c' : '#166534' }}>{filedFootWords(stage.name, nos)}</div>
        </div>
      </div>
    </ResponsiveModalShell>
  )
}
