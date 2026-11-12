import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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

const enderecoTemDadosValidos = (endereco) => {
  if (!endereco || typeof endereco !== 'object') return false;

  return Object.entries(endereco).some(([chave, valor]) => {
    if (['principal'].includes(chave)) return false;
    if (typeof valor === 'string') return valor.trim().length > 0;
    return Boolean(valor);
  });
};

export default function FinalizarCompra() {
  // Estados de UI e Controle
  const [pagamento, setPagamento] = useState('cartao');
  const [cep, setCep] = useState('');
  const [freteCalculado, setFreteCalculado] = useState(false);
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

        setCep(enderecoAtual.cep);
      } catch (error) {
        console.error('Não foi possível carregar o perfil do usuário:', error);
      }
    };

    const carregarCarrinho = async () => {
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

  const subtotal = cartItems.reduce(
    (total, item) => total + Number(item.preco || 0) * Number(item.quantidade || 0),
    0,
  );
  const quantidadeTotalItens = cartItems.reduce(
    (total, item) => total + Number(item.quantidade || 0),
    0,
  );
  const pixTotal = Math.round(subtotal * 0.95);
  const valorPedido = subtotal / 100;
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
          setResultado({ tipo: 'pix', dados: json });
        } else {
          throw new Error(json.mensagem || 'Erro ao processar Pix');
        }
      }

      // 2. PAGAMENTO BOLETO
      else if (pagamento === 'boleto') {
        if (!email || !email.includes('@')) throw new Error('E-mail inválido.');
        if (cpfLimpo.length !== 11) throw new Error('CPF inválido.');

        const resposta = await fetch('/api/pagamento/boleto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valorTotal: valorPedido,
            email,
            cpf: cpfLimpo,
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
          setResultado({ tipo: 'boleto', dados: json });
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
          setResultado({ tipo: 'sucesso', dados: json });
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
                    <input required type="text" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm" />
                  </div>
                  <button type="button" onClick={() => setFreteCalculado(true)} className="h-12 px-6 rounded-md border-2 border-[#3E2417] text-[#3E2417] font-bold text-sm uppercase hover:bg-[#3E2417] hover:text-white transition-colors">
                    CALCULAR FRETE
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
                      <option value="SP">SP</option>
                      <option value="RJ">RJ</option>
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
                <div className="flex justify-between items-center gap-3">
                  <span className="font-['Archivo_Black',sans-serif] text-[13px] uppercase text-[#3E2417]">TOTAL</span>
                  <span className="font-['Archivo_Black',sans-serif] text-2xl text-[#3E2417]">
                    {carregandoCarrinho ? 'Carregando...' : pagamento === 'pix' ? formatarPreco(pixTotal) : formatarPreco(subtotal)}
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
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <button
                    type="submit"
                    disabled={loading || carregandoCarrinho || !cartItems.length}
                    className="w-full bg-[#3E2417] hover:bg-[#2A180F] disabled:opacity-50 text-white font-['Archivo_Black',sans-serif] text-sm py-4 rounded-lg transition-colors uppercase flex items-center justify-center gap-2"
                  >
                    <span>
                      {carregandoCarrinho
                        ? 'CARREGANDO CARRINHO...'
                        : loading
                          ? 'PROCESSANDO...'
                          : 'FINALIZAR PEDIDO'}
                    </span>
                    {!loading && !carregandoCarrinho && cartItems.length > 0 && <span>→</span>}
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