// Webhook Meta - Recebe eventos de Ads, WhatsApp, Instagram
// GET /api/webhooks/meta (verificação)
// POST /api/webhooks/meta (eventos)

import { META_CONFIG } from '../meta/config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function verifySignature(payload, signature) {
  // Meta envia X-Hub-Signature-256: sha256=...
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', META_CONFIG.appSecret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(`sha256=${expected}`));
}

async function handleAdEvent(entry, userId) {
  // Processar eventos de anúncios
  for (const change of entry.changes || []) {
    if (change.field === 'ads') {
      const adId = change.value.ad_id;
      const status = change.value.status;
      
      // Atualizar status no banco local
      await supabase
        .from('published_ads')
        .update({ meta_status: status, updated_at: new Date().toISOString() })
        .eq('meta_ad_id', adId)
        .eq('user_id', userId);
    }
  }
}

async function handleWhatsAppEvent(entry, userId) {
  // Processar mensagens WhatsApp recebidas
  for (const change of entry.changes || []) {
    if (change.field === 'messages') {
      const messages = change.value.messages || [];
      const contacts = change.value.contacts || [];
      
      for (const msg of messages) {
        const contact = contacts.find(c => c.wa_id === msg.from) || {};
        
        // Salvar mensagem recebida
        await supabase.from('incoming_messages').insert({
          user_id: userId,
          channel: 'whatsapp',
          meta_message_id: msg.id,
          from: msg.from,
          contact_name: contact.profile?.name,
          type: msg.type,
          text: msg.text?.body,
          timestamp: new Date(msg.timestamp * 1000).toISOString(),
          raw: msg
        });
      }
    }
    
    if (change.field === 'statuses') {
      // Status de entrega/leitura
      for (const status of change.value.statuses || []) {
        await supabase
          .from('sent_messages')
          .update({ 
            meta_status: status.status,
            updated_at: new Date().toISOString()
          })
          .eq('meta_message_id', status.id);
      }
    }
  }
}

async function handleInstagramEvent(entry, userId) {
  // Processar mensagens Instagram Direct
  for (const change of entry.changes || []) {
    if (change.field === 'messages') {
      const messages = change.value.messages || [];
      
      for (const msg of messages) {
        await supabase.from('incoming_messages').insert({
          user_id: userId,
          channel: 'instagram',
          meta_message_id: msg.id,
          from: msg.from?.id,
          type: msg.type,
          text: msg.message?.text,
          timestamp: new Date(msg.timestamp * 1000).toISOString(),
          raw: msg
        });
      }
    }
  }
}

export default async function handler(req, res) {
  // GET - Verificação do webhook
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode === 'subscribe' && token === META_CONFIG.webhookVerifyToken) {
      console.log('Webhook verificado com sucesso');
      return res.status(200).send(challenge);
    }
    
    return res.status(403).send('Forbidden');
  }
  
  // POST - Eventos
  if (req.method === 'POST') {
    // Verificar assinatura (opcional mas recomendado)
    // const signature = req.headers['x-hub-signature-256'];
    // if (signature && !verifySignature(JSON.stringify(req.body), signature.replace('sha256=', ''))) {
    //   return res.status(401).send('Invalid signature');
    // }
    
    try {
      const body = req.body;
      
      if (body.object && body.entry) {
        for (const entry of body.entry) {
          // Identificar user_id (pode vir no entry ou precisar mapear via webhook_id)
          // Por simplicidade, assumimos que o webhook é global e mapeamos depois
          const userId = entry.id; // ou buscar via mapping table
          
          // Processar baseado no tipo de evento
          const changes = entry.changes || [];
          
          for (const change of changes) {
            if (change.field === 'ads') {
              await handleAdEvent({ changes: [change] }, userId);
            } else if (change.field === 'messages' || change.field === 'statuses') {
              await handleWhatsAppEvent({ changes: [change] }, userId);
            } else if (change.field === 'messages' && entry.id?.includes('instagram')) {
              await handleInstagramEvent({ changes: [change] }, userId);
            }
          }
        }
      }
      
      return res.status(200).send('EVENT_RECEIVED');
      
    } catch (e) {
      console.error('Webhook error:', e);
      return res.status(500).send('SERVER_ERROR');
    }
  }
  
  return res.status(405).send('Method Not Allowed');
}