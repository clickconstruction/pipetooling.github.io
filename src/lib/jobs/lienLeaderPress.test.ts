import { describe, expect, it } from 'vitest'
import { lienLeaderPressWords } from './lienLeaderPress'
import { plainWordsFailures } from '../plainWords'

describe('lienLeaderPressWords · the three presses say whose okay it is (v2.7308)', () => {
  it('names the leader as the app has him on the job, by first name', () => {
    const w = lienLeaderPressWords('Malachi Whites', 'affidavit')
    expect(w.name).toBe('Malachi')
    expect(w.onWord).toBe('Malachi said to file it…')
    expect(w.approve).toBe('I approve it ▸')
    expect(w.ask).toBe('Ask Malachi to approve ▸')
    expect(w.onWordLine).toBe('Write down what Malachi said. It goes in Ready to file on that word.')
    expect(w.approveLine).toBe('Your okay puts it in Ready to file. The paper is signed before a notary.')
    expect(w.askLine).toBe('Goes to Malachi. An affidavit is sworn and filed at the county, and Malachi signs it.')
  })

  it('a notice or a retainage notice is sent, then waits to print, and the leader signs it himself', () => {
    const n = lienLeaderPressWords('Malachi Whites', 'notice')
    expect(n.onWord).toBe('Malachi said to send it…')
    expect(n.approve).toBe('Sign and approve ▸')
    expect(n.ask).toBe('Ask Malachi to approve ▸')
    // v2.7448: his own press says where the paper waits next, in the step's plain words.
    expect(n.approveLine).toBe('Your name goes on the paper. It then waits to print.')
    expect(n.onWordLine).toBe('Write down what Malachi said. It then waits to print, on that word.')
    expect(n.askLine).toBe('Goes to Malachi, then out with the next mailing.')
    // A retainage notice reads as a notice, but for where it waits: its approved pile is Approved · to mail (v2.7434).
    expect(lienLeaderPressWords('Malachi Whites', 'retainage')).toEqual({ ...n, onWordTitle: n.onWordTitle.replace('to print', 'to mail'), onWordLine: 'Write down what Malachi said. It then waits to mail, on that word.', approveLine: 'Your name goes on the paper. It then waits to mail.' })
  })

  it('falls back to the leader when the job has no master the desk knows', () => {
    for (const none of [null, undefined, '', '   ']) {
      const w = lienLeaderPressWords(none, 'affidavit')
      expect(w.name).toBe('the leader')
      expect(w.onWord).toBe('The leader said to file it…')
      expect(w.ask).toBe('Ask the leader to approve ▸')
      expect(w.askLine).toBe('Goes to the leader. An affidavit is sworn and filed at the county, and the leader signs it.')
    }
  })

  it('every line reads in plain words', () => {
    for (const paper of ['affidavit', 'notice'] as const) for (const name of ['Malachi Whites', '']) {
      const w = lienLeaderPressWords(name, paper)
      for (const line of [w.onWordTitle, w.onWordLine, w.approveLine, w.askLine]) expect(plainWordsFailures(line), line).toEqual([])
    }
  })
})
