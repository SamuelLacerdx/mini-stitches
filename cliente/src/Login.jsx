import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    console.log('Dados de Login:', { email, senha });
  };

  return (
    <div className="flex-1 w-full flex items-center justify-center bg-[#FEF8F0] px-4 py-12">
      <div className="w-full max-w-lg flex flex-col justify-center items-center gap-5 text-center">
        
        {/* Título */}
        <h1 className="text-[#3E2417] text-4xl md:text-5xl font-['Archivo_Black']">
          ENTRAR
        </h1>

        {/* Descrição */}
        <p className="text-[#3E2417] text-base font-['Work_Sans'] leading-relaxed">
          Com uma conta você acompanha pedidos, assiste a todos os tutoriais e assina o Clube. Para comprar, não precisa de cadastro.
        </p>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 py-3 bg-white rounded-md outline outline-1 outline-orange-400/60 text-[#3E2417] placeholder-gray-400 font-['Work_Sans'] text-base focus:outline-2 focus:outline-[#3E2417]"
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full h-12 px-4 py-3 bg-white rounded-md outline outline-1 outline-orange-400/60 text-[#3E2417] placeholder-gray-400 font-['Work_Sans'] text-base focus:outline-2 focus:outline-[#3E2417]"
            required
          />

          
          <Link to="/Perfil"
          className="w-full h-12 px-6 py-3.5 bg-[#3E2417] hover:bg-[#602D15] transition-colors rounded-[30px] text-white font-['Archivo_Black'] text-base cursor-pointer">
            ENTRAR
          </Link>
          
        </form>

        {/* Botão Google */}
        <button
          type="button"
          className="w-full h-12 px-6 py-3.5 bg-white hover:bg-orange-50 transition-colors rounded-[30px] outline outline-1 outline-[#3E2417] text-[#3E2417] font-['Archivo_Black'] text-sm cursor-pointer"
        >
          CONTINUAR COM GOOGLE
        </button>

        {/* Link para Criar Conta */}
        <Link
          to="/cadastro"
          className="text-[#3E2417] text-sm font-['Work_Sans'] underline hover:opacity-80 transition-opacity mt-2"
        >
          Ainda não tem conta? Criar agora
        </Link>

      </div>
    </div>
  );
}