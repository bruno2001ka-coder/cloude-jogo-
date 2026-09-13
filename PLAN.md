# Plano — suspensão realista do carro

## Objetivo
Corrigir a suspensão independente do carro para que ele permaneça visualmente rebaixado, acompanhe o terreno com as quatro rodas apoiadas e reaja a lombadas, frenagem e curvas sem teletransportar pneus, enterrar a carroceria ou deixar rodas suspensas sem causa física.

## Riscos isolados

1. **Contato roda–solo:** a folga de cada quina precisa controlar a extensão/compressão da mola, sem corrigir a posição de forma instantânea.
2. **Carroceria rebaixada:** o chassi deve continuar baixo; somente o conjunto da roda se move dentro do curso.
3. **Dinâmica:** transferência longitudinal/lateral deve somar ao alvo local sem apagar o contato do terreno.
4. **Raspagem:** apenas compressão positiva próxima do fim de curso pode produzir raspagem e faíscas.

## Critérios de verificação

- O teste dedicado de suspensão passa sem regressões.
- A sintaxe e os assets do jogo passam em `npm run check`.
- A extensão pode ser negativa e não conta como raspagem.
- Não existe mais ajuste instantâneo `position.y += erroContato` após a integração da mola.
- O projeto mantém controles de entrada, carregamento do GLB e comportamento de carro parado/conduzido.
