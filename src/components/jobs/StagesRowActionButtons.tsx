/**
 * The Pipeline row's action icons (Stages tab decomposition PR 9, v2.3541). Each button's
 * markup was pasted into both section tables — the Test report and Hazmat glyphs three
 * times — so a glyph or title change could miss a copy. One component per icon; the caller
 * still decides when it shows and what its click does, exactly as before.
 */
import { FileCheck2, FileSpreadsheet } from 'lucide-react'

const iconButtonStyle = {
  padding: '0.25rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

/** Test report — hydrostatic, pinpoint or gas (the orange wrench). */
export function StagesTestReportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Test report — hydrostatic, pinpoint or gas"
      aria-label="Open Test report"
      style={{ ...iconButtonStyle, color: '#FF6600' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
      </svg>
    </button>
  )
}

/** Lien instruments — demand letter and lien forms; amber box while a demand letter is out (v2.2640). */
export function StagesLienInstrumentsButton({ onClick, demandOut }: { onClick: () => void; demandOut: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={demandOut ? 'Lien instruments — a demand letter is out on this job' : 'Lien instruments — demand letter and lien forms'}
      aria-label="Lien instruments"
      style={{
        ...iconButtonStyle,
        background: demandOut ? 'var(--bg-amber-tint)' : 'none',
        border: demandOut ? '2px solid #b45309' : 'none',
        borderRadius: 6,
        color: '#FF6600',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M201.6 217.4L182.9 198.7C170.4 186.2 170.4 165.9 182.9 153.4L297.6 38.6C310.1 26.1 330.4 26.1 342.9 38.6L361.6 57.4C374.1 69.9 374.1 90.2 361.6 102.7L246.9 217.4C234.4 229.9 214.1 229.9 201.6 217.4zM308 275.7L276.6 244.3L388.6 132.3L508 251.7L396 363.7L364.6 332.3L132.6 564.3C117 579.9 91.7 579.9 76 564.3C60.3 548.7 60.4 523.4 76 507.7L308 275.7zM422.9 438.6C410.4 426.1 410.4 405.8 422.9 393.3L537.6 278.6C550.1 266.1 570.4 266.1 582.9 278.6L601.6 297.3C614.1 309.8 614.1 330.1 601.6 342.6L486.9 457.4C474.4 469.9 454.1 469.9 441.6 457.4L422.9 438.7z" />
      </svg>
    </button>
  )
}

/** Release of lien (v2.2579); blue box while the job has an issued release (v2.2582). */
export function StagesLienReleaseButton({ onClick, hasRelease }: { onClick: () => void; hasRelease: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hasRelease ? 'This job has an issued lien release — click to view or issue another' : 'Release of lien — generate a conditional or unconditional waiver and release'}
      aria-label="Release of lien"
      style={{
        ...iconButtonStyle,
        background: hasRelease ? 'var(--bg-blue-tint)' : 'none',
        border: hasRelease ? '2px solid #2563eb' : 'none',
        borderRadius: 6,
        color: 'var(--text-link)',
      }}
    >
      <FileCheck2 size={16} aria-hidden />
    </button>
  )
}

/** AIA G702-G703 workbook generator. */
export function StagesAiaG702Button({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="AIA G702-G703"
      aria-label="Open AIA G702-G703 workbook generator"
      style={{ ...iconButtonStyle, color: '#16a34a' }}
    >
      <FileSpreadsheet size={16} aria-hidden />
    </button>
  )
}

/** Hazmat fee — document a biohazard incident and bill the customer; green box while the job has a live fee (v2.1040). */
export function StagesHazmatFeeButton({ onClick, hasFee }: { onClick: () => void; hasFee: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hasFee ? 'This job has a hazmat fee — click to add another' : 'Hazmat Fee — document a biohazard incident and bill the customer'}
      aria-label="Create a hazmat fee for this job"
      style={{
        ...iconButtonStyle,
        background: hasFee ? 'rgba(34, 197, 94, 0.14)' : 'none',
        border: hasFee ? '2px solid #22c55e' : 'none',
        borderRadius: 6,
        color: '#FF6600',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M292 76.6C292 68.3 284.4 62.1 276.5 64.5C215.6 83.3 171.4 140.3 171.4 207.6C171.4 232.7 177.5 256.3 188.4 277.1C167.4 278.9 146.4 285.3 126.9 296.6C69 330.2 42.1 396.8 56 459.1C57.9 467.5 67.4 471.1 74.9 466.7C79.9 463.8 82.5 458.1 82 452.3C81.7 449 81.6 445.7 81.6 442.2C81.6 318.7 266 318.7 266 442.2C266 530.6 171.5 555.8 117.8 517.6C113.3 514.4 107.3 513.7 102.5 516.5C95.5 520.6 93.9 530.1 99.8 535.6C146.4 579.4 217.8 589.5 275.9 555.8C293.8 545.4 308.7 531.9 320.4 516.4C332.1 532 347 545.5 364.9 555.8C423 589.5 494.4 579.4 541 535.6C546.9 530.1 545.3 520.5 538.3 516.5C533.5 513.7 527.5 514.4 523 517.6C469.3 555.8 374.8 530.6 374.8 442.2C374.8 318.7 559.2 318.7 559.2 442.2C559.2 445.6 559.1 449 558.8 452.3C558.3 458.1 560.9 463.8 565.9 466.7C573.3 471 582.9 467.5 584.8 459.1C598.7 396.9 571.8 330.2 513.9 296.6C494.4 285.3 473.5 278.9 452.4 277.1C463.3 256.3 469.4 232.7 469.4 207.6C469.4 140.3 425.2 83.3 364.3 64.5C356.4 62.1 348.8 68.3 348.8 76.6C348.8 82.5 352.8 87.6 358.3 89.8C441.7 123.4 429.1 268.2 320.5 268.2C211.9 268.2 199.1 123.4 282.5 89.8C288 87.6 292 82.5 292 76.6zM280.4 352C280.4 329.9 298.3 312 320.4 312C342.5 312 360.4 329.9 360.4 352C360.4 374.1 342.5 392 320.4 392C298.3 392 280.4 374.1 280.4 352zM467 381.7C450.8 381.7 435.6 387.2 424.9 396.7C414.8 405.8 406.8 420.1 406.8 442.3C406.8 463.4 414 477.3 423.3 486.4C455.5 461.8 478.8 425.9 487.2 384.6C480.9 382.7 474 381.6 467 381.6zM234 442.3C234 420 226 405.7 215.9 396.7C205.2 387.1 190 381.7 173.8 381.7C166.8 381.7 159.9 382.7 153.6 384.7C162 426 185.2 461.9 217.5 486.5C226.9 477.4 234 463.4 234 442.3zM275.2 218C284.2 228.2 298.4 236.2 320.4 236.2C342.4 236.2 356.6 228.2 365.6 218C372.3 210.4 377.1 200.5 379.2 189.6C360.9 182.8 341 179.1 320.4 179.1C299.8 179.1 279.9 182.8 261.6 189.6C263.8 200.5 268.5 210.4 275.2 218.1z" /></svg>
    </button>
  )
}
