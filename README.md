# Mini Stitches

Loja virtual de kits de bordado e crochê para crianças. A Mini Stitches apresenta os produtos, permite navegar pelo catálogo e inclui páginas de conta, carrinho, clube de assinatura e conteúdo de apoio.

## Capturas de tela

As capturas mostram a interface da página inicial e do catálogo. O produto exibido foi incluído com dados de demonstração somente para gerar as imagens; ele não representa um registro já cadastrado no banco de dados.

| Página inicial | Catálogo de kits |
| --- | --- |
| ![Página inicial da Mini Stitches](docs/screenshots/home.png) | ![Catálogo de kits da Mini Stitches](docs/screenshots/kits.png) |

## O que o projeto oferece

- Página inicial com apresentação da marca, destaques e conteúdo informativo.
- Catálogo de kits com filtros por idade e dificuldade e listagem de materiais.
- Detalhes de produto e carrinho que pode ser usado como visitante ou com uma conta.
- Cadastro, login, perfil e gerenciamento de endereços, incluindo consulta de CEP pelo ViaCEP.
- Cálculo de frete no checkout a partir dos itens do carrinho e do CEP de destino, com cotação pela API do Melhor Envio.
- Pagamentos pelo Mercado Pago no checkout: Pix (com desconto), boleto e cartão de crédito, além de assinatura recorrente para o Clube da Caixinha. Um webhook recebe as atualizações de status dos pagamentos.
- Área administrativa para gerenciar produtos e conteúdos de kits.
- Páginas informativas para o Clube da Caixinha, tutoriais, trocas, história e contato.

## Tecnologias

- **Interface:** React 19, React Router 7, Vite 8, Tailwind CSS 4 e Lucide React.
- **Servidor:** Node.js, Express 5, Mongoose 9 e SDK do Mercado Pago.
- **Banco de dados:** MongoDB.
- **Autenticação:** sessões Express, JWT e bcryptjs.
- **Qualidade de código:** ESLint 9.
- **Serviços externos:** ViaCEP para consulta de CEP, Melhor Envio para cálculo de frete e Mercado Pago para pagamentos.

## Como rodar localmente

### 1. Pré-requisitos

- Node.js 20.19 ou superior e npm.
- MongoDB local ou uma instância MongoDB acessível pela aplicação.

### 2. Instale as dependências

Na raiz do repositório, entre na pasta da aplicação e instale os pacotes:

```powershell
cd .\cliente
npm install
```

### 3. Configure as variáveis de ambiente

Crie o arquivo `cliente/.env` e informe a conexão com seu MongoDB e segredos locais:

```env
MONGO_URI=mongodb://127.0.0.1:27017/mini_stitches
SESSION_SECRET=substitua-por-um-segredo-local
JWT_SECRET=substitua-por-outro-segredo-local
```

Se usar MongoDB Atlas ou outra instância, substitua `MONGO_URI` pela URI correspondente. Não compartilhe nem versione esse arquivo.

Para habilitar o cálculo de frete e os pagamentos, informe também as credenciais dos serviços externos. Sem elas, essas rotas respondem com erro de configuração, mas o restante da loja continua funcionando. O arquivo `cliente/.env.example` lista todas as variáveis.

```env
# Melhor Envio (cálculo de frete)
MELHOR_ENVIO_TOKEN=
MELHOR_ENVIO_SANDBOX=true
MELHOR_ENVIO_CONTATO=seu-email@exemplo.com
CEP_ORIGEM=01000000
FRETE_SERVICOS=1,2,17
FRETE_PESO_KG=0.5
FRETE_ALTURA_CM=8
FRETE_LARGURA_CM=20
FRETE_COMPRIMENTO_CM=25

# Mercado Pago (pagamentos)
MP_PUBLIC_KEY=
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
```

As dimensões e o peso do pacote (`FRETE_PESO_KG`, `FRETE_ALTURA_CM`, `FRETE_LARGURA_CM` e `FRETE_COMPRIMENTO_CM`) são obrigatórias para cotar o frete; o token, o contato e o `CEP_ORIGEM` também. `MELHOR_ENVIO_SANDBOX=true` usa o ambiente de testes do Melhor Envio.

Opcionalmente, para apontar o proxy do Vite para um servidor em outro endereço, adicione `VITE_API_URL` ao mesmo `.env`. Sem essa configuração, o endereço padrão da API é `http://localhost:4000`.

