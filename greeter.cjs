// Greeting engine (main process, CommonJS).
// Talks to local Ollama, keeps a small pool of pre-generated lines per mood,
// and always falls back to hand-written lines so the pet never goes silent.
const { app, powerMonitor } = require('electron')
const fs = require('fs')
const path = require('path')

const OLLAMA = 'http://127.0.0.1:11434'
const MOODS = ['happy', 'sad', 'hungry', 'sleepy']
const TARGET = 5               // lines kept ready per mood
const MAX_WORDS = 18          // gemma:2b is wordy
const WARMUP_MS = 3 * 60_000   // right after launch, generate even if the user is active
const IDLE_SECS = 30           // afterwards, only generate when the user has been idle this long

const HINT = {
  happy: 'cheerful and bouncy',
  sad: 'a little lonely and sulky',
  hungry: 'dramatically hungry and wants a snack',
  sleepy: 'yawning and drowsy',
}

const FALLBACK = {
  happy: ['Hi hi! Good to see you!', 'Quills up, life is good.', 'Everything is leafy today!', 'You came back!'],
  sad: ['It got a little quiet here...', 'Can we hang out soon?', 'Feeling a bit wilted.', 'Hello? Anyone there?'],
  hungry: ['Snack time? Please?', 'My tummy is making noises.', 'Feed me something leafy!', 'So hungry... so very hungry.'],
  sleepy: ['*yawn* five more minutes...', 'My eyes are closing...', 'Nap o clock.', 'Zzz... oh, hi.'],
}

// Editable at %APPDATA%\desktop-pet\ai.json (created on first run).
const DEFAULT_CFG = { enabled: true, model: 'gemma:2b', sound: true, large: false, ownerName: '', interests: [] }

const cfgFile = () => path.join(app.getPath('userData'), 'ai.json')
const poolFile = () => path.join(app.getPath('userData'), 'greetings.json')
const read = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
const write = (file, value) => { try { fs.writeFileSync(file, JSON.stringify(value, null, 2)) } catch { /* non-fatal */ } }
const pick = a => a[Math.floor(Math.random() * a.length)]
const sleep = ms => new Promise(r => setTimeout(r, ms))

let cfg = { ...DEFAULT_CFG }
let pool = { happy: [], sad: [], hungry: [], sleepy: [] }
let model = null
let petName = 'Momo'
let busy = false
let chatBusy = false   // pauses background greeting generation while a chat reply is in flight
let fails = 0
const started = Date.now()

const allowed = () =>
  cfg.enabled && !chatBusy && (Date.now() - started < WARMUP_MS || powerMonitor.getSystemIdleTime() >= IDLE_SECS)

// Use the model named in ai.json, otherwise the first installed model whose name starts with "gemma".
async function resolveModel() {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) })
    const names = ((await r.json()).models || []).map(m => m.name)
    if (cfg.model && names.includes(cfg.model)) return cfg.model
    return names.find(n => n.toLowerCase().startsWith('gemma')) || null
  } catch { return null }
}

function cleanLine(raw) {
  let s = raw.replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/^["'\u201c\u201d*\-\s]+|["'\u201c\u201d*\s]+$/g, '')
    .replace(/\s+/g, ' ').trim()
  if (s.length < 4 || s.length > 110 || s.split(' ').length > MAX_WORDS) return null
  if (/^(sure|okay|ok|here|certainly|of course)\b/i.test(s)) return null
  if (/\bas an ai\b|\blanguage model\b|\bgreeting\b/i.test(s)) return null
  return s
}

// Small models sometimes add chatter; take the first line that passes the checks.
function clean(raw) {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, '')
  for (const line of text.split('\n')) {
    const ok = cleanLine(line.trim())
    if (ok) return ok
  }
  return null
}

async function generate(mood) {
  if (!model) return null
  const m = model
  const extra = []
  if (cfg.ownerName && Math.random() < 0.5) extra.push(`Your owner is called ${cfg.ownerName}.`)
  if (cfg.interests.length && Math.random() < 0.3) extra.push(`You may playfully mention their interest in ${pick(cfg.interests)}.`)

  // One user message (no system role): original Gemma models handle this most reliably.
  const prompt =
    `You are ${petName}, a tiny pixel porcupine with poisonous green quills who lives on a computer desktop. ` +
    `Reply with ONE short line, at most 10 words. No emojis, no hashtags, no quotation marks, no stage directions, no explanation. ` +
    `Be cute with a hint of sass. Do not mention the time of day.\n` +
    `Example lines: Quills up, life is good. / Feed me something leafy! / Five more minutes...\n` +
    `You feel ${HINT[mood]}. ${extra.join(' ')}\nYour line:`

  try {
    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: m,
        stream: false,
        ...(m.startsWith('gemma4') ? { think: false } : {}),   // Gemma 4 can "think" first; not needed here
        keep_alive: '2m',                                       // unload soon after use to free RAM/GPU
        options: { num_predict: 32, temperature: 0.9, top_p: 0.9, repeat_penalty: 1.1 },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!r.ok) return null
    const line = clean((await r.json()).message?.content || '')
    const all = Object.values(pool).flat()
    return line && !all.includes(line) ? line : null
  } catch { return null }
}

