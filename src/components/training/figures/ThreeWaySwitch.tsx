import type { FigureProps } from './figureProps'
import { Conductor, Current, Load } from './electricalParts'
import { Label } from './plumbingParts'
import { SVG_STYLE } from './plumbingTokens'

/**
 * The three-way switch (punch list #120, v2.5620): the hot comes to the first switch, two travelers run between
 * the two switches, and the switch leg leaves the second for the light; either switch changes the light and
 * neither is a true off, because the line side stays live whatever they do. Lesson 12.
 */
export function ThreeWaySwitch({ titleId }: FigureProps) {
  return (
    <svg viewBox="0 0 300 120" role="img" aria-labelledby={titleId} style={SVG_STYLE}>
      <rect x="6" y="30" width="34" height="70" rx="3" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <Label x={23} y={44} anchor="middle" size={7}>
        panel
      </Label>
      <Conductor d="M40 60 H78" />
      <Current x={60} y={60} />
      <Label x={44} y={46} size={6.5}>
        line side: live
      </Label>
      <g transform="translate(86 60)">
        <circle cx="0" cy="0" r="2" fill="currentColor" />
        <circle cx="16" cy="-8" r="2" fill="currentColor" />
        <circle cx="16" cy="8" r="2" fill="currentColor" />
        <line x1="0" y1="0" x2="15" y2="-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <Label x={94} y={84} anchor="middle" size={6.5}>
        switch A
      </Label>
      <Conductor d="M102 52 H174" dash="3 2" />
      <Conductor d="M102 68 H174" dash="3 2" />
      <Label x={138} y={46} anchor="middle" size={6.5}>
        two travelers
      </Label>
      <g transform="translate(190 60)">
        <circle cx="0" cy="0" r="2" fill="currentColor" />
        <circle cx="-16" cy="-8" r="2" fill="currentColor" />
        <circle cx="-16" cy="8" r="2" fill="currentColor" />
        <line x1="0" y1="0" x2="-15" y2="7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <Label x={182} y={84} anchor="middle" size={6.5}>
        switch B
      </Label>
      <Conductor d="M192 60 H228" />
      <Load x={240} y={60} kind="lamp" />
      <Conductor d="M250 60 H282 V104 H40" wire="neutral" />
      <Label x={240} y={82} anchor="middle" size={6.5}>
        the light, dark
      </Label>
      <Label x={150} y={18} anchor="middle" size={7.5} bold color="currentColor">
        either switch changes it, neither is a true off
      </Label>
      <Label x={160} y={114} anchor="middle" size={6.5}>
        neutral
      </Label>
    </svg>
  )
}
