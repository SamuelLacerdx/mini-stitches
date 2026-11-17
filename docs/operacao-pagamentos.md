# Operação de pagamentos — PAG-18

Base: [especificação revisada Mini Stitches](https://docs.google.com/document/d/1q2ahCE_9drT_uEBRZR1qIDAnrjw1jFWuaUfM733luBE/edit),
RN01–RN04, RF10, UC03/UC04/UC08 e critérios 7.3–7.6. Este guia descreve o
código disponível; testes locais não comprovam operação em produção, conformidade
PCI DSS, criptografia de infraestrutura ou restauração de backup.

## Preparação do ambiente

Antes da liberação, o responsável pela implantação deve verificar:

1. Frontend e backend da mesma versão, HTTPS e credenciais do ambiente correto.
   Conferir a existência das variáveis descritas no README sem imprimir valores.
2. MongoDB com suporte a transações (replica set/serviço compatível). Confirmar
   índices únicos de pedido/pagamento, tentativa/cliente/chave, cotação, mensalidade,
   competência e caixa conforme `cliente/backend/db/mongodb.js`. Resolver dados
   incompatíveis com revisão e backup; não remover índices para contornar conflitos.
3. Webhook apontando para `/api/webhook`, segredo configurado, tópicos de pagamento
   e recorrência habilitados. A URL configurada, isoladamente, não comprova entrega
   nem autenticidade das notificações.
4. Agendador externo chamando `GET /api/clube/operacoes/processar` periodicamente
   (referência operacional: a cada minuto), com `Authorization: Bearer <CRON_SECRET>`.
   A aplicação não provisiona o agendador. Manter o segredo fora de URLs, frontend,
   histórico de terminal, tickets e logs de cabeçalhos.
5. Coleta de stdout/stderr, acesso restrito e alertas configurados pelo operador.
   O projeto não instala coletor, painel de monitoramento nem política de retenção.
6. Evidência de homologação do calendário de cobrança, inclusive dias 29–31.
   O cálculo local detecta divergências; não corrige sozinho a agenda do provedor.

## Rotina de conciliação

No início do expediente e após alertas, acessar **Admin → CONCILIAÇÃO** com
perfil administrativo atual. Usar identificadores exatos e percorrer todas as
páginas relevantes; cada página tem 25 registros. Consultar:

| Origem | Conferência |
| --- | --- |
| Tentativas | Resultado confirmado, pagamento vinculado, reserva e pedido registrado |
| Pedidos | Cobrança, total original, reembolso confirmado e situação logística independente |
| Assinaturas | Autorização, adesão e confirmação de cancelamento; abrir suas mensalidades |
| Mensalidades | Pagamento, competência, caixa, aprovação, previsão, bloqueios e operações de reembolso |

Uma tentativa e seu pedido são duas visões da mesma operação; não somar suas
linhas como receitas distintas. Autorização de assinatura não é mensalidade paga.
“Total menos reembolso” não comprova saldo disponível, especialmente em contestação.
Comparar com o painel/API oficial do provedor no ambiente correspondente, conferindo
identificador, moeda BRL, valor, vínculo e versão/datas. Não usar dados do navegador
como evidência de pagamento. O painel mostra registros locais; atualizá-lo não
força uma consulta financeira ao provedor.

Separar a data efetiva da aprovação da chegada da notificação. Repetições e
eventos antigos podem ser recebidos normalmente; não criar novo pedido, caixa
ou reembolso por isso. Alertas de vínculo/valor divergente exigem investigação:
não editar `statusFinanceiro`, aprovação, referência, estoque ou valor diretamente
no banco para fazer desaparecer a pendência.

## Recuperação de compras avulsas

| Situação | Procedimento |
| --- | --- |
| Recarregamento ou perda da resposta | O cliente autenticado retoma `/checkout?tentativa=CHAVE` ou `/checkout?pedido=NUMERO`; conferir a cobrança existente, sem novo POST de pagamento |
| Pix/boleto pendente | Recuperar as instruções originais na conta; não gerar outro código para resolver uma falha de exibição |
| Cobrança conhecida, pedido ausente | A recuperação conclui o registro com o snapshot salvo via `POST /api/pagamentos/tentativas/:chave/pedido`; a API verifica o pagamento e não cria cobrança |
| Resultado desconhecido ou 404 após timeout | Manter a referência e consultar novamente. 404 pode anteceder a persistência; não concluir que não houve cobrança |
| Tentativa `nao_cobrada` | O registro informa que a tentativa foi encerrada antes da solicitação externa; seguir a interface para uma nova compra e cotação |
| Legado sem contato/entrega suficientes | Consultar os vínculos e encaminhar ao atendimento técnico; não fabricar pedido nem repetir cobrança automaticamente |
| Reembolso/contestação após entrega | Preservar entrega e total original; conferir situação financeira e valor devolvido, sem repor estoque automaticamente |

As consultas de recuperação exigem a conta proprietária. O administrador usa a
conciliação para investigar; não acessa a recuperação autenticando-se como cliente.

Para resultado externo desconhecido, localizar a cobrança no provedor pela
referência externa da tentativa. Confirmar ID, BRL, valor e vínculo exatos. Se a
cobrança existir, usar a função oficial do provedor para reenviar uma notificação
autêntica, quando disponível; o webhook consulta o recurso e aplica suas versões.
Não construir assinaturas manuais nem desativar sua validação. A aplicação não
oferece um endpoint administrativo genérico para buscar e reparar pagamentos
avulsos sem webhook. Se não houver reenvio ou o vínculo continuar ambíguo, manter
a ocorrência aberta para suporte técnico/provedor, preservando a reserva e os IDs.
Não liberar reserva nem criar outra cobrança apenas porque uma busca não retornou.

## Cancelamentos e reembolsos do Clube

1. Conferir `canceladoEm` e `cancelamentoEstado`. Solicitação local e confirmação
   remota são etapas distintas. Estado pendente não comprova interrupção no provedor.
2. Conferir mensalidades e suas aprovações efetivas. Caixa aprovada antes do
   cancelamento continua devida, mesmo com webhook posterior e postagem futura.
   Não aplicar cancelamento logístico ou reembolso automático a essas caixas.
3. Aprovação posterior exige caixa bloqueada e reembolso integral. Conferir a
   operação de reembolso, o limite de solicitação e sua situação. O requisito é
   solicitar em até 2 dias úteis da identificação; o código usa limite conservador
   de 48 horas corridas. Crédito disponibilizado depende do meio de pagamento.
4. Se a operação estiver pendente, um administrador pode chamar
   `POST /admin/clube/operacoes/processar` com sua sessão autenticada. A rotina
   reconsulta contratos cancelados e retoma operações existentes; não cria novas
   recorrências. O endpoint do agendador executa a mesma retomada com seu segredo.
5. Consultar novamente as mensalidades e `GET /admin/clube/operacoes`. Este último
   lista até 100 operações abertas; não é um histórico completo paginado. A
   rotina processa até 50 operações elegíveis por chamada. Acompanhar a fila
   também no banco por acesso autorizado se exceder esses limites.
6. Uma execução interrompida possui lease de 2 minutos; falhas são reagendadas
   para após 1 minuto. Aguardar o intervalo antes de avaliar a retomada. Não apagar
   locks, operações, chaves de idempotência ou identificadores de reembolso.
7. `aguardando_provedor`/`solicitado` não significa valor integral devolvido.
   A rotina consulta a devolução existente; a conclusão exige confirmação remota.
   Em falha permanente, prazo ultrapassado ou saldo indisponível, encaminhar ao
   responsável financeiro/provedor imediatamente e manter a caixa bloqueada.

Somente indicar uma caixa para nova postagem quando estiver paga, sem bloqueios
ou inconsistências e ainda não enviada/entregue. Reembolso parcial e contestação
também impedem nova expedição. O mês da caixa não muda por atraso de aprovação;
conferir competência e lote separadamente. Ações fora da aplicação, caso necessárias,
exigem procedimento do responsável financeiro e conciliação posterior para evitar
devolução em duplicidade; não são uma alternativa automática à fila existente.

## Logs estruturados e investigação

O servidor e os módulos de pagamento, pedidos e frete que já emitiam logs usam
`cliente/backend/functions/logOperacional.js`. Cada chamada emite uma linha JSON
com `versao`, `em` (UTC), `nivel` e `evento`, sem mensagem livre ou stack trace.
O horário do log é o instante de emissão, não a aprovação do pagamento; consultar
os campos financeiros persistidos para decisões de calendário/cancelamento.

| Eventos | Ação operacional |
| --- | --- |
| `webhook.invalido` | Verificar configuração/entrega e autenticidade; sem imprimir assinatura ou corpo |
| `webhook.pendente` | Verificar banco/provedor e observar a nova entrega; não responder aprovação manualmente |
| `webhook.conciliado` | Ver resultado `processada`, `duplicada`, `antiga`, `sem_vinculo` ou `recorrente`; resultado não representa aprovação financeira |
| `pagamento.resultado_desconhecido` | Investigar a tentativa preservando reserva e idempotência |
| `pagamento.persistencia_pendente`, `pagamento.reserva_pendente` | Conferir registro e reserva antes de outra ação |
| `pedido.valor_divergente`, `pedido.pagamento_ausente`, `pedido.registro_falhou` | Conferir snapshot, cobrança e vínculo; recuperar o pedido existente |
| `clube.contratacao_pendente`, `clube.autorizacao_pendente` | Conferir autorização e referência externa, sem contratar novamente |
| `clube.operacao_pendente` | Conferir fila, prazo e provedor; retomar a mesma operação |
| `banco.indisponivel`, `frete.*`, `api.falha` | Investigar disponibilidade/configuração pelo responsável técnico |

O catálogo completo de códigos está no módulo. `registro.descartado` indica uso
de evento não catalogado e exige ajuste técnico, sem registrar o texto recebido.
O logger aceita apenas resultado enumerado, status HTTP inteiro, indicador booleano
de configuração e referências dos identificadores operacionais permitidos.
Objetos, getters, erros, corpos, cabeçalhos, credenciais, e-mail, CPF, endereço,
token, PAN e CVV não são serializados. Identificadores recebidos em webhook inválido
não são utilizados para correlação.

Os IDs permitidos são convertidos em SHA-256 de `tipo:identificador`; os campos
resultantes são `tentativaRef`, `pagamentoRef`, `assinaturaRef`, `operacaoRef`,
`preapprovalRef` e `mensalidadeRef`. Essas referências são pseudônimos, não dados
anônimos nem prova criptográfica de pagamento. Permanecem de acesso restrito.
Para correlacionar um registro conhecido, a ferramenta técnica pode chamar
`referenciaOperacional('pagamentoId', identificador)` do módulo e pesquisar
`pagamentoRef` no coletor. Não informar IDs pessoais, tokens ou payloads nesse
campo. O logger não é um mecanismo para armazenar ou validar tais dados.

Configure alertas para erros persistentes, tentativas desconhecidas, ausência de
entregas do webhook/agendador, tamanho/idade da fila e prazos de reembolso.
O logger é best effort: falha de coleta não altera pagamentos. Portanto, ausência
de log não comprova sucesso nem ausência de cobrança; banco/provedor são essenciais.
Não há evento obrigatório para cada transição nem trilha de auditoria imutável.
Os históricos financeiros/logísticos e operações persistidas completam a investigação.

Logs antigos e logs automáticos do proxy, hospedagem, banco e provedor precisam
de inspeção própria; esta alteração não os remove nem configura. Restringir acesso
por função, registrar acessos e definir retenção/descarte com os responsáveis
operacional e de privacidade. Não anexar dumps de banco, cookies, `.env`, cabeçalhos
de autorização, dados de cartão ou respostas completas do provedor em ocorrências.

## Registro e encerramento de uma ocorrência

Registrar em local de acesso restrito o ambiente, versão implantada, início e fim,
referências operacionais, situação financeira/logística, datas efetivas e de recepção,
responsável, ações executadas e evidências mínimas. Encerrar somente após confirmar
vínculos únicos, valores e reembolso/cancelamento quando aplicável; manter os
históricos e a obrigação de entregar caixas pagas anteriores ao cancelamento.

Em indisponibilidade/restauração do banco, preservar os registros e backups,
envolver o responsável pela infraestrutura e testar a restauração isoladamente.
Antes de retomar processadores após restaurar backup antigo, reconciliar com o
provedor as cobranças e devoluções posteriores ao backup: dados locais antigos
não autorizam novo débito ou reembolso. O projeto não contém um procedimento
automatizado de restauração ou reparo financeiro; sua evidência ainda é necessária.

## Validação desta etapa

Executar em `cliente`: `npm run test:pagamentos` e `npm run test:pedidos`.
Os novos cenários cobrem formato JSON, descarte de campos proibidos e mensagem
livre, correlação estável, objetos cíclicos/getters, tipos inválidos, timeout,
falha do destino de logs e webhook válido/duplicado/inválido. Banco e gateway
são simulados nos testes de pagamentos; testes HTTP usam um servidor local.

Em homologação, demonstrar coleta e acesso aos logs, alerta de erro, retomada
após interrupção, notificação reenviada pelo provedor, cancelamento pendente e
reembolso concluído, além de restauração controlada. Guardar evidência sem
segredos. Nenhuma dessas verificações externas é comprovada apenas pelos testes
unitários ou pelo build. Não usar cartões ou cobranças reais para testar o guia.
