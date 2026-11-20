// Central configuration - every value comes from the .env file (VITE_* vars),
// with safe fallbacks so the app still runs if a variable is missing.
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}

function str(key, fallback) {
  const v = env['VITE_' + key]
  return v === undefined || v === '' ? fallback : String(v)
}
function num(key, fallback) {
  const v = Number(env['VITE_' + key])
  return Number.isFinite(v) ? v : fallback
}
function bool(key, fallback) {
  const v = env['VITE_' + key]
  if (v === undefined || v === '') return fallback
  return String(v).toLowerCase() === 'true' || v === true
}

// Indian financial year (Apr-Mar) derived from current date, e.g. "2025-26"
function autoFy() {
  const d = new Date()
  const y = d.getFullYear()
  const fyStart = d.getMonth() >= 3 ? y : y - 1 // month index 3 = April
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`
}

export const config = {
  appName: str('APP_NAME', 'UP Audit Management System'),
  appShortName: str('APP_SHORT_NAME', 'UP-AMS'),
  orgName: str('ORG_NAME', 'Government of Uttar Pradesh'),
  orgUnit: str('ORG_UNIT', 'State Audit Department'),

  demoMode: bool('DEMO_MODE', true),
  seedDemoData: bool('SEED_DEMO_DATA', true),
  resetOnVersionChange: bool('RESET_DATA_ON_VERSION_CHANGE', true),
  demoPassword: str('DEMO_PASSWORD', 'demo123'),
  aiEnabled: bool('ENABLE_AI_FEATURES', true),
  aiModelLabel: str('AI_MODEL_LABEL', 'Rule-based demo model v1'),

  ssoEnabled: bool('SSO_ENABLED', true),
  ssoProviderName: str('SSO_PROVIDER_NAME', 'UP Parichay SSO'),

  endpoints: {
    pfms: str('PFMS_ENDPOINT', 'https://pfms-demo.example.gov.in/api/v2'),
    eoffice: str('EOFFICE_ENDPOINT', 'https://eoffice-demo.example.gov.in/api'),
    kosh: str('KOSH_ENDPOINT', 'https://kosh-demo.example.gov.in/api'),
    ddo: str('DDO_ENDPOINT', 'https://ddo-demo.example.gov.in/api')
  },

  dbName: str('DB_NAME', 'up_ams_db'),
  dbVersion: num('DB_VERSION', 1),
  storagePrefix: str('STORAGE_PREFIX', 'upams'),
  syncChannel: str('SYNC_CHANNEL', 'up-ams-sync'),

  pageSize: num('DEFAULT_PAGE_SIZE', 10),
  maxUploadMb: num('MAX_UPLOAD_MB', 10),
  currency: str('CURRENCY', 'INR'),
  fiscalYear: (() => {
    const v = str('FISCAL_YEAR', 'auto')
    return v === 'auto' ? autoFy() : v
  })(),
  sessionTimeoutMin: num('SESSION_TIMEOUT_MINUTES', 0),

  emailSimulation: bool('EMAIL_SIMULATION', true),
  emailDomain: str('EMAIL_DOMAIN', 'up.gov.in')
}

export default config
