// @vitest-environment jsdom
/**
 * Render smokes for values in place (punch list #382, PR 1). A changeable value is a press that reads as the
 * value. A press turns it into its own field: Keep and Enter save once, Cancel and Escape save nothing. A field
 * that cannot be kept stays open and says why. A worked-out value has no press. A locked value, a default and a
 * screen switched off each draw their own way. The stylesheet's rules are read from the file, so the looks the
 * classes name cannot leave it unseen. Every name and day here is made up.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { val } from '../../lib/valuesInPlace'
import { ChangeableValue, ValueLine, ValueLines, ValueSentence, ValuesInPlaceOff, ValuesLegend, WorkedOutValue } from './ValuesInPlace'

afterEach(cleanup)

const FIRST_DAY = 'Tue Dec 8, our first day, press to change'

function FirstDay({ onKeep, ...rest }: { onKeep: (v: string, extra: { reason: string }) => void | Promise<void> } & Partial<Parameters<typeof ChangeableValue>[0]>) {
  return <ChangeableValue text="Tue Dec 8" label="our first day" type="date" value="2026-12-08" onKeep={onKeep} {...rest} />
}

describe('ChangeableValue', () => {
  it('reads as the value, and is named by the value, what it is and that a press changes it', () => {
    render(<FirstDay onKeep={vi.fn()} />)
    const press = screen.getByRole('button', { name: FIRST_DAY })
    expect(press.textContent).toBe('Tue Dec 8')
    expect(press.className).toBe('vipChange')
    expect(press.getAttribute('type')).toBe('button')
    expect(press.dataset.value).toBe('changeable')
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull()
  })

  it('a press turns it into its own field, and Keep saves the new value once', () => {
    const onKeep = vi.fn()
    render(<FirstDay onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    const box = screen.getByLabelText('our first day') as HTMLInputElement
    expect(box.type).toBe('date')
    expect(box.value).toBe('2026-12-08')
    expect(document.activeElement).toBe(box)
    fireEvent.change(box, { target: { value: '2026-12-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(onKeep).toHaveBeenCalledWith('2026-12-11', { reason: '' })
    // The field is gone and the press has the focus back, so a keyboard keeps its place in the line.
    expect(screen.queryByLabelText('our first day')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: FIRST_DAY }))
  })

  it('Enter keeps, and Escape cancels with nothing saved', () => {
    const onKeep = vi.fn()
    render(<ChangeableValue text="Ray" label="who we ask" type="text" value="Ray" onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ray, who we ask, press to change' }))
    fireEvent.change(screen.getByLabelText('who we ask'), { target: { value: 'Dana' } })
    fireEvent.keyDown(screen.getByLabelText('who we ask'), { key: 'Enter' })
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(onKeep).toHaveBeenCalledWith('Dana', { reason: '' })

    fireEvent.click(screen.getByRole('button', { name: 'Ray, who we ask, press to change' }))
    fireEvent.change(screen.getByLabelText('who we ask'), { target: { value: 'Luis' } })
    fireEvent.keyDown(screen.getByLabelText('who we ask'), { key: 'Escape' })
    expect(screen.queryByLabelText('who we ask')).toBeNull()
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it('Cancel saves nothing, and a draft that matches the value saves nothing either', () => {
    const onKeep = vi.fn()
    render(<FirstDay onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    fireEvent.change(screen.getByLabelText('our first day'), { target: { value: '2026-12-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('our first day')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    // The draft opens on the value again, not on what was typed before Cancel.
    expect((screen.getByLabelText('our first day') as HTMLInputElement).value).toBe('2026-12-08')
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.queryByLabelText('our first day')).toBeNull()
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('a field that cannot be kept stays open and says why, and the reason leaves at the next key', () => {
    const onKeep = vi.fn()
    render(<ChangeableValue text="10 days" label="days of notice" type="number" value="10" whole min="0" max="60" onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: '10 days, days of notice, press to change' }))
    const box = screen.getByLabelText('days of notice') as HTMLInputElement
    expect(box.getAttribute('inputmode')).toBe('numeric')
    fireEvent.change(box, { target: { value: '61' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('alert').textContent).toBe('Type 60 or less.')
    expect(box.getAttribute('aria-invalid')).toBe('true')
    expect(onKeep).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: '7' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('7', { reason: '' })
  })

  it('waits on a save that takes time, then closes', async () => {
    let done: () => void = () => {}
    const onKeep = vi.fn(() => new Promise<void>((resolve) => (done = resolve)))
    render(<FirstDay onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    fireEvent.change(screen.getByLabelText('our first day'), { target: { value: '2026-12-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    const keeping = screen.getByRole('button', { name: 'Keeping…' }) as HTMLButtonElement
    expect(keeping.disabled).toBe(true)
    expect((screen.getByLabelText('our first day') as HTMLInputElement).disabled).toBe(true)
    // A second Enter while the save is out saves nothing more.
    fireEvent.keyDown(screen.getByLabelText('our first day'), { key: 'Enter' })
    expect(onKeep).toHaveBeenCalledTimes(1)
    await act(async () => done())
    await waitFor(() => expect(screen.queryByLabelText('our first day')).toBeNull())
  })

  it('a save that fails keeps the field open with what was typed, and says the reason', async () => {
    const onKeep = vi.fn(() => Promise.reject(new Error('The stage moved while you were typing.')))
    render(<FirstDay onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    fireEvent.change(screen.getByLabelText('our first day'), { target: { value: '2026-12-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('The stage moved while you were typing.')
    expect((screen.getByLabelText('our first day') as HTMLInputElement).value).toBe('2026-12-11')
    expect((screen.getByRole('button', { name: 'Keep' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a choice opens as a list, and Keep saves the pick', () => {
    const onKeep = vi.fn()
    const choices = [
      { value: 'word', label: 'their word' },
      { value: 'photo', label: 'their photo' },
      { value: 'saw', label: 'we saw it' },
    ]
    render(<ChangeableValue text="their word" label="how we know" type="choice" value="word" choices={choices} onKeep={onKeep} />)
    fireEvent.click(screen.getByRole('button', { name: 'their word, how we know, press to change' }))
    const list = screen.getByLabelText('how we know') as HTMLSelectElement
    expect(list.tagName).toBe('SELECT')
    expect(Array.from(list.options).map((o) => o.textContent)).toEqual(['their word', 'their photo', 'we saw it'])
    fireEvent.change(list, { target: { value: 'saw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('saw', { reason: '' })
  })

  it('shows the hint beside the open field, and what the change will do as the draft moves', () => {
    render(<FirstDay onKeep={vi.fn()} hint="our first day on site" preview={(d) => (d === '2026-12-11' ? 'We would decide by Tue Dec 1.' : null)} />)
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    const box = screen.getByLabelText('our first day')
    expect(document.getElementById(box.getAttribute('aria-describedby') ?? '')?.textContent).toBe('our first day on site')
    fireEvent.change(box, { target: { value: '2026-12-11' } })
    expect(document.getElementById(box.getAttribute('aria-describedby') ?? '')?.textContent).toBe('our first day on siteWe would decide by Tue Dec 1.')
  })

  it('asks for a reason when the screen wants one, and hands it to the save', () => {
    const onKeep = vi.fn()
    render(<FirstDay onKeep={onKeep} reason={{ label: 'Why it moved', required: true }} />)
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    fireEvent.change(screen.getByLabelText('our first day'), { target: { value: '2026-12-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('alert').textContent).toBe('Say why first.')
    expect(onKeep).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Why it moved'), { target: { value: ' The slab is late ' } })
    fireEvent.keyDown(screen.getByLabelText('Why it moved'), { key: 'Enter' })
    expect(onKeep).toHaveBeenCalledWith('2026-12-11', { reason: 'The slab is late' })
  })

  it('runs the screen’s own check, and holds the field on its words', () => {
    const onKeep = vi.fn()
    render(<FirstDay onKeep={onKeep} check={(d) => (d < '2026-12-01' ? 'Our first day cannot be before the permit.' : null)} />)
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    fireEvent.change(screen.getByLabelText('our first day'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('alert').textContent).toBe('Our first day cannot be before the permit.')
    expect(onKeep).not.toHaveBeenCalled()
  })

  it('a click or a key on it never reaches a row that opens on a press', () => {
    const onRow = vi.fn()
    const onRowKey = vi.fn()
    render(
      <div role="button" tabIndex={0} onClick={onRow} onKeyDown={onRowKey}>
        Crew confirmed for <FirstDay onKeep={vi.fn()} />.
      </div>,
    )
    const press = screen.getByRole('button', { name: FIRST_DAY })
    fireEvent.keyDown(press, { key: 'Enter' })
    fireEvent.click(press)
    const box = screen.getByLabelText('our first day')
    fireEvent.click(box)
    // Enter on the value it opened on closes the field with nothing saved.
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.queryByLabelText('our first day')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
    fireEvent.keyDown(screen.getByLabelText('our first day'), { key: ' ' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onRow).not.toHaveBeenCalled()
    expect(onRowKey).not.toHaveBeenCalled()
  })

  it('takes Escape for itself, so a window it sits in stays open', () => {
    const onWindowEscape = vi.fn()
    const listen = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onWindowEscape()
    }
    window.addEventListener('keydown', listen)
    try {
      render(<FirstDay onKeep={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: FIRST_DAY }))
      fireEvent.keyDown(screen.getByLabelText('our first day'), { key: 'Escape' })
      expect(screen.queryByLabelText('our first day')).toBeNull()
      expect(onWindowEscape).not.toHaveBeenCalled()
      // With the field closed the next Escape is the window's own.
      fireEvent.keyDown(screen.getByRole('button', { name: FIRST_DAY }), { key: 'Escape' })
      expect(onWindowEscape).not.toHaveBeenCalled()
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(onWindowEscape).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', listen)
    }
  })
})

describe('the other looks', () => {
  it('a worked-out value is plain bold with no press', () => {
    render(
      <p>
        We decide by <WorkedOutValue>Sat Nov 28</WorkedOutValue>.
      </p>,
    )
    const value = screen.getByText('Sat Nov 28')
    expect(value.tagName).toBe('B')
    expect(value.className).toBe('vipWorked')
    expect(value.dataset.value).toBe('worked-out')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('a locked value is shown with no press, a tag, and the sentence that says who can change it', () => {
    render(<FirstDay onKeep={vi.fn()} locked={{ tag: 'office only', why: 'Only the office can change our first day.' }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Tue Dec 8').dataset.value).toBe('locked')
    expect(screen.getByText('office only').className).toBe('vipTag')
    expect(screen.getByTitle('Only the office can change our first day.')).toBeTruthy()
  })

  it('a value read from a default is bold with the small word after it, and a press sets this record’s own', () => {
    const onKeep = vi.fn()
    render(<ChangeableValue text="10 days" label="days of notice" type="number" value="10" whole fromDefault="default" setOwnLabel="Set this site’s own" onKeep={onKeep} />)
    expect(screen.getByText('10 days').dataset.value).toBe('worked-out')
    expect(screen.getByText('default').className).toBe('vipDefaultWord')
    fireEvent.click(screen.getByRole('button', { name: 'Set this site’s own, days of notice' }))
    fireEvent.change(screen.getByLabelText('days of notice'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('4', { reason: '' })
  })

  it('a record with its own value offers the press back to the default in the open field', () => {
    const back = vi.fn()
    const onKeep = vi.fn()
    render(<ChangeableValue text="4 days" label="days of notice" type="number" value="4" whole onKeep={onKeep} backToDefault={{ label: 'Back to the default, 10 days', onPress: back }} />)
    fireEvent.click(screen.getByRole('button', { name: '4 days, days of notice, press to change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to the default, 10 days' }))
    expect(back).toHaveBeenCalledTimes(1)
    expect(onKeep).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('days of notice')).toBeNull()
  })

  it('switched off, a value draws with no press, and the legend says nothing', () => {
    render(
      <ValuesInPlaceOff>
        <p>
          We start <FirstDay onKeep={vi.fn()} />.
        </p>
        <ValuesLegend />
      </ValuesInPlaceOff>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Tue Dec 8').dataset.value).toBe('worked-out')
    expect(document.querySelector('[data-values-legend]')).toBeNull()
  })

  it('one value can be switched off by itself', () => {
    render(<FirstDay onKeep={vi.fn()} off />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Tue Dec 8').tagName).toBe('B')
  })

  it('a value asked to start open draws its field at once; Cancel closes it, and a press opens it again', () => {
    const onKeep = vi.fn()
    render(<ChangeableValue text="no day yet" label="the day it ended" type="date" value="" onKeep={onKeep} startOpen />)
    expect((screen.getByLabelText('the day it ended') as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('the day it ended')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'no day yet, the day it ended, press to change' }))
    fireEvent.change(screen.getByLabelText('the day it ended'), { target: { value: '2026-09-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(onKeep.mock.calls[0]?.[0]).toBe('2026-09-03')
  })
})

describe('a sentence, the lines and the legend', () => {
  it('draws a kernel’s sentence with its changeable values as presses and the rest bold', () => {
    const onKeep = vi.fn()
    const sentence = `${val('who', 'Ray')} says ready ${val('their', 'Dec 12')}. We planned to start ${val('start', 'Tue Dec 8')}.`
    render(
      <p data-testid="line">
        <ValueSentence<'who' | 'their' | 'start'> text={sentence} values={{ start: (text) => <FirstDay text={text} onKeep={onKeep} /> }} />
      </p>,
    )
    expect(screen.getByTestId('line').textContent).toBe('Ray says ready Dec 12. We planned to start Tue Dec 8.')
    expect(screen.getByText('Ray').dataset.value).toBe('worked-out')
    expect(screen.getByText('Dec 12').dataset.value).toBe('worked-out')
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Tue Dec 8'])
  })

  it('draws one fact a line: each label, then its values, in one grid', () => {
    render(
      <ValueLines>
        <ValueLine label="We start">
          <FirstDay onKeep={vi.fn()} />
        </ValueLine>
        <ValueLine label="We decide by">
          <WorkedOutValue>Sat Nov 28</WorkedOutValue>
        </ValueLine>
      </ValueLines>,
    )
    const grid = document.querySelector('[data-value-lines]') as HTMLElement
    expect(grid.className).toBe('vipLines')
    expect(Array.from(grid.children).map((c) => c.className)).toEqual(['vipLineLabel', 'vipLineValues', 'vipLineLabel', 'vipLineValues'])
    expect(Array.from(grid.children).map((c) => c.textContent)).toEqual(['We start', 'Tue Dec 8', 'We decide by', 'Sat Nov 28'])
  })

  it('the legend draws each word in the look it names, and its sample is no press', () => {
    render(<ValuesLegend />)
    const legend = document.querySelector('[data-values-legend]') as HTMLElement
    expect(legend.textContent).toBe('Underlined values change where they sit: press one. Bold values are worked out.')
    expect(screen.getByText('Underlined').className).toBe('vipChange vipChangeSample')
    expect(screen.getByText('Bold').className).toBe('vipWorked')
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('ChangeableValue offers and fills (punch list #403)', () => {
  it('a text field offers its suggestions as it is typed, and anything else may still be kept', () => {
    const onKeep = vi.fn()
    render(<ChangeableValue text="None on file" label="their company" type="text" value="" onKeep={onKeep} suggestions={['Sample Mechanical LLC', 'Sample Pipe Co']} />)
    fireEvent.click(screen.getByRole('button', { name: 'None on file, their company, press to change' }))
    const box = screen.getByLabelText('their company') as HTMLInputElement
    const list = document.getElementById(box.getAttribute('list') ?? '')
    expect(list?.tagName).toBe('DATALIST')
    expect([...(list?.querySelectorAll('option') ?? [])].map((o) => o.getAttribute('value'))).toEqual(['Sample Mechanical LLC', 'Sample Pipe Co'])
    fireEvent.change(box, { target: { value: 'Another Sample Co' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('Another Sample Co', { reason: '' })
  })

  it('a fill keeps its value in one press, through the same check, and is not drawn when it is the value already', () => {
    const onKeep = vi.fn()
    const { rerender } = render(<ChangeableValue text="None on file" label="their company" type="text" value="" onKeep={onKeep} fills={[{ label: 'Same as their name', value: 'Pat Sample' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'None on file, their company, press to change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Same as their name' }))
    expect(onKeep).toHaveBeenCalledTimes(1)
    expect(onKeep).toHaveBeenCalledWith('Pat Sample', { reason: '' })
    rerender(<ChangeableValue text="Pat Sample" label="their company" type="text" value="Pat Sample" onKeep={onKeep} fills={[{ label: 'Same as their name', value: 'Pat Sample' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pat Sample, their company, press to change' }))
    expect(screen.queryByRole('button', { name: 'Same as their name' })).toBeNull()
  })

  it('a fill the check refuses keeps the field open with the reason', () => {
    const onKeep = vi.fn()
    render(<ChangeableValue text="None on file" label="their company" type="text" value="" onKeep={onKeep} check={() => 'Too long.'} fills={[{ label: 'Same as their name', value: 'Pat Sample' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'None on file, their company, press to change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Same as their name' }))
    expect(onKeep).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Too long.')
  })
})

describe('the looks in index.css', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {`)
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at))
  }

  it('a changeable value is tinted with a dotted line under it, in the words’ own colour and not the link’s', () => {
    const change = rule('.vipChange')
    expect(change).toContain('border-bottom: 2px dotted var(--text-link)')
    expect(change).toContain('background: var(--bg-blue-tint)')
    expect(change).toContain('color: var(--text-strong)')
    expect(change).toContain('font-weight: 700')
    expect(change).not.toContain('text-decoration')
  })

  it('a worked-out value is bold and nothing else', () => {
    expect(rule('.vipWorked')).toBe('\n.vipWorked { font-weight: 700; color: var(--text-strong); ')
  })

  it('Keep is the press blue under white words, and a waiting Keep wears the dead press pair', () => {
    expect(rule('.vipKeep')).toContain('background: #2563eb; color: #fff')
    expect(rule('.vipKeep:disabled')).toContain('background: var(--bg-200); color: var(--text-700)')
  })

  it('a thumb gets 44 px on a value’s press and on the open field', () => {
    const at = css.indexOf('@media (pointer: coarse), (max-width: 640px) {\n  .vipChange::after')
    expect(at).toBeGreaterThan(0)
    const phone = css.slice(at, css.indexOf('\n}\n', at))
    expect(phone).toContain('.vipChange::after, .vipSetOwn::after { content: \'\'; position: absolute; left: -4px; right: -4px; top: 50%; height: 44px;')
    expect(phone).toContain('.vipInput, .vipKeep, .vipCancel { min-height: 44px; }')
    expect(phone).toContain('.vipInput { font-size: 16px; }')
  })
})
