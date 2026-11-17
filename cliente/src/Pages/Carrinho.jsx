import { useCarrinho } from '../context/CarrinhoContext';

const formatarPreco = (valorEmCentavos) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valorEmCentavos ?? 0) / 100);

export default function Carrinho() {
  const { itens, resumo, carregando, salvando, erro, alterar: alterarCarrinho, finalizarCompra: irParaCheckout, finalizando } = useCarrinho();
  const subtotal = resumo?.subtotal;
  const pixTotal = resumo?.produtosPix;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full flex flex-col lg:flex-row gap-12">
      <div className="flex-1">
        <h1 className="text-4xl font-['Archivo'] text-[#422518] mb-6">
          MEU CARRINHO
        </h1>
        <div className="border-b-2 border-orange-400/70 mb-4" />

        {erro && (
          <p
            role="alert"
            className="my-4 rounded-lg bg-red-50 p-3 text-red-700"
          >
            {erro}
          </p>
        )}

        {carregando ? (
          <p className="text-stone-500 my-8">Carregando carrinho...</p>
        ) : itens.length === 0 ? (
          <p className="text-stone-500 my-8">Seu carrinho está vazio.</p>
        ) : (
          itens.map((item) => (
            <div
              key={item.produtoId}
              className="py-4 border-b border-orange-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                {item.imagemUrl && (
                  <img
                    src={item.imagemUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-stone-200 object-cover"
                  />
                )}
                <div>
                  <h3 className="font-['Archivo'] text-base text-[#422518]">
                    {item.nome}
                  </h3>
                  <span className="text-xs text-stone-500">{item.tipo}</span>
                  {!item.ativo && (
                    <p className="text-xs text-red-600">
                      Este produto não está mais disponível.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center border border-orange-400 rounded-lg">
                  <button
                    type="button"
                    disabled={salvando || item.quantidade <= 1}
                    onClick={() =>
                      alterarCarrinho(
                        item.produtoId,
                        "PATCH",
                        item.quantidade - 1,
                      )
                    }
                    aria-label={`Diminuir quantidade de ${item.nome}`}
                    className="px-3 py-1 font-['Archivo'] text-[#422518] disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="px-3 text-sm font-['Archivo']">
                    {item.quantidade}
                  </span>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() =>
                      alterarCarrinho(
                        item.produtoId,
                        "PATCH",
                        item.quantidade + 1,
                      )
                    }
                    aria-label={`Aumentar quantidade de ${item.nome}`}
                    className="px-3 py-1 font-['Archivo'] text-[#422518] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <span className="font-['Archivo'] text-base text-[#422518]">
                  {formatarPreco(item.preco * item.quantidade)}
                </span>

                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => alterarCarrinho(item.produtoId, "DELETE")}
                  aria-label={`Remover ${item.nome} do carrinho`}
                  className="text-red-600 font-bold hover:opacity-80 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="w-full lg:w-96 bg-[#FFE6A2] p-6 rounded-xl flex flex-col gap-4 h-fit">
        <h2 className="text-xl font-['Archivo'] text-[#422518]">
          RESUMO
        </h2>
        <div className="border-b border-orange-400/50" />

        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatarPreco(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span>Frete</span>
          <span>Calculado no checkout</span>
        </div>

        <div className="border-b border-orange-400/50" />

        <div className="flex justify-between font-['Archivo'] text-base">
          <span>No Pix (5% off)</span>
          <span>{formatarPreco(pixTotal)}</span>
        </div>

        <button
          type="button"
          disabled={!resumo?.podeContinuar || carregando || salvando || finalizando || Boolean(erro)}
          onClick={irParaCheckout}
          className="w-full bg-[#422518] hover:bg-[#602C16] disabled:opacity-50 text-white py-4 rounded-lg font-['Archivo'] text-base transition-colors mt-2"
        >
          {finalizando ? 'AGUARDE...' : 'FINALIZAR COMPRA'}
        </button>
      </div>
    </div>
  );
}
