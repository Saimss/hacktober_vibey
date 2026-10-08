import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Mood } from './state'
import { Sprite } from './Sprite'

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

const ERRORS: Record<string, string> = {
  disabled: 'My AI is switched off. Set "enabled" to true in ai.json.',
  'ollama-off': "I can't reach my brain. Is Ollama running?",
  'no-model': 'I could not find my model. Run: ollama pull gemma:2b',
  timeout: 'My brain is taking too long. Try again in a moment.',
  failed: 'Something went wrong with my brain. Try again.',
}
const KEEP = 40   // messages kept on screen

type Props = {
  petName: string
  mood: Mood
  log: ChatMsg[]
  setLog: Dispatch<SetStateAction<ChatMsg[]>>
}

export function Chat({ petName, mood, log, setLog }: Props) {
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [log, pending, error])
  useEffect(() => { inputRef.current?.focus() }, [])

  const send = async () => {
    const text = draft.trim()
    if (!text || pending) return
    const next: ChatMsg[] = [...log, { role: 'user' as const, content: text }].slice(-KEEP)
    setLog(next); setDraft(''); setError(''); setPending(true)
    try {
      const res = await window.pet.chat({ messages: next, mood, petName })
      if (res.ok) setLog(l => [...l, { role: 'assistant' as const, content: res.text }].slice(-KEEP))
      else setError(ERRORS[res.error] ?? ERRORS.failed)
    } catch {
      setError(ERRORS.failed)
    } finally {
      setPending(false)
      inputRef.current?.focus()
    }
  }

  const feeling = mood === 'idle' || mood === 'walk' ? 'calm' : mood

  return (
    <section className="chat">
      <div className="chathead">
        <Sprite name={mood} size={64} />
        <div className="who">{petName}<small>feeling {feeling}</small></div>
        <button onClick={() => { setLog([]); setError('') }} disabled={!log.length && !error}>New chat</button>
      </div>
      <div className="chatlog" ref={listRef} role="log" aria-live="polite">
        {log.length === 0 && !pending && <div className="msg pet">Say hi to {petName}!</div>}
        {log.map((m, i) => <div key={i} className={`msg ${m.role === 'user' ? 'me' : 'pet'}`}>{m.content}</div>)}
        {pending && <div className="msg pet typing">{petName} is thinking</div>}
        {error && <div className="msg err" role="alert">{error}</div>}
      </div>
      <div className="chatbar">
        <input
          ref={inputRef} maxLength={300} aria-label="Message" placeholder={`Say something to ${petName}`}
          value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send() }}
        />
        <button onClick={send} disabled={pending || !draft.trim()}>Send</button>
      </div>
    </section>
  )
}
