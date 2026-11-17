import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./Componentes/Header";
import Footer from "./Componentes/Footer";
import Home from "./Pages/Home";
import CriarConta from "./Pages/CriarConta";
import Kits from "./Pages/Kits";
import Carrinho from "./Pages/Carrinho";
import Materiais from "./Pages/Materiais";
import Login from "./Pages/Login";
import Clube from "./Pages/Clube";
import Trocas from "./Pages/Trocas";
import DetalheProd from "./Pages/DetalheProd";
import NossaHistoria from "./Pages/Nossahistoria";
import Contato from "./Pages/Contato";
import Tutorial from "./Pages/Tutorial";
import NotFound from "./Pages/NotFound";
import Busca from "./Pages/Busca";
import PedidoStatus from "./Pages/Pedido-status";
import EsqueciSenha from "./Pages/EsqueciSenha";
import NovaSenha from "./Pages/NovaSenha";
import CarrinhoProvider from './Componentes/CarrinhoProvider';
import CarrinhoLateral from './Componentes/CarrinhoLateral';
import ToastProvider from './Componentes/ToastProvider';
import SessaoProvider from './Componentes/SessaoProvider';

// Telas grandes e pouco visitadas: saem do pacote inicial. As páginas do
// catálogo ficam estáticas para a navegação não piscar um "carregando".
const Admin = lazy(() => import("./Pages/Admin"));
const Perfil = lazy(() => import("./Pages/Perfil"));
const Checkout = lazy(() => import("./Pages/Checkout"));

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <SessaoProvider>
      <CarrinhoProvider>
      <div className="flex min-h-screen flex-col justify-between">
        <Header />
        <main className="flex grow">
          <Suspense fallback={<p className="m-auto p-10 text-sm text-[#3E1B0E]">Carregando...</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cadastro" element={<CriarConta />} />
            <Route path="/kits" element={<Kits />} />
            <Route path="/materiais" element={<Materiais />} />
            <Route path="/carrinho" element={<Carrinho />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/nova-senha" element={<NovaSenha />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/clube" element={<Clube />} />
            <Route path="/trocas" element={<Trocas />} />
            <Route path="/produto/:slug" element={<DetalheProd />} />
            <Route path="/nossa-historia" element={<NossaHistoria />} />
            <Route path="/contato" element={<Contato />} />
            <Route path="/tutorial/:slug" element={<Tutorial />} />
            <Route path="/detalhe-produto" element={<DetalheProd />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/busca" element={<Busca />} />
            <Route path="/not-found" element={<NotFound />} />
            <Route path="/pedido-status/:id?" element={<PedidoStatus />} />
          </Routes>
          </Suspense>
        </main>
        <Footer />
        <CarrinhoLateral />
      </div>
      </CarrinhoProvider>
      </SessaoProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
