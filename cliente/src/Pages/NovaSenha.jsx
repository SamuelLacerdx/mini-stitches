import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function NovaSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [mensagem, setMensagem] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const senha = form.get("senha");
    const confirmar = form.get("confirmar");

    if (senha !== confirmar) {
      setMensagem("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    setMensagem("");

    try {
      const resposta = await fetch("/api/nova-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const data = await resposta.json();
      setMensagem(data.mensagem);
      if (resposta.ok) setSucesso(true);
    } catch {
      setMensagem("Erro ao redefinir. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex-1 w-full flex items-center justify-center bg-[#FEF9F3] px-4 py-12">
      <div className="w-full max-w-lg flex flex-col justify-center items-center gap-5 text-center">

        <h1 className="text-[#422518] text-4xl md:text-5xl font-['Archivo']">
          NOVA SENHA
        </h1>

        {!token && (
          <>
            <p className="text-[#422518] text-base font-['Work_Sans'] leading-relaxed">
              Link inválido ou expirado. Solicite um novo link.
            </p>
            <Link
              to="/esqueci-senha"
              className="w-full h-12 px-6 py-3.5 bg-[#422518] hover:bg-[#602C16] transition-colors rounded-[30px] text-white font-['Archivo'] text-base flex items-center justify-center"
            >
              SOLICITAR NOVO LINK
            </Link>
            <Link
              to="/login"
              className="text-[#422518] text-sm font-['Work_Sans'] underline hover:opacity-80 transition-opacity"
            >
              Voltar ao login
            </Link>
          </>
        )}

        {token && !sucesso && (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <input
              type="password"
              name="senha"
              placeholder="Nova senha (mínimo 8 caracteres)"
              minLength={8}
              className="w-full h-12 px-4 py-3 bg-white rounded-md outline outline-1 outline-orange-400/60 text-[#422518] placeholder-gray-400 font-['Work_Sans'] text-base focus:outline-2 focus:outline-[#422518]"
              required
            />

            <input
              type="password"
              name="confirmar"
              placeholder="Confirme a nova senha"
              minLength={8}
              className="w-full h-12 px-4 py-3 bg-white rounded-md outline outline-1 outline-orange-400/60 text-[#422518] placeholder-gray-400 font-['Work_Sans'] text-base focus:outline-2 focus:outline-[#422518]"
              required
            />

            <button
              type="submit"
              disabled={enviando}
              className="w-full h-12 px-6 py-3.5 bg-[#422518] hover:bg-[#602C16] transition-colors rounded-[30px] text-white font-['Archivo'] text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? "SALVANDO..." : "SALVAR NOVA SENHA"}
            </button>
          </form>
        )}

        {mensagem && (
          <p className="text-[#422518] text-sm font-['Work_Sans']">{mensagem}</p>
        )}

        {sucesso && (
          <Link
            to="/login"
            className="w-full h-12 px-6 py-3.5 bg-[#422518] hover:bg-[#602C16] transition-colors rounded-[30px] text-white font-['Archivo'] text-base flex items-center justify-center"
          >
            IR PARA O LOGIN
          </Link>
        )}

      </div>
    </div>
  );
}
