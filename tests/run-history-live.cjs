const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = mkdtempSync(path.join(os.tmpdir(), 'lottolab-history-live-'));
const source = process.env.LOTTO_TEST_SOURCE || path.join(process.env.APPDATA, 'lottolab', 'lotofacil-history.json');
const local = JSON.parse(readFileSync(source, 'utf8')).filter(c => c.concurso <= 3793);
if (local.at(-1)?.concurso !== 3793) throw Error('Real history through 3793 is required');
writeFileSync(path.join(profile, 'lotofacil-history.json'), JSON.stringify(local));
for (const initial of [3793, 3794]) {
  const env = { ...process.env, LOTTO_TEST_USER_DATA: profile, LOTTO_TEST_INITIAL: String(initial) };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VITE_DEV_SERVER_URL;
  const result = spawnSync(require('electron'), ['tests/history-live.electron.cjs'], { env, windowsHide: true, encoding: 'utf8', timeout: 185000 });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('PASS two real launches; profile: ' + profile);
