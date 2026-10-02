const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = require('../src/data/lotofacil-history.json');
const local = base.at(-1);
const novo = { ...local, concurso: local.concurso + 1, dezenas: Array.from({ length: 15 }, (_, i) => i + 2) };
const snapshot = (concursos, added = 0) => ({ concursos, concursoAtual: concursos.at(-1), concursoAnterior: concursos.at(-2), totalConcursos: concursos.length, concursosAdicionados: added, atualizado: added > 0 });
let finishRefresh;
let calls = 0;
ipcMain.handle('lotofacil:load-snapshot', () => snapshot(base));
ipcMain.handle('lotofacil:refresh-history', () => { calls++; return new Promise(resolve => { finishRefresh = resolve; }); });
async function waitFor(check) {
  const limit = Date.now() + 10000;
  while (Date.now() < limit) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error('Timeout aguardando a interface');
}
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.resolve(__dirname, '../dist-electron/preload.mjs') } });
  try {
    await win.loadFile(path.resolve(__dirname, '../dist/index.html'));
    const selected = () => win.webContents.executeJavaScript("document.querySelector('.contest-navigation strong')?.textContent");
    await waitFor(async () => await selected() === String(local.concurso) && finishRefresh);
    assert.equal(calls, 1);
    finishRefresh(snapshot([...base, novo], 1));
    await waitFor(async () => await selected() === String(novo.concurso));
    const numbers = await win.webContents.executeJavaScript("Array.from(document.querySelectorAll('.previous-numbers span'), e => Number(e.textContent))");
    assert.deepEqual(numbers, novo.dezenas);
    console.log('PASS Electron: histórico local visível durante consulta; novo concurso e suas 15 dezenas selecionados sem clique.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
