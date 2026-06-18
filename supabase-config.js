const SUPABASE_URL = "https://jxdcmkdsbdompvyoqjbp.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_rgVAuatgi9YljulaOTLbZA_rhKOS0Ar";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
