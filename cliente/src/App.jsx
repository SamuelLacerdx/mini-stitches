import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./Componentes/Header";
import Footer from "./Componentes/Footer";
import Home from "./Pages/Home";
import CriarConta from "./Pages/CriarConta";
import Kits from "./Pages/Kits";
import Carrinho from "./Pages/Carrinho";
import Admin from "./Pages/Admin";
import Materiais from "./Pages/Materiais";
import Login from "./Pages/Login";
import Perfil from "./Pages/Perfil";
import Clube from "./Pages/Clube";
import Trocas from "./Pages/Trocas";
import DetalheProd from "./Pages/DetalheProd";
import NossaHistoria from "./Pages/Nossahistoria";
import Contato from "./Pages/Contato";
import Tutorial from "./Pages/Tutorial";
import Checkout from "./Pages/Checkout";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col justify-between">
        <Header />
        <main className="flex grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cadastro" element={<CriarConta />} />
            <Route path="/kits" element={<Kits />} />
            <Route path="/materiais" element={<Materiais />} />
            <Route path="/carrinho" element={<Carrinho />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/clube" element={<Clube />} />
            <Route path="/trocas" element={<Trocas />} />
            <Route path="/produto/:slug" element={<DetalheProd />} />
            <Route path="/nossa-historia" element={<NossaHistoria />} />
            <Route path="/contato" element={<Contato />} />
            <Route path="/tutorial" element={<Tutorial />} />
            <Route path="/detalhe-produto" element={<DetalheProd />} />
            <Route path="/checkout" element={<Checkout />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
