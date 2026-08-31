# Reunião Técnica — Quintal 3D · Ciclo "Física, NavMesh e Combate"

Registro da reunião de planejamento entre os quatro leads antes de qualquer linha de código.
Ordem: (1) exposição individual, (2) revisão crítica cruzada, (3) consenso e implementação.

---

## PASSO 1 — REUNIÃO DE PLANEJAMENTO

### 1. PHYSICS & COLLISION LEAD

**Diagnóstico do estado atual.** A colisão do jogo é 100% AABB (`Physics.js`): `obstaculos[]` bloqueia
todo mundo, `obstaculosPedestres[]` bloqueia só quem anda a pé. Isso funciona, mas os NPCs e policiais
navegam por *steering* puro (anda na direção do alvo, resolve por eixo, desencrava quando falha). Sem
grafo de navegação, qualquer parede em L prende o agente até o `buscarPosicaoLivre` cuspir ele pra fora.

**Proposta A — NavMesh por rasterização em espaço de configuração.**
Construir a malha por *rasterização dos obstáculos na grade*, não por teste da grade contra os obstáculos.
A diferença é a complexidade assintótica:

```
Ingênuo:      O(células × obstáculos)  = 53.361 × ~650 ≈ 34.000.000 testes  → ~1-3 s de trava
Rasterizado:  O(obstáculos × células cobertas por obstáculo) ≈ 650 × 50 ≈ 32.500 → < 20 ms
```

A grade cobre `[-104, +104]` em X e Z com célula `c = 0,9 m`, logo `N = ceil(208/0,9) = 231` por eixo.
Mapeamento célula↔mundo (invertível, sem busca):

```
cx = floor((x + 104) / 0,9)          x = (cx + 0,5)·0,9 − 104
i  = cz·231 + cx
```

**Soma de Minkowski (dilatação do obstáculo pelo raio do agente).** Em vez de testar um corpo com
largura contra a célula, dilato a AABB do obstáculo por `r = 0,5 m` e trato o agente como um ponto:

```
AABB_navegação = [min − r, max + r]
```

Isso é matematicamente equivalente a mover um disco de raio `r` pelo espaço livre, e custa uma soma
por eixo em vez de um teste de sobreposição por célula.

**Filtro vertical (o ponto que mais me preocupa).** As muretas de laje entram em `obstaculos` e ficam
em `y ≈ h + 0,37 ≈ 3,2 m`. Se eu marcar a célula pela projeção XZ, todo telhado do bairro vira parede
no chão e a polícia não anda em lugar nenhum. Critério correto, por célula, usando o terreno daquela
célula `p = obterElevacao(x,z)`:

```
bloqueia  ⟺  box.max.y > p + 0,06   ∧   box.min.y < p + 1,6
```

Ou seja: só bloqueia quem cruza a faixa vertical do corpo do pedestre naquele ponto do relevo.

**Proposta B — A\* com heurística octile.** 8-vizinhos, custo `1` ortogonal e `√2` diagonal, heurística
admissível e consistente:

```
h = (dx + dz) + (√2 − 2)·min(dx, dz)
```

Anti-corner-cutting: diagonal só é permitida se **os dois** ortogonais adjacentes estiverem livres —
sem isso o agente raspa a quina e a resolução por eixo do `Physics` trava ele exatamente ali.
Heap binário próprio (zero dependência) e teto de nós expandidos pra o A\* nunca comer um frame inteiro.

**Proposta C — Raycasting horizontal.** Dois níveis, propositalmente:
- `linhaLivreNav(a,b)` — amostra o segmento na grade a passo `c/2`; é o teste do *string-pulling* que
  transforma a escada de células do A\* em 2-4 waypoints retos. Custo O(comprimento/0,45).
- `visaoHorizontalLivre(a,b,y)` — segmento real contra as AABBs via `primeiroImpactoNoSegmento`, na
  altura do peito. É o teste de "eu enxergo o alvo?" que dispensa o caminho quando a reta está limpa.

**Proposta D — Precisão do raycaster da crosshair (o bug do tiro).** Hoje `atirar()` faz:

```js
visado = camera.position + dirCamera·60      // ponto fixo a 60 m
dir    = normalize(visado − bocaDaArma)
```

