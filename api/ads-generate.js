// Vercel Serverless Function: Gera anúncios via Groq (Escritor + Juiz)
// Deploy: vercel deploy --prod
// Env: GROQ_API_KEY=gsk_xxx

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada no Vercel' });

  const { form } = req.body;
  if (!form || !form.produto?.trim() || !form.desc?.trim()) {
    return res.status(400).json({ error: 'Preencha produto e descrição' });
  }

  const CTAS = ["Saiba mais", "Comprar agora", "Fale conosco", "Enviar mensagem", "Cadastre-se"];

  const promptEscritor = `Você é redator de anúncios para Facebook e Instagram. Crie ${form.n} anúncios, cada um com um ângulo diferente (dor, benefício, prova, urgência honesta, curiosidade). Idioma: ${form.idioma}. Tom: ${form.tom}. Objetivo: ${form.objetivo}.
Produto: ${form.produto}. Detalhes: ${form.desc}. Público: ${form.publico || "não informado"}. Oferta: ${form.oferta || "nenhuma"}.
Regras: sem promessa de resultado garantido, sem antes e depois, sem falar de características pessoais do leitor, sem MAIÚSCULAS em excesso, sem exageros. Limites: título até 40 caracteres, texto até 125 caracteres, descrição até 30 caracteres. CTA deve ser um de: ${CTAS.join(", ")}. ideia_imagem: uma frase com a imagem ideal.
Responda SOMENTE com um array JSON: [{"angulo":"","titulo":"","texto":"","descricao":"","cta":"","ideia_imagem":""}]`;

  const promptJuiz = `Você é o Juiz: revisor rigoroso das políticas de anúncios do Meta e da qualidade do texto. Avalie cada anúncio (índice i, começando em 0): promessas garantidas, antes e depois, referência a características pessoais do leitor, exageros de saúde ou dinheiro, MAIÚSCULAS em excesso, clareza e oferta. Dê nota de 0 a 10. veredito: "aprovado" (nota 8 ou mais e sem risco), "ajustar" ou "reprovar". motivo: uma frase curta no idioma do anúncio. correcao: novo texto principal (até 125 caracteres) se não for aprovado, senão "".
Responda SOMENTE com um array JSON: [{"i":0,"nota":8,"veredito":"aprovado","motivo":"","correcao":""}]`;

  async function callGroq(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 2000) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API Groq');
    return data.choices?.[0]?.message?.content || '';
  }

  function stripJson(text) {
    return text.replace(/```json|```/g, '').trim();
  }

  try {
    // 1. Escritor
    const txt1 = await callGroq('Você é redator de anúncios para Facebook e Instagram. Responda SOMENTE com JSON válido.', promptEscritor, 0.7, 2000);
    let ads;
    try { ads = JSON.parse(stripJson(txt1)); } catch (e) { throw new Error('Erro ao parsear anúncios: ' + e.message); }

    // 2. Juiz
    const txt2 = await callGroq('Você é o Juiz de anúncios do Meta. Responda SOMENTE com JSON válido.', promptJuiz + '\nAnúncios: ' + JSON.stringify(ads), 0.3, 1500);
    let julg;
    try { julg = JSON.parse(stripJson(txt2)); } catch (e) { throw new Error('Erro ao parsear juiz: ' + e.message); }

    // 3. Merge
    const resultados = ads.map((a, i) => {
      const r = julg.find(x => x.i === i) || {};
      return { ...a, nota: r.nota == null ? 0 : r.nota, veredito: r.veredito || 'ajustar', motivo: r.motivo || '', correcao: r.correcao || '' };
    });

    return res.status(200).json({ resultados, made: resultados.length, ok: resultados.filter(a => a.veredito === 'aprovado').length });

  } catch (e) {
    console.error('Erro:', e);
    return res.status(500).json({ error: e.message });
  }
}