/**
 * Equipment pre-use check (punch list #270): the machines on the fleet board (People → Vehicles). A card per machine
 * with its template, who holds it (a job or the yard), today's check, the hours, the days on jobs, Hand off, Print the
 * label, the rental, its gauges, and Add a machine. A machine is a vehicles row with kind = machine; its place is a
 * possession by job. Every press writes and reads again; a failure names its reason.
 */
import { useState, type CSSProperties } from 'react'
import { useFleet } from '../../hooks/useFleet'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import {
  GAUGE_LOOKS,
  GAUGE_LOOK_WORDS,
  MACHINE_KIND_WORDS,
  dayWords,
  fluidColor,
  gaugePreset,
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
  type GaugeLook,
  type LevelDef,
  type Machine,
  type MachineKind,
  type Rental,
} from '../../lib/machines/machines'
import { addMachine, placeMachine, saveLevels, saveRental, type MachineTemplate } from '../../lib/machines/machinesIo'
import { JobLookupBox } from './JobLookupBox'
import { MachineLabelModal } from './MachineLabelModal'
import { LevelGauge } from './LevelGauge'

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
  const { fleet, problem, reload } = useFleet()
  const today = todayDay()
  const [handing, setHanding] = useState<string | null>(null)
  const [label, setLabel] = useState<Machine | null>(null)
  const [adding, setAdding] = useState(false)
  const [gauges, setGauges] = useState<string | null>(null)
  const [renting, setRenting] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
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
          const rental = m.rental ? rentalWords(m.rental, today) : null
          return (
            <div key={m.id} style={card} data-machine-card={m.unitLabel}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '1rem' }}>{machineName(m)}</b>
                <span style={chips.k}>{template?.name ?? MACHINE_KIND_WORDS[m.kind]}</span>
                {rental ? <span style={rental.late ? chips.r : rental.soon ? chips.a : chips.b} data-rental-chip>{rental.words}</span> : null}
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
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button type="button" style={press} disabled={busy != null} onClick={() => setHanding(handing === m.id ? null : m.id)}>
                  {m.jobId ? 'Hand off' : 'Put on a job'}
                </button>
                <button type="button" style={press} onClick={() => setLabel(m)}>
                  Print the label
                </button>
                <button type="button" style={press} onClick={() => setGauges(gauges === m.id ? null : m.id)} data-machine-gauges={m.unitLabel}>
                  Gauges · {m.levels.length}
                </button>
                <button type="button" style={press} onClick={() => setRenting(renting === m.id ? null : m.id)} data-machine-rental={m.unitLabel}>
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
              {renting === m.id ? <RentalEditor machine={m} busy={busy != null} onSave={(r) => void run('rental', () => saveRental(m.id, r))} onClose={() => setRenting(null)} /> : null}
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
  function patch(key: string, change: Partial<LevelDef>) {
    setLevels((ls) => ls.map((d) => (d.key === key ? { ...d, ...change } : d)))
  }
  function setLook(d: LevelDef, look: GaugeLook) {
    const p = gaugePreset(look, d.name, d.where, d.key)
    patch(d.key, { look, marks: p.marks, lowBelow: p.lowBelow })
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.6rem', background: 'var(--bg-subtle)' }} data-gauge-editor>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.9375rem' }}>Gauges on {machine.unitLabel}</b>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>The crew sees each one drawn this way on the check sheet, with the words on where to find it.</span>
      </div>
      {levels.length === 0 ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing to read on this one. Add a gauge if it has a tank, a glass, a stick or a dial.</p> : null}
      {levels.map((d) => (
        <div key={d.key} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.5rem 0.75rem', alignItems: 'start', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }} data-gauge-row={d.name}>
          <LevelGauge def={d} value={d.look === 'dial' ? 70 : (d.marks.find((m) => m.line)?.at ?? 70)} last={undefined} readOnly onChange={() => {}} small />
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.4rem' }}>
              <input value={d.name} onChange={(e) => patch(d.key, { name: e.target.value, color: fluidColor(e.target.value) })} aria-label="What it holds" placeholder="What it holds, like Fuel" style={field} />
              <button type="button" style={{ ...press, color: 'var(--text-muted)' }} onClick={() => setLevels((ls) => ls.filter((x) => x.key !== d.key))}>
                Remove
              </button>
            </div>
            <input value={d.where} onChange={(e) => patch(d.key, { where: e.target.value })} aria-label="Where to read it" placeholder="Where to read it, like Sight glass behind the cab" style={field} />
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="radiogroup" aria-label="What it looks like">
              {GAUGE_LOOKS.map((look) => {
                const on = d.look === look
                return (
                  <button key={look} type="button" role="radio" aria-checked={on} onClick={() => setLook(d, look)} style={{ ...press, minHeight: 32, fontSize: '0.75rem', ...(on ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb' } : {}) }} title={GAUGE_LOOK_WORDS[look].how}>
                    {GAUGE_LOOK_WORDS[look].name}
                  </button>
                )
              })}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>{GAUGE_LOOK_WORDS[d.look].how}</span>
            </div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Add a gauge:</span>
        {GAUGE_LOOKS.map((look) => (
          <button key={look} type="button" style={press} onClick={() => setLevels((ls) => [...ls, gaugePreset(look, '', '')])}>
            + {GAUGE_LOOK_WORDS[look].name}
          </button>
        ))}
      </div>
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

/** Who it is rented from and when it is due back; the chip on the card and the line on the sheet read it. */
function RentalEditor({ machine, busy, onSave, onClose }: { machine: Machine; busy: boolean; onSave: (r: Rental | null) => void; onClose: () => void }) {
  const [r, setR] = useState<Rental>(machine.rental ?? { from: '', agreementNo: '', outOn: todayDay(), dueBack: '' })
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.5rem', background: 'var(--bg-subtle)' }} data-rental-editor>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <b style={{ fontSize: '0.9375rem' }}>{machine.rental ? `${machine.unitLabel} is a rental` : `Rent ${machine.unitLabel}?`}</b>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>The checks at pickup and at return are the evidence against a damage claim.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
        <input value={r.from} onChange={(e) => setR({ ...r, from: e.target.value })} aria-label="Rented from" placeholder="Rented from, like Sunbelt" style={field} />
        <input value={r.agreementNo} onChange={(e) => setR({ ...r, agreementNo: e.target.value })} aria-label="Agreement number" placeholder="Agreement number" style={field} />
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
