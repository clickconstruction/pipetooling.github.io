import { useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { ContractPaper } from '../../lib/contracts/assemble'
import { savePaperSettings } from '../../lib/contracts/clausesIo'
import { EMPTY_SETTINGS_DEF, keyFromLabel, moveChoice, newChoice, settingsDefProblems, type PaperSetting, type SettingChoice, type SettingsDef } from '../../lib/contracts/paperSettings'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ClauseField, ClauseWindow } from './ClauseWindow'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from './clauseStyles'

const small: CSSProperties = { ...clauseButtonStyle, padding: '0.2rem 0.55rem', fontSize: '0.78rem' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.7rem', display: 'grid', gap: '0.45rem' }
const head: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }
const muted: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }
const row: CSSProperties = { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }
const field: CSSProperties = { ...clauseInputStyle, width: 'auto', flex: '1 1 160px', minWidth: 0 }

/** A name typed, then **Add**: the name makes the key, so a key is never typed. */
function AddByName({ label, press, onAdd }: { label: string; press: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) return
    onAdd(name.trim())
    setName('')
  }
  return (
    <div style={row}>
      <input aria-label={label} placeholder={label} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={field} />
      <button type="button" disabled={!name.trim()} onClick={add} style={small}>
        {press}
      </button>
    </div>
  )
}

/**
 * Punch list #389, step 1: a paper's **settings list**, for a controller or a dev. Each setting with its choices from
 * loosest to strictest, the blanks a clause may hold, and the named levels. It holds names and the plain words a
 * summary says, never clause wording. A key is made from a name when the thing is added and never changes after,
 * since clauses are tied to it. The kernel names every gap before the save (`settingsDefProblems`), and the database
 * checks again and refuses a list that drops what a live clause is tied to.
 */
