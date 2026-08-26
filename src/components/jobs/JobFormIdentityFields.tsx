import { useRef } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { SearchableSelect } from '../SearchableSelect'
import JobFormAddressNudge from './JobFormAddressNudge'

/* height 36 = the SearchableSelect trigger's rendered height — Job Name and
   Job Address sit flush with Service type and the number boxes (v2.1702). */
const JOB_FIELD_CLIPBOARD_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 36,
  boxSizing: 'border-box',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
}

const JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '0 0.5rem',
  paddingRight: '2.5rem',
  border: 'none',
  outline: 'none',
  fontSize: '0.875rem',
  background: 'transparent',
}

function ClipboardPasteGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }} aria-hidden>
      <path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z" />
    </svg>
  )
}

async function pasteTextToField(ref: RefObject<HTMLInputElement | null>, setValue: (v: string) => void) {
  ref.current?.focus()
  if (!document.execCommand('paste')) {
    try {
      const text = await navigator.clipboard.readText()
      setValue(text)
    } catch {
      /* clipboard not available */
    }
  }
}

type ServiceTypeOption = { id: string; name: string }

type JobFormIdentityFieldsProps = {
  hcpNumber: string
  setHcpNumber: (v: string) => void
  /**
   * v2.1533: hide the legacy HCP entry field (Settings → Jobs & dispatch flag).
   * The shell decides per open — jobs that already carry an HCP number always
   * keep the field so the value stays visible and editable.
   */
  hideHcpNumberField?: boolean
  clickNumber: string
  setClickNumber: (v: string) => void
  jobName: string
  setJobName: (v: string) => void
  jobAddress: string
  setJobAddress: (v: string) => void
  formServiceTypeId: string
  setFormServiceTypeId: (v: string) => void
  /** Shell's `jobFormServiceTypeSelectOptions` memo (role-filtered + current type injected in edit mode). */
  serviceTypeOptions: ServiceTypeOption[]
  /** Shell's `headerTradePill` memo — already null when not editing, so it doubles as the edit-mode gate. */
  tradePill: { label: string; style: CSSProperties } | null
  /** Closes the form (autosave flush) then navigates to the job on Jobs → Stages. */
  onTradePillClick: () => void
  /**
   * Job window (v2.1677): the window header already shows the "961 PLUM" pill,
   * so the label-side pill is redundant and the select shrinks to roughly the
   * label's width instead of flexing across the row.
   */
  embedded?: boolean
}

/**
 * The identity rows of the New/Edit Job modal: HCP / C# / Service type (+ the
 * edit-mode trade pill shortcut to Jobs → Stages), Job Name, and Last manual
 * bill date / Job Address. Fully controlled — every field is shell form state
 * the save engine and identity autosave slice read; the only state here is the
 * two input refs backing the clipboard-paste affordances.
 */
