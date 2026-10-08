export type Mood = 'idle' | 'walk' | 'sleepy' | 'hungry' | 'happy' | 'sad'
export type Pet = { hunger: number; energy: number; happy: number; lastSeen: number; restUntil: number }
export const KEY = 'pet-state'

export const REST_MS = 3 * 60_000 // how long one rest lasts (the cooldown)
const REST_GAIN = 20              // energy restored per minute while resting (3 min = +60)

const clamp = (n: number) => Math.max(0, Math.min(100, n))
export const isResting = (p: Pet, now = Date.now()) => p.restUntil > now

// Apply elapsed-time decay (works while the app was closed too).
export function tick(p: Pet, now = Date.now()): Pet {
  const mins = Math.max(0, (now - p.lastSeen) / 60000)
  const restMins = Math.max(0, Math.min(now, p.restUntil) - p.lastSeen) / 60000
  const nap = new Date(now).getHours() < 7 || p.energy < 20
  return {
    ...p,
    hunger: clamp(p.hunger - 0.1 * mins),
    energy: clamp(p.energy + REST_GAIN * restMins + (nap ? 0.3 : -0.05) * (mins - restMins)),
    happy: clamp(p.happy - 0.05 * mins),
    lastSeen: now,
  }
}
export function load(): Pet {
  try { const r = localStorage.getItem(KEY); if (r) return tick({ restUntil: 0, ...JSON.parse(r) }) } catch {}
  return { hunger: 80, energy: 80, happy: 80, lastSeen: Date.now(), restUntil: 0 }
}
export const save = (p: Pet) => localStorage.setItem(KEY, JSON.stringify(p))
export function act(fn: (p: Pet) => Pet): Pet { const p = fn(load()); save(p); return p }

export const feed = (p: Pet): Pet => ({ ...p, hunger: clamp(p.hunger + 25), happy: clamp(p.happy + 5) })
export const play = (p: Pet): Pet => ({ ...p, happy: clamp(p.happy + 20), energy: clamp(p.energy - 10), hunger: clamp(p.hunger - 5) })
export const cuddle = (p: Pet): Pet => ({ ...p, happy: clamp(p.happy + 8) })
export const rest = (p: Pet): Pet => (isResting(p) ? p : { ...p, restUntil: Date.now() + REST_MS })

// Priority: resting/sleepy > hungry > sad > happy > idle
export function moodOf(p: Pet): Mood {
  if (isResting(p) || p.energy < 20) return 'sleepy'
  if (p.hunger < 30) return 'hungry'
  if (p.happy < 30) return 'sad'
  return p.happy > 70 ? 'happy' : 'idle'
}
