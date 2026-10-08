import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { act, feed, play, cuddle, rest, load, moodOf, isResting } from './state'
import { Sprite } from './Sprite'
import { Chat } from './Chat'
import type { ChatMsg } from './Chat'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import './dashboard.css'

type Link = { name: string; url: string }
const readApps = (): Link[] => {
  try { const r = localStorage.getItem('apps'); if (r) return JSON.parse(r) } catch {}
  return []
}
const Bar = ({ label, v }: { label: string; v: number }) => (
  <div className="stat">
    <span>{label}</span>
    <div className="bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round(v / 10) ? 'on' : ''} />)}
    </div>
  </div>
)

function App() {
  const [tab, setTab] = useState<'apps' | 'pet' | 'chat'>('apps')
  const [pet, setPet] = useState(load)
  const [chatLog, setChatLog] = useState<ChatMsg[]>([])   // kept here so it survives switching tabs
  const [apps, setApps] = useState(readApps)
  const [name, setName] = useState(''); const [url, setUrl] = useState('')
  const [petName, setPetName] = useState(() => localStorage.getItem('pet-name') || 'Momo')
  const [editing, setEditing] = useState(false)
  const [flash, setFlash] = useState(false)
  const [, rerender] = useState(0)
  const resting = isResting(pet)
  const secsLeft = Math.max(0, Math.ceil((pet.restUntil - Date.now()) / 1000))
  const clock = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`

  // While resting: re-render every second for the countdown, and refresh when it ends.
  useEffect(() => {
    if (pet.restUntil <= Date.now()) return
    const t = setInterval(() => { if (document.hidden) return; rerender(n => n + 1); if (Date.now() >= pet.restUntil) setPet(load()) }, 1000)
    return () => clearInterval(t)
  }, [pet.restUntil])

  useEffect(() => {
    const refresh = () => { if (!document.hidden) setPet(load()) } // skip work while the window is hidden
    window.addEventListener('storage', refresh)
    document.addEventListener('visibilitychange', refresh)  // catch up when it is shown again
    return () => { window.removeEventListener('storage', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  const saveApps = (a: Link[]) => { setApps(a); localStorage.setItem('apps', JSON.stringify(a)) }
  const doRest = () => setPet(act(rest))
  const doAct = (fn: typeof feed) => { setPet(act(fn)); setFlash(true); setTimeout(() => setFlash(false), 2000) }
  const finishRename = () => {
    const n = petName.trim() || 'Momo'
    setPetName(n); localStorage.setItem('pet-name', n); setEditing(false)
  }
  const mood = moodOf(pet)
  const addApp = () => {
    if (!name.trim() || !url.trim()) return
    saveApps([...apps, { name: name.trim(), url: /^https?:\/\//.test(url) ? url.trim() : `https://${url.trim()}` }])
    setName(''); setUrl('')
  }

  return (
    <main>
      <nav>
        <button className={tab === 'apps' ? 'on' : ''} onClick={() => setTab('apps')}>My apps</button>
        <button className={tab === 'pet' ? 'on' : ''} onClick={() => setTab('pet')}>Pet</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>Chat</button>
      </nav>
      {tab === 'apps' ? (
        <section>
          {apps.length === 0 && <p className="empty">No apps yet. Add one below.</p>}
          <ul className="apps">
            {apps.map((a, i) => (
              <li key={i}>
                <button className="launch" onClick={() => window.pet.openUrl(a.url)}><span className="lbl">{a.name}<small>{a.url.replace(/^https?:\/\//, '')}</small></span></button>
                <button className="x" aria-label={`Remove ${a.name}`} onClick={() => saveApps(apps.filter((_, j) => j !== i))}>×</button>
              </li>
            ))}
          </ul>
          <div className="add">
            <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="URL" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addApp()} />
            <button onClick={addApp}>Add app</button>
          </div>
        </section>
      ) : tab === 'chat' ? (
        <Chat petName={petName} mood={mood} log={chatLog} setLog={setChatLog} />
      ) : (
        <section className="petview">
          <div className="stage" role="img" aria-label={`${petName} is feeling ${mood}`}>
            <div className="shadow" />
            <Sprite name={flash ? 'happy' : mood} size={192} />
          </div>
          <div className="panel">
            <div className="namerow">
              {editing
                ? <input className="nameinput" autoFocus maxLength={16} value={petName} aria-label="Pet name"
                    onChange={e => setPetName(e.target.value)} onBlur={finishRename} onKeyDown={e => e.key === 'Enter' && finishRename()} />
                : <h2>{petName}</h2>}
              <button className="pencil" aria-label="Rename pet" onClick={() => setEditing(true)}>
                <svg width="24" height="24" viewBox="0 0 8 8" fill="currentColor" shapeRendering="crispEdges"><path d="M6 1h2v1h-2zM5 2h2v1h-2zM4 3h2v1h-2zM3 4h2v1h-2zM2 5h2v1h-2zM1 6h2v1h-2zM1 7h1v1h-1z" /></svg>
              </button>
            </div>
            <Bar label="Energy" v={pet.energy} /><Bar label="Food" v={pet.hunger} /><Bar label="Happiness" v={pet.happy} />
            <div className="actions">
              <button disabled={resting} onClick={() => doAct(feed)}>Feed</button>
              <button disabled={resting} onClick={() => doAct(play)}>Play</button>
              <button disabled={resting} onClick={() => doAct(cuddle)}>Cuddle</button>
              <button disabled={resting} onClick={doRest}>{resting ? `Zzz ${clock}` : 'Rest'}</button>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
