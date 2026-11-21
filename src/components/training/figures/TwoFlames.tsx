import type { FigureProps } from './figureProps'
import { Label, Panel } from './plumbingParts'
import { RIGHT, SVG_STYLE, WRONG } from './plumbingTokens'

/**
 * Two flames (Intro to HVAC, lesson 13), in two frames: a burner with enough air, its flames short, blue and
 * steady; and a burner short of air, its flames tall, yellow and lazy, with soot above them. The blue and the
 * yellow are the flames' own colours and stay literal.
 */
export function TwoFlames({ titleId }: FigureProps) {
  const BLUE = '#2563eb'
  const YELLOW = '#eab308'
  const burner = <rect x="28" y="96" width="90" height="8" rx="3" fill="var(--bg-subtle)" stroke="currentColor" strokeWidth="1.5" />
  const xs = [42, 62, 82, 102]
  return (
    <svg viewBox="0 0 300 150" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <Panel x={2} y={2} w={146} h={146} title="enough air" sub="blue and steady" subColor={RIGHT}>
        {burner}
        {xs.map((x) => (
          <path key={x} d={`M${x - 5} 96 c0 -8 5 -12 5 -20 c0 8 5 12 5 20 z`} fill={BLUE} stroke="none" />
        ))}
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          short, even, quiet
        </Label>
        <Label x={73} y={138} anchor="middle" size={7}>
          very little carbon monoxide
        </Label>
      </Panel>
      <Panel x={152} y={2} w={146} h={146} title="short of air" sub="yellow and lazy" subColor={WRONG}>
        {burner}
        {xs.map((x, i) => (
          <path key={x} d={`M${x - 6} 96 c-2 -14 ${i % 2 ? 10 : -4} -20 ${i % 2 ? 2 : 6} -40 c6 14 ${i % 2 ? -2 : 8} 22 ${i % 2 ? 10 : 6} 40 z`} fill={YELLOW} stroke="none" />
        ))}
        {[
          [40, 46],
          [56, 40],
          [70, 48],
          [86, 42],
          [100, 46],
          [112, 52],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" />
        ))}
        <Label x={124} y={44} anchor="end" size={6.5}>
          soot
        </Label>
        <Label x={73} y={128} anchor="middle" bold color="currentColor" size={7.5}>
          tall, wavering, sooty
        </Label>
        <Label x={73} y={138} anchor="middle" size={7} color={WRONG}>
          a lot of carbon monoxide
        </Label>
      </Panel>
    </svg>
  )
}
