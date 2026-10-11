import { useState, type CSSProperties } from 'react'
import FieldPctUpdateModal from '../dashboard/FieldPctUpdateModal'
import { stageUsd } from '../../lib/bridge/stageFlow'
import type { PctPrompt, PctPromptRow } from '../../lib/bridge/pctPrompt'

/**
 * The percents prompt (v2.5245): one strip under the stage cards for the open
 * jobs with a contract and no percent, the Build card's grey. "Set the %s"
 * opens the list, biggest contract first; each row's Set opens the
 * dashboard's percent modal, which files a status report and mirrors the
 * percent the way the crews' saves do. The page patches the Build reads on
 * save, so the grey shrinks without a reload. Every press here is a real
 * button of its own, never a span inside a stage card.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const pill: CSSProperties = { font: 'inherit', fontSize: '0.82rem', padding: '0.25rem 0.75rem', borderRadius: 999, cursor: 'pointer', minHeight: 28, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', whiteSpace: 'nowrap' }
const amberPill: CSSProperties = { ...pill, fontWeight: 600, border: '1px solid var(--text-amber-800)', background: 'var(--bg-amber-tint, var(--surface))', color: 'var(--text-amber-800)' }

export function BridgePctPrompt({ prompt, onSaved }: { prompt: PctPrompt; onSaved: (jobId: string, pct: number) => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PctPromptRow['modalJob'] | null>(null)
  const toggleText = open ? 'Hide the list' : prompt.done ? 'Show the list' : 'Set the %s'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="bridge-pct-prompt">
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem 0.6rem' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: prompt.done ? 'var(--text-green-700)' : 'var(--text-amber-800)', flex: '0 0 auto' }} />
        <span style={label}>Jobs with no %</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text)', minWidth: 0, flex: '1 1 16rem' }} data-testid="bridge-pct-prompt-line">
          {prompt.line}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="bridge-pct-prompt-list" style={prompt.done ? pill : amberPill} data-testid="bridge-pct-prompt-toggle">
          {toggleText}
        </button>
      </div>
      {open && (
        <div id="bridge-pct-prompt-list" data-testid="bridge-pct-prompt-list">
          <div style={{ ...det, marginBottom: 4 }} data-testid="bridge-pct-prompt-note">
            Biggest contract first. Each set files a status report on the job, the way a crew's does.
          </div>
          {prompt.rows.map((r) => {
            const isSet = r.setPct != null
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', alignItems: 'center', gap: '0.25rem 0.75rem', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.82rem' }} data-testid="bridge-pct-prompt-row">
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: isSet ? 'var(--text-muted)' : 'var(--text)' }}>{r.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{stageUsd(r.contractUsd)}</span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: isSet ? 'var(--text-green-700)' : 'var(--text-amber-800)' }} data-testid="bridge-pct-prompt-status">
                  {r.status}
                </span>
                <button type="button" onClick={() => setEditing(r.modalJob)} aria-label={`${isSet ? 'Change' : 'Set'} the % on ${r.label}`} style={pill} data-testid="bridge-pct-prompt-set">
                  {isSet ? 'Change' : 'Set'}
                </button>
              </div>
            )
          })}
        </div>
      )}
      {editing && (
        <FieldPctUpdateModal
          job={editing}
          onClose={() => setEditing(null)}
          onSaved={(pct) => onSaved(editing.id, pct)}
        />
      )}
    </div>
  )
}
