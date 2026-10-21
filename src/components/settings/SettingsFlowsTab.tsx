/**
 * Messages, cut 4: Settings → Flows (the prototype's `flowsEditorHtml`, v1.178; `BUILD_PLAN.md` → Cut 4). One flow per
 * kind of person, Customer, Trade partner, Architect, Residential customer and Sub (`EDITOR_KINDS`, the last two since
 * v2.5498, whose people the editor cannot read yet), each with The flow, History and How it is going. Every press
 * is an edit to a draft (`flows/editor.ts`); Before you save · who moves tries the draft on everyone first; Save writes
 * it all at once (`flow_save`) and the boards read it next. The office edits (`canEditFlows`, `gc_office_team()`).
 * Above the flow, the newest morning run of the reminders the app sends itself; on each such step, the owner's switch
 * (cut 5, `flows/appSends.ts`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConfirmDialog, usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAppSends } from '../../hooks/useAppSends'
import { useAuth } from '../../hooks/useAuth'
import { useFlowEditor, type EditorKind } from '../../hooks/useFlowEditor'
import { canSetAppSends, lastRunLine, READ_THE_RUN, type AppSendMode } from '../../lib/flows/appSends'
import { PUT_BACK_WORDS, restoreStep, WHO_MOVES_NOTE } from '../../lib/flows/editor'
import { EDITOR_KINDS, PEOPLE_NOT_READ, readsPeopleOf } from '../../lib/flows/editorKinds'
import { askForFact, loadDocNames, loadSeats, loadTradeNames } from '../../lib/flows/flowEditorIo'
import { isDocPaperId } from '../../lib/flows/facts'
import { flat, type FlowStep } from '../../lib/flows/state'
import { formatErrorMessage } from '../../utils/errorHandling'
import { FlowGoing, FlowHistory } from './flows/FlowHistoryAndGoing'
import { FlowStepsTable } from './flows/FlowStepsTable'
import { flowButton, flowNote, flowPrimary, flowQuiet, flowTab } from './flows/flowStyles'

type View = 'flow' | 'history' | 'going'

/** Settings → Flows' lede, which renders before the flow loads (`e2e/settings-tabs.spec.ts` looks for it). */
export const FLOWS_LEDE =
  'One flow for each kind of person. A step finishes on facts the app already keeps, picked from a list. The office changes the steps, whose move each is, the nudge, the papers and the order. Every change is tried on everyone before you save.'

/** `now` is the day the flow is read on; the render smokes pin it. */
/** The flow a `?kind=` names, else the trades'. */
function kindFromParam(k: string | null): EditorKind {
  return k && EDITOR_KINDS.some(([kind]) => kind === k) ? (k as EditorKind) : 'trade'
}

