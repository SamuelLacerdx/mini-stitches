import { useState } from 'react';

const STATUS_TROCA = {
  em_analise: { rotulo: 'Em análise', classe: 'bg-yellow-100' },
  aprovada: { rotulo: 'Aprovada', classe: 'bg-green-100' },
  recusada: { rotulo: 'Recusada', classe: 'bg-red-100' },
};

export default function Trocas() {
  // Estado 1: Controla se a solicitação é de 'TROCA' ou 'DEVOLUÇÃO'
  const [tipoSolicitacao, setTipoSolicitacao] = useState('TROCA');
  const [form, setForm] = useState({ numeroPedido: '', email: '', motivo: '' });
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  // Solicitações já feitas para o pedido informado (consulta sem conta).
  const [solicitacoes, setSolicitacoes] = useState(null);
  const [consultando, setConsultando] = useState(false);

  const consultarSolicitacoes = async ({ numeroPedido, email }) => {
    setConsultando(true);
    try {
      const resposta = await fetch('/api/trocas/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroPedido, email }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(dados.erro || 'Não foi possível consultar as solicitações.');
      }
      setSolicitacoes(dados.trocas || []);
    } catch (error) {
      setSolicitacoes(null);
      setMensagem({ tipo: 'erro', texto: error.message });
    } finally {
      setConsultando(false);
    }
  };

  const handleConsultar = () => {
    setMensagem({ tipo: '', texto: '' });
    if (!form.numeroPedido.trim() || !form.email.trim()) {
      setMensagem({
        tipo: 'erro',
        texto: 'Preencha o número do pedido e o e-mail para acompanhar.',
      });
      return;
    }
    consultarSolicitacoes(form);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((anterior) => ({ ...anterior, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setEnviando(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      const resposta = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tipo: tipoSolicitacao === 'TROCA' ? 'troca' : 'devolucao',
        }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(dados.erro || 'Não foi possível enviar a solicitação.');
      }

      setForm((anterior) => ({ ...anterior, motivo: '' }));
      consultarSolicitacoes(form);
      setMensagem({
        tipo: 'sucesso',
        texto: `Solicitação de ${tipoSolicitacao.toLowerCase()} do pedido ${dados.troca.numeroPedido} recebida! Vamos analisar e responder no e-mail da compra.`,
      });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: error.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] py-12 px-6 font-['Work_Sans'] text-[#3E2417]">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* COLUNA 1: TEXTOS INFORMATIVOS */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-['Archivo_Black'] text-[#3E2417] leading-tight">
            TROCAS E<br />DEVOLUÇÕES
          </h1>
          <div className="space-y-4 text-base leading-relaxed text-[#3E2417]">
            <p>
              Você tem 7 dias após o recebimento para desistir da compra. Kits com defeito são trocados sem custo.
            </p>
            <p>
              Não precisa ter conta: use o número do pedido e o e-mail da compra.
            </p>
          </div>
        </div>

        {/* COLUNA 2: FORMULÁRIO DE SOLICITAÇÃO */}
        <div className="bg-[#FEF8F0] space-y-4">
          
          {/* SELETOR DE ABA (TROCA / DEVOLUÇÃO) */}
          <div className="flex gap-0.5 p-1">
            <button
              type="button"
              onClick={() => setTipoSolicitacao('TROCA')}
              className={`flex-1 py-3 rounded-full text-sm font-['Archivo_Black'] uppercase transition-colors cursor-pointer ${
                tipoSolicitacao === 'TROCA'
                  ? 'bg-[#3E2417] text-white'
                  : 'bg-white text-[#3E2417]'
              }`}
            >
              TROCA
            </button>
            <button
              type="button"
              onClick={() => setTipoSolicitacao('DEVOLUÇÃO')}
              className={`flex-1 py-3 rounded-full text-sm font-['Archivo_Black'] uppercase transition-colors cursor-pointer ${
                tipoSolicitacao === 'DEVOLUÇÃO'
                  ? 'bg-[#3E2417] text-white'
                  : 'bg-white text-[#3E2417]'
              }`}
            >
              DEVOLUÇÃO
            </button>
          </div>

          {/* FORMULÁRIO */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo: Número do Pedido */}
            <div>
              <input
                type="text"
                name="numeroPedido"
                value={form.numeroPedido}
                onChange={handleChange}
                placeholder="Número do pedido (ex.: MS-1001)"
                required
                className="w-full h-14 px-4 bg-white rounded-lg border border-pink-200 text-base text-[#3E2417] placeholder-stone-400 focus:outline-none focus:border-[#3E2417]"
              />
            </div>

            {/* Campo: E-mail da Compra */}
            <div>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="E-mail da compra"
                required
                className="w-full h-14 px-4 bg-white rounded-lg border border-pink-200 text-base text-[#3E2417] placeholder-stone-400 focus:outline-none focus:border-[#3E2417]"
              />
            </div>

            {/* Campo: Motivo */}
            <div>
              <textarea
                name="motivo"
                value={form.motivo}
                onChange={handleChange}
                placeholder="Motivo"
                rows="4"
                minLength={10}
                maxLength={1000}
                required
                className="w-full p-4 bg-white rounded-lg border border-pink-200 text-base text-[#3E2417] placeholder-stone-400 focus:outline-none focus:border-[#3E2417] resize-none"
              />
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={enviando}
              className="w-full h-14 bg-[#3E2417] hover:bg-[#602D15] text-white font-['Archivo_Black'] text-sm uppercase tracking-widest rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {enviando ? 'ENVIANDO...' : 'ENVIAR SOLICITAÇÃO'}
            </button>

            {mensagem.texto && (
              <div
                role="status"
                className={`rounded-lg border px-4 py-3 text-sm ${
                  mensagem.tipo === 'sucesso'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {mensagem.texto}
              </div>
            )}
          </form>

          <button
            type="button"
            onClick={handleConsultar}
            disabled={consultando}
            className="w-full text-sm font-semibold text-[#3E2417] underline hover:opacity-80 disabled:opacity-60 cursor-pointer"
          >
            {consultando
              ? 'Consultando...'
              : 'Acompanhar solicitações deste pedido'}
          </button>

          {solicitacoes && (
            <div className="space-y-3">
              <h2 className="text-sm font-['Archivo_Black'] uppercase">
                Suas solicitações
              </h2>
              {solicitacoes.length === 0 ? (
                <p className="text-sm text-stone-600">
                  Nenhuma solicitação encontrada para esse pedido e e-mail.
                </p>
              ) : (
                solicitacoes.map((troca) => {
                  const status = STATUS_TROCA[troca.status] || {
                    rotulo: troca.status,
                    classe: 'bg-stone-200',
                  };
                  return (
                    <div
                      key={troca._id}
                      className="bg-white rounded-lg border border-pink-200 p-4 text-sm space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {troca.tipo === 'devolucao' ? 'Devolução' : 'Troca'} ·{' '}
                          {troca.numeroPedido} ·{' '}
                          {new Date(troca.criadoEm).toLocaleDateString('pt-BR')}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-medium text-yellow-900 ${status.classe}`}
                        >
                          {status.rotulo}
                        </span>
                      </div>
                      <p className="text-stone-600 whitespace-pre-line">
                        {troca.motivo}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}