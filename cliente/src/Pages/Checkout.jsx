import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function FinalizarCompra() {
  const [pagamento, setPagamento] = useState('cartao');
  const [cep, setCep] = useState('');
  const [freteCalculado, setFreteCalculado] = useState(false);

  return (
    <div className="w-full bg-[#FEF8F0] min-h-screen font-['Work_Sans',sans-serif] text-[#3E2417] py-8 px-4 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* NAVEGAÇÃO SUPERIOR & BREADCRUMBS */}
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

        {/* LAYOUT PRINCIPAL EM DUAS COLUNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* COLUNA DA ESQUERDA: FORMULÁRIO (7 COLUNAS) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-12">
            
            {/* ETAPA 1: SEUS DADOS */}
            <section className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] font-bold text-sm flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                    SEUS DADOS
                  </h2>
                </div>
                <p className="text-sm text-[#80695B] pl-11">
                  Não precisa criar uma conta para comprar. Campos com * são obrigatórios.
                </p>
              </div>

              {/* ALERTA LOGIN */}
              <div className="bg-[#FBEDD9] py-3 px-4 rounded-lg text-sm text-[#3E2417] flex items-center gap-1.5 ml-0 lg:ml-11">
                <span>Já tem uma conta?</span>
                <button type="button" className="font-bold underline hover:text-[#602D15] transition-colors">
                  Entre para usar seus dados
                </button>
              </div>

              {/* CAMPOS DE DADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 ml-0 lg:ml-11">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">Nome completo *</label>
                  <input
                    type="text"
                    placeholder="Como está no seu documento"
                    className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">CPF *</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">E-mail *</label>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#3E2417]">Celular com DDD *</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                  />
                </div>
              </div>
            </section>

            <hr className="border-[#C58752]/20" />

            {/* ETAPA 2: ENDEREÇO DE ENTREGA */}
            <section className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] font-bold text-sm flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                    ONDE VAMOS ENTREGAR?
                  </h2>
                </div>
                <p className="text-sm text-[#80695B] pl-11">
                  Informe o CEP para consultar o valor do frete e o prazo de entrega.
                </p>
              </div>

              <div className="space-y-5 ml-0 lg:ml-11">
                {/* CALCULAR CEP */}
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-full sm:w-56 space-y-1.5">
                    <label className="block text-sm font-medium text-[#3E2417]">CEP *</label>
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="00000-000"
                      className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFreteCalculado(true)}
                    className="h-12 px-6 rounded-md border-2 border-[#3E2417] text-[#3E2417] font-bold text-sm uppercase hover:bg-[#3E2417] hover:text-white transition-colors"
                  >
                    CALCULAR FRETE
                  </button>
                  <a href="https://buscacepinter.correios.com.br/" target="_blank" rel="noreferrer" className="text-sm text-[#3E2417] underline pb-3 sm:pb-0 hover:text-[#602D15]">
                    Não sei meu CEP
                  </a>
                </div>

                {/* ENDEREÇO DETALHADO */}
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    <div className="md:col-span-6 space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Endereço *</label>
                      <input
                        type="text"
                        placeholder="Rua, avenida ou travessa"
                        className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Número *</label>
                      <input
                        type="text"
                        placeholder="Nº"
                        className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                      />
                    </div>
                    <div className="md:col-span-4 space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Complemento (opcional)</label>
                      <input
                        type="text"
                        placeholder="Apartamento, bloco, casa"
                        className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    <div className="md:col-span-5 space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Bairro *</label>
                      <input
                        type="text"
                        placeholder="Seu bairro"
                        className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                      />
                    </div>
                    <div className="md:col-span-5 space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Cidade *</label>
                      <input
                        type="text"
                        placeholder="Sua cidade"
                        className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Estado *</label>
                      <select className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm text-[#3E2417]">
                        <option value="">UF</option>
                        <option value="SP">SP</option>
                        <option value="RJ">RJ</option>
                        <option value="MG">MG</option>
                        <option value="PR">PR</option>
                        <option value="RS">RS</option>
                        <option value="SC">SC</option>
                        <option value="BA">BA</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* AVISO DE OPÇÕES DE FRETE */}
                <div className="bg-[#FBEDD9] py-3 px-4 rounded-lg text-sm text-[#3E2417] flex items-center gap-3">
                  <span className="text-xl">🚚</span>
                  <span>
                    {freteCalculado
                      ? 'Opções de frete calculadas com sucesso.'
                      : 'As opções de entrega aparecerão após calcular o frete. Nenhum valor de envio foi incluído ainda.'}
                  </span>
                </div>
              </div>
            </section>

            <hr className="border-[#C58752]/20" />

            {/* ETAPA 3: FORMA DE PAGAMENTO */}
            <section className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#F7C6E5] text-[#3E2417] font-bold text-sm flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-xl md:text-2xl font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase">
                    COMO VOCÊ PREFERE PAGAR?
                  </h2>
                </div>
                <p className="text-sm text-[#80695B] pl-11">
                  Escolha uma das opções abaixo. O desconto de 5% é exclusivo para Pix.
                </p>
              </div>

              <div className="space-y-6 ml-0 lg:ml-11">
                {/* CARDS SELEÇÃO DE PAGAMENTO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* PIX */}
                  <button
                    type="button"
                    onClick={() => setPagamento('pix')}
                    className={`p-4 rounded-lg text-left border flex items-center justify-between transition-all ${
                      pagamento === 'pix'
                        ? 'bg-[#FBEDD9] border-2 border-[#3E2417]'
                        : 'bg-white border-[#C58752]/50 hover:border-[#3E2417]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚡</span>
                      <div className="space-y-0.5">
                        <div className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417]">PIX</div>
                        <p className="text-[13px] text-[#80695B]">5% de desconto</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      pagamento === 'pix' ? 'border-[#3E2417]' : 'border-[#C58752]/60'
                    }`}>
                      {pagamento === 'pix' && <div className="w-2.5 h-2.5 bg-[#3E2417] rounded-full" />}
                    </div>
                  </button>

                  {/* CARTÃO DE CRÉDITO */}
                  <button
                    type="button"
                    onClick={() => setPagamento('cartao')}
                    className={`p-4 rounded-lg text-left border flex items-center justify-between transition-all relative ${
                      pagamento === 'cartao'
                        ? 'bg-[#FBEDD9] border-2 border-[#3E2417]'
                        : 'bg-white border-[#C58752]/50 hover:border-[#3E2417]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💳</span>
                      <div className="space-y-0.5">
                        <div className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417] flex items-center gap-1.5">
                          CARTÃO DE CRÉDITO
                          {pagamento === 'cartao' && <span className="text-[10px]">🔒</span>}
                        </div>
                        <p className="text-[13px] text-[#80695B]">Até 4x sem juros</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      pagamento === 'cartao' ? 'border-[#3E2417]' : 'border-[#C58752]/60'
                    }`}>
                      {pagamento === 'cartao' && <div className="w-2.5 h-2.5 bg-[#3E2417] rounded-full" />}
                    </div>
                  </button>

                  {/* BOLETO */}
                  <button
                    type="button"
                    onClick={() => setPagamento('boleto')}
                    className={`p-4 rounded-lg text-left border flex items-center justify-between transition-all ${
                      pagamento === 'boleto'
                        ? 'bg-[#FBEDD9] border-2 border-[#3E2417]'
                        : 'bg-white border-[#C58752]/50 hover:border-[#3E2417]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      <div className="space-y-0.5">
                        <div className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417]">BOLETO</div>
                        <p className="text-[13px] text-[#80695B]">À vista, sem desconto</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      pagamento === 'boleto' ? 'border-[#3E2417]' : 'border-[#C58752]/60'
                    }`}>
                      {pagamento === 'boleto' && <div className="w-2.5 h-2.5 bg-[#3E2417] rounded-full" />}
                    </div>
                  </button>
                </div>

                {/* FORMULÁRIO CARTÃO DE CRÉDITO */}
                {pagamento === 'cartao' && (
                  <div className="space-y-5 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">Número do cartão *</label>
                        <input
                          type="text"
                          placeholder="0000 0000 0000 0000"
                          className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">Nome impresso no cartão *</label>
                        <input
                          type="text"
                          placeholder="Nome do titular"
                          className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">Validade *</label>
                        <input
                          type="text"
                          placeholder="MM/AA"
                          className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">Código de segurança (CVV) *</label>
                        <input
                          type="text"
                          placeholder="3 ou 4 dígitos"
                          className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-[#3E2417]">CPF do titular *</label>
                        <input
                          type="text"
                          placeholder="000.000.000-00"
                          className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm placeholder-[#80695B]/60"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[#3E2417]">Parcelamento *</label>
                      <select className="w-full h-12 px-4 rounded-md bg-white border border-[#C58752]/50 focus:outline-none focus:border-[#3E2417] text-sm text-[#3E2417] appearance-none">
                        <option value="4">Sem juros — 4 parcelas de R$ 44,92 = R$ 179,70</option>
                        <option value="3">Sem juros — 3 parcelas de R$ 59,90 = R$ 179,70</option>
                        <option value="2">Sem juros — 2 parcelas de R$ 89,85 = R$ 179,70</option>
                        <option value="1">À vista — 1x de R$ 179,70</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-[#80695B]">
                        *Total dos produtos no cartão: R$ 179,70. Ao final da escolha de todas as opções, o parcelamento e o valor final serão calculados.
                      </p>
                      <p className="text-xs text-[#80695B] flex items-center gap-1.5">
                        <span>🔒</span> Seus dados de pagamento são criptografados.
                      </p>
                    </div>
                  </div>
                )}

                {/* INFORMAÇÕES PIX */}
                {pagamento === 'pix' && (
                  <div className="pt-2 animate-fade-in">
                    <div className="bg-transparent border border-[#C58752]/30 p-5 rounded-lg space-y-2">
                      <h4 className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417]">COMO PAGAR COM PIX</h4>
                      <p className="text-sm text-[#3E2417]/90">
                        Ao finalizar a compra, um <strong>QR Code</strong> e um código <strong>"Copia e Cola"</strong> serão gerados na próxima tela. Você terá até 30 minutos para realizar o pagamento.
                      </p>
                    </div>
                  </div>
                )}

                {/* INFORMAÇÕES BOLETO */}
                {pagamento === 'boleto' && (
                  <div className="pt-2 animate-fade-in">
                    <div className="bg-transparent border border-[#C58752]/30 p-5 rounded-lg space-y-2">
                      <h4 className="font-['Archivo_Black',sans-serif] text-[13px] text-[#3E2417]">COMO PAGAR COM BOLETO</h4>
                      <p className="text-sm text-[#3E2417]/90">
                        O seu boleto será gerado após clicar em "Finalizar Pedido". O prazo de vencimento é de 2 dias úteis. A confirmação do pagamento pode levar até 3 dias úteis para constar no sistema.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* COLUNA DA DIREITA: RESUMO DO PEDIDO (5 COLUNAS) */}
          <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8 space-y-6">
            
            {/* CAIXA DE RESUMO DO PEDIDO */}
            <div className="bg-[#FDE89C] p-6 rounded-[1.25rem] space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[1.1rem] font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase tracking-wide">
                  SEU PEDIDO
                </h2>
                <span className="text-xs font-medium text-[#3E2417]/80">3 itens</span>
              </div>

              {/* LISTA DE PRODUTOS */}
              <div className="space-y-5">
                
                {/* PRODUTO 1 */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h3 className="font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase text-[11px] leading-tight">
                      COELHINHO AMIGURUMI
                    </h3>
                    <p className="text-[11px] text-[#80695B]">7 a 12 anos</p>
                    <p className="text-[11px] text-[#80695B]">Quantidade: 1</p>
                  </div>
                  <span className="font-bold text-sm text-[#3E2417] shrink-0">R$ 129,90</span>
                </div>

                {/* PRODUTO 2 */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h3 className="font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase text-[11px] leading-tight">
                      NOVELO DE ALGODÃO ROSA
                    </h3>
                    <p className="text-[11px] text-[#80695B]">Material avulso</p>
                    <p className="text-[11px] text-[#80695B]">Quantidade: 1</p>
                  </div>
                  <span className="font-bold text-sm text-[#3E2417] shrink-0">R$ 24,90</span>
                </div>

                {/* PRODUTO 3 */}
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h3 className="font-['Archivo_Black',sans-serif] text-[#3E2417] uppercase text-[11px] leading-tight">
                      NOVELO DE ALGODÃO AMARELO
                    </h3>
                    <p className="text-[11px] text-[#80695B]">Material avulso</p>
                    <p className="text-[11px] text-[#80695B]">Quantidade: 1</p>
                  </div>
                  <span className="font-bold text-sm text-[#3E2417] shrink-0">R$ 24,90</span>
                </div>

              </div>

              <hr className="border-[#3E2417]/10" />

              {/* VALORES E DETALHES DE FRETE */}
              <div className="space-y-2.5 text-[13px] text-[#3E2417] font-medium">
                <div className="flex justify-between">
                  <span>Subtotal (3 itens)</span>
                  <span>R$ 179,70</span>
                </div>
                {pagamento === 'pix' && (
                  <div className="flex justify-between text-green-700 font-bold">
                    <span>Desconto Pix (5%)</span>
                    <span>- R$ 8,99</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Frete</span>
                  <span>{freteCalculado ? 'R$ 15,00' : 'Calculado pelo CEP'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pagamento</span>
                  <span>{pagamento === 'cartao' ? 'Cartão de crédito' : pagamento === 'pix' ? 'Pix' : 'Boleto'}</span>
                </div>
              </div>

              <hr className="border-[#3E2417]/10" />

              {/* TOTAL */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-['Archivo_Black',sans-serif] text-[13px] uppercase text-[#3E2417]">
                    TOTAL DOS PRODUTOS
                  </span>
                  <span className="font-['Archivo_Black',sans-serif] text-2xl text-[#3E2417]">
                    {pagamento === 'pix' ? 'R$ 170,71' : 'R$ 179,70'}
                  </span>
                </div>
                
                {pagamento === 'cartao' && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#80695B]">
                      Sem juros: 2x de R$ 89,85 | 4x de R$ 44,92.
                    </p>
                    <p className="text-[11px] text-[#80695B]">
                      O valor final será atualizado após a escolha do frete e do Pix.
                    </p>
                  </div>
                )}
              </div>

              {/* DESCONTO PIX ALERTA */}
              {pagamento !== 'pix' && (
                <div className="bg-white p-3 rounded-lg text-xs text-[#3E2417] flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5">💡</span>
                  <span className="leading-snug">
                    Ao pagar no <strong>Pix</strong>, os produtos ficam por <strong>R$ 170,71</strong> com 5% de desconto, antes do frete.
                  </span>
                </div>
              )}

              {/* BOTÃO SUBMIT E TERMOS */}
              <div className="space-y-4 pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#3E2417] hover:bg-[#2A180F] text-white font-['Archivo_Black',sans-serif] text-sm py-4 rounded-lg transition-colors uppercase flex items-center justify-center gap-2"
                >
                  <span>FINALIZAR PEDIDO</span>
                  <span>→</span>
                </button>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#80695B] text-center leading-relaxed">
                    Para finalizar, preencha os campos obrigatórios e calcule o frete.
                  </p>
                  <p className="text-[10px] text-[#80695B] text-center leading-relaxed">
                    Ao finalizar, você concorda com os Termos de compra e a Política de privacidade.
                  </p>
                </div>
              </div>

            </div>

            {/* CARD AJUDA */}
            <div className="bg-transparent p-5 rounded-2xl border border-[#C58752]/40 space-y-2 text-xs text-[#3E2417]">
              <h3 className="font-['Archivo_Black',sans-serif] uppercase text-[11px] text-[#3E2417] mb-3">
                PRECISA DE UMA AJUDINHA?
              </h3>
              <p>oi@ministitches.com.br</p>
              <p>Seg a sex, 9h às 18h</p>
              <Link to="/contato" className="inline-block font-bold underline hover:text-[#602D15] pt-1">
                Fale com a gente
              </Link>
            </div>

            {/* INFORMAÇÃO FRETE GRÁTIS */}
            <p className="text-[11px] text-[#80695B] leading-relaxed">
              Frete grátis a partir de R$ 250,00 (Sul e Sudeste) e R$ 350,00 nas demais regiões. O prazo de envio do pedido será calculado pelo CEP.
            </p>

          </div>

        </div>

      </div>
    </div>
  );
}