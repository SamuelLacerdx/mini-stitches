import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, CreditCard, Trash2 } from 'lucide-react';

export default function MinhaConta() {
  const navigate = useNavigate();

  // Estados dos Dados Pessoais
  const [dadosPessoais, setDadosPessoais] = useState({
    nome: 'Samuel Lima',
    email: 'sam@exemplo.com',
    celular: '(11) 97234-3678',
    cpf: '000.000.000-00',
    dataNascimento: 'dd/mm/aaaa',
  });

  // Estado para controlar a abertura dos formulários de Novo Endereço e Novo Cartão
  const [showNovoEndereco, setShowNovoEndereco] = useState(false);
  const [showNovoCartao, setShowNovoCartao] = useState(false);

  // Manipulação de formulário de dados
  const handleDadosChange = (e) => {
    const { name, value } = e.target;
    setDadosPessoais((prev) => ({ ...prev, [name]: value }));
  };

  const handleSalvarDados = (e) => {
    e.preventDefault();
    alert('Dados salvos com sucesso!');
  };

  const handleSair = () => {
    alert('Você saiu da sua conta.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full bg-[#FEF8F0] px-4 py-10 font-['Work_Sans',sans-serif] text-[#3E2417]">
      <div className="mx-auto flex w-full max-w-[998px] flex-col gap-8">
        
        {/* CABEÇALHO DO PAINEL */}
        <div className="flex items-center justify-between border-b border-amber-200/60 pb-4">
          <h1 className="font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E2417] md:text-4xl">
            MINHA CONTA
          </h1>
          <button
            onClick={handleSair}
            className="text-sm font-normal text-amber-800 underline hover:text-amber-950"
          >
            Sair
          </button>
        </div>

        {/* ========================================================= */}
        {/* CARTÃO 1: MEUS DADOS */}
        {/* ========================================================= */}
        <section className="rounded-xl border border-stone-300 bg-white p-6 md:p-8">
          <h2 className="mb-6 font-['Archivo_Black',sans-serif] text-base uppercase text-[#3E2417]">
            MEUS DADOS
          </h2>

          <form onSubmit={handleSalvarDados} className="flex flex-col gap-5">
            {/* Nome Completo */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-normal text-[#3E2417]">Nome completo</label>
              <input
                type="text"
                name="nome"
                value={dadosPessoais.nome}
                onChange={handleDadosChange}
                className="h-10 w-full max-w-md rounded-md border border-orange-400/30 bg-white px-3.5 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
              />
            </div>

            {/* E-mail e Celular */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-normal text-[#3E2417]">E-mail</label>
                <input
                  type="email"
                  name="email"
                  value={dadosPessoais.email}
                  onChange={handleDadosChange}
                  className="h-10 w-full rounded-md border border-orange-400/30 bg-white px-3.5 text-xs text-stone-500 focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-normal text-[#3E2417]">Celular</label>
                <input
                  type="text"
                  name="celular"
                  value={dadosPessoais.celular}
                  onChange={handleDadosChange}
                  className="h-10 w-full rounded-md border border-orange-400/30 bg-white px-3.5 text-xs text-stone-500 focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
                />
              </div>
            </div>

            {/* CPF e Data de Nascimento */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-normal text-[#3E2417]">CPF</label>
                <input
                  type="text"
                  name="cpf"
                  value={dadosPessoais.cpf}
                  onChange={handleDadosChange}
                  className="h-10 w-full rounded-md border border-orange-400/30 bg-white px-3.5 text-xs text-stone-500 focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-normal text-[#3E2417]">Data de nascimento</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    name="dataNascimento"
                    value={dadosPessoais.dataNascimento}
                    onChange={handleDadosChange}
                    className="h-10 w-full rounded-md border border-orange-400/30 bg-white px-3.5 text-xs text-stone-500 focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
                  />
                  <Calendar className="absolute right-3 h-4 w-4 text-stone-500" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 h-11 w-44 rounded-md bg-[#4E2206] font-['Archivo_Black',sans-serif] text-sm text-white transition-colors hover:bg-[#3E2417]"
            >
              SALVAR DADOS
            </button>
          </form>
        </section>

        {/* ========================================================= */}
        {/* CARTÃO 2: ENDEREÇOS */}
        {/* ========================================================= */}
        <section className="rounded-xl border border-stone-300 bg-white p-6 md:p-8">
          <div className="flex items-center justify-between border-b border-stone-300 pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-400" />
              <h2 className="font-['Archivo_Black',sans-serif] text-base uppercase text-[#3E2417]">
                ENDEREÇOS
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowNovoEndereco(!showNovoEndereco)}
              className="rounded-md border border-orange-400/50 bg-[#FEF8F0] px-3 py-1.5 text-xs text-amber-900 transition-colors hover:bg-orange-100"
            >
              + NOVO
            </button>
          </div>

          {/* Endereço Cadastrado */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-stone-300/30 bg-[#FEF8F0] p-3.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-orange-400 px-2 py-0.5 text-white">Casa</span>
                <span className="rounded bg-stone-300 px-2 py-0.5 text-amber-900">Padrão</span>
                <span className="text-[#3E2417]">
                  Av. Paulista, 1000 — Bela Vista, São Paulo/SP - CEP 01310-100
                </span>
              </div>
              <button className="flex items-center gap-1 text-amber-800 underline hover:text-red-700">
                <span>EXCLUIR</span>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Formulário de Novo Endereço (Visível ao clicar em + NOVO) */}
          {showNovoEndereco && (
            <form className="mt-6 flex flex-col gap-4 border-t border-stone-200 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#3E2417]">Apelido (Casa, Trabalho...)</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#3E2417]">CEP</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="flex flex-col gap-1 md:col-span-8">
                  <label className="text-xs text-[#3E2417]">Rua</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
                <div className="flex flex-col gap-1 md:col-span-4">
                  <label className="text-xs text-[#3E2417]">Número</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#3E2417]">Complemento</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#3E2417]">Bairro</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="flex flex-col gap-1 md:col-span-8">
                  <label className="text-xs text-[#3E2417]">Cidade</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
                <div className="flex flex-col gap-1 md:col-span-4">
                  <label className="text-xs text-[#3E2417]">UF</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#3E2417]">
                <input type="checkbox" className="rounded border-orange-400/50" />
                Usar como endereço principal
              </label>

              <div className="flex items-center gap-3 pt-2">
                <button type="button" className="h-11 rounded-md bg-[#4E2206] px-6 font-['Archivo_Black',sans-serif] text-sm text-white">
                  SALVAR ENDEREÇO
                </button>
                <button
                  type="button"
                  onClick={() => setShowNovoEndereco(false)}
                  className="h-11 rounded-md border border-orange-400/50 bg-[#FEF8F0] px-6 font-['Archivo_Black',sans-serif] text-sm text-amber-900"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ========================================================= */}
        {/* CARTÃO 3: CARTÕES */}
        {/* ========================================================= */}
        <section className="rounded-xl border border-stone-300 bg-white p-6 md:p-8">
          <div className="flex items-center justify-between border-b border-stone-300 pb-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-orange-400" />
              <h2 className="font-['Archivo_Black',sans-serif] text-base uppercase text-[#3E2417]">
                CARTÕES
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowNovoCartao(!showNovoCartao)}
              className="rounded-md border border-orange-400/50 bg-[#FEF8F0] px-3 py-1.5 text-xs text-amber-900 transition-colors hover:bg-orange-100"
            >
              + NOVO
            </button>
          </div>

          <p className="mt-4 text-sm font-semibold text-[#3E2417]">Nenhum cartão salvo.</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            Por segurança, guardamos só a bandeira e os 4 últimos números. O bilhete completo é o código iniciado (hash seguro — quando o Mercado Pago faz o ajuste, ele é enviado com segurança).
          </p>

          {/* Formulário de Novo Cartão */}
          {showNovoCartao && (
            <form className="mt-6 flex flex-col gap-4 border-t border-stone-200 pt-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#3E2417]">Número do cartão</label>
                <input type="text" className="h-9 w-full max-w-xl rounded-md border border-orange-400/30 px-3 text-xs" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#3E2417]">Nome impresso no cartão</label>
                <input type="text" className="h-9 w-full max-w-xl rounded-md border border-orange-400/30 px-3 text-xs" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#3E2417]">Validade (MM/AA)</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#3E2417]">CVV</label>
                  <input type="text" className="h-9 rounded-md border border-orange-400/30 px-3 text-xs" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#3E2417]">
                <input type="checkbox" className="rounded border-orange-400/50" />
                Usar como cartão principal
              </label>

              <div className="flex items-center gap-3 pt-2">
                <button type="button" className="h-11 rounded-md bg-[#4E2206] px-6 font-['Archivo_Black',sans-serif] text-sm text-white">
                  SALVAR CARTÃO
                </button>
                <button
                  type="button"
                  onClick={() => setShowNovoCartao(false)}
                  className="h-11 rounded-md border border-orange-400/50 bg-[#FEF8F0] px-6 font-['Archivo_Black',sans-serif] text-sm text-amber-900"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ========================================================= */}
        {/* CARTÃO 4: MEUS PEDIDOS */}
        {/* ========================================================= */}
        <section className="rounded-xl border border-stone-300 bg-white p-6 md:p-8">
          <h2 className="border-b border-stone-300 pb-4 font-['Archivo_Black',sans-serif] text-lg uppercase text-[#3E2417]">
            MEUS PEDIDOS
          </h2>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-[#FEF8F0] p-4">
            <span className="text-sm font-semibold text-[#3E2417]">MS-1001 - 12/09/2026</span>
            <span className="rounded-xl bg-pink-200 px-3 py-1 text-xs text-amber-900">Entregue</span>
            <span className="text-sm font-semibold text-[#3E2417]">R$ 154,80</span>
          </div>
        </section>

        {/* ========================================================= */}
        {/* CARTÃO 5: TROCAS */}
        {/* ========================================================= */}
        <section className="rounded-xl border border-stone-300 bg-white p-6 md:p-8">
          <h2 className="border-b border-stone-300 pb-4 font-['Archivo_Black',sans-serif] text-lg uppercase text-[#3E2417]">
            TROCAS
          </h2>
          <p className="mt-4 text-sm text-[#3E2417]">Nenhuma troca em andamento.</p>
        </section>

        {/* ========================================================= */}
        {/* CARTÃO 6: CLUBE DA CAIXINHA */}
        {/* ========================================================= */}
        <section className="rounded-xl border border-stone-300 bg-white p-6 md:p-8">
          <h2 className="border-b border-stone-300 pb-4 font-['Archivo_Black',sans-serif] text-lg uppercase text-[#3E2417]">
            CLUBE DA CAIXINHA
          </h2>
          <div className="mt-4 text-sm text-[#3E2417]">
            Você ainda não assina o Clube.{' '}
            <Link to="/clube-da-caixinha" className="font-bold text-amber-900 underline">
              Gerenciar
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}