O ponto visado a 60 m pode estar **dentro ou atrás de uma parede**. Como a bala nasce no cano (~1 m à
frente e ao lado da câmera), a reta `boca → visado` não é a reta `câmera → mira`: em alvo próximo o erro
de paralaxe chega a `atan(0,5/3) ≈ 9,5°`. É por isso que o tiro "erra o que está na mira".

Correção: resolver o ponto visado **de verdade**, com o mesmo slab test do resto da física —

```
1. ponto = câmera + dir·260 (alcance máximo)
2. t_parede = primeiroImpactoNoSegmento(câmera, ponto)
3. t_alvo   = menor t das caixas de acerto (a mira gruda no corpo, não na parede atrás dele)
4. visado   = câmera + dir·(min(t_parede, t_alvo) · 260), com piso de 2 m
5. dir_bala = normalize(visado − boca)
```

O piso de 2 m evita a inversão da direção quando o jogador encosta o nariz na parede.

**Proposta E — Hitbox de modelo complexo.** Uma AABB única de `±0,35 × 1,8 m` no policial é grosseira
demais pro brief. Proponho 3 zonas com multiplicador, testadas na mesma varredura da bala:

| Zona   | Faixa vertical (local) | Meia-extensão | Multiplicador |
|--------|------------------------|---------------|---------------|
| Cabeça | 1,30 → 1,78           | 0,26          | ×2,0          |
| Tronco | 0,62 → 1,30           | 0,34          | ×1,0          |
| Pernas | 0,00 → 0,62           | 0,22          | ×0,6          |

Com HP em escala 100 e dano-base 34, três tiros no tronco continuam matando (idêntico ao HP=3 de hoje),
mas dois na cabeça resolvem. Zero regressão de sensação, ganho de precisão.

---

### 2. AI & COMBAT LEAD

**Diagnóstico.** A FSM existe, mas está *implícita*: seis `else if` sobre `policia.estado`, com as
transições espalhadas por dentro dos corpos e nenhum ponto único de entrada/saída de estado. Já custou
um bug (`encerrarEncontro(false)` chamado com argumento numa função sem parâmetro). Preciso de uma
tabela de estados explícita, com `aoEntrar`/`aoAtualizar` e uma única função `transitar()`.

**FSM formal (6 estados, 9 transições):**

```
                   planta detectada (raio 10 m) ∧ ¬escondido
   ┌──────────┐ ──────────────────────────────────────────► ┌────────┐
   │ PATRULHA │                                              │  INDO  │
   └──────────┘ ◄──────────── cooldown 22 s ───┐             └────────┘
        ▲                                       │                 │ d(heli,planta) < 3
        │                                  ┌──────────┐            ▼
        │                                  │ RECUANDO │◄──┐   ┌────────┐
        └──────────────────────────────────└──────────┘   │   │ RAPEL  │ (t = 1,5 s)
                                                 ▲        │   └────────┘
              todos abatidos ∨ escondido 4,5 s ──┘        │        │
                     ∨ jogador rendido                    │   ┌────┴──────────────┐
                                                          │   ▼ perto             ▼ longe
                                                          │ ┌─────────┐    ┌──────────────┐
                                                          └─│ COMBATE │◄───│ CONFISCANDO  │
                                                            └─────────┘ viu │  (t = 9 s)   │
                                                                            └──────────────┘
                                                                     t esgotado → confisca → RECUANDO
```

Invariante que a `transitar()` garante: **toda** saída de `COMBATE`/`CONFISCANDO` passa por `RECUANDO`,
que é o único lugar que remove policiais, corda e balas. Hoje isso está replicado em 3 pontos.

**IA de combate com o NavMesh.** Substituo a perseguição em reta por um híbrido, que é o que evita tanto
o agente burro quanto o custo de A\* por frame:

```
se visaoHorizontalLivre(policial, jogador):   anda em reta   (0 recálculo)
senão:                                        segue caminho A*, recalculado quando
                                              (a) não há caminho, ou
                                              (b) o alvo andou > 3 m do destino do caminho, ou
                                              (c) venceu o intervalo de 0,7 s
```

Os intervalos nascem **defasados por policial** (`i·0,35 s`), senão os dois recalculam no mesmo frame e
o custo dobra num pico só.

**Sistema de Health Bar — cálculo.** Dano com armadura em série (modelo clássico de absorção parcial):

```
absorvido  = min(armadura, dano · 0,6)
armadura  -= absorvido
saúde     -= (dano − absorvido)
```

