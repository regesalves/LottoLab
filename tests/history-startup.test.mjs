import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const contest = n => ({ concurso: n, data: '01/10/2026', dezenas: Array.from({ length: 15 }, (_, i) => i + 1) });
function moduleUnderTest(file, dependencies, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, console: { warn() {} }, URL, setTimeout: (fn) => { queueMicrotask(fn); return 0; }, clearTimeout() {}, ...globals });
  return exports;
}
function history(fetcher, { failWrite = false, discovery = "https://servicebus3.caixa.gov.br/portaldeloterias" } = {}) {
  let saved = [contest(1), contest(2), contest(2)];
  let pending;
  const requests = [];
  const urls = [];
  const api = moduleUnderTest('../electron/history.ts', {
    electron: { app: { getPath: () => '/local' } },
    'node:path': { join: (...parts) => parts.join('/') },
    '../src/data/lotofacil-history.json': [contest(1)],
    'node:fs/promises': {
      readFile: async () => JSON.stringify(saved),
      writeFile: async (_, contents) => { if (failWrite) throw Error('disk'); pending = JSON.parse(contents); },
      rename: async () => { saved = pending; },
    },
  }, {
    AbortSignal: { timeout: ms => { assert.equal(ms, 3000); return 'signal'; } },
    fetch: async (url, options) => {
      assert.equal(options.signal, 'signal');
      urls.push(url);
      if (url.endsWith('params.txt')) return { ok: true, json: async () => ({ urlapiloterias: discovery }) };
      const n = Number(url.split('/').at(-1)); requests.push(n);
      return fetcher(n, url);
    },
  });
  return { api, requests, urls, saved: () => saved };
}
const response = n => ({ ok: true, status: 200, json: async () => ({ numero: n, dataApuracao: contest(n).data, listaDezenas: contest(n).dezenas.map(String) }) });
const missing = { ok: false, status: 404 };

test('local loads without network; up-to-date installation checks only next contest', async () => {
  const h = history(() => missing);
  assert.equal((await h.api.loadHistorySnapshot()).totalConcursos, 2);
  assert.deepEqual(h.requests, []);
  const result = await h.api.refreshHistorySnapshot();
  assert.deepEqual(h.requests, [3]);
  assert.equal(result.erroAtualizacao, undefined);
});
test('fills all missing contests, persists, normalizes and survives restart', async () => {
  const h = history(n => n <= 5 ? response(n) : missing);
  const result = await h.api.refreshHistorySnapshot();
  assert.deepEqual(h.requests, [3, 4, 5, 6]);
  assert.equal(result.concursoAtual.concurso, 5);
  assert.equal(result.concursoAtual.dezenas.length, 15);
  assert.equal(result.concursosAdicionados, 3);
  assert.deepEqual(h.saved().map(c => c.concurso), [1, 2, 3, 4, 5]);
  assert.equal((await h.api.loadHistorySnapshot()).concursoAtual.concurso, 5);
});
for (const failure of ['timeout', '429', '500', 'invalid', 'wrong contest', 'disk']) {
  test(`preserves local history without retries on ${failure}`, async () => {
    const h = history(() => {
      if (failure === 'timeout') throw Error('TimeoutError');
      if (failure === 'invalid') return { ok: true, json: async () => ({}) };
      if (failure === 'wrong contest') return response(99);
      if (failure === 'disk') return response(3);
      return { ok: false, status: Number(failure) };
    }, { failWrite: failure === 'disk' });
    const result = await h.api.refreshHistorySnapshot();
    assert.equal(result.concursoAtual.concurso, 2);
    assert.ok(result.erroAtualizacao);
    assert.deepEqual(h.requests, [3]);
    assert.equal(h.saved().at(-1).concurso, 2);
  });
}
test('keeps progress when a later request fails and shares concurrent refresh', async () => {
  const h = history(n => { if (n === 3) return response(3); throw Error('offline'); });
  const first = h.api.refreshHistorySnapshot();
  assert.equal(first, h.api.refreshHistorySnapshot());
  const result = await first;
  assert.equal(result.concursoAtual.concurso, 3);
  assert.equal(result.concursosAdicionados, 1);
  assert.ok(result.erroAtualizacao);
  assert.equal(h.saved().at(-1).concurso, 3);
});
test('startup publishes local before network completes, then selects newest with 15 numbers', async () => {
  let resolve;
  const waiting = new Promise(r => { resolve = r; });
  const bridge = {
    loadSnapshot: async () => ({ concursoAtual: contest(2) }),
    refresh: () => waiting,
  };
  const mod = moduleUnderTest('../src/history/lotofacilHistoryProvider.ts', {
    '../data/lotofacil-latest.json': [],
  }, { lotofacilHistorico: bridge });
  const published = [];
  let selected;
  const running = mod.iniciarHistorico(mod.createLotofacilHistoryProvider(), snapshot => {
    published.push(snapshot); selected = snapshot.concursoAtual;
  }, () => true);
  await new Promise(r => setImmediate(r));
  assert.equal(selected.concurso, 2);
  resolve({ concursoAtual: contest(3) });
  await running;
  assert.equal(published.length, 2);
  assert.equal(selected.concurso, 3);
  assert.equal(selected.dezenas.length, 15);
});
test('startup retains published local snapshot if IPC refresh rejects', async () => {
  const mod = moduleUnderTest('../src/history/lotofacilHistoryProvider.ts', { '../data/lotofacil-latest.json': [] });
  const published = [];
  await mod.iniciarHistorico({ carregar: async () => ({ concursoAtual: contest(2) }), refresh: async () => { throw Error('IPC'); } }, x => published.push(x), () => true);
  assert.equal(published.length, 1);
  assert.equal(published[0].concursoAtual.concurso, 2);
});


