import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

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
console.log(`Sintaxe OK: ${arquivos.length} arquivos JavaScript verificados.`);
