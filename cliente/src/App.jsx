import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './assets/Componentes/Header';
import Footer from './assets/Componentes/Footer';
import Home from './Home';
import CriarConta from './CriarConta';

export default function App() {
  
  return (
    <BrowserRouter>
    <div className="flex min-h-screen flex-col justify-between">
    <Header/>
    <main className="flex grow">
    <Routes>
      <Route path='/' element={<Home />}/>
      <Route path='/conta' element={<CriarConta />}/>
    </Routes>
    </main>
    <Footer/>
    </div>
    </BrowserRouter>
  )
}