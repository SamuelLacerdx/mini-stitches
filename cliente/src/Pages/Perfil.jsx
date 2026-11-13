import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

const enderecoVazio = {
  apelido: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  principal: false,
};

const STATUS_PEDIDO = {
  aguardando_pagamento: {
    rotulo: "Aguardando pagamento",
    classe: "bg-yellow-100",
  },
  pago: { rotulo: "Pago", classe: "bg-green-100" },
  em_separacao: { rotulo: "Em separação", classe: "bg-orange-100" },
  enviado: { rotulo: "Enviado", classe: "bg-blue-100" },
  entregue: { rotulo: "Entregue", classe: "bg-pink-200" },
  cancelado: { rotulo: "Cancelado", classe: "bg-stone-200" },
};

const formatarPreco = (centavos) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(centavos || 0) / 100,
  );

export default function Perfil() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState({ enderecos: [] });
  const [enderecoForm, setEnderecoForm] = useState(enderecoVazio);
  const [mostrarFormularioEndereco, setMostrarFormularioEndereco] =
    useState(false);
  const [cepStatus, setCepStatus] = useState("");
  const cepConsultaAtual = useRef("");
  const enderecos = usuario.enderecos || [];
  const [pedidos, setPedidos] = useState([]);
  const [statusPedidos, setStatusPedidos] = useState("carregando");

  async function sair(event) {
    event.preventDefault();

    try {
      const resposta = await fetch("/sair", {
        method: "POST",
        credentials: "include",
      });
      const data = await resposta.json();
      if (!resposta.ok) {
        throw new Error(data.erro || "Não foi possível sair da conta.");
      }

      navigate("/");
    } catch (error) {
      alert(error.message || "Não foi possível sair da conta.");
    }
  }

  useEffect(() => {
    fetch("/api/perfil", { credentials: "include" })
      .then(async (resposta) => {
        const data = await resposta.json();
        if (!resposta.ok) {
          throw new Error(data.erro || "Erro ao carregar perfil.");
        }
        setUsuario(data.usuario);
      })
      .catch((error) => alert(error.message || "Erro ao carregar perfil."));

    fetch("/api/pedidos", { credentials: "include" })
      .then(async (resposta) => {
        const data = await resposta.json();
        if (!resposta.ok) {
          throw new Error(data.erro || "Erro ao carregar pedidos.");
        }
        setPedidos(data.pedidos || []);
        setStatusPedidos("ok");
      })
      .catch(() => setStatusPedidos("erro"));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setUsuario((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const resposta = await fetch("/perfil/atualizar", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: usuario.email,
        telefone: usuario.telefone,
        nascimento: usuario.nascimento,
      }),
    });

    const texto = await resposta.text();

    let data;
    try {
      data = JSON.parse(texto);
    } catch {
      data = { erro: texto };
    }

    if (!resposta.ok) {
      alert(data.erro || "Erro ao atualizar perfil");
      return;
    }

    alert("Perfil atualizado!");
  }

  async function salvarEndereco(e) {
    e.preventDefault();

    try {
      const resposta = await fetch("/perfil/enderecos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enderecoForm),
      });
      const data = await resposta.json();
      if (!resposta.ok) {
        throw new Error(data.erro || "Erro ao salvar o endereço.");
      }

      setUsuario((prev) => ({ ...prev, enderecos: data.enderecos }));
      setEnderecoForm(enderecoVazio);
      setMostrarFormularioEndereco(false);
      alert("Endereço salvo!");
    } catch (error) {
      alert(error.message || "Erro ao salvar o endereço.");
    }
  }

  async function definirEnderecoPrincipal(enderecoId) {
    try {
      const resposta = await fetch(
        `/perfil/enderecos/${enderecoId}/principal`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );
      const data = await resposta.json();
      if (!resposta.ok) {
        throw new Error(data.erro || "Erro ao definir endereço principal.");
      }

      setUsuario((prev) => ({ ...prev, enderecos: data.enderecos }));
    } catch (error) {
      alert(error.message || "Erro ao definir endereço principal.");
    }
  }

  async function excluirEndereco(enderecoId) {
    if (!window.confirm("Deseja realmente excluir este endereço?")) {
      return;
    }

    try {
      const resposta = await fetch(`/perfil/enderecos/${enderecoId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await resposta.json();
      if (!resposta.ok) {
        throw new Error(data.erro || "Erro ao excluir o endereço.");
      }

      setUsuario((prev) => ({ ...prev, enderecos: data.enderecos }));
    } catch (error) {
      alert(error.message || "Erro ao excluir o endereço.");
    }
  }

  function handleEnderecoChange(e) {
    const { name, value } = e.target;
    setEnderecoForm((prev) => ({
      ...prev,
      [name]: name === "estado" ? value.toUpperCase() : value,
    }));

    if (name === "cep") {
      const cep = value.replace(/\D/g, "");
      cepConsultaAtual.current = cep.length === 8 ? cep : "";
      setCepStatus("");

      if (cep.length === 8) {
        setCepStatus("Buscando endereço...");
        fetch(`/api/cep/${cep}`)
          .then(async (resposta) => {
            const data = await resposta.json();
            if (!resposta.ok) {
              throw new Error(data.erro || "Erro ao consultar o CEP.");
            }
            return data.endereco;
          })
          .then((endereco) => {
            if (cepConsultaAtual.current !== cep) {
              return;
            }

            setEnderecoForm((prev) => ({
              ...prev,
              rua: endereco.rua,
              bairro: endereco.bairro,
              cidade: endereco.cidade,
              estado: endereco.estado,
            }));
            setCepStatus("Endereço preenchido.");
          })
          .catch((error) => {
            if (cepConsultaAtual.current === cep) {
              setCepStatus(error.message || "Erro ao consultar o CEP.");
            }
          });
      }
    }
  }

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] px-4 py-8 md:px-12 md:py-12 text-[#3E2417] font-['Work_Sans']">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Cabecalho da Página */}
        <div className="flex justify-between items-center border-b border-orange-200/60 pb-4">
          <h1 className="text-3xl md:text-4xl font-['Archivo_Black'] text-[#3E2417]">
            MINHA CONTA
          </h1>
          <Link
            to="/"
            onClick={sair}
            className="text-amber-800 text-sm font-semibold underline hover:opacity-80"
          >
            Sair
          </Link>
        </div>

        {/* SECÇÃO 1: MEUS DADOS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-6">
          <h2 className="text-lg font- font-['Archivo_Black'] border-b border-stone-200 pb-3">
            MEUS DADOS
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Nome completo
                </label>
                <input
                  type="text"
                  name="nome"
                  readOnly
                  value={usuario.nome || ""}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-[#3E2417] focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">E-mail</label>
                <input
                  type="email"
                  name="email"
                  value={usuario.email || ""}
                  onChange={handleChange}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Celular
                </label>
                <input
                  type="text"
                  name="telefone"
                  value={usuario.telefone || ""}
                  onChange={handleChange}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">CPF</label>
                <input
                  type="text"
                  name="cpf"
                  value={usuario.cpf || ""}
                  readOnly
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Data de nascimento
                </label>
                <input
                  type="text"
                  placeholder="dd/mm/aaaa"
                  name="nascimento"
                  value={usuario.nascimento || ""}
                  onChange={handleChange}
                  className="w-full h-10 px-3 bg-white rounded-md border border-orange-400/30 text-xs text-stone-600 focus:outline-none focus:border-[#3E2417]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-[#3E2417] hover:bg-[#602D15] transition-colors rounded-md text-white font-['Archivo_Black'] text-xs uppercase"
            >
              SALVAR DADOS
            </button>
          </form>
        </section>

        {/* SECÇÃO 2: ENDEREÇOS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-stone-200 pb-3">
            <h2 className="text-lg font-['Archivo_Black']">ENDEREÇOS</h2>
            <button
              type="button"
              onClick={() => {
                setEnderecoForm(enderecoVazio);
                setMostrarFormularioEndereco(true);
              }}
              className="px-3 py-1.5 bg-[#FEF8F0] border border-orange-400/50 rounded-md text-xs font-bold text-yellow-900 hover:bg-orange-100 transition-colors"
            >
              + NOVO
            </button>
          </div>

          {enderecos.length === 0 && (
            <p className="text-sm text-stone-500">
              Você ainda não cadastrou nenhum endereço.
            </p>
          )}

          {enderecos.map((endereco) => (
            <div
              key={endereco._id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#FEF8F0]/50 rounded-lg border border-orange-200/50"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-0.5 bg-orange-400 text-white rounded text-[10px] font-bold">
                  {endereco.apelido}
                </span>
                {endereco.principal && (
                  <span className="px-2 py-0.5 bg-stone-300 text-yellow-900 rounded text-[10px] font-bold">
                    Padrão
                  </span>
                )}
                <p className="text-stone-700 font-medium">
                  {[
                    `${endereco.rua}, ${endereco.numero}`,
                    endereco.complemento,
                    endereco.bairro,
                    `${endereco.cidade}/${endereco.estado}`,
                    `CEP ${endereco.cep}`,
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>

              <div className="flex items-center gap-4 self-start sm:self-auto">
                {!endereco.principal && (
                  <button
                    type="button"
                    onClick={() => definirEnderecoPrincipal(endereco._id)}
                    className="text-xs text-amber-800 underline font-semibold hover:opacity-80"
                  >
                    DEFINIR COMO PRINCIPAL
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => excluirEndereco(endereco._id)}
                  className="text-xs text-amber-800 underline font-semibold hover:opacity-80"
                >
                  EXCLUIR
                </button>
              </div>
            </div>
          ))}

          {mostrarFormularioEndereco && (
            <form
              onSubmit={salvarEndereco}
              className="p-4 bg-[#FEF8F0] rounded-xl border border-orange-300/60 space-y-4"
            >
              <h3 className="text-xs font-['Archivo_Black'] text-[#3E2417]">
                ADICIONAR NOVO ENDEREÇO
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="md:col-span-2">
                  <label className="block mb-1">
                    Apelido (Casa, Trabalho...)
                  </label>
                  <input
                    type="text"
                    name="apelido"
                    value={enderecoForm.apelido}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1">CEP</label>
                  <input
                    type="text"
                    name="cep"
                    value={enderecoForm.cep}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    inputMode="numeric"
                    maxLength={9}
                    required
                  />
                  {cepStatus && (
                    <p
                      className="mt-1 text-[11px]"
                      role="status"
                      aria-live="polite"
                    >
                      {cepStatus}
                    </p>
                  )}
                </div>
                <div className="md:col-span-3">
                  <label className="block mb-1">Rua</label>
                  <input
                    type="text"
                    name="rua"
                    value={enderecoForm.rua}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block mb-1">Número</label>
                  <input
                    type="text"
                    name="numero"
                    value={enderecoForm.numero}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1">Complemento</label>
                  <input
                    type="text"
                    name="complemento"
                    value={enderecoForm.complemento}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-1">Bairro</label>
                  <input
                    type="text"
                    name="bairro"
                    value={enderecoForm.bairro}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block mb-1">Cidade</label>
                  <input
                    type="text"
                    name="cidade"
                    value={enderecoForm.cidade}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block mb-1">UF</label>
                  <input
                    type="text"
                    name="estado"
                    value={enderecoForm.estado}
                    onChange={handleEnderecoChange}
                    className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                    maxLength={2}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  id="principal"
                  checked={enderecoForm.principal}
                  onChange={(e) =>
                    setEnderecoForm((prev) => ({
                      ...prev,
                      principal: e.target.checked,
                    }))
                  }
                />
                <label htmlFor="principal">Usar como endereço principal</label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#3E2417] text-white rounded text-xs font-['Archivo_Black']"
                >
                  SALVAR ENDEREÇO
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarFormularioEndereco(false)}
                  className="px-5 py-2.5 bg-white border border-orange-400/50 text-yellow-900 rounded text-xs font-['Archivo_Black']"
                >
                  CANCELAR
                </button>
              </div>
            </form>
          )}
        </section>

        {/* SECÇÃO 3: CARTÕES */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-stone-200 pb-3">
            <h2 className="text-lg font-['Archivo_Black']">CARTÕES</h2>
            <button className="px-3 py-1.5 bg-[#FEF8F0] border border-orange-400/50 rounded-md text-xs font-bold text-yellow-900 hover:bg-orange-100 transition-colors">
              + NOVO
            </button>
          </div>

          <p className="text-sm font-semibold text-[#3E2417]">
            Nenhum cartão salvo.
          </p>
          <p className="text-xs text-stone-500 leading-relaxed max-w-3xl">
            Por segurança, guardamos só a bandeira e os 4 últimos números. O
            bilhete completo é o código iniciado (hash seguro — quando o Mercado
            Pago faz o ajuste, ele é enviado com segurança.)
          </p>

          {/* Formulário Novo Cartão */}
          <form className="p-4 bg-[#FEF8F0] rounded-xl border border-orange-300/60 space-y-4">
            <h3 className="text-xs font-['Archivo_Black'] text-[#3E2417]">
              ADICIONAR CARTÃO
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block mb-1">Número do cartão</label>
                <input
                  type="text"
                  className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Nome impresso no cartão</label>
                <input
                  type="text"
                  className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Validade (MM/AA)</label>
                <input
                  type="text"
                  placeholder="MM/AA"
                  className="w-full h-9 px-3 bg-white rounded border border-orange-400/30"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input type="checkbox" id="cartaoPrincipal" />
              <label htmlFor="cartaoPrincipal">
                Usar como cartão principal
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#3E2417] text-white rounded text-xs font-['Archivo_Black']"
              >
                SALVAR CARTÃO
              </button>
              <button
                type="button"
                className="px-5 py-2.5 bg-white border border-orange-400/50 text-yellow-900 rounded text-xs font-['Archivo_Black']"
              >
                CANCELAR
              </button>
            </div>
          </form>
        </section>

        {/* SECÇÃO 4: MEUS PEDIDOS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-4">
          <h2 className="text-lg font-['Archivo_Black'] border-b border-stone-200 pb-3">
            MEUS PEDIDOS
          </h2>
          {statusPedidos === "carregando" && (
            <p className="text-sm text-stone-500">Carregando pedidos...</p>
          )}
          {statusPedidos === "erro" && (
            <p className="text-sm text-red-700" role="alert">
              Não foi possível carregar seus pedidos.
            </p>
          )}
          {statusPedidos === "ok" && pedidos.length === 0 && (
            <p className="text-sm text-stone-500">
              Você ainda não fez nenhum pedido.
            </p>
          )}
          {pedidos.map((pedido) => {
            const status = STATUS_PEDIDO[pedido.status] || {
              rotulo: pedido.status,
              classe: "bg-stone-200",
            };
            const aguardandoPagamento =
              pedido.status === "aguardando_pagamento";
            const conteudo = (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <span className="font-semibold text-[#3E2417]">
                    {pedido.numero} -{" "}
                    {new Date(pedido.criadoEm).toLocaleDateString("pt-BR")}
                  </span>
                  <span
                    className={`px-3 py-1 text-yellow-900 font-medium rounded-full text-[11px] ${status.classe}`}
                  >
                    {status.rotulo}
                  </span>
                  <span className="font-semibold text-[#3E2417]">
                    {formatarPreco(pedido.total)}
                  </span>
                </div>
                <p className="text-stone-600">
                  {pedido.itens
                    .map((item) => `${item.quantidade}× ${item.nome}`)
                    .join(", ")}
                </p>
                {aguardandoPagamento && (
                  <p className="text-amber-800 font-semibold underline">
                    Finalizar pagamento →
                  </p>
                )}
              </>
            );

            if (aguardandoPagamento) {
              return (
                <Link
                  key={pedido.numero}
                  to="/checkout"
                  state={{ pedido }}
                  className="block p-4 bg-[#FEF8F0]/60 rounded-lg text-xs space-y-2 hover:bg-[#FEF8F0] transition-colors"
                >
                  {conteudo}
                </Link>
              );
            }

            return (
              <div
                key={pedido.numero}
                className="p-4 bg-[#FEF8F0]/60 rounded-lg text-xs space-y-2"
              >
                {conteudo}
              </div>
            );
          })}
        </section>

        {/* SECÇÃO 5: TROCAS */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-3">
          <h2 className="text-lg font-['Archivo_Black'] border-b border-stone-200 pb-3">
            TROCAS
          </h2>
          <p className="text-sm text-stone-700">Nenhuma troca em andamento.</p>
          <Link
            to="/trocas"
            className="inline-block text-xs text-[#3E2417] font-medium underline hover:opacity-80"
          >
            Pedir troca ou devolução
          </Link>
        </section>

        {/* SECÇÃO 6: CLUBE DA CAIXINHA */}
        <section className="bg-white p-6 md:p-8 rounded-2xl border border-orange-400/20 shadow-sm space-y-3">
          <h2 className="text-lg font-['Archivo_Black'] border-b border-stone-200 pb-3">
            CLUBE DA CAIXINHA
          </h2>
          <p className="text-sm text-stone-700">
            Você ainda não assina o Clube.{" "}
            <Link
              to="/clube"
              className="text-yellow-900 font-bold underline hover:opacity-80 ml-1"
            >
              Gerenciar
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}