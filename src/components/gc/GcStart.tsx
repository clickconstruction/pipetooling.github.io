import type { ReactNode } from 'react'
import {
  leveledTotal,
  uncostedLines,
  uncostedWords,
  money,
  planRecipients,
  shortDate,
  startChecklist,
  weekdayDate,
  type StartTradeRow,
} from '../../lib/gcMode/gcModel'
import type { GcPaneProps } from './GcOfficeTabs'
import { Btn, Card, Chip, Why, input, td, th } from './gcUi'

/**
 * GC mode design spike: going into the job. One page that answers "can we start?": the things
 * we owe the owner, then every trade with its five steps in the order they happen (awarded,
 * master agreement, insurance, W-9, statement of work). Each trade names the one thing to do
 * next and has the button for it. Start stays shut until nothing is missing, and pressing it
 * tells every company on the job.
 */
export function GcStartTab({ state, project, dispatch, onSeePortal }: GcPaneProps) {
  const list = startChecklist(state, project)
  const started = project.startedOn !== null
  const onJob = planRecipients(state, { ...project, stage: 'building' }, []).length

  if (project.stage === 'pursuing') {
    return (
      <Card style={{ background: 'var(--bg-amber-tint)' }}>
        This project is not ours yet. Getting started opens once we win it. Go to <strong>Our number</strong> and press{' '}
        <em>We won this</em> to play the rest.
      </Card>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        Everything that has to be signed before work starts, in one place. Each trade shows the next thing to do. When
        nothing is missing, Start tells every company on the job.
      </Why>

      <Card style={{ borderColor: started ? 'var(--border-green)' : list.ready ? 'var(--border-green)' : 'var(--border-amber)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 18rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
              {started
                ? `Started ${shortDate(project.startedOn)}.${project.startDate ? ` Work begins ${weekdayDate(project.startDate)}.` : ''}`
                : list.ready
                  ? 'Ready to start. Nothing is missing.'
                  : `Not ready yet. ${list.missing.length} ${list.missing.length === 1 ? 'thing is' : 'things are'} missing.`}
            </div>
            <div style={{ marginTop: '0.4rem', height: 10, borderRadius: 5, background: 'var(--bg-muted)', overflow: 'hidden' }} title={`${list.done} of ${list.total} steps done`}>
              <div style={{ width: `${(list.done / Math.max(1, list.total)) * 100}%`, height: '100%', background: list.ready ? '#16a34a' : '#d97706' }} />
            </div>
            <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {list.done} of {list.total} steps done
            </div>
          </div>
          {!started && (
            <Btn
              kind="primary"
              disabled={!list.ready}
              title={list.ready ? undefined : list.missing.join(' ')}
              onClick={() => dispatch({ type: 'startProject', projectId: project.id })}
            >
              Start the project and tell the {onJob} on the job
            </Btn>
          )}
          {started && <Chip tone="green">the {onJob} companies on the job were told</Chip>}
        </div>
        {!started && !list.ready && (
          <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', fontSize: '0.9rem', display: 'grid', gap: '0.15rem' }}>
            {list.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
          With {project.owner}
        </div>
        <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
          {list.owner.map((c) => (
            <div key={c.key} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Tick done={c.done} />
              <span style={{ flex: '1 1 16rem' }}>{c.label}</span>
              <span style={{ color: c.done ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{c.detail}</span>
              {c.key === 'startDate' ? (
                <input
                  type="date"
                  min={state.today}
                  value={project.startDate ?? ''}
                  disabled={started}
                  onChange={(e) => dispatch({ type: 'setStartDate', projectId: project.id, date: e.target.value })}
                  style={input}
                  aria-label="The day work starts"
                />
              ) : (
                !started && (
                  <Btn
                    kind={c.done ? 'quiet' : 'plain'}
                    onClick={() => dispatch({ type: 'setStartItem', projectId: project.id, item: c.key === 'permit' ? 'permit' : 'ownerContract', done: !c.done })}
                  >
                    {c.done ? 'Undo' : 'Mark it done'}
                  </Btn>
                )
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Trade</th>
              <th style={th}>Company</th>
              <th style={th}>Awarded</th>
              <th style={th}>Master agreement</th>
              <th style={th}>Insurance</th>
              <th style={th}>W-9</th>
              <th style={th}>Statement of work</th>
              <th style={th}>Next</th>
            </tr>
          </thead>
          <tbody>
            {list.trades.map((row) => (
              <TradeLine key={row.pkg.id} row={row} project={project} dispatch={dispatch} onSeePortal={onSeePortal} locked={started} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-label={done ? 'done' : 'not done'}
      style={{
        display: 'inline-flex',
        width: '1.25rem',
        height: '1.25rem',
        borderRadius: '50%',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 700,
        flexShrink: 0,
        background: done ? '#16a34a' : 'var(--bg-muted)',
        color: done ? 'white' : 'var(--text-muted)',
        border: done ? 'none' : '1px solid var(--border-strong)',
      }}
    >
      {done ? '✓' : ''}
    </span>
  )
}

function TradeLine({ row, project, dispatch, onSeePortal, locked }: Omit<GcPaneProps, 'state'> & { row: StartTradeRow; locked: boolean }) {
  const { pkg, partner, invite, checks } = row
  const ids = { projectId: project.id, packageId: pkg.id }
  if (pkg.selfPerform) {
    return (
      <tr>
        <td style={{ ...td, fontWeight: 600 }}>{pkg.trade}</td>
        <td style={td} colSpan={6}>
          <Chip tone="violet">We do this ourselves</Chip> {pkg.selfPerform.note}
        </td>
        <td style={td}><Chip tone="green">ready</Chip></td>
      </tr>
    )
  }
  const carried = pkg.invites.find((i) => i.id === pkg.carried)
  const first = checks.find((c) => !c.done)
  const sow = pkg.sow
  const blockedSow = partner ? partner.msa !== 'signed' || !partner.w9 || !checks.find((c) => c.key === 'coi')?.done : true

  let action: ReactNode = null
  if (!locked && first) {
    if (first.key === 'awarded' && carried) {
      action = (
        <Btn
          kind="primary"
          title={uncostedWords(uncostedLines(pkg, carried)) || undefined}
          onClick={() => dispatch({ type: 'award', ...ids, inviteId: carried.id })}
        >
          Award at {money(leveledTotal(pkg, carried) ?? 0)}
          {uncostedLines(pkg, carried).length > 0 ? ' + ?' : ''}
        </Btn>
      )
    } else if (first.key === 'msa' && partner?.msa === 'none') {
      action = <Btn kind="primary" onClick={() => dispatch({ type: 'sendMsa', partnerId: partner.id })}>Send the master agreement</Btn>
    } else if (first.key === 'sow' && sow?.status === 'draft' && !blockedSow) {
      action = <Btn kind="primary" onClick={() => dispatch({ type: 'sendSow', ...ids })}>Send the statement of work</Btn>
    } else if (partner && onSeePortal && (first.key === 'msa' || first.key === 'sow')) {
      action = <Btn kind="quiet" onClick={() => onSeePortal(partner.id)}>Sign it as them</Btn>
    }
  }

  return (
    <tr style={{ background: row.ready ? undefined : 'var(--bg-amber-tint)' }}>
      <td style={{ ...td, fontWeight: 600 }}>{pkg.trade}</td>
      <td style={td}>{partner?.company ?? (carried ? <span style={{ color: 'var(--text-muted)' }}>carrying a number, not awarded</span> : <span style={{ color: 'var(--text-red-700)' }}>no company</span>)}</td>
      {checks.map((c) => (
        <td key={c.key} style={td}>
          <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
            <Tick done={c.done} />
            <span style={{ fontSize: '0.8rem', color: c.done ? 'var(--text-600)' : 'var(--text-amber-800)' }}>{c.key === 'awarded' ? (invite ? '' : 'not yet') : c.detail}</span>
          </span>
        </td>
      ))}
      <td style={{ ...td, minWidth: '14rem' }}>
        {row.ready ? (
          <Chip tone="green">ready</Chip>
        ) : (
          <div style={{ display: 'grid', gap: '0.3rem', justifyItems: 'start' }}>
            <span style={{ fontSize: '0.85rem' }}>{row.next}</span>
            {action}
          </div>
        )}
      </td>
    </tr>
  )
}
