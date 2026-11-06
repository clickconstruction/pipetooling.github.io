import { describe, expect, it } from 'vitest'
import { agreementDue, agreementPage, agreementPhotoView, agreementPhotoWords, agreementPhotos, agreementShot, agreementState, agreementTiles, arrivalWords, assignmentClash, daysBetween, defaultLevels, machineDayWords, machineDays, machinesOnJob, mintRentalLabel, newMachineReady, newMachineWords, placeAfterLeaving, type MachineAssignment, gaugePreset, hoursLine, isHeld, leaveState, leaveWords, levelWords, rentalWords, lineState, lineWords, nextOpen, questionsFor, templateBlanksWords, verdictOf, walkProgress, type Machine, type MachineCheck, type MachinePhoto, type MachineQuestion } from './machines'

const m: Machine = { id: 'm1', unitLabel: 'E-12', make: 'Kubota', model: 'KX040', kind: 'excavator', templateId: 't-exc', code: 'E12KX040', jobId: 'j1', jobWords: '972 · Test', heldSince: null, levels: defaultLevels('excavator'), rental: null, driveLink: null }
const qs: MachineQuestion[] = [
  { id: 'a', templateId: null, machineId: null, words: 'Hoses, no leaks', holdsMachine: true, when: 'pre' },
  { id: 'b', templateId: null, machineId: null, words: 'Lights work', holdsMachine: false, when: 'pre' },
  { id: 'c', templateId: 't-drill', machineId: null, words: 'Rod box latched', holdsMachine: true, when: 'pre' },
  { id: 'd', templateId: null, machineId: 'm1', words: 'Thumb tight', holdsMachine: false, when: 'pre' },
]
const base: MachineCheck = { id: 'c1', kind: 'pre', machineId: 'm1', jobId: 'j1', jobWords: '972 · Test', day: '2026-11-05', byName: 'Mateo', startedAt: '2026-11-05T13:40:00Z', signedAt: '2026-11-05T13:51:00Z', verdict: 'safe', answers: [], levels: {}, hours: 1418, photos: [], leftWhere: null, runAnyway: null, dispatchedAt: null }

describe('the machine’s questions', () => {
  it('are the shared list, the kind’s and the machine’s own, never another kind’s', () => {
    expect(questionsFor(qs, m).map((q) => q.id)).toEqual(['a', 'b', 'd'])
  })
  it('open the next unanswered row in the walk’s order', () => {
    expect(nextOpen(questionsFor(qs, m), [{ questionId: 'a', pick: 'yes', note: '', photoId: null, at: '' }])?.id).toBe('b')
    expect(walkProgress(questionsFor(qs, m), [{ questionId: 'a', pick: 'no', note: '', photoId: null, at: '' }])).toEqual({ answered: 1, asked: 3, nos: 1 })
  })
})

describe('the verdict', () => {
  it('is held only on a No to a question that holds the machine', () => {
    const own = questionsFor(qs, m)
    expect(verdictOf(own, [{ questionId: 'b', pick: 'no', note: 'dim', photoId: null, at: '' }])).toBe('safe')
    expect(verdictOf(own, [{ questionId: 'a', pick: 'no', note: 'drip', photoId: null, at: '' }])).toBe('held')
  })
})

describe('the card’s line', () => {
  it('reads not checked, then checked with the hours, then held until Dispatch says run it anyway', () => {
    expect(lineWords(lineState([], 'm1', '2026-11-05'), '2026-11-05').head).toBe('Not checked today')
    expect(lineWords(lineState([base], 'm1', '2026-11-05'), '2026-11-05').sub).toContain('1,418 h')
    const held: MachineCheck = { ...base, id: 'c2', verdict: 'held', answers: [{ questionId: 'a', pick: 'no', note: 'wet fitting', photoId: null, at: '' }], startedAt: '2026-11-05T14:00:00Z' }
    expect(lineState([held, base], 'm1', '2026-11-05').kind).toBe('held')
    expect(lineWords(lineState([held, base], 'm1', '2026-11-05'), '2026-11-05').sub).toContain('wet fitting')
    expect(isHeld([{ ...held, runAnyway: { byName: 'Carla', at: '' } }, base], 'm1')).toBeNull()
  })
  it('reads yesterday’s check as not checked today', () => {
    expect(lineState([base], 'm1', '2026-11-06').kind).toBe('unchecked')
    expect(lineWords(lineState([base], 'm1', '2026-11-06'), '2026-11-06').sub).toContain('yesterday')
  })
})

