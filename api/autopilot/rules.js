// Autopilot Rules Engine
// POST /api/autopilot/evaluate
// Body: { userId, adAccountId, accessToken }

import { META_CONFIG, getBaseUrl } from '../meta/config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tipos de condições suportadas
const CONDITION_OPERATORS = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b
};

const METRICS = {
  roas: 'purchase_roas',
  cpa: 'cost_per_action_type',
  ctr: 'ctr',
  cpc: 'cpc',
  spend: 'spend',
  impressions: 'impressions',
  clicks: 'clicks',
  conversions: 'actions'
};

async function getAutopilotRules(userId) {
  const { data, error } = await supabase
    .from('autopilot_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('priority', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

async function getCampaignInsights(adAccountId, accessToken, campaignIds, since, until) {
  const fields = 'spend,impressions,clicks,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas';
  const idsParam = campaignIds.join(',');
  
  const response = await fetch(`${getBaseUrl()}/act_${adAccountId}/insights?fields=${fields}&level=campaign&filtering=[{"field":"campaign.id","operator":"IN","value":${JSON.stringify(campaignIds)}}]&time_range={"since":"${since}","until":"${until}"}&limit=100`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Falha ao buscar insights');
  return data.data || [];
}

function evaluateCondition(metricValue, operator, threshold) {
  const op = CONDITION_OPERATORS[operator];
  if (!op) return false;
  return op(Number(metricValue), Number(threshold));
}

function extractMetricValue(insight, metricKey) {
  // Handle different metric formats from Meta API
  if (metricKey === 'purchase_roas') {
    const roas = insight.purchase_roas?.[0]?.value;
    return roas ? parseFloat(roas) : 0;
  }
  if (metricKey === 'cost_per_action_type') {
    const cpa = insight.cost_per_action_type?.find(a => a.action_type === 'purchase');
    return cpa ? parseFloat(cpa.value) : 0;
  }
  if (metricKey === 'actions') {
    const purchase = insight.actions?.find(a => a.action_type === 'purchase');
    return purchase ? parseInt(purchase.value) : 0;
  }
  if (metricKey === 'spend' || metricKey === 'impressions' || metricKey === 'clicks') {
    return parseFloat(insight[metricKey]) || 0;
  }
  if (metricKey === 'ctr' || metricKey === 'cpc') {
    return parseFloat(insight[metricKey]) || 0;
  }
  return 0;
}

async function executeAction(action, campaignId, adAccountId, accessToken, params = {}) {
  const baseUrl = getBaseUrl();
  
  switch (action) {
    case 'pause_campaign':
      await fetch(`${baseUrl}/${campaignId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAUSED' })
      });
      return { action: 'pause_campaign', campaignId, success: true };
      
    case 'resume_campaign':
      await fetch(`${baseUrl}/${campaignId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      return { action: 'resume_campaign', campaignId, success: true };
      
    case 'adjust_budget':
      const newBudget = params.new_budget || Math.round(params.current_budget * (params.multiplier || 1.1));
      await fetch(`${baseUrl}/${campaignId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_budget: newBudget })
      });
      return { action: 'adjust_budget', campaignId, newBudget, success: true };
      
    case 'adjust_bid':
      // Requires adset level, simplified
      return { action: 'adjust_bid', campaignId, note: 'Requires adset-level implementation', success: false };
      
    case 'notify':
      // Log notification (could integrate with email/push)
      console.log(`[AUTOPILOT NOTIFY] ${params.message}`);
      return { action: 'notify', message: params.message, success: true };
      
    default:
      return { action, success: false, error: 'Unknown action' };
  }
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

  const { userId, adAccountId, since, until, mock = META_CONFIG.mockMode } = req.body;
  
  if (!userId || !adAccountId) {
    return res.status(400).json({ error: 'userId e adAccountId são obrigatórios' });
  }

  try {
    // 1. Buscar regras do usuário
    const rules = await getAutopilotRules(userId);
    if (!rules.length) {
      return res.status(200).json({ success: true, message: 'Nenhuma regra configurada', executed: [] });
    }

    // 2. Buscar campanhas da conta
    const campaignsRes = await fetch(`${getBaseUrl()}/act_${adAccountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget&limit=100`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const campaignsData = await campaignsRes.json();
    if (!campaignsRes.ok) throw new Error(campaignsData.error?.message || 'Falha ao buscar campanhas');
    
    const campaigns = campaignsData.data || [];
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
    
    if (!activeCampaigns.length) {
      return res.status(200).json({ success: true, message: 'Nenhuma campanha ativa', executed: [] });
    }

    // 3. Buscar insights do período
    const sinceDate = since || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const untilDate = until || new Date().toISOString().split('T')[0];
    const campaignIds = activeCampaigns.map(c => c.id);
    
    let insights;
    if (mock || META_CONFIG.mockMode) {
      // Mock insights for testing
      insights = activeCampaigns.map(c => ({
        campaign_id: c.id,
        campaign_name: c.name,
        spend: Math.random() * 500 + 50,
        impressions: Math.floor(Math.random() * 50000) + 1000,
        clicks: Math.floor(Math.random() * 2000) + 50,
        ctr: (Math.random() * 3 + 0.5).toFixed(2),
        cpc: (Math.random() * 2 + 0.1).toFixed(2),
        actions: [{ action_type: 'purchase', value: Math.floor(Math.random() * 50) + 5 }],
        cost_per_action_type: [{ action_type: 'purchase', value: (Math.random() * 50 + 10).toFixed(2) }],
        purchase_roas: [{ value: (Math.random() * 4 + 1).toFixed(2) }]
      }));
    } else {
      const insightsRes = await fetch(`${getBaseUrl()}/act_${adAccountId}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas&level=campaign&filtering=[{"field":"campaign.id","operator":"IN","value":${JSON.stringify(campaignIds)}}]&time_range={"since":"${sinceDate}","until":"${untilDate}"}&limit=100`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const insightsData = await insightsRes.json();
      if (!insightsRes.ok) throw new Error(insightsData.error?.message || 'Falha ao buscar insights');
      insights = insightsData.data || [];
    }

    // 4. Avaliar regras para cada campanha
    const executed = [];
    
    for (const campaign of activeCampaigns) {
      const insight = insights.find(i => i.campaign_id === campaign.id) || {};
      const currentBudget = parseInt(campaign.daily_budget) || 0;
      
      for (const rule of rules) {
        try {
          const metricValue = extractMetricValue(insight, rule.metric);
          const conditionMet = evaluateCondition(metricValue, rule.operator, rule.threshold);
          
          if (conditionMet) {
            // Verificar cooldown
            const lastExecuted = rule.last_executed_at ? new Date(rule.last_executed_at).getTime() : 0;
            const cooldownMs = (rule.cooldown_hours || 24) * 3600000;
            if (Date.now() - lastExecuted < cooldownMs) continue;
            
            // Executar ações
            for (const action of rule.actions) {
              const result = await executeAction(
                action.type,
                campaign.id,
                adAccountId,
                accessToken,
                { 
                  current_budget: currentBudget,
                  multiplier: action.multiplier,
                  new_budget: action.new_budget,
                  message: action.message || `Regra "${rule.name}" disparada para campanha ${campaign.name}`
                }
              );
              
              executed.push({
                rule: rule.name,
                campaign: campaign.name,
                campaignId: campaign.id,
                metric: rule.metric,
                value: metricValue,
                condition: `${metricValue} ${rule.operator} ${rule.threshold}`,
                action: action.type,
                result
              });
            }
            
            // Atualizar last_executed_at
            await supabase
              .from('autopilot_rules')
              .update({ last_executed_at: new Date().toISOString() })
              .eq('id', rule.id);
          }
        } catch (e) {
          console.error(`Erro avaliando regra ${rule.name} para campanha ${campaign.name}:`, e);
          executed.push({
            rule: rule.name,
            campaign: campaign.name,
            error: e.message
          });
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      evaluated: activeCampaigns.length,
      executed,
      mock: mock || META_CONFIG.mockMode
    });

  } catch (e) {
    console.error('Autopilot evaluation error:', e);
    return res.status(500).json({ error: e.message });
  }
}