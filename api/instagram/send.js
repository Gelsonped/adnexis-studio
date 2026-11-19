// Enviar mensagem Instagram Direct via Graph API
// POST /api/instagram/send
// Body: { recipient_id, message, mock }

import { META_CONFIG, getBaseUrl } from '../meta/config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function mockSendInstagram({ recipient_id, message }) {
  const messageId = `igid.mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return {
    recipient_id,
    message_id: messageId
  };
}

async function realSendInstagram({ recipient_id, message }, igUserId, accessToken) {
  const payload = {
    recipient: { id: recipient_id },
    message: { text: message }
  };
  
  const response = await fetch(`${getBaseUrl()}/${igUserId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Falha ao enviar Instagram Direct');
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
    recipient_id, 
    message, 
    igUserId = META_CONFIG.igUserId,
    mock = META_CONFIG.mockMode
  } = req.body;
  
  if (!recipient_id || !message) {
    return res.status(400).json({ error: 'recipient_id e message são obrigatórios' });
  }

  try {
    let result;
    
    if (mock || META_CONFIG.mockMode) {
      result = mockSendInstagram({ recipient_id, message });
      console.log('[MOCK] Instagram Direct enviado para:', recipient_id);
    } else {
      if (!igUserId) {
        return res.status(400).json({ error: 'igUserId não configurado (META_IG_USER_ID)' });
      }
      result = await realSendInstagram({ recipient_id, message }, igUserId, accessToken);
    }
    
    return res.status(200).json({ 
      success: true, 
      result,
      mock: mock || META_CONFIG.mockMode
    });
    
  } catch (e) {
    console.error('Instagram send error:', e);
    return res.status(500).json({ error: e.message });
  }
}