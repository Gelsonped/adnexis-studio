// OAuth Meta Callback - Troca code por access_token
// GET /api/meta/callback?code=...&state=...

import { META_CONFIG, getBaseUrl } from './config.js';
import { encrypt } from './crypto.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: META_CONFIG.appId,
    client_secret: META_CONFIG.appSecret,
    redirect_uri: META_CONFIG.redirectUri,
    code
  });
  
  const response = await fetch(`${getBaseUrl()}/oauth/access_token?${params.toString()}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Falha ao trocar code por token');
  }
  
  return data; // { access_token, token_type, expires_in }
}

async function getLongLivedToken(shortToken) {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: META_CONFIG.appId,
    client_secret: META_CONFIG.appSecret,
    fb_exchange_token: shortToken
  });
  
  const response = await fetch(`${getBaseUrl()}/oauth/access_token?${params.toString()}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Falha ao obter token de longa duração');
  }
  
  return data; // { access_token, token_type, expires_in }
}

async function getUserPages(token) {
  const response = await fetch(`${getBaseUrl()}/me/accounts?access_token=${token}`);
  const data = await response.json();
  return data.data || [];
}

async function getWabas(token) {
  const response = await fetch(`${getBaseUrl()}/me/businesses?fields=whatsapp_business_accounts{id,name}&access_token=${token}`);
  const data = await response.json();
  const wabas = [];
  for (const biz of data.data || []) {
    if (biz.whatsapp_business_accounts) {
      wabas.push(...biz.whatsapp_business_accounts);
    }
  }
  return wabas;
}

async function getInstagramAccounts(token) {
  const response = await fetch(`${getBaseUrl()}/me/instagram_accounts?access_token=${token}`);
  const data = await response.json();
  return data.data || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { code, state, error, error_description } = req.query;
  
  if (error) {
    return res.status(400).json({ error, error_description });
  }
  
  if (!code) {
    return res.status(400).json({ error: 'Code não fornecido' });
  }
  
  try {
    // 1. Trocar code por token de curta duração
    const tokenData = await exchangeCodeForToken(code);
    
    // 2. Trocar por token de longa duração (60 dias)
    const longTokenData = await getLongLivedToken(tokenData.access_token);
    const accessToken = longTokenData.access_token;
    const expiresIn = longTokenData.expires_in || 5184000; // 60 dias
    
    // 3. Buscar contas do usuário (páginas, WABAs, Instagram)
    const [pages, wabas, igAccounts] = await Promise.all([
      getUserPages(accessToken),
      getWabas(accessToken),
      getInstagramAccounts(accessToken)
    ]);
    
    // 4. Obter user_id do Supabase (via state ou sessão)
    // O state pode conter o user_id: "userId:randomState"
    let userId = null;
    if (state && state.includes(':')) {
      userId = state.split(':')[0];
    }
    
    if (!userId) {
      // Tentar obter via token JWT do Supabase se passado no state
      // Para simplificar, assumimos que o frontend passa o user_id no state
      return res.status(400).json({ error: 'User ID não encontrado no state. Faça login no AdNexis primeiro.' });
    }
    
    // 5. Criptografar token
    const encryptedToken = encrypt(accessToken);
    
    // 6. Salvar no Supabase
    const { error: upsertError } = await supabase
      .from('meta_connections')
      .upsert({
        user_id: userId,
        access_token_encrypted: encryptedToken,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        pages: pages,
        wabas: wabas,
        instagram_accounts: igAccounts,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (upsertError) throw upsertError;
    
    // 6. Redirecionar de volta para o AdNexis com sucesso
    const redirectUrl = `${process.env.ADNEXIS_URL || 'https://SEU_DOMINIO.vercel.app'}?meta_connected=true`;
    return res.redirect(302, redirectUrl);
    
  } catch (e) {
    console.error('Meta OAuth callback error:', e);
    const redirectUrl = `${process.env.ADNEXIS_URL || 'https://SEU_DOMINIO.vercel.app'}?meta_error=${encodeURIComponent(e.message)}`;
    return res.redirect(302, redirectUrl);
  }
}