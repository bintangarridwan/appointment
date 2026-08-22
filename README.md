# Room Booking API

Aplikasi backend & frontend untuk pemesanan ruangan (room booking) terintegrasi dengan **Microsoft Graph API (Azure AD)**.

## Fitur Utama

- **Pemesanan Ruangan**: Integrasi langsung dengan kalender ruang meeting Microsoft 365.
- **Autentikasi SSO**: Login aman menggunakan akun Azure AD (MSAL).
- **Auto-Logout Sesi**: Sistem di-background akan otomatis redirect ke halaman login jika token sesi Microsoft kedaluwarsa (idle timeout).
- **Admin Activity Logs**:
  - Menyimpan histori aktivitas (Login, Booking, Cancel) ke dalam SharePoint Excel.
  - Menampilkan ukuran file log Excel secara dinamis (KB/MB) di dashboard.
  - Filter UI khusus untuk melacak aktivitas pembatalan (Cancel) beserta judul meeting.
- **Pencegahan Overlap**: Validasi backend untuk mencegah bentrok jadwal pada ruangan yang sama.

## Teknologi & Bahasa

- **Bahasa:** JavaScript (Node.js)
- **Framework & Server:** Express.js (`^5.2.1`)
- **Autentikasi & API Integrasi:**
  - `@azure/msal-node` (`^5.4.0`) - Autentikasi MSAL (Microsoft Authentication Library)
  - `@microsoft/microsoft-graph-client` (`^3.0.7`) - Client SDK Microsoft Graph API
  - `jsonwebtoken` (`^9.0.3`) & `jwks-rsa` (`^4.1.0`) - Verifikasi JWT Token
- **Keamanan & Limiting:**
  - `cors` (`^2.8.6`) - Cross-Origin Resource Sharing
  - `express-rate-limit` (`^8.6.1`) - Pembatasan request rate limit
- **Utilitas & Dev:**
  - `dotenv` (`^17.4.2`) - Pengelolaan environment variable
  - `isomorphic-fetch` (`^3.0.0`) & `tr46` (`^6.0.0`)
  - `daisyui` (`^5.7.4`) - Plugin UI CSS (Dev Dependency)

---

## Struktur Folder & File

```text
.
├── assets/                  # Aset statis pendukung
│   └── public/
│       └── logo.jpg
├── config/                  # Konfigurasi MSAL & Rate Limiter
│   ├── limiter.js           # Konfigurasi express-rate-limit
│   └── msal.js              # Konfigurasi MSAL Node (Azure AD Client Application)
├── controllers/             # Logika Controller API
│   ├── roomController.js    # Manajemen daftar ruangan, event booking, dan pembatalan
│   └── userController.js    # Pencarian user, direktori, dan pengecekan jadwal (schedule)
├── middlewares/             # Express Middlewares
│   └── auth.js              # Verification middleware JWT token / public access
├── public/                  # Static Frontend Files
│   ├── js/                  # JavaScript frontend
│   │   ├── addressbook.js   # Logika address book / daftar kontak
│   │   ├── auth.js          # Handler autentikasi frontend
│   │   ├── autocomplete.js  # Feature pencarian & autocomplete user
│   │   ├── booking.js       # Form dan modal proses booking
│   │   ├── calendar.js      # Visualisasi jadwal & kalender interaktif
│   │   └── toast.js         # Notifikasi UI toast
│   ├── dashboard.html       # Halaman dashboard utama kalender & booking
│   ├── index.html           # Halaman landing / login
│   ├── logo.jpg             # Logo aplikasi
│   ├── robots.txt           # File instruksi crawler
│   └── style.css            # Custom CSS & styling
├── routes/                  # Express Router
│   └── index.js             # Definisi seluruh endpoint API (/api/...)
├── services/                # Integration Services
│   ├── graphService.js      # Inisialisasi client Microsoft Graph API
│   └── roomService.js       # Data loader helper untuk rooms.json
├── tests/                   # Test suite & script pengujian
│   ├── test-fc-fetch.js
│   ├── test-graph-view.js
│   ├── test-graph.js
│   ├── test-search.js
│   └── test-utc.js
├── .env                     # File variabel lingkungan (Credentials/Secrets)
├── .gitignore               # Daftar file & folder yang diabaikan oleh Git
├── package-lock.json        # Lockfile dependensi npm
├── package.json             # Konfigurasi project & dependensi npm
├── rooms.json               # Konfigurasi data daftar ruangan
├── server.js                # Entry point utama aplikasi Express
└── vercel.json              # Konfigurasi deployment ke Vercel Serverless
```

### Kategori File

- **Core Application (`server.js`, `routes/`, `controllers/`, `services/`):** Menyediakan REST API backend untuk pemesanan ruangan, interaksi dengan Azure AD, dan Microsoft Graph.
- **Konfigurasi (`rooms.json`, `config/`, `.env`, `vercel.json`):**
  - `rooms.json` mengatur daftar ruangan yang dapat dipesan (nama, email kalender room, kapasitas).
  - `.env` menyimpan kredensial sensitif Azure AD.
  - `vercel.json` mengatur opsi deployment serverless di Vercel.
- **Frontend (`public/`):** Antarmuka pengguna interaktif (HTML, CSS, JS) untuk melihat jadwal kalender ruangan, mencari user, dan mengajukan pemesanan.

---

## Endpoint API

Seluruh endpoint terdaftar di `routes/index.js` dengan prefix `/api`:

| Method | Endpoint | Deskripsi | Rate Limit |
|---|---|---|---|
| `GET` | `/api/rooms` | Mendapatkan daftar ruangan dari `rooms.json` | API Limiter |
| `GET` | `/api/config` | Mendapatkan konfigurasi publik aplikasi | API Limiter |
| `GET` | `/api/events` | Mendapatkan semua event jadwal dari kalender ruangan | API Limiter |
| `POST` | `/api/rooms/:id/book` | Membuat pemesanan/booking ruangan baru | Booking Limiter |
| `DELETE` | `/api/events/:roomEmail/:eventId` | Menghapus / membatalkan pemesanan event | API Limiter |
| `GET` | `/api/users/search` | Mencari user Azure AD berdasarkan query nama/email | API Limiter |
| `POST` | `/api/users/schedule` | Mendapatkan status jadwal free/busy user | API Limiter |
| `GET` | `/api/users/directory` | Mendapatkan daftar direktori user | API Limiter |

---

## Cara Install & Menjalankan

1. Clone repositori ini.
2. Buka terminal di folder project, jalankan:
   ```bash
   npm install
   ```
3. Buat file `.env` di root folder (gunakan format di bawah).
4. Jalankan server lokal:
   ```bash
   npm start
   ```
   Aplikasi akan berjalan di `http://localhost:3000` (atau port sesuai `.env`).

---

## Script Project (`package.json`)

Jalankan perintah berikut di terminal:
- `npm start` : Menjalankan server aplikasi (`node server.js`).
- `npm test` : Script pengujian (dapat digunakan untuk pengujian kustom).

---

## Konfigurasi Azure AD (`.env`)

Aplikasi membutuhkan kredensial Azure AD untuk mengakses Microsoft Graph API. Buat file `.env` dengan isi:

```env
TENANT_ID=your-tenant-id-here
CLIENT_ID=your-client-id-here
CLIENT_SECRET=your-client-secret-here
CORS_ORIGIN=http://localhost:3000
PORT=3000
```

### Langkah Registrasi Azure AD Application:

1. Login ke [Azure Portal](https://portal.azure.com/).
2. Buka layanan **Microsoft Entra ID** (Azure Active Directory).
3. Klik menu **App registrations** > **New registration**.
   - Beri nama aplikasi.
   - Pilih *Accounts in this organizational directory only*.
   - Klik **Register**.
4. Di halaman **Overview** aplikasi, salin:
   - **Application (client) ID** -> Masukkan ke `CLIENT_ID`.
   - **Directory (tenant) ID** -> Masukkan ke `TENANT_ID`.
5. Buka menu **Certificates & secrets** > **Client secrets**.
   - Klik **New client secret**.
   - Beri deskripsi & masa berlaku, klik **Add**.
   - Salin isi kolom **Value** -> Masukkan ke `CLIENT_SECRET`. *(Catatan: Value hanya muncul sekali saat dibuat)*.
6. Buka menu **API permissions** > **Add a permission**.
   - Pilih **Microsoft Graph** > **Application permissions**.
   - Tambahkan permission `Calendars.ReadWrite` dan `User.Read.All`.
   - Klik **Grant admin consent for [Nama Organisasi]** hingga status bercentang hijau.
