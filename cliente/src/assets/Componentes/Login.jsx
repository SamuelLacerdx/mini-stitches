import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function Login() {
  // 1. Estados locais para gerir os campos do formulário
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrar, setLembrar] = useState(false);

  // 2. Manipulador de envio do formulário
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validação básica de preenchimento
    if (!email.trim() || !senha.trim()) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    // Simulação de autenticação bem-sucedida
    console.log('Dados de Login:', { email, senha, lembrar });
    alert(`Bem-vindo(a) de volta! Login efetuado com: ${email}`);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#FAF5EF] px-4 py-12 font-['Work_Sans',sans-serif] text-[#3E1B0E]">
      <div className="flex w-full max-w-md flex-col gap-6">
        
        {/* BOTÃO VOLTAR */}
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-bold text-amber-900 transition-colors hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o início
        </Link>

        {/* CARTÃO PRINCIPAL DE LOGIN */}
        <div className="flex flex-col gap-6 rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          
          {/* TÍTULO E SUBTÍTULO */}
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E1B0E]">
              ENTRAR NA CONTA
            </h1>
            <p className="text-sm font-normal text-stone-500">
              Acesse para acompanhar seus pedidos e tutoriais exclusivos.
            </p>
          </div>

          {/* FORMULÁRIO */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* CAMPO: E-MAIL */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-bold uppercase text-[#3E1B0E]">
                E-mail
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 h-5 w-5 text-stone-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-12 w-full rounded-xl border border-stone-300 bg-white pl-11 pr-4 text-sm text-[#3E1B0E] placeholder-stone-400 focus:border-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-900"
                />
              </div>
            </div>

            {/* CAMPO: SENHA */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="senha" className="text-xs font-bold uppercase text-[#3E1B0E]">
                Senha
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-5 w-5 text-stone-400" />
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-stone-300 bg-white pl-11 pr-11 text-sm text-[#3E1B0E] placeholder-stone-400 focus:border-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-900"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3.5 text-stone-400 transition-colors hover:text-[#3E1B0E]"
                  title={mostrarSenha ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* OPCIONAL: LEMBRAR DE MIM & ESQUECEU A SENHA */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-normal text-stone-600">
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-amber-900 focus:ring-amber-900"
                />
                Lembrar de mim
              </label>
              <a href="#esqueceu-senha" className="font-semibold text-amber-900 hover:underline">
                Esqueceu a senha?
              </a>
            </div>

            {/* BOTÃO ENTRAR */}
            <button
              type="submit"
              className="mt-2 h-12 w-full rounded-full bg-amber-900 font-bold text-white shadow-sm transition-colors hover:bg-amber-950"
            >
              ENTRAR
            </button>
          </form>

          {/* RODAPÉ DO CARD: LINK PARA CADASTRO */}
          <div className="border-t border-stone-200 pt-4 text-center text-xs font-normal text-stone-600">
            Ainda não tem uma conta?{' '}
            <Link to="/criar-conta" className="font-bold text-amber-900 hover:underline">
              Cadastre-se aqui
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}