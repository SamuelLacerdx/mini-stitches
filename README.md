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
recupera essa resposta. A autenticação do webhook e o tratamento completo de
eventos fora de ordem ainda pertencem à PAG-08. Uma tentativa interrompida
antes de chegar ao gateway permanece bloqueada para conferência operacional;
não há reenvio automático após expiração de prazo.

O checkout permite nova chave após recusa/cancelamento conclusivo ou falha de
estoque sem cobrança. Após registrar o pedido, remove a chave do armazenamento
da aba, mantendo a referência em memória enquanto a tela permanece aberta.
Os testes locais simulam concorrência e persistência; ainda é necessária
homologação com o índice real e a idempotência do gateway em sandbox.

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
