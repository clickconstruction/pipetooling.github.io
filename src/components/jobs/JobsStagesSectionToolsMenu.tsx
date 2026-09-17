/**
 * The Pipeline jump strip's ☰ section-tools menu (Stages tab decomposition PR 11, v2.3549):
 * the stage section headers' action buttons, reachable from the strip without scrolling
 * (v2.1419, in-strip since v2.1421). Moved verbatim out of `JobsStagesTab.tsx`. The open
 * flag is its own — nothing else read it; the items come from the tested kernel
 * `buildStagesSectionToolsMenu`; the tab keeps the fourteen doors in `onSelect`.
 */
import { useState } from 'react'
import GcHardHatIcon from '../icons/GcHardHatIcon'
import { buildStagesSectionToolsMenu, type StagesSectionToolKey } from '../../lib/jobs/stagesSectionToolsMenu'
import StagesSectionToolsIcon from '../icons/StagesSectionToolsIcon'
import { stagesToolsMenuItemStyle } from './stagesToolsMenuStyles'

export type JobsStagesSectionToolsMenuInputs = Parameters<typeof buildStagesSectionToolsMenu>[0]

export function JobsStagesSectionToolsMenu({
  inputs,
  onSelect,
}: {
  inputs: JobsStagesSectionToolsMenuInputs
  /** One door per item key; the menu closes before it calls the one picked. */
  onSelect: Record<StagesSectionToolKey, () => void>
}) {
  const [open, setOpen] = useState(false)
  return (
  <div style={{ position: 'relative', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      title="Section tools — quick access to the stage section buttons"
      aria-label="Section tools"
      aria-haspopup="menu"
      aria-expanded={open}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        padding: 0,
        border: 'none',
        borderRadius: 6,
        background: open ? 'var(--bg-blue-tint)' : 'transparent',
        cursor: 'pointer',
        color: open ? 'var(--text-link)' : 'var(--text-muted)',
      }}
    >
      <StagesSectionToolsIcon size={14} />
    </button>
    {open ? (
      <>
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 120 }}
        />
        <div
          role="menu"
          style={{
            position: 'absolute',
            left: 0,
            top: 'calc(100% + 4px)',
            zIndex: 121,
            minWidth: 250,
            padding: '0.3rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {buildStagesSectionToolsMenu(inputs).map((group) => (
            <div key={group.section} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.25rem 0.75rem 0.1rem', textAlign: 'center' }}>
                {group.section}
              </div>
              {group.items.map((item) => {
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={item.disabled}
                    title={item.title}
                    onClick={() => {
                      setOpen(false)
                      onSelect[item.key]()
                    }}
                    style={{
                      ...stagesToolsMenuItemStyle,
                      ...(item.disabled ? { cursor: 'default', opacity: 0.5 } : {}),
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      {/* Fixed-width icon slot so labels align down the menu; same marks
                          as the tools' board buttons (gc-review's hard-hat is a component,
                          so the kernel leaves its icon to us). */}
                      <span aria-hidden style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.key === 'gc-review' ? <GcHardHatIcon size={13} style={{ flexShrink: 0 }} /> : item.icon}
                      </span>
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badgeCount === 'number' ? (
                      <span
                        aria-hidden
                        style={{
                          minWidth: 18,
                          padding: '0 5px',
                          height: 18,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 9999,
                          background: '#f59e0b',
                          color: '#1c1917',
                          fontSize: 10,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1,
                          boxSizing: 'border-box',
                        }}
                      >
                        {item.badgeCount > 99 ? '99+' : item.badgeCount}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </>
    ) : null}
  </div>
  )
}
