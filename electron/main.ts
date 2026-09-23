import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { unlink, writeFile } from 'node:fs/promises'
import {
  carregarEAtualizarHistorico,
  getContestByNumber,
  loadHistorySnapshot,
  refreshHistorySnapshot,
} from './history'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let carregamentoHistorico: ReturnType<typeof carregarEAtualizarHistorico> | null = null

ipcMain.handle('lotofacil:carregar-historico', () => {
  carregamentoHistorico ??= carregarEAtualizarHistorico()
  return carregamentoHistorico
})

ipcMain.handle('lotofacil:load-snapshot', () => loadHistorySnapshot())
ipcMain.handle('lotofacil:refresh-history', () => refreshHistorySnapshot())
ipcMain.handle('lotofacil:get-contest-by-number', (_, numero: number) => getContestByNumber(numero))

type JogoParaExportacao = {
  id: string
  dezenas: number[]
  quantidade: number
  pares: number
  soma: number
  repetidas: number
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

function montarHtmlExportacao(jogos: JogoParaExportacao[]) {
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
  const cards = jogos.map((jogo) => {
    const dezenas = jogo.dezenas.map((dezena) => `<span class="ball">${String(dezena).padStart(2, '0')}</span>`).join('')
    return `
      <article class="game-card">
        <div class="game-heading"><h2>${escapeHtml(jogo.id.replace('jogo-', 'Jogo '))}</h2><span>${jogo.quantidade} dezenas</span></div>
        <div class="balls">${dezenas}</div>
        <div class="metrics"><span>${jogo.pares} pares</span><span>Soma ${jogo.soma}</span><span>Repetidas ${jogo.repetidas}</span></div>
      </article>`
  }).join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>LottoLab - Jogos gerados</title>
    <style>
      *{box-sizing:border-box} body{margin:0;color:#19132f;font-family:"Segoe UI",Arial,sans-serif;background:#fff}
      .page{padding:38px 42px}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e5d8f4;padding-bottom:22px;margin-bottom:24px}
      .brand{display:flex;align-items:center;gap:12px}.mark{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(145deg,#8b34e3,#5715b7);color:#fff;font-size:24px;font-weight:800}
      h1{margin:0;font-size:27px;letter-spacing:-.7px}.brand-accent{color:#6e20d2}.subtitle{margin:4px 0 0;color:#675e7e;font-size:12px}.date{margin:3px 0 0;color:#81758e;font-size:10px;text-align:right}
      .summary{display:inline-flex;gap:7px;align-items:center;padding:7px 10px;border:1px solid #d8c5ec;border-radius:7px;background:#faf8fd;color:#4e4165;font-size:11px;font-weight:700}.summary strong{display:grid;place-items:center;min-width:22px;height:22px;border-radius:5px;background:#7022c8;color:#fff;font-size:13px}
      .games{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.game-card{break-inside:avoid;border:1px solid #ded4e9;border-radius:12px;padding:15px;background:#fff;box-shadow:0 3px 9px rgba(74,39,108,.05)}
      .game-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.game-heading h2{margin:0;font-size:14px}.game-heading span{padding:4px 7px;border-radius:999px;background:#f1ebf8;color:#5f427f;font-size:9px;font-weight:700}
      .balls{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:14px 0}.ball{display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:#7022a4;color:#fff;font-size:10px;font-weight:800}
      .metrics{display:flex;flex-wrap:wrap;gap:6px}.metrics span{padding:5px 7px;border-radius:999px;background:#f1ebf8;color:#5d4d6c;font-size:9px;font-weight:700}
      footer{margin-top:26px;padding-top:12px;border-top:1px solid #e5d8f4;color:#81758e;font-size:9px;text-align:center}
    </style></head><body><main class="page"><header class="header"><div><div class="brand"><div class="mark">L</div><h1>Lotto<span class="brand-accent">Lab</span></h1></div><p class="subtitle">Jogos gerados com estratégia</p></div><div><div class="summary"><strong>${jogos.length}</strong> Combinações geradas</div><p class="date">${escapeHtml(data)}</p></div></header><section class="games">${cards}</section><footer>Relatório gerado pelo LottoLab</footer></main></body></html>`
}

ipcMain.handle('lotofacil:exportar-pdf', async (event, payload: { jogos?: JogoParaExportacao[] }) => {
  const jogos = Array.isArray(payload?.jogos) ? payload.jogos.slice(0, 1000) : []
  if (jogos.length === 0) return { saved: false, reason: 'empty' }

  const parent = BrowserWindow.fromWebContents(event.sender) ?? win
  const saveOptions = {
    title: 'Exportar jogos para PDF',
    defaultPath: `LottoLab-jogos-${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
  }
  const result = parent
    ? await dialog.showSaveDialog(parent, saveOptions)
    : await dialog.showSaveDialog(saveOptions)
  if (result.canceled || !result.filePath) return { saved: false, reason: 'cancelled' }

  const htmlPath = path.join(app.getPath('temp'), `lottolab-export-${Date.now()}.html`)
  const exportWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await writeFile(htmlPath, montarHtmlExportacao(jogos), 'utf8')
    await exportWindow.loadFile(htmlPath)
    const pdf = await exportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'default' },
    })
    await writeFile(result.filePath, pdf)
    return { saved: true, path: result.filePath }
  } finally {
    exportWindow.destroy()
    await unlink(htmlPath).catch(() => undefined)
  }
})

function createWindow() {
  win = new BrowserWindow({
    icon: VITE_DEV_SERVER_URL
      ? path.join(process.env.APP_ROOT, 'LottoLab-icon.ico')
      : path.join(process.resourcesPath, 'LottoLab-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  win.setMenu(null)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
