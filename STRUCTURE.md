# Estrutura — veículo e suspensão

A física compartilhada fica em `src/Veiculo.js`. `src/Carro.js` fornece a ficha do carro rebaixado, incluindo curso, mola, amortecedor, altura por eixo, transferência de peso e raspagem limitada. `src/Rodas.js` separa as rodas do GLB e cria a hierarquia `suspensao -> pivo -> malha`, permitindo extensão/compressão, esterço dianteiro e rotação do pneu sem mover a carroceria.

O assentamento mede as quatro quinas na mesma malha visível do terreno. Ele define a pose base do chassi e os alvos individuais de suspensão. A integração de `atualizarSuspensao` resolve o deslocamento das rodas com mola e amortecedor; a carroceria só recebe a pequena raspagem de fim de curso.

Os testes dedicados estão em `scripts/test-suspensao-carro.mjs`. A checagem geral é executada por `npm run check`.
