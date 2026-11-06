/**
 * Equipment pre-use check (punch list #270): the Job Mode card's line per machine on the job, under the stage
 * checklists. Amber *Not checked today · Check it ›*, green once anyone on the job has checked it, red while held; a
 * press opens the sheet. Under a checked machine a dashed *Leaving E-12?* line opens the leaving check. A machine
 * planned for today but not here yet asks *Is it here?* first.
 */
import { useState, type CSSProperties } from 'react'
import { useJobMachines } from '../../hooks/useJobMachines'
import { useAuth } from '../../hooks/useAuth'
import { formatErrorMessage } from '../../utils/errorHandling'
import { arrivalWords, leaveState, leaveWords, lineState, lineWords, machineName, machinesOnJob, todayDay, type ArrivalAnswer, type CheckKind, type Machine, type MachineOnJob } from '../../lib/machines/machines'
import { answerArrival } from '../../lib/machines/checksIo'
import { MachineCheckSheet } from './MachineCheckSheet'
import * as S from '../jobMode/sheetStyles'

const label: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.75rem 0 0.25rem' }
const line: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 0.6rem', alignItems: 'center', width: '100%', minHeight: 56, padding: '0.5rem 0.7rem', marginTop: '0.35rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', textAlign: 'left', font: 'inherit', cursor: 'pointer' }
const looks: Record<string, CSSProperties> = {
  unchecked: { borderColor: '#d97706', background: 'var(--bg-amber-100)' },
  unfinished: { borderColor: '#d97706', background: 'var(--bg-amber-100)' },
  checked: { borderColor: '#16a34a', background: 'var(--bg-green-100)' },
  held: { borderColor: '#dc2626', background: 'var(--bg-red-100)' },
}
const pressColor: Record<string, string> = { unchecked: 'var(--text-amber-800)', unfinished: 'var(--text-amber-800)', checked: 'var(--text-green-700)', held: 'var(--text-red-700)' }
const leaveLine: CSSProperties = { ...line, minHeight: 44, marginTop: '0.2rem', marginLeft: '1.25rem', width: 'calc(100% - 1.25rem)', padding: '0.35rem 0.7rem' }
const leaveLooks: Record<string, CSSProperties> = { none: { borderStyle: 'dashed' }, open: { borderColor: '#d97706', background: 'var(--bg-amber-100)' }, left: { borderColor: '#16a34a', background: 'var(--bg-green-100)' } }
const leaveColor: Record<string, string> = { none: 'var(--text-700)', open: 'var(--text-amber-800)', left: 'var(--text-green-700)' }
const press: CSSProperties = { minHeight: 40, padding: '0 0.6rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }
const ANSWER_WORDS: Record<ArrivalAnswer, string> = { here: 'Here, check it', later: 'Coming later', not_coming: 'Not coming' }

export function JobModeMachinesLine({ jobId, jobWords }: { jobId: string; jobWords: string }) {
  const { user, profileName } = useAuth()
  const { data, problem, reload } = useJobMachines(jobId)
  const [open, setOpen] = useState<{ m: Machine; kind: CheckKind } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const today = todayDay()
  const byName = profileName ?? 'Someone on the job'
  if (!data) return problem ? <p style={{ ...S.muted, margin: '0.5rem 0 0' }}>{problem}</p> : null
  const onJob = machinesOnJob(data, jobId, today)
  if (onJob.length === 0) return null
  function answer(x: MachineOnJob, a: ArrivalAnswer) {
    if (!x.assignment) return
    answerArrival(x.assignment, x.machine, a)
      .then(() => {
        reload()
        if (a === 'here') setOpen({ m: { ...x.machine, jobId, jobWords }, kind: 'pre' })
      })
      .catch((e) => setFailed(formatErrorMessage(e, 'The answer did not save.')))
  }
  return (
    <div data-job-mode-machines={onJob.length}>
      <p style={label}>Machines on this job</p>
      {failed ? <p style={{ ...S.muted, color: 'var(--text-red-700)' }}>{failed}</p> : null}
      {onJob.map((x) => {
        const m = x.machine
        const st = lineState(data.checks, m.id, today)
        const w = lineWords(st, today)
        const lv = leaveState(data.checks, m.id, today)
        const lw = leaveWords(lv, m.unitLabel)
        const notComing = x.assignment?.answer === 'not_coming'
        const asking = Boolean(x.assignment && x.assignment.answer == null && st.kind === 'unchecked')
        return (
          <div key={m.id}>
            <button type="button" style={{ ...line, ...looks[st.kind] }} onClick={() => setOpen({ m, kind: 'pre' })} data-machine-line={st.kind}>
              <b style={{ fontSize: '0.9375rem', gridColumn: 1, gridRow: 1 }}>
                {m.kind === 'directional_drill' ? '🛠' : '🚜'} {machineName(m)}
                {m.rental ? ' · rental' : ''}
              </b>
              <span style={{ gridColumn: 2, gridRow: '1 / span 2', fontWeight: 700, fontSize: '0.875rem', color: pressColor[st.kind], whiteSpace: 'nowrap' }}>{w.press}</span>
              <span style={{ gridColumn: 1, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                {notComing ? arrivalWords(x) : `${w.head} · ${w.sub}`}
                {!notComing && st.kind === 'unchecked' && (x.assignment || !x.placed) ? ` · ${arrivalWords(x)}` : ''}
              </span>
            </button>
            {asking ? (
              <div role="group" aria-label={`Is ${m.unitLabel} here`} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.35rem', marginTop: '0.25rem', marginLeft: '1.25rem' }} data-machine-arrival={m.unitLabel}>
                {(['here', 'later', 'not_coming'] as ArrivalAnswer[]).map((a) => (
                  <button key={a} type="button" style={{ ...press, ...(a === 'here' ? { background: '#16a34a', borderColor: '#16a34a', color: '#fff' } : {}) }} onClick={() => answer(x, a)}>
                    {ANSWER_WORDS[a]}
                  </button>
                ))}
              </div>
            ) : null}
            {/* the leaving line shows once the morning walk is signed: short, and only what using it changes */}
            {st.kind === 'checked' || lv.kind !== 'none' ? (
              <button type="button" style={{ ...leaveLine, ...leaveLooks[lv.kind] }} onClick={() => setOpen({ m, kind: 'post' })} data-machine-leave={lv.kind}>
                <b style={{ fontSize: '0.875rem', gridColumn: 1, gridRow: 1 }}>{lw.head}</b>
                <span style={{ gridColumn: 2, gridRow: '1 / span 2', fontWeight: 700, fontSize: '0.8125rem', color: leaveColor[lv.kind], whiteSpace: 'nowrap' }}>{lw.press}</span>
                <span style={{ gridColumn: 1, fontSize: '0.75rem', color: 'var(--text-700)' }}>{lw.sub}</span>
              </button>
            ) : null}
          </div>
        )
      })}
      {open ? (
        <MachineCheckSheet machine={open.m} questions={data.questions} checks={data.checks} kind={open.kind} jobId={jobId} jobWords={jobWords} userId={user?.id ?? null} byName={byName} onChanged={reload} onClose={() => { setOpen(null); reload() }} />
      ) : null}
    </div>
  )
}

export default JobModeMachinesLine
