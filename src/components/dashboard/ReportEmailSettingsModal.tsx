import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { SearchableSelect } from '../SearchableSelect'
import { SearchableMultiSelect } from '../SearchableMultiSelect'
import {
  deleteReportEmailSubscription,
  loadReportEmailSubscriptions,
  saveReportEmailSubscription,
  validateSubscriptionDraft,
  type RecipientKind,
  type SubscriptionDraft,
} from '../../lib/reportEmailSubscriptions'

interface RosterUser {
  id: string
  name: string
  email: string | null
}

interface EditorState {
  key: string
  /** Persisted subscription id, or undefined for a new unsaved row. */
  id?: string
  draft: SubscriptionDraft
  dirty: boolean
  saving: boolean
  sendingNow: boolean
  error: string | null
  sendResult: string | null
}

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  zIndex: 70,
  padding: '2rem 1rem',
  overflowY: 'auto',
}

const CARD_STYLE: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.85rem',
  marginBottom: '0.75rem',
  background: 'var(--bg-subtle)',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: '0.25rem',
}

const TEXT_INPUT_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.55rem',
  fontSize: '0.875rem',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  boxSizing: 'border-box',
}

function segBtnStyle(active: boolean): CSSProperties {
  return {
    padding: '0.3rem 0.6rem',
    fontSize: '0.8125rem',
    fontWeight: active ? 600 : 400,
    border: '1px solid var(--border-strong)',
    background: active ? '#3b82f6' : 'var(--surface)',
    color: active ? 'white' : 'var(--text-strong)',
    cursor: 'pointer',
  }
}

function blankDraft(): SubscriptionDraft {
  return {
    recipientKind: 'user',
    recipientUserId: null,
    recipientEmail: '',
    label: '',
    allAuthors: true,
    authorUserIds: [],
    autoSend: true,
    enabled: true,
  }
}

let editorKeySeq = 0
function nextEditorKey(): string {
  editorKeySeq += 1
  return `editor-${editorKeySeq}`
}

