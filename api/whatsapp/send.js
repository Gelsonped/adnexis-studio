// Enviar mensagem WhatsApp via Cloud API
// POST /api/whatsapp/send
// Body: { to, type, text, template, components, mock }

import { META_CONFIG, getBaseUrl } from '../meta/config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function mockSendWhatsApp({ to, type, text, template }) {
  const messageId = `wamid.mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    messaging_product: 'whatsapp',
    contacts: [{ input: to, wa_id: to.replace(/\D/g, '') }],
    messages: [{ id: messageId }]
  };
}

async function realSendWhatsApp({ to, type, text, template, components }, phoneNumberId, accessToken) {
  const payload = {
    messaging_product: 'whatsapp',
    to: to.replace(/\D/g, ''), // Apenas números
    type: type || 'text'
  };
  
  if (type === 'template') {
    payload.template = {
      name: template,
      language: { code: 'pt_BR' },
      components: components || []
    };
  } else {
    payload.text = { body: text };
  }
  
  const response = await fetch(`${getBaseUrl()}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Falha ao enviar WhatsApp');
  }
  
  return data;
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
    to, 
    type = 'text', 
    text, 
    template, 
    components,
    phoneNumberId = META_CONFIG.phoneNumberId,
    mock = META_CONFIG.mockMode
  } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Destinatário (to) é obrigatório' });
  }
  
  if (type === 'text' && !text) {
    return res.status(400).json({ error: 'Texto é obrigatório para tipo text' });
  }
  
  if (type === 'template' && !template) {
    return res.status(400).json({ error: 'Nome do template é obrigatório para tipo template' });
  }

  try {
    let result;
    
    if (mock || META_CONFIG.mockMode) {
      result = mockSendWhatsApp({ to, type, text, template });
      console.log('[MOCK] WhatsApp enviado para:', to);
    } else {
      if (!phoneNumberId) {
        return res.status(400).json({ error: 'phoneNumberId não configurado (META_PHONE_NUMBER_ID)' });
      }
      result = await realSendWhatsApp({ to, type, text, template, components }, phoneNumberId, accessToken);
    }
    
    return res.status(200).json({ 
      success: true, 
      result,
      mock: mock || META_CONFIG.mockMode
    });
    
  } catch (e) {
    console.error('WhatsApp send error:', e);
    return res.status(500).json({ error: e.message });
  }
}