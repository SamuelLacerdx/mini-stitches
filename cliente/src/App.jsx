import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./assets/Componentes/Header";
import Footer from "./assets/Componentes/Footer";
import Home from "./Home";
import CriarConta from "./CriarConta";
import Kits from "./Kits";
import Carrinho from "./Carrinho";
import Admin from "./Admin";
import Materiais from "./Materiais";
import Login from "./Login";
import Perfil from "./Perfil";
import Clube from "./Clube";
import Trocas from "./Trocas";
import DetalheProd from "./DetalheProd";
import NossaHistoria from "./Nossahistoria";
import Contato from "./Contato";
import Tutorial from "./Tutorial";

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
            <Route path="/DetalheProd" element={<DetalheProd />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
