# Quintal 3D

Jogo 3D em Three.js — bairro brasileiro estilizado, com cultivo/economia, bots nas vielas, fazenda, modo drone e radar.

Esta versão carrega o Three.js e os addons de pós-processamento por CDN (unpkg), então **precisa de internet pra rodar** — em troca, ganha:

- Pós-processamento real (`EffectComposer` + `UnrealBloomPass`) — bloom nas janelas acesas e no lampião do esconderijo.
- Iluminação de ambiente via HDRI (`assets/ceu.hdr`, CC0 / [Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)) — reflexo mais real em vidro e metal.

A versão single-file 100% offline (sem internet, sem CDN) continua existindo separada — essa aqui é a versão "gráficos web".

## Rodar localmente

Precisa servir por HTTP (não abre direto com duplo-clique, por causa dos módulos ES):

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000/`.

## Publicar no GitHub Pages

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git branch -M main
git push -u origin main
```

Depois, no GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)**. O jogo fica disponível em `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`.
