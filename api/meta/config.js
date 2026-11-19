// Config centralizada Meta API
const META_CONFIG = {
  // App credentials (configure no Vercel: META_APP_ID, META_APP_SECRET)
  appId: process.env.META_APP_ID || '',
  appSecret: process.env.META_APP_SECRET || '',
  
  // API version
  version: 'v21.0',
  baseUrl: 'https://graph.facebook.com',
  
  // Scopes necessários
  scopes: [
    'ads_management',
    'ads_read',
    'whatsapp_business_management',
    'instagram_manage_messages',
    'pages_show_list',
    'pages_read_engagement',
    'business_management'
  ].join(','),
  
  // Redirect URI (configure no Meta App: Valid OAuth Redirect URIs)
  redirectUri: process.env.META_REDIRECT_URI || 'https://SEU_DOMINIO.vercel.app/api/meta/callback',
  
  // Webhook verify token (configure no Meta App: Webhooks)
  webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'adnexis_webhook_verify',
  
  // Mock mode para dev sem permissão
  mockMode: process.env.META_MOCK === 'true' || process.env.NODE_ENV === 'development',
  
  // WABA / Instagram IDs (configure no Vercel após criar no Meta)
  wabaId: process.env.META_WABA_ID || '',
  phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
  igUserId: process.env.META_IG_USER_ID || '',
  pageId: process.env.META_PAGE_ID || '',
  
  // Token encryption key (gere uma: openssl rand -hex 32)
  encryptionKey: process.env.META_TOKEN_ENCRYPTION_KEY || ''
};

function getBaseUrl() {
  return `${META_CONFIG.baseUrl}/${META_CONFIG.version}`;
}

function getOAuthUrl(state = '') {
  const params = new URLSearchParams({
    client_id: META_CONFIG.appId,
    redirect_uri: META_CONFIG.redirectUri,
    scope: META_CONFIG.scopes,
    response_type: 'code',
    state: state || crypto.randomUUID()
  });
  return `https://www.facebook.com/${META_CONFIG.version}/dialog/oauth?${params.toString()}`;
}

module.exports = { META_CONFIG, getBaseUrl, getOAuthUrl };