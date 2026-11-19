// Autopilot Config - CRUD para regras
// GET /api/autopilot/config?userId=...
// POST /api/autopilot/config - cria regra
// PUT /api/autopilot/config?id=... - atualiza regra
// DELETE /api/autopilot/config?id=... - deleta regra

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_METRICS = [
  'roas', 'cpa', 'ctr', 'cpc', 'spend', 
  'impressions', 'clicks', 'conversions'
];

const VALID_OPERATORS = ['>', '>=', '<', '<=', '==', '!='];

const VALID_ACTIONS = [
  'pause_campaign', 'resume_campaign', 
  'adjust_budget', 'adjust_bid', 'notify'
];

function validateRule(rule) {
  const errors = [];
  
  if (!rule.name?.trim()) errors.push('Nome é obrigatório');
  if (!VALID_METRICS.includes(rule.metric)) errors.push('Métrica inválida');
  if (!VALID_OPERATORS.includes(rule.operator)) errors.push('Operador inválido');
  if (rule.threshold === undefined || rule.threshold === null) errors.push('Limite (threshold) é obrigatório');
  if (!rule.actions?.length) errors.push('Pelo menos uma ação é obrigatória');
  
  for (const action of rule.actions) {
    if (!VALID_ACTIONS.includes(action.type)) {
      errors.push(`Ação inválida: ${action.type}`);
    }
    if (action.type === 'adjust_budget' && !action.multiplier && !action.new_budget) {
      errors.push('Ação adjust_budget requer multiplier ou new_budget');
    }
  }
  
  return errors;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

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
    // GET - Listar regras
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('autopilot_rules')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return res.status(200).json({ success: true, rules: data || [] });
    }

    // POST - Criar regra
    if (req.method === 'POST') {
      const rule = req.body;
      const errors = validateRule(rule);
      if (errors.length) return res.status(400).json({ error: errors.join(', ') });

      const { data, error } = await supabase
        .from('autopilot_rules')
        .insert({
          user_id: userId,
          name: rule.name,
          metric: rule.metric,
          operator: rule.operator,
          threshold: rule.threshold,
          actions: rule.actions,
          priority: rule.priority || 0,
          cooldown_hours: rule.cooldown_hours || 24,
          enabled: rule.enabled !== false
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, rule: data });
    }

    // PUT - Atualizar regra
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (!id) return res.status(400).json({ error: 'ID da regra é obrigatório' });

      if (updates.metric || updates.operator || updates.threshold || updates.actions) {
        const testRule = { name: 'test', ...updates };
        const errors = validateRule(testRule);
        if (errors.length) return res.status(400).json({ error: errors.join(', ') });
      }

      const { data, error } = await supabase
        .from('autopilot_rules')
        .update({
          name: updates.name,
          metric: updates.metric,
          operator: updates.operator,
          threshold: updates.threshold,
          actions: updates.actions,
          priority: updates.priority,
          cooldown_hours: updates.cooldown_hours,
          enabled: updates.enabled
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Regra não encontrada' });
      return res.status(200).json({ success: true, rule: data });
    }

    // DELETE - Deletar regra
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'ID da regra é obrigatório' });

      const { error } = await supabase
        .from('autopilot_rules')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Regra removida' });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (e) {
    console.error('Autopilot config error:', e);
    return res.status(500).json({ error: e.message });
  }
}