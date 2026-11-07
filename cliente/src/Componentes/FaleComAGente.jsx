import React, { useState } from 'react';
import { Mail, MapPin, Clock } from 'lucide-react';

export default function FaleComAGente() {
  const [form, setForm] = useState({ nome: '', email: '', mensagem: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Obrigado, ${form.nome}! Sua mensagem foi enviada com sucesso.`);
    setForm({ nome: '', email: '', mensagem: '' });
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF5EF] px-4 py-12 font-['Work_Sans',sans-serif] text-[#3E1B0E] md:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-2">
        /* INFORMAÇÕES DE CONTACTO */
        <div className="flex flex-col gap-8">
          <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase leading-tight text-[#3E1B0E] sm:text-5xl lg:text-6xl">
            FALE COM A<br />GENTE
          </h1>
          <p className="text-lg leading-relaxed text-[#3E1B0E]">
            Ficou com alguma dúvida? Mande uma mensagem, a gente responde rapidinho.
          </p>
          <div className="flex flex-col gap-4 text-base">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-[#3E1B0E]" />
              <a href="mailto:oi@ministitches.com.br" className="hover:underline">
                oi@ministitches.com.br
              </a>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-[#3E1B0E]" />
              <span>São Paulo, SP</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#3E1B0E]" />
              <span>Seg a sex, 9h às 18h</span>
            </div>
          </div>
        </div>


        <div className="rounded-2xl bg-[#F8D7DA] p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              name="nome"
              required
              placeholder="Seu nome"
              value={form.nome}
              onChange={handleChange}
              className="h-12 w-full rounded-md border border-pink-300 bg-white px-4 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#3E1B0E]"
            />
            <input
              type="email"
              name="email"
              required
              placeholder="Seu e-mail"
              value={form.email}
              onChange={handleChange}
              className="h-12 w-full rounded-md border border-pink-300 bg-white px-4 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#3E1B0E]"
            />
            <textarea
              name="mensagem"
              required
              rows={4}
              placeholder="Sua mensagem"
              value={form.mensagem}
              onChange={handleChange}
              className="w-full rounded-md border border-pink-300 bg-white p-4 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#3E1B0E]"
            />
            <button
              type="submit"
              className="h-12 w-full rounded-full bg-[#3E1B0E] font-['Archivo_Black',sans-serif] text-sm uppercase tracking-widest text-white transition-colors hover:bg-amber-950"
            >
              ENVIAR MENSAGEM
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}