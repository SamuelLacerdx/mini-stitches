export default function QuantidadeCarrinho({ item, disabled, alterar }) {
  function confirmar(evento) {
    const campo = evento.currentTarget;
    const quantidade = Number(campo.value);
    campo.value = String(item.quantidade);
    if (Number.isSafeInteger(quantidade) && quantidade >= 1 && quantidade !== item.quantidade) {
      alterar(item.produtoId, "PATCH", quantidade);
    }
  }

  return (
    <input
      key={item.quantidade}
      type="text"
      inputMode="numeric"
      aria-label={`Quantidade de ${item.nome}`}
      defaultValue={item.quantidade}
      disabled={disabled}
      className="w-10 bg-transparent text-center text-sm font-['Archivo']"
      onBlur={confirmar}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") {
          evento.preventDefault();
          evento.currentTarget.blur();
        }
      }}
    />
  );
}
