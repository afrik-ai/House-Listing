// Validates every GLB in public/assets/models with the Khronos glTF validator; prints errors/warnings.
import fs from 'fs';
import validator from 'gltf-validator';
const D = 'C:/Users/Owner/HouseListing/public/assets/models/';
let bad = 0;
for (const f of fs.readdirSync(D).filter(f => f.endsWith('.glb'))) {
  const r = await validator.validateBytes(new Uint8Array(fs.readFileSync(D + f)), { maxIssues: 20 });
  const i = r.issues;
  if (i.numErrors) { bad++; console.log('ERR ', f, i.numErrors, i.messages.filter(m => m.severity === 0).slice(0, 3).map(m => m.code + ' ' + m.message).join(' | ')); }
  else if (i.numWarnings) console.log('warn', f, i.numWarnings, [...new Set(i.messages.filter(m => m.severity === 1).map(m => m.code))].join(','));
}
console.log('validated; files with errors:', bad);
