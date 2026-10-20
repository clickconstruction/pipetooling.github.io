import type { FigureProps } from './figureProps'
import { Flow, Label, Pipe, Valve } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The water heater, cut open (punch list #119): cold water comes in at the top and drops down the dip tube to the
 * bottom, the burner heats it, hot water leaves at the top; the T&P valve on the side is the safety and its drain
 * line ends near the floor; the drain valve at the bottom and the expansion tank on the cold line. Lesson 4.
 */
export function WaterHeaterCutaway({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 200" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <g transform="translate(0 10)">
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="110" y="30" width="80" height="140" rx="10" fill="var(--bg-blue-200)" />
        <path d="M110 100 H190 V160 a10 10 0 0 1 -10 10 H120 a10 10 0 0 1 -10 -10 Z" fill="var(--bg-blue-200)" stroke="none" />
        <path d="M110 40 a10 10 0 0 1 10 -10 H180 a10 10 0 0 1 10 10 V100 H110 Z" fill="var(--bg-red-100)" stroke="none" />
        <rect x="110" y="30" width="80" height="140" rx="10" fill="none" />
        <line x1="110" y1="100" x2="190" y2="100" strokeDasharray="3 3" stroke="var(--text-muted)" />
      </g>
      <Pipe d="M130 4 V156" />
      <Flow x={130} y={20} angle={90} />
      <Flow x={130} y={140} angle={90} />
      <Pipe d="M130 14 H88" />
      <ellipse cx="76" cy="14" rx="10" ry="13" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Pipe d="M170 46 V4" tint="hot" />
      <Flow x={170} y={18} angle={-90} />
      <g transform="translate(150 182)">
        <path d="M-8 0 c0 -8 6 -10 6 -16 c3 5 6 7 6 12 a6 6 0 0 1 -12 4z" fill="#f97316" stroke="none" />
      </g>
      <line x1="118" y1="176" x2="182" y2="176" stroke="currentColor" strokeWidth="1.5" />
      <rect x="190" y="52" width="10" height="12" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <line x1="200" y1="54" x2="212" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <Pipe d="M200 60 H222 V176" bore={5} tint="air" />
      <g transform="rotate(90 106 160)">
        <Valve x={106} y={160} kind="stop" bore={5} />
      </g>
      <Pipe d="M110 160 H100" bore={5} />
      <Label x={123} y={10} anchor="end" bold color="#2563eb">
        cold in
      </Label>
      <Label x={176} y={10} bold color="#b91c1c">
        hot out
      </Label>
      <Label x={76} y={40} anchor="middle" size={7.5}>
        expansion
      </Label>
      <Label x={76} y={49} anchor="middle" size={7.5}>
        tank
      </Label>
      <Label x={136} y={80} size={8}>
        dip tube
      </Label>
      <Label x={150} y={72} anchor="middle" bold color="currentColor" size={9}>
        120°F
      </Label>
      <Label x={226} y={44} size={8} bold color="currentColor">
        T&amp;P valve
      </Label>
      <Label x={226} y={54} size={7.5}>
        opens at 150 psi
      </Label>
      <Label x={226} y={63} size={7.5}>
        or 210°F
      </Label>
      <Label x={228} y={150} size={7.5}>
        its drain line
      </Label>
      <Label x={228} y={159} size={7.5}>
        ends near the floor
      </Label>
      <Label x={96} y={184} anchor="end" size={8}>
        drain
      </Label>
      <Label x={150} y={120} anchor="middle" size={8} color="#2563eb">
        cold sinks
      </Label>
      <Label x={190} y={188} size={8}>
        burner
      </Label>
      </g>
    </svg>
  )
}
