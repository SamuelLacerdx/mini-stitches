import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Perfil() {
  // Estado para os Dados Pessoais
  const [dadosPessoais, setDadosPessoais] = useState({
    nome: 'Samuel Lima',
    email: 'sam@exemplo.com',
    celular: '(11) 97234-3678',
    cpf: '000.000.000-00',
    dataNascimento: ''
  });

  // Estados para controlo da exibição dos formulários
  const [exibirFormEndereco, setExibirFormEndereco] = useState(false);
  const [exibirFormCartao, setExibirFormCartao] = useState(false);

  // Estado para novo endereço
  const [novoEndereco, setNovoEndereco] = useState({
    apelido: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    principal: false
  });

  // Estado para novo cartão
  const [novoCartao, setNovoCartao] = useState({
    numero: '',
    nome: '',
    validade: '',
    principal: false
  });

  // Manipuladores de submissão
  const handleSalvarDados = (e) => {
    e.preventDefault();
    alert('Dados pessoais atualizados com sucesso!');
  };

  const handleSalvarEndereco = (e) => {
    e.preventDefault();
    alert('Novo endereço guardado!');
    setExibirFormEndereco(false);
  };

  const handleSalvarCartao = (e) => {
    e.preventDefault();
    alert('Novo cartão adicionado!');
    setExibirFormCartao(false);
  };

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] px-4 py-8 md:px-12 md:py-12 text-[#3E2417] font-['Work_Sans']">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Cabecalho da Página */}
        <div className="flex justify-between items-center border-b border-orange-200/60 pb-4">
          <h1 className="text-3xl md:text-4xl font-['Archivo_Black'] text-[#3E2417]">
            MINHA CONTA
          </h1>
          <Link to="/conta" className="text-amber-800 text-sm font-semibold underline hover:opacity-80">
            Sair
          </Link>
        </div>

        {/* SECÇÃO 1: MEUS DADOS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-6">
          <h2 className="text-lg font- font-['Archivo_Black'] border-b border-stone-200 pb-3">
            MEUS DADOS
          </h2>
          <form onSubmit={handleSalvarDados} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Nome completo</label>
                <input
                  type="text"
                  value={dadosPessoais.nome}
                  onChange={(e) => setDadosPessoais({ ...dadosPessoais, nome: e.target.value })}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-[#3E2417] focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">E-mail</label>
                <input
                  type="email"
                  value={dadosPessoais.email}
                  onChange={(e) => setDadosPessoais({ ...dadosPessoais, email: e.target.value })}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Celular</label>
                <input
                  type="text"
                  value={dadosPessoais.celular}
                  onChange={(e) => setDadosPessoais({ ...dadosPessoais, celular: e.target.value })}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">CPF</label>
                <input
                  type="text"
                  value={dadosPessoais.cpf}
                  onChange={(e) => setDadosPessoais({ ...dadosPessoais, cpf: e.target.value })}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Data de nascimento</label>
                <input
                  type="text"
                  placeholder="dd/mm/aaaa"
                  value={dadosPessoais.dataNascimento}
                  onChange={(e) => setDadosPessoais({ ...dadosPessoais, dataNascimento: e.target.value })}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-[#3E2417] hover:bg-[#602D15] transition-colors rounded-md text-white font-['Archivo_Black'] text-xs uppercase"
            >
              SALVAR DADOS
            </button>
          </form>
        </section>

        {/* SECÇÃO 2: ENDEREÇOS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-stone-200 pb-3">
            <h2 className="text-lg font-['Archivo_Black']">ENDEREÇOS</h2>
            <button
              onClick={() => setExibirFormEndereco(!exibirFormEndereco)}
              className="px-3 py-1.5 bg-[#FEF8F0] border border-orange-400/50 rounded-md text-xs font-bold text-yellow-900 hover:bg-orange-100 transition-colors"
            >
              + NOVO
            </button>
          </div>

          {/* Endereço Cadastrado Exemplo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#FEF8F0]/50 rounded-lg border border-orange-200/50">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-orange-400 text-white rounded text-[10px] font-bold">Casa</span>
              <span className="px-2 py-0.5 bg-stone-300 text-yellow-900 rounded text-[10px] font-bold">Padrão</span>
              <p className="text-stone-700 font-medium">
                Av. Paulista, 1000 — Bela Vista, São Paulo/SP - CEP 01310-100
              </p>
            </div>
            <button className="text-xs text-amber-800 underline font-semibold hover:opacity-80 self-start sm:self-auto">
              EXCLUIR
            </button>
          </div>

          {/* Formulário Novo Endereço */}
          {exibirFormEndereco && (
            <form onSubmit={handleSalvarEndereco} className="p-4 bg-[#FEF8F0] rounded-xl border border-orange-300/60 space-y-4">
              <h3 className="text-xs font-['Archivo_Black'] text-[#3E2417]">ADICIONAR NOVO ENDEREÇO</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block mb-1">Apelido (Casa, Trabalho...)</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, apelido: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">CEP</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, cep: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block mb-1">Rua</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, rua: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Número</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, numero: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Complemento</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, complemento: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  />
                </div>
                <div>
                  <label className="block mb-1">Bairro</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, bairro: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  />
                </div>
                <div>
                  <label className="block mb-1">Cidade</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, cidade: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  />
                </div>
                <div>
                  <label className="block mb-1">UF</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoEndereco({ ...novoEndereco, uf: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id="principal"
                  onChange={(e) => setNovoEndereco({ ...novoEndereco, principal: e.target.checked })}
                />
                <label htmlFor="principal">Usar como endereço principal</label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#3E2417] text-white rounded text-xs font-['Archivo_Black']"
                >
                  SALVAR ENDEREÇO
                </button>
                <button
                  type="button"
                  onClick={() => setExibirFormEndereco(false)}
                  className="px-5 py-2.5 bg-white border border-orange-400/50 text-yellow-900 rounded text-xs font-['Archivo_Black']"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
        </section>

        {/* SECÇÃO 3: CARTÕES */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-stone-200 pb-3">
            <h2 className="text-lg font-['Archivo_Black']">CARTÕES</h2>
            <button
              onClick={() => setExibirFormCartao(!exibirFormCartao)}
              className="px-3 py-1.5 bg-[#FEF8F0] border border-orange-400/50 rounded-md text-xs font-bold text-yellow-900 hover:bg-orange-100 transition-colors"
            >
              + NOVO
            </button>
          </div>

          <p className="text-sm font-semibold text-[#3E2417]">Nenhum cartão salvo.</p>
          <p className="text-xs text-stone-500 leading-relaxed max-w-3xl">
            Por segurança, guardamos só a bandeira e os 4 últimos números. O bilhete completo é o código iniciado (hash seguro — quando o Mercado Pago faz o ajuste, ele é enviado com segurança.)
          </p>

          {/* Formulário Novo Cartão */}
          {exibirFormCartao && (
            <form onSubmit={handleSalvarCartao} className="p-4 bg-[#FEF8F0] rounded-xl border border-orange-300/60 space-y-4">
              <h3 className="text-xs font-['Archivo_Black'] text-[#3E2417]">ADICIONAR CARTÃO</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="md:col-span-2">
                  <label className="block mb-1">Número do cartão</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoCartao({ ...novoCartao, numero: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Nome impresso no cartão</label>
                  <input
                    type="text"
                    onChange={(e) => setNovoCartao({ ...novoCartao, nome: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Validade (MM/AA)</label>
                  <input
                    type="text"
                    placeholder="MM/AA"
                    onChange={(e) => setNovoCartao({ ...novoCartao, validade: e.target.value })}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id="cartaoPrincipal"
                  onChange={(e) => setNovoCartao({ ...novoCartao, principal: e.target.checked })}
                />
                <label htmlFor="cartaoPrincipal">Usar como cartão principal</label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#3E2417] text-white rounded text-xs font-['Archivo_Black']"
                >
                  SALVAR CARTÃO
                </button>
                <button
                  type="button"
                  onClick={() => setExibirFormCartao(false)}
                  className="px-5 py-2.5 bg-white border border-orange-400/50 text-yellow-900 rounded text-xs font-['Archivo_Black']"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
        </section>

        {/* SECÇÃO 4: MEUS PEDIDOS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-4">
          <h2 className="text-lg font-['Archivo_Black'] border-b border-stone-200 pb-3">
            MEUS PEDIDOS
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#FEF8F0]/60 rounded-lg text-xs">
            <span className="font-semibold text-[#3E2417]">MS-1001 - 12/09/2026</span>
            <span className="px-3 py-1 bg-pink-200 text-yellow-900 font-medium rounded-full text-[11px]">
              Entregue
            </span>
            <span className="font-semibold text-[#3E2417]">R$ 154,80</span>
          </div>
        </section>

        {/* SECÇÃO 5: TROCAS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-3">
          <h2 className="text-lg font-['Archivo_Black'] border-b border-stone-200 pb-3">
            TROCAS
          </h2>
          <p className="text-sm text-stone-700">Nenhuma troca em andamento.</p>
          <Link to="/trocas" className="inline-block text-xs text-[#3E2417] font-medium underline hover:opacity-80">
            Pedir troca ou devolução
          </Link>
        </section>

        {/* SECÇÃO 6: CLUBE DA CAIXINHA */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-3">
          <h2 className="text-lg font-['Archivo_Black'] border-b border-stone-200 pb-3">
            CLUBE DA CAIXINHA
          </h2>
          <p className="text-sm text-stone-700">
            Você ainda não assina o Clube.{' '}
            <Link to="/clube" className="text-yellow-900 font-bold underline hover:opacity-80 ml-1">
              Gerenciar
            </Link>
          </p>
        </section>

      </div>
    </div>
  );
}