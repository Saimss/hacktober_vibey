import type { Mood } from './state'

// One PNG strip per state in src/sprites/: idle.png walk.png sleepy.png hungry.png happy.png sad.png
// Each is a single row of square frames. The frame count is detected from the image (width / height).
const files = import.meta.glob('./sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

// Playback speed per state (frames per second). Tweak to taste.
export const FPS: Record<Mood, number> = { idle: 5, walk: 8, sleepy: 3, hungry: 5, happy: 4, sad: 4 }

export type Anim = { url: string; frames: number }
export type Anims = Partial<Record<Mood, Anim>>

export async function loadAnims(): Promise<Anims> {
  const out: Anims = {}
  await Promise.all((Object.keys(FPS) as Mood[]).map(m => new Promise<void>(done => {
    const url = files[`./sprites/${m}.png`]
    if (!url) { console.warn(`Missing src/sprites/${m}.png`); return done() }
    const img = new Image()
    img.onload = () => { out[m] = { url, frames: Math.max(1, Math.round(img.naturalWidth / img.naturalHeight)) }; done() }
    img.onerror = () => done()
    img.src = url
  })))
  return out
}

let cache: Promise<Anims> | undefined
export const getAnims = () => (cache ??= loadAnims())
