import { useEffect } from 'react'
import { load, moodOf, isResting } from './state'

type GreetApi = { greet?: (ctx: { mood: string; petName: string }) => Promise<unknown> }

// Set to true for presentations: bubbles appear often. Set back to false for normal use.
const DEMO = true

const FIRST_MS = DEMO ? 5_000 : 90_000   // first greeting shortly after launch
const nextMs = () => DEMO
  ? (12 + Math.random() * 8) * 1_000                  // demo: every 12-20 seconds
  : (10 + Math.random() * 20) * 60_000                // normal: every 10-30 minutes

// Call once inside the pet window's component. Main decides whether it can speak
// (pet visible, dashboard closed) and shows the bubble; this only asks at random times.
export function useGreeter() {
  useEffect(() => {
    let timer: number
    const fire = async () => {
      const pet = load()
      if (!isResting(pet)) {
        try {
          await (window as unknown as { pet: GreetApi }).pet.greet?.({
            mood: moodOf(pet),
            petName: localStorage.getItem('pet-name') || 'Momo',
          })
        } catch { /* never break the pet over a greeting */ }
      }
      timer = window.setTimeout(fire, nextMs())
    }
    timer = window.setTimeout(fire, FIRST_MS)
    return () => clearTimeout(timer)
  }, [])
}
