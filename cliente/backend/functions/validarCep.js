async function consultarCEP(cep) {
  const cepLimpo = String(cep).replace(/\D/g, "");
  if (!/^\d{8}$/.test(cepLimpo)) {
    throw new Error("CEP inválido.");
  }

  const resposta = await fetch(
    `https://viacep.com.br/ws/${cepLimpo}/json/`,
  );
  if (!resposta.ok) {
    throw new Error(`A consulta ao ViaCEP falhou com status ${resposta.status}.`);
  }

  const dados = await resposta.json();
  if (dados.erro) {
    return null;
  }

  return {
    rua: dados.logradouro || "",
    bairro: dados.bairro || "",
    cidade: dados.localidade || "",
    estado: dados.uf || "",
  };
}

module.exports = { consultarCEP };