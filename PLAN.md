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

## Atualização de dinâmica do carro

O carro agora tem teto de **120 km/h**, aceleração progressiva por velocidade-alvo, ré limitada, freio de mão em `H`, quatro sondas de contato, inclinação e rolagem preservadas pela suspensão independente, reação a irregularidades e impacto contra paredes. A batida reduz a velocidade conforme a severidade, soma dano acumulado sem destruir o veículo e dispara som de colisão com intensidade proporcional. O dano reduz gradualmente a velocidade máxima e a eficiência de aceleração, mantendo o carro conservado e dirigível.

A camada de pneus separa **aderência longitudinal**, **aderência lateral**, **resistência ao rolamento** e **patinagem visual**. Curvas rápidas ultrapassam o limite lateral, o freio de mão solta o eixo traseiro e acelerar além da capacidade do pneu faz a roda girar acima da velocidade real do veículo.
