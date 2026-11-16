import { useEffect, useState } from 'react';

export default function CaixasClube() {
  const [caixas, setCaixas] = useState([]);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let ativo = true;
    fetch('/api/clube/caixas', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Não foi possível consultar suas caixas.');
        return res.json();
      })
      .then((dados) => { if (ativo) { setCaixas(dados.caixas); setErro(''); } })
      .catch((error) => { if (ativo) setErro(error.message); });
    return () => { ativo = false; };
  }, [versao]);
  return <section className="space-y-3 rounded-2xl border border-[#C58752]/40 bg-white p-6">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-bold">Suas caixas do Clube</h2>
      <button type="button" onClick={() => setVersao((valor) => valor + 1)} className="underline">Atualizar</button>
    </div>
    {erro && <p role="alert">{erro}</p>}
    {!erro && !caixas.length && <p>Nenhuma caixa com mensalidade aprovada até o momento.</p>}
    {caixas.map((caixa) => <article key={caixa.id} className="space-y-1 rounded-lg bg-[#FEF9F3] p-4">
      <h3 className="font-bold">Caixa de {caixa.competencia.split('-').reverse().join('/')}</h3>
      <p>{caixa.bloqueada ? 'Expedição bloqueada por pendência financeira. Consulte o atendimento.'
        : `Preparação: ${caixa.statusPreparacao}.`}</p>
      <p>{caixa.postagemPrevista ? `Previsão de postagem: ${caixa.postagemPrevista.split('-').reverse().join('/')}.`
        : 'Previsão de postagem aguardando confirmação da operação da transportadora.'}</p>
      {caixa.rastreio && <p>Rastreamento: {caixa.rastreio}</p>}
      {caixa.ocorrencias.map((item, indice) => <p key={indice}>{item.motivo} — nova previsão: {item.novaPrevisao.split('-').reverse().join('/')}.</p>)}
    </article>)}
    <p className="text-sm">As datas indicam a postagem. O recebimento depende do transporte para seu CEP.
      Caixas pagas antes do cancelamento continuam devidas.</p>
  </section>;
}
