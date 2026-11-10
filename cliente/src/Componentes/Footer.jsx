import React from "react";
import { Link } from "react-router-dom";
import logoMarca from "../assets/logo.svg";

export default function Footer() {
  return (
    <footer className="w-full font-['Work_Sans',sans-serif]">
      <div className="w-full bg-[#FDE7B2] px-6 py-12 text-[#3E1B0E] md:px-12 lg:px-16">
        <div className="mx-auto grid max-w-full grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-start gap-4">
            <Link to="/">
              <img
                src={logoMarca}
                alt="Logótipo Mini Stitches"
                className="h-14 w-auto object-contain"
              />
            </Link>
            <p className="max-w-xs text-sm font-normal leading-relaxed text-[#3E1B0E]/90">
              Bordando memórias, um ponto por vez.
              <br />
              Kits de fazer em casa para crianças criarem longe das telas.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-['Archivo_Black'] text-base font-normal uppercase text-[#3E1B0E]">
              {" "}
              DESCOBRIR{" "}
            </h3>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/kits" className="cursor-pointer transition-colors hover:underline">
                {" "}
                Todos os kits{" "}
              </Link>
              <Link
                to="/materiais"
                className="cursor-pointer transition-colors hover:underline"
              >
                {" "}
                Materiais{" "}
              </Link>
              <Link to="/tutorial" className="cursor-pointer transition-colors hover:underline">
                {" "}
                Vídeos passo a passo{" "}
              </Link>
              <Link
                to="/clube"
                className="cursor-pointer transition-colors hover:underline"
              >
                {" "}
                Clube da Caixinha{" "}
              </Link>
              <Link
                to="/nossa-historia"
                className="cursor-pointer transition-colors hover:underline"
              >
                {" "}
                Nossa história{" "}
              </Link>
              <Link
                to="/contato"
                className="cursor-pointer transition-colors hover:underline"
              >
                {" "}
                Fale com a gente{" "}
              </Link>
              <Link
                to="/carrinho"
                className="cursor-pointer transition-colors hover:underline"
              >
                {" "}
                Meu carrinho{" "}
              </Link>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-['Archivo_Black'] text-base font-normal uppercase text-[#3E1B0E]">
              AJUDA
            </h3>
            <ul className="flex flex-col gap-3 text-sm leading-snug">
              <li>Envio em até 2 dias úteis (PAC, Sedex e transportadora)</li>
              <li>Arrependimento: até 7 dias após receber</li>
              <li>Trocas da Linha Pronta em até 30 dias (1ª grátis)</li>
              <li>Garantia de 90 dias nos kits</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-['Archivo_Black'] text-base font-normal uppercase text-[#3E1B0E]">
              {" "}
              ONDE NOS ENCONTRAR{" "}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <a
                href="mailto:oi@ministitches.com.br"
                className="cursor-pointer transition-colors hover:underline"
              >
                {" "}
                oi@ministitches.com.br
              </a>
              <p>São Paulo, SP</p>
              <p>Seg a sex, 9h às 18h</p>
            </div>
          </div>
        </div>
      </div>
      <div className="h-12 w-full bg-[#4E2206]" />
    </footer>
  );
}
