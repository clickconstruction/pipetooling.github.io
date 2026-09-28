import { describe, expect, it } from 'vitest'
import {
  HUB_PEOPLE_TOOLBAR_BTN_H,
  hubPeopleSalarySuffix,
  hubPeopleToolbarBtn,
  hubPeopleToolbarIconBtn,
} from './hubChromeStyle'

describe('hub toolbar buttons', () => {
  it('draws the text and icon buttons at one height', () => {
    expect(hubPeopleToolbarBtn.height).toBe(HUB_PEOPLE_TOOLBAR_BTN_H)
    expect(hubPeopleToolbarIconBtn.height).toBe(HUB_PEOPLE_TOOLBAR_BTN_H)
  })

  it('keeps the icon button at least square', () => {
    expect(hubPeopleToolbarIconBtn.minWidth).toBe(HUB_PEOPLE_TOOLBAR_BTN_H)
  })

  it('gives the icon button the text button border and surface, with its own padding and glyph size', () => {
    expect(hubPeopleToolbarIconBtn.border).toBe(hubPeopleToolbarBtn.border)
    expect(hubPeopleToolbarIconBtn.background).toBe(hubPeopleToolbarBtn.background)
    expect(hubPeopleToolbarIconBtn.padding).toBe('0 0.55rem')
    expect(hubPeopleToolbarIconBtn.fontSize).toBe('1rem')
    expect(hubPeopleToolbarBtn.padding).toBe('0 0.75rem')
    expect(hubPeopleToolbarBtn.fontSize).toBe('0.8125rem')
  })
})

describe('hubPeopleSalarySuffix', () => {
  it('sits on its own line under the name, smaller and fainter', () => {
    expect(hubPeopleSalarySuffix).toEqual({
      display: 'block',
      fontSize: '0.68rem',
      color: 'var(--text-faint)',
      fontWeight: 400,
      lineHeight: 1.1,
    })
  })
})
