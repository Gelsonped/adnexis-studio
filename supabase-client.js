// Supabase Client para AdNexis
// Inclua no HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// Depois inclua este arquivo

// CONFIG - Substitua pelas suas credenciais do Supabase
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// AUTH HELPERS
// ============================================

// Login com email/senha
async function sbLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

// Cadastro
async function sbSignup(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: { data: { name } }
  });
  if (error) throw error;
  return data.user;
}

// Logout
async function sbLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Usuário atual
async function sbGetUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Sessão
async function sbGetSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Escutar mudanças de auth
function sbOnAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ============================================
// DATA HELPERS (com RLS - usuário só vê seus dados)
// ============================================

// Generic CRUD
async function sbSelect(table, columns = '*', filters = {}) {
  let query = supabase.from(table).select(columns);
  Object.entries(filters).forEach(([k, v]) => query = query.eq(k, v));
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function sbInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function sbUpdate(table, id, updates) {
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function sbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// Upsert (insert or update)
async function sbUpsert(table, row, onConflict = 'id') {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict }).select().single();
  if (error) throw error;
  return data;
}

// ============================================
// HELPERS ESPECÍFICOS DO ADNEXIS
// ============================================

// Perfil
async function sbGetProfile() {
  const user = await sbGetUser();
  if (!user) return null;
  return sbSelect('profiles', '*', { id: user.id }).then(d => d[0]);
}

async function sbUpdateProfile(updates) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbUpdate('profiles', user.id, updates);
}

// Settings
async function sbGetSettings() {
  const user = await sbGetUser();
  if (!user) return null;
  return sbSelect('user_settings', '*', { user_id: user.id }).then(d => d[0]);
}

async function sbUpdateSettings(updates) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbUpsert('user_settings', { user_id: user.id, ...updates });
}

// Produtos
async function sbGetProducts() {
  const user = await sbGetUser();
  if (!user) return [];
  return sbSelect('products', '*', { user_id: user.id });
}

async function sbCreateProduct(product) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbInsert('products', { user_id: user.id, ...product });
}

async function sbUpdateProduct(id, updates) {
  return sbUpdate('products', id, updates);
}

async function sbDeleteProduct(id) {
  return sbDelete('products', id);
}

// Funis
async function sbGetFunnels() {
  const user = await sbGetUser();
  if (!user) return [];
  return sbSelect('funnels', '*', { user_id: user.id });
}

async function sbCreateFunnel(funnel) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbInsert('funnels', { user_id: user.id, ...funnel });
}

async function sbUpdateFunnel(id, updates) {
  return sbUpdate('funnels', id, updates);
}

async function sbDeleteFunnel(id) {
  return sbDelete('funnels', id);
}

// Chips WhatsApp
async function sbGetWaChips() {
  const user = await sbGetUser();
  if (!user) return [];
  return sbSelect('wa_chips', '*', { user_id: user.id });
}

async function sbCreateWaChip(chip) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbInsert('wa_chips', { user_id: user.id, ...chip });
}

async function sbUpdateWaChip(id, updates) {
  return sbUpdate('wa_chips', id, updates);
}

async function sbDeleteWaChip(id) {
  return sbDelete('wa_chips', id);
}

// Anúncios
async function sbGetAds() {
  const user = await sbGetUser();
  if (!user) return null;
  return sbSelect('ads', '*', { user_id: user.id }).then(d => d[0]);
}

async function sbUpdateAds(updates) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbUpsert('ads', { user_id: user.id, ...updates });
}

// Pedidos
async function sbGetOrders() {
  const user = await sbGetUser();
  if (!user) return [];
  return sbSelect('orders', '*', { user_id: user.id });
}

async function sbCreateOrder(order) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbInsert('orders', { user_id: user.id, ...order });
}

async function sbUpdateOrder(id, updates) {
  return sbUpdate('orders', id, updates);
}

async function sbDeleteOrder(id) {
  return sbDelete('orders', id);
}

// Chats
async function sbGetChats() {
  const user = await sbGetUser();
  if (!user) return [];
  return sbSelect('chats', '*', { user_id: user.id });
}

async function sbCreateChat(chat) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbInsert('chats', { user_id: user.id, ...chat });
}

async function sbUpdateChat(id, updates) {
  return sbUpdate('chats', id, updates);
}

async function sbDeleteChat(id) {
  return sbDelete('chats', id);
}

// Conversas IA
async function sbGetAiConversations() {
  const user = await sbGetUser();
  if (!user) return [];
  return sbSelect('ai_conversations', '*', { user_id: user.id });
}

