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
