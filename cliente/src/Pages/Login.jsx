import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../context/ToastContext";

// Só aceita caminhos internos para evitar redirecionamento aberto.
const destinoSeguro = (valor) =>
  typeof valor === "string" && /^\/(?![/\\])/.test(valor) ? valor : null;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = destinoSeguro(searchParams.get("redirect"));
  const toast = useToast();

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const resposta = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const data = await resposta.json();
      if (!resposta.ok) {
        throw new Error(data.erro || "Não foi possível fazer login.");
      }

      window.dispatchEvent(new Event("sessao-alterada"));
      navigate(redirect || data.destino || "/perfil", { replace: true });
    } catch (error) {
      toast(error.message || "Não foi possível fazer login.", "erro");
    }
  }

  return (
    <div className="flex-1 w-full flex items-center justify-center bg-[#FEF9F3] px-4 py-12">
      <div className="w-full max-w-lg flex flex-col justify-center items-center gap-5 text-center">
        
        <h1 className="text-[#422518] text-4xl md:text-5xl font-['Archivo']">
          ENTRAR
        </h1>

        <p className="text-[#422518] text-base font-['Work_Sans'] leading-relaxed">
          Com uma conta você finaliza suas compras, acompanha pedidos, assiste a todos os tutoriais e assina o Clube.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <input
            type="email"
            placeholder="Seu e-mail"
            name='email'
            className="w-full h-12 px-4 py-3 bg-white rounded-md outline outline-1 outline-orange-400/60 text-[#422518] placeholder-gray-400 font-['Work_Sans'] text-base focus:outline-2 focus:outline-[#422518]"
            required
          />

          <input
            type="password"
            placeholder="Senha"
            name='senha'
            className="w-full h-12 px-4 py-3 bg-white rounded-md outline outline-1 outline-orange-400/60 text-[#422518] placeholder-gray-400 font-['Work_Sans'] text-base focus:outline-2 focus:outline-[#422518]"
            required
          />

          <button
            type="submit"
            className="w-full h-12 px-6 py-3.5 bg-[#422518] hover:bg-[#602C16] transition-colors rounded-[30px] text-white font-['Archivo'] text-base cursor-pointer"
          >
            ENTRAR
          </button>

          <Link
            to="/esqueci-senha"
            className="text-[#422518] text-sm font-['Work_Sans'] underline hover:opacity-80 transition-opacity self-end"
          >
            Esqueci minha senha
          </Link>

        </form>

        <Link
          to={redirect ? `/cadastro?redirect=${encodeURIComponent(redirect)}` : "/cadastro"}
          className="text-[#422518] text-sm font-['Work_Sans'] underline hover:opacity-80 transition-opacity mt-2"
        >
          Ainda não tem conta? Criar agora
        </Link>

      </div>
    </div>
  );
}