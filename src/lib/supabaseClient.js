// src/lib/supabaseClient.js
// Client Supabase resmi (@supabase/supabase-js) — dipakai khusus untuk
// modul Rekam Medis (patients, allergies_log, encounters, audit_log)
// dan Supabase Auth. File lib/supabase.js yang lama (fetch manual ke
// app_settings) TETAP dipertahankan untuk fitur blob lama yang belum
// dimigrasi (transactions, cashCounts, dll) — tidak saling mengganggu.
//
// Install dulu: npm install @supabase/supabase-js

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "kk_supabase_auth", // terpisah dari kk_local_session lama
      },
    })
  : null;
