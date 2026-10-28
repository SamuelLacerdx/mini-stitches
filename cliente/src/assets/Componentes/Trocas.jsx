import React, { useState } from 'react';

export default function Trocas() {
  const [tipo, setTipo] = useState('TROCA');
  const [formData, setFormData] = useState({
    pedido: '',
    email: '',
    motivo: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Solicitação de ${tipo.toLowerCase()} enviada para o pedido ${formData.pedido}!`);
    setFormData({ pedido: '', email: '', motivo: '' });
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF5EF] px-4 py-12 font-['Work_Sans',sans-serif] text-[#3E1B0E] md:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-12">
        {/* EXPLICATIVO */}
        <div className="flex flex-col gap-6 lg:col-span-6">
          <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase leading-tight text-[#3E1B0E] sm:text-5xl">
            TROCAS E<br />DEVOLUÇÕES
          </h1>
          <div className="flex flex-col gap-4 text-base leading-relaxed text-[#3E1B0E]">
            <p>
              Você tem 7 dias após o recebimento para desistir da compra. Kits com defeito são trocados sem custo.
            </p>
            <p>
              Não precisa ter conta: use o número do pedido e o e-mail da compra.
            </p>
          </div>
        </div>

        {/* FORMULÁRIO COM ABAS */}
        <div className="rounded-2xl bg-[#F8D7DA] p-6 shadow-sm lg:col-span-6 sm:p-8">
          <div className="mb-4 flex gap-3">
            <button
              type="button"
              onClick={() => setTipo('TROCA')}
              className={`h-12 flex-1 rounded-full font-['Archivo_Black',sans-serif] text-sm uppercase tracking-wide transition-colors ${
                tipo === 'TROCA'
                  ? 'bg-[#3E1B0E] text-white'
                  : 'bg-white text-[#3E1B0E] hover:bg-stone-100'
              }`}
            >
              TROCA
            </button>
            <button
              type="button"
              onClick={() => setTipo('DEVOLUÇÃO')}
              className={`h-12 flex-1 rounded-full font-['Archivo_Black',sans-serif] text-sm uppercase tracking-wide transition-colors ${
                tipo === 'DEVOLUÇÃO'
                  ? 'bg-[#3E1B0E] text-white'
                  : 'bg-white text-[#3E1B0E] hover:bg-stone-100'
              }`}
            >
              DEVOLUÇÃO
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <input
              type="text"
              name="pedido"
              required
              placeholder="Número do pedido (ex.: MS-1001)"
              value={formData.pedido}
              onChange={handleChange}
              className="h-14 w-full rounded-lg border border-pink-300 bg-white px-4 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#3E1B0E]"
            />
            <input
              type="email"
              name="email"
              required
              placeholder="E-mail da compra"
              value={formData.email}
              onChange={handleChange}
              className="h-14 w-full rounded-lg border border-pink-300 bg-white px-4 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#3E1B0E]"
            />
            <textarea
              name="motivo"
              required
              rows={4}
              placeholder="Motivo"
              value={formData.motivo}
              onChange={handleChange}
              className="w-full rounded-lg border border-pink-300 bg-white p-4 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#3E1B0E]"
            />
            <button
              type="submit"
              className="h-14 w-full rounded-full bg-[#3E1B0E] font-['Archivo_Black',sans-serif] text-sm uppercase tracking-widest text-white transition-colors hover:bg-amber-950"
            >
              ENVIAR SOLICITAÇÃO
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}