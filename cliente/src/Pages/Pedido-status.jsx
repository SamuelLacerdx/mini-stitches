import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

const PEDIDO_VAZIO = {
  id: '',
  dataPedido: '',
  status: 'aprovado',
  cliente: {
    nome: '',
    nomeCompleto: '',
    email: '',
  },
  entrega: {
    rua: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    metodo: '',
    valorFrete: 0,
    prazoTexto: '',
    previsaoPostagem: '',
    dataPostagem: '',
    dataEntrega: '',
    dataEntregaCurta: '',
    codigoRastreio: '',
    rastreioHistorico: [],
  },
  pagamento: {
    metodo: '',
    detalhe: '',
    statusTexto: '',
    parcelasTexto: '',
    dataConfirmacao: '',
    dataAprovacaoCurta: '',
    historico: [],
  },
  itens: [],
  subtotal: 0,
  totalPago: 0,
  atualizacoesStatus: [],
};

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusVisualParaTela = {
  pago: 'aprovado',
  aprovado: 'aprovado',
  aguardando_pagamento: 'aprovado',
  preparacao: 'preparacao',
  preparando: 'preparacao',
  enviado: 'enviado',
  entregue: 'entregue',
};

const metodoPagamento = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao: 'Cartão de crédito',
};

const formatarData = (valor) => {
  if (!valor) return 'Data indisponível';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const normalizarPedido = (pedidoApi) => {
  if (!pedidoApi) return null;

  const statusTela = statusVisualParaTela[pedidoApi.status] || 'aprovado';
  const endereco = String(pedidoApi.entrega?.endereco || '').trim();
  const partesEndereco = endereco ? endereco.split(' - ') : [];
  const rua = partesEndereco[0] || '';
  const complemento = partesEndereco[1] || '';
  const bairro = partesEndereco[2] || '';
  const cidadeEstado = partesEndereco[3] || '';
  const [cidade = '', estado = ''] = cidadeEstado.split('/');

  const itens = (pedidoApi.itens || []).map((item, index) => ({
    id: item._id || item.id || index + 1,
    nome: item.nome || 'Item do pedido',
    detalhe: item.slug || 'Produto',
    quantidade: Number(item.quantidade || 1),
    preco: Number((Number(item.precoUnit || 0) || 0) / 100),
  }));

  const subtotal = Number(pedidoApi.subtotal || 0) / 100;
  const totalPago = Number(pedidoApi.total || subtotal) / 100;

  const historicoStatus = Array.isArray(pedidoApi.historicoStatus)
    ? pedidoApi.historicoStatus.map((item) => ({
        statusMinimo: statusVisualParaTela[item.status] || 'aprovado',
        data: formatarData(item.em),
        titulo: item.status === 'pago' ? 'Pagamento aprovado' : 'Atualização do pedido',
        descricao: `Status atualizado para ${item.status}.`,
      }))
    : [];

  return {
    ...PEDIDO_VAZIO,
    id: pedidoApi.numero || pedidoApi.id || '',
    dataPedido: formatarData(pedidoApi.criadoEm),
    status: statusTela,
    cliente: {
      nome: pedidoApi.cliente?.nome || '',
      nomeCompleto: pedidoApi.cliente?.nome || '',
      email: pedidoApi.cliente?.email || '',
    },
    entrega: {
      ...PEDIDO_VAZIO.entrega,
      rua,
      complemento,
      bairro,
      cidade: cidade.trim() || '',
      estado: estado.trim() || '',
      cep: pedidoApi.entrega?.cep || '',
      metodo: pedidoApi.frete ? 'PAC' : '',
      valorFrete: Number((pedidoApi.frete || 0) / 100),
      codigoRastreio: pedidoApi.rastreio || '',
      rastreioHistorico: [],
    },
    pagamento: {
      ...PEDIDO_VAZIO.pagamento,
      metodo: metodoPagamento[pedidoApi.pagamento] || '',
      detalhe: metodoPagamento[pedidoApi.pagamento] || '',
      statusTexto: statusTela === 'aprovado' ? 'Pagamento aprovado' : 'Pagamento em análise',
      parcelasTexto: totalPago ? '1x de ' + formatarMoeda(totalPago) : '',
      dataConfirmacao: formatarData(pedidoApi.criadoEm),
      dataAprovacaoCurta: formatarData(pedidoApi.criadoEm),
      historico: [
        {
          dataHora: formatarData(pedidoApi.criadoEm) ? `${formatarData(pedidoApi.criadoEm)} • 00:00` : '',
          atualizacao: statusTela === 'aprovado' ? 'Pagamento aprovado' : 'Pedido registrado',
          detalhes: pedidoApi.numero || pedidoApi.id ? `Pedido ${pedidoApi.numero || pedidoApi.id} atualizado no sistema.` : 'Pedido atualizado no sistema.',
        },
      ],
    },
    itens: itens.length ? itens : [],
    totalPago,
    atualizacoesStatus: historicoStatus,
  };
};

export default function PedidoStatus() {
  const { id } = useParams();
  const [pedido, setPedido] = useState(null);
  const [telaAtual, setTelaAtual] = useState('confirmacao'); // 'confirmacao' | 'acompanhamento' | 'pagamento'
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const carregarPedido = async () => {
      try {
        const pedidoId = id || 'MS10248';
        const res = await fetch(`/api/pedidos/${pedidoId}`);
        if (res.ok) {
          const dados = await res.json();
          const pedidoNormalizado = normalizarPedido(dados.pedido || dados);
          setPedido(pedidoNormalizado);
        } else {
          setPedido(null);
        }
      } catch (err) {
        setPedido(null);
      }
    };

    carregarPedido();
    const intervalo = setInterval(carregarPedido, 30000);
    return () => clearInterval(intervalo);
  }, [id]);

  const copiarCodigoRastreio = () => {
    navigator.clipboard.writeText(pedido.entrega.codigoRastreio);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  // Configuração visual dinâmica de acordo com o status definido pelo Admin
  const configEtapas = {
    aprovado: {
      indice: 1,
      titulo: 'ACOMPANHE SEU PEDIDO',
      subtitulo: 'Da nossa mesa de criação até a sua casa: veja cada passo por aqui.',
      badge: 'Pagamento aprovado',
    },
    preparacao: {
      indice: 2,
      titulo: 'PREPARANDO COM CARINHO',
      subtitulo: 'Estamos separando cada material para o seu próximo momento de criar.',
      badge: 'Em preparação',
    },
    enviado: {
      indice: 3,
      titulo: 'SUA CAIXINHA ESTÁ A CAMINHO',
      subtitulo: 'Seu pedido já saiu daqui! Acompanhe as novidades da sua entrega.',
      badge: 'Pedido enviado',
    },
    entregue: {
      indice: 4,
      titulo: 'CHEGOU A HORA DE CRIAR!',
      subtitulo: 'Seu pedido foi entregue. Que venham muitos pontos e novas memórias.',
      badge: 'Entrega concluída',
    },
  };

  const etapaInfo = configEtapas[pedido.status] || configEtapas.aprovado;

  const passosStepper = [
    { num: '01', titulo: 'Pagamento aprovado', etapaIdx: 1 },
    { num: '02', titulo: 'Em preparação', etapaIdx: 2 },
    { num: '03', titulo: 'A caminho', etapaIdx: 3 },
    { num: '04', titulo: 'Entregue', etapaIdx: 4 },
  ];

  // Filtra o histórico de atualizações conforme o avanço do pedido
  const historicoVisivel = pedido.atualizacoesStatus.filter((item) => {
    if (pedido.status === 'aprovado') return item.statusMinimo === 'aprovado';
    return true;
  });

  return (
    <div className="w-full bg-[#FEF8F0] min-h-screen font-['Work_Sans',sans-serif] text-[#3E2417] py-8 px-4 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ============================================================== */}
        {/* NAVEGAÇÃO SUPERIOR & BREADCRUMBS                               */}
        {/* ============================================================== */}
        {telaAtual === 'confirmacao' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs md:text-sm font-medium">
            <Link to="/" className="flex items-center gap-2 text-[#3E2417] underline hover:text-[#602D15] transition-colors">
              <span>←</span> Voltar à loja
            </Link>
            <div className="flex items-center gap-2 text-[#80695B]">
              <Link to="/carrinho" className="hover:underline">Carrinho</Link>
              <span>›</span>
              <Link to="/checkout" className="hover:underline">Dados e pagamento</Link>
              <span>›</span>
              <span className="font-bold text-[#3E2417] flex items-center gap-1">
                <span>✓</span> Confirmação
              </span>
            </div>
          </div>
        )}

        {telaAtual === 'acompanhamento' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs md:text-sm font-medium">
            <button
              type="button"
              onClick={() => setTelaAtual('confirmacao')}
              className="flex items-center gap-2 text-[#3E2417] hover:text-[#602D15] transition-colors text-left"
            >
              Voltar à confirmação
            </button>
            <div className="flex items-center gap-2 text-[#80695B]">
              <Link to="/conta" className="hover:underline">Minha conta</Link>
              <span>/</span>
              <Link to="/conta/pedidos" className="hover:underline">Meus pedidos</Link>
              <span>/</span>
              <span className="text-[#3E2417] font-semibold">#{pedido.id}</span>
            </div>
          </div>
        )}

        {telaAtual === 'pagamento' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs md:text-sm font-medium">
            <button
              type="button"
              onClick={() => setTelaAtual('acompanhamento')}
              className="flex items-center gap-2 text-[#3E2417] hover:text-[#602D15] transition-colors text-left"
            >
              Voltar ao acompanhamento
            </button>
            <div className="flex items-center gap-2 text-[#80695B]">
              <Link to="/conta" className="hover:underline">Minha conta</Link>
              <span>/</span>
              <Link to="/conta/pedidos" className="hover:underline">Pedidos</Link>
              <span>/</span>
              <span className="text-[#3E2417] font-semibold">Pagamento</span>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CABEÇALHO DINÂMICO                                             */}
        {/* ============================================================== */}
        {telaAtual === 'confirmacao' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#F7C6E5] flex items-center justify-center shrink-0">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-[#3E2417]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h1 className="text-3xl md:text-5xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase tracking-tight">
                  PEDIDO CONFIRMADO!
                </h1>
                <p className="text-sm md:text-base text-[#3E2417]/90">
                  Obrigada, {pedido.cliente.nome}! Seu próximo momento de criar já está a caminho de acontecer.
                </p>
              </div>
            </div>
            <div className="bg-[#FBEDD9] px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold text-[#3E2417] flex items-center gap-2 self-start md:self-center shrink-0">
              <svg className="w-4 h-4 text-[#3E2417]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>{pedido.pagamento.statusTexto}</span>
            </div>
          </div>
        )}

        {telaAtual === 'acompanhamento' && (
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-5xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase tracking-tight">
                {etapaInfo.titulo}
              </h1>
              <p className="text-sm md:text-base text-[#3E2417]/90">
                {etapaInfo.subtitulo}
              </p>
            </div>
            <div className="bg-[#F7C6E5] px-5 py-2.5 rounded-xl text-xs md:text-sm font-semibold text-[#3E2417] min-w-50 self-start">
              {etapaInfo.badge}
            </div>
          </div>
        )}

        {telaAtual === 'pagamento' && (
          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase tracking-tight">
              ATUALIZAÇÕES DE PAGAMENTO
            </h1>
            <p className="text-sm md:text-base text-[#3E2417]/90">
              Tudo sobre o pagamento do seu pedido, em um só lugar.
            </p>
          </div>
        )}

        {/* ============================================================== */}
        {/* FAIXA DE IDENTIFICAÇÃO DO PEDIDO (Presente em todas as telas)  */}
        {/* ============================================================== */}
        <div className="bg-[#FBEDD9] p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-['Archivo_Black',sans-serif] text-base md:text-lg text-[#3E2417] uppercase">
              PEDIDO #{pedido.id}
            </div>
            <p className="text-xs md:text-sm text-[#80695B]">
              Realizado em {pedido.dataPedido}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm md:text-base text-[#3E2417]">
              Enviamos os detalhes para <span className="font-medium">{pedido.cliente.email}</span>.
            </p>
            <p className="text-xs md:text-sm text-[#80695B]">
              Se não encontrar, dê uma olhadinha na caixa de spam.
            </p>
          </div>

          <div className="text-xs text-[#80695B] md:text-right">
            Exemplo de pedido • dados ilustrativos
          </div>
        </div>

        <hr className="border-[#C58752]/30" />

        {/* ============================================================== */}
        {/* CONTEÚDO PRINCIPAL EM DUAS COLUNAS                             */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* COLUNA DA ESQUERDA (7 COLUNAS) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            
            {/* ---------------------------------------------------------- */}
            {/* TELA 1: CONFIRMAÇÃO DO PEDIDO                              */}
            {/* ---------------------------------------------------------- */}
            {telaAtual === 'confirmacao' && (
              <>
                {/* BOTÕES PRINCIPAIS */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setTelaAtual('acompanhamento')}
                      className="h-14 px-7 bg-[#3E2417] hover:bg-[#2A180F] text-[#FEF8F0] font-['Archivo_Black',sans-serif] text-sm md:text-base rounded-lg uppercase flex items-center gap-3 transition-colors"
                    >
                      <span>ACOMPANHAR PEDIDO</span>
                      <span>→</span>
                    </button>
                    <Link
                      to="/kits"
                      className="h-14 px-7 rounded-lg border border-[#3E2417] text-[#3E2417] hover:bg-[#3E2417] hover:text-white font-['Archivo_Black',sans-serif] text-sm md:text-base uppercase flex items-center justify-center transition-colors"
                    >
                      CONTINUAR COMPRANDO
                    </Link>
                  </div>
                  <p className="text-xs md:text-sm text-[#80695B]">
                    Você pode consultar o status do pedido a qualquer momento pelo link enviado ao seu e-mail.
                  </p>
                </div>

                <hr className="border-[#C58752]/30" />

                {/* SEÇÃO: E AGORA? */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] flex items-center justify-center">
                      ♥
                    </span>
                    <h2 className="text-lg md:text-xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                      E AGORA?
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Passo 1 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#F7C6E5] flex items-center justify-center shrink-0 text-[#3E2417]">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div className="hidden md:block flex-1 h-px bg-[#C58752]/40" />
                      </div>
                      <h3 className="font-['Archivo_Black',sans-serif] text-sm text-[#3E2417] uppercase">
                        PAGAMENTO APROVADO
                      </h3>
                      <p className="text-xs md:text-sm text-[#80695B] leading-relaxed">
                        Tudo certo com a sua compra! Agora vamos separar seus materiais.
                      </p>
                    </div>

                    {/* Passo 2 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#FBEDD9] flex items-center justify-center shrink-0 text-[#80695B]">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </div>
                        <div className="hidden md:block flex-1 h-px bg-[#C58752]/40" />
                      </div>
                      <h3 className="font-['Archivo_Black',sans-serif] text-sm text-[#3E2417] uppercase">
                        PREPARO COM CARINHO
                      </h3>
                      <p className="text-xs md:text-sm text-[#80695B] leading-relaxed">
                        Seu pedido será enviado em até 2 dias úteis após a aprovação.
                      </p>
                    </div>

                    {/* Passo 3 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#FBEDD9] flex items-center justify-center shrink-0 text-[#80695B]">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                          </svg>
                        </div>
                        <div className="hidden md:block flex-1 h-px bg-[#C58752]/40" />
                      </div>
                      <h3 className="font-['Archivo_Black',sans-serif] text-sm text-[#3E2417] uppercase">
                        HORA DE ACOMPANHAR
                      </h3>
                      <p className="text-xs md:text-sm text-[#80695B] leading-relaxed">
                        Assim que sair daqui, você recebe o código de rastreio por e-mail.
                      </p>
                    </div>
                  </div>
                </section>

                <hr className="border-[#C58752]/30" />

                {/* SEÇÃO: SUA ENTREGA & SEU PAGAMENTO */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Sua Entrega */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </span>
                      <h2 className="text-lg md:text-xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                        SUA ENTREGA
                      </h2>
                    </div>

                    <div className="space-y-1 text-sm text-[#3E2417]">
                      <p className="font-semibold text-base">{pedido.cliente.nomeCompleto}</p>
                      <p>{pedido.entrega.rua} • {pedido.entrega.complemento}</p>
                      <p>{pedido.entrega.bairro} • {pedido.entrega.cidade}, {pedido.entrega.estado}</p>
                      <p>CEP {pedido.entrega.cep}</p>
                    </div>

                    <div className="bg-[#FBEDD9] p-4 rounded-lg space-y-1 text-sm">
                      <p className="font-semibold text-[#3E2417]">
                        {pedido.entrega.metodo} • {formatarMoeda(pedido.entrega.valorFrete)}
                      </p>
                      <p className="text-[#3E2417]">{pedido.entrega.prazoTexto}</p>
                      <p className="text-[#80695B]">Envio em até 2 dias úteis.</p>
                    </div>
                  </div>

                  {/* Seu Pagamento */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </span>
                      <h2 className="text-lg md:text-xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                        SEU PAGAMENTO
                      </h2>
                    </div>

                    <div className="space-y-1 text-sm text-[#3E2417]">
                      <p className="font-semibold text-base">{pedido.pagamento.detalhe}</p>
                      <p>{pedido.pagamento.statusTexto}</p>
                      <p>{pedido.pagamento.parcelasTexto}</p>
                      <p>Total pago: {formatarMoeda(pedido.totalPago)}, incluindo o frete.</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs md:text-sm text-[#80695B] pt-2">
                      <span>🔒</span>
                      <span>Seus dados de pagamento estão protegidos.</span>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ---------------------------------------------------------- */}
            {/* TELA 2: ACOMPANHAMENTO (4 ETAPAS CONTROLADAS PELO ADMIN)   */}
            {/* ---------------------------------------------------------- */}
            {telaAtual === 'acompanhamento' && (
              <>
                {/* STEPPER DE 4 ETAPAS */}
                <section className="space-y-4">
                  <h2 className="text-base md:text-lg font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                    CADA ETAPA, COM CARINHO
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {passosStepper.map((passo) => {
                      const isAtual = etapaInfo.indice === passo.etapaIdx;
                      const isConcluido =
                        etapaInfo.indice > passo.etapaIdx ||
                        (pedido.status === 'entregue' && passo.etapaIdx === 4);

                      let subtexto = 'Próxima etapa';
                      if (pedido.status === 'entregue') {
                        subtexto = 'Concluído';
                      } else if (isAtual) {
                        subtexto = 'Etapa atual';
                      } else if (isConcluido) {
                        subtexto = 'Concluído';
                      }

                      return (
                        <div
                          key={passo.num}
                          className={`p-4 md:p-5 rounded-xl space-y-2 transition-colors ${
                            isAtual ? 'bg-[#F7C6E5]' : 'bg-[#FBEDD9]'
                          }`}
                        >
                          <div className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417]">
                            {passo.num}
                          </div>
                          <div className="font-bold text-xs md:text-sm text-[#3E2417]">
                            {passo.titulo}
                          </div>
                          <div className="text-xs text-[#80695B]">{subtexto}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* CARD CONTEXTUAL POR STATUS DO ADMIN */}
                {pedido.status === 'aprovado' && (
                  <div className="bg-[#FBEDD9] p-6 rounded-xl space-y-5">
                    <div className="space-y-2">
                      <h3 className="font-['Archivo_Black',sans-serif] text-base md:text-lg text-[#3E2417] uppercase">
                        TUDO CERTO COM A SUA COMPRA
                      </h3>
                      <p className="text-xs md:text-sm text-[#3E2417]/90 leading-relaxed">
                        Pagamento aprovado em {pedido.pagamento.dataAprovacaoCurta}. Agora vamos separar os {pedido.itens.length} itens do seu pedido. O envio acontece em até 2 dias úteis após a aprovação.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setTelaAtual('pagamento')}
                        className="h-12 px-6 bg-[#3E2417] hover:bg-[#2A180F] text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg transition-colors"
                      >
                        VER ATUALIZAÇÕES DE PAGAMENTO
                      </button>
                      <button
                        type="button"
                        onClick={() => setTelaAtual('confirmacao')}
                        className="h-12 px-6 border border-[#3E2417] text-[#3E2417] hover:bg-[#3E2417] hover:text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg transition-colors"
                      >
                        VER DETALHES DO PEDIDO
                      </button>
                    </div>
                  </div>
                )}

                {pedido.status === 'preparacao' && (
                  <div className="bg-[#FBEDD9] p-6 rounded-xl space-y-5">
                    <div className="space-y-2">
                      <h3 className="font-['Archivo_Black',sans-serif] text-base md:text-lg text-[#3E2417] uppercase">
                        CADA DETALHE FAZ PARTE
                      </h3>
                      <p className="text-xs md:text-sm text-[#3E2417]/90 leading-relaxed">
                        Seus materiais estão sendo separados e conferidos. Assim que o pedido for postado, você recebe o código de rastreio por e-mail.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      <div className="space-y-1">
                        <p className="font-bold text-xs md:text-sm text-[#3E2417]">01 • Separação</p>
                        <p className="text-xs text-[#80695B]">Os {pedido.itens.length} itens do pedido estão sendo reunidos.</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-xs md:text-sm text-[#3E2417]">02 • Conferência</p>
                        <p className="text-xs text-[#80695B]">Conferimos materiais, cores e quantidades.</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-xs md:text-sm text-[#3E2417]">03 • Embalagem</p>
                        <p className="text-xs text-[#80695B]">Uma caixinha pronta para viajar até você.</p>
                      </div>
                    </div>

                    <p className="text-xs md:text-sm font-semibold text-[#3E2417] pt-1">
                      Previsão de postagem: {pedido.entrega.previsaoPostagem}.
                    </p>
                  </div>
                )}

                {pedido.status === 'enviado' && (
                  <div className="bg-[#FBEDD9] p-6 rounded-xl space-y-5">
                    <div className="space-y-1.5">
                      <h3 className="font-['Archivo_Black',sans-serif] text-base md:text-lg text-[#3E2417] uppercase">
                        PRÓXIMA PARADA: SUA CASA
                      </h3>
                      <p className="text-xs md:text-sm text-[#3E2417]/90">
                        Postado em {pedido.entrega.dataPostagem} • Correios {pedido.entrega.metodo}
                      </p>
                      <p className="text-xs md:text-sm text-[#3E2417]/90">
                        Prazo: de 5 a 8 dias úteis após a postagem.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                      <div className="space-y-1">
                        <div className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417] tracking-wider">
                          {pedido.entrega.codigoRastreio}
                        </div>
                        <p className="text-xs text-[#80695B]">Código ilustrativo de rastreamento.</p>
                      </div>
                      <button
                        type="button"
                        onClick={copiarCodigoRastreio}
                        className="h-12 px-8 bg-[#3E2417] hover:bg-[#2A180F] text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg transition-colors shrink-0"
                      >
                        {copiado ? 'CÓDIGO COPIADO!' : 'COPIAR CÓDIGO'}
                      </button>
                    </div>

                    <p className="text-xs text-[#80695B]">
                      Novas movimentações podem levar um tempo para aparecer após a postagem.
                    </p>
                  </div>
                )}

                {pedido.status === 'entregue' && (
                  <div className="bg-[#FDE89C] p-6 rounded-xl space-y-5">
                    <div className="space-y-2">
                      <h3 className="font-['Archivo_Black',sans-serif] text-base md:text-lg text-[#3E2417] uppercase">
                        UMA CAIXINHA DE POSSIBILIDADES
                      </h3>
                      <p className="text-xs md:text-sm text-[#3E2417]/90 leading-relaxed">
                        Entrega registrada em {pedido.entrega.dataEntrega}, no endereço informado. Agora é só abrir a caixinha e deixar a criatividade acontecer!
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        to="/videos"
                        className="h-12 px-6 bg-[#3E2417] hover:bg-[#2A180F] text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg flex items-center justify-center transition-colors"
                      >
                        VER VÍDEOS PASSO A PASSO
                      </Link>
                      <Link
                        to="/kits"
                        className="h-12 px-6 border border-[#3E2417] text-[#3E2417] hover:bg-[#3E2417] hover:text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg flex items-center justify-center transition-colors"
                      >
                        CONTINUAR COMPRANDO
                      </Link>
                    </div>
                  </div>
                )}

                {/* LINHA DO TEMPO (Exibida em Aprovado, Preparação e Enviado) */}
                {pedido.status !== 'entregue' && (
                  <section className="space-y-4 pt-2">
                    <h2 className="text-base md:text-lg font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                      {pedido.status === 'enviado' ? 'POR ONDE SUA CAIXINHA ANDA' : 'ÚLTIMAS ATUALIZAÇÕES'}
                    </h2>

                    <div className="divide-y divide-[#C58752]/30">
                      {(pedido.status === 'enviado' ? pedido.entrega.rastreioHistorico : historicoVisivel).map(
                        (item, idx) => (
                          <div key={idx} className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-3 text-xs font-bold text-[#3E2417]">
                              {item.data}
                            </div>
                            <div className="sm:col-span-9 space-y-1">
                              <p className="text-sm font-bold text-[#3E2417]">{item.titulo}</p>
                              <p className="text-xs text-[#80695B]">{item.descricao}</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}

                {/* CARD HORIZONTAL: SUA ENTREGA */}
                <div className="bg-[#FBEDD9] p-6 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="font-['Archivo_Black',sans-serif] text-sm md:text-base text-[#3E2417] uppercase">
                      SUA ENTREGA
                    </h3>
                    <div className="text-xs md:text-sm text-[#3E2417] space-y-1">
                      <p className="font-semibold">{pedido.cliente.nomeCompleto}</p>
                      <p>{pedido.entrega.rua} • {pedido.entrega.complemento}</p>
                      <p>{pedido.entrega.bairro} • {pedido.entrega.cidade}, {pedido.entrega.estado} • CEP {pedido.entrega.cep}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs md:text-sm text-[#3E2417] md:pt-7">
                    <p className="font-semibold">
                      {pedido.entrega.metodo} • {formatarMoeda(pedido.entrega.valorFrete)}
                    </p>
                    {pedido.status === 'enviado' && (
                      <>
                        <p>Postado em {pedido.entrega.dataPostagem} • Prazo de 5 a 8 dias úteis.</p>
                        <p>Código de rastreio enviado por e-mail.</p>
                      </>
                    )}
                    {pedido.status === 'entregue' && (
                      <>
                        <p>Entrega registrada em {pedido.entrega.dataEntregaCurta}.</p>
                        <p>Enviado pelos Correios em {pedido.entrega.dataPostagem}.</p>
                      </>
                    )}
                    {(pedido.status === 'aprovado' || pedido.status === 'preparacao') && (
                      <>
                        <p>{pedido.entrega.prazoTexto}</p>
                        <p>Seu código de rastreio será enviado por e-mail.</p>
                      </>
                    )}
                  </div>
                </div>

                {/* SEÇÃO EXTRA QUANDO ENTREGUE */}
                {pedido.status === 'entregue' && (
                  <section className="space-y-4 pt-2">
                    <h2 className="text-base md:text-lg font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                      PRECISA DE AJUDA COM O QUE CHEGOU?
                    </h2>
                    <p className="text-xs md:text-sm text-[#3E2417]/90 leading-relaxed">
                      Se faltar algum material ou algo não estiver como esperado, fale com a gente e informe o pedido #{pedido.id}.
                      <br />
                      Arrependimento: até 7 dias após o recebimento. Garantia de 90 dias nos kits.
                    </p>
                    <Link
                      to="/contato"
                      className="inline-flex h-11 px-6 border border-[#3E2417] text-[#3E2417] hover:bg-[#3E2417] hover:text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg items-center justify-center transition-colors"
                    >
                      FALE COM A GENTE
                    </Link>
                  </section>
                )}
              </>
            )}

            {/* ---------------------------------------------------------- */}
            {/* TELA 3: ATUALIZAÇÕES DE PAGAMENTO                          */}
            {/* ---------------------------------------------------------- */}
            {telaAtual === 'pagamento' && (
              <>
                {/* CARD ROSA DESTAQUE PAGAMENTO */}
                <div className="bg-[#F7C6E5] p-6 md:p-8 rounded-2xl space-y-5">
                  <div className="space-y-1">
                    <h2 className="font-['Archivo_Black',sans-serif] text-lg md:text-xl text-[#3E2417] uppercase">
                      {pedido.pagamento.statusTexto.toUpperCase()}
                    </h2>
                    <p className="text-xs md:text-sm text-[#3E2417]/90">
                      Tudo certo! Recebemos a confirmação e seu pedido pode seguir para preparação.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end pt-2">
                    <div className="space-y-1">
                      <div className="text-3xl md:text-4xl font-['Archivo_Black',sans-serif] text-[#3E2417]">
                        {formatarMoeda(pedido.totalPago)}
                      </div>
                      <p className="text-xs md:text-sm text-[#3E2417]">{pedido.pagamento.parcelasTexto}</p>
                    </div>
                    <div className="space-y-1 text-xs md:text-sm text-[#3E2417]">
                      <p className="font-bold">{pedido.pagamento.detalhe}</p>
                      <p>Confirmado em {pedido.pagamento.dataConfirmacao}</p>
                      <p>
                        Subtotal {formatarMoeda(pedido.subtotal)} + frete {pedido.entrega.metodo}{' '}
                        {formatarMoeda(pedido.entrega.valorFrete)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* HISTÓRICO DO PAGAMENTO */}
                <section className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="font-['Archivo_Black',sans-serif] text-base md:text-lg text-[#3E2417] uppercase">
                      HISTÓRICO DO PAGAMENTO
                    </h2>
                    <p className="text-xs text-[#80695B]">
                      Atualizações mais recentes primeiro • Horário de Brasília
                    </p>
                  </div>

                  <div className="bg-[#FBEDD9] p-5 md:p-6 rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-125">
                      <thead>
                        <tr className="border-b border-[#C58752]/30 text-[11px] font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                          <th className="pb-3">DATA E HORA</th>
                          <th className="pb-3">ATUALIZAÇÃO</th>
                          <th className="pb-3">DETALHES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#C58752]/20 text-xs md:text-sm text-[#3E2417]">
                        {pedido.pagamento.historico.map((linha, index) => (
                          <tr key={index}>
                            <td className="py-3.5 pr-4 whitespace-nowrap">{linha.dataHora}</td>
                            <td className="py-3.5 pr-4 font-bold whitespace-nowrap">{linha.atualizacao}</td>
                            <td className="py-3.5 text-[#3E2417]/90">{linha.detalhes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* VOCÊ FICA POR DENTRO */}
                <div className="bg-[#FBEDD9] p-6 rounded-xl space-y-3">
                  <h3 className="font-['Archivo_Black',sans-serif] text-base text-[#3E2417] uppercase">
                    VOCÊ FICA POR DENTRO
                  </h3>
                  <p className="text-xs md:text-sm text-[#3E2417]/90 leading-relaxed">
                    Enviamos as mudanças de status para {pedido.cliente.email}. Se não encontrar a mensagem, confira também a caixa de spam.
                  </p>
                  <p className="text-xs md:text-sm text-[#3E2417]/90 leading-relaxed">
                    Sua compra foi aprovada integralmente. As parcelas serão lançadas pela administradora do cartão, conforme o fechamento da sua fatura.
                  </p>
                </div>
              </>
            )}

            {/* ---------------------------------------------------------- */}
            {/* RODAPÉ DA COLUNA ESQUERDA: CARD DE AJUDA                   */}
            {/* ---------------------------------------------------------- */}
            <hr className="border-[#C58752]/30" />

            <div className="p-5 md:p-6 rounded-xl border border-[#C58752]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full border border-[#3E2417]/30 flex items-center justify-center shrink-0 text-[#3E2417]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="font-['Archivo_Black',sans-serif] text-sm text-[#3E2417] uppercase">
                    PRECISA DE UMA MÃOZINHA?
                  </h3>
                  <p className="text-xs md:text-sm text-[#3E2417]/90">
                    oi@ministitches.com.br • Seg a sex, 9h às 18h
                  </p>
                </div>
              </div>
              <Link
                to="/contato"
                className="text-xs md:text-sm font-medium text-[#3E2417] underline hover:text-[#602D15] shrink-0"
              >
                Fale com a gente
              </Link>
            </div>

            {/* BOTÕES INFERIORES NA TELA DE PAGAMENTO */}
            {telaAtual === 'pagamento' && (
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setTelaAtual('acompanhamento')}
                  className="h-12 px-6 bg-[#3E2417] hover:bg-[#2A180F] text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg transition-colors"
                >
                  ACOMPANHAR PEDIDO
                </button>
                <button
                  type="button"
                  onClick={() => setTelaAtual('confirmacao')}
                  className="h-12 px-6 border border-[#3E2417] text-[#3E2417] hover:bg-[#3E2417] hover:text-white font-['Archivo_Black',sans-serif] text-xs uppercase rounded-lg transition-colors"
                >
                  VOLTAR À CONFIRMAÇÃO
                </button>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* COLUNA DA DIREITA: RESUMO FIXO DO PEDIDO (5 COLUNAS)           */}
          {/* ============================================================== */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">
            <div className="bg-[#FDE89C] p-6 md:p-7 rounded-2xl space-y-5">
              
              {/* Cabeçalho */}
              <div className="flex items-center justify-between border-b border-[#C58752]/30 pb-4">
                <h2 className="text-lg font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                  SEU PEDIDO
                </h2>
                <span className="text-xs md:text-sm text-[#3E2417]">
                  {pedido.itens.length} itens
                </span>
              </div>

              {/* Lista de Itens */}
              <div className="divide-y divide-[#C58752]/30">
                {pedido.itens.map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 space-y-1.5">
                    <h3 className="font-['Archivo_Black',sans-serif] text-xs md:text-sm text-[#3E2417] uppercase">
                      {item.nome}
                    </h3>
                    <p className="text-xs text-[#80695B]">{item.detalhe}</p>
                    <div className="flex items-center justify-between text-xs md:text-sm pt-1">
                      <span className="text-[#3E2417]">Quantidade: {item.quantidade}</span>
                      <span className="font-['Archivo_Black',sans-serif] text-[#3E2417]">
                        {formatarMoeda(item.preco)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <hr className="border-[#C58752]/30" />

              {/* Subtotal, Frete e Pagamento */}
              <div className="space-y-3 text-xs md:text-sm text-[#3E2417]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatarMoeda(pedido.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frete • {pedido.entrega.metodo}</span>
                  <span>{formatarMoeda(pedido.entrega.valorFrete)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pagamento</span>
                  <span>{pedido.pagamento.metodo}</span>
                </div>
              </div>

              <hr className="border-[#C58752]/30" />

              {/* Total Pago */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-['Archivo_Black',sans-serif] text-sm md:text-base text-[#3E2417] uppercase">
                    TOTAL PAGO
                  </span>
                  <span className="font-['Archivo_Black',sans-serif] text-2xl md:text-3xl text-[#3E2417]">
                    {formatarMoeda(pedido.totalPago)}
                  </span>
                </div>
                <p className="text-xs text-[#3E2417]/80">
                  {pedido.pagamento.parcelasTexto}, com frete incluído.
                </p>
              </div>

              {/* Box Mensagem da Marca */}
              <div className="bg-[#FEF8F0] p-4 rounded-lg flex items-center gap-3 text-xs md:text-sm text-[#3E2417]">
                <span className="text-base shrink-0">♡</span>
                <p className="leading-snug">
                  Uma caixinha de possibilidades, preparada com carinho para você criar longe das telas.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}