export function JobFormIdentityFields({
  hcpNumber,
  setHcpNumber,
  hideHcpNumberField = false,
  clickNumber,
  setClickNumber,
  jobName,
  setJobName,
  jobAddress,
  setJobAddress,
  formServiceTypeId,
  setFormServiceTypeId,
  serviceTypeOptions,
  tradePill,
  onTradePillClick,
  embedded = false,
}: JobFormIdentityFieldsProps) {
  const jobNameInputRef = useRef<HTMLInputElement | null>(null)
  const jobAddressInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      {/* One row on desktop: numbers · Service type · Job Name (owner call,
          v2.1697). Wrap lets Job Name (min 200px) drop to its own line on
          phones; the number fields still shrink three times as fast so the
          Service type column keeps its one-line label at 375px. */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {hideHcpNumberField ? null : (
          /* ~3-digit box (owner call, v2.1702) — HCP numbers are short. */
          <div style={{ flex: '0 0 3.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', minHeight: '1.4rem', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>HCP</label>
            <input
              type="text"
              value={hcpNumber}
              onChange={(e) => setHcpNumber(e.target.value)}
              placeholder="HCP"
              style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
            />
          </div>
        )}
        {/* 99% of C#s are under 5 digits (owner call, v2.1697) — a fixed
            ~5-digit box instead of a flexing column. */}
        <div style={{ flex: '0 0 4.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', minHeight: '1.4rem', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>C#</label>
          {/* height 36 = the SearchableSelect trigger's rendered height
              (0.5rem×2 padding + text line + border) — the owner wants the
              two boxes flush (v2.1697). */}
          <input
            type="text"
            value={clickNumber}
            onChange={(e) => setClickNumber(e.target.value)}
            placeholder="C#"
            style={{ width: '100%', boxSizing: 'border-box', height: 36, padding: '0 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
        </div>
        <div style={embedded ? { flex: '0 1 auto', minWidth: 0 } : { flex: '1 1 170px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: '1.4rem', marginBottom: 4, minWidth: 0 }}>
            <label
              htmlFor="job-form-service-type"
              style={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              Service type <span style={{ color: 'var(--text-red-700)' }}>*</span>
            </label>
            {tradePill && !embedded ? (
              <button
                type="button"
                onClick={onTradePillClick}
                title="Open this job in Jobs → Pipeline (closes Edit Job — your changes save automatically)"
                aria-label="Open this job in Jobs → Pipeline. Closes Edit Job; your changes save automatically."
                style={{ ...tradePill.style, marginTop: 0, cursor: 'pointer', flexShrink: 0 }}
              >
                {tradePill.label}
              </button>
            ) : null}
          </div>
          <div style={{ width: '100%', maxWidth: embedded ? 130 : 240, minWidth: embedded ? 110 : 0 }}>
            <SearchableSelect
              id="job-form-service-type"
              value={formServiceTypeId}
              onChange={setFormServiceTypeId}
              options={serviceTypeOptions.map((st) => ({ value: st.id, label: st.name }))}
              // No emptyOption row: the field is required, so "Select service
              // type…" lives only on the trigger as placeholder — the open list
              // offers real trades only (owner call, v2.1680).
              placeholder="Select service type…"
              required
              listAriaLabel="Service type"
              disabled={serviceTypeOptions.length === 0}
              // Match the HCP/C# inputs beside it (v2.1234): same 0.5rem vertical
              // padding + font size, so without the 44px floor the heights equalize.
              triggerMinHeightPx={0}
            />
          </div>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 200 }}>
          <label style={{ display: 'flex', alignItems: 'center', minHeight: '1.4rem', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Name <span style={{ color: 'var(--text-red-700)', marginLeft: '0.25rem' }}>*</span></label>
          <div style={{ ...JOB_FIELD_CLIPBOARD_WRAPPER_STYLE, position: 'relative' }}>
            <input
              ref={jobNameInputRef}
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Job name"
              style={JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE}
            />
            <button
              type="button"
              onClick={() => void pasteTextToField(jobNameInputRef, setJobName)}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0.25rem 0.4rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={jobName.trim() ? 'Replace with clipboard' : 'Paste from clipboard'}
              aria-label={jobName.trim() ? 'Replace job name with clipboard' : 'Paste job name from clipboard'}
            >
              <ClipboardPasteGlyph />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Address <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
          <div style={{ ...JOB_FIELD_CLIPBOARD_WRAPPER_STYLE, position: 'relative' }}>
            <input
              ref={jobAddressInputRef}
              type="text"
              value={jobAddress}
              onChange={(e) => setJobAddress(e.target.value)}
              placeholder="Address"
              style={JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE}
            />
            <button
              type="button"
              onClick={() => void pasteTextToField(jobAddressInputRef, setJobAddress)}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0.25rem 0.4rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={jobAddress.trim() ? 'Replace with clipboard' : 'Paste from clipboard'}
              aria-label={jobAddress.trim() ? 'Replace job address with clipboard' : 'Paste job address from clipboard'}
            >
              <ClipboardPasteGlyph />
            </button>
          </div>
          {/* Live statement preview + one-tap comma fix (v2.2323) — reacts to
              typing and to the paste button alike, since both go through
              setJobAddress. */}
          <JobFormAddressNudge address={jobAddress} onApply={setJobAddress} />
        </div>
      </div>
    </>
  )
}