describe('the levels and the hour meter', () => {
  it('read the tank in eighths, the sight glass against its line and the dipstick against its marks', () => {
    const fuel = gaugePreset('tank', 'Fuel')
    const glass = gaugePreset('glass', 'Hydraulic oil')
    const stick = gaugePreset('stick', 'Engine oil')
    const dial = gaugePreset('dial', 'Fuel')
    expect(levelWords(fuel, 25)).toEqual({ word: '¼ · low', low: true })
    expect(levelWords(fuel, 41)).toEqual({ word: 'about ⅜', low: false })
    expect(levelWords(fuel, 100)).toEqual({ word: 'full', low: false })
    expect(levelWords(glass, 65)).toEqual({ word: 'on the line', low: false })
    expect(levelWords(glass, 80)).toEqual({ word: 'above the line', low: false })
    expect(levelWords(glass, 58)).toEqual({ word: 'just under the line', low: false })
    expect(levelWords(glass, 50)).toEqual({ word: 'a bit below the line · low', low: true })
    expect(levelWords(glass, 20)).toEqual({ word: 'below Low · low', low: true })
    expect(levelWords(stick, 55)).toEqual({ word: 'between the marks', low: false })
    expect(levelWords(stick, 20)).toEqual({ word: 'below ADD · low', low: true })
    expect(levelWords(dial, 10)).toEqual({ word: 'deep in the red · low', low: true })
    expect(levelWords(dial, 25)).toEqual({ word: 'in the red · low', low: true })
    expect(levelWords(dial, 35)).toEqual({ word: 'just out of the red', low: false })
    expect(levelWords(dial, 60)).toEqual({ word: 'in the green', low: false })
    expect(levelWords(dial, 95)).toEqual({ word: 'full, in the green', low: false })
    expect(levelWords(glass, undefined).word).toBe('not read')
    expect(defaultLevels('directional_drill').map((d) => d.look)).toEqual(['dial', 'dial', 'stick', 'tank'])
    expect(defaultLevels('trailer')).toEqual([])
  })
  it('flag a reading that went backwards and show the change otherwise', () => {
    expect(hoursLine(1148, { hours: 1412, day: '2026-11-04' }, '2026-11-05')).toEqual({ words: 'Yesterday 1,412 · this is 264 h less. Read it again?', bad: true })
    expect(hoursLine(1418, { hours: 1412, day: '2026-11-04' }, '2026-11-05')).toEqual({ words: 'Yesterday 1,412 · +6 h', bad: false })
    expect(hoursLine(null, null, '2026-11-05').bad).toBe(false)
  })
})

