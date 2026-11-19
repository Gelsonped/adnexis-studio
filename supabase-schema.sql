-- Supabase Schema para AdNexis
-- Execute no SQL Editor do Supabase Dashboard

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABELAS PRINCIPAIS
-- ============================================

-- Perfil do usuário (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  area TEXT,
  biz TEXT,                    -- descrição do negócio para IA
  theme TEXT DEFAULT 'auto',   -- auto, light, dark
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações do usuário (JSONB para flexibilidade)
CREATE TABLE public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  -- WhatsApp
  wa JSONB DEFAULT '{"on":true,"bizname":"","flowtxt":"","tone":"","words":"atendente, humano, falar com uma pessoa","handoff":"Certo! Vou chamar uma pessoa da equipe para continuar o seu atendimento. Só um instante.","testnums":""}',
  -- Rhythm (Prospectar)
  rhythm JSONB DEFAULT '{"interval":5,"daily":30,"today":0}',
  -- Financeiro
  fin JSONB DEFAULT '{"tab":"overview","pixType":"CPF","pixKey":"","holder":"","saved":false,"withdrawals":[]}',
  -- Orders
  ord JSONB DEFAULT '{"per":"30","status":"","pay":"","q":""}',
  -- Período dashboard
  per TEXT DEFAULT 'month',
  goal TEXT,
  adspend TEXT,
  other TEXT,
  visits TEXT,
  clicks TEXT,
  -- Chat
  chat_opts JSONB DEFAULT '{"temp":false,"lib":false,"note":"","ctx":""}',
  -- Approve/notify
  approve BOOLEAN DEFAULT TRUE,
  notify BOOLEAN DEFAULT TRUE,
  -- Hour limit
  hour_limit INTEGER DEFAULT 20,
  -- Referral
  ref TEXT DEFAULT 'ADN-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6)),
  -- Plan
  plan JSONB DEFAULT '{"free":true,"trial_ends":(NOW() + INTERVAL '7 days'),"trial_spent":0,"trial_cap":50,"trial_day_locked":false,"expired":false}',
  -- Vercel endpoint para anúncios
  vercel_endpoint TEXT DEFAULT '/api/ads-generate',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DADOS DE NEGÓCIO
-- ============================================

-- Produtos
CREATE TABLE public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'own',        -- own, aff
  comm INTEGER DEFAULT 0,         -- comissão % para afiliados
  price NUMERIC(12,2) DEFAULT 0,
  desc TEXT,
  offers JSONB DEFAULT '[]',      -- [{"name":"Plano","price":97}]
  trial BOOLEAN DEFAULT FALSE,
  code TEXT DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
  ex BOOLEAN DEFAULT FALSE,       -- exemplo
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funis
CREATE TABLE public.funnels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  pub BOOLEAN DEFAULT FALSE,
  ai BOOLEAN DEFAULT TRUE,
  brain TEXT DEFAULT '',
  convs INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  nodes JSONB DEFAULT '[]',
  versions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chips WhatsApp
CREATE TABLE public.wa_chips (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  num TEXT,
  on BOOLEAN DEFAULT FALSE,
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANÚNCIOS (Módulo Marketing)
-- ============================================

CREATE TABLE public.ads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- Form data
  produto TEXT,
  desc TEXT,
  publico TEXT,
  oferta TEXT,
  objetivo TEXT DEFAULT 'vendas',
  tom TEXT DEFAULT 'direto e confiável',
  idioma TEXT DEFAULT 'pt-BR',
  n TEXT DEFAULT '4',
  -- Resultados
  resultados JSONB DEFAULT '[]',
  salvos JSONB DEFAULT '[]',
  made INTEGER DEFAULT 0,
  ok INTEGER DEFAULT 0,
  vercel_endpoint TEXT DEFAULT '/api/ads-generate',
  groq_key TEXT,  -- opcional, se quiser guardar local
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNIL / KANBAN
-- ============================================

CREATE TABLE public.funnel_contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  item TEXT,
  col INTEGER DEFAULT 0,  -- 0=Novo, 1=Em conversa, 2=Proposta, 3=Aguardando pag, 4=Fechada
  ex BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PEDIDOS / FINANCEIRO
-- ============================================

CREATE TABLE public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer TEXT NOT NULL,
  product TEXT,
  value NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'seller',  -- paid, seller, pending, refunded
  pay TEXT DEFAULT 'pix',        -- pix, checkout
  ex BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saques
CREATE TABLE public.withdrawals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  pix_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHATS / ATENDIMENTO
-- ============================================

CREATE TABLE public.chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  human BOOLEAN DEFAULT FALSE,
  ex BOOLEAN DEFAULT FALSE,
  chip_id UUID REFERENCES public.wa_chips(id) ON DELETE SET NULL,
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE SET NULL,
  msgs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSAS IA (Histórico)
-- ============================================

CREATE TABLE public.ai_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  msgs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROSPECÇÃO
-- ============================================

CREATE TABLE public.prospect_searches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  niche TEXT,
  city TEXT,
  product TEXT,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CRIATIVOS / MÍDIA
-- ============================================

CREATE TABLE public.creatives (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product TEXT,
  fmt TEXT DEFAULT 'feed',      -- feed, stories
  title TEXT,
  cta TEXT,
  caption TEXT,
  visual TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.media_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  size BIGINT,
  type TEXT,
  mime_type TEXT,
  -- conteúdo não salvo no banco (fica no storage ou local)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.media_libs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISPAROS / BROADCAST
-- ============================================

CREATE TABLE public.broadcasts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  count INTEGER,
  msg TEXT,
  chip_id UUID REFERENCES public.wa_chips(id) ON DELETE SET NULL,
  interval_min INTEGER DEFAULT 5,
  status TEXT DEFAULT 'draft',  -- draft, approved, sent
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APROVAÇÕES
-- ============================================

CREATE TABLE public.approvals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind TEXT,           -- "Resposta da IA", "Criativo", "Prospecção", "Disparo", "Recuperação"
  title TEXT,
  text TEXT,
  chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  extra JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENDA
-- ============================================

CREATE TABLE public.meetings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  who TEXT,
  at TIMESTAMPTZ NOT NULL,
  note TEXT,
  src TEXT DEFAULT 'manual',  -- manual, ia
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INSTAGRAM DIRECT
-- ============================================

CREATE TABLE public.ig_chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  human BOOLEAN DEFAULT FALSE,
  ex BOOLEAN DEFAULT FALSE,
  stage TEXT DEFAULT 'new',  -- new, qual, prop, won, lost
  owner TEXT,
  note TEXT,
  msgs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ig_automations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  entry TEXT,          -- kw, story, mention, ad
  kw TEXT,
  prio INTEGER DEFAULT 50,
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  steps JSONB DEFAULT '[]',
  resume BOOLEAN DEFAULT FALSE,
  mins INTEGER DEFAULT 30,
  rtext TEXT,
  on BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ig_quick_replies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CENTRAL DA IA
-- ============================================

CREATE TABLE public.central_corrections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ch TEXT DEFAULT 'both',     -- both, whatsapp, instagram
  q TEXT,
  a TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.central_memory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_key TEXT NOT NULL,  -- "whatsapp:uuid" ou "instagram:uuid"
  interest TEXT,
  budget TEXT,
  obj TEXT,
  stage TEXT DEFAULT 'new',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_key)
);

-- ============================================
-- TICKETS / SUPORTE
-- ============================================

CREATE TABLE public.tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  msg TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- META INTEGRATION (Fase 4)
-- ============================================

-- Conexão Meta (tokens, páginas, WABAs, Instagram)
CREATE TABLE public.meta_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  pages JSONB DEFAULT '[]',
  wabas JSONB DEFAULT '[]',
  instagram_accounts JSONB DEFAULT '[]',
  ad_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anúncios publicados
CREATE TABLE public.published_ads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meta_ad_id TEXT,
  ad_account_id TEXT,
  local_ad_id UUID REFERENCES public.ads(id) ON DELETE SET NULL,
  name TEXT,
  creative_id TEXT,
  adset_id TEXT,
  status TEXT,           -- ACTIVE, PAUSED, DELETED, etc
  meta_status TEXT,      -- status real do Meta
  creative_spec JSONB,
  ad_spec JSONB,
  insights JSONB,        -- cache de insights
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens enviadas (WhatsApp/Instagram)
CREATE TABLE public.sent_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL,              -- whatsapp, instagram
  meta_message_id TEXT,
  to TEXT,                            -- destinatário
  type TEXT,                          -- text, template, image, etc
  text TEXT,
  template_name TEXT,
  status TEXT DEFAULT 'sent',         -- sent, delivered, read, failed
  meta_status TEXT,                   -- status real do Meta
  related_chat_id UUID,               -- link para chat local
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens recebidas (WhatsApp/Instagram)
CREATE TABLE public.incoming_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL,              -- whatsapp, instagram
  meta_message_id TEXT UNIQUE,
  from TEXT,                          -- remetente
  contact_name TEXT,
  type TEXT,                          -- text, image, audio, etc
  text TEXT,
  media_url TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT FALSE,    -- se já foi processado pelo sistema
  related_chat_id UUID,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapeamento webhook -> user_id
CREATE TABLE public.meta_webhook_mapping (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  webhook_type TEXT NOT NULL,         -- ads, whatsapp, instagram
  meta_id TEXT NOT NULL,              -- ad_account_id, waba_id, ig_user_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(webhook_type, meta_id)
);

-- ============================================
-- AUTOPILOT (Fase 5)
-- ============================================

-- Regras de automação
CREATE TABLE public.autopilot_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,              -- roas, cpa, ctr, cpc, spend, impressions, clicks, conversions
  operator TEXT NOT NULL,            -- >, >=, <, <=, ==, !=
  threshold NUMERIC NOT NULL,        -- valor limite
  actions JSONB NOT NULL DEFAULT '[]', -- [{"type":"pause_campaign"},{"type":"notify","message":"..."}]
  priority INTEGER DEFAULT 0,        -- maior prioridade executa primeiro
  cooldown_hours INTEGER DEFAULT 24, -- tempo mínimo entre execuções
  enabled BOOLEAN DEFAULT TRUE,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuração de orçamento global
CREATE TABLE public.autopilot_budget (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  daily_cap NUMERIC DEFAULT 0,           -- 0 = sem limite
  monthly_cap NUMERIC DEFAULT 0,
  per_campaign_cap NUMERIC DEFAULT 0,
  alert_threshold INTEGER DEFAULT 80,    -- % do orçamento para alertar
  auto_pause_at_cap BOOLEAN DEFAULT TRUE,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de execuções do autopilot
CREATE TABLE public.autopilot_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rule_id UUID REFERENCES public.autopilot_rules(id) ON DELETE SET NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  metric TEXT,
  metric_value NUMERIC,
  condition TEXT,                      -- ex: "3.5 > 3.0"
  action_type TEXT,                    -- pause_campaign, adjust_budget, etc
  action_params JSONB,
  result JSONB,                        -- resultado da execução
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- API KEYS
-- ============================================

CREATE TABLE public.api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  key_hash TEXT,
  key_prefix TEXT,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_chips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_libs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Meta tables RLS
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_webhook_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON public.meta_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.published_ads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.sent_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.incoming_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.meta_webhook_mapping FOR ALL USING (auth.uid() = user_id);

-- Autopilot RLS
CREATE POLICY "own_data" ON public.autopilot_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.autopilot_budget FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.autopilot_logs FOR ALL USING (auth.uid() = user_id);

-- Políticas: usuário só acessa seus próprios dados
CREATE POLICY "own_data" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_data" ON public.user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.funnels FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.wa_chips FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.ads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.funnel_contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.orders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.withdrawals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.ai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.prospect_searches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.creatives FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.media_files FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.media_libs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.broadcasts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.approvals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.meetings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.ig_chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.ig_automations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.ig_quick_replies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.central_corrections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.central_memory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.tickets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON public.api_keys FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS para updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;$$;

CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_funnels_updated_at BEFORE UPDATE ON public.funnels FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_wa_chips_updated_at BEFORE UPDATE ON public.wa_chips FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_funnel_contacts_updated_at BEFORE UPDATE ON public.funnel_contacts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_creatives_updated_at BEFORE UPDATE ON public.creatives FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_broadcasts_updated_at BEFORE UPDATE ON public.broadcasts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_ig_chats_updated_at BEFORE UPDATE ON public.ig_chats FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_ig_automations_updated_at BEFORE UPDATE ON public.ig_automations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trigger_meta_connections_updated_at BEFORE UPDATE ON public.meta_connections FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_published_ads_updated_at BEFORE UPDATE ON public.published_ads FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_sent_messages_updated_at BEFORE UPDATE ON public.sent_messages FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_incoming_messages_updated_at BEFORE UPDATE ON public.incoming_messages FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_meta_webhook_mapping_updated_at BEFORE UPDATE ON public.meta_webhook_mapping FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER trigger_autopilot_rules_updated_at BEFORE UPDATE ON public.autopilot_rules FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trigger_autopilot_budget_updated_at BEFORE UPDATE ON public.autopilot_budget FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- FUNÇÃO PARA CRIAR PROFILE AUTOMATICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  INSERT INTO public.ads (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ÍNDICES ÚTEIS
-- ============================================

CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_funnels_user_id ON public.funnels(user_id);
CREATE INDEX idx_wa_chips_user_id ON public.wa_chips(user_id);
CREATE INDEX idx_ads_user_id ON public.ads(user_id);
CREATE INDEX idx_funnel_contacts_user_id ON public.funnel_contacts(user_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_chats_user_id ON public.chats(user_id);
CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX idx_creatives_user_id ON public.creatives(user_id);
CREATE INDEX idx_broadcasts_user_id ON public.broadcasts(user_id);
CREATE INDEX idx_approvals_user_id ON public.approvals(user_id);
CREATE INDEX idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX idx_ig_chats_user_id ON public.ig_chats(user_id);
CREATE INDEX idx_ig_automations_user_id ON public.ig_automations(user_id);

CREATE INDEX idx_meta_connections_user_id ON public.meta_connections(user_id);
CREATE INDEX idx_published_ads_user_id ON public.published_ads(user_id);
CREATE INDEX idx_published_ads_meta_ad_id ON public.published_ads(meta_ad_id);
CREATE INDEX idx_sent_messages_user_id ON public.sent_messages(user_id);
CREATE INDEX idx_sent_messages_meta_message_id ON public.sent_messages(meta_message_id);
CREATE INDEX idx_incoming_messages_user_id ON public.incoming_messages(user_id);
CREATE INDEX idx_incoming_messages_meta_message_id ON public.incoming_messages(meta_message_id);
CREATE INDEX idx_incoming_messages_processed ON public.incoming_messages(processed);
CREATE INDEX idx_meta_webhook_mapping_user_id ON public.meta_webhook_mapping(user_id);

CREATE INDEX idx_autopilot_rules_user_id ON public.autopilot_rules(user_id);
CREATE INDEX idx_autopilot_rules_enabled ON public.autopilot_rules(enabled);
CREATE INDEX idx_autopilot_logs_user_id ON public.autopilot_logs(user_id);
CREATE INDEX idx_autopilot_logs_rule_id ON public.autopilot_logs(rule_id);
CREATE INDEX idx_autopilot_logs_executed_at ON public.autopilot_logs(executed_at);