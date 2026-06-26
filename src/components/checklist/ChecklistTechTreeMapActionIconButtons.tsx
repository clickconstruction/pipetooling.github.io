import type { CSSProperties } from 'react'

export type ChecklistTechTreeMapActionIconLayout = 'corner' | 'header'

type Props = {
  layout: ChecklistTechTreeMapActionIconLayout
  mapCanvasFloatButtonStyle: CSSProperties
  /** Whether the canvas can go full screen (DOM Fullscreen API or the CSS fallback). */
  canEnterFullscreen: boolean
  isCanvasFullscreen: boolean
  onEnterCanvasFullscreen: () => void
  onOrganize: () => void
  canEditTechTree: boolean
  onAddGroup: () => void
  reorderMode: boolean
  onToggleReorder: () => void
  onShowAll: () => void
  onCollapseAll: () => void
  showAllFloatDisabled: boolean
  collapseAllFloatDisabled: boolean
  /** When set and linksEdgeCount > 0, shows prerequisite links modal trigger (canvas / header). */
  onOpenLinksModal?: () => void
  linksEdgeCount?: number
}

/**
 * Roadmap graph icon actions: full screen (corner only), Organize, Add group, Edit tasks, Show all, Collapse all.
 * Corner uses row-reverse in the parent; header uses a natural left-to-right order matching the corner’s visual order.
 */
const linksIconPath =
  'M482.4 221.9C517.7 213.6 544 181.9 544 144C544 99.8 508.2 64 464 64C420.6 64 385.3 98.5 384 141.5L200.2 215.1C185.7 200.8 165.9 192 144 192C99.8 192 64 227.8 64 272C64 316.2 99.8 352 144 352C156.2 352 167.8 349.3 178.1 344.4L323.7 471.8C321.3 479.4 320 487.6 320 496C320 540.2 355.8 576 400 576C444.2 576 480 540.2 480 496C480 468.3 466 443.9 444.6 429.6L482.4 221.9zM220.3 296.2C222.5 289.3 223.8 282 224 274.5L407.8 201C411.4 204.5 415.2 207.7 419.4 210.5L381.6 418.1C376.1 419.4 370.8 421.2 365.8 423.6L220.3 296.2z'

/** Enter-fullscreen: same 30×30 hit target as boxed icons, no border/fill/shadow. */
const mapCanvasEnterFullscreenBareButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  boxShadow: 'none',
  color: '#475569',
  cursor: 'pointer',
}

