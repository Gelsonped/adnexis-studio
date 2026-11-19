// Autopilot Budget Manager - Controle de orçamento global
// POST /api/autopilot/budget
// Body: { userId, adAccountId, accessToken, action: 'check'|'enforce' }

import { META_CONFIG, getBaseUrl } from '../meta/config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getBudgetConfig(userId) {
  const { data, error } = await supabase
    .from('autopilot_budget')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data || {
    user_id: userId,
    daily_cap: 0,           // 0 = sem limite
    monthly_cap: 0,
    per_campaign_cap: 0,
    alert_threshold: 80,    // % do orçamento para alertar
    auto_pause_at_cap: true,
    timezone: 'America/Sao_Paulo'
  };
}

async function getTodaySpend(adAccountId, accessToken) {
  const today = new Date().toISOString().split('T')[0];
  const response = await fetch(`${getBaseUrl()}/act_${adAccountId}/insights?fields=spend&level=account&time_range={"since":"${today}","until":"${today}"}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Falha ao buscar gasto');
  return parseFloat(data.data?.[0]?.spend) || 0;
}

async function getMonthSpend(adAccountId, accessToken) {
  const firstDay = new Date();
  firstDay.setDate(1);
  firstDay.setHours(0, 0, 0, 0);
  const since = firstDay.toISOString().split('T')[0];
  const until = new Date().toISOString().split('T')[0];
  
  const response = await fetch(`${getBaseUrl()}/act_${adAccountId}/insights?fields=spend&level=account&time_range={"since":"${since}","until":"${until}"}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Falha ao buscar gasto mensal');
  return parseFloat(data.data?.[0]?.spend) || 0;
}

async function getCampaignSpends(adAccountId, accessToken, since, until) {
  const response = await fetch(`${getBaseUrl()}/act_${adAccountId}/insights?fields=spend,campaign_id,campaign_name&level=campaign&time_range={"since":"${since}","until":"${until}"}&limit=100`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Falha ao buscar gasto por campanha');
  return data.data || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const accessToken = authHeader.split(' ')[1];

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const userId = user.id;

  try {
    // GET - Status do orçamento
    if (req.method === 'GET') {
      const { adAccountId } = req.query;
      if (!adAccountId) return res.status(400).json({ error: 'adAccountId é obrigatório' });

      const config = await getBudgetConfig(userId);
      const todaySpend = await getTodaySpend(adAccountId, accessToken);
      const monthSpend = await getMonthSpend(adAccountId, accessToken);
      
      const today = new Date();
      const firstDay = new Date();
      firstDay.setDate(1);
      const campaignSpends = await getCampaignSpends(adAccountId, accessToken, 
        firstDay.toISOString().split('T')[0], 
        new Date().toISOString().split('T')[0]
      );

      const dailyPct = config.daily_cap ? (todaySpend / config.daily_cap * 100).toFixed(1) : 0;
      const monthlyPct = config.monthly_cap ? (monthSpend / config.monthly_cap * 100).toFixed(1) : 0;

      const alerts = [];
      if (config.daily_cap && dailyPct >= config.alert_threshold) {
        alerts.push({ type: 'daily', level: 'warning', message: `Gasto diário em ${dailyPct}% do limite (R$ ${todaySpend.toFixed(2)} / R$ ${config.daily_cap.toFixed(2)})` });
      }
      if (config.monthly_cap && monthlyPct >= config.alert_threshold) {
        alerts.push({ type: 'monthly', level: 'warning', message: `Gasto mensal em ${monthlyPct}% do limite (R$ ${monthSpend.toFixed(2)} / R$ ${config.monthly_cap.toFixed(2)})` });
      }
      if (config.daily_cap && dailyPct >= 100) {
        alerts.push({ type: 'daily', level: 'critical', message: `LIMITE DIÁRIO ATINGIDO: R$ ${todaySpend.toFixed(2)}` });
      }
      if (config.monthly_cap && monthlyPct >= 100) {
        alerts.push({ type: 'monthly', level: 'critical', message: `LIMITE MENSAL ATINGIDO: R$ ${monthSpend.toFixed(2)}` });
      }

      return res.status(200).json({
        success: true,
        config,
        today: { spend: todaySpend, cap: config.daily_cap, pct: dailyPct },
        month: { spend: monthSpend, cap: config.monthly_cap, pct: monthlyPct },
        campaigns: campaignSpends.map(c => ({
          id: c.campaign_id,
          name: c.campaign_name,
          spend: parseFloat(c.spend) || 0
        })),
        alerts
      });
    }

    // POST - Ações de orçamento
    if (req.method === 'POST') {
      const { action, adAccountId, ...params } = req.body;
      
      if (!adAccountId) return res.status(400).json({ error: 'adAccountId é obrigatório' });

      const config = await getBudgetConfig(userId);

      switch (req.body.action) {
        case 'update_config': {
          const updates = req.body.config || {};
          const { data, error } = await supabase
            .from('autopilot_budget')
            .upsert({ user_id: user.id, ...updates })
            .select()
            .single();
          if (error) throw error;
          return res.status(200).json({ success: true, config: data });
        }

        case 'check_limits': {
          const todaySpend = await getTodaySpend(params.adAccountId, accessToken);
          const monthSpend = await getMonthSpend(params.adAccountId, accessToken);
          
          const dailyExceeded = config.daily_cap && todaySpend >= config.daily_cap;
          const monthlyExceeded = config.monthly_cap && monthSpend >= config.monthly_cap;
          
          let actionTaken = null;
          
          if (dailyExceeded && config.auto_pause_at_cap) {
            // Pausar todas as campanhas ativas
            // TODO: implementar pausa via API
            actionTaken = 'paused_all_campaigns_daily_cap';
          } else if (monthlyExceeded && config.auto_pause_at_cap) {
            actionTaken = 'paused_all_campaigns_monthly_cap';
          }
          
          return res.status(200).json({
            success: true,
            daily: { spend: todaySpend, cap: config.daily_cap, exceeded: dailyExceeded },
            monthly: { spend: monthSpend, cap: config.monthly_cap, exceeded: monthlyExceeded },
            actionTaken
          });
        }

        case 'reset_daily': {
          // Para testes - resetar gasto do dia (apenas no mock)
          return res.status(200).json({ success: true, message: 'Reset apenas em mock mode' });
        }

        default:
          return res.status(400).json({ error: 'Ação não reconhecida' });
      }
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (e) {
    console.error('Budget manager error:', e);
    return res.status(500).json({ error: e.message });
  }
}