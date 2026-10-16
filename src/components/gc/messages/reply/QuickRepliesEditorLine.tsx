import { useRef, useState } from 'react'
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
  type QuickReplyEdit,
  type QuickReplyTags,
  type QuickReplyVersion,
  type StepsByKind,
} from '../../../../lib/quickReplies/kernel'
import type { BlankFills } from '../../../../lib/quickReplies/blanks'
import { BLANK_CHIPS, insertBlank, preview } from '../../../../lib/quickReplies/filling'
import { shortName } from '../../../../lib/quickReplies/phone'
import { PHONE_TAB_WORDS, nextPhonePlace, phoneTick } from '../../../../lib/quickReplies/phoneTab'
import { PHONE_PRESSES, PRESS_PICKER, PRESS_WORDS, phonePressOf, type PhonePress } from '../../../../lib/quickReplies/press'
import { SPANISH_WORDS, spanishOffered } from '../../../../lib/quickReplies/spanish'
import { formatDenverDateTimeShort } from '../../../../utils/dateUtils'
import { formatErrorMessage } from '../../../../utils/errorHandling'
import { Btn, input } from '../../gcUi'
import { FilledLine } from './FilledLine'
import { QuickReplyTagFields } from './QuickRepliesEditorAdd'

/** R3's three parts of a Save, each only when it changed, so a Save of words and tags alone stays as it was. */
export type LineR3 = Pick<QuickReplyEdit, 'textEs' | 'phoneOrder' | 'phoneName' | 'phonePress'>

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
 *
 * R3 (the residential prototype v0.8's `editRow`): under the words, a chip for each blank puts it at the cursor, and a
 * preview shows the line as it would go, with what the box leaves to the person. Below the tags, a line for customers
 * takes its Spanish, and the team's lines for customers take the tick **On the tech’s phone** and a short name. A
 * ticked line goes after the last on the phone; the **Phone** tab moves it. Moved away from customers, it comes off.
 */
export function QuickRepliesEditorLine({
  line,
  lines = [],
  versions,
  me,
  steps,
  names,
  contactNames,
  fills = {},
  previewTo = null,
  onSave,
  onRemove,
  onRestore,
  onClose,
}: {
  line: QuickReply
  /** Every line the window read, so a ticked line goes after the last on the phone. */
  lines?: readonly QuickReply[]
  versions: readonly QuickReplyVersion[]
  me: string
  steps: StepsByKind
  names: Readonly<Record<string, string>>
  /** The people the window can name in *last used … on*: the open thread's person. */
  contactNames: Readonly<Record<string, string>>
  /** What the box fills on a press, for the preview. */
  fills?: BlankFills
  /** The open thread's person, by first name, for the preview's *As it would go to*. */
  previewTo?: string | null
  onSave: (text: string, tags: QuickReplyTags, r3: LineR3) => Promise<void>
  onRemove: () => Promise<void>
  onRestore: () => Promise<void>
  /** Closes the line; with the words for the toast once something was done. */
  onClose: (words?: string, tone?: 'success' | 'info') => void
}) {
  const confirm = useConfirmDialog()
  const [text, setText] = useState(line.text)
  const [tags, setTags] = useState<QuickReplyTags>({ for: line.for, stepId: line.stepId })
  const [es, setEs] = useState(line.textEs ?? '')
  const [onPhone, setOnPhone] = useState(line.phoneOrder != null)
  const [phoneName, setPhoneName] = useState(line.phoneName ?? '')
  /** v2.5573: the big button this line is, or null. Off the phone, a line is no big button. */
  const [press, setPress] = useState<PhonePress | null>(line.phonePress ?? null)
  const words = useRef<HTMLTextAreaElement>(null)
  const tick = phoneTick({ for: tags.for, scope: line.scope })
  const shown = preview(text, fills, previewTo)

  /** A chip's blank at the cursor in the words, the caret after it. */
  const putBlank = (key: string) => {
    const box = words.current
    const next = insertBlank(text, box?.selectionStart ?? text.length, box?.selectionEnd ?? text.length, key)
    setText(next.text)
    // After the new words render, so the caret lands after the blank.
    window.setTimeout(() => {
      box?.focus()
      box?.setSelectionRange(next.caret, next.caret)
    }, 0)
  }

  /** R3's parts that changed. A line that can no longer be on the phone comes off it. */
  const r3 = (): LineR3 => {
    const out: LineR3 = {}
    const wantEs = spanishOffered(tags) ? es.trim() || null : (line.textEs ?? null)
    if (wantEs !== (line.textEs ?? null)) out.textEs = wantEs
    const place = onPhone && tick.can ? (line.phoneOrder ?? nextPhonePlace(lines)) : null
    if (place !== (line.phoneOrder ?? null)) out.phoneOrder = place
    const name = tick.can ? phoneName.trim() || null : (line.phoneName ?? null)
    if (name !== (line.phoneName ?? null)) out.phoneName = name
    const wantPress = place != null ? press : null
    if (wantPress !== (line.phonePress ?? null)) out.phonePress = wantPress
    return out
  }
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
    const parts = r3()
    const result = editQuickReply(line, { text, tags, ...parts }, me, Date.now())
    if ('error' in result) {
      setProblem(result.error)
      return
    }
    if (!result.versions.length) {
      onClose(result.words, 'info')
      return
    }
    void run(() => onSave(result.line.text, { for: result.line.for, stepId: result.line.stepId }, parts), result.words, 'The line was not saved.')
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
          ref={words}
          aria-label="The line's words"
          value={text}
          rows={2}
          disabled={busy || line.removed}
          onChange={(e) => setText(e.target.value)}
          style={{ ...input, resize: 'vertical', font: 'inherit' }}
        />
        {!line.removed && (
          <div data-qr-chips role="group" aria-label="Put a blank in the words" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {BLANK_CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                title={`${c.label}: ${c.words}. Puts it in the words where the cursor is.`}
                disabled={busy}
                onClick={() => putBlank(c.key)}
                style={{ border: `1px ${c.theirs ? 'dashed' : 'solid'} var(--border)`, borderRadius: 999, background: 'var(--surface)', padding: '0.05rem 0.5rem', cursor: 'pointer', fontSize: '0.74rem' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div data-qr-preview style={{ fontSize: '0.84rem', padding: '0.35rem 0.5rem', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <FilledLine text={text} fills={fills} />
          <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{shown.note}</span>
        </div>
        <QuickReplyTagFields tags={tags} steps={steps} onTags={setTags} disabled={busy || line.removed} />
        {spanishOffered(tags) && (
          <label style={{ display: 'grid', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-600)' }}>
              {SPANISH_WORDS.label}
              {!es.trim() && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {SPANISH_WORDS.none}</span>}
            </span>
            <textarea
              aria-label="The line in Spanish"
              value={es}
              rows={2}
              lang="es"
              placeholder={SPANISH_WORDS.placeholder}
              disabled={busy || line.removed}
              onChange={(e) => setEs(e.target.value)}
              style={{ ...input, resize: 'vertical', font: 'inherit' }}
            />
          </label>
        )}
        <label data-qr-phone-tick style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.84rem' }}>
          <input type="checkbox" checked={onPhone && tick.can} disabled={busy || line.removed || !tick.can} onChange={(e) => setOnPhone(e.target.checked)} />
          <span>{PHONE_TAB_WORDS.tick}</span>
          {!tick.can && <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{tick.why}</span>}
        </label>
        {tick.can && (
          <label style={{ display: 'grid', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-600)' }}>
              {PHONE_TAB_WORDS.name}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {PHONE_TAB_WORDS.nameNote}</span>
            </span>
            <input
              aria-label={PHONE_TAB_WORDS.name}
              value={phoneName}
              maxLength={60}
              placeholder={shortName({ text, phoneName: null }, fills)}
              disabled={busy || line.removed}
              onChange={(e) => setPhoneName(e.target.value)}
              style={{ ...input, maxWidth: '22rem' }}
            />
          </label>
        )}
        {tick.can && onPhone && (
          <label style={{ display: 'grid', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-600)' }}>
              {PRESS_PICKER.label}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {PRESS_PICKER.note}</span>
            </span>
            <select
              aria-label={PRESS_PICKER.label}
              value={press ?? ''}
              disabled={busy || line.removed}
              onChange={(e) => setPress(phonePressOf(e.target.value))}
              style={{ ...input, maxWidth: '22rem' }}
              data-testid="qr-press"
            >
              <option value="">{PRESS_PICKER.none}</option>
              {PHONE_PRESSES.map((p) => (
                <option key={p} value={p}>
                  {PRESS_WORDS[p]}
                </option>
              ))}
            </select>
          </label>
        )}
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
