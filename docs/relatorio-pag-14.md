# PAG-14 — Relatório de testes de pagamentos

Data: 16/11/2026. Branch: `codex/pag-05-tentativas-pagamento`.

**Resultado:** cobertura local ampliada e aprovada. A tarefa permanece parcial
quanto à homologação com provedor e MongoDB reais. Nenhuma cobrança, assinatura,
cancelamento ou devolução real foi realizada para executar estes testes.

## Base documental

[Especificação revisada do Mini Stitches](https://docs.google.com/document/d/1q2ahCE_9drT_uEBRZR1qIDAnrjw1jFWuaUfM733luBE/edit):
RN01 (assinatura, calendário e cancelamento), RN02–RN04 (frete e Pix), UC03
(parcelamento), critérios 7.4 (pagamentos) e 7.5 (notificações e conciliação).

## Execução e resultados

Comandos executados na pasta `cliente`:

| Verificação | Resultado | Alcance |
| --- | --- | --- |
| `npm run test:pagamentos` | 126 aprovados; zero falhas, cancelamentos ou testes ignorados | Cálculos, handlers, HMAC e fluxos de pagamento/assinatura; banco e provedor simulados |
| `npm run test:pedidos` | 8 aprovados; zero falhas | HTTP real local com Express e JWT; repositório de pedidos simulado |
| `npm run build` | Aprovado | Compilação do frontend |
| ESLint dos arquivos de cálculo e testes financeiros alterados | Aprovado | Sem novos erros nos arquivos desta tarefa |
| `node --check` do cálculo e dos testes financeiros | Aprovado | Sintaxe |
| `git diff --check` | Aprovado | Consistência do diff |

Total executado: **134 testes aprovados**. A verificação HTTP foi executada com
permissão para conexão local, devido ao bloqueio EACCES do sandbox observado
nas etapas anteriores. O build e o ESLint continuam emitindo os avisos de
configuração ESM/CommonJS já existentes. O lint geral do projeto não faz parte
da declaração de aprovação desta tabela.

Foram adicionados **15 cenários** à suíte versionada. O comando financeiro agora
depende somente de `pagamentos.test.cjs` e `parcelamento.test.cjs`, já versionados.
Os sete testes do arquivo local ignorado `calculosPagamento.test.mjs` deixam de
ser uma dependência desse comando; sua cobertura de cálculo foi incorporada
aos novos cenários. Assim, 118 anteriores − 7 locais + 15 novos = 126 financeiros.
Não foram adicionados novos arquivos de teste ao versionamento nem alteradas
as regras do `.gitignore`. A suíte HTTP continua sendo um recurso local em
`pedidos.test.mjs`, ignorado conforme a configuração existente.

## Falhas encontradas e corrigidas

1. **Precisão do Pix:** a multiplicação por `0.95` usava ponto flutuante.
   Para subtotal de `9007199254731003` centavos, retornava
   `8556839291994452`, enquanto RN03 exige `8556839291994453` centavos.
   O cálculo intermediário agora usa inteiros `BigInt`, aplica uma única vez
   os 95% e arredonda meio centavo para cima antes de retornar centavos inteiros.
   Esse limite testa a aritmética; não representa um valor comercial aceito
   pelo gateway.
2. **Conversão implícita de cadastro/quantidade:** `Number(...)` permitia que
   `null`, booleanos e texto fossem interpretados como preço ou quantidade.
   O cálculo agora exige números inteiros seguros já tipados. A validação do
   Pix também não converte silenciosamente entradas de outros tipos.

Antes da correção, quatro cenários novos falharam: cadastro inválido, regressão
de arredondamento, amostragem de precisão e tipos inválidos do Pix. Após a
correção, todos passaram. Os exemplos documentados de R$ 49,90, R$ 300,00 com
frete e R$ 410,00 com frete grátis continuam aprovados.

## Cobertura adicional

| Área | Evidência local |
| --- | --- |
| Cadastro e cálculo no servidor | Snapshot de preço, produto inativo, carrinho vazio, tipos inválidos e alteração de preço entre tentativas |
| Limites monetários | Overflow em multiplicação, soma de itens e soma com frete; limite do inteiro seguro |
| Pix | Caso de regressão explícito e 5.000 amostras determinísticas, com semente fixa, conferindo valor líquido, desconto, frete e conservação dos centavos |
| Frete | Subtotais de 39989, 39990 e 39991 centavos, verificados antes do Pix |
| Parcelas | Todos os restos possíveis de 1x a 6x, mínimo de 4000 centavos e soma exata das parcelas |
| Repetição e preço vigente | Replay mantém a cobrança original; nova chave utiliza o novo preço; item inativo bloqueia nova cobrança |
| Concorrência de estoque | 20 tentativas disputando 3 unidades disponíveis, sem consumir as 2 unidades de segurança; transações simuladas |
| Timeout de cobrança | Aprovação recuperada por webhook sem criar uma segunda cobrança |
| Recuperação de operações | Retomada somente após expiração do bloqueio; intervalo de repetição respeitado; perda de posse impede POST de reembolso |
| Concorrência de reembolso | 20 processadores simultâneos produzem uma única devolução no provedor simulado |
| Falha após efeito remoto | Gravação falha depois do reembolso; retomada consulta o efeito e não repete o POST |

A suíte existente também passou para HMAC ausente/adulterado, eventos repetidos
e antigos, reembolso/contestação, renovação sem reaplicar corte de adesão,
cancelamento antes/depois da aprovação efetiva, isolamento entre contas,
tokenização do perfil e ausência de dados sensíveis nos registros simulados.

## Pendências de homologação

| Evidência exigida | Situação |
| --- | --- |
| Concorrência, índices únicos, conflitos de escrita e rollback em MongoDB com replica set | Não executada com banco real; não foram encontrados `mongod`, `mongosh` ou `docker` no PATH desta sessão |
| Pagamentos e notificações reais de sandbox do Mercado Pago | Não executados; o gateway foi simulado |
| Tokenização e adulteração pelo navegador, com inspeção de tráfego | Pendente; os handlers/SDK foram exercitados com dados e transportes simulados |
| Agenda efetiva de renovação baseada na primeira confirmação, especialmente dias 29–31 | Pendente da PAG-11; cálculo contratual e sinalização de divergência não comprovam a agenda remota |
| Cancelamento, saldo para reembolso, resposta perdida e reenvio em sandbox real | Pendente; os cenários locais passaram |
| Agendador externo, recuperação sem webhook e prazo operacional do reembolso | Exige configuração do agendador e comprovação em homologação |
| Busca autorizada em banco, logs e backups existentes | Não executada; os testes não inspecionam dados de produção |

Para fechar a PAG-14, registrar os resultados desses cenários em ambiente
isolado de homologação, com contas/cartões de teste e banco próprio. Os registros
de evidência devem conter identificadores operacionais e resultados, sem PAN,
CVV, tokens, cookies ou credenciais. Os resultados locais desta execução não
comprovam essas pendências nem conformidade PCI DSS.

## Mensagem de commit sugerida

```text
fix: corrigir precisao do Pix e ampliar testes de pagamentos
```