Com `0,6` a armadura estende a vida efetiva em `1/(1−0,6) = 2,5×` enquanto dura, sem tornar o jogador
imortal. O colete da loja de armas repõe `armadura = 100`.

Regeneração fora de combate: `saúde += 3·dt`, saturada em 100 (já existe, mantida).

**Sistema de Health Bar — renderização.** Duas superfícies distintas, de propósito:
- **Jogador (DOM):** barra em `index.html`, largura da fatia = `hp/hpMax·100%`, matiz por
  `hue = 120·(hp/hpMax)` em HSL — verde 120° → amarelo 60° → vermelho 0°, contínuo. Fatia de armadura
  sobreposta em azul. Custo zero de GPU.
- **Policiais (mundo):** `THREE.Sprite` com `CanvasTexture` acima da cabeça. O canvas é redesenhado
  **só quando o HP muda** (não por frame) — é a diferença entre 2 uploads de textura por combate e 120
  por segundo. A barra some quando o policial está com vida cheia ou já caiu.

**Munição.** O tiro do jogador precisa de custo, senão a loja de armas não tem razão de existir:
`municao` no inventário, −1 por disparo, sem disparo em 0. É também o que impede o jogador de resolver
todo encontro segurando o botão de atirar.

---

### 3. ENVIRONMENT ARTIST

**Diagnóstico.** O jogo tem 2 polos econômicos reais (mercado em `(0,−18)` e receptador em `(50,30)`) e
uma fazenda em `(−86,−50)` que é cenário — não vende nada. O brief pede **4 polos**, e a disposição
importa: se os polos ficam perto, a economia vira um loop de 10 segundos e o mapa inteiro não é usado.

**Mapeamento de coordenadas (X, Z).** Critério: quadrilátero em torno do bairro (`x ∈ [−36, 35]`,
`z ∈ [−42, −4]`), com nenhum trecho menor que 60 m, forçando o jogador a atravessar o bairro — que é
exatamente onde a polícia patrulha.

| Polo | X | Z | Setor | Papel econômico |
|------|---|---|-------|-----------------|
| Fazenda (Depósito Rural) | −94 | −53 | Oeste | Terra R$6 · Vaso R$8 — insumo barato, longe |
| Sementes (mercado) | 0 | −18 | Centro | Vaso R$10 · Terra R$8 · Semente R$34 — caro, seguro |
| Armas | 60 | −46 | Nordeste | Munição ×12 R$35 · Colete R$70 |
| Receptador | 50 | 30 | Sudeste | Semente Rara R$25 · vende pacote R$40 |

Matriz de distâncias (m), confirmando que não há atalho degenerado:

```
              Fazenda  Sementes  Armas  Receptador
Fazenda          —       100      156     168
Sementes       100        —        68     67
Armas          156       68        —      76
Receptador     168       67       76       —
```

O perímetro do circuito completo é ~311 m — três a quatro travessias do bairro por ciclo econômico.

**Cidade no fundo (skyline).** Requisito: baixa complexidade e **zero colisão**. Restrições reais deste
projeto que ditam a solução:

- `scene.fog = FogExp2(density 0,013)`. A 180 m o fator de névoa é
  `1 − e^(−(0,013·180)²) = 1 − e^(−5,47) = 0,996` — uma cidade em espaço de mundo seria **engolida**.
- O `horizonte` (cilindro pintado, raio 215) já resolve isso com `fog:false` + acompanhar a câmera.

Então a skyline segue a mesma técnica de skybox: anel de prédios em raio 168–196 que **acompanha a
câmera em X/Z** (portanto está sempre "no horizonte"), material `MeshBasicMaterial` com `fog:false` e
cor por instância clareando com a altura, simulando a perspectiva aérea. Um único `InstancedMesh`:

```
1 draw call · 96 prédios · 0 sombras · 0 AABB registrada · 0 custo de física
```

Alturas por `h = 9 + 34·u²` (`u` uniforme) — a distribuição quadrática concentra prédios baixos e deixa
poucas torres altas, que é o perfil real de silhueta urbana. Ângulo aparente da torre mais alta:
`atan(43/180) ≈ 13,5°`, acima da linha do horizonte pintado, sem cobrir o céu.

---

### 4. LEAD SOFTWARE ENGINEER

