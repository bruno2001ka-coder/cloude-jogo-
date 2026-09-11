import { access, readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

async function arquivosJavaScript(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const arquivos = [];
  for (const entry of entries) {
    const caminho = join(dir, entry.name);
    if (entry.isDirectory()) arquivos.push(...await arquivosJavaScript(caminho));
    else if (/\.(?:js|mjs)$/.test(entry.name)) arquivos.push(caminho);
  }
  return arquivos.sort();
}

function checar(caminho) {
  return new Promise((resolve, reject) => {
    const processo = spawn(process.execPath, ['--check', caminho], { stdio: 'inherit' });
    processo.on('error', reject);
    processo.on('exit', codigo => codigo === 0
      ? resolve()
      : reject(new Error(`Sintaxe inválida: ${caminho}`)));
  });
}

const arquivos = [
  ...(await arquivosJavaScript('src')),
  ...(await arquivosJavaScript('scripts')),
];
for (const arquivo of arquivos) await checar(arquivo);
// `node --check` aceita import para arquivo inexistente. Valida o grafo local separadamente para
// uma remocao de gerador nunca deixar referencia quebrada que so apareceria no navegador.
for(const arquivo of arquivos){
  const source=await readFile(arquivo,'utf8');
  const imports=[...source.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)].map(m=>m[2]);
  for(const specifier of imports){
    const target=resolve(dirname(arquivo),specifier);
    try{await access(target)}catch{throw new Error(`Import local inexistente: ${arquivo} -> ${specifier}`)}
  }
}
console.log(`Sintaxe OK: ${arquivos.length} arquivos JavaScript verificados.`);
