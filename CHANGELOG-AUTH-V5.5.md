# Kasir Klinik — v5.5 "Auth"

## v5.5.1 — Hapus Resep
Added a 🗑️ delete button (with a confirmation prompt) for individual prescriptions:
- In **E-Resep Dokter → Resep Terbaru** (the card list), next to the 🖨️ print button.
- In **E-Resep Apoteker** (the main table), next to the status-advance button — and the
  detail view auto-closes if the open prescription gets deleted.

This was previously not possible from the UI; the only way to remove a prescription
was editing `localStorage` directly. Use with care — deleting is permanent and there's
no undo.


## What's new
Added a login (landing) page with two roles:

| Role | Akses |
|---|---|
| **Dokter** | Hanya menu **E-Resep Dokter** |
| **Apoteker** | Semua menu (Kasir, E-Resep Dokter, E-Resep Apoteker, Salinan Resep, Riwayat, Dokter, Laporan, Nota, Kop Resep, Kop Salinan Resep, dan Akun) |

The app now always opens on the login screen first. Nobody can reach any menu without
signing in, and the navigation bar itself only shows the menus the logged-in role is
allowed to use (a doctor account simply won't see the other tabs at all).

## Default login credentials
Set on first run — **please change these immediately** via the "Akun" menu
(visible only to the Apoteker account):

- **Dokter** → username: `dokter` / password: `dokter123`
- **Apoteker** → username: `apoteker` / password: `apoteker123`

## Where data is stored
- Accounts (username/password per role) are stored in the browser's `localStorage`
  under the key `pos_users`, same place all the other app data already lives.
- The active login session is stored under `pos_auth_session`. Logging out clears it;
  closing the tab without logging out keeps the session active on that device/browser
  until someone taps the 🚪 logout button.

## New menu: "Akun"
Only the Apoteker account can see and open this menu. From there you can change the
username and/or password for either the Dokter or the Apoteker account.

## Notes / limitations
This is a simple, local (client-side) authentication layer suited for a single shared
clinic device — there is no server-side user database. Anyone with access to the
browser's developer tools/localStorage on that device could technically inspect the
stored credentials, so use this primarily to separate menu access between staff
members on a shared kiosk, not as protection against a technically sophisticated
local attacker.