async function sbCreateAiConversation(conv) {
  const user = await sbGetUser();
  if (!user) throw new Error('Não logado');
  return sbInsert('ai_conversations', { user_id: user.id, ...conv });
}

async function sbUpdateAiConversation(id, updates) {
  return sbUpdate('ai_conversations', id, updates);
}

async function sbDeleteAiConversation(id) {
  return sbDelete('ai_conversations', id);
}

// ============================================
// MIGRAÇÃO LOCALSTORAGE -> SUPABASE
// ============================================

async function sbMigrateFromLocalStorage() {
  const user = await sbGetUser();
  if (!user) throw new Error('Faça login primeiro');
  
  const KEY = 'adnexis-negocios-v1';
  const local = JSON.parse(localStorage.getItem(KEY) || '{}');
  
  // Products
  if (local.products?.length) {
    for (const p of local.products) {
      await sbCreateProduct({
        name: p.name,
        type: p.type,
        comm: p.comm,
        price: p.price,
        desc: p.desc,
        offers: p.offers,
        trial: p.trial,
        code: p.code,
        ex: p.ex
      });
    }
  }
  
  // Funnels
  if (local.flows?.length) {
    for (const f of local.flows) {
      await sbCreateFunnel({
        name: f.name,
        product_id: f.product,
        pub: f.pub,
        ai: f.ai,
        brain: f.brain,
        convs: f.convs,
        sales: f.sales,
        nodes: f.nodes,
        versions: f.versions
      });
    }
  }
  
  // Wa chips
  if (local.chips?.length) {
    for (const c of local.chips) {
      await sbCreateWaChip({
        name: c.name,
        num: c.num,
        on: c.on,
        funnel_id: c.flow
      });
    }
  }
  
  // Orders
  if (local.orders?.length) {
    for (const o of local.orders) {
      await sbCreateOrder({
        customer: o.customer,
        product: o.product,
        value: o.value,
        status: o.status,
        pay: o.pay,
        ex: o.ex
      });
    }
  }
  
  // Chats
  if (local.chats?.length) {
    for (const c of local.chats) {
      await sbCreateChat({
        name: c.name,
        human: c.human,
        ex: c.ex,
        msgs: c.msgs
      });
    }
  }
  
  // Ai conversations
  if (local.convs?.length) {
    for (const c of local.convs) {
      await sbCreateAiConversation({
        title: c.title,
        msgs: c.msgs
      });
    }
  }
  
  // Settings
  await sbUpdateSettings({
    wa: local.wa,
    rhythm: local.rhythm,
    fin: local.fin,
    ord: local.ord,
    per: local.per,
    goal: local.goal,
    adspend: local.adspend,
    other: local.other,
    visits: local.visits,
    clicks: local.clicks,
    chat_opts: local.chatOpts,
    approve: local.approve,
    notify: local.notify,
    hour_limit: local.hourLimit,
    ref: local.ref,
    vercel_endpoint: local.ads?.vercelEndpoint || '/api/ads-generate'
  });
  
  // Ads
  if (local.ads) {
    await sbUpdateAds({
      form: local.ads.form,
      resultados: local.ads.resultados,
      salvos: local.ads.salvos,
      made: local.ads.made,
      ok: local.ads.ok,
      vercel_endpoint: local.ads.vercelEndpoint,
      groq_key: local.ads.groqKey
    });
  }
  
  console.log('Migração concluída!');
  return true;
}

// ============================================
// EXPORTS
// ============================================

window.SupabaseAdnexis = {
  supabase,
  // Auth
  sbLogin, sbSignup, sbLogout, sbGetUser, sbGetSession, sbOnAuthChange,
  // Data
  sbSelect, sbInsert, sbUpdate, sbDelete, sbUpsert,
  // Specific
  sbGetProfile, sbUpdateProfile,
  sbGetSettings, sbUpdateSettings,
  sbGetProducts, sbCreateProduct, sbUpdateProduct, sbDeleteProduct,
  sbGetFunnels, sbCreateFunnel, sbUpdateFunnel, sbDeleteFunnel,
  sbGetWaChips, sbCreateWaChip, sbUpdateWaChip, sbDeleteWaChip,
  sbGetAds, sbUpdateAds,
  sbGetOrders, sbCreateOrder, sbUpdateOrder, sbDeleteOrder,
  sbGetChats, sbCreateChat, sbUpdateChat, sbDeleteChat,
  sbGetAiConversations, sbCreateAiConversation, sbUpdateAiConversation, sbDeleteAiConversation,
  // Migration
  sbMigrateFromLocalStorage
};