### 4. Inicie o servidor da API

Em um terminal, ainda dentro de `cliente`, execute:

```powershell
node .\server.js
```

O servidor conecta ao MongoDB e, quando a conexão é estabelecida, fica disponível na porta `4000`.

### 5. Inicie a interface

Abra um segundo terminal, entre novamente na pasta `cliente` e execute:

```powershell
cd .\cliente
npm run dev
```

Abra o endereço indicado pelo Vite, normalmente [http://localhost:5173](http://localhost:5173). Durante o desenvolvimento, as chamadas da interface à API são encaminhadas para o servidor na porta `4000`.

### 6. Comandos úteis

Execute estes comandos a partir da pasta `cliente`:

```powershell
npm run lint
npm run build
npm run preview
```

`npm run preview` serve localmente a versão gerada por `npm run build`.

## Dados e estado atual

O repositório não inclui script de seed nem produtos de demonstração; um banco novo começa sem itens no catálogo. O cadastro cria contas de cliente. Para acessar o painel administrativo, uma conta precisa ter o perfil `admin` configurado no MongoDB.

O checkout já conta com cálculo de frete pelo Melhor Envio e com as rotas de pagamento do Mercado Pago (Pix, boleto, cartão e assinatura), além de um webhook para atualização de status. Essas integrações dependem das credenciais informadas no `.env`; mantenha `MELHOR_ENVIO_SANDBOX=true` e as credenciais de teste do Mercado Pago enquanto estiver desenvolvendo, para não processar cobranças reais.

As páginas de contato, newsletter, clube e solicitação de troca ainda não estão integradas por completo a operações de servidor.

### Tentativas de pagamento (PAG-05)

Antes de solicitar cobranças avulsas por Pix, boleto ou cartão, a API grava uma
`TentativaPagamento` com o cliente autenticado, a cópia dos itens e preços,
subtotal, desconto, frete validado, total, parcelas e CEP. Se esse registro
falhar, nenhuma cobrança é solicitada. O identificador é enviado ao Mercado
Pago em `external_reference` e devolvido pela API como `tentativa_id`.

Uma resposta identificada do gateway registra `resposta_recebida`, o ID do
pagamento e seu status. Erros e timeouts registram `resultado_desconhecido`,
pois não comprovam que a cobrança deixou de ser criada. Se a atualização do
banco falhar após a cobrança, a resposta do gateway é preservada e a tentativa
inicial continua disponível para conciliação pela referência externa. O registro
não guarda token, CPF, número do cartão, CVV ou o payload completo do gateway.

O pedido comercial continua sendo registrado pelo fluxo de `/api/pedidos`.
O controle de reserva antecipada e a idempotência entre requisições estão
descritos abaixo. A conciliação completa de notificações permanece uma etapa
separada (PAG-08).
Os testes locais estão disponíveis em `npm run test:pagamentos`, na pasta
`cliente`; arquivos ignorados em `cliente/tests/` precisam existir localmente.

### Reserva de estoque (PAG-06)

A tentativa é registrada e todos os seus itens são reservados em uma transação
MongoDB antes de solicitar a cobrança. A condição de decremento verifica o
produto ativo e o saldo disponível após a margem de segurança. Se faltar um
item, a transação desfaz todos os decrementos e o gateway não é chamado.

É obrigatório usar MongoDB com transações: replica set (inclusive no ambiente
local) ou cluster compatível, como MongoDB Atlas. Uma instância standalone não
suporta esse fluxo e a cobrança não deve prosseguir se a reserva falhar.

O estado `estoqueEstado` da tentativa controla a reserva. A liberação muda
`reservado` para `liberado` e repõe todos os itens na mesma transação; repetir
a operação não repõe novamente. Recusa ou cancelamento confirmados pelo
provedor liberam a reserva, inclusive por webhook antes de existir pedido.
O cancelamento do pedido usa a mesma operação. O registro do pedido reutiliza
os itens da tentativa e não desconta o estoque uma segunda vez.

Timeout, erro sem resposta conclusiva, pagamento pendente e falha ao gravar
o pedido após cobrar mantêm a reserva para conciliação. Não há expiração
automática: não libere apenas pelo tempo decorrido. Em falhas, consulte o
pagamento no provedor usando `external_reference` antes de decidir a liberação.
Em pedidos legados, novos cancelamentos gravam um marcador de restituição
pendente; cancelamentos antigos sem esse marcador exigem conferência manual
para evitar repor estoque já restituído.

Os testes de disputa, reversão e repetição usam persistência simulada com
transações serializadas; a homologação com MongoDB real e gateway sandbox
continua necessária.

### Idempotência por tentativa (PAG-07)

As rotas de Pix, boleto e cartão exigem `chaveTentativa` (16 a 80 caracteres
alfanuméricos ou hífen). O checkout gera um UUID e mantém a chave durante
repetições; `sessionStorage` permite conservá-la após falha de rede ou
recarregamento antes de registrar o pedido. O envio tem bloqueio imediato de
duplo clique. Dados de cartão e tokens não são salvos nesse armazenamento.

O índice único parcial `{ clienteId: 1, chaveTentativa: 1 }` impede duas
tentativas para a mesma chave e conta. O índice deve estar criado antes de
habilitar cobranças; a API aguarda a inicialização do modelo. Em ambientes com
criação automática de índices desativada, crie esse índice no procedimento de
deploy. O identificador persistido da tentativa também é usado como
`requestOptions.idempotencyKey` no SDK do Mercado Pago.

Uma repetição conhecida devolve os mesmos dados de cobrança sem recalcular o
carrinho, reservar ou cobrar novamente. São persistidos somente os campos de
resposta necessários ao checkout (status, identificador, Pix, boleto e parcelas),
com seleção restrita por padrão no modelo. A chave está vinculada aos dados
da requisição por hash; mudanças de método, entrega ou parcelas geram conflito
HTTP 409. Retokenização do mesmo pagamento não altera sua identidade.

Requisições em processamento ou com resultado desconhecido retornam HTTP 409
com `tentativa_id` e não fazem outra chamada de cobrança. Não crie outra chave
para contornar timeout. O webhook consulta o pagamento na API do provedor e
registra a resposta na tentativa; após a conciliação, repetir a mesma chave
recupera essa resposta. A autenticação e o controle de versões do webhook
estão descritos na PAG-08 abaixo. Uma tentativa interrompida
antes de chegar ao gateway permanece bloqueada para conferência operacional;
não há reenvio automático após expiração de prazo.

O checkout permite nova chave após recusa/cancelamento conclusivo ou falha de
estoque sem cobrança. Após registrar o pedido, remove a chave do armazenamento
da aba, mantendo a referência em memória enquanto a tela permanece aberta.
Os testes locais simulam concorrência e persistência; ainda é necessária
homologação com o índice real e a idempotência do gateway em sandbox.

### Webhook autenticado e conciliação (PAG-08)

Configure `MP_WEBHOOK_SECRET` com a chave secreta de Webhooks da aplicação
no painel Mercado Pago; ela é diferente do access token. Sem essa chave ou
sem o cliente do gateway, `/api/webhook` responde HTTP 503 e não processa o
evento. Não há bypass de assinatura para desenvolvimento: a homologação
também precisa enviar notificações assinadas.

A assinatura `x-signature` é verificada com HMAC-SHA256, usando `data.id` da
URL, `x-request-id` e `ts`, com comparação em tempo constante. O ID do corpo,
quando presente, precisa corresponder ao ID assinado. Assinaturas ausentes,
inválidas ou ambíguas recebem HTTP 401 antes de qualquer consulta externa.
O timestamp participa da assinatura; a ordenação dos pagamentos usa a data
do recurso consultado, e não a data de chegada ou o conteúdo do evento.

Após validar a assinatura, a API consulta o pagamento no Mercado Pago e
confere seu identificador, moeda, valor e vínculo com os registros locais.
`date_last_updated` determina a versão. `date_approved` é armazenada como
data efetiva de aprovação, separada de `recebidoEm`. A coleção
`NotificacaoPagamento` registra cada combinação de pagamento e versão uma
única vez. Notificações repetidas não duplicam histórico ou reposição de estoque;
versões anteriores não sobrescrevem versões posteriores. Respostas atrasadas
da criação da cobrança também respeitam a versão já conciliada.

A tentativa, a atualização do pedido, a liberação aplicável do estoque e o
registro da notificação são processados na mesma transação MongoDB. Falhas
recebem HTTP 503 e desfazem os efeitos, permitindo o reenvio do provedor.
Notificações válidas processadas, repetidas, antigas ou sem vínculo local
recebem HTTP 200. Erros não registram headers, assinatura ou dados completos
do pagamento nos logs.

Este fluxo trata o tópico `payment` das compras avulsas. O status financeiro
mais recente fica registrado na tentativa e no pedido, separadamente da logística
(PAG-09). Os tópicos recorrentes são conciliados separadamente, conforme PAG-11 abaixo.

Referência técnica: [notificações do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications).
Os testes locais usam HMAC real e banco/gateway simulados; a homologação
de notificações reais e concorrência no MongoDB continua necessária.

### Estados financeiros e logísticos (PAG-09)

O pedido possui `statusFinanceiro`, `statusLogistico` e `valorReembolsado` em
centavos. `historicoFinanceiro` e `historicoLogistico` registram as mudanças
separadamente. O campo antigo `status` permanece como projeção de compatibilidade,
sem representar sozinho a situação financeira atual.

| Situação consultada na Payments API | Estado financeiro |
| --- | --- |
| `pending`, `in_process`, `authorized` | `aguardando_pagamento` |
| `approved`, sem reembolso | `aprovado` |
| `approved`, com valor parcialmente reembolsado | `parcialmente_reembolsado` |
| `refunded`, ou valor integral reembolsado | `reembolsado` |
| `rejected` / `cancelled` | `recusado` / `cancelado` |
| `in_mediation` / `charged_back` | `em_contestacao` / `contestado` |

O webhook continua processando reembolsos e contestações após a aprovação.
O total original do pedido não é alterado: o valor devolvido é registrado
separadamente. Não são solicitados estornos automaticamente por essa etapa;
o estado financeiro reflete o recurso consultado no provedor.

A logística segue `aguardando_liberacao` → `pronto_para_preparo` →
`em_separacao` → `enviado` → `entregue`. A aprovação libera o preparo.
Pendência financeira, contestação ou reembolso parcial bloqueiam novos avanços
para preparo/envio. Reembolso integral confirmado antes do envio cancela a
logística e libera o estoque uma única vez. Após o envio, preserva a logística
e não repõe estoque automaticamente: eventual retorno físico precisa ser
tratado no pós-venda. A entrega de uma encomenda já enviada pode ser registrada
mesmo se houver pendência financeira.

O administrador só altera logística e rastreio. Transições para trás, reabertura
de cancelamento e salto de etapas são rejeitados. O cancelamento operacional
antes do envio repõe o estoque, mas não muda o pagamento para reembolsado.
As alterações logísticas e os efeitos de estoque são transacionais.

Checkout, perfil, acompanhamento e painel administrativo mostram a situação
financeira separadamente. A API de status também a retorna. O painel calcula
os valores confirmados descontando reembolsos e excluindo pagamentos contestados
ou ainda não confirmados; essa métrica operacional não substitui conciliação
contábil. Dados legados sem os novos campos são interpretados a partir do status
anterior; um cancelamento legado não é apresentado como estorno confirmado.

Referência técnica: [status de pagamentos na Payments API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/response-handling/query-results).
Os testes locais cobrem reembolso antes/depois do envio, reembolso parcial,
contestação, cancelamento logístico, duplicidade e concorrência simulada.

### Plano único e contratação do Clube (PAG-10)

A oferta oficial é `SUB-02 — Pequenos Criadores`, mensal, para uma criança,
por **9490 centavos**, com **frete zero em todo o Brasil**. A constante
`PLANO_CLUBE` no servidor fornece a oferta por `GET /api/assinatura/plano`.
O navegador não define preço, recorrência, desconto, nome do plano ou URL de
retorno. O valor é convertido para reais somente no envio ao Mercado Pago.

A página `/clube` consulta a oferta, exige login, permite selecionar um endereço
da conta e solicita aceite expresso da cobrança recorrente. O cartão é
tokenizado pelo SDK do Mercado Pago; somente o token é enviado à API.
`POST /api/assinatura/criar` usa o e-mail do cadastro, copia o endereço escolhido,
registra a solicitação antes de chamar `PreApproval.create` e envia recorrência
de um mês, valor R$ 94,90 e moeda BRL, sem teste grátis ou prazo anual.
Configure `APP_URL` com a URL pública HTTPS (ou use `VERCEL_URL` no deploy).
Uma URL de retorno fornecida pelo navegador é ignorada.

Uma chave por cliente e tentativa protege a contratação contra repetições e
timeout. Número completo do cartão, CVV e token não são persistidos no registro
da assinatura. Dados brutos de cartão são rejeitados no backend. A consulta
`GET /api/assinaturas` e `/assinatura/:id` exige login e filtra pelo dono.

O estado inicial da solicitação é `iniciando`; após a resposta do provedor,
fica `aguardando_pagamento`. `authorized` na autorização de recorrência não
comprova que a primeira mensalidade foi aprovada: não ativa a assinatura nem
libera caixa. A confirmação da primeira mensalidade, competência e calendário
pertencem à PAG-11; o cancelamento da recorrência pertence à PAG-12. Retornar
do gateway ou recarregar a página não confirma pagamento.

Os planos antigos não são mais oferecidos. Rotas administrativas antigas de
cadastro de planos/assinaturas e exclusão retornam HTTP 410; a exclusão direta
de um registro não interromperia uma recorrência no provedor. Dados históricos
de planos anteriores permanecem legíveis e não têm seus preços reescritos.
Novas assinaturas só podem usar SUB-02 com entrega incluída. Contratações
pendentes não são contadas como assinaturas ativas no painel.

Referência técnica: [assinaturas com pagamento autorizado](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments).
Os testes locais simulam o provedor e o banco; a tokenização e a primeira
cobrança devem ser homologadas com contas e cartões de teste do Mercado Pago.

### Mensalidades, caixas e calendário do Clube (PAG-11)

A implementação segue RN01, RF10 e UC08 da
[especificação revisada](https://docs.google.com/document/d/1q2ahCE_9drT_uEBRZR1qIDAnrjw1jFWuaUfM733luBE/edit).
O webhook aceita `subscription_authorized_payment` e `subscription_preapproval`,
sempre com a validação HMAC já utilizada no tópico `payment`. Consulta a autorização,
percorre todas as páginas de `/authorized_payments/search` e consulta os pagamentos
na Payments API. Confere vínculo, cartão de crédito, moeda BRL, valor 9490 centavos
e datas efetivas. Autorizar a recorrência não ativa a adesão. A primeira aprovação
efetiva registra `assinadoEm` e ativa a assinatura. A data de recebimento é separada.
O tópico `payment` também procura a fatura quando não encontra uma compra avulsa.

`MensalidadeClube` identifica a fatura; `CaixaClube` identifica sua entrega.
Índices únicos impedem reutilizar pagamento, fatura ou competência da assinatura.
A conciliação é transacional, serializada por assinatura e ordenada pela versão
do recurso. Lê o histórico completo para resolver notificações fora de ordem;
inconsistências de vínculo, primeira aprovação ou competência já consolidada
recebem 503 para conciliação, sem remapear entregas silenciosamente. Uma nova
tentativa de uma fatura recusada pode substituir o pagamento não aprovado,
preservando seu identificador e situação no histórico. Pagamentos pendentes e
recusados não geram caixa. Reembolsos e contestações bloqueiam novos envios.

O calendário usa `America/Sao_Paulo`: primeira aprovação até dia 10 às 12:00:00,
inclusive, corresponde ao mês atual; após isso, ao seguinte. Cada mensalidade
aprovada seguinte financia o próximo mês da sequência de caixas. Não reaplica
o corte de adesão a cada renovação. Aprovação após o corte da competência adia
o lote de postagem até o próximo corte elegível, mantendo a competência e o
pagamento original. Repetições preservam preparação, rastreio e adiamentos.
O prazo de separação de 2 dias úteis das compras avulsas não se aplica ao Clube.

O vencimento contratual é calculado a partir do dia da primeira aprovação:
31/janeiro → 28/fevereiro → 31/março, ou 29/fevereiro em ano bissexto.
`vencimentoProvedor`, `vencimentoContratual` e `cobrancaDivergente` ficam disponíveis
para conciliação administrativa. **Essa verificação não altera a agenda de débito
do Mercado Pago**. É necessário homologar a agenda do provedor, inclusive quando
a aprovação inicial acontece em dia diferente da autorização e nos dias 29 a 31.
Não há criação de cobrança adicional para corrigir calendário. Enquanto essa
compatibilidade não estiver comprovada, a PAG-11 não está integralmente homologada.

Rotas adicionadas (todas privadas e sem cache):

| Rota | Acesso e finalidade |
| --- | --- |
| `GET /api/clube/caixas` | Cliente: apenas suas caixas, competência, previsão, situação, ocorrências e rastreio |
| `GET /admin/clube/mensalidades` | Administrador: pagamentos, faturas, versões e divergências de vencimento |
| `GET /admin/clube/caixas` | Administrador: caixas aprovadas, desbloqueadas e ainda não postadas, inclusive de assinaturas canceladas |
| `PUT /admin/clube/calendario/:mes` | Administrador: confirma a data operacional de postagem do lote `AAAA-MM` |
| `PATCH /admin/clube/caixas/:id` | Administrador: avança `aguardando` → `preparando` → `enviada` → `entregue` |
| `POST /admin/clube/caixas/:id/ocorrencias` | Administrador: registra impedimento, nova previsão e confirmação de contato com o cliente |

Para confirmar o calendário, envie `postagemPrevista: "AAAA-MM-DD"` e
`operacaoConfirmada: true`. A operação deve conferir a unidade/transportadora:
use o dia 10 ou o primeiro dia útil com operação seguinte, inclusive feriados
locais. Sem calendário confirmado, a previsão fica pendente e o envio bloqueado.
A alteração do calendário atualiza caixas ainda não postadas sem ocorrência
específica, preservando as exceções individuais.

Para avançar a preparação, envie `statusPreparacao`; no envio, inclua `rastreio`.
Não é permitido marcar envio antes da previsão, sem calendário ou com pendência
financeira. O recebimento de uma caixa já enviada pode ser registrado mesmo
se surgir uma pendência financeira posteriormente.

Em impedimento extraordinário, a operação deve informar o cliente e apresentar
nova previsão **até 1 dia útil após identificar o problema**. Registre `motivo`,
`novaPrevisao` e `clienteInformado: true` na rota de ocorrências. O registro guarda
a comunicação confirmada pelo operador e fica visível na página `/clube`.
Não há disparo automático de mensagem nem monitoramento automático desse prazo.
As previsões referem-se à postagem; o recebimento depende do transporte ao CEP.

A página `/clube` consulta as caixas da conta mesmo após cancelamento e oferece
atualização manual. O cancelamento efetivo no provedor e a solicitação de reembolso
posterior são tratados pela PAG-12 abaixo.

Os testes executam os módulos e handlers reais com banco e provedor simulados,
incluindo corte exato, fim de mês, ano bissexto, atraso, duplicidade, concorrência
simulada, versão antiga, falha transacional, autorização e adulteração de valores.
É necessária homologação com MongoDB em replica set e notificações reais do
Mercado Pago. Configure os tópicos recorrentes na integração do provedor.

Referências: [faturas recorrentes](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/get-authorized-payment/get),
[busca de faturas](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/authorized-payment-search/get)
e [gestão de assinaturas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/subscription-management).

### Cancelamento e reembolsos do Clube (PAG-12)

O fluxo segue RN01 e UC04 da especificação revisada. O cliente pode cancelar
a recorrência na página `/clube`, antes ou depois da primeira aprovação.
`POST /api/assinaturas/:id/cancelar` exige login e propriedade do registro.
IDs de pagamentos, valores e datas enviados no corpo não são utilizados.

A solicitação fixa `canceladoEm` no servidor e registra uma `OperacaoClube`
na mesma transação, antes de chamar o provedor. O instante não muda em repetições.
`statusAdesao: cancelada` representa a decisão local; `cancelamentoEstado`
separa a situação `pendente` da confirmação `confirmado` no provedor.
A API retorna 202 enquanto aguarda confirmação, e a página informa a pendência.
Somente após consultar e confirmar a autorização remota cancelada o fluxo
declara que a recorrência foi interrompida. Timeout não gera confirmação falsa.

A operação solicita `PreApproval.update` com `status: cancelled`, impedindo
novas cobranças e tentativas da recorrência no provedor após a confirmação.
Pagamentos conhecidos ainda pendentes também têm seu cancelamento solicitado
pela Payments API. A consulta de faturas encontra pendências ainda não notificadas.
Se a autorização tiver resposta desconhecida e nenhum ID local, a retomada
percorre a busca de assinaturas e exige uma referência externa exata e única.
Vínculo ausente/ambíguo permanece pendente para conciliação. Se a resposta da
criação chegar depois do cancelamento, seu ID é guardado e a interrupção retomada,
sem reabrir a assinatura. Nenhuma rota desta etapa cria ou reativa cobranças.

Uma aprovação efetiva anterior ao cancelamento mantém a caixa devida, inclusive
com postagem futura, em preparação ou com webhook recebido posteriormente.
Não há estorno automático dessas caixas. Uma aprovação posterior bloqueia a
caixa e agenda restituição integral. Em reembolso parcial já realizado, solicita
somente o saldo restante para completar o total de R$ 94,90. Arrependimento e
demais direitos legais permanecem preservados. Os vídeos continuam disponíveis
a qualquer conta autenticada; o cancelamento não altera essa autorização.

Cada operação possui ID estável por assinatura/pagamento e chave idempotente
enviada ao Mercado Pago. Para reembolso, o corpo é salvo antes do POST e não
é recalculado na repetição de uma solicitação inconclusiva. Um bloqueio temporário
com token impede processadores simultâneos de assumirem a mesma operação;
uma execução interrompida pode ser retomada após expirar o bloqueio de 2 minutos.
O índice `_id` impede enfileiramento duplicado. Falhas mantêm as operações no
banco para nova tentativa após 1 minuto e registram apenas o identificador da operação.

A solicitação de reembolso ocorre imediatamente após a identificação da aprovação
posterior. Como limite interno conservador, registra 48 horas corridas após essa
identificação, sem exceder o prazo comercial de 2 dias úteis. A consulta administrativa
marca `prazoExcedido` quando esse limite é ultrapassado sem solicitação confirmada.
Uma resposta inconclusiva não é apresentada como estorno efetuado. Um reembolso
aceito, mas ainda processando, fica `solicitado`; a retomada consulta seu ID sem
outro POST. Só a Payments API confirmando devolução integral libera a situação
`concluido`. A caixa continua bloqueada e não será enviada. O crédito ao cliente
depende do meio de pagamento.

Rotas operacionais:

| Rota | Finalidade |
| --- | --- |
| `POST /api/assinaturas/:id/cancelar` | Cliente cancela sua própria recorrência; repetições preservam o instante original |
| `GET /admin/clube/operacoes` | Administrador consulta até 100 operações abertas, tentativas, prazo e situação |
| `POST /admin/clube/operacoes/processar` | Administrador retoma conciliação e operações pendentes |
| `GET /api/clube/operacoes/processar` | Endpoint do agendador, autenticado exclusivamente com `Authorization: Bearer <CRON_SECRET>` |

**Configuração de produção necessária:** defina um `CRON_SECRET` forte no servidor
e configure um agendador externo para chamar o endpoint acima periodicamente
(por exemplo, a cada minuto). Não coloque o segredo na URL nem no frontend.
Sem segredo, a rota retorna 503; com autenticação incorreta, 401. A execução
reconsulta contratos cancelados para descobrir aprovações sem webhook e processa
até 50 operações elegíveis por chamada. Chamadas concorrentes são permitidas.
Monitore o volume e a fila; agende mais execuções quando necessário. Falhas
permanentes do provedor/saldo insuficiente exigem intervenção do administrador.
Esta implementação não configura nem publica um agendador no ambiente externo.

Os testes locais usam handlers reais, HMAC e serviços reais com banco/gateway
simulados. Cobrem propriedade, falha antes da chamada, repetição, concorrência,
timeout antes/depois do efeito remoto, cobrança pendente, aprovação durante o
cancelamento, webhook atrasado, restituição parcial já existente e retorno da
autorização após o cancelamento. Homologue o cancelamento e o reembolso com
contas de teste e MongoDB em replica set antes de produção. Não foram realizadas
cobranças, cancelamentos nem devoluções reais para executar os testes.

Referências: [cancelamentos e reembolsos](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/cancellations-and-refunds),
[atualização da assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/update-preapproval/put)
e [criação idempotente de reembolso](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/create-refund/post).

## Estrutura principal

```text
cliente/
├── api/                 # entrada da API para deploy serverless
├── backend/
│   ├── db/              # modelos e conexão com MongoDB
│   └── functions/       # autenticação, carrinho e validações
├── src/
│   ├── Componentes/     # cabeçalho, rodapé e componentes compartilhados
│   └── Pages/           # páginas da loja
├── server.js            # servidor Express local
└── package.json         # dependências e scripts
docs/
└── screenshots/         # capturas incluídas neste README
```
