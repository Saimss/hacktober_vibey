import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { load, moodOf, isResting, KEY, Mood } from './state'
import { Sprite } from './Sprite'
import './pet.css'
import { useGreeter } from './useGreeter'

const SIZE = 128 // must match main.cjs

function App() {
  useGreeter()
  const [pet, setPet] = useState(load)
  const [walking, setWalking] = useState(false)
  const [flip, setFlip] = useState(false)
  const [flash, setFlash] = useState(false)
  const [hovered, setHovered] = useState(false)
  const petRef = useRef(pet); petRef.current = pet
  const mood = moodOf(pet)
  const moodRef = useRef<Mood>(mood); moodRef.current = mood
  const pauseUntil = useRef(0)
  const hoverRef = useRef(false)
  const drag = useRef({ down: false, active: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const pos = useRef({ x: 0, y: 0 })

  // Mood only changes slowly, so re-read once a minute (no storage writes, no wake-ups elsewhere);
  // react immediately to changes made in the dashboard.
  useEffect(() => {
    const t = setInterval(() => setPet(load()), 60000)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return
      const next = load(), prev = petRef.current
      setPet(next)
      // celebrate when fed / played with / cuddled (not when resting)
      if (!isResting(next) && (next.happy > prev.happy || next.hunger > prev.hunger)) {
        setFlash(true); setTimeout(() => setFlash(false), 2000)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => { clearInterval(t); window.removeEventListener('storage', onStorage) }
  }, [])

  // Wake up exactly when a rest ends instead of polling.
  useEffect(() => {
    const ms = pet.restUntil - Date.now()
    if (ms <= 0) return
    const t = setTimeout(() => setPet(load()), ms + 100)
    return () => clearTimeout(t)
  }, [pet.restUntil])

  // Roaming: a timer chain, not a 60fps loop. While walking it ticks at ~25Hz and moves on a 3px grid
  // (the sprite's pixel size); while resting, sleepy, hovered or hidden it just sleeps between checks.
  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout>
    const STEP = 40, PX = 3
    ;(async () => {
      const b = await window.pet.workArea()
      const pick = () => ({ x: b.x + Math.random() * (b.width - SIZE), y: b.y + Math.random() * (b.height - SIZE) })
      const snap = (n: number) => Math.round(n / PX) * PX
      let sent = { x: NaN, y: NaN }
      const send = () => {
        const x = snap(pos.current.x), y = snap(pos.current.y)
        if (x !== sent.x || y !== sent.y) { sent = { x, y }; window.pet.moveTo(x, y) }
      }
      pos.current = pick(); let target = pick(); let last = performance.now(); send()
      const loop = () => {
        if (stop) return
        const now = performance.now(), dt = Math.min(0.08, (now - last) / 1000); last = now
        const m = moodRef.current
        if (m === 'sleepy' || document.hidden) { setWalking(false); timer = setTimeout(loop, 1000); return }
        if (hoverRef.current || drag.current.active || now < pauseUntil.current) { setWalking(false); timer = setTimeout(loop, 200); return }
        const p = pos.current, dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy)
        if (d < 4) {
          setWalking(false); target = pick()
          const rest = 2000 + Math.random() * 5000
          last = now + rest; timer = setTimeout(loop, rest); return
        }
        const k = Math.min(1, ((m === 'hungry' || m === 'sad' ? 40 : 70) * dt) / d)
        pos.current = { x: p.x + dx * k, y: p.y + dy * k }
        setWalking(true); if (Math.abs(dx) > 1) setFlip(dx < 0)
        send(); timer = setTimeout(loop, STEP)
      }
      loop()
    })()
    return () => { stop = true; clearTimeout(timer) }
  }, [])

  // Idle by default; the real mood only shows on hover. Resting always shows sleepy.
  const name: Mood = isResting(pet) ? 'sleepy' : flash ? 'happy' : hovered ? mood : walking ? 'walk' : 'idle'
  return (
    <Sprite
      name={name}
      size={SIZE}
      flip={flip}
      className="sprite"
      onPointerEnter={() => { setHovered(true); hoverRef.current = true }}
      onPointerLeave={() => { setHovered(false); hoverRef.current = false; pauseUntil.current = performance.now() + 400 }}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { down: true, active: false, sx: e.screenX, sy: e.screenY, ox: pos.current.x, oy: pos.current.y }
      }}
      onPointerMove={e => {
        const d = drag.current; if (!d.down) return
        const dx = e.screenX - d.sx, dy = e.screenY - d.sy
        if (!d.active && Math.hypot(dx, dy) > 4) d.active = true
        if (d.active) {
          pos.current = { x: d.ox + dx, y: d.oy + dy }
          window.pet.moveTo(pos.current.x, pos.current.y)
          pauseUntil.current = performance.now() + 1500
        }
      }}
      onPointerUp={() => { const d = drag.current; if (d.down && !d.active) window.pet.openDashboard(); d.down = false; d.active = false }}
    />
  )
}
createRoot(document.getElementById('root')!).render(<App />)
