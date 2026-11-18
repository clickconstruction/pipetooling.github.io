import { useSyncExternalStore } from 'react'
import { getUnreadDevAnswers, subscribeUnreadDevAnswers } from '../lib/tellTheDev/answerDot'

/** The count behind the wrench's dot: answers to this person's notes that they have not read. */
export function useUnreadDevAnswers(): number {
  return useSyncExternalStore(subscribeUnreadDevAnswers, getUnreadDevAnswers, getUnreadDevAnswers)
}
