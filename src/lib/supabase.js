const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const appSettingsUrl = (key) =>
  `${SUPABASE_URL}/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}`;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export async function getSharedSetting(key) {
  if (!isSupabaseConfigured) return { data: null, error: null };

  try {
    const response = await fetch(`${appSettingsUrl(key)}&select=value`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Supabase read failed: ${response.status}`);
    }

    const rows = await response.json();
    return { data: rows[0]?.value ?? null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function saveSharedSetting(key, value) {
  if (!isSupabaseConfigured) return { error: null };

  try {
    const response = await fetch(appSettingsUrl(key), {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        key,
        value,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Supabase save failed: ${response.status}`);
    }

    return { error: null };
  } catch (error) {
    return { error };
  }
}

// ─── SUPABASE REALTIME ────────────────────────────────────────────────────────
// Subscribe ke perubahan tabel app_settings secara realtime (WebSocket)
// Digunakan untuk sync prescriptions & transactions antar pengguna tanpa polling

let realtimeSocket = null;
let realtimeChannels = {}; // key → { callbacks: Set }

function getRealtimeUrl() {
  if (!SUPABASE_URL) return null;
  const wsUrl = SUPABASE_URL.replace("https://", "wss://").replace("http://", "ws://");
  return `${wsUrl}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
}

function ensureSocket() {
  if (realtimeSocket && realtimeSocket.readyState <= 1) return realtimeSocket;

  const url = getRealtimeUrl();
  if (!url) return null;

  realtimeSocket = new WebSocket(url);

  realtimeSocket.onopen = () => {
    // Heartbeat setiap 30 detik
    const hb = setInterval(() => {
      if (realtimeSocket.readyState === 1) {
        realtimeSocket.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: "hb" }));
      } else {
        clearInterval(hb);
      }
    }, 30000);

    // Re-subscribe semua channel yang ada
    Object.keys(realtimeChannels).forEach(key => subscribeChannel(key));
  };

  realtimeSocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === "postgres_changes" && msg.payload?.data) {
        const record = msg.payload.data.record || msg.payload.data.old_record;
        const key = record?.key;
        if (key && realtimeChannels[key]) {
          realtimeChannels[key].callbacks.forEach(cb => cb(record.value));
        }
      }
    } catch {}
  };

  realtimeSocket.onclose = () => {
    // Reconnect setelah 3 detik
    setTimeout(ensureSocket, 3000);
  };

  return realtimeSocket;
}

function subscribeChannel(key) {
  const sock = realtimeSocket;
  if (!sock || sock.readyState !== 1) return;

  const topic = `realtime:public:app_settings:key=eq.${key}`;
  sock.send(JSON.stringify({
    topic,
    event: "phx_join",
    payload: {
      config: {
        broadcast: { self: false },
        postgres_changes: [{ event: "UPDATE", schema: "public", table: "app_settings", filter: `key=eq.${key}` }],
      },
    },
    ref: `join_${key}`,
  }));
}

/**
 * Subscribe ke perubahan realtime sebuah key di app_settings.
 * @param {string} key - storage key (cth: "pos_prescriptions")
 * @param {function} callback - dipanggil dengan value terbaru saat ada perubahan
 * @returns {function} unsubscribe function
 */
export function subscribeRealtime(key, callback) {
  if (!isSupabaseConfigured) return () => {};

  if (!realtimeChannels[key]) {
    realtimeChannels[key] = { callbacks: new Set() };
  }
  realtimeChannels[key].callbacks.add(callback);

  const sock = ensureSocket();
  if (sock && sock.readyState === 1) {
    subscribeChannel(key);
  }

  return () => {
    realtimeChannels[key]?.callbacks.delete(callback);
  };
}