test('official gateway HTTP 500 wrapping 404 means next contest is not published', async () => {
  const h = history(() => ({ ok: false, status: 500, json: async () => ({ exceptionMessage: JSON.stringify({ StatusCode: 404 }) }) }));
  const result = await h.api.refreshHistorySnapshot();
  assert.equal(result.erroAtualizacao, undefined);
  assert.equal(result.concursoAtual.concurso, 2);
  assert.equal(h.urls.length, 1);
});
test('discovers a migrated official endpoint once and reuses it', async () => {
  const h = history((n, url) => {
    if (url.includes('servicebus3.')) throw Error('timeout');
    return n === 3 ? response(n) : missing;
  }, { discovery: 'https://servicebus4.caixa.gov.br/portaldeloterias' });
  assert.equal((await h.api.refreshHistorySnapshot()).concursoAtual.concurso, 3);
  assert.equal(h.urls.filter(url => url.endsWith('params.txt')).length, 1);
  assert.ok(h.urls.at(-1).includes('servicebus4.'));
});
test('rejects untrusted endpoint in configuration', async () => {
  const h = history(() => { throw Error('timeout'); }, { discovery: 'https://attacker.example/portaldeloterias' });
  assert.ok((await h.api.refreshHistorySnapshot()).erroAtualizacao);
  assert.equal(h.urls.length, 2);
  assert.ok(h.urls.every(url => !url.includes('attacker')));
});
test('startup recovers automatically after a transient error with spaced retries', async () => {
  const delays = [];
  const mod = moduleUnderTest('../src/history/lotofacilHistoryProvider.ts', { '../data/lotofacil-latest.json': [] }, {
    setTimeout: (fn, ms) => { delays.push(ms); queueMicrotask(fn); return 0; },
  });
  let calls = 0;
  const published = [];
  await mod.iniciarHistorico({
    carregar: async () => ({ concursoAtual: contest(2) }),
    refresh: async () => ++calls === 1 ? { erroAtualizacao: 'offline', concursoAtual: contest(2) } : { concursoAtual: contest(3) },
  }, x => published.push(x), () => true);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [30000]);
  assert.equal(published.at(-1).concursoAtual.concurso, 3);
});
test('startup bounds retries and cancellation stops scheduled refreshes', async () => {
  const mod = moduleUnderTest('../src/history/lotofacilHistoryProvider.ts', { '../data/lotofacil-latest.json': [] });
  let calls = 0;
  const provider = { carregar: async () => ({}), refresh: async () => { calls++; throw Error('offline'); } };
  await mod.iniciarHistorico(provider, () => {}, () => true);
  assert.equal(calls, 3);
  const controller = new AbortController();
  calls = 0;
  await mod.iniciarHistorico(provider, () => controller.abort(), () => true, controller.signal);
  assert.equal(calls, 0);
});