export function PaperSettingsWindow({ paper, onClose, onSaved, save = savePaperSettings }: { paper: ContractPaper; onClose: () => void; onSaved: () => void; save?: typeof savePaperSettings }) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const had = paper.settingsDef != null
  const [def, setDef] = useState<SettingsDef>(() => paper.settingsDef ?? EMPTY_SETTINGS_DEF)
  const [spanish, setSpanish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const problems = useMemo(() => settingsDefProblems(def), [def])

  const setSetting = (key: string, change: (s: PaperSetting) => PaperSetting) => setDef((d) => ({ ...d, settings: d.settings.map((s) => (s.key === key ? change(s) : s)) }))
  const setChoice = (settingKey: string, choiceKey: string, change: (c: SettingChoice) => SettingChoice) =>
    setSetting(settingKey, (s) => ({ ...s, choices: s.choices.map((c) => (c.key === choiceKey ? change(c) : c)) }))

  const run = async (next: SettingsDef | null, toast: string) => {
    setBusy(true)
    setRefusal(null)
    try {
      await save(paper.id, next)
      showToast(toast, 'success')
      onSaved()
    } catch (e) {
      setRefusal(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const takeAway = async () => {
    if (!(await confirmDialog({ title: 'Take the settings list away', message: `${paper.title} goes back to a paper with no settings. A clause still tied to a choice stops this.`, confirmLabel: 'Take the list away', cancelLabel: 'Keep the list', danger: true }))) return
    await run(null, `${paper.title} has no settings list now.`)
  }

  const title = `Settings list of ${paper.title}`
  return (
    <ClauseWindow label={title} title={title} lede="Each setting, with its choices from loosest to strictest. No clause wording goes here." width={780} onClose={onClose}>
      {refusal && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {refusal}
        </div>
      )}
      <label style={{ ...row, fontSize: '0.82rem' }}>
        <input type="checkbox" checked={spanish} onChange={(e) => setSpanish(e.target.checked)} /> Show the Spanish fields. An empty one shows the English.
      </label>

      <div style={head}>Settings</div>
      {def.settings.length === 0 && <p style={muted}>None yet. Name the first setting below, such as a topic the paper may be stricter or looser on.</p>}
      {def.settings.map((s) => (
        <div key={s.key} data-paper-setting={s.key} style={card}>
          <div style={row}>
            <input aria-label={`Name of setting ${s.key}`} value={s.label} onChange={(e) => setSetting(s.key, (x) => ({ ...x, label: e.target.value }))} style={{ ...field, fontWeight: 600 }} />
            {spanish && <input aria-label={`Spanish name of ${s.label}`} placeholder="Spanish name" value={s.labelEs} onChange={(e) => setSetting(s.key, (x) => ({ ...x, labelEs: e.target.value }))} style={field} />}
            <button type="button" aria-label={`Remove the setting ${s.label}`} onClick={() => setDef((d) => ({ ...d, settings: d.settings.filter((x) => x.key !== s.key), levels: d.levels.map((l) => ({ ...l, picks: Object.fromEntries(Object.entries(l.picks).filter(([k]) => k !== s.key)) })) }))} style={small}>
              Remove
            </button>
          </div>
          {s.choices.map((c, i) => (
            <div key={c.key} data-paper-choice={c.key} style={{ display: 'grid', gap: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
              <div style={row}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: '4.6rem' }}>{i === 0 ? 'Loosest' : i === s.choices.length - 1 ? 'Strictest' : `Choice ${i + 1}`}</span>
                <input aria-label={`Name of choice ${i + 1} of ${s.label}`} value={c.label} onChange={(e) => setChoice(s.key, c.key, (x) => ({ ...x, label: e.target.value }))} style={field} />
                <button type="button" disabled={i === 0} aria-label={`Move ${c.label} looser`} onClick={() => setDef((d) => moveChoice(d, s.key, c.key, -1))} style={small}>
                  ↑
                </button>
                <button type="button" disabled={i === s.choices.length - 1} aria-label={`Move ${c.label} stricter`} onClick={() => setDef((d) => moveChoice(d, s.key, c.key, 1))} style={small}>
                  ↓
                </button>
                <button type="button" aria-label={`Remove the choice ${c.label} of ${s.label}`} onClick={() => setSetting(s.key, (x) => ({ ...x, choices: x.choices.filter((y) => y.key !== c.key) }))} style={small}>
                  Remove
                </button>
              </div>
              <input aria-label={`What the summary says for ${c.label} of ${s.label}`} placeholder="What the summary says for this choice, in plain words" value={c.says} onChange={(e) => setChoice(s.key, c.key, (x) => ({ ...x, says: e.target.value }))} style={clauseInputStyle} />
              {spanish && (
                <div style={row}>
                  <input aria-label={`Spanish name of ${c.label} of ${s.label}`} placeholder="Spanish name" value={c.labelEs} onChange={(e) => setChoice(s.key, c.key, (x) => ({ ...x, labelEs: e.target.value }))} style={field} />
                  <input aria-label={`What the summary says in Spanish for ${c.label} of ${s.label}`} placeholder="The summary's words in Spanish" value={c.saysEs} onChange={(e) => setChoice(s.key, c.key, (x) => ({ ...x, saysEs: e.target.value }))} style={{ ...field, flexBasis: 260 }} />
                </div>
              )}
              <label style={{ ...row, fontSize: '0.82rem' }}>
                <input type="checkbox" checked={c.out} onChange={(e) => setChoice(s.key, c.key, (x) => ({ ...x, out: e.target.checked }))} /> This choice leaves the topic out of the paper
              </label>
              {def.fields.map((f) => (
                <div key={f.key} style={row}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: '0 0 auto' }}>Fills {f.label || f.key} with</span>
                  <input
                    aria-label={`What ${c.label} of ${s.label} fills ${f.label || f.key} with`}
                    value={c.fills[f.key] ?? ''}
                    onChange={(e) => setChoice(s.key, c.key, (x) => ({ ...x, fills: withValue(x.fills, f.key, e.target.value) }))}
                    style={field}
                  />
                  {spanish && (
                    <input
                      aria-label={`What ${c.label} of ${s.label} fills ${f.label || f.key} with, in Spanish`}
                      placeholder="In Spanish"
                      value={c.fillsEs[f.key] ?? ''}
                      onChange={(e) => setChoice(s.key, c.key, (x) => ({ ...x, fillsEs: withValue(x.fillsEs, f.key, e.target.value) }))}
                      style={field}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          <AddByName label={`A new choice of ${s.label || 'this setting'}`} press="Add a choice" onAdd={(name) => setSetting(s.key, (x) => ({ ...x, choices: [...x.choices, newChoice(name, x.choices.map((c) => c.key))] }))} />
        </div>
      ))}
      <AddByName label="A new setting" press="Add a setting" onAdd={(name) => setDef((d) => ({ ...d, settings: [...d.settings, { key: keyFromLabel(name, d.settings.map((s) => s.key), 'setting'), label: name, labelEs: '', choices: [] }] }))} />

      <div style={head}>Blanks a clause may hold</div>
      <p style={muted}>A clause holds a blank as its key in braces. A choice can fill it, and the office can type it for one job.</p>
      {def.fields.map((f) => (
        <div key={f.key} data-paper-field={f.key} style={row}>
          <input aria-label={`Name of blank ${f.key}`} value={f.label} onChange={(e) => setDef((d) => ({ ...d, fields: d.fields.map((x) => (x.key === f.key ? { ...x, label: e.target.value } : x)) }))} style={field} />
          {spanish && <input aria-label={`Spanish name of blank ${f.key}`} placeholder="Spanish name" value={f.labelEs} onChange={(e) => setDef((d) => ({ ...d, fields: d.fields.map((x) => (x.key === f.key ? { ...x, labelEs: e.target.value } : x)) }))} style={field} />}
          <code style={{ fontSize: '0.8rem' }}>{`{${f.key}}`}</code>
          <button type="button" aria-label={`Remove the blank ${f.label || f.key}`} onClick={() => setDef((d) => withoutField(d, f.key))} style={small}>
            Remove
          </button>
        </div>
      ))}
      <AddByName label="A new blank" press="Add a blank" onAdd={(name) => setDef((d) => ({ ...d, fields: [...d.fields, { key: keyFromLabel(name, [...d.fields.map((f) => f.key), 'company', 'job'], 'blank'), label: name, labelEs: '' }] }))} />

      <div style={head}>Levels</div>
      <p style={muted}>A level is one pick for every setting, under a name and the kind of place it sits beside.</p>
      {def.levels.map((l) => (
        <div key={l.key} data-paper-level={l.key} style={card}>
          <div style={row}>
            <input aria-label={`Name of level ${l.key}`} value={l.label} onChange={(e) => setDef((d) => ({ ...d, levels: d.levels.map((x) => (x.key === l.key ? { ...x, label: e.target.value } : x)) }))} style={{ ...field, fontWeight: 600 }} />
            <input aria-label={`What ${l.label} is aligned with`} placeholder="Aligned with…" value={l.alignedWith} onChange={(e) => setDef((d) => ({ ...d, levels: d.levels.map((x) => (x.key === l.key ? { ...x, alignedWith: e.target.value } : x)) }))} style={{ ...field, flexBasis: 240 }} />
            <button type="button" aria-label={`Remove the level ${l.label}`} onClick={() => setDef((d) => ({ ...d, levels: d.levels.filter((x) => x.key !== l.key) }))} style={small}>
              Remove
            </button>
          </div>
          {spanish && (
            <div style={row}>
              <input aria-label={`Spanish name of level ${l.label}`} placeholder="Spanish name" value={l.labelEs} onChange={(e) => setDef((d) => ({ ...d, levels: d.levels.map((x) => (x.key === l.key ? { ...x, labelEs: e.target.value } : x)) }))} style={field} />
              <input aria-label={`What ${l.label} is aligned with, in Spanish`} placeholder="Aligned with, in Spanish" value={l.alignedWithEs} onChange={(e) => setDef((d) => ({ ...d, levels: d.levels.map((x) => (x.key === l.key ? { ...x, alignedWithEs: e.target.value } : x)) }))} style={{ ...field, flexBasis: 240 }} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem' }}>
            {def.settings.map((s) => (
              <ClauseField key={s.key} label={s.label || s.key}>
                <select
                  aria-label={`${l.label}: ${s.label}`}
                  value={l.picks[s.key] ?? ''}
                  onChange={(e) => setDef((d) => ({ ...d, levels: d.levels.map((x) => (x.key === l.key ? { ...x, picks: { ...x.picks, [s.key]: e.target.value } } : x)) }))}
                  style={clauseInputStyle}
                >
                  <option value="">Pick one</option>
                  {s.choices.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label || c.key}
                    </option>
                  ))}
                </select>
              </ClauseField>
            ))}
          </div>
        </div>
      ))}
      <AddByName label="A new level" press="Add a level" onAdd={(name) => setDef((d) => ({ ...d, levels: [...d.levels, { key: keyFromLabel(name, d.levels.map((l) => l.key), 'level'), label: name, labelEs: '', alignedWith: '', alignedWithEs: '', picks: {} }] }))} />

      {problems.length > 0 && (
        <div data-paper-settings-problems style={{ ...card, borderColor: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)' }}>
          <strong style={{ fontSize: '0.85rem' }}>Before this list can be saved</strong>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', display: 'grid', gap: 2 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <p style={muted}>Saving moves the paper one revision on, so an attorney's read made before it no longer names the paper.</p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {had && (
          <button type="button" disabled={busy} onClick={() => void takeAway()} style={{ ...clauseButtonStyle, marginRight: 'auto' }}>
            Take the settings list away
          </button>
        )}
        <button type="button" onClick={onClose} style={clauseButtonStyle}>
          Cancel
        </button>
        <button type="button" disabled={busy || problems.length > 0} onClick={() => void run(def, `The settings list of ${paper.title} is saved.`)} style={busy || problems.length > 0 ? { ...clausePrimaryStyle, ...DEAD } : clausePrimaryStyle}>
          {busy ? 'Saving…' : 'Save the settings list'}
        </button>
      </div>
    </ClauseWindow>
  )
}

const DEAD: CSSProperties = { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' }

/** A bag with one value set, or dropped when it is empty. */
function withValue(bag: Record<string, string>, key: string, value: string): Record<string, string> {
  const next = { ...bag }
  if (value === '') delete next[key]
  else next[key] = value
  return next
}

/** A list with one blank gone, and gone from every choice that filled it. */
function withoutField(def: SettingsDef, key: string): SettingsDef {
  const drop = (bag: Record<string, string>) => Object.fromEntries(Object.entries(bag).filter(([k]) => k !== key))
  return {
    ...def,
    fields: def.fields.filter((f) => f.key !== key),
    settings: def.settings.map((s) => ({ ...s, choices: s.choices.map((c) => ({ ...c, fills: drop(c.fills), fillsEs: drop(c.fillsEs) })) })),
  }
}
