# Auditoria geométrica da casa da fazenda

## Resultado

A casa foi auditada por coordenadas e volumes em planta, considerando fundação, paredes, telhado, varanda, telheiro, degraus, esquadrias, cocho, barril, currais, cultivo e limite da fazenda. O resultado final é **OK: nenhuma sobreposição acidental permanece** entre a casa e os elementos externos de gameplay.

## Dimensões calculadas

| Elemento | Medida |
|---|---:|
| Centro da casa | `x = -94, z = -56` |
| Corpo das paredes | `6,00 m × 5,00 m × 3,20 m` |
| Fundação | `6,30 m × 5,30 m × 0,30 m` |
| Vão da porta | `2,35 m` |
| Projeção horizontal do telhado | `7,48 m × 5,90 m` |
| Varanda | `6,80 m × 1,35 m` |
| Telheiro da varanda | `7,15 m × 1,70 m` |
| Degrau externo maior | `2,80 m × 0,46 m` |
| Degrau externo menor | `2,25 m × 0,34 m` |

## Erro encontrado e corrigido

O **cocho** estava configurado com `2,10 m` de largura e centro em `x = -89,50`. Como a borda oeste do curral das vacas fica em `x = -89,00`, havia uma invasão de aproximadamente **0,55 m** no curral.

A configuração foi corrigida para:

- Cocho: centro em `x = -90,00`, largura de `1,00 m`;
- Barril: centro em `x = -90,20`, raio de `0,25 m`.

Depois da correção, ambos ficam na faixa de serviço entre a casa e o curral sem invadir o espaço dos animais.

## Sobreposições intencionais

As seguintes interseções são construtivamente corretas e não são bugs:

- fundação sob as paredes;
- paredes sob o telhado;
- telhado sobre a varanda;
- degraus encaixados na varanda;
- janelas parcialmente embutidas nas paredes;
- casa, varanda e telhado contidos dentro do perímetro da cerca;
- telhado projetado acima do cocho e do barril em planta. Essa última é apenas uma sobreposição horizontal: os elementos ficam no chão e o telhado está acima deles, portanto não existe colisão física real.

## Folgas externas finais

| Elemento | Distância mínima em planta até o corpo da casa |
|---|---:|
| Curral das vacas | `2,00 m` |
| Curral dos porcos | `5,29 m` |
| Curral das galinhas | `11,00 m` |
| Campo de cultivo | `4,50 m` |
| Cerca externa | `0 m`, por contenção intencional |

## Validação

- Auditoria de sobreposições: **OK**;
- Testes de colisores: **aprovados**;
- Teste de geometria do celeiro/casa: **aprovado**;
- Teste profissional da fazenda: **30/30 verificações aprovadas**;
- Sintaxe JavaScript: **59 arquivos aprovados**;
- Assets de entrada: **aprovados**.

Arquivos envolvidos: `src/FarmConfig.js`, `scripts/audit-casa-sobreposicoes.mjs` e `src/WorldGenerator.js`.

## Auditoria do layout completo

A revisão seguinte incluiu também os objetos que não fazem parte da estrutura da casa. O ponto de serviço foi movido para `(-91, -57,2)`, a caixa-d’água para `(-76,5, -59,5)` e o moinho para `(-78,8, -59,2)`. Essas posições deixam os elementos atrás/lateralmente dos currais, dentro da propriedade, mas sem atravessar cercas ou áreas de animais.

A auditoria completa agora verifica casa, varanda, degraus, janelas, cocho, barril, ponto de serviço, três currais, cultivo, caixa-d’água, moinho e limite externo. O resultado foi **zero sobreposições acidentais entre objetos**. As únicas interseções registradas são de projeção vertical ou encaixe arquitetônico intencional, como telhado sobre elementos baixos e casa contida dentro da cerca.

A imagem conceitual gerada anteriormente deve ser entendida como uma simulação artística; a posição exata dos objetos é determinada pelas coordenadas do jogo e está refletida nesta auditoria.

## Auditoria de vizinhança da casa

Foi feita uma segunda análise com foco nos objetos que ficam à beira da casa. O ponto de serviço estava a `0 m` da casa porque sua coordenada caía dentro da projeção da fundação; isso foi corrigido para `x = -90,1, z = -57,2`, ficando a aproximadamente `0,35 m` da casa, na faixa lateral de serviço.

Os itens próximos restantes fazem sentido no contexto rural:

- cocho a aproximadamente `0,35 m`, encostado lateralmente à área de serviço;
- ponto de interação no mesmo pátio lateral, a aproximadamente `0,35 m`;
- barril a aproximadamente `0,40 m`, junto ao cocho;
- curral das vacas a `1,85 m`, distância curta, mas plausível para manejo diário;
- árvore oeste a `3,10 m`, funcionando como paisagismo e sombra;
- plantação a `4,35 m`, preservando circulação e separação da casa.

A área `limpeza` continua existindo apenas como reserva lógica para impedir o nascimento de canteiros sob o serviço; ela não cria um objeto físico e, portanto, não deve ser interpretada como sobreposição visual.

Conclusão: não há mais objeto visível sem sentido dentro da casa. O único agrupamento intencionalmente compacto é o pátio lateral de serviço, que agora está fora da fundação e separado dos animais.

## Auditoria da entrada

A análise do eixo frontal da porta encontrou um problema visual: o banco da varanda estava centralizado em `x = -94`, exatamente sobre o eixo da porta e dos degraus. Isso não fazia sentido para uma varanda rural e podia bloquear a leitura da entrada. O banco foi deslocado para `x = -95,95`, no canto esquerdo da varanda.

A faixa imediata da porta agora está livre de banco, vasos, cocho, barril e ponto de serviço. O teste dedicado `audit-entrada-casa.mjs` retornou **OK: zero bloqueios**.