export function ReportEmailSettingsModal({
  open,
  onClose,
  authUserId,
}: {
  open: boolean
  onClose: () => void
  authUserId: string | undefined
}) {
  const { showToast } = useToastContext()
  const [roster, setRoster] = useState<RosterUser[]>([])
  const [editors, setEditors] = useState<EditorState[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [{ data: rosterData, error: rosterErr }, subs] = await Promise.all([
        supabase.from('users').select('id, name, email').is('archived_at', null).order('name').limit(500),
        loadReportEmailSubscriptions(),
      ])
      if (rosterErr) throw rosterErr
      setRoster((rosterData ?? []) as RosterUser[])
      setEditors(
        subs.map((s) => ({
          key: nextEditorKey(),
          id: s.subscription.id,
          draft: {
            recipientKind: (s.subscription.recipient_user_id ? 'user' : 'email') as RecipientKind,
            recipientUserId: s.subscription.recipient_user_id,
            recipientEmail: s.subscription.recipient_email ?? '',
            label: s.subscription.label ?? '',
            allAuthors: s.subscription.all_authors,
            authorUserIds: s.authorUserIds,
            autoSend: s.subscription.auto_send,
            enabled: s.subscription.enabled,
          },
          dirty: false,
          saving: false,
          sendingNow: false,
          error: null,
          sendResult: null,
        })),
      )
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load report-email settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const rosterOptions = useMemo(
    () =>
      roster.map((u) => ({
        value: u.id,
        label: u.email ? `${u.name} (${u.email})` : u.name,
      })),
    [roster],
  )

  const patchEditor = useCallback((key: string, patch: Partial<EditorState>) => {
    setEditors((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }, [])

  const patchDraft = useCallback(
    (key: string, patch: Partial<SubscriptionDraft>) => {
      setEditors((prev) =>
        prev.map((e) =>
          e.key === key ? { ...e, draft: { ...e.draft, ...patch }, dirty: true, error: null } : e,
        ),
      )
    },
    [],
  )

  const addRecipient = useCallback(() => {
    setEditors((prev) => [
      ...prev,
      {
        key: nextEditorKey(),
        draft: blankDraft(),
        dirty: true,
        saving: false,
        sendingNow: false,
        error: null,
        sendResult: null,
      },
    ])
  }, [])

  const handleSave = useCallback(
    async (editor: EditorState) => {
      if (!authUserId) return
      const valid = validateSubscriptionDraft(editor.draft)
      if (!valid.ok) {
        patchEditor(editor.key, { error: valid.error })
        return
      }
      patchEditor(editor.key, { saving: true, error: null })
      try {
        const id = await saveReportEmailSubscription(editor.draft, authUserId, editor.id)
        patchEditor(editor.key, { id, saving: false, dirty: false })
        showToast('Report email recipient saved.', 'success')
      } catch (e) {
        patchEditor(editor.key, {
          saving: false,
          error: e instanceof Error ? e.message : 'Could not save.',
        })
      }
    },
    [authUserId, patchEditor, showToast],
  )

  const handleDelete = useCallback(
    async (editor: EditorState) => {
      if (!editor.id) {
        setEditors((prev) => prev.filter((e) => e.key !== editor.key))
        return
      }
      patchEditor(editor.key, { saving: true })
      try {
        await deleteReportEmailSubscription(editor.id)
        setEditors((prev) => prev.filter((e) => e.key !== editor.key))
        showToast('Recipient removed.', 'success')
      } catch (e) {
        patchEditor(editor.key, {
          saving: false,
          error: e instanceof Error ? e.message : 'Could not remove.',
        })
      }
    },
    [patchEditor, showToast],
  )

  const handleSendNow = useCallback(
    async (editor: EditorState) => {
      if (!editor.id) return
      patchEditor(editor.key, { sendingNow: true, sendResult: null, error: null })
      try {
        const { data, error } = await supabase.functions.invoke('send-report-email', {
          body: { mode: 'manual', subscription_id: editor.id },
        })
        if (error) throw error
        const sent = (data as { sent?: number } | null)?.sent ?? 0
        patchEditor(editor.key, {
          sendingNow: false,
          sendResult:
            sent === 0 ? 'No new reports to send (already up to date).' : `Emailed ${sent} report${sent === 1 ? '' : 's'}.`,
        })
      } catch (e) {
        patchEditor(editor.key, {
          sendingNow: false,
          error: e instanceof Error ? e.message : 'Could not send.',
        })
      }
    },
    [patchEditor],
  )

  if (!open) return null

  return (
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report email settings"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '1.25rem',
          width: 'min(640px, 100%)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Report email recipients</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          People here get reports emailed to them — every report, or only reports from selected people.
          Reports are emailed automatically when filed (if “Auto-send” is on), and you can also send recent
          ones now.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : loadError ? (
          <p style={{ color: 'var(--text-red-700)' }}>{loadError}</p>
        ) : (
          <>
            {editors.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No recipients yet. Add one below.
              </p>
            )}
            {editors.map((editor) => (
              <div key={editor.key} style={CARD_STYLE}>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <button type="button" onClick={() => patchDraft(editor.key, { recipientKind: 'user' })} style={segBtnStyle(editor.draft.recipientKind === 'user')}>
                    App user
                  </button>
                  <button type="button" onClick={() => patchDraft(editor.key, { recipientKind: 'email' })} style={segBtnStyle(editor.draft.recipientKind === 'email')}>
                    External email
                  </button>
                </div>

                {editor.draft.recipientKind === 'user' ? (
                  <div style={{ marginBottom: '0.6rem' }}>
                    <span style={LABEL_STYLE}>Recipient</span>
                    <SearchableSelect
                      value={editor.draft.recipientUserId ?? ''}
                      onChange={(v) => patchDraft(editor.key, { recipientUserId: v || null })}
                      options={rosterOptions}
                      placeholder="Pick a person…"
                      searchable
                      searchReplacesTrigger
                      listAriaLabel="Recipient"
                      portalZIndex={1200}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <span style={LABEL_STYLE}>Email address</span>
                      <input
                        type="email"
                        value={editor.draft.recipientEmail}
                        onChange={(e) => patchDraft(editor.key, { recipientEmail: e.target.value })}
                        placeholder="owner@example.com"
                        style={TEXT_INPUT_STYLE}
                      />
                    </div>
                    <div style={{ flex: '1 1 160px' }}>
                      <span style={LABEL_STYLE}>Label (optional)</span>
                      <input
                        type="text"
                        value={editor.draft.label}
                        onChange={(e) => patchDraft(editor.key, { label: e.target.value })}
                        placeholder="e.g. Owner"
                        style={TEXT_INPUT_STYLE}
                      />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '0.6rem' }}>
                  <span style={LABEL_STYLE}>Which reports</span>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name={`scope-${editor.key}`}
                        checked={editor.draft.allAuthors}
                        onChange={() => patchDraft(editor.key, { allAuthors: true })}
                      />
                      All reports
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name={`scope-${editor.key}`}
                        checked={!editor.draft.allAuthors}
                        onChange={() => patchDraft(editor.key, { allAuthors: false })}
                      />
                      Only from selected people
                    </label>
                  </div>
                  {!editor.draft.allAuthors && (
                    <SearchableMultiSelect
                      options={rosterOptions}
                      value={editor.draft.authorUserIds}
                      onChange={(ids) => patchDraft(editor.key, { authorUserIds: ids })}
                      listAriaLabel="Report authors"
                      searchPlaceholder="Search people…"
                      pinSelectedToTop
                    />
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={editor.draft.autoSend}
                      onChange={(e) => patchDraft(editor.key, { autoSend: e.target.checked })}
                    />
                    Auto-send new reports
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={editor.draft.enabled}
                      onChange={(e) => patchDraft(editor.key, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                {editor.error && (
                  <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>{editor.error}</p>
                )}
                {editor.sendResult && (
                  <p style={{ color: 'var(--text-green-700)', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>{editor.sendResult}</p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleSave(editor)}
                    disabled={editor.saving || !editor.dirty}
                    style={{
                      padding: '0.35rem 0.9rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: 4,
                      background: editor.dirty ? '#3b82f6' : 'var(--bg-muted)',
                      color: editor.dirty ? 'white' : 'var(--text-muted)',
                      cursor: editor.saving || !editor.dirty ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {editor.saving ? '…' : editor.dirty ? 'Save' : 'Saved'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendNow(editor)}
                    disabled={!editor.id || editor.dirty || editor.sendingNow}
                    title={editor.dirty ? 'Save first' : 'Email recent matching reports now'}
                    style={{
                      padding: '0.35rem 0.9rem',
                      fontSize: '0.875rem',
                      background: 'none',
                      color: 'var(--text-link)',
                      border: '1px solid #2563eb',
                      borderRadius: 4,
                      cursor: !editor.id || editor.dirty || editor.sendingNow ? 'not-allowed' : 'pointer',
                      opacity: !editor.id || editor.dirty ? 0.5 : 1,
                    }}
                  >
                    {editor.sendingNow ? 'Sending…' : 'Send now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(editor)}
                    disabled={editor.saving}
                    style={{
                      padding: '0.35rem 0.9rem',
                      fontSize: '0.875rem',
                      background: 'none',
                      color: 'var(--text-red-700)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addRecipient}
              style={{
                marginTop: '0.25rem',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: '1px dashed var(--border-strong)',
                borderRadius: 6,
                background: 'none',
                color: 'var(--text-link)',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              + Add recipient
            </button>
          </>
        )}
      </div>
    </div>
  )
}
