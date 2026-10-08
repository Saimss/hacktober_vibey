const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const greeter = require('./greeter.cjs')
// Keep saved data (name, apps, stats) in the same folder as during development.
app.setPath('userData', path.join(app.getPath('appData'), 'desktop-pet'))

const SIZE = 128
let pet, dash, bubble, bubbleTimer, bubbleFlip = false, tray, quitting = false

if (!app.requestSingleInstanceLock()) app.quit()

const web = { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true }
const page = (win, f) => win.loadFile(path.join(__dirname, 'dist', f))

function showDashboard() { dash.show(); dash.focus() }

// --- Speech bubble: a small transparent click-through window that floats above the pet ---
const BW = 300, BH = 170
function createBubble() {
  bubble = new BrowserWindow({
    width: BW, height: BH, show: false, transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, focusable: false, hasShadow: false,
    webPreferences: { contextIsolation: true, autoplayPolicy: 'no-user-gesture-required' }, // lets the blip play
  })
  bubble.setIgnoreMouseEvents(true)
  bubble.setAlwaysOnTop(true, 'screen-saver')
  bubble.loadFile(path.join(__dirname, 'bubble.html'))
}
function runInBubble(js) {
  if (!bubble) return
  const run = () => bubble.webContents.executeJavaScript(js).catch(() => {})
  bubble.webContents.isLoading() ? bubble.webContents.once('did-finish-load', run) : run()
}
function placeBubble() { // returns true when the bubble must sit below the pet (pet near top of screen)
  if (!pet || !bubble) return false
  const p = pet.getBounds(), wa = screen.getDisplayNearestPoint({ x: p.x, y: p.y }).workArea
  const flip = p.y - BH + 10 < wa.y
  const x = Math.min(Math.max(p.x + SIZE / 2 - BW / 2, wa.x), wa.x + wa.width - BW)
  const y = flip ? p.y + SIZE - 10 : p.y - BH + 10
  bubble.setBounds({ x: Math.round(x), y: Math.round(y), width: BW, height: BH })
  return flip
}
function hideBubble() { clearTimeout(bubbleTimer); if (bubble && bubble.isVisible()) bubble.hide() }
function say(text) {
  if (!bubble) return
  const s = greeter.settings()
  bubbleFlip = placeBubble()
  bubble.showInactive()
  runInBubble(`say(${JSON.stringify(text)}, ${JSON.stringify({ sound: s.sound, large: s.large, flip: bubbleFlip })})`)
  clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(hideBubble, 3500 + text.length * 150)
}
const canSpeak = () => !!pet && pet.isVisible() && !(dash && dash.isVisible())
function greetNow() { // tray test item
  const mood = ['happy', 'sad', 'hungry', 'sleepy'][Math.floor(Math.random() * 4)]
  if (canSpeak()) say(greeter.nextGreeting({ mood }).line)
}

app.whenReady().then(() => {
  pet = new BrowserWindow({
    width: SIZE, height: SIZE, transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: false, webPreferences: web,
  })
  pet.setAlwaysOnTop(true, 'screen-saver')
  page(pet, 'index.html')

  dash = new BrowserWindow({ width: 520, height: 640, show: false, title: 'Pet dashboard', autoHideMenuBar: true, webPreferences: web })
  page(dash, 'dashboard.html')
  dash.on('close', e => { if (!quitting) { e.preventDefault(); dash.hide() } }) // hide, don't destroy
  const hidePet = () => { pet.hide(); hideBubble() }
  const showPet = () => { pet.showInactive(); pet.setAlwaysOnTop(true, 'screen-saver') }
  dash.on('show', hidePet); dash.on('restore', hidePet)
  dash.on('hide', showPet); dash.on('minimize', showPet)

  createBubble()
  greeter.init()

  // Start with Windows. Installer/portable builds use the registry Run key; Store (MSIX) builds need a
  // manifest startup task instead, so the toggle is disabled there. Skipped in dev so `npm start`
  // never registers a bare electron.exe.
  const canToggleStartup = app.isPackaged && !process.windowsStore
  if (canToggleStartup) {
    const flag = path.join(app.getPath('userData'), 'startup-configured')
    if (!fs.existsSync(flag)) {            // first run: turn it on once, the tray toggle controls it after that
      app.setLoginItemSettings({ openAtLogin: true })
      fs.mkdirSync(path.dirname(flag), { recursive: true }); fs.writeFileSync(flag, '1')
    }
  }

  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 }))
  tray.setToolTip('Desktop pet')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open dashboard', click: showDashboard },
    { label: 'Greet now (test)', click: greetNow },
    { label: 'Start with Windows', type: 'checkbox', enabled: canToggleStartup, checked: app.getLoginItemSettings().openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit() } },
  ]))
  tray.on('click', showDashboard)
})

ipcMain.handle('workArea', () => screen.getPrimaryDisplay().workArea) // DIPs, excludes taskbar
ipcMain.on('moveTo', (_e, x, y) => {
  if (!pet) return
  pet.setBounds({ x: Math.round(x), y: Math.round(y), width: SIZE, height: SIZE })
  if (bubble && bubble.isVisible()) { // keep the bubble attached while the pet roams
    const f = placeBubble()
    if (f !== bubbleFlip) { bubbleFlip = f; runInBubble(`setFlip(${f})`) }
  }
})
ipcMain.handle('greet', (_e, ctx) => {
  if (!canSpeak()) return null
  const res = greeter.nextGreeting(ctx || {})
  say(res.line)
  return res
})
ipcMain.handle('chat', (_e, payload) => greeter.chat(payload || {}))
ipcMain.on('openDashboard', showDashboard)
ipcMain.on('openUrl', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url) })
app.on('window-all-closed', () => {}) // keep running in the tray
