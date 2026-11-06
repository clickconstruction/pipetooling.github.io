/**
 * Equipment pre-use check (punch list #270): the machines on the fleet board (People → Vehicles). A card per machine
 * with its template, who holds it (a job or the yard), today's check, the hours, the days on jobs, Hand off, Print the
 * label, the rental, its gauges, and Add a machine. A machine is a vehicles row with kind = machine; its place is a
 * possession by job. Every press writes and reads again; a failure names its reason. A rental whose agreement came in
 * as the tech's photo (punch list #271) shows that photo on its card with Type it off the photo, which opens the
 * rental editor beside the picture so the office types the number and the due-back day off the paper.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useFleet } from '../../hooks/useFleet'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import {
  MACHINE_KIND_WORDS,
  agreementPhotoView,
  agreementPhotos,
  agreementState,
  dayWords,
  hoursWords,
  isHeld,
  lastHours,
  lineState,
  lineWords,
  machineDayWords,
  machineDays,
  machineFolderName,
  machineName,
  rentalWords,
  todayDay,
  type LevelDef,
  type Machine,
  type AgreementPhotoView,
  type MachineCheck,
  type MachineKind,
  type MachinePhoto,
  type Rental,
} from '../../lib/machines/machines'
import { addMachine, placeMachine, saveLevels, saveRental, type MachineTemplate } from '../../lib/machines/machinesIo'
import { photoSrc, runAnyway } from '../../lib/machines/checksIo'
import { useAuth } from '../../hooks/useAuth'
import { MachineCheckSheet } from './MachineCheckSheet'
import { JobLookupBox } from './JobLookupBox'
import { MachineLabelModal } from './MachineLabelModal'
import { GaugeListEditor } from './GaugeListEditor'

const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 0.9rem', background: 'var(--surface)', display: 'grid', gap: '0.5rem' }
const chip: CSSProperties = { display: 'inline-block', padding: '0 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, lineHeight: '1.3rem' }
const chips: Record<string, CSSProperties> = {
  k: { ...chip, background: 'var(--bg-muted)', color: 'var(--text-700)' },
  b: { ...chip, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  g: { ...chip, background: 'var(--bg-green-100)', color: 'var(--text-green-700)' },
  a: { ...chip, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  r: { ...chip, background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
}
const press: CSSProperties = { minHeight: 36, padding: '0 0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '7rem minmax(0, 1fr)', gap: '0.5rem', padding: '0.3rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }
const field: CSSProperties = { minHeight: 36, padding: '0.3rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-strong)', font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }

export function MachinesSection() {
  const { user, profileName } = useAuth()
  const { fleet, problem, reload } = useFleet()
  const [reading, setReading] = useState<{ m: Machine; checkId: string } | null>(null)
  const today = todayDay()
  const [handing, setHanding] = useState<string | null>(null)
  const [label, setLabel] = useState<Machine | null>(null)
  const [adding, setAdding] = useState(false)
  const [gauges, setGauges] = useState<string | null>(null)
  const [renting, setRenting] = useState<string | null>(null)
  /** The rental editor opened from Type it off the photo draws the agreement photo beside its fields. */
  const [typingOff, setTypingOff] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const srcs = useAgreementPhotoSrcs(fleet?.machines ?? [], fleet?.checks ?? [])
  const [failed, setFailed] = useState<string | null>(null)

  async function run(what: string, fn: () => Promise<void>) {
    setBusy(what)
    setFailed(null)
    try {
      await fn()
      reload()
    } catch (e) {
      setFailed(formatErrorMessage(e, 'That did not save.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section style={{ margin: '0 0 1.25rem' }} data-machines-section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Machines</h3>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>excavators, drills, skid steers: hours on a meter and a check before they run</span>
        <button type="button" style={{ ...press, marginLeft: 'auto' }} onClick={() => setAdding((v) => !v)}>
          + Add a machine
        </button>
      </div>
      {problem ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{problem}</p> : null}
      {failed ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }} data-machines-failed>{failed}</p> : null}
      {adding && fleet ? <AddMachine templates={fleet.templates} onDone={() => { setAdding(false); reload() }} /> : null}
      {fleet && fleet.machines.length === 0 && !adding ? (
        <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'machine', control: '+ Add a machine' }), { onPress: () => setAdding(true) })} compact />
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem', alignItems: 'start' }}>
        {(fleet?.machines ?? []).map((m) => {
          const st = lineState(fleet!.checks, m.id, today)
          const w = lineWords(st, today)
          const held = isHeld(fleet!.checks, m.id)
          const h = lastHours(fleet!.checks, m.id)
          const days = machineDays(fleet!.checks, m.id)
          const template = fleet!.templates.find((t) => t.id === m.templateId)
          const agreement = agreementState(m, fleet!.checks)
          const rental = m.rental ? rentalWords(m.rental, today, agreement) : null
          const newest = agreement === 'photo' ? agreementPhotos(fleet!.checks, m.id)[0] ?? null : null
          const shot = newest ? agreementPhotoView(newest, srcs[newest.photo.id]) : null
          return (
            <div key={m.id} style={card} data-machine-card={m.unitLabel}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '1rem' }}>{machineName(m)}</b>
                <span style={chips.k}>{template?.name ?? MACHINE_KIND_WORDS[m.kind]}</span>
                {rental ? <span style={rental.late ? chips.r : rental.soon || agreement !== 'typed' ? chips.a : chips.b} data-rental-chip>{rental.words}</span> : null}
                <span style={m.jobId ? chips.b : chips.k}>{m.jobId ? `On ${m.jobWords}` : 'In the yard'}</span>
                <span style={st.kind === 'checked' ? chips.g : st.kind === 'held' ? chips.r : chips.a}>{w.head}{st.kind === 'checked' ? ` · ${st.check.byName}` : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <Tile k="Hours" v={h ? hoursWords(h.hours) : '—'} s={h ? dayWords(h.day, today) : 'no reading yet'} />
                <Tile k="Checks" v={String(fleet!.checks.filter((c) => c.machineId === m.id && c.signedAt).length)} s={days[0] ? dayWords(days[0].day, today) : 'none yet'} />
                <Tile k="Label" v={m.code || '—'} s="on the machine" />
              </div>
              {held ? (
                <div style={{ background: 'var(--bg-red-100)', color: 'var(--text-red-700)', borderRadius: 8, padding: '0.5rem 0.7rem', fontSize: '0.875rem' }}>
                  <b>Held</b> · {w.sub}
                  {held.dispatchedAt ? ' · Dispatch has the row' : ''}
                  <div style={{ marginTop: '0.4rem' }}>
                    <button type="button" style={{ ...press, borderColor: '#dc2626', color: 'var(--text-red-700)' }} disabled={busy != null} onClick={() => void run('run', () => runAnyway(held.id, user?.id ?? null, profileName ?? 'Dispatch'))}>
                      Run it anyway, in {profileName ?? 'Dispatch'}’s name
                    </button>
                  </div>
                </div>
              ) : null}
              {newest && shot ? (
                <div style={{ background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.7rem', fontSize: '0.875rem', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.5rem 0.7rem', alignItems: 'start' }} data-agreement-box>
                  <AgreementThumb shot={shot} size={72} />
                  <div style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
                    <span>
                      <b>Agreement photo in</b> · {newest.check.byName} took it {dayWords(newest.check.day, today)}. The number is not typed yet.
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...press, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }} disabled={busy != null} onClick={() => { setRenting(m.id); setTypingOff(m.id) }} data-type-off-photo={m.unitLabel}>
                        Type it off the photo
                      </button>
                      {shot.href ? (
                        <a href={shot.href} target="_blank" rel="noreferrer" style={{ ...press, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} data-open-agreement-photo>
                          Open the photo
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button type="button" style={press} disabled={busy != null} onClick={() => setHanding(handing === m.id ? null : m.id)}>
                  {m.jobId ? 'Hand off' : 'Put on a job'}
                </button>
                <button type="button" style={press} onClick={() => setLabel(m)}>
                  Print the label
                </button>
                {days[0]?.pre || days[0]?.post ? (
                  <button type="button" style={press} onClick={() => { const c = days[0]?.post ?? days[0]?.pre; if (c) setReading({ m, checkId: c.id }) }}>
                    Open the newest check
                  </button>
                ) : null}
                <button type="button" style={press} onClick={() => setGauges(gauges === m.id ? null : m.id)} data-machine-gauges={m.unitLabel}>
                  Gauges · {m.levels.length}
                </button>
                <button type="button" style={press} onClick={() => { setTypingOff(null); setRenting(renting === m.id ? null : m.id) }} data-machine-rental={m.unitLabel}>
                  {m.rental ? 'Rental…' : 'Ours · make it a rental'}
                </button>
              </div>
              {handing === m.id ? (
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  <JobLookupBox onPick={(j) => void run('place', async () => { await placeMachine(m.id, { id: j.id }); setHanding(null) })} placeholder="Which job takes it?" />
                  {m.jobId ? (
                    <button type="button" style={press} disabled={busy != null} onClick={() => void run('place', async () => { await placeMachine(m.id, null); setHanding(null) })}>
                      Back to the yard
                    </button>
                  ) : null}
                </div>
              ) : null}
              {gauges === m.id ? <GaugeEditor machine={m} template={template ?? null} busy={busy != null} onSave={(levels) => void run('levels', () => saveLevels(m.id, levels))} onClose={() => setGauges(null)} /> : null}
              {renting === m.id ? <RentalEditor machine={m} busy={busy != null} photo={typingOff === m.id ? shot : null} onSave={(r) => void run('rental', () => saveRental(m.id, r))} onClose={() => { setRenting(null); setTypingOff(null) }} /> : null}
              {m.driveLink ? (
                <a href={m.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--text-link)' }}>
                  Its Drive folder · {machineFolderName(m)}
                </a>
              ) : (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Its photos will file under {machineFolderName(m)} the first time a check takes one.</span>
              )}
              {days.length ? (
                <div data-machine-days>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Days on jobs</div>
                  {days.slice(0, 6).map((d) => (
                    <div key={`${d.day}|${d.jobId ?? ''}`} style={row}>
                      <span style={{ color: 'var(--text-muted)' }}>{dayWords(d.day, today)}</span>
                      <span>
                        <b>{d.jobWords ?? 'no job'}</b> · {machineDayWords(d, today)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No check yet. The crew’s first walk-around draws the first day here.</p>
              )}
            </div>
          )
        })}
      </div>
      {label ? <MachineLabelModal machine={label} onClose={() => setLabel(null)} /> : null}
      {reading && fleet ? <MachineCheckSheet machine={reading.m} questions={fleet.questions} checks={fleet.checks} checkId={reading.checkId} kind={fleet.checks.find((c) => c.id === reading.checkId)?.kind} jobId={reading.m.jobId} jobWords={reading.m.jobWords} userId={user?.id ?? null} byName={profileName ?? 'The office'} onChanged={reload} onClose={() => setReading(null)} /> : null}
    </section>
  )
}

function Tile({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</div>
      <div style={{ fontWeight: 800, fontSize: '0.9375rem' }}>{v}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s}</div>
    </div>
  )
}

/**
 * The machine's own gauge list: which it has, what each looks like, where on the machine to read it. Starts from the
 * template's; Save keeps this machine's own, and Use the template's goes back to it.
 */
function GaugeEditor({ machine, template, busy, onSave, onClose }: { machine: Machine; template: MachineTemplate | null; busy: boolean; onSave: (levels: LevelDef[] | null) => void; onClose: () => void }) {
  const [levels, setLevels] = useState<LevelDef[]>(machine.levels)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.6rem', background: 'var(--bg-subtle)' }} data-gauge-editor>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.9375rem' }}>Gauges on {machine.unitLabel}</b>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>The crew sees each one drawn this way on the check sheet, with the words on where to find it.</span>
      </div>
      <GaugeListEditor levels={levels} onChange={setLevels} disabled={busy} />
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button type="button" style={{ ...press, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} disabled={busy} onClick={() => { onSave(levels); onClose() }}>
          Save {machine.unitLabel}’s gauges
        </button>
        {template ? (
          <button type="button" style={press} disabled={busy} onClick={() => { onSave(null); onClose() }}>
            Use the {template.name} template’s
          </button>
        ) : null}
        <button type="button" style={{ ...press, color: 'var(--text-muted)' }} onClick={onClose}>
          Leave it
        </button>
      </div>
    </div>
  )
}

/** Signed URLs for the newest agreement photo of every rental whose number is not typed yet, read once per photo. */
function useAgreementPhotoSrcs(machines: readonly Machine[], checks: readonly MachineCheck[]): Record<string, string | null> {
  const [srcs, setSrcs] = useState<Record<string, string | null>>({})
  const wanted = machines
    .filter((m) => agreementState(m, checks) === 'photo')
    .map((m) => agreementPhotos(checks, m.id)[0])
    .filter((x): x is { photo: MachinePhoto; check: MachineCheck } => x != null && !x.photo.src && !x.photo.filedAt)
    .map((x) => `${x.check.machineId}/${x.photo.id}`)
  const key = wanted.join('|')
  useEffect(() => {
    const missing = wanted.filter((w) => !(w.split('/')[1] in srcs))
    if (missing.length === 0) return
    let live = true
    Promise.all(missing.map(async (w) => { const [vehicleId, photoId] = w.split('/'); return [photoId, await photoSrc(vehicleId, photoId).catch(() => null)] as const })).then((pairs) => {
      if (live) setSrcs((s) => ({ ...s, ...Object.fromEntries(pairs) }))
    })
    return () => {
      live = false
    }
    // once per set of photos; `wanted` is derived from `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return srcs
}

/** The agreement photo drawn small: the picture, or the camera and the file's name while it has no URL. */
function AgreementThumb({ shot, size }: { shot: AgreementPhotoView; size: number }) {
  const box: CSSProperties = { width: size, height: size, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none' }
  const img = shot.src ? <img src={shot.src} alt={`The agreement, ${shot.fileName}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.2rem' }}>📷 {shot.fileName}</span>
  return shot.href ? (
    <a href={shot.href} target="_blank" rel="noreferrer" style={box} aria-label="Open the agreement photo" data-agreement-thumb>
      {img}
    </a>
  ) : (
    <span style={box} data-agreement-thumb>{img}</span>
  )
}

/**
 * Who it is rented from and when it is due back; the chip on the card and the line on the sheet read it. Opened from
 * Type it off the photo, it draws the agreement photo beside its fields so the number is read off the paper here.
 */
function RentalEditor({ machine, busy, photo, onSave, onClose }: { machine: Machine; busy: boolean; photo?: AgreementPhotoView | null; onSave: (r: Rental | null) => void; onClose: () => void }) {
  const [r, setR] = useState<Rental>(machine.rental ?? { from: '', agreementNo: '', outOn: todayDay(), dueBack: '' })
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.5rem', background: 'var(--bg-subtle)' }} data-rental-editor>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.9375rem' }}>{machine.rental ? `${machine.unitLabel} is a rental` : `Rent ${machine.unitLabel}?`}</b>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{photo ? 'Read the agreement number and the due-back day off the paper.' : 'The checks at pickup and at return are the evidence against a damage claim.'}</span>
      </div>
      {photo ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.5rem 0.7rem', alignItems: 'start' }} data-rental-editor-photo>
          <AgreementThumb shot={photo} size={160} />
          <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span>
              {photo.byName} took it {dayWords(photo.day, todayDay())}. Tap the picture to open it full size.
            </span>
            <input value={r.agreementNo} onChange={(e) => setR({ ...r, agreementNo: e.target.value })} aria-label="Agreement number" placeholder="Agreement number, off the paper" style={{ ...field, fontSize: '1rem', fontWeight: 700 }} autoFocus />
          </div>
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
        <input value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} aria-label="Rented from" placeholder="Rented from, like Sunbelt" style={field} />
        {photo ? null : <input value={r.agreementNo} onChange={(e) => setR({ ...r, agreementNo: e.target.value })} aria-label="Agreement number" placeholder="Agreement number" style={field} />}
        <label style={{ display: 'grid', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Out on
          <input type="date" value={r.outOn} onChange={(e) => setR({ ...r, outOn: e.target.value })} aria-label="Out on" style={field} />
        </label>
        <label style={{ display: 'grid', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Due back
          <input type="date" value={r.dueBack} onChange={(e) => setR({ ...r, dueBack: e.target.value })} aria-label="Due back" style={field} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button type="button" style={{ ...press, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} disabled={busy || (!r.from.trim() && !r.agreementNo.trim())} onClick={() => { onSave(r); onClose() }}>
          {machine.rental ? 'Save the rental' : `Rent ${machine.unitLabel}`}
        </button>
        {machine.rental ? (
          <button type="button" style={press} disabled={busy} onClick={() => { onSave(null); onClose() }}>
            Returned, it is not ours to check any more
          </button>
        ) : null}
        <button type="button" style={{ ...press, color: 'var(--text-muted)' }} onClick={onClose}>
          Leave it
        </button>
      </div>
    </div>
  )
}

export function AddMachine({ templates, onDone, code }: { templates: readonly MachineTemplate[]; onDone: (id: string) => void; code?: string }) {
  const [unit, setUnit] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const template = templates.find((t) => t.id === templateId) ?? null
  const kind: MachineKind = template?.kind ?? 'other'
  return (
    <div style={{ ...card, marginBottom: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end' }} data-add-machine>
      <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit, like E-14" aria-label="Unit" style={field} />
      <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" aria-label="Make" style={field} />
      <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" aria-label="Model" style={field} />
      <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} aria-label="Template" style={field}>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        style={{ ...press, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}
        disabled={busy || !unit.trim() || !make.trim()}
        onClick={() => {
          setBusy(true)
          setFailed(null)
          addMachine({ unitLabel: unit.trim(), make: make.trim(), model: model.trim(), templateId: templateId || null, kind, code })
            .then(onDone)
            .catch((e) => setFailed(formatErrorMessage(e, 'The machine was not added.')))
            .finally(() => setBusy(false))
        }}
      >
        {busy ? 'Adding…' : `Add ${unit.trim() || 'it'}`}
      </button>
      {failed ? <p style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>{failed}</p> : null}
    </div>
  )
}

export default MachinesSection
