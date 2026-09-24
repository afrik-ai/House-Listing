// usage: node scripts/progress.mjs set P03 status=building round=2 verdict="HF2 wins" gap="..."
//        node scripts/progress.mjs log "message" | headline "text" | phase "text" | wave 2 | shot reviews/x.png "caption"
import fs from 'fs';
const f = 'progress/status.json';
const s = JSON.parse(fs.readFileSync(f, 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);
const now = new Date().toISOString();
if (cmd === 'set') {
  const p = s.pieces.find(p => p.id === rest[0]); if (!p) throw new Error('no piece ' + rest[0]);
  for (const kv of rest.slice(1)) { const i = kv.indexOf('='); const k = kv.slice(0, i); let v = kv.slice(i + 1); if (k === 'round') v = Number(v); p[k] = v; }
  p.updated = now;
} else if (cmd === 'log') { s.log.unshift({ t: now, m: rest.join(' ') }); s.log = s.log.slice(0, 300); }
else if (cmd === 'headline') s.headline = rest.join(' ');
else if (cmd === 'phase') s.phase = rest.join(' ');
else if (cmd === 'wave') s.wave = Number(rest[0]);
else if (cmd === 'shot') { s.shots.unshift({ t: now, src: '/' + rest[0].replace(/\\/g, '/'), caption: rest.slice(1).join(' ') }); s.shots = s.shots.slice(0, 24); }
else throw new Error('unknown cmd ' + cmd);
s.updated = now;
fs.writeFileSync(f, JSON.stringify(s, null, 1));
console.log('progress updated:', cmd, rest.slice(0, 2).join(' '));