export function SettingsFlowsTab({ now }: { now?: () => Date } = {}) {
  const { showToast } = useToastContext()
  const prompt = usePromptDialog()
  const confirm = useConfirmDialog()
  const { profileName, role } = useAuth()
  const by = profileName?.trim() || 'someone'
  // `?kind=` lands on a flow (punch list #140 PR 2; since v2.5720 the switch card's Reminders door lands on Phone and
  // texts' own card instead, and `?kind=` stays for the links already out).
  const [params] = useSearchParams()
  const [kind, setKind] = useState<EditorKind>(() => kindFromParam(params.get('kind')))
  const [view, setView] = useState<View>('flow')
  const editor = useFlowEditor(kind, { now })
  const appSends = useAppSends()
  const [runOpen, setRunOpen] = useState(false)
  const nowIso = (now ?? (() => new Date()))().toISOString()
  const [seats, setSeats] = useState<{ id: string; name: string }[]>([])
  const [trades, setTrades] = useState<string[]>([])
  const [docNames, setDocNames] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadSeats().then(setSeats).catch(() => setSeats([]))
    void loadTradeNames().then(setTrades).catch(() => setTrades([]))
  }, [])

  // The library papers on any step, named as the library names them.
  const docIds = useMemo(() => {
    const steps = editor.draft ? [...flat(editor.draft.flow), ...editor.draft.removed.map((r) => r.step)] : []
    return [...new Set(steps.flatMap((s) => (s.papers as readonly string[]).filter(isDocPaperId).map((p) => p.slice(4))))].sort()
  }, [editor.draft])
  const docKey = docIds.join(',')
  useEffect(() => {
    if (!docKey) return
    void loadDocNames(docKey.split(','))
      .then((names) => setDocNames((was) => ({ ...was, ...names })))
      .catch(() => undefined)
  }, [docKey])

  const usual = useMemo(() => Object.fromEntries((editor.going?.rows ?? []).map((r) => [r.stepId, r.usual])), [editor.going])
  const say = useCallback((words: string) => showToast(words, 'error'), [showToast])

  const ask = async (step: FlowStep) => {
    const text = await prompt({
      title: 'Ask for a fact that is missing',
      message: `The fact, in words. It is written down for the build, with the step it is for (${step.name}). Until the app keeps it, the step cannot read it.`,
      placeholder: 'their safety orientation is done',
      confirmLabel: 'Ask for it',
    })
    if (text === null) return
    if (!text.trim()) {
      showToast('Write the fact, or Cancel.', 'error')
      return
    }
    try {
      await askForFact(kind, step.id, text, by)
      showToast('Written down for the build, with the step it is for.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    }
  }

  const save = async () => {
    const done = await editor.save(by)
    showToast(done.words, done.ok ? 'success' : 'error')
  }

  const flipAppSend = async (step: FlowStep, mode: AppSendMode) => {
    const done = await appSends.set(kind, step, mode)
    showToast(done.words, done.ok ? 'success' : 'error')
  }
  const runWords = appSends.read?.lastRun?.words ?? []

  const draft = editor.draft
  const changed = !!draft && draft.changes.length > 0
  const historyCount = (editor.kept?.history.length ?? 0) + (draft?.removed.length ?? 0)

  const pickKind = async (k: EditorKind) => {
    if (k === kind) return
    if (changed) {
      const leave = await confirm({
        title: 'Leave this flow?',
        message: 'Your changes to it are not saved. They go if you leave.',
        confirmLabel: 'Leave it',
        cancelLabel: 'Stay',
        danger: true,
        cancelIsSafe: true,
      })
      if (!leave) return
    }
    setKind(k)
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }} data-settings-flows>
      <p style={flowNote}>{FLOWS_LEDE}</p>
      <div data-flows-last-run style={{ display: 'grid', gap: '0.25rem' }}>
        <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.85rem' }}>
          <span>
            {appSends.read
              ? lastRunLine(appSends.read.lastRun, nowIso)
              : appSends.problem
                ? `The morning run did not read. ${appSends.problem}`
                : 'Reading the morning run…'}
          </span>
          {runWords.length > 0 && (
            <button type="button" aria-expanded={runOpen} onClick={() => setRunOpen((o) => !o)} style={flowQuiet}>
              {READ_THE_RUN}
            </button>
          )}
        </span>
        {runOpen && runWords.length > 0 && (
          <ul aria-label="The morning run" style={{ ...flowNote, margin: 0, paddingLeft: '1.1rem' }}>
            {runWords.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
      <div role="tablist" aria-label="Which flow" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {EDITOR_KINDS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => void pickKind(k)} style={flowTab(kind === k)}>
            {label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {(
          [
            ['flow', 'The flow'],
            ['history', `History · ${historyCount}`],
            ['going', 'How it is going'],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} style={flowTab(view === v)}>
            {label}
          </button>
        ))}
      </div>

      {editor.problem && (
        <p role="alert" style={{ ...flowNote, color: 'var(--text-red-600)' }}>
          {editor.problem}{' '}
          <button type="button" onClick={() => void editor.reload()} style={flowButton}>
            Try again
          </button>
        </p>
      )}
      {!draft && !editor.problem && <p style={flowNote}>Reading the flow…</p>}
      {draft && editor.kept?.fromSeed && view === 'flow' && (
        <p style={flowNote}>This is the flow as the app first drew it. Save writes it, with your changes.</p>
      )}

      {draft && view === 'flow' && (
        <FlowStepsTable
          kind={kind}
          draft={draft}
          board={editor.board}
          usual={usual}
          seats={seats}
          docNames={docNames}
          trades={trades}
          edit={editor.edit}
          say={say}
          by={by}
          onAskForFact={(step) => void ask(step)}
          onPaperMade={(paper) => setDocNames((was) => ({ ...was, [paper.paperId.slice(4)]: paper.label }))}
          appSends={
            appSends.read
              ? {
                  sends: appSends.read.sends,
                  canSet: canSetAppSends(role),
                  saved: editor.kept?.flow ?? null,
                  quickReplies: appSends.read.quickReplies,
                  busy: appSends.busy,
                  onSet: (step, mode) => void flipAppSend(step, mode),
                }
              : undefined
          }
        />
      )}
      {draft && view === 'history' && editor.kept && (
        <FlowHistory
          draft={draft}
          history={editor.kept.history}
          drawnAt={editor.kept.drawnAt}
          onPutBack={(stepId) => {
            const refused = editor.edit((d) => restoreStep(d, stepId))
            if (refused) say(refused)
          }}
        />
      )}
      {view === 'going' &&
        (!readsPeopleOf(kind) ? (
          <p style={flowNote}>{PEOPLE_NOT_READ}</p>
        ) : editor.going ? (
          <FlowGoing rows={editor.going.rows} funnel={editor.going.funnel} />
        ) : (
          <p style={flowNote}>Reading who is on the flow…</p>
        ))}

      {changed && (
        <div
          aria-label="Before you save"
          style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem' }}
        >
          <strong>Before you save · who moves</strong>
          <p style={flowNote}>{WHO_MOVES_NOTE}</p>
          {editor.preview && editor.preview.lines.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.1rem', fontSize: '0.85rem' }}>
              {editor.preview.lines.map((l) => (
                <div key={l.contactId} style={{ fontWeight: l.moved ? 600 : 400 }}>
                  {l.name}: {l.words}
                </div>
              ))}
            </div>
          ) : (
            <p style={flowNote}>{readsPeopleOf(kind) ? 'Nobody is on this flow yet.' : PEOPLE_NOT_READ}</p>
          )}
          {editor.preview?.changes && <p style={{ ...flowNote, color: 'var(--text-base)' }}>{editor.preview.changes}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" disabled={editor.saving} onClick={() => void save()} style={flowPrimary}>
              {editor.saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={editor.saving}
              onClick={() => {
                editor.putBack()
                showToast(PUT_BACK_WORDS, 'success')
              }}
              style={flowButton}
            >
              Put it back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
