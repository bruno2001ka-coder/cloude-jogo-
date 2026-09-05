import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const html = await readFile('index.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map(match => match[1])
  .map(ref => ref.split(/[?#]/, 1)[0])
  .filter(ref => !/^(?:https?:|#|data:|javascript:)/.test(ref));

const ausentes = [];
for (const ref of refs) {
  try { await access(resolve(ref)); }
  catch { ausentes.push(ref); }
}

if (ausentes.length) {
  console.error('Referências locais ausentes no index.html:');
  for (const ref of ausentes) console.error(`- ${ref}`);
  process.exitCode = 1;
} else {
  console.log(`Assets de entrada OK: ${refs.length} referências locais verificadas.`);
}
