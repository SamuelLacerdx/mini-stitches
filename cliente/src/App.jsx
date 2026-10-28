import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importação dos componentes principais do layout (Cabeçalho e Rodapé)
import Header from './assets/Componentes/Header';
import Footer from './assets/Componentes/Footer';

// Importação das páginas (caminhos e nomes de arquivos corrigidos)
import Home from './assets/Componentes/Home';
import Kits from './assets/Componentes/Kits';
import DetalheKit from './assets/Componentes/Detalhekit'; // Arquivo real: Detalhekit.jsx
import ClubeDaCaixinha from './assets/Componentes/ClubeDaCaixinha';
import Carrinho from './assets/Componentes/carrinho';       // Arquivo real: carrinho.jsx
import CriarConta from './assets/Componentes/CriarConta';
import Login from './assets/Componentes/Login';
import MinhaConta from './assets/Componentes/MinhaConta';
import Materiais from './assets/Componentes/Materiais';
import Videos from './assets/Componentes/Videos';           // Arquivo real: Videos.jsx
import NossaHistoria from './assets/Componentes/NossaHistoria';
import FaleComAGente from './assets/Componentes/FaleComAgente'; // Arquivo real: FaleComAgente.jsx
import Trocas from './assets/Componentes/Trocar';           // Arquivo real: Trocar.jsx
import PainelLoja from './assets/Componentes/PainelLoja';
import NotFound from './assets/Componentes/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      {/* Container principal estruturado com Tailwind CSS */}
      <div className="flex min-h-screen flex-col justify-between bg-[#FFF9F5] text-[#3E1B0E]">
        
        {/* Cabeçalho fixo no topo da aplicação */}
        <Header />

        {/* Árvore de rotas que altera o conteúdo exibido conforme a URL */}
        <main className="flex grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/kits" element={<Kits />} />
            <Route path="/kits/:id" element={<DetalheKit />} />
            <Route path="/clube-da-caixinha" element={<ClubeDaCaixinha />} />
            <Route path="/carrinho" element={<Carrinho />} />
            <Route path="/criar-conta" element={<CriarConta />} />
            <Route path="/login" element={<Login />} />
            <Route path="/minha-conta" element={<MinhaConta />} />
            <Route path="/materiais" element={<Materiais />} />
            <Route path="/videos-passo-a-passo" element={<Videos />} />
            <Route path="/nossa-historia" element={<NossaHistoria />} />
            <Route path="/fale-com-a-gente" element={<FaleComAGente />} />
            <Route path="/trocas" element={<Trocas />} />
            <Route path="/painel-loja" element={<PainelLoja />} />
            
            {/* Rota coringa (*) para capturar qualquer endereço inexistente */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Rodapé fixo na base da aplicação */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}