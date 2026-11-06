/**
 * Equipment pre-use check (punch list #270): the door the machine's label opens, `/m/<code>`. Finds the machine by
 * its code and opens its check, pointed at the job it is on, else asking which job: the morning walk, or once today's
 * walk is signed, the short leaving check. A code no machine carries offers Add this machine, the rental's door.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { formatErrorMessage } from '../utils/errorHandling'
import { clockWords, leaveState, lineState, machineName, todayDay, type CheckKind } from '../lib/machines/machines'
import { loadMachineForCheck, loadTemplates, type MachineForCheck } from '../lib/machines/checksIo'
import type { MachineTemplate } from '../lib/machines/machinesIo'
import { MachineCheckSheet } from '../components/machines/MachineCheckSheet'
import { AddMachine } from '../components/machines/MachinesSection'

export default function MachineCode() {
  const { code = '' } = useParams()
  const wanted = code.replace(/[^0-9a-z]/gi, '').toUpperCase()
  const nav = useNavigate()
  const { user, profileName } = useAuth()
  const [found, setFound] = useState<MachineForCheck | null | undefined>(undefined)
  const [templates, setTemplates] = useState<MachineTemplate[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [rev, setRev] = useState(0)
  const reload = useCallback(() => setRev((r) => r + 1), [])
  useEffect(() => {
    let live = true
    if (!wanted) {
      setFound(null)
      return
    }
    loadMachineForCheck({ code: wanted })
      .then(async (f) => {
        if (!live) return
        setFound(f)
        if (!f) setTemplates(await loadTemplates())
      })
      .catch((e) => live && setProblem(formatErrorMessage(e, 'The machine did not read.')))
    return () => {
      live = false
    }
  }, [wanted, rev])

  const today = todayDay()
  const machine = found?.machine ?? null
  // the label opens the morning walk until it is signed, then the leaving check until that is signed
  const morning = found ? lineState(found.checks, found.machine.id, today) : null
  const leaving = found ? leaveState(found.checks, found.machine.id, today) : null
  const kind: CheckKind = morning?.kind === 'checked' && leaving?.kind !== 'left' ? 'post' : 'pre'
  const lead =
    kind === 'post' && morning?.kind === 'checked'
      ? `${morning.check.byName} signed the morning walk at ${clockWords(morning.check.signedAt ?? morning.check.startedAt)}. This is the leaving check.`
      : leaving?.kind === 'left'
        ? 'Checked and left today. A new walk starts here.'
        : 'Check it before you run it.'
  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: 480, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: '0.75rem' }}>
      {problem ? <p style={{ margin: 0, color: 'var(--text-red-700)' }}>{problem}</p> : null}
      {found === undefined && !problem ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Reading the label…</p> : null}
      {machine && found ? (
        <>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-strong)' }}>{machineName(machine)}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            {machine.jobWords ? `On ${machine.jobWords}.` : 'In the yard.'} {lead}
          </p>
          <MachineCheckSheet machine={machine} questions={found.questions} checks={found.checks} kind={kind} jobId={machine.jobId} jobWords={machine.jobWords} userId={user?.id ?? null} byName={profileName ?? 'Someone at the machine'} onChanged={reload} onClose={() => nav('/dashboard')} />
        </>
      ) : found === null ? (
        <>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-strong)' }}>{wanted ? `${wanted} is not a machine on the board` : 'That is not a machine code'}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>A rental, or a label the board does not know yet. Add it and the check opens; Dispatch sees the new row on the fleet board to keep or let go.</p>
          {wanted && templates.length ? <AddMachine templates={templates} code={wanted} onDone={reload} /> : null}
        </>
      ) : null}
    </div>
  )
}
