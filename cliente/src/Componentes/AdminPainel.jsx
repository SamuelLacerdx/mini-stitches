import { useCallback, useEffect, useState } from "react";

const STATUS_PEDIDO = {
  aguardando_pagamento: {
    rotulo: "Aguardando pagamento",
    cor: "bg-amber-100 text-amber-800",
  },
  pago: { rotulo: "Pago", cor: "bg-green-100 text-green-800" },
  em_separacao: { rotulo: "Em separação", cor: "bg-blue-100 text-blue-800" },
  enviado: { rotulo: "Enviado", cor: "bg-indigo-100 text-indigo-800" },
  entregue: { rotulo: "Entregue", cor: "bg-emerald-100 text-emerald-800" },
  cancelado: { rotulo: "Cancelado", cor: "bg-red-100 text-red-700" },
};

// Status definidos só pelo Mercado Pago; o admin não pode atribuí-los.
const STATUS_SO_GATEWAY = ["aguardando_pagamento", "pago"];

const PAGAMENTO = { pix: "Pix", cartao: "Cartão", boleto: "Boleto" };

const formatarReais = (centavos) =>
  (Number(centavos || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatarData = (data) =>
  data
    ? new Date(data).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

// Busca JSON de uma rota do admin e devolve { dados, erro, carregando, recarregar }.
function useAdminFetch(url) {
  const [versao, setVersao] = useState(0);
  const chave = `${url}#${versao}`;
  const [estado, setEstado] = useState({ chave: null, dados: null, erro: "" });

  useEffect(() => {
    let cancelado = false;

    fetch(url, { credentials: "include" })
      .then(async (resposta) => {
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
          throw new Error(dados.erro || "Erro ao carregar dados.");
        }
        if (!cancelado) setEstado({ chave, dados, erro: "" });
      })
      .catch((error) => {
        if (!cancelado) setEstado({ chave, dados: null, erro: error.message });
      });

    return () => {
      cancelado = true;
    };
  }, [url, chave]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  // Enquanto recarrega, mantém os dados anteriores na tela.
  const carregando = estado.chave !== chave && !estado.dados;
  return { dados: estado.dados, erro: estado.erro, carregando, recarregar };
}

function BadgeStatus({ status }) {
  const info = STATUS_PEDIDO[status] || {
    rotulo: status,
    cor: "bg-stone-100 text-stone-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase ${info.cor}`}
    >
      {info.rotulo}
    </span>
  );
}

function CardMetrica({ titulo, valor, detalhe }) {
  return (
    <div className="p-6 rounded-xl border border-stone-200 bg-[#FEF8F0]">
      <span className="text-stone-500 font-bold text-sm">{titulo}</span>
      <p className="text-3xl md:text-4xl font-bold text-[#602D15] mt-2">
        {valor}
      </p>
      {detalhe && <p className="text-xs text-stone-500 mt-1">{detalhe}</p>}
    </div>
  );
}

function Aviso({ erro, carregando, textoCarregando }) {
  if (carregando) return <p className="text-stone-500">{textoCarregando}</p>;
  if (erro)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {erro}
      </div>
    );
  return null;
}

export function VisaoGeral({ onVerPedidos }) {
  const { dados, erro, carregando } = useAdminFetch("/admin/dashboard");

  if (carregando || erro) {
    return (
      <Aviso
        erro={erro}
        carregando={carregando}
        textoCarregando="Carregando painel..."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardMetrica
          titulo="PEDIDOS"
          valor={dados.totalPedidos}
          detalhe="todos os status"
        />
        <CardMetrica
          titulo="FATURADO"
          valor={formatarReais(dados.faturado)}
          detalhe="pedidos com pagamento aprovado"
        />
        <CardMetrica
          titulo="TICKET MÉDIO"
          valor={formatarReais(dados.ticketMedio)}
        />
        <CardMetrica
          titulo="ASSINANTES CLUBE"
          valor={dados.assinantesAtivos}
          detalhe="assinaturas ativas"
        />
      </div>

      <div>
        <h2 className="text-lg font-bold text-[#3E2417] mb-3">
          Pedidos por status
        </h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_PEDIDO).map(([status, info]) => (
            <div
              key={status}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${info.cor}`}
            >
              {info.rotulo}: {dados.statusPedidos?.[status] ?? 0}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-[#3E2417]">Últimos pedidos</h2>
          <button
            type="button"
            onClick={onVerPedidos}
            className="text-sm font-semibold text-amber-800 underline hover:opacity-80"
          >
            Ver todos
          </button>
        </div>
        {dados.ultimosPedidos.length === 0 ? (
          <p className="text-stone-500">Nenhum pedido registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-[#FEF8F0] text-left text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {dados.ultimosPedidos.map((pedido) => (
                  <tr key={pedido._id} className="border-t border-stone-100">
                    <td className="px-4 py-3 font-bold text-[#3E2417]">
                      {pedido.numero}
                    </td>
                    <td className="px-4 py-3">{pedido.cliente?.nome}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatarData(pedido.criadoEm)}
                    </td>
                    <td className="px-4 py-3 font-bold whitespace-nowrap">
                      {formatarReais(pedido.total)}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeStatus status={pedido.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DetalhePedido({ pedido, onAtualizado }) {
  const [status, setStatus] = useState(pedido.status);
  const aguardandoPagamento = pedido.status === "aguardando_pagamento";
  const [rastreio, setRastreio] = useState(pedido.rastreio || "");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });

  const salvar = async () => {
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });
    try {
      const resposta = await fetch(`/admin/pedidos/${pedido._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, rastreio }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao atualizar o pedido.");
      }
      setMensagem({ tipo: "sucesso", texto: "Pedido atualizado." });
      onAtualizado();
    } catch (error) {
      setMensagem({ tipo: "erro", texto: error.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-white rounded-xl border border-stone-200 p-4 text-sm text-stone-700">
      <div>
        <p className="font-bold text-[#3E2417] mb-2">Cliente</p>
        <p>{pedido.cliente?.nome}</p>
        <p className="break-all">{pedido.cliente?.email}</p>
        <p className="font-bold text-[#3E2417] mt-3 mb-2">Entrega</p>
        <p>{pedido.entrega?.endereco}</p>
        <p>CEP {pedido.entrega?.cep}</p>
      </div>

      <div>
        <p className="font-bold text-[#3E2417] mb-2">Itens</p>
        <ul className="space-y-1">
          {pedido.itens.map((item) => (
            <li key={item.slug} className="flex justify-between gap-2">
              <span>
                {item.quantidade}× {item.nome}
              </span>
              <span className="whitespace-nowrap">
                {formatarReais(item.precoUnit * item.quantidade)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-stone-200 pt-2 space-y-1">
          <p className="flex justify-between">
            <span>Subtotal</span> <span>{formatarReais(pedido.subtotal)}</span>
          </p>
          <p className="flex justify-between">
            <span>Frete</span> <span>{formatarReais(pedido.frete)}</span>
          </p>
          {pedido.desconto > 0 && (
            <p className="flex justify-between">
              <span>Desconto</span>
              <span>- {formatarReais(pedido.desconto)}</span>
            </p>
          )}
          <p className="flex justify-between font-bold text-[#3E2417]">
            <span>Total</span> <span>{formatarReais(pedido.total)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-bold text-[#3E2417]">Atualizar pedido</p>
        <label className="flex flex-col gap-1 font-medium">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={aguardandoPagamento}
            className="border border-stone-300 rounded-xl px-3 py-2 bg-white disabled:bg-stone-100 disabled:text-stone-500"
          >
            {Object.entries(STATUS_PEDIDO).map(([valor, info]) => (
              <option
                key={valor}
                value={valor}
                disabled={
                  STATUS_SO_GATEWAY.includes(valor) && valor !== pedido.status
                }
              >
                {info.rotulo}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-stone-500">
          {aguardandoPagamento
            ? "O status muda automaticamente quando o pagamento for confirmado."
            : "“Aguardando pagamento” e “Pago” são definidos apenas pelo pagamento."}
        </p>
        <label className="flex flex-col gap-1 font-medium">
          Código de rastreio
          <input
            value={rastreio}
            onChange={(e) => setRastreio(e.target.value)}
            placeholder="Ex.: BR123456789BR"
            className="border border-stone-300 rounded-xl px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="w-full bg-[#3E2417] text-white font-bold px-4 py-2 rounded-xl hover:bg-[#602D15] disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        {mensagem.texto && (
          <p
            className={
              mensagem.tipo === "sucesso" ? "text-green-700" : "text-red-700"
            }
          >
            {mensagem.texto}
          </p>
        )}
        {pedido.historicoStatus?.length > 0 && (
          <div>
            <p className="font-bold text-[#3E2417] mb-1">Histórico</p>
            <ul className="text-xs space-y-1">
              {pedido.historicoStatus.map((h, i) => (
                <li key={i}>
                  {formatarData(h.em)} —{" "}
                  {STATUS_PEDIDO[h.status]?.rotulo || h.status}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function PedidosAdmin() {
  const [filtro, setFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState(null);
  const { dados, erro, carregando, recarregar } = useAdminFetch(
    `/admin/pedidos${filtro ? `?status=${filtro}` : ""}`,
  );

  const termo = busca.trim().toLowerCase();
  const pedidos = (dados?.pedidos || []).filter(
    (p) =>
      !termo ||
      p.numero?.toLowerCase().includes(termo) ||
      p.cliente?.nome?.toLowerCase().includes(termo) ||
      p.cliente?.email?.toLowerCase().includes(termo),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#3E2417]">Todos os pedidos</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nº, nome ou e-mail"
            className="border border-stone-300 rounded-xl px-3 py-2 text-sm"
          />
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_PEDIDO).map(([valor, info]) => (
              <option key={valor} value={valor}>
                {info.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {carregando || erro ? (
        <Aviso
          erro={erro}
          carregando={carregando}
          textoCarregando="Carregando pedidos..."
        />
      ) : pedidos.length === 0 ? (
        <p className="text-stone-500">Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => (
            <div
              key={pedido._id}
              className="rounded-2xl border border-stone-200 bg-[#FEF8F0]"
            >
              <button
                type="button"
                onClick={() =>
                  setAbertoId(abertoId === pedido._id ? null : pedido._id)
                }
                className="w-full flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left text-sm"
              >
                <span className="font-black text-[#3E2417] min-w-20">
                  {pedido.numero}
                </span>
                <span className="flex-1 min-w-40">
                  {pedido.cliente?.nome}
                  <span className="block text-xs text-stone-500 break-all">
                    {pedido.cliente?.email}
                  </span>
                </span>
                <span className="text-stone-600 whitespace-nowrap">
                  {formatarData(pedido.criadoEm)}
                </span>
                <span className="text-stone-600">
                  {PAGAMENTO[pedido.pagamento] || pedido.pagamento}
                </span>
                <span className="font-bold text-[#3E2417] whitespace-nowrap">
                  {formatarReais(pedido.total)}
                </span>
                <BadgeStatus status={pedido.status} />
              </button>
              {abertoId === pedido._id && (
                <div className="px-4 pb-4">
                  <DetalhePedido pedido={pedido} onAtualizado={recarregar} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClubeAdmin() {
  const { dados, erro, carregando } = useAdminFetch("/admin/assinaturas");

  if (carregando || erro) {
    return (
      <Aviso
        erro={erro}
        carregando={carregando}
        textoCarregando="Carregando assinantes..."
      />
    );
  }

  const assinaturas = dados.assinaturas || [];
  const ativas = assinaturas.filter((a) => !a.canceladoEm);
  const receitaMensal = ativas.reduce((soma, a) => {
    const valor = a.plano?.valor || 0;
    return soma + (a.plano?.nome === "trimestral" ? valor / 3 : valor);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardMetrica titulo="ASSINANTES ATIVOS" valor={ativas.length} />
        <CardMetrica
          titulo="CANCELADOS"
          valor={assinaturas.length - ativas.length}
        />
        <CardMetrica
          titulo="RECEITA MENSAL ESTIMADA"
          valor={formatarReais(Math.round(receitaMensal))}
        />
      </div>

      <h2 className="text-xl font-bold text-[#3E2417]">Assinantes</h2>
      {assinaturas.length === 0 ? (
        <p className="text-stone-500">
          Nenhum assinante ainda. Assim que o checkout do Clube estiver ativo,
          as assinaturas aparecerão aqui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-[#FEF8F0] text-left text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Assinado em</th>
                <th className="px-4 py-3">Caixa</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {assinaturas.map((a) => (
                <tr key={a._id} className="border-t border-stone-100">
                  <td className="px-4 py-3">
                    {a.clienteId?.nome || "Cliente removido"}
                    <span className="block text-xs text-stone-500">
                      {a.clienteId?.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {a.plano?.nome} · {formatarReais(a.plano?.valor)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatarData(a.assinadoEm)}
                  </td>
                  <td className="px-4 py-3 capitalize">{a.statusCaixa}</td>
                  <td className="px-4 py-3">
                    {a.canceladoEm ? (
                      <span className="text-red-700 font-bold">
                        Cancelada em {formatarData(a.canceladoEm)}
                      </span>
                    ) : (
                      <span className="text-green-700 font-bold">Ativa</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
