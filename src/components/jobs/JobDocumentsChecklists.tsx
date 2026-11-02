import { useMemo, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useChecklistDocuments } from '../../hooks/useChecklistDocuments'
import { jobDocumentFolderLinks } from '../../lib/jobs/jobDocumentsTab'
import { checklistProgress, checklistStagesOf, noCount, PICK_GLYPH, PICK_WORDS, progressWords, recordId, stampWords, type ChecklistWho } from '../../lib/jobs/checklistDocument'
import { AddCheck, ChecklistDocumentSheet, SheetChip, type SheetStage } from '../stageChecklists/ChecklistDocumentSheet'
import { documentsChip, documentsHeading, documentsLinkButton, documentsQuietButton, documentsTd } from './jobDocumentsStyles'
import { EmptyState } from '../EmptyState'

/**
 * Stage checklists on the Documents tab (design spike, punch list #237): one
 * door where the office and the estimator author and read. Each of the job's
 * stages is a document — filed with its record number, or open with what is
 * left, every row with its pick, stamp, note and mark — with the inline add box
 * that stays open for a list (the two toggles, this job or the company's list),
 * ▲▼ to put the checks in build order, Take off with a reason, Amend, Use as
 * the company's list, and Open the sheet, which is the phone's view. A filed
 * record with a No says so on the stage row: that is what the office acts on.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }
const arrow: CSSProperties = { ...link, color: 'var(--text-muted)', fontSize: '0.7rem', padding: '0 0.15rem' }

export function JobDocumentsChecklists({ job }: { job: JobWithDetails }) {
  const auth = useOptionalAuth()
  const role = auth?.role ?? null
  const who: ChecklistWho = useMemo(() => ({ userId: auth?.user?.id ?? null, name: auth?.profileName ?? '' }), [auth?.user?.id, auth?.profileName])
  // The office and the estimator author; the estimator writes the checks the plans ask for.
  const office = role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller' || role === 'estimator'
  const api = useChecklistDocuments(job.id)
  const stages: SheetStage[] = useMemo(() => checklistStagesOf(job.fixtures ?? []), [job.fixtures])
  const plansUrl = useMemo(() => jobDocumentFolderLinks(job).find((l) => l.label === 'Plans')?.url ?? null, [job])
  const jobLabel = `J${job.hcp_number || job.click_number}`
  const [sheet, setSheet] = useState<SheetStage | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [takingOff, setTakingOff] = useState<{ itemId: string; why: string; kind: 'off' | 'skip' | 'company' } | null>(null)
  const groupHeading = (words: string, count: number) => (
    <div style={{ ...muted, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.68rem', marginTop: '0.35rem' }}>{words} · {count}</div>
  )
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({})

  return (
    <section aria-labelledby="job-documents-checklists" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="job-documents-checklists">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h3 id="job-documents-checklists" style={{ ...documentsHeading, flex: 1 }}>Stage checklists</h3>
        <span style={muted}>spike · browser storage</span>
        <button type="button" style={documentsQuietButton} onClick={() => api.reset()} title="Clears the spike's stored checklists on every job">Clear the spike</button>
      </div>
      {stages.length === 0 ? (
        <EmptyState compact main="No stages to check on this job. A line In order on the Bill tab named Rough In, Top Out or Trim Set gets a checklist." />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {stages.map((s) => {
              const items = api.stageItems(s.kind, s.fixtureId)
              const answers = api.stageAnswers(s.fixtureId)
              const voided = api.stageVoided(s.fixtureId)
              const state = api.stageState(s.fixtureId)
              const p = checklistProgress(items, answers)
              const nos = noCount(items, answers)
              const skipped = api.stageSkipped(s.kind, s.fixtureId)
              const companyCount = items.filter((i) => i.scope === 'company').length
              const skippedRows = skipped.length ? (
                <div data-testid="checklist-skipped-desk" style={{ display: 'grid', gap: '0.2rem' }}>
                  {skipped.map(({ skip, item }) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: '0.25rem 0.5rem', fontSize: '0.85rem', padding: '0.25rem 0', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <span>—</span>
                      <div><s>{item.words}</s><div style={muted}>not on this job · {skip.by || 'someone'} · {skip.why}</div></div>
                      {office ? <button type="button" style={link} onClick={() => api.unskipItem(item.id, s.fixtureId)}>Put it back</button> : <span />}
                    </div>
                  ))}
                </div>
              ) : null
              const expanded = openRows[s.fixtureId] ?? false
              const jobNo = job.hcp_number || job.click_number
              return (
                <tr key={s.fixtureId}>
                  <td style={{ ...documentsTd, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" style={documentsLinkButton} onClick={() => setOpenRows((o) => ({ ...o, [s.fixtureId]: !expanded }))}>{s.name} checklist</button>
                      {state.filed ? (
                        <>
                          <span style={{ ...documentsChip, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }}>filed</span>
                          {nos > 0 ? <span style={{ ...documentsChip, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }} data-testid="checklist-no-chip">{nos} No · {items.filter((i) => answers.get(i.id)?.pick === 'no').map((i) => i.words.replace(/\?$/, '')).join(' · ')}</span> : null}
                          <span style={muted}>{recordId(jobNo, state.filed.recordNo)} · v{state.filed.version} · {stampWords('', state.filed.filedAt).replace('someone · ', '')} · {state.filed.answerCount} answers, {state.filed.signedCount} signed · PDF in the job's Drive folder</span>
                        </>
                      ) : items.length === 0 ? (
                        <span style={{ ...documentsChip, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>no list yet</span>
                      ) : (
                        <>
                          <span style={{ ...documentsChip, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>open</span>
                          {nos > 0 ? <span style={{ ...documentsChip, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>{nos} No</span> : null}
                          <span style={muted}>{progressWords(p)}{state.versions.length ? ` · amending v${state.versions.length}` : ''}</span>
                        </>
                      )}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        {state.filed && office ? <button type="button" style={link} onClick={() => api.amend(s.fixtureId)}>Amend</button> : null}
                        <button type="button" style={documentsQuietButton} onClick={() => setSheet(s)}>{state.filed ? 'Open the record' : 'Open the sheet'}</button>
                      </span>
                    </div>
                    {expanded ? (
                      <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.3rem' }}>
                        {items.length === 0 ? <div style={muted}>No checks yet. {office ? 'Add the first one for this job, or as the company’s list for every ' + s.name + '.' : ''}</div> : null}
                        {items.map((item, idx) => {
                          const a = answers.get(item.id)
                          const myVoided = voided.filter((v) => v.answer.itemId === item.id)
                          const peers = items.filter((i) => i.scope === item.scope)
                          const pi = peers.findIndex((i) => i.id === item.id)
                          const mayEdit = office || (item.scope === 'job' && item.addedBy === who.name)
                          const heading = idx === 0 && item.scope === 'company' ? groupHeading(`The company's ${s.name} checks`, companyCount) : idx === companyCount && item.scope === 'job' ? groupHeading('Added for this job', items.length - companyCount) : null
                          const after = idx === companyCount - 1 ? skippedRows : null
                          const reasonWords = takingOff?.kind === 'skip' ? `Skipping it here leaves the company's ${s.name} list whole; the record says it was not on this job. Why?` : takingOff?.kind === 'company' ? `This takes it off every ${s.name} in the company, from now on. Why?` : 'The check keeps its answer on the record as taken off. Why?'
                          return (
                            <div key={item.id} style={{ display: 'grid', gap: '0.2rem' }}>
                            {heading}
                            <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: '0.25rem 0.5rem', fontSize: '0.85rem', padding: '0.25rem 0', borderTop: '1px solid var(--border)' }}>
                              <span style={{ fontWeight: 700, color: a ? (a.pick === 'yes' ? 'var(--text-green-700)' : a.pick === 'no' ? 'var(--text-red-700)' : 'var(--text-muted)') : 'var(--text-muted)' }}>{a ? PICK_GLYPH[a.pick] : '☐'}</span>
                              <div style={{ minWidth: 0 }}>
                                <div>
                                  {idx + 1}. {item.words}
                                  {item.needsSignature ? <span style={{ ...documentsChip, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>signature</span> : null}
                                  {item.asksPhoto ? <span style={{ ...documentsChip, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>photo</span> : null}
                                  {item.sheet ? <span style={{ marginLeft: '0.4rem' }}><SheetChip sheet={item.sheet} plansUrl={plansUrl} /></span> : null}
                                  {item.scope === 'job' ? <span style={{ ...documentsChip, background: 'var(--bg-blue-100)', color: 'var(--text-blue-700)' }}>this job · {item.addedBy || 'added'}</span> : <span style={{ ...documentsChip, background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>company</span>}
                                  {item.why ? <span style={{ ...muted, marginLeft: '0.4rem' }}>· {item.why}</span> : null}
                                </div>
                                <div style={{ ...muted, color: a?.pick === 'no' ? 'var(--text-red-700)' : muted.color }}>
                                  {a ? `${PICK_WORDS[a.pick]} · ${stampWords(a.by, a.at)}${a.signature ? ` · signed by ${a.signature.printedName}` : ''}${a.photoTakenAt ? ' · photo' : ''}${a.note ? ` · ${a.note}` : ''}` : 'not answered yet'}
                                </div>
                                {myVoided.map((v, i) => (
                                  <div key={i} style={muted}><s>{PICK_WORDS[v.answer.pick]} · {stampWords(v.answer.by, v.answer.at)}{v.answer.signature ? ' · signed' : ''}</s> · taken back by {v.by || 'someone'} · {v.why}</div>
                                ))}
                                {takingOff?.itemId === item.id ? (
                                  <div style={{ display: 'grid', gap: '0.3rem', marginTop: '0.25rem', background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.4rem 0.5rem' }} data-testid="checklist-desk-reason">
                                    <span style={{ fontSize: '0.8rem', color: takingOff.kind === 'company' ? 'var(--text-red-700)' : 'var(--text-700)' }}>{reasonWords}</span>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <input type="text" value={takingOff.why} onChange={(e) => setTakingOff({ ...takingOff, why: e.target.value })} aria-label="Why" placeholder="Why" maxLength={200} style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.85rem', flex: '1 1 200px' }} />
                                      <button
                                        type="button"
                                        style={link}
                                        disabled={takingOff.why.trim().length < 3}
                                        onClick={() => {
                                          const why = takingOff.why.trim()
                                          if (takingOff.kind === 'skip') api.skipItem(item.id, s.fixtureId, who, why)
                                          else api.retireItem(item.id, item.fixtureId, who, why)
                                          setTakingOff(null)
                                        }}
                                      >
                                        {takingOff.kind === 'skip' ? 'Skip on this job' : takingOff.kind === 'company' ? `Take it off every ${s.name}` : 'Take it off'}
                                      </button>
                                      <button type="button" style={{ ...link, color: 'var(--text-muted)' }} onClick={() => setTakingOff(null)}>Keep it</button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', whiteSpace: 'nowrap', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
                                {mayEdit ? (
                                  <>
                                    <button type="button" style={{ ...arrow, opacity: pi === 0 ? 0.3 : 1 }} disabled={pi === 0} aria-label="Move the check up" onClick={() => api.moveItem(item.id, 'up', s.kind, s.fixtureId)}>▲</button>
                                    <button type="button" style={{ ...arrow, opacity: pi === peers.length - 1 ? 0.3 : 1 }} disabled={pi === peers.length - 1} aria-label="Move the check down" onClick={() => api.moveItem(item.id, 'down', s.kind, s.fixtureId)}>▼</button>
                                    {item.scope === 'company' ? (
                                      <>
                                        <button type="button" style={link} onClick={() => setTakingOff({ itemId: item.id, why: '', kind: 'skip' })}>Skip on this job</button>
                                        {office ? <button type="button" style={{ ...link, color: 'var(--text-muted)' }} onClick={() => setTakingOff({ itemId: item.id, why: '', kind: 'company' })}>Take off the company's list</button> : null}
                                      </>
                                    ) : (
                                      <>
                                        {office ? <button type="button" style={link} title={`Becomes a company check on every ${s.name}; here it keeps its answer`} onClick={() => api.promoteItem(item.id)}>Add to the company's list</button> : null}
                                        <button type="button" style={{ ...link, color: 'var(--text-muted)' }} onClick={() => setTakingOff({ itemId: item.id, why: '', kind: 'off' })}>Take off</button>
                                      </>
                                    )}
                                  </>
                                ) : null}
                              </span>
                            </div>
                            {after}
                            </div>
                          )
                        })}
                        {items.length > 0 && companyCount === 0 ? skippedRows : null}
                        {office ? (
                          adding === s.fixtureId ? (
                            <AddCheck who={who} allowCompany stageName={s.name} onDone={() => setAdding(null)} onAdd={(words, needsSignature, asksPhoto, scope, sheet, why) => api.addItem({ scope, kind: s.kind, fixtureId: scope === 'job' ? s.fixtureId : null, words, sheet, why, needsSignature, asksPhoto, addedBy: who.name })} />
                          ) : (
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                              <button type="button" style={link} onClick={() => setAdding(s.fixtureId)}>+ Add a check</button>
                            </div>
                          )
                        ) : null}
                        {state.versions.length > 0 ? (
                          <div style={{ ...muted, marginTop: '0.25rem' }}>
                            Versions: {state.versions.map((v) => `${recordId(jobNo, v.recordNo)} v${v.version}`).join(' · ')}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {sheet ? <ChecklistDocumentSheet jobLabel={jobLabel} stage={sheet} stages={stages} onSwitch={setSheet} plansUrl={plansUrl} who={who} canAdd={office || role === 'master_technician'} api={api} onClose={() => setSheet(null)} /> : null}
    </section>
  )
}
