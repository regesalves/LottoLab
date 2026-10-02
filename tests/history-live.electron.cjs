// Real production main/preload/renderer and HTTPS; isolated profile, no mocked IPC or results.
const { app } = require('electron');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const profile = process.env.LOTTO_TEST_USER_DATA;
if (!profile) throw Error('LOTTO_TEST_USER_DATA is required');
app.setPath('userData', profile);
const initial = Number(process.env.LOTTO_TEST_INITIAL || 3793);
const expected = [1, 3, 4, 5, 6, 8, 10, 12, 13, 15, 18, 19, 21, 23, 24];
const started = Date.now();
const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const start = Date.now();
  const response = await originalFetch(...args);
  requests.push({ url: String(args[0]), status: response.status, ms: Date.now() - start });
  console.log(JSON.stringify(requests.at(-1)));
  return response;
};
const deadline = setTimeout(() => { console.error('FAIL real startup timeout', requests); app.exit(1); }, 180000);
app.on('browser-window-created', (_, win) => {
  win.hide();
  win.webContents.once('dom-ready', async () => {
    try {
      const observations = [];
      while (Date.now() - started < 179000) {
        const state = await win.webContents.executeJavaScript(`({
          selected: document.querySelector('.contest-navigation strong')?.textContent,
          numbers: Array.from(document.querySelectorAll('.previous-numbers span'), e => Number(e.textContent))
        })`);
        if (state.selected && observations.at(-1)?.selected !== state.selected) observations.push({ ...state, ms: Date.now() - started });
        if (state.selected === '3794') {
          assert.equal(observations[0].selected, String(initial), 'local snapshot must appear first');
          assert.deepEqual(state.numbers, expected);
          const saved = JSON.parse(readFileSync(path.join(profile, 'lotofacil-history.json'), 'utf8'));
          assert.deepEqual(saved.find(c => c.concurso === 3794).dezenas, expected);
          assert.equal(new Set(saved.map(c => c.concurso)).size, saved.length);
          console.log(JSON.stringify({ result: 'PASS', initial, observations, requests, persisted: 3794 }));
          clearTimeout(deadline);
          app.exit(0);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw Error('3794 not selected');
    } catch (error) {
      console.error(error);
      clearTimeout(deadline);
      app.exit(1);
    }
  });
});
const mainFile = process.env.LOTTO_TEST_MAIN || path.resolve(__dirname, '../dist-electron/main.js');
import(pathToFileURL(mainFile).href).catch(error => { console.error(error); app.exit(1); });