describe('the leaving check, rentals and the Drive folder', () => {
  const post: MachineQuestion = { id: 'q-new-wrong', templateId: null, machineId: null, words: 'Nothing new broken or leaking since the morning', holdsMachine: true, when: 'post' }
  it('asks the leaving questions only on the leaving check', () => {
    expect(questionsFor([...qs, post], m, 'pre').map((x) => x.id)).not.toContain('q-new-wrong')
    expect(questionsFor([...qs, post], m, 'post').map((x) => x.id)).toEqual(['q-new-wrong'])
  })
  it('reads the leaving line from today’s leaving check alone', () => {
    const left: MachineCheck = { ...base, id: 'c9', kind: 'post', startedAt: '2026-11-05T22:10:00Z', signedAt: '2026-11-05T22:12:00Z', hours: 1426 }
    expect(leaveState([base], 'm1', '2026-11-05')).toEqual({ kind: 'none' })
    expect(leaveState([left, base], 'm1', '2026-11-05').kind).toBe('left')
    expect(leaveWords({ kind: 'none' }, 'E-12').head).toBe('Leaving E-12?')
    expect(leaveWords({ kind: 'left', check: left }, 'E-12').sub).toContain('1,426 h')
  })
  it('names a rental by its agreement and says when it is due back', () => {
    const r = { from: 'Sunbelt', agreementNo: '48812-3', outOn: '2026-11-03', dueBack: '2026-11-07' }
    expect(rentalWords(r, '2026-11-05')).toMatchObject({ words: 'Rental · Sunbelt · agreement 48812-3 · due back Nov 7 (2 days)', late: false, soon: false })
    expect(rentalWords(r, '2026-11-07')).toMatchObject({ words: 'Rental · Sunbelt · agreement 48812-3 · due back today', soon: true })
    expect(rentalWords(r, '2026-11-09')).toMatchObject({ late: true })
    expect(rentalWords(r, '2026-11-09').words).toContain('2 days over')
    expect(rentalWords({ ...r, dueBack: '' }, '2026-11-05').words).toContain('open-ended')
    expect(daysBetween('2026-11-05', '2026-11-07')).toBe(2)
  })
  it('tells the office what blanks a template hands the crew: its gauges and the stops of each check', () => {
    const qs: MachineQuestion[] = [
      { id: 'q1', templateId: 't1', machineId: null, words: 'Tracks tight?', holdsMachine: false, when: 'pre' },
      { id: 'q2', templateId: null, machineId: null, words: 'Leaks under it?', holdsMachine: true, when: 'both' },
      { id: 'q3', templateId: 't2', machineId: null, words: 'Bit sharp?', holdsMachine: false, when: 'pre' },
      { id: 'q4', templateId: null, machineId: 'm9', words: 'That one bolt?', holdsMachine: false, when: 'pre' },
    ]
    const levels = [gaugePreset('tank', 'Fuel'), gaugePreset('dial', 'Hydraulic oil'), gaugePreset('glass', 'Coolant')]
    expect(templateBlanksWords(levels, qs, 't1')).toBe('Fuel, Hydraulic oil and Coolant · 2 stops before it runs, 1 when leaving')
    expect(templateBlanksWords([levels[0]!], qs, 't2')).toBe('Fuel · 2 stops before it runs, 1 when leaving')
    expect(templateBlanksWords([], [], 't3')).toBe('No gauges · 0 stops before it runs, 0 when leaving')
  })
})

describe('the plan on a job’s day and the pair per day', () => {
  const plan: MachineAssignment = { id: 'as1', machineId: 'm1', jobId: 'j1', jobWords: '972 · Test', day: '2026-11-05', broughtBy: 'Luis', answer: null, answeredAt: null, why: '' }
  const yard: Machine = { ...m, id: 'm2', unitLabel: 'D-3', jobId: null, jobWords: null }
  it('shows a job the machines planned for today and the ones already on it, each once', () => {
    const on = machinesOnJob({ machines: [m, yard], assignments: [plan, { ...plan, id: 'as2', machineId: 'm2' }] }, 'j1', '2026-11-05')
    expect(on.map((x) => [x.machine.unitLabel, x.placed, Boolean(x.assignment)])).toEqual([['E-12', true, true], ['D-3', false, true]])
    expect(arrivalWords(on[1]!)).toBe('Luis brings it')
    expect(arrivalWords({ ...on[1]!, assignment: { ...plan, answer: 'not_coming', why: 'trailer flat' } })).toBe('Not coming today · trailer flat')
    expect(machinesOnJob({ machines: [yard], assignments: [] }, 'j1', '2026-11-05')).toEqual([])
  })
  it('names the other job a machine is planned on the same day', () => {
    expect(assignmentClash([plan], 'm1', '2026-11-05', 'j9')?.jobWords).toBe('972 · Test')
    expect(assignmentClash([plan], 'm1', '2026-11-06', 'j9')).toBeNull()
    expect(assignmentClash([plan], 'm1', '2026-11-05', 'j1')).toBeNull()
  })
  it('moves the machine where the leaving check says', () => {
    expect(placeAfterLeaving(m, 'yard', null).jobId).toBeNull()
    expect(placeAfterLeaving(m, 'other', { id: 'j2', words: '981 · Oak' }).jobWords).toBe('981 · Oak')
    expect(placeAfterLeaving(m, 'job', null).jobId).toBe('j1')
  })
  it('pairs the walk and the leaving check per day with the hours between', () => {
    const post: MachineCheck = { ...base, id: 'c2', kind: 'post', startedAt: '2026-11-05T22:10:00Z', signedAt: '2026-11-05T22:12:00Z', hours: 1426, leftWhere: 'job' }
    const earlier: MachineCheck = { ...base, id: 'c0', day: '2026-11-03', startedAt: '2026-11-03T13:00:00Z', signedAt: '2026-11-03T13:10:00Z', hours: 1402, jobId: 'j2', jobWords: '981 · Oak' }
    const days = machineDays([post, base, earlier], 'm1')
    expect(days.map((d) => [d.day, d.hoursUsed])).toEqual([['2026-11-05', 8], ['2026-11-03', null]])
    expect(machineDayWords(days[0]!, '2026-11-05')).toContain('1,418 → 1,426 · 8 h · on the job')
    expect(machineDayWords(days[1]!, '2026-11-05')).toContain('no leaving check')
  })
})

