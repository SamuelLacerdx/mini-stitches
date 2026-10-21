import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './assets/Componentes/Header';
import Footer from './assets/Componentes/Footer';

export default function App() {
  return (
    <BrowserRouter>
    <Header/>
    <Routes>
      <Route/>
    </Routes>
    <Footer/>
    </BrowserRouter>
  )
}