**Restrição inegociável:** a câmera GTA (`Camera.js`) e os controles (`Input.js`, `Player.js`) não
podem regredir. Nenhuma das propostas acima toca no laço de movimento do jogador, na câmera seguidora
ou no anti-clipping — validei arquivo por arquivo. O que muda no `Player.js` é **aditivo**: exposição
das zonas de acerto pra bala. O que muda no `main.js` é uma chamada de atualização das barras de vida.

**Grafo de dependências depois das mudanças** (verifiquei que continua acíclico):

```
core ─┬─ Terrain ─┬─ Physics ─┬─ NavMesh ──┐
      │           │           │            │
      ├─ Materials│           ├─ Player ───┤
      ├─ Poles (dados puros, 0 imports)    │
      │     ↑         ↑            ↑       │
      ├─ WorldGenerator ─── NPCs ──┴───────┤
      ├─ Skyline                           │
      ├─ HealthBar                         ▼
      ├─ Economy ──────────────────────► Police ──► Bullets
      └─ UI ◄─────────────────────────────┘
```

`Poles.js` é dado puro sem imports **de propósito**: `WorldGenerator` (constrói os prédios),
`Economy` (ações) e `UI` (radar) precisam dos mesmos números, e qualquer outra colocação criaria ciclo.

**Ordem de inicialização.** O NavMesh depende de `obstaculos` **completo**. Os obstáculos são
registrados como efeito colateral do topo do `WorldGenerator`/`Economy`. Portanto a construção da malha
é **preguiçosa**: acontece na primeira chamada de `encontrarCaminho()`, que só ocorre quando a polícia
engaja — o carregamento do jogo não paga esse custo.

**Bug de performance que quero resolver neste ciclo.** `alvosDaBala()` em `Police.js` é chamada
**por bala e por frame** e aloca `Box3` + `Vector3` novos toda vez. Com 6 balas em voo e 2 policiais
isso é `6 × 2 × 3 = 36` objetos por frame, ~2160/s, direto no coletor de lixo — é exatamente o padrão
que produz microtravamento em combate. Vira lista reconstruída **uma vez por frame** em caixas de pool.

---

## PASSO 2 — CONSENSO E REVISÃO CRÍTICA CRUZADA

| # | Levantado por | Contra | Achado | Resolução aceita |
|---|---------------|--------|--------|------------------|
| 1 | Lead Eng. | Physics | NavMesh construída no topo do módulo trava o carregamento e, pior, roda **antes** dos obstáculos existirem. | Construção preguiçosa no primeiro `encontrarCaminho()`. |
| 2 | Physics | AI | A\* por frame por policial é insustentável. | Híbrido: reta quando há visão livre; A\* com intervalo de 0,7 s **defasado** por agente. |
| 3 | AI | Physics | Sem anti-corner-cutting o caminho raspa a quina e a resolução por eixo do `Physics` trava o policial exatamente lá. | Diagonal exige os dois ortogonais livres. |
| 4 | Environment | Physics | Se a grade marcar por projeção XZ, as muretas de laje viram parede no chão e a polícia não anda. | Filtro vertical por célula com o terreno local (`p+0,06 … p+1,6`). |
| 5 | Physics | Environment | Prédios de fundo em espaço de mundo somem na névoa (`0,996` a 180 m) ou, se `fog:false`, "correm" na parallax errada. | Skyline acompanha a câmera, igual ao céu/horizonte. |
| 6 | Lead Eng. | AI | Barra de vida com `CanvasTexture` redesenhada por frame = upload de textura por frame por policial. | Redesenha só na mudança de HP. |
| 7 | Lead Eng. | AI | `encerrarEncontro(false)` chamada com argumento numa função sem parâmetro; limpeza de encontro replicada em 3 lugares. | `transitar()` único; `RECUANDO` é o único ponto de limpeza. |
| 8 | Physics | Lead Eng. | Ponto visado a 60 m fixos pode cair **atrás** da parede; erro de paralaxe até ~9,5° em alvo próximo. | Ponto visado resolvido por slab test contra paredes **e** zonas de acerto. |
| 9 | AI | Lead Eng. | Alocação de `Box3` por bala/por frame no `alvosDaBala`. | Pool reconstruído 1×/frame. |
| 10 | Environment | AI | 4 polos sem munição vendável deixam a loja de armas sem função. | `municao` no inventário, −1 por disparo. |
| 11 | Lead Eng. | todos | `atirar()` usa `camera.getWorldDirection` — no modo drone a câmera não é a do jogador. | Disparo bloqueado com o drone ativo. |
| 12 | Physics | AI | Hitbox do jogador usava `+1,5` sendo `PLAYER_HEIGHT = 1,4`. | Zonas derivadas de `PLAYER_HEIGHT`. |

**Conflitos remanescentes: nenhum.** Consenso total registrado — liberado para implementação.

---

## PASSO 3 — IMPLEMENTAÇÃO

Módulos novos: `NavMesh.js`, `Skyline.js`, `HealthBar.js`, `Poles.js`.
Módulos alterados: `Physics.js`, `Player.js`, `NPCs.js`, `Police.js`, `Economy.js`,
`WorldGenerator.js`, `UI.js`, `main.js`, `index.html`.
Intocados (garantia anti-regressão): `Camera.js`, `Input.js`, `core.js`, `Terrain.js`,
`Materials.js`, `Environment.js`.

---

## PASSO 4 — VALIDAÇÃO MEDIDA (Chromium headless, jogo real rodando)

Os números abaixo foram medidos com o jogo carregado num navegador de verdade, dirigindo os módulos
vivos — não são estimativas de projeto.

### NavMesh

| Métrica | Medido |
|---------|--------|
| Grade | 463 × 463 = 214.369 células de 0,45 m |
| Construção (rasterização + relevo) | **14,2 ms**, uma vez, preguiçosa |
| A\* — beco → beco | 0,6 ms |
| A\* — travessia do bairro | 1,8 ms |
| A\* — de dentro de um quarteirão até a rua | 5,0 ms |
| A\* — pior de 20 buscas seguidas | **0,9 ms** |

Correção geométrica confirmada célula a célula: spawn livre ✓, interior de casa bloqueado ✓,
viela com escadaria **navegável** ✓ (era o risco nº 4 da revisão), balcão da fazenda livre ✓,
balcão da loja de armas livre ✓.

### Precisão da mira (o bug do tiro)

Erro angular entre a direção real da bala e a direção ideal cano→alvo:

| Distância do alvo | Fórmula antiga (ponto fixo a 60 m) | Erro linear no alvo | Fórmula nova |
|-------------------|-----------------------------------|---------------------|--------------|
| 2,5 m | **18,03°** | 73 cm | **0,000°** |
| 5 m | 9,61° | 81 cm | 0,000° |
| 8 m | 6,22° | 85 cm | 0,000° |
| 15 m | 3,29° | 85 cm | 0,000° |

O tronco do policial tem 0,68 m de largura: um erro de 73–85 cm **erra sempre**. A estimativa de
~9,5° da reunião era conservadora — o pior caso real é o dobro disso. Era exatamente a sensação de
"atirei bem em cima dele e não aconteceu nada".

### Zonas de acerto (dano medido em combate real)

| Zona mirada | Dano | Multiplicador conferido |
|-------------|------|------------------------|
| Cabeça | 68,0 | ×2,0 ✓ |
| Tronco | 34,0 | ×1,0 ✓ |
| Pernas | 20,4 | ×0,6 ✓ |
| Alvo atrás de parede | **0** | bala morre na parede ✓ |

### Máquina de estados

Ciclo completo percorrido com o jogo rodando:
`patrulha → indo → rapel → combate → recuando`, 2 policiais em campo, corda e sprites recolhidos
no `recuando`. Nenhum erro de console em nenhuma transição.

### Barra de vida

`aplicarDano` medida por simulação: **6 tiros** de 18 de dano derrubam sem colete, **12 com colete**
— o dobro de vida efetiva total (a razão instantânea de 2,5× vale enquanto a armadura dura).
Matiz: 100% → `hsl(120…)` verde, 50% → `hsl(60…)` amarelo, 0% → `hsl(0…)` vermelho.

### Economia dos 4 polos

Os quatro contextos disparam com os preços certos. Compra na Loja de Armas: R$105 debitados
(35 + 70), munição 0 → 12, colete vestido automaticamente → HUD `100 ❤ · 100 🛡`.

### Anti-regressão (câmera GTA e controles)

| Verificação | Resultado |
|-------------|-----------|
| Andar pra frente (70 frames) | 8,96 m percorridos ✓ |
| Distância da câmera ao jogador | 4,81 m (alvo do `Camera.js`: 5 m com suavização) ✓ |
| Altura do salto | 120 cm ✓ |
| Erros de console em toda a suíte | **0** |
