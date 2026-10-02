# Atualização automática da Lotofácil — validação de 02/10/2026

## Diagnóstico real

O endereço fixado no aplicativo era `servicebus2.caixa.gov.br`. A configuração
publicada pelo portal oficial em
`https://loterias.caixa.gov.br/Style%20Library/json/params.txt` aponta para
`https://servicebus3.caixa.gov.br/portaldeloterias`. O JavaScript do próprio portal
(`loterias.js` e `resultadoLotofacilController.js`) usa esse parâmetro para montar
as consultas `/api/lotofacil/{numero}`.

Nos testes locais, servicebus2 resolveu DNS, conectou TCP e concluiu TLS em cerca
de 82 ms, mas não retornou HTTP dentro de 12 segundos. O comportamento ocorreu
tanto no fetch Node quanto no net.fetch Chromium, no Electron 30.5.1. Não houve
erro de certificado, nem evidência de defeito do AbortSignal. Não é possível
determinar externamente por que o servidor antigo deixou de responder.

Servicebus3 retornou o concurso 3794 em 412 ms pelo Node e 265 ms pelo Node do
Electron. A resposta oficial foi validada contra as dezenas:
01, 03, 04, 05, 06, 08, 10, 12, 13, 15, 18, 19, 21, 23, 24.

O concurso futuro 3795 retornou HTTP 500 contendo `exceptionMessage`, um JSON
serializado com `StatusCode: 404`. Esse caso específico agora encerra a busca;
outros erros 500 continuam sendo falhas.

## Correção

- Usa o servidor oficial atual, mantendo timeout de 3 segundos por requisição.
- Em falha, consulta uma vez a configuração oficial; aceita apenas HTTPS no
  padrão `servicebusN.caixa.gov.br/portaldeloterias`, sem credenciais ou parâmetros.
  Só repete a consulta imediatamente se descobrir outro servidor.
- Carrega o histórico local antes da rede e busca concursos seguintes em sequência.
- Normaliza por concurso e grava cada avanço por arquivo temporário + rename.
- A inicialização agenda até duas novas tentativas, após 30 segundos e depois
  120 segundos, somente em falha. Os temporizadores são cancelados na desmontagem.
- Atualizações concorrentes compartilham a mesma Promise no processo principal.
- Falhas preservam o histórico e a interface permanece utilizável.

## Testes reais reproduzíveis

Após `npm run build`, executar `node tests/run-history-live.cjs`. O teste usa
main, preload e renderer de produção, HTTPS real e dois processos Electron.
Ele copia o histórico existente até 3793 para um perfil temporário; não altera
o histórico do usuário. É possível informar `LOTTO_TEST_SOURCE` com outro arquivo
real de histórico. O concurso 3794 nunca é inserido como resposta simulada.

Resultados observados:

- Primeira abertura: 3793 visível em 728 ms; requisição do 3794 em 255 ms;
  3794 selecionado, com as 15 dezenas corretas, em 1.076 ms desde o início.
- Segunda abertura: 3794 visível em 668 ms, diretamente do arquivo local, antes
  de qualquer resposta de rede. Persistência e ausência de duplicatas verificadas.
- Num perfil iniciado na base embutida 3767, a CAIXA respondeu 429 após vários
  downloads. A tentativa automática, 30 segundos depois, retomou de 3787 e chegou
  ao 3794. A primeira execução desse teste falhou na asserção de concurso inicial
  porque esperava 3793; isso foi corrigido preparando uma cópia real até 3793.

Para validar o conteúdo empacotado, definir `LOTTO_TEST_MAIN` para o caminho
absoluto de `release/0.1.0/win-unpacked/resources/app.asar/dist-electron/main.js`
antes de executar o mesmo teste. As janelas do teste ficam ocultas.

Essa validação também passou com o `app.asar` final: 3793 foi a primeira seleção,
o download do 3794 levou 335 ms, as 15 dezenas foram selecionadas automaticamente
e a segunda execução mostrou 3794 do disco antes de qualquer resposta da rede.
O teste executa o conteúdo empacotado no runtime Electron do projeto; não executa
o assistente de instalação NSIS nem modifica a instalação pessoal do usuário.

Os scripts `caixa-network-probe.cjs` e `caixa-probe.electron.cjs` registram tempos
e erros de rede para diagnóstico. O segundo aceita o hostname oficial como
argumento ao ser executado pelo Electron.

## Regressão

`npm test`: 86 testes aprovados, incluindo migração de endpoint, rejeição de
origem não oficial, 404 encapsulado, recuperação automática, limite de tentativas,
cancelamento, preservação de dados e concorrência.

`npm run build`: TypeScript, Vite (renderer/main/preload) e instalador NSIS.
Gerador, filtros e avaliação não foram modificados.
