// OAuth Meta - Inicia fluxo de autorização
// GET /api/meta/oauth?state=<optional>

import { getOAuthUrl } from './config.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const state = req.query.state || crypto.randomUUID();
  
  // Salvar state temporariamente (em produção use Redis/KV com TTL)
  // Por simplicidade, passamos no redirect_uri
  
  const url = getOAuthUrl(state);
  
  return res.status(200).json({ 
    url,
    state,
    message: 'Redirecione o usuário para esta URL'
  });
}