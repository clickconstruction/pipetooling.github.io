import { useState } from 'react'
import { useConfirmDialog } from '../../../../contexts/ConfirmDialogContext'
import {
  EDITOR_WORDS,
  editQuickReply,
  historyHead,
  lastUsedWords,
  nameOf,
  REMOVE_ASK,
  removeQuickReply,
  restoreQuickReply,
  usedBy,
  versionWords,
  type QrResult,
  type QuickReply,
  type QuickReplyTags,
  type QuickReplyVersion,
  type StepsByKind,
} from '../../../../lib/quickReplies/kernel'
import { formatDenverDateTimeShort } from '../../../../utils/dateUtils'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn, input } from '../../gcUi'
import { QuickReplyTagFields } from './QuickRepliesEditorAdd'

/** The kernel's words for a change that went. */
const wordsOf = (r: QrResult): string => ('words' in r ? r.words : '')

/**
 * Messages, cut 3's screens: one line of the quick replies editor, opened in place (v1.73). Its words and its two tags
 * are fields; Save keeps the change, and the old words go to the history rather than away (`edit_quick_reply` writes a
 * version for the words and one for the tags, each only when it changed). **Remove this line…** asks first and keeps the
 * line in the history as removed; on the Removed tab the line reads only, with **Bring it back**. Under them, the
 * history: every version with what changed, who and when, then who used the line and when it was last used.
 *
 * The fields sit in one section (`data-qr-line-fields`) so a later field joins below the tags without moving them: the
 * residential build's Spanish words and the phone's short name go there.
 */
export function QuickRepliesEditorLine({
  line,
  versions,
  me,
  steps,
  names,
  contactNames,
  onSave,
  onRemove,
  onRestore,
  onClose,
}: {
  line: QuickReply
  versions: readonly QuickReplyVersion[]
  me: string
  steps: StepsByKind
  names: Readonly<Record<string, string>>
  /** The people the window can name in *last used … on*: the open thread's person. */
  contactNames: Readonly<Record<string, string>>
  onSave: (text: string, tags: QuickReplyTags) => Promise<void>
  onRemove: () => Promise<void>
  onRestore: () => Promise<void>
  /** Closes the line; with the words for the toast once something was done. */
  onClose: (words?: string, tone?: 'success' | 'info') => void
}) {
  const confirm = useConfirmDialog()
  const [text, setText] = useState(line.text)
  const [tags, setTags] = useState<QuickReplyTags>({ for: line.for, stepId: line.stepId })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const run = async (write: () => Promise<void>, words: string, fallback: string) => {
    setBusy(true)
    setProblem(null)
    try {
      await write()
      onClose(words)
    } catch (e) {
      setProblem(formatErrorMessage(e, fallback))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const result = editQuickReply(line, { text, tags }, me, Date.now())
    if ('error' in result) {
      setProblem(result.error)
      return
    }
    if (!result.versions.length) {
      onClose(result.words, 'info')
      return
    }
    void run(() => onSave(result.line.text, { for: result.line.for, stepId: result.line.stepId }), result.words, 'The line was not saved.')
  }

  const remove = async () => {
    const ok = await confirm({
      title: REMOVE_ASK.title,
      message: `“${line.text}”\n\n${REMOVE_ASK.words}`,
      confirmLabel: REMOVE_ASK.remove,
      cancelLabel: REMOVE_ASK.keep,
      danger: true,
      cancelIsSafe: true,
    })
    if (ok) void run(onRemove, wordsOf(removeQuickReply(line, me, Date.now())), 'The line was not removed.')
  }

  const restore = () => void run(onRestore, wordsOf(restoreQuickReply(line, me, Date.now())), 'The line was not brought back.')

  const used = usedBy(line)
  const head = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.04em' } as const
  const who = { color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' } as const

  return (
    <div data-qr-open={line.id} style={{ display: 'grid', gap: '0.55rem', padding: '0.6rem 0.7rem', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div data-qr-line-fields style={{ display: 'grid', gap: '0.5rem' }}>
        <textarea
          aria-label="The line's words"
          value={text}
          rows={2}
          disabled={busy || line.removed}
          onChange={(e) => setText(e.target.value)}
          style={{ ...input, resize: 'vertical', font: 'inherit' }}
        />
        <QuickReplyTagFields tags={tags} steps={steps} onTags={setTags} disabled={busy || line.removed} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {line.removed ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{EDITOR_WORDS.removedNote}</span>
        ) : (
          <>
            <Btn kind="primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Btn>
            <Btn onClick={() => onClose()} disabled={busy}>
              Cancel
            </Btn>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{EDITOR_WORDS.saveNote}</span>
          </>
        )}
        <span style={{ flex: 1 }} />
        {line.removed ? (
          <Btn kind="primary" onClick={restore} disabled={busy}>
            Bring it back
          </Btn>
        ) : (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-red-700)', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.82rem', padding: 0 }}
          >
            Remove this line…
          </button>
        )}
      </div>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}

      <div data-qr-history style={{ display: 'grid', gap: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
        <span style={head}>{historyHead(versions, line).join(' · ')}</span>
        {[...versions].reverse().map((v, i) => {
          const w = versionWords(v, steps)
          return (
            <div key={`${v.at}-${v.kind}-${i}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.84rem' }}>
              <span style={who}>
                {nameOf(names, v.by)} · {formatDenverDateTimeShort(v.at)}
              </span>
              <span>
                {w.did}
                {(w.struck || w.added) && ': '}
                {w.struck && <del style={{ color: 'var(--text-muted)' }}>{w.struck}</del>}
                {w.struck && w.added && ' → '}
                {w.added && <ins style={{ textDecoration: 'none', background: 'var(--bg-green-tint)' }}>{w.added}</ins>}
                {w.note && <span style={{ color: 'var(--text-muted)' }}> {w.note}</span>}
              </span>
            </div>
          )
        })}
        <div data-qr-used-by style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.84rem' }}>
          <span style={who}>Used by</span>
          {used.length ? (
            used.map((u) => (
              <span key={u.by}>
                <strong>{nameOf(names, u.by)}</strong> {u.count}
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>nobody yet</span>
          )}
          {line.lastUsed && (
            <span style={{ color: 'var(--text-muted)' }}>
              · {lastUsedWords(formatDenverDateTimeShort(line.lastUsed.at), (line.lastUsed.contactId && contactNames[line.lastUsed.contactId]) || null)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
