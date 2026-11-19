// Ler insights de anúncios Meta
// POST /api/meta/insights
// Body: { adIds, adAccountId, accessToken, since, until, fields }

import { META_CONFIG, getBaseUrl } from './config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_FIELDS = [
  'impressions',
  'clicks',
  'spend',
  'ctr',
  'cpc',
  'cpp',
  'reach',
  'frequency',
  'actions',
  'action_values',
  'cost_per_action_type',
  'purchase_roas'
].join(',');

function mockInsights(adIds) {
  // Gera dados fake realistas
  return adIds.map(id => ({
    ad_id: id,
    impressions: Math.floor(Math.random() * 50000) + 1000,
    clicks: Math.floor(Math.random() * 2000) + 50,
    spend: (Math.random() * 500 + 10).toFixed(2),
    ctr: (Math.random() * 3 + 0.5).toFixed(2),
    cpc: (Math.random() * 2 + 0.1).toFixed(2),
    reach: Math.floor(Math.random() * 30000) + 500,
    frequency: (Math.random() * 2 + 1).toFixed(1),
    actions: [
      { action_type: 'link_click', value: Math.floor(Math.random() * 1000) + 50 },
      { action_type: 'landing_page_view', value: Math.floor(Math.random() * 800) + 30 }
    ],
    action_values: [{ action_type: 'purchase', value: (Math.random() * 5000 + 500).toFixed(2) }],
    purchase_roas: [{ value: (Math.random() * 5 + 1).toFixed(2) }]
  });
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

  const { 
    adIds, 
    adAccountId, 
    since = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    until = new Date().toISOString().split('T')[0],
    fields = DEFAULT_FIELDS,
    mock = META_CONFIG.mockMode
  } = req.body;
  
  if (!adIds?.length || !adAccountId) {
    return res.status(400).json({ error: 'adIds e adAccountId são obrigatórios' });
  }

  try {
    let insights;
    
    if (mock || META_CONFIG.mockMode) {
      insights = mockInsights(adIds);
      console.log('[MOCK] Insights gerados para:', adIds.length, 'anúncios');
    } else {
      const idsParam = adIds.join(',');
      const params = new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since, until }),
        level: 'ad',
        filtering: JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]),
        limit: 100
      });
      
      const response = await fetch(`${getBaseUrl()}/act_${adAccountId}/insights?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Falha ao buscar insights');
      insights = data.data || [];
    }
    
    return res.status(200).json({ 
      success: true, 
      insights,
      mock: mock || META_CONFIG.mockMode
    });
    
  } catch (e) {
    console.error('Insights error:', e);
    return res.status(500).json({ error: e.message });
  }
}