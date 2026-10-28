import React, { useState } from 'react';
import { ShoppingBag, Plus, Minus } from 'lucide-react';

export default function Materiais() {
  const [categoriaAtiva, setCategoriaAtiva] = useState('TODAS');
  
  // Estado para armazenar a quantidade de cada item selecionado individualmente
  const [quantidades, setQuantidades] = useState({});

  const materiaisData = [
    {
      id: 1,
      categoria: 'FIOS E NOVELOS',
      nome: 'NOVELO DE ALGODÃO - CREME',
      descricao: 'Fio de algodão 100% macio, o mesmo dos kits. Rende um bichinho de porte médio.',
      preco: '24,90',
    },
    {
      id: 2,
      categoria: 'FIOS E NOVELOS',
      nome: 'NOVELO DE ALGODÃO - ROSA',
      descricao: 'Fio de algodão 100% macio, o mesmo dos kits. Rende um bichinho de porte médio.',
      preco: '24,90',
    },
    {
      id: 3,
      categoria: 'FIOS E NOVELOS',
      nome: 'NOVELO DE ALGODÃO - AMARELO',
      descricao: 'Fio de algodão 100% macio, o mesmo dos kits. Rende um bichinho de porte médio.',
      preco: '24,90',
    },
    {
      id: 4,
      categoria: 'AGULHAS',
      nome: 'AGULHA DE CROCHÊ 3.5MM',
      descricao: 'Agulha em alumínio com cabo ergonômico emborrachado para mãos pequenas.',
      preco: '18,50',
    },
    {
      id: 5,
      categoria: 'BORDADO',
      nome: 'BASTIDOR DE MADEIRA 15CM',
      descricao: 'Bastidor com tarracha de alta qualidade para prender o tecido com firmeza.',
      preco: '22,00',
    },
    {
      id: 6,
      categoria: 'ACABAMENTO',
      nome: 'TESOURINHA DE ARREMATE',
      descricao: 'Tesoura precisa e segura para corte rente de fios.',
      preco: '15,00',
    },
  ];

  // Incrementa ou decrementa a quantidade do item
  const alterarQuantidade = (id, delta) => {
    setQuantidades((prev) => {
      const atual = prev[id] || 1;
      const nova = atual + delta;
      return { ...prev, [id]: nova < 1 ? 1 : nova };
    });
  };

  // Simula a adição ao carrinho
  const handleAdicionarAoCarrinho = (item) => {
    const qtd = quantidades[item.id] || 1;
    alert(`Adicionado ao carrinho: ${qtd}x ${item.nome}`);
  };

  // Filtra os materiais por categoria
  const materiaisFiltrados = materiaisData.filter(
    (item) => categoriaAtiva === 'TODAS' || item.categoria === categoriaAtiva
  );

  return (
    <div className="w-full bg-[#FAF5EF] font-['Work_Sans',sans-serif]">
      {/* 1. FAIXA SUPERIOR */}
      <section className="bg-[#FAF5EF] px-4 pt-12 pb-6 text-[#3E1B0E] md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase text-[#3E1B0E] sm:text-5xl lg:text-6xl">
            MATERIAIS
          </h1>
          <p className="max-w-3xl font-['Archivo_Black',sans-serif] text-sm uppercase leading-relaxed tracking-wider text-[#3E1B0E] md:text-base">
            Fios, agulhas e acessórios dos mesmos fornecedores dos nossos kits. Perfeitos para repor o que acabou ou continuar criando depois que o kit terminar.
          </p>
        </div>
      </section>

      {/* 2. ÁREA DE FILTROS E CARTÕES */}
      <main className="mx-auto max-w-6xl px-4 pb-16 md:px-8">
        
        {/* BOTÕES DE CATEGORIA */}
        <div className="flex flex-wrap gap-3">
          {['TODAS', 'FIOS E NOVELOS', 'AGULHAS', 'BORDADO', 'ACABAMENTO'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoriaAtiva(cat)}
              className={`rounded-full px-6 py-2.5 font-['Archivo_Black',sans-serif] text-xs uppercase transition-colors ${
                categoriaAtiva === cat
                  ? 'bg-[#3E1B0E] text-white'
                  : 'border border-[#3E1B0E] bg-transparent text-[#3E1B0E] hover:bg-[#3E1B0E]/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* CONTADOR DE MATERIAIS */}
        <div className="mt-6 font-['Archivo_Black',sans-serif] text-sm uppercase tracking-widest text-[#3E1B0E]/80">
          {materiaisFiltrados.length} {materiaisFiltrados.length === 1 ? 'material encontrado' : 'materiais encontrados'}
        </div>

        {/* GRELHA DE MATERIAIS */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {materiaisFiltrados.map((item) => {
            const qtdAtual = quantidades[item.id] || 1;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-stone-300 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-[#3E1B0E]">
                    {item.categoria}
                  </span>
                  <h3 className="font-['Work_Sans'] text-base font-black text-amber-900">
                    {item.nome}
                  </h3>
                  <p className="text-xs font-normal leading-relaxed text-amber-900">
                    {item.descricao}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-4">
                  <span className="text-base font-black text-amber-900">
                    R${item.preco}
                  </span>

                  {/* CONTROLO DE QUANTIDADE E BOTÃO DE ADICIONAR */}
                  <div className="flex items-center gap-3">
                    {/* Seletor de Quantidade */}
                    <div className="flex h-10 items-center justify-between gap-2 rounded-full border border-[#3E1B0E] px-3">
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.id, -1)}
                        className="text-[#3E1B0E] hover:text-amber-700"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-['Archivo_Black',sans-serif] text-xs text-[#3E1B0E]">
                        {qtdAtual}
                      </span>
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(item.id, 1)}
                        className="text-[#3E1B0E] hover:text-amber-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Botão Adicionar ao Carrinho */}
                    <button
                      type="button"
                      onClick={() => handleAdicionarAoCarrinho(item)}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#3E1B0E] px-4 font-['Archivo_Black',sans-serif] text-[11px] text-white transition-colors hover:bg-amber-950"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>ADICIONAR AO CARRINHO</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}