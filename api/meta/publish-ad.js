// Publicar anúncio no Meta Ads
// POST /api/meta/publish-ad
// Body: { adData, adAccountId, accessToken }

import { META_CONFIG, getBaseUrl } from './config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function mockPublishAd(adData) {
  // Simula resposta do Meta Ads API
  const adId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    id: adId,
    status: 'ACTIVE',
    created_time: new Date().toISOString(),
    ...adData
  };
}

async function realPublishAd(adData, adAccountId, accessToken) {
  const response = await fetch(`${getBaseUrl()}/act_${adAccountId}/ads`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(adData)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Falha ao publicar anúncio');
  }
  
  return data;
}

function buildCreativeSpec(ad) {
  // Adapta o formato do AdNexis para o Meta Creative Spec
  return {
    title: ad.titulo,
    body: ad.texto,
    description: ad.descricao,
    call_to_action_type: ad.cta.toUpperCase().replace(' ', '_'),
    image_hash: ad.image_hash || null, // Precisa fazer upload da imagem antes
    link_url: ad.link_url || 'https://adnexis.com.br'
  };
}

function buildAdSpec(ad, creativeId) {
  return {
    name: ad.angulo || 'AdNexis Ad',
    adset_id: ad.adset_id, // Precisa ser criado antes
    creative: { creative_id: creativeId },
    status: ad.status || 'PAUSED' // Meta exige PAUSED initially
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const accessToken = authHeader.split(' ')[1];

  const { adData, adAccountId, creativeId, mock = META_CONFIG.mockMode } = req.body;
  
  if (!adData || !adAccountId) {
    return res.status(400).json({ error: 'adData e adAccountId são obrigatórios' });
  }

  try {
    let result;
    
    if (mock || META_CONFIG.mockMode) {
      // Modo simulado para desenvolvimento
      result = mockPublishAd(adData);
      console.log('[MOCK] Ad publicado:', result.id);
    } else {
      // Publicação real
      // 1. Criar creative se não fornecido
      let finalCreativeId = creativeId;
      if (!finalCreativeId) {
        const creativeSpec = buildCreativeSpec(adData);
        const creativeRes = await fetch(`${getBaseUrl()}/act_${adAccountId}/adcreatives`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `AdNexis ${Date.now()}`, ...creativeSpec })
        });
        const creativeData = await creativeRes.json();
        if (!creativeRes.ok) throw new Error(creativeData.error?.message || 'Falha ao criar creative');
        finalCreativeId = creativeData.id;
      }
      
      // 2. Criar ad
      const adSpec = buildAdSpec(adData, finalCreativeId);
      result = await realPublishAd(adSpec, adAccountId, accessToken);
    }
    
    // Salvar no Supabase (opcional - para histórico)
    // await supabase.from('published_ads').insert({ ... });
    
    return res.status(200).json({ 
      success: true, 
      ad: result,
      mock: mock || META_CONFIG.mockMode
    });
    
  } catch (e) {
    console.error('Publish ad error:', e);
    return res.status(500).json({ error: e.message });
  }
}