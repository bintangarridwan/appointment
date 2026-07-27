# Room Booking API

Aplikasi backend untuk pemesanan ruangan menggunakan Node.js, Express, dan Microsoft Graph API (Azure AD).

## Teknologi & Bahasa
- **Bahasa:** JavaScript (Node.js)
- **Framework:** Express.js (`^5.2.1`)
- **Autentikasi & API:** 
  - `@azure/msal-node` (`^5.4.0`)
  - `@microsoft/microsoft-graph-client` (`^3.0.7`)
  - `jsonwebtoken` (`^9.0.3`)
  - `jwks-rsa` (`^4.1.0`)
- **Keamanan & Utilitas:** 
  - `cors` (`^2.8.6`)
  - `express-rate-limit` (`^8.6.1`)
  - `dotenv` (`^17.4.2`)
  - `isomorphic-fetch` (`^3.0.0`)
  - `tr46` (`^6.0.0`)

## Struktur Folder & File

```text
.
├── public/              # File statis frontend (HTML, CSS, JS)
├── tests/               # File pengujian
├── .env                 # Variabel environment (rahasia, tidak di-commit)
├── package.json         # Konfigurasi dependensi project
├── rooms.json           # Data konfigurasi daftar ruangan
├── server.js            # Main logic aplikasi (Express, route, Graph API)
└── vercel.json          # Konfigurasi deployment untuk Vercel
```

### Kategori File
- **File Core (Inti Aplikasi):** `server.js` (logic backend utama, rute API, dan autentikasi Azure AD).
- **File Konfigurasi (Boleh Diubah):** 
  - `rooms.json` (menambah/menghapus daftar ruangan untuk di-booking).
  - `.env` (mengatur environment variables dan credential).
  - `public/*` (mengubah dan mendesain UI/UX frontend).
- **File Flow (Alur Sistem):**
  1. User interaksi di frontend (`public/*`).
  2. Frontend memanggil rute `/api/*` di `server.js`.
  3. `server.js` memvalidasi request dan rate limit.
  4. `server.js` mengambil credential ruangan (`rooms.json` + `.env`).
  5. `server.js` berkomunikasi dengan Microsoft Graph API (booking, baca jadwal).
  6. Response dikembalikan ke frontend.

## Cara Install

1. Clone repositori ini.
2. Buka terminal di folder project, jalankan:
   ```bash
   npm install
   ```
3. Buat file `.env` di root folder (lihat bagian konfigurasi di bawah).
4. Jalankan server lokal:
   ```bash
   npm start
   ```

## Script Project (package.json)

Jalankan perintah berikut di terminal (melalui `npm run <script>` atau `npm <script>`):
- `npm start` : Menjalankan server aplikasi (`node server.js`).
- `npm test` : Menjalankan script pengujian (belum dikonfigurasi).

## Konfigurasi Azure AD (.env)

Aplikasi membutuhkan kredensial Azure AD untuk mengakses Microsoft Graph API. Buat file `.env` dengan isi:

```env
TENANT_ID=your-tenant-id-here
CLIENT_ID=your-client-id-here
CLIENT_SECRET=your-client-secret-here
CORS_ORIGIN=http://localhost:3000
```

### Cara Mendapatkan Tenant ID, Client ID, dan Client Secret:

1. Login ke [Azure Portal](https://portal.azure.com/).
2. Buka layanan **Microsoft Entra ID** (sebelumnya Azure Active Directory).
3. Klik menu **App registrations** > **New registration**.
   - Beri nama aplikasi.
   - Pilih *Accounts in this organizational directory only*.
   - Klik **Register**.
4. Di halaman **Overview** aplikasi, salin:
   - **Application (client) ID** -> Masukkan sebagai `CLIENT_ID`.
   - **Directory (tenant) ID** -> Masukkan sebagai `TENANT_ID`.
5. Buka menu **Certificates & secrets** > **Client secrets**.
   - Klik **New client secret**.
   - Beri deskripsi dan masa berlaku, klik **Add**.
   - Salin isi dari kolom **Value** (bukan Secret ID) -> Masukkan sebagai `CLIENT_SECRET`. *(Catatan: Value hanya muncul sekali saat dibuat)*.
6. Buka menu **API permissions** > **Add a permission**.
   - Pilih **Microsoft Graph** > **Application permissions**.
   - Cari dan centang `Calendars.ReadWrite` dan `User.Read.All` (atau sesuaikan dengan kebutuhan aplikasi).
   - Klik **Add permissions**.
   - Klik **Grant admin consent for [Nama Organisasi]** agar statusnya menjadi hijau (Granted).