async function refill() {
  if (busy || !model || !allowed()) return
  busy = true
  try {
    for (const mood of MOODS) {
      let moodFails = 0   // a stubborn mood gives up on its own instead of starving the others
      while (pool[mood].length < TARGET && moodFails < 3) {
        if (!allowed()) return
        const line = await generate(mood)
        if (line) { pool[mood].push(line); moodFails = 0; write(poolFile(), pool) } else moodFails++
        await sleep(2000)   // breathe between generations
      }
    }
  } finally { busy = false }
}

// Returns { line, source: 'ai' | 'fallback' }. Always instant.
function nextGreeting(ctx = {}) {
  if (ctx.petName) petName = String(ctx.petName).slice(0, 16)
  const mood = MOODS.includes(ctx.mood) ? ctx.mood : 'happy'
  const line = pool[mood].shift()
  refill()
  if (line) { write(poolFile(), pool); return { line, source: 'ai' } }
  return { line: pick(FALLBACK[mood]), source: 'fallback' }
}

// ---------- Chat (dashboard "Chat" tab) ----------
const CHAT_TURNS = 10   // how many recent messages are sent to the model for context

function persona(mood) {
  const extra = []
  if (cfg.ownerName) extra.push(`Your owner is called ${cfg.ownerName}.`)
  if ((cfg.interests || []).length) extra.push(`They like ${cfg.interests.join(', ')}.`)
  return (
    `You are ${petName}, a tiny pixel porcupine with poisonous green quills who lives on your owner's computer desktop. ` +
    `You are chatting with your owner. Stay in character and be cute with a hint of sass. ` +
    `Reply in one to three short sentences. Plain text only: no emojis, no stage directions, no lists. ` +
    `Never say you are an AI or a language model. You feel ${HINT[mood] || 'calm and curious'} right now. ${extra.join(' ')}`
  ).trim()
}

// Keep only well-formed turns, make roles alternate, and start with a user message (Gemma requires this).
function chatHistory(messages) {
  const out = []
  for (const x of Array.isArray(messages) ? messages.slice(-CHAT_TURNS) : []) {
    if (!x || (x.role !== 'user' && x.role !== 'assistant') || typeof x.content !== 'string') continue
    const content = x.content.replace(/\s+/g, ' ').trim().slice(0, 400)
    if (!content) continue
    const last = out[out.length - 1]
    if (last && last.role === x.role) last.content += ' ' + content
    else out.push({ role: x.role, content })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

function cleanReply(raw) {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\*[^*\n]{0,40}\*/g, '')          // drop stage directions like *wiggles quills*
    .replace(/\s+/g, ' ').trim()
  if (s.toLowerCase().startsWith(petName.toLowerCase() + ':')) s = s.slice(petName.length + 1).trim()
  if (s.length > 400) s = s.slice(0, 400)
  if (!/[.!?]$/.test(s)) {                      // cut a reply that ran out of tokens at its last full sentence
    const i = Math.max(s.lastIndexOf('. '), s.lastIndexOf('! '), s.lastIndexOf('? '))
    if (i > 15) s = s.slice(0, i + 1)
  }
  return s.length >= 2 ? s : null
}

// Returns { ok: true, text } or { ok: false, error } where error is one of:
// 'disabled' | 'ollama-off' | 'no-model' | 'timeout' | 'failed'
async function chat(payload = {}) {
  if (!cfg.enabled) return { ok: false, error: 'disabled' }
  if (chatBusy) return { ok: false, error: 'failed' }
  if (payload.petName) petName = String(payload.petName).slice(0, 16)

  const hist = chatHistory(payload.messages)
  if (!hist.length || hist[hist.length - 1].role !== 'user') return { ok: false, error: 'failed' }

  let names
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) })
    names = ((await r.json()).models || []).map(m => m.name)
  } catch { return { ok: false, error: 'ollama-off' } }
  const m = cfg.model && names.includes(cfg.model) ? cfg.model : names.find(n => n.toLowerCase().startsWith('gemma'))
  if (!m) return { ok: false, error: 'no-model' }
  model = m   // also lets the greeting engine recover if Ollama was off at startup

  // Original Gemma models have no system role, so the persona is folded into the first user turn.
  hist[0] = { role: 'user', content: `${persona(String(payload.mood || ''))}\n\nOwner: ${hist[0].content}` }

  chatBusy = true
  try {
    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: m,
        stream: false,
        ...(m.startsWith('gemma4') ? { think: false } : {}),
        keep_alive: '5m',
        options: { num_predict: 120, temperature: 0.8, top_p: 0.9, repeat_penalty: 1.1 },
        messages: hist,
      }),
    })
    if (!r.ok) return { ok: false, error: 'failed' }
    const text = cleanReply((await r.json()).message?.content || '')
    return text ? { ok: true, text } : { ok: false, error: 'failed' }
  } catch (e) {
    return { ok: false, error: e && e.name === 'TimeoutError' ? 'timeout' : 'failed' }
  } finally { chatBusy = false }
}

const settings = () => ({ sound: cfg.sound !== false, large: !!cfg.large })

function init() {
  cfg = { ...DEFAULT_CFG, ...read(cfgFile(), {}) }
  if (!fs.existsSync(cfgFile())) write(cfgFile(), cfg)   // creates an editable ai.json
  pool = { ...pool, ...read(poolFile(), {}) }
  for (const m of MOODS) if (!Array.isArray(pool[m])) pool[m] = []

  const check = async () => {
    fails = 0
    if (!cfg.enabled) return
    model = await resolveModel()
    if (model) refill()
  }
  setTimeout(check, 20_000)
  setInterval(check, 10 * 60_000)
}

module.exports = { init, nextGreeting, settings, chat }
