import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

const formatarPreco = (valorEmCentavos) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valorEmCentavos || 0) / 100);

const formatarTelefone = (valor) => {
  const digits = String(valor || '').replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : `(${a})`,
    );
  }

  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) =>
    c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`,
  );
};

const detectarBandeiraCartao = (numeroCartao) => {
  const digitos = String(numeroCartao || '').replace(/\D/g, '');

  if (/^4/.test(digitos)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digitos)) return 'master';
  if (/^3[47]/.test(digitos)) return 'amex';
  if (/^(636368|438935|504175|451416|509048|509067|509069|509074|509075|627780|636297|636369|636368)/.test(digitos)) return 'elo';
  if (/^6011|^65|^64[4-9]/.test(digitos)) return 'discover';
  return 'master';
};

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const formatarCep = (valor) => {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
};

const formatarPrazo = ({ prazoMin, prazoMax }) => {
  const plural = (n) => `${n} dia${n === 1 ? '' : 's'} úte${n === 1 ? 'l' : 'is'}`;
  return prazoMax > prazoMin ? `${prazoMin} a ${plural(prazoMax)}` : plural(prazoMin);
};

const enderecoTemDadosValidos = (endereco) => {
  if (!endereco || typeof endereco !== 'object') return false;

  return Object.entries(endereco).some(([chave, valor]) => {
    if (['principal'].includes(chave)) return false;
    if (typeof valor === 'string') return valor.trim().length > 0;
    return Boolean(valor);
  });
};

export default function FinalizarCompra() {
  const location = useLocation();
  const pedidoPendente = location.state?.pedido || null;
  // Estados de UI e Controle
  const [pagamento, setPagamento] = useState('cartao');
  const [cep, setCep] = useState('');
  const [opcoesFrete, setOpcoesFrete] = useState([]);
  const [freteSelecionadoId, setFreteSelecionadoId] = useState(null);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [erroFrete, setErroFrete] = useState('');
  const ultimaCotacaoRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null); // Armazena sucesso, QR code, Link Boleto
  const [mpInstance, setMpInstance] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [carregandoCarrinho, setCarregandoCarrinho] = useState(true);
  const [erroCarrinho, setErroCarrinho] = useState('');
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  // Estados do Formulário
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    celular: '',
    // Endereço
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    // Cartão
    numeroCartao: '',
    nomeCartao: '',
    validade: '',
    cvv: '',
    cpfTitular: '',
    parcelas: '1',
    bandeira: ''
  });

  // Inicializa o Mercado Pago ao montar o componente
  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        const resposta = await fetch('/api/perfil', { credentials: 'include' });
        if (!resposta.ok) return;

        const dados = await resposta.json();
        const usuario = dados.usuario || {};
        const enderecos = Array.isArray(usuario.enderecos) ? usuario.enderecos : [];
        const enderecoPrincipal =
          enderecos.find((item) => item?.principal && enderecoTemDadosValidos(item)) ||
          enderecos.find((item) => enderecoTemDadosValidos(item)) ||
          null;

        const enderecoAtual = enderecoPrincipal && enderecoTemDadosValidos(enderecoPrincipal)
          ? {
              endereco: enderecoPrincipal.rua || '',
              numero: enderecoPrincipal.numero || '',
              complemento: enderecoPrincipal.complemento || '',
              bairro: enderecoPrincipal.bairro || '',
              cidade: enderecoPrincipal.cidade || '',
              estado: enderecoPrincipal.estado || '',
              cep: enderecoPrincipal.cep || '',
            }
          : {
              endereco: '',
              numero: '',
              complemento: '',
              bairro: '',
              cidade: '',
              estado: '',
              cep: '',
            };

        setFormData((prev) => ({
          ...prev,
          nome: usuario.nome || prev.nome,
          cpf: usuario.cpf || prev.cpf,
          email: usuario.email || prev.email,
          celular: formatarTelefone(usuario.telefone || prev.celular),
          endereco: enderecoAtual.endereco,
          numero: enderecoAtual.numero,
          complemento: enderecoAtual.complemento,
          bairro: enderecoAtual.bairro,
          cidade: enderecoAtual.cidade,
          estado: enderecoAtual.estado,
        }));

        setCep(formatarCep(enderecoAtual.cep));
      } catch (error) {
        console.error('Não foi possível carregar o perfil do usuário:', error);
      }
    };

    const carregarCarrinho = async () => {
      if (pedidoPendente) {
        setCartItems(
          (pedidoPendente.itens || []).map((item) => ({
            nome: item.nome,
            slug: item.slug,
            quantidade: item.quantidade,
            preco: item.precoUnit,
          })),
        );
        setCarregandoCarrinho(false);
        return;
      }

      try {
        const resposta = await fetch('/api/carrinho', { credentials: 'include' });
        const dados = await resposta.json();
        if (!resposta.ok) {
          throw new Error(dados.erro || 'Não foi possível carregar o carrinho.');
        }
        setCartItems(dados.itens || []);
      } catch (erro) {
        setErroCarrinho(erro.message || 'Não foi possível carregar o carrinho.');
      } finally {
        setCarregandoCarrinho(false);
      }
    };

    const inicializarMercadoPago = async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.publicKey && window.MercadoPago) {
          setMpInstance(new window.MercadoPago(data.publicKey));
        } else {
          console.error('Public Key não encontrada ou SDK do MP não carregado.');
        }
      } catch (err) {
        console.error('Erro ao carregar a Public Key do Mercado Pago:', err);
      }
    };

    carregarPerfil();
    carregarCarrinho();
    inicializarMercadoPago();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manipulador de inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const salvarEnderecoPrincipal = async () => {
    const cepLimpo = cep.replace(/\D/g, '');
    const dadosEndereco = {
      apelido: 'Checkout',
      rua: formData.endereco.trim(),
      numero: formData.numero.trim(),
      complemento: formData.complemento.trim(),
      bairro: formData.bairro.trim(),
      cidade: formData.cidade.trim(),
      estado: formData.estado.trim(),
      cep: cepLimpo,
      principal: true,
    };

    if (!dadosEndereco.rua || !dadosEndereco.numero || !dadosEndereco.bairro || !dadosEndereco.cidade || !dadosEndereco.estado || !dadosEndereco.cep) {
      alert('Preencha os dados do endereço antes de salvar.');
      return;
    }

    try {
      setSalvandoEndereco(true);
      const resposta = await fetch('/perfil/enderecos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosEndereco),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro || 'Não foi possível salvar o endereço.');
      }

      alert('Endereço salvo como principal.');
    } catch (erro) {
      alert(erro.message || 'Não foi possível salvar o endereço.');
    } finally {
      setSalvandoEndereco(false);
    }
  };

  const limparFrete = () => {
    // Invalida qualquer cotação ainda em andamento para um CEP anterior.
    ultimaCotacaoRef.current += 1;
    setCalculandoFrete(false);
    setOpcoesFrete([]);
    setFreteSelecionadoId(null);
    setErroFrete('');
  };

  const preencherEnderecoPeloCep = async (cepLimpo) => {
    try {
      const resposta = await fetch(`/api/cep/${cepLimpo}`);
      if (!resposta.ok) return;
      const { endereco } = await resposta.json();
      if (!endereco) return;

      // Só completa campos vazios para não apagar o que o cliente digitou.
      setFormData((prev) => ({
        ...prev,
        endereco: prev.endereco || endereco.rua || '',
        bairro: prev.bairro || endereco.bairro || '',
        cidade: prev.cidade || endereco.cidade || '',
        estado: prev.estado || endereco.estado || '',
      }));
    } catch {
      // Preenchimento automático é opcional; o cliente pode digitar.
    }
  };

  const calcularFrete = async (cepInformado = cep) => {
    const cepLimpo = String(cepInformado).replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      limparFrete();
      setErroFrete('Informe um CEP com 8 dígitos.');
      return;
    }

    limparFrete();
    const idCotacao = ultimaCotacaoRef.current;
    setCalculandoFrete(true);
    preencherEnderecoPeloCep(cepLimpo);

    try {
      const resposta = await fetch('/api/frete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cep: cepLimpo,
          ...(pedidoPendente?.numero && { pedidoNumero: pedidoPendente.numero }),
        }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (idCotacao !== ultimaCotacaoRef.current) return;

      if (!resposta.ok) {
        throw new Error(dados.erro || 'Não foi possível calcular o frete.');
      }

      const opcoes = Array.isArray(dados.opcoes) ? dados.opcoes : [];
      setOpcoesFrete(opcoes);
      // A API já devolve ordenado do mais barato para o mais caro.
      setFreteSelecionadoId(opcoes[0]?.servicoId ?? null);
    } catch (erro) {
      if (idCotacao !== ultimaCotacaoRef.current) return;
      setErroFrete(erro.message || 'Não foi possível calcular o frete.');
    } finally {
      if (idCotacao === ultimaCotacaoRef.current) {
        setCalculandoFrete(false);
      }
    }
  };

  const handleCepChange = (e) => {
    const novoCep = formatarCep(e.target.value);
    setCep(novoCep);
    limparFrete();
    if (novoCep.replace(/\D/g, '').length === 8) {
      calcularFrete(novoCep);
    }
  };

  // Calcula o frete automaticamente quando o CEP já está preenchido ao abrir
  // a tela (por exemplo, vindo do endereço principal do perfil).
  const freteAutoCalculadoRef = useRef(false);
  useEffect(() => {
    if (freteAutoCalculadoRef.current) return;
    if (cep.replace(/\D/g, '').length !== 8) return;
    if (carregandoCarrinho) return;
    if (opcoesFrete.length || calculandoFrete) return;

    freteAutoCalculadoRef.current = true;
    const id = setTimeout(() => calcularFrete(cep), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, carregandoCarrinho, opcoesFrete.length, calculandoFrete]);

  const subtotal = cartItems.reduce(
    (total, item) => total + Number(item.preco || 0) * Number(item.quantidade || 0),
    0,
  );
  const quantidadeTotalItens = cartItems.reduce(
    (total, item) => total + Number(item.quantidade || 0),
    0,
  );
  const freteSelecionado =
    opcoesFrete.find((opcao) => opcao.servicoId === freteSelecionadoId) || null;
  const valorFrete = freteSelecionado ? Number(freteSelecionado.preco || 0) : 0;
  const totalComFrete = subtotal + valorFrete;
  const pixTotal = Math.round(totalComFrete * 0.95);
  const valorPedido = totalComFrete / 100;
  const opcoesParcelamento = Array.from({ length: 6 }, (_, index) => {
    const parcela = index + 1;
    const valorParcela = Number((valorPedido / parcela).toFixed(2));

    return {
      parcela,
      valorParcela,
      label: `${parcela}x de ${formatarPreco(valorParcela * 100)} sem juros`,
      value: String(parcela),
    };
  });

  // Registra o pedido no servidor depois que o pagamento foi criado, para ele
  // aparecer em "Meus pedidos". O pagamento já existe neste ponto, então uma
  // falha aqui não pode esconder o QR Code / boleto do cliente.
  const registrarPedido = async (pagamentoId) => {
    try {
      const resposta = await fetch('/api/pedidos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagamentoId: String(pagamentoId),
          freteCentavos: valorFrete,
          cliente: { nome: formData.nome.trim(), email: formData.email.trim() },
          entrega: {
            cep: cep.replace(/\D/g, ''),
            endereco: [
              `${formData.endereco.trim()}, ${formData.numero.trim()}`,
              formData.complemento.trim(),
              formData.bairro.trim(),
              `${formData.cidade.trim()}/${formData.estado}`,
            ]
              .filter(Boolean)
              .join(' - '),
          },
          ...(pedidoPendente?.numero && { pedidoNumero: pedidoPendente.numero }),
        }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(dados.erro || 'Não foi possível registrar o pedido.');
      }
      return { pedido: dados.pedido };
    } catch (erro) {
      console.error('Falha ao registrar o pedido:', erro);
      return { erroPedido: erro.message || 'Não foi possível registrar o pedido.' };
    }
  };

  // Processamento do Pagamento
  const handleFinalizarPedido = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResultado(null);

    const { email, cpf, endereco, numero, bairro, cidade, estado, nome } = formData;
    const cpfLimpo = cpf.replace(/\D/g, '');
    const nomeCompleto = nome.trim();
    const partesNome = nomeCompleto.split(/\s+/).filter(Boolean);
    const primeiroNome = partesNome[0] || 'Cliente';
    const sobrenome = partesNome.slice(1).join(' ') || '';

    if (!cartItems.length || subtotal <= 0) {
      alert('Seu carrinho está vazio.');
      setLoading(false);
      return;
    }

    if (!freteSelecionado) {
      alert('Calcule e escolha uma opção de frete antes de finalizar.');
      setLoading(false);
      return;
    }

    try {
      // 1. PAGAMENTO PIX
      if (pagamento === 'pix') {
        if (!email || !email.includes('@')) throw new Error('E-mail inválido.');
        if (cpfLimpo.length !== 11) throw new Error('CPF inválido.');

        const resposta = await fetch('/api/pagamento/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valorOriginal: valorPedido,
            email,
            cpf: cpfLimpo,
            nome: primeiroNome,
            sobrenome,
          }),
        });
        const json = await resposta.json();

        if (json.sucesso) {
          setResultado({ tipo: 'pix', dados: json, ...(await registrarPedido(json.id_pagamento)) });
        } else {
          throw new Error(json.mensagem || 'Erro ao processar Pix');
        }
      }

      // 2. PAGAMENTO BOLETO
      else if (pagamento === 'boleto') {
        if (!email || !email.includes('@')) throw new Error('E-mail inválido.');
        if (cpfLimpo.length !== 11) throw new Error('CPF inválido.');

        const nomeCompleto = String(formData.nome || '').trim();
        const partesNome = nomeCompleto.split(/\s+/).filter(Boolean);

        if (partesNome.length < 2) {
          throw new Error('Informe nome e sobrenome para gerar o boleto.');
        }

        const resposta = await fetch('/api/pagamento/boleto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valorTotal: valorPedido,
            email,
            cpf: cpfLimpo,
            nomeCompleto,
            endereco: {
              cep: cep.replace(/\D/g, ''),
              rua: endereco,
              numero,
              bairro,
              cidade,
              estado,
            },
          }),
        });
        const json = await resposta.json();

        if (json.sucesso) {
          setResultado({ tipo: 'boleto', dados: json, ...(await registrarPedido(json.id_pagamento)) });
        } else {
          throw new Error(json.mensagem || 'Erro ao processar Boleto');
        }
      }

      // 3. PAGAMENTO CARTÃO
      else if (pagamento === 'cartao') {
        if (!mpInstance) throw new Error('Mercado Pago não inicializado.');

        const { numeroCartao, nomeCartao, validade, cvv, parcelas, cpfTitular } = formData;
        const [month, year] = validade.split('/');
        const fullYear = year?.length === 2 ? `20${year}` : year;
        const cpfTitularLimpo = cpfTitular.replace(/\D/g, '');
        const bandeiraDetectada = detectarBandeiraCartao(numeroCartao);

        // Criar Token do Cartão
        const cardToken = await mpInstance.createCardToken({
          cardNumber: numeroCartao.replace(/\s+/g, ''),
          cardholderName: nomeCartao,
          cardExpirationMonth: month,
          cardExpirationYear: fullYear,
          securityCode: cvv,
          identification: { type: 'CPF', number: cpfTitularLimpo },
        });

        if (!cardToken || !cardToken.id) {
          throw new Error('Falha ao validar os dados do cartão.');
        }

        const resposta = await fetch('/api/pagamento/cartao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: cardToken.id,
            payment_method_id: formData.bandeira || bandeiraDetectada,
            valorTotal: valorPedido,
            parcelas,
            email,
            cpf: cpfLimpo,
          }),
        });
        const json = await resposta.json();

        if (json.sucesso && json.status === 'approved') {
          setResultado({ tipo: 'sucesso', dados: json, ...(await registrarPedido(json.id_pagamento)) });
        } else {
          throw new Error(json.mensagem || 'Pagamento recusado.');
        }
      }
    } catch (erro) {
      alert(erro.message || 'Ocorreu um erro ao processar o pagamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#FEF8F0] min-h-screen font-['Work_Sans',sans-serif] text-[#3E2417] py-8 px-4 md:px-12 lg:px-24">
      <form onSubmit={handleFinalizarPedido} className="max-w-7xl mx-auto space-y-8">
        
        {/* NAVEGAÇÃO SUPERIOR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs md:text-sm font-medium">
          <Link to="/carrinho" className="flex items-center gap-2 text-[#3E2417] hover:text-[#602D15] transition-colors">
            <span>←</span> Voltar ao carrinho
          </Link>
          
          <div className="flex items-center gap-2 text-[#80695B]">
            <Link to="/carrinho" className="hover:underline">Carrinho</Link>
            <span>›</span>
            <span className="font-bold text-[#3E2417]">Dados e pagamento</span>
            <span>›</span>
            <span>Confirmação</span>
          </div>
        </div>

        {/* CABEÇALHO DO CHECKOUT */}
        <div className="border-b border-[#C58752]/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase tracking-tight">
              FINALIZAR COMPRA
            </h1>
            <p className="text-sm md:text-base text-[#3E2417]/90">
              Falta pouco para começar a criar. Preencha seus dados e escolha como pagar.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs md:text-sm text-[#3E2417] font-medium bg-transparent px-4 py-2 rounded-full border border-[#C58752]/60 self-start md:self-auto">
            <span>🔒</span> Ambiente seguro
          </div>
        </div>

        {erroCarrinho && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erroCarrinho}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* COLUNA DA ESQUERDA: FORMULÁRIOS */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-12">
            
            {/* ETAPA 1: SEUS DADOS */}
            <section className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] font-bold text-sm flex items-center justify-center">1</span>
                  <h2 className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">SEUS DADOS</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 ml-0 lg:ml-11">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">Nome completo *</label>
                  <input required name="nome" value={formData.nome} onChange={handleChange} type="text" placeholder="Como está no seu documento" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">CPF *</label>
                  <input required name="cpf" value={formData.cpf} onChange={handleChange} type="text" placeholder="000.000.000-00" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">E-mail *</label>
                  <input required name="email" value={formData.email} onChange={handleChange} type="email" placeholder="seu@email.com" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">Celular *</label>
                  <input required name="celular" value={formData.celular} onChange={handleChange} type="tel" placeholder="(00) 00000-0000" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                </div>
              </div>
            </section>

            <hr className="border-[#C58752]/20" />

            {/* ETAPA 2: ENDEREÇO */}
            <section className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] font-bold text-sm flex items-center justify-center">2</span>
                  <h2 className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">ONDE VAMOS ENTREGAR?</h2>
                </div>
              </div>

              <div className="space-y-5 ml-0 lg:ml-11">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-full sm:w-56 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">CEP *</label>
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={cep}
                      onChange={handleCepChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          calcularFrete();
                        }
                      }}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => calcularFrete()}
                    disabled={calculandoFrete || carregandoCarrinho || !cartItems.length}
                    className="h-12 px-6 rounded-md border-2 border-[#3E2417] text-[#3E2417] font-bold text-sm uppercase hover:bg-[#3E2417] hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {calculandoFrete ? 'CALCULANDO...' : 'CALCULAR FRETE'}
                  </button>
                  <button
                    type="button"
                    onClick={salvarEnderecoPrincipal}
                    disabled={salvandoEndereco || !formData.endereco || !formData.numero || !formData.bairro || !formData.cidade || !formData.estado || !cep}
                    className="h-12 px-6 rounded-md bg-[#3E2417] text-white font-bold text-xs uppercase hover:bg-[#2A180F] disabled:opacity-50 transition-colors"
                  >
                    {salvandoEndereco ? 'SALVANDO...' : 'SALVAR ENDEREÇO'}
                  </button>
                </div>

                {erroFrete && (
                  <p role="alert" className="text-sm text-red-700">{erroFrete}</p>
                )}

                {opcoesFrete.length > 0 && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-[#3E2417] mb-2">Escolha a entrega *</legend>
                    {opcoesFrete.map((opcao) => {
                      const selecionada = opcao.servicoId === freteSelecionadoId;
                      return (
                        <label
                          key={opcao.servicoId}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selecionada ? 'bg-[#FBEDD9] border-2 border-[#3E2417]' : 'bg-white border-[#C58752]/50'}`}
                        >
                          <input
                            type="radio"
                            name="frete"
                            value={opcao.servicoId}
                            checked={selecionada}
                            onChange={() => setFreteSelecionadoId(opcao.servicoId)}
                            className="accent-[#3E2417]"
                          />
                          {opcao.logo && <img src={opcao.logo} alt="" className="h-6 w-auto max-w-16 object-contain" />}
                          <span className="flex-1 text-sm">
                            <span className="font-bold">{opcao.transportadora} · {opcao.servico}</span>
                            <span className="block text-xs text-[#80695B]">Chega em {formatarPrazo(opcao)}</span>
                          </span>
                          <span className="font-bold text-sm">{formatarPreco(opcao.preco)}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-6 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">Endereço *</label>
                    <input required name="endereco" value={formData.endereco} onChange={handleChange} type="text" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">Número *</label>
                    <input required name="numero" value={formData.numero} onChange={handleChange} type="text" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">Complemento</label>
                    <input name="complemento" value={formData.complemento} onChange={handleChange} type="text" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">Bairro *</label>
                    <input required name="bairro" value={formData.bairro} onChange={handleChange} type="text" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                  </div>
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">Cidade *</label>
                    <input required name="cidade" value={formData.cidade} onChange={handleChange} type="text" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">Estado *</label>
                    <select required name="estado" value={formData.estado} onChange={handleChange} className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm text-[#3E2417]">
                      <option value="">UF</option>
                      {UFS.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-[#C58752]/20" />

            {/* ETAPA 3: PAGAMENTO */}
            <section className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] font-bold text-sm flex items-center justify-center">3</span>
                  <h2 className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">COMO VOCÊ PREFERE PAGAR?</h2>
                </div>
              </div>

              <div className="space-y-6 ml-0 lg:ml-11">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Botões de Seleção Pix/Cartão/Boleto mantidos iguais... */}
                  <button type="button" onClick={() => setPagamento('pix')} className={`p-4 rounded-lg text-left border flex items-center justify-between transition-all ${pagamento === 'pix' ? 'bg-[#FBEDD9] border-2 border-[#3E2417]' : 'bg-white border-[#C58752]/50'}`}>
                    <div className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417]">PIX</div>
                  </button>
                  <button type="button" onClick={() => setPagamento('cartao')} className={`p-4 rounded-lg text-left border flex items-center justify-between transition-all ${pagamento === 'cartao' ? 'bg-[#FBEDD9] border-2 border-[#3E2417]' : 'bg-white border-[#C58752]/50'}`}>
                    <div className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417]">CARTÃO DE CRÉDITO</div>
                  </button>
                  <button type="button" onClick={() => setPagamento('boleto')} className={`p-4 rounded-lg text-left border flex items-center justify-between transition-all ${pagamento === 'boleto' ? 'bg-[#FBEDD9] border-2 border-[#3E2417]' : 'bg-white border-[#C58752]/50'}`}>
                    <div className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417]">BOLETO</div>
                  </button>
                </div>

                {/* FORM CARTÃO */}
                {pagamento === 'cartao' && (
                  <div className="space-y-5 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">Número do cartão *</label>
                        <input required={pagamento === 'cartao'} name="numeroCartao" value={formData.numeroCartao} onChange={handleChange} type="text" placeholder="0000 0000 0000 0000" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">Nome impresso no cartão *</label>
                        <input required={pagamento === 'cartao'} name="nomeCartao" value={formData.nomeCartao} onChange={handleChange} type="text" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">Validade *</label>
                        <input required={pagamento === 'cartao'} name="validade" value={formData.validade} onChange={handleChange} type="text" placeholder="MM/AA" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">CVV *</label>
                        <input required={pagamento === 'cartao'} name="cvv" value={formData.cvv} onChange={handleChange} type="text" maxLength="4" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">CPF do titular *</label>
                        <input required={pagamento === 'cartao'} name="cpfTitular" value={formData.cpfTitular} onChange={handleChange} type="text" placeholder="000.000.000-00" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Parcelamento *</label>
                      <select
                        required={pagamento === 'cartao'}
                        name="parcelas"
                        value={formData.parcelas}
                        onChange={handleChange}
                        className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm"
                      >
                        {opcoesParcelamento.map((opcao) => (
                          <option key={opcao.parcela} value={String(opcao.parcela)}>
                            {opcao.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* COLUNA DA DIREITA: RESUMO E BOTÃO FINALIZAR */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8 space-y-6">
            
            <div className="bg-[#FDE89C] p-6 rounded-[1.25rem] space-y-6">
              <div className="flex items-center justify-between border-b border-[#3E2417]/10 pb-4">
                <h2 className="text-[1.1rem] font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase tracking-wide">SEU PEDIDO</h2>
                <span className="text-xs font-medium text-[#3E2417]/80">
                  {carregandoCarrinho ? '...' : `${quantidadeTotalItens} item${quantidadeTotalItens === 1 ? '' : 's'}`}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-3 text-sm">
                  <span>Subtotal</span>
                  <span>{carregandoCarrinho ? '...' : formatarPreco(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-3 text-sm">
                  <span>Frete</span>
                  <span>
                    {calculandoFrete
                      ? 'Calculando...'
                      : freteSelecionado
                        ? formatarPreco(valorFrete)
                        : 'Calcule pelo CEP'}
                  </span>
                </div>
                {pagamento === 'pix' && freteSelecionado && (
                  <div className="flex justify-between items-center gap-3 text-sm text-green-800">
                    <span>Desconto Pix (5%)</span>
                    <span>− {formatarPreco(totalComFrete - pixTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-3 border-t border-[#3E2417]/10 pt-3">
                  <span className="font-['Archivo_Black',sans-serif] text-[13px] uppercase text-[#3E2417]">TOTAL</span>
                  <span className="font-['Archivo_Black',sans-serif] text-2xl text-[#3E2417]">
                    {carregandoCarrinho ? 'Carregando...' : pagamento === 'pix' ? formatarPreco(pixTotal) : formatarPreco(totalComFrete)}
                  </span>
                </div>
              </div>

              {/* RENDERIZAÇÃO DO RESULTADO (Substitui o botão após o envio) */}
              {resultado ? (
                <div className="bg-white p-4 rounded-xl text-center space-y-4 shadow-sm border border-green-200">
                  {resultado.tipo === 'pix' && (
                    <>
                      <h4 className="text-green-700 font-bold text-sm">QR Code Pix Gerado!</h4>
                      <img src={`data:image/jpeg;base64,${resultado.dados.qr_code_base64}`} alt="QR Code Pix" className="mx-auto w-40 h-40" />
                      <input type="text" value={resultado.dados.qr_code_pix} readOnly className="w-full p-2 text-[10px] border rounded" />
                      <button type="button" onClick={() => navigator.clipboard.writeText(resultado.dados.qr_code_pix)} className="w-full bg-[#27ae60] text-white text-xs font-bold py-3 rounded-lg">
                        Copiar Código Pix
                      </button>
                    </>
                  )}
                  {resultado.tipo === 'boleto' && (
                    <>
                      <h4 className="text-green-700 font-bold text-sm">Boleto Gerado!</h4>
                      <p className="text-[10px] break-all bg-gray-50 p-2 rounded">{resultado.dados.codigo_de_barras}</p>
                      <a href={resultado.dados.link_boleto_pdf} target="_blank" rel="noreferrer" className="block w-full bg-[#27ae60] text-white text-xs font-bold py-3 rounded-lg mt-2">
                        Imprimir / Visualizar PDF
                      </a>
                    </>
                  )}
                  {resultado.tipo === 'sucesso' && (
                    <>
                      <h4 className="text-green-700 font-bold text-lg">Pagamento Aprovado! 🎉</h4>
                      <p className="text-xs text-[#3E2417]">Seu pedido já está sendo processado.</p>
                    </>
                  )}
                  {resultado.pedido && (
                    <p className="text-xs text-[#3E2417] border-t border-[#3E2417]/10 pt-3">
                      Pedido <span className="font-bold">{resultado.pedido.numero}</span> registrado.{' '}
                      <Link to="/perfil" className="font-bold underline">Ver em Meus pedidos</Link>
                    </p>
                  )}
                  {resultado.erroPedido && (
                    <p role="alert" className="text-xs text-red-700 border-t border-[#3E2417]/10 pt-3">
                      O pagamento foi gerado, mas não conseguimos registrar o pedido ({resultado.erroPedido}). Guarde o código {resultado.dados.id_pagamento} e fale com a gente.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <button
                    type="submit"
                    disabled={loading || carregandoCarrinho || calculandoFrete || !cartItems.length || !freteSelecionado}
                    className="w-full bg-[#3E2417] hover:bg-[#2A180F] disabled:opacity-50 text-white font-['Archivo_Black',sans-serif] text-sm py-4 rounded-lg transition-colors uppercase flex items-center justify-center gap-2"
                  >
                    <span>
                      {carregandoCarrinho
                        ? 'CARREGANDO CARRINHO...'
                        : loading
                          ? 'PROCESSANDO...'
                          : freteSelecionado
                            ? 'FINALIZAR PEDIDO'
                            : 'CALCULE O FRETE'}
                    </span>
                    {!loading && !carregandoCarrinho && cartItems.length > 0 && freteSelecionado && <span>→</span>}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}