describe('a rental’s agreement (punch list #271)', () => {
  const rental: Machine = { ...m, id: 'r1', unitLabel: 'Sunbelt rental', make: 'Bobcat', model: 'E35', rental: { from: 'Sunbelt', agreementNo: '', outOn: '2026-11-06', dueBack: '' } }
  const shot = (id: string, shot: string, filedAt: string | null = null): MachinePhoto => ({ id, shot, fileName: `${shot}.jpg`, src: null, driveFileId: null, filedAt, failWhy: null })
  const withPhoto: MachineCheck = { ...base, id: 'c5', machineId: 'r1', day: '2026-11-06', startedAt: '2026-11-06T12:40:00Z', signedAt: null, verdict: 'unfinished', photos: [shot('p1', 'front'), shot('p2', 'agreement')] }
  it('is not in before the number or the photo, in by the photo, and typed once the office has the number', () => {
    expect(agreementState(rental, [])).toBe('none')
    expect(agreementState(rental, [withPhoto])).toBe('photo')
    expect(agreementState({ ...rental, rental: { ...rental.rental!, agreementNo: '48812-3' } }, [])).toBe('typed')
    expect(agreementState(m, [])).toBe('typed')
  })
  it('holds the pre-use check’s sign until the agreement is in, and never the leaving check', () => {
    expect(agreementDue(rental, 'pre', [])).toBe(true)
    expect(agreementDue(rental, 'pre', [withPhoto])).toBe(false)
    expect(agreementDue(rental, 'post', [])).toBe(false)
    expect(agreementDue(m, 'pre', [])).toBe(false)
  })
  it('lists the agreement photos newest check first, pages in order, and says whether the newest is filed', () => {
    const older: MachineCheck = { ...withPhoto, id: 'c4', day: '2026-11-05', startedAt: '2026-11-05T12:40:00Z', photos: [shot('p0b', 'agreement_p2', '2026-11-05T13:00:00Z'), shot('p0', 'agreement', '2026-11-05T13:00:00Z')] }
    expect(agreementPhotos([older, withPhoto], 'r1').map((x) => [x.photo.id, x.check.id])).toEqual([['p2', 'c5'], ['p0', 'c4'], ['p0b', 'c4']])
    expect(agreementPhotos([withPhoto], 'm1')).toEqual([])
    expect(agreementPhotoWords([withPhoto], 'r1')).toBe('photo in')
    expect(agreementPhotoWords([older], 'r1')).toBe('photo filed')
    expect(agreementPhotoWords([base], 'm1')).toBeNull()
  })
  it('files the agreement page by page and always offers one more tile, since an agreement can run to several pages', () => {
    expect(agreementShot(1)).toBe('agreement')
    expect(agreementShot(3)).toBe('agreement_p3')
    expect(agreementPage('agreement')).toBe(1)
    expect(agreementPage('agreement_p12')).toBe(12)
    expect(agreementPage('return_slip')).toBeNull()
    expect(agreementPage('front')).toBeNull()
    expect(agreementTiles([]).map((t) => [t.shot, t.tile, t.file, t.photo])).toEqual([['agreement', 'The agreement', 'agreement', null]])
    const two = agreementTiles([shot('b', 'agreement_p2'), shot('f', 'front'), shot('a', 'agreement')])
    expect(two.map((t) => [t.page, t.shot, t.tile, t.photo?.id ?? null])).toEqual([
      [1, 'agreement', 'The agreement', 'a'],
      [2, 'agreement_p2', 'Page 2', 'b'],
      [3, 'agreement_p3', 'Another page', null],
    ])
    expect(two[2]?.file).toBe('agreement page 3')
  })
  it('reads the rental line by the state, so a blank number never reads as agreement followed by nothing', () => {
    const r = rental.rental!
    expect(rentalWords(r, '2026-11-06').words).toBe('Rental · Sunbelt · agreement not in yet · open-ended')
    expect(rentalWords({ ...r, dueBack: '2026-11-20' }, '2026-11-06', 'photo').words).toBe('Rental · Sunbelt · agreement photo in · number not typed yet · due back Nov 20 (14 days)')
    expect(rentalWords({ ...r, agreementNo: '48812-3' }, '2026-11-06').words).toBe('Rental · Sunbelt · agreement 48812-3 · open-ended')
  })
  it('mints a rental’s label from its number, else from who it is from', () => {
    expect(mintRentalLabel('Sunbelt', '48812-3')).toBe('Rental 48812-3')
    expect(mintRentalLabel('Sunbelt', '')).toBe('Sunbelt rental')
    expect(mintRentalLabel(' ', ' ')).toBe('Rental')
  })
})

describe('the agreement photo on the fleet board card (punch list #271, PR 2)', () => {
  const check: MachineCheck = { id: 'c9', kind: 'pre', machineId: 'r1', jobId: 'j1', jobWords: '1088 · Riders Walk', day: '2026-11-06', byName: 'Mateo Ruiz', startedAt: '2026-11-06T12:00:00Z', signedAt: null, verdict: 'unfinished', answers: [], levels: {}, hours: null, photos: [], leftWhere: null, runAnyway: null, dispatchedAt: null }
  const photo: MachinePhoto = { id: 'p9', shot: 'agreement', fileName: '2026-11-06 Mateo Ruiz agreement.jpg', src: null, driveFileId: null, filedAt: null, failWhy: null }
  it('draws the signed URL while the bytes are in the bucket, and opens it', () => {
    expect(agreementPhotoView({ photo, check }, 'https://signed/p9')).toMatchObject({ src: 'https://signed/p9', href: 'https://signed/p9', byName: 'Mateo Ruiz', day: '2026-11-06' })
  })
  it('opens the Drive file once the sweep has filed it, with no picture to draw', () => {
    const filed = { ...photo, driveFileId: 'd1', filedAt: '2026-11-06T13:00:00Z' }
    expect(agreementPhotoView({ photo: filed, check }, null)).toMatchObject({ src: null, href: 'https://drive.google.com/file/d/d1/view', fileName: photo.fileName })
  })
  it('has nowhere to open before the URL is read, and names the file', () => {
    expect(agreementPhotoView({ photo, check }, undefined)).toMatchObject({ src: null, href: null, fileName: photo.fileName })
  })
})

describe('the add forms’ gate and press (punch list #271, PR 3)', () => {
  it('ours needs a make and the unit the crew says', () => {
    expect(newMachineReady(true, { unit: 'E-14', make: 'Kubota', from: '', agreementNo: '' })).toBe(true)
    expect(newMachineReady(true, { unit: ' ', make: 'Kubota', from: 'Sunbelt', agreementNo: '1' })).toBe(false)
    expect(newMachineReady(true, { unit: 'E-14', make: '', from: '', agreementNo: '' })).toBe(false)
  })
  it('a rental needs a make and who it is from or its number, the number free to wait for the photo', () => {
    expect(newMachineReady(false, { unit: '', make: 'Bobcat', from: 'Sunbelt', agreementNo: '' })).toBe(true)
    expect(newMachineReady(false, { unit: '', make: 'Bobcat', from: '', agreementNo: '48812-3' })).toBe(true)
    expect(newMachineReady(false, { unit: 'E-14', make: 'Bobcat', from: '', agreementNo: '' })).toBe(false)
  })
  it('the press names what it adds', () => {
    expect(newMachineWords(true, { unit: 'E-14', from: '' })).toBe('E-14')
    expect(newMachineWords(true, { unit: '', from: 'Sunbelt' })).toBe('it')
    expect(newMachineWords(false, { unit: '', from: 'Sunbelt' })).toBe('the Sunbelt rental')
    expect(newMachineWords(false, { unit: '', from: '' })).toBe('the rental')
  })
})
