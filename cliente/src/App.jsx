import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './assets/Componentes/Header';
import Footer from './assets/Componentes/Footer';
import Home from './Home';
import CriarConta from './CriarConta';
import Kits from './Kits';
import Carrinho from './Carrinho';
import Admin from './Admin';
import Materiais from './Materiais';
import Login from './Login';
import Perfil from './Perfil';
import Clube from './Clube';
import Trocas from './Trocas';
import DetalheProd from './DetalheProd';

export default function App() {
  
  return (
    <BrowserRouter>
    <div className="flex min-h-screen flex-col justify-between">
    <Header/>
    <main className="flex grow">
    <Routes>
      <Route path='/' element={<Home />}/>
      <Route path='/cadastro' element={<CriarConta />}/>
      <Route path='/Kits' element={<Kits />}/>
      <Route path='/Carrinho' element={<Carrinho />}/>
      <Route path='/Admin' element={<Admin />}/>
      <Route path='/Materiais' element={<Materiais />}/>
      <Route path='/Login' element={<Login />}/>
      <Route path='/perfil' element={<Perfil />}/>
      <Route path='/Clube' element={<Clube />}/>
      <Route path='/Trocas' element={<Trocas />}/>
      <Route path='/DetalheProd' element={<DetalheProd />}/>

    </Routes>
    </main>
    <Footer/>
    </div>
    </BrowserRouter>
  )
}