export function ChecklistTechTreeMapActionIconButtons(p: Props) {
  const showEnterFullscreen = p.layout === 'corner' && p.canEnterFullscreen && !p.isCanvasFullscreen
  const showLinksButton =
    p.onOpenLinksModal != null && (p.linksEdgeCount ?? 0) > 0

  const linksModal = showLinksButton ? (
    <button
      type="button"
      className="nodrag nopan"
      onClick={p.onOpenLinksModal}
      onPointerDown={(e) => e.stopPropagation()}
      title="View and manage prerequisite links"
      aria-label="View and manage prerequisite links"
      style={p.mapCanvasFloatButtonStyle}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
        <path fill="currentColor" d={linksIconPath} />
      </svg>
    </button>
  ) : null

  const enterFs = showEnterFullscreen ? (
    <button
      type="button"
      className="nodrag nopan checklistTechTreeEnterFs"
      onClick={p.onEnterCanvasFullscreen}
      onPointerDown={(e) => e.stopPropagation()}
      title="View the roadmap graph full screen. Press Esc to exit."
      aria-label="View the roadmap graph full screen. Press Esc to exit."
      style={mapCanvasEnterFullscreenBareButtonStyle}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
        <path
          fill="currentColor"
          d="M264 96L120 96C106.7 96 96 106.7 96 120L96 264C96 273.7 101.8 282.5 110.8 286.2C119.8 289.9 130.1 287.8 137 281L177 241L256 320L177 399L137 359C130.1 352.1 119.8 350.1 110.8 353.8C101.8 357.5 96 366.3 96 376L96 520C96 533.3 106.7 544 120 544L264 544C273.7 544 282.5 538.2 286.2 529.2C289.9 520.2 287.9 509.9 281 503L241 463L320 384L399 463L359 503C352.1 509.9 350.1 520.2 353.8 529.2C357.5 538.2 366.3 544 376 544L520 544C533.3 544 544 533.3 544 520L544 376C544 366.3 538.2 357.5 529.2 353.8C520.2 350.1 509.9 352.1 503 359L463 399L384 320L463 241L503 281C509.9 287.9 520.2 289.9 529.2 286.2C538.2 282.5 544 273.7 544 264L544 120C544 106.7 533.3 96 520 96L376 96C366.3 96 357.5 101.8 353.8 110.8C350.1 119.8 352.2 130.1 359 137L399 177L320 256L241 177L281 137C287.9 130.1 289.9 119.8 286.2 110.8C282.5 101.8 273.7 96 264 96z"
        />
      </svg>
    </button>
  ) : null

  const organize = (
    <button
      type="button"
      className="nodrag nopan"
      onClick={p.onOrganize}
      onPointerDown={(e) => e.stopPropagation()}
      title="Organize graph layout (reset to auto layout)"
      aria-label="Organize graph layout"
      style={p.mapCanvasFloatButtonStyle}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
        <path
          fill="currentColor"
          d="M296.5 69.2C311.4 62.3 328.6 62.3 343.5 69.2L562.1 170.2C570.6 174.1 576 182.6 576 192C576 201.4 570.6 209.9 562.1 213.8L343.5 314.8C328.6 321.7 311.4 321.7 296.5 314.8L77.9 213.8C69.4 209.8 64 201.3 64 192C64 182.7 69.4 174.1 77.9 170.2L296.5 69.2zM112.1 282.4L276.4 358.3C304.1 371.1 336 371.1 363.7 358.3L528 282.4L562.1 298.2C570.6 302.1 576 310.6 576 320C576 329.4 570.6 337.9 562.1 341.8L343.5 442.8C328.6 449.7 311.4 449.7 296.5 442.8L77.9 341.8C69.4 337.8 64 329.3 64 320C64 310.7 69.4 302.1 77.9 298.2L112 282.4zM77.9 426.2L112 410.4L276.3 486.3C304 499.1 335.9 499.1 363.6 486.3L527.9 410.4L562 426.2C570.5 430.1 575.9 438.6 575.9 448C575.9 457.4 570.5 465.9 562 469.8L343.4 570.8C328.5 577.7 311.3 577.7 296.4 570.8L77.9 469.8C69.4 465.8 64 457.3 64 448C64 438.7 69.4 430.1 77.9 426.2z"
        />
      </svg>
    </button>
  )

  const addGroup = p.canEditTechTree ? (
    <button
      type="button"
      className="nodrag nopan"
      onClick={p.onAddGroup}
      onPointerDown={(e) => e.stopPropagation()}
      title="Add a roadmap group"
      aria-label="Add a roadmap group"
      style={p.mapCanvasFloatButtonStyle}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
        <path
          fill="currentColor"
          d="M72 128C72 114.7 82.7 104 96 104C109.3 104 120 114.7 120 128C120 141.3 109.3 152 96 152C82.7 152 72 141.3 72 128zM120 187.3C136 180.8 148.9 168 155.3 152L484.6 152C491.1 168 503.9 180.9 519.9 187.3L519.9 452.6C503.9 459.1 491 471.9 484.6 487.9L155.3 487.9C148.8 471.9 136 459 120 452.6L120 187.3zM544 64C517.1 64 494.1 80.5 484.7 104L155.3 104C145.9 80.5 122.9 64 96 64C60.7 64 32 92.7 32 128C32 154.9 48.5 177.9 72 187.3L72 452.6C48.5 462.1 32 485.1 32 511.9C32 547.2 60.7 575.9 96 575.9C122.9 575.9 145.9 559.4 155.3 535.9L484.6 535.9C494.1 559.4 517.1 575.9 543.9 575.9C579.2 575.9 607.9 547.2 607.9 511.9C607.9 485 591.4 462 567.9 452.6L567.9 187.3C591.4 177.8 607.9 154.8 607.9 128C607.9 92.7 579.2 64 543.9 64zM520 128C520 114.7 530.7 104 544 104C557.3 104 568 114.7 568 128C568 141.3 557.3 152 544 152C530.7 152 520 141.3 520 128zM96 488C109.3 488 120 498.7 120 512C120 525.3 109.3 536 96 536C82.7 536 72 525.3 72 512C72 498.7 82.7 488 96 488zM520 512C520 498.7 530.7 488 544 488C557.3 488 568 498.7 568 512C568 525.3 557.3 536 544 536C530.7 536 520 525.3 520 512zM224 240L312 240L312 296L224 296L224 240zM216 200C198.3 200 184 214.3 184 232L184 304C184 321.7 198.3 336 216 336L320 336C337.7 336 352 321.7 352 304L352 232C352 214.3 337.7 200 320 200L216 200zM288 384L288 408C288 425.7 302.3 440 320 440L424 440C441.7 440 456 425.7 456 408L456 336C456 318.3 441.7 304 424 304L400 304C400 318.6 396.1 332.2 389.3 344L416 344L416 400L328 400L328 383.6C325.4 383.9 322.7 384 320 384L288 384z"
        />
      </svg>
    </button>
  ) : null

  const editTasks = p.canEditTechTree ? (
    <button
      type="button"
      className="nodrag nopan"
      onClick={p.onToggleReorder}
      onPointerDown={(e) => e.stopPropagation()}
      aria-pressed={p.reorderMode}
      title={
        p.reorderMode
          ? 'Drag by the grip to reorder or move; press and hold a task title to edit. Click to turn off.'
          : 'Edit mode: drag tasks by the grip, or press and hold a task title to edit. Moves tasks between groups.'
      }
      aria-label={
        p.reorderMode
          ? 'Drag by the grip to reorder or move; press and hold a task title to edit. Click to turn off.'
          : 'Edit mode: drag tasks by the grip, or press and hold a task title to edit. Moves tasks between groups.'
      }
      style={{
        ...p.mapCanvasFloatButtonStyle,
        ...(p.reorderMode ? { boxShadow: 'inset 0 0 0 1px #3b82f6' } : null),
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
        <path
          fill="currentColor"
          d="M505 122.9L517.1 135C526.5 144.4 526.5 159.6 517.1 168.9L488 198.1L441.9 152L471 122.9C480.4 113.5 495.6 113.5 504.9 122.9zM273.8 320.2L408 185.9L454.1 232L319.8 366.2C316.9 369.1 313.3 371.2 309.4 372.3L250.9 389L267.6 330.5C268.7 326.6 270.8 323 273.7 320.1zM437.1 89L239.8 286.2C231.1 294.9 224.8 305.6 221.5 317.3L192.9 417.3C190.5 425.7 192.8 434.7 199 440.9C205.2 447.1 214.2 449.4 222.6 447L322.6 418.4C334.4 415 345.1 408.7 353.7 400.1L551 202.9C579.1 174.8 579.1 129.2 551 101.1L538.9 89C510.8 60.9 465.2 60.9 437.1 89zM152 128C103.4 128 64 167.4 64 216L64 488C64 536.6 103.4 576 152 576L424 576C472.6 576 512 536.6 512 488L512 376C512 362.7 501.3 352 488 352C474.7 352 464 362.7 464 376L464 488C464 510.1 446.1 528 424 528L152 528C129.9 528 112 510.1 112 488L112 216C112 193.9 129.9 176 152 176L264 176C277.3 176 288 165.3 288 152C288 138.7 277.3 128 264 128L152 128z"
        />
      </svg>
    </button>
  ) : null

  const showAll = (
    <button
      type="button"
      className="nodrag nopan"
      onClick={p.onShowAll}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={p.showAllFloatDisabled}
      title={p.showAllFloatDisabled ? 'All groups are already expanded' : 'Show all'}
      aria-label={p.showAllFloatDisabled ? 'All groups are already expanded' : 'Show all'}
      style={{
        ...p.mapCanvasFloatButtonStyle,
        ...(p.showAllFloatDisabled ? { opacity: 0.45, cursor: 'not-allowed' as const } : null),
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
        <path
          fill="currentColor"
          d="M342.6 534.6C330.1 547.1 309.8 547.1 297.3 534.6L137.3 374.6C124.8 362.1 124.8 341.8 137.3 329.3C149.8 316.8 170.1 316.8 182.6 329.3L320 466.7L457.4 329.4C469.9 316.9 490.2 316.9 502.7 329.4C515.2 341.9 515.2 362.2 502.7 374.7L342.7 534.7zM502.6 182.6L342.6 342.6C330.1 355.1 309.8 355.1 297.3 342.6L137.3 182.6C124.8 170.1 124.8 149.8 137.3 137.3C149.8 124.8 170.1 124.8 182.6 137.3L320 274.7L457.4 137.4C469.9 124.9 490.2 124.9 502.7 137.4C515.2 149.9 515.2 170.2 502.7 182.7z"
        />
      </svg>
    </button>
  )

  const collapseAll = (
    <button
      type="button"
      className="nodrag nopan"
      onClick={p.onCollapseAll}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={p.collapseAllFloatDisabled}
      title={p.collapseAllFloatDisabled ? 'All groups are already collapsed' : 'Collapse all'}
      aria-label={p.collapseAllFloatDisabled ? 'All groups are already collapsed' : 'Collapse all'}
      style={{
        ...p.mapCanvasFloatButtonStyle,
        ...(p.collapseAllFloatDisabled ? { opacity: 0.45, cursor: 'not-allowed' as const } : null),
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} aria-hidden>
        <path
          fill="currentColor"
          d="M342.6 105.4C330.1 92.9 309.8 92.9 297.3 105.4L137.3 265.4C124.8 277.9 124.8 298.2 137.3 310.7C149.8 323.2 170.1 323.2 182.6 310.7L320 173.3L457.4 310.6C469.9 323.1 490.2 323.1 502.7 310.6C515.2 298.1 515.2 277.8 502.7 265.3L342.7 105.3zM502.6 457.4L342.6 297.4C330.1 284.9 309.8 284.9 297.3 297.4L137.3 457.4C124.8 469.9 124.8 490.2 137.3 502.7C149.8 515.2 170.1 515.2 182.6 502.7L320 365.3L457.4 502.6C469.9 515.1 490.2 515.1 502.7 502.6C515.2 490.1 515.2 469.8 502.7 457.3z"
        />
      </svg>
    </button>
  )

  if (p.layout === 'header') {
    return (
      <>
        {collapseAll}
        {showAll}
        {editTasks}
        {addGroup}
        {organize}
        {linksModal}
      </>
    )
  }

  return (
    <>
      {enterFs}
      {linksModal}
      {organize}
      {addGroup}
      {editTasks}
      {showAll}
      {collapseAll}
    </>
  )
}
