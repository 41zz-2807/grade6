# agents.md — Sistem Informasi Uang Kas Kelas & Komite GIIS Grade 6 Jannatul Firdaus

## 2026-09-29 - Setup Awal

- Database dibuat: **grade6_db** (user `grade6_user`) di container existing `postgres-15` (PostgreSQL 15.19)
- Docker compose siap di port **3004** (hanya expose `3004:3000`, tanpa nginx)
- Status: **siap lanjut schema & auth**

### Credential
- Sumber kebenaran: `.credential.txt` (gitignored, tidak boleh di-commit)
- `.env` di-generate dari sana via `./scripts/gen-env.sh` (mode 600, gitignored)
- Tidak ada secret yang di-hardcode di source code. `.env.example` hanya berisi placeholder.

### Arsitektur
- Monorepo npm workspaces: `apps/api` (NestJS 10) + `apps/web` (Next.js 14 App Router + Tailwind + shadcn/ui)
- Satu image Docker menjalankan 3 proses: `docker/proxy.js` (port 3000, satu-satunya yang
  dipublish ke host sebagai **3004**), Next.js (internal 3002), NestJS (internal 3001).
  Proxy meneruskan `/api/*` dan `/uploads/*` ke NestJS, sisanya ke Next.js.
- Kenapa ada proxy (bukan `rewrites` Next.js): Next.js 14 tidak mengekspos IP socket klien
  dan meneruskan `X-Forwarded-For` kiriman klien apa adanya → IP bisa dipalsukan, rate limit
  dan audit log jadi tidak tepercaya. Detail di bagian auth.
- Join network external `war-nt-web_default` (network milik container `postgres-15`).
- Bukti transaksi: bind mount `./upload` → `/app/uploads` (persist di host, tidak masuk image).

### Perintah umum
```bash
docker compose up -d --build        # build + jalankan
docker compose logs -f               # log API + web + proxy
docker compose ps                    # cek healthcheck
./scripts/db-bootstrap.sh            # (re) buat role + database, idempotent
./scripts/gen-env.sh                 # regenerate .env dari .credential.txt
./scripts/create-admin.sh            # tambah user admin baru (prompt username + password)
./scripts/change-admin-password.sh admin 'password-baru'
./scripts/clear-transactions.sh      # HAPUS semua transaksi (konfirmasi "YA" wajib)
./scripts/sync-telegram-settings.sh  # kredensial Telegram -> tabel settings

# Migrasi & seed (jalan di dalam container, host DB hanya resolve di network Docker)
docker compose exec app npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
docker compose exec app npx prisma db seed --schema apps/api/prisma/schema.prisma
docker compose exec app npx prisma studio

# Kalau mau migrate dari host, arahkan ke port yang di-map postgres-15 (32768):
#   export DATABASE_URL="${DATABASE_URL/@postgres-15:5432/@127.0.0.1:32768}"
#   npx prisma migrate dev --name <nama> --schema apps/api/prisma/schema.prisma
```

### Status per komponen
- [x] Database + role + hak akses (termasuk CREATE on schema public untuk migrasi)
- [x] Dockerfile multi-stage, image `giis-grade6-kas:0.1.0`
- [x] docker-compose.yml (port 3004, external network, bind mount upload, healthcheck)
- [x] Prisma client ter-generate, `GET /api/health` return `database: connected`
- [x] Halaman depan Next.js render, status Next/Nest/DB tampil hijau
- [x] Prisma schema model bisnis lengkap + migration
- [x] Aturan bisnis di service (kas kelas, komite, TRANSFER wajib bukti)
- [x] Seed admin + script ganti password
- [x] Auth: JWT cookie httpOnly, rate limit, counter, CAPTCHA, lock, Telegram
- [x] Path admin `/gema` tanpa link publik + robots + noindex
- [x] Endpoint master (rekening, popup, iuran, masa ajaran) — JWT
- [x] Endpoint laporan (summary, transaksi, export PDF & Excel) — JWT
- [x] API publik (rekening, summary, transaksi, popup, PDF) — tanpa auth
- [x] Zona waktu Asia/Jakarta (Telegram, PDF, Excel)
- [x] **Halaman publik** (mobile-first, Tailwind + shadcn) — rekening, 3 kartu, history + pagination, PDF, modal info
- [x] **Halaman UI admin `/gema`** — login, dashboard, 5 master data, pemasukan, pengeluaran, laporan, export, pengaturan
- [ ] Multi-role (semua user saat ini otomatis admin)

### Catatan untuk tahap berikutnya
1. `binaryTargets = ["native", "debian-openssl-3.0.x"]` wajib di generator Prisma, kalau tidak
   container gagal boot dengan error engine `debian-openssl-1.1.x` vs `3.0.x`.
2. `next.config.mjs` memakai `images: { unoptimized: true }` untuk menutup endpoint
   `/_next/image` (app tidak butuh optimasi gambar).
3. **Keamanan:** `npm audit` masih melaporkan 1 critical + 5 high pada dependency produksi.
   Advisory Next.js (DoS, SSRF, cache poisoning) dan NestJS/multer **hanya** diperbaiki di
   Next 16 / Nest 12 — incompatible dengan stack yang diminta (Next 14 + NestJS 10), jadi
   sengaja ditahan. Rekomendasi: bump ke Next 15/16 + Nest 11/12 sebelum produksi,
   atau minimal taruh di belakang reverse proxy dengan rate limiting.
4. `apps/web` memakai `output: standalone`; kalau nanti `rewrites` ditambahkan lagi, ingat
   `/api/*` sudah ditangani `docker/proxy.js` — jangan dobelkan.

---

## 2026-09-29 - Schema Prisma & Script Ganti Password

- Prisma schema **lengkap**, migration `20260929045441_init` sudah applied ke `grade6_db`
- Model `Placeholder` **sudah dihapus** (tidak pernah dibuat di database)
- Seed jalan: 1 admin, 3 kategori, 1 masa ajaran, 7 pengaturan
- `scripts/change-admin-password.sh` selesai & teruji (bcrypt 12 rounds)
- **Status: schema selesai — lanjut auth (login/JWT/guard)**
- Verifikasi aturan bisnis: **33/33 PASS** (`/tmp/opencode/test-cash-rules.sh`, belum di-commit ke repo)

### Model yang dibuat
| Model | Tabel | Catatan |
|---|---|---|
| `User` | `users` | username, passwordHash, failedLoginCount, lockedUntil, lastLogin |
| `LoginLog` | `login_logs` | ip, success, timestamp; `userId` nullable (user dihapus → log tetap disimpan) |
| `Setting` | `settings` | key-value; `isSecret` untuk masker nilai (telegram bot token) |
| `AcademicYear` | `academic_years` | name, startMonth, endMonth, isActive (maks 1 aktif) |
| `Student` | `students` | nama, statusKasLunas, statusKomiteLunas, totalKasPaid, totalKomitePaid |
| `IncomeCategory` | `income_categories` | enum `KAS_KELAS` / `KOMITE` / `UMUM` |
| `Income` | `incomes` | date, studentId?, amount, description, paymentMethod, academicYearId |
| `IncomeProof` | `income_proofs` | bukti transfer (1..5 file) |
| `Expense` | `expenses` | date, recipient, amount, description, paymentMethod |
| `ExpenseProof` | `expense_proofs` | bukti transfer |

Enum: `IncomeCategoryType`, `PaymentMethod` (TRANSFER / CASH).

### Aturan bisnis (dienforce di service, bukan di frontend)
Sumber tunggal: `apps/api/src/common/constants/cash-rules.ts`.

| Aturan | Implementasi | Error |
|---|---|---|
| Kas kelas 15.000/bulan | amount wajib kelipatan 15.000 | 400 "harus kelipatan Rp 15.000" |
| Maks 11 bulan (165.000) | `newTotal > 165.000` ditolak, pesan menyebut sisa tagihan | 400 "Maksimal 11 bulan" |
| `total >= 165.000` → lunas | `statusKasLunas = true`, bayar berikutnya ditolak | 400 "sudah lunas" |
| Komite 75.000/masa | boleh dicicil, `total >= 75.000` → `statusKomiteLunas = true` | 400 |
| TRANSFER wajib bukti | `< 1` file ditolak (Income **dan** Expense) | 400 "Bukti transfer wajib" |
| KAS_KELAS & KOMITE butuh siswa | studentId wajib | 400 |
| UMUM | bebas nominal, boleh tanpa siswa, tidak sentuh status lunas | — |

Catatan implementasi:
- Row siswa di-`SELECT ... FOR UPDATE` di dalam transaksi supaya 2 pembayaran bersamaan
  tidak saling menimpa total (lost update).
- `totalKasPaid`/`totalKomitePaid` diperbarui **sebelum** `income.create` agar relasi
  `student` di respons sudah terbaru (bug awal: respons mengembalikan data basi).
- Nominal uang memakai `Decimal(14, 2)`, bukan `Int`/`Float`. Service mengonversi ke
  `number` saat respons API (`common/utils/money.ts`).
- `proofFiles[]` diimplementasikan sebagai tabel anak (`IncomeProof` / `ExpenseProof`),
  bukan `String[]`, supaya nama asli, mime, ukuran, dan waktunya tersimpan untuk audit.
- Bukti dilepas dari disk kalau transaksi gagal (`removeProofFiles`).
- Maks 5 file per transaksi, maks 10 MB/file, hanya JPG/PNG/WEBP/PDF, nama file di-uuid.
- `Setting.isSecret` = true → nilainya dikembalikan `"********"` di API. `telegram.botToken`
  di-seed dari `.env` (dari `.credential.txt`), jadi token ada di DB **dan** ter-mask.

### Seed (`apps/api/prisma/seed.ts`)
Idempotent. Password admin awal diambil dari `DEFAULT_ADMIN_PASSWORD`; kalau
env itu kosong, seed membuat password **acak** dan mencetaknya sekali
(**tidak ada password hardcode di repo**, karena repo ini publik). WAJIB diganti:
```bash
./scripts/change-admin-password.sh admin 'password-kuat-anda'
```
Re-run seed **tidak** akan menimpa password yang sudah diganti.

### Script ganti password
```bash
./scripts/change-admin-password.sh <username> <password>   # password sebagai argumen
./scripts/change-admin-password.sh <username>             # prompted, tidak echoed
NEW_PASSWORD='...' ./scripts/change-admin-password.sh admin
```
- Hash **bcrypt, 12 rounds** (`bcryptjs` — pure JS, aman tanpa toolchain native di image).
- Password dikirim lewat **stdin**, bukan argv, supaya tidak muncul di `ps`/history container.
- Sekalian membuka `lockedUntil` dan reset `failedLoginCount`.
- Hash diverifikasi ulang (`bcrypt.compare`) setelah update.
- Jalan di dalam container (`docker compose exec`), karena host `postgres-15` hanya
  resolve di network Docker.
- Minimal 8 karakter; user tidak ada → exit 1.

### Endpoint yang sudah jadi
```
GET    /api/health                              (publik)
GET    /api/auth/captcha   POST /api/auth/login (publik, limit ketat)
GET    /api/auth/me        POST /api/auth/logout
POST   /api/students            GET /api/students  GET|PATCH|DELETE /api/students/:id
POST   /api/incomes             GET /api/incomes   GET /api/incomes/:id
POST   /api/expenses            GET /api/expenses  GET /api/expenses/:id
GET    /api/income-categories
POST   /api/academic-years       GET /api/academic-years  PATCH /api/academic-years/:id/activate
GET    /api/settings            PATCH /api/settings
GET    /api/uploads/:fileName   (file bukti, dicegah path traversal)
```
Seluruhnya kecuali `/api/health` dan `/api/auth/*` memerlukan sesi login yang valid
(lihat bagian Auth). Method yang mengubah data juga wajib menyertakan header `X-CSRF-Token`.

### Yang belum ada (tahap auth)
- Endpoint login, verifikasi `passwordHash` + `failedLoginCount`/`lockedUntil`, tulis `LoginLog`
- JWT/session + guard (belum ada satupun request guard)
- Halaman frontend (dashboard, siswa, setoran, pengeluaran, laporan) — masih halaman status saja
- Validasi nominal di `proofFiles` untuk expense sudah ada, tapi belum ada upload untuk **penghapusan** transaksi
- `npm audit` masih 1 critical + 5 high (lihat catatan di atas)

---

## 2026-09-29 - Auth Admin (/gema)

- Login JWT + cookie httpOnly, rate limit, counter `failedLoginCount`, CAPTCHA setelah 5x gagal,
  lock sementara + notifikasi Telegram setiap 5x gagal, notifikasi tiap login sukses
- Kredensial Telegram **dipindah ke tabel `settings`**, tidak lagi ada di `.env`/environment
- **Status: auth selesai — lanjut halaman CRUD admin & laporan**
- Verifikasi: **auth 47/47 PASS**, aturan bisnis tetap **33/33 PASS** (semua endpoint kini butuh login)

### Peta proteksi
| Lapis | Nilai | Sumber |
|---|---|---|
| Rate limit global | 300 req/menit per IP | `API_RATE_LIMIT` |
| Rate limit login | 10 req/menit per IP | `AUTH_RATE_LIMIT` (decorator `@Throttle` di `auth.controller.ts`) |
| CAPTCHA | wajib mulai `failedLoginCount >= 5` | `CAPTCHA_THRESHOLD` |
| Lock akun | 15 menit tiap kelipatan 5 gagal | `LOCK_THRESHOLD`, `LOCK_MINUTES` |
| Sesi | JWT di cookie httpOnly, 8 jam | `JWT_EXPIRES_MINUTES` |

Semua angka di atas ada di `apps/api/src/common/constants/auth-rules.ts` — ubah di sana.

### Alur login
1. Cek `lockedUntil` → masih aktif, tolak (403) walau password benar.
2. Kalau `failedLoginCount >= 5` → CAPTCHA wajib divalidasi **sebelum** cek password.
3. Verifikasi `passwordHash` (bcrypt 12 rounds).
4. Gagal → naikkan counter, tulis `LoginLog`, lalu:
   - kelipatan 5 → lock 15 menit + notifikasi Telegram
   - `>= 5` (bukan kelipatan) → notifikasi Telegram
5. Sukses → reset counter & unlock, tulis `LoginLog`, kirim notifikasi Telegram.

**`failedLoginCount` hanya di-reset saat login sukses — tidak saat lock aktif.** Kalau di-reset
saat lock, penyerang cukup menunggu 15 menit lalu dapat kesempatan tak terbatas tanpa CAPTCHA.

### Keputusan yang perlu dikonfirmasi
1. **CAPTCHA pakai math question, bukan reCAPTCHA/hCaptcha.** Alasannya: math question bisa
  - bisa diimplementasikan sendiri tanpa API key, tanpa layanan pihak ketiga yang bisa
   down, dan cukup menahan bot sederhana. Tokennya HMAC-SHA256 dari `JWT_SECRET` berisi
   jawaban + waktu kedaluwarsa, jadi tidak bisa dipalsukan klien dan tidak bisa dipakai ulang.
   Kalau mau pindah ke reCAPTCHA/hCaptcha, ganti **hanya isi** `CaptchaService` — kontrak
   `issue()`/`verify()` tetap sama, tidak ada perubahan di controller atau frontend.
2. **Ditambah `docker/proxy.js`** (proxy Node 40 baris, tanpa dependency) di depan Next.js
   dan NestJS. Bukan nginx, tetap satu container dan satu port publish. Alasan dan
   konsekuensinya ada di bagian "Perbaikan penting" di bawah.
3. **CSRF double-submit** ditambahkan karena sesi memakai cookie. Cookie sesi
   `httpOnly + sameSite=lax`, cookie CSRF sengaja **tidak** httpOnly supaya frontend bisa
   membacanya dan mengirimkannya balik lewat header `X-CSRF-Token`.
4. **Rate limit 10/menit per IP untuk login.** Kalau sekolah memakai IP/NAT bersama, semua
   administrator bisa saling mengunci. Naikkan lewat `AUTH_RATE_LIMIT` kalau perlu.

### Perbaikan penting (bug yang ditemukan saat testing)
1. **IP klien hilang lewat proxy.** `rewrites` Next.js tidak meneruskan `X-Forwarded-For`,
   dan Next **meneruskan** header kiriman klien apa adanya. Akibatnya penyerang bisa
   **memalsukan IP-nya**: rate limit bisa dilewati dan `login_logs` mencatat IP palsu, sehingga
   alert Telegram menyesatkan. `request.ip` di Next 14 selalu `null` (baik di middleware maupun
   route handler), dan `experimental.nodeMiddleware` tidak ada di 14.2.
   Solusi: `docker/proxy.js` membaca `req.socket.remoteAddress` langsung lalu **selalu
   menimpa** `X-Forwarded-For`; NestJS dikonfigurasi `trust proxy: 'loopback'`.
   Sudah diuji: IP asli tercatat, dan `X-Forwarded-For` palsu dari klien diabaikan.
2. **Rate limit global awalnya 10/menit** — dashboard akan ikut terkunci setelah 10 request.
   Dipisah jadi `API_RATE_LIMIT` (300, semua endpoint) dan `AUTH_RATE_LIMIT` (10, login saja).
3. **CAPTCHA tidak terkirim ke frontend.** Error "CAPTCHA wajib diisi" tidak membawa flag
   `captchaRequired`, jadi form tidak tahu harus menampilkan field CAPTCHA. Sekarang
   `LoginFailedException` selalu membawa flag itu.
4. **`/uploads/*` 404** — proxy meneruskan path apa adanya, sedangkan route NestJS berada di
   `/api/uploads/*`. Sekarang proxy menulis ulang prefix-nya.

### Path admin `/gema`
- Halaman: `/gema` (mengarah ke login atau dashboard), `/gema/login`, `/gema/dashboard`
- **Tidak ada link ke `/gema` dari halaman publik mana pun** (sudah diverifikasi: 0 kemunculan)
- `robots.txt` produced Next.js: `Disallow: /gema`, `/gema/`, `/api/`
- `<meta name="robots" content="noindex, nofollow, nocache">` di layout `/gema`
- `dashboard/page.tsx` mengecek sesi di server dan mengarahkan ke `/gema/login` bila tidak valid
- **Menyembunyikan path BUKAN pengaman.** Kalau path `/gema` bocor, login tetap terlindungi
  oleh JWT + rate limit + CAPTCHA + lock akun. Path tersebut hanya lapisan tambahan.

### Kredensial Telegram
Sumbernya **tabel `settings`**, dibaca `TelegramService` setiap kali mengirim:
```
settings['telegram.botToken']  -- isSecret = true (API membalas "********")
settings['telegram.chatId']
```
- Tidak ada di `.env`, tidak ada di `docker-compose.yml`, tidak ada di environment container
  (sudah diverifikasi: `TELEGRAM_BOT_TOKEN` di container = `TIDAK_ADA`)
- Isi / refresh: `./scripts/sync-telegram-settings.sh` (membaca `.credential.txt` → tulis DB)
- Pengiriman **fire-and-forget** dengan timeout 8 detik: Telegram yang lambat/down tidak
  pernah menggagalkan login. Kegagalan hanya di-log.
- `JWT_SECRET` **sengaja tetap di `.env`** (bukan DB) — secret penanda tangan token tidak
  boleh berada di baris tabel yang bisa dibaca lewat `GET /api/settings`.

### Endpoint auth
```
GET  /api/auth/captcha   -> { question, token, expiresIn }   (publik, limit 20/menit)
POST /api/auth/login     -> set cookie gema_session (httpOnly) + gema_csrf  (limit 10/menit)
GET  /api/auth/me        -> user dari cookie
POST /api/auth/logout    -> hapus kedua cookie
GET  /api/health         -> satu-satunya endpoint lain yang publik
```

### Yang belum ada
- Halaman CRUD admin: siswa, setoran, pengeluaran, laporan/rekap. `/gema/dashboard` baru
  menampilkan shell + info sesi.
- Belum ada "ingat saya" / remember-me.
- Rotasi `JWT_SECRET` = logout semua sesi; belum ada endpoint revoke per-sesi.
- Belum ada `Role` di model `User` — sekarang semua user otomatis admin. Kalau nanti butuh
  lebih dari satu peran, tambahkan kolom role.
- `LoginLog` belum pernah dibersihkan otomatis (pertimbangkan cron jika tabel membesar).
- `npm audit` masih 1 critical + 5 high.

---

## 2026-09-29 - Endpoint Master, Laporan, API Publik & Zona Waktu

- Seluruh endpoint admin master + laporan selesai (dilindungi JWT), plus API publik tanpa auth
- Nilai iuran kas & komite **dipindah dari konstanta ke database** (ubah tanpa deploy)
- Export laporan **PDF** (PDFKit) dan **Excel** (ExcelJS)
- Zona waktu aplikasi diset **Asia/Jakarta (WIB)** — termasuk notifikasi Telegram
- **Status: API lengkap — tinggal halaman UI admin**
- Verifikasi: master/laporan/publik **60/60 PASS**, auth **47/47**, aturan bisnis **33/33**
  (total **140 PASS / 0 FAIL**)

### Zona waktu (Asia/Jakarta)
- Sumber: env `APP_TIMEZONE` (default `Asia/Jakarta`), diset di `docker-compose.yml`
  bersama `TZ` supaya `date` di dalam container juga WIB.
- Semua format tanggal/waktu lewat `common/utils/datetime.ts` — **jangan pakai
  `toISOString()`** untuk waktu yang dilihat pengguna (selalu UTC).
  Helper: `formatDateTime()` ("29 Sep 2026 14.08 WIB"), `formatDate()`, `formatDateTimeId()`,
  `formatTime()`, `timezoneLabel()` ("WIB"/"WITA"/"WIT"), `todayStamp()`.
- Notifikasi Telegram, tanggal transaksi di PDF/Excel, dan nama file laporan ikut zona ini.
- Diuji kasus batas: `2026-09-29T17:30Z` (UTC) → tampil `30 Sep 2026 00.30 WIB`, bukan 29 Sep.
- Kolom waktu di database tetap `timestamp without time zone` dan Prisma selalu menulis UTC
  di dalamnya, jadi **tidak ada pergeseran data** - konversi hanya di lapisan tampilan.
- Ganti zona cukup lewat `APP_TIMEZONE` di `.env` (mis. `Asia/Makassar` → WITA).

### Nilai iuran pindah ke database
- Disimpan di `settings`: `kas.monthlyAmount`, `kas.maxMonths`, `komite.amount`
- Default tetap di `common/constants/cash-rules.ts` (`DEFAULT_CASH_RULES`) sebagai fallback
- `CashRulesService` membacanya (cache 30 detik) dan dipakai `IncomeService` + `StudentsService`
- `PATCH /api/cash-rules` untuk mengubah; **seed tidak lagi menimpa nilai yang sudah diubah admin**
- Penting: aturan 11 bulan & 165.000 di dokumen ini adalah nilai *default*. Kalau diubah admin,
  angka yang berlaku mengikuti nilai di database.

### Endpoint admin baru (semua butuh sesi + `X-CSRF-Token` untuk menulis)
```
GET    PATCH  /api/cash-rules            nilai iuran kas & komite
GET    POST   /api/bank-accounts         CRUD rekening
GET    POST   /api/popup-infos           CRUD popup informasi
PATCH  DELETE /api/academic-years/:id    update & hapus masa ajaran
PATCH  DELETE /api/incomes/:id           update? (hapus + rollback total siswa)
PATCH  DELETE /api/expenses/:id          ubah & hapus pengeluaran (+ hapus file bukti)
GET    /api/reports/summary              saldo, total masuk/keluar, per kategori, status lunas
GET    /api/reports/transactions         list gabungan + pagination + filter
GET    /api/reports/export/pdf           unduh PDF
GET    /api/reports/export/excel         unduh XLSX
```
Filter laporan (`?from=&to=&academicYearId=&studentId=&type=ALL|INCOME|EXPENSE&page=&take=`):
- Pengeluaran **tidak punya siswa**, jadi saat disaring `studentId` sisi pengeluaran otomatis dilewati
- `take` dibatasi 200; laporan dibatasi 1000 baris

### Endpoint publik (tanpa auth, `@Public()`, rate limit 30/menit)
```
GET /api/public/rekening     rekening tujuan transfer - hanya 1 (isPublic), null kalau belum diset
GET /api/public/summary      summary cards: saldo, totalPemasukan, totalPengeluaran
GET /api/public/transactions 10 terakhir + ?page=&take= & hasNextPage
GET /api/public/popup        popup yang aktif & dalam rentang waktu
GET /api/public/laporan.pdf  laporan PDF ringkasan
```

### Privasi API publik (keputusan yang perlu dikonfirmasi)
Transaksi publik memuat nama orang tua/anak. Supaya tidak membocorkan data pribadi:
- **Nama siswa dimasker** di `/public/transactions` dan di PDF publik
  ("Budi Santoso" → "B*** S******"). Bisa dibuka lewat `settings['public.showStudentName'] = 'true'`
- **Bukti transaksi tidak ditampilkan** di publik (`proofCount` dibalas 0/1, tanpa URL)
- PDF publik memakai tabel lebih sempit: kolom Keterangan & Bukti dihapus
- Nomor rekening **tampilkan utuh** karena justru itu tujuan halaman publik (orang tua perlu
  nomor transfer), jadi endpoint-nya hanya di-rate-limit, tidak di-mask. Kalau ingin disamarkan,
  ubah `BankAccountsService.findPublic()`.

### Model baru
| Model | Tabel | Catatan |
|---|---|---|
| `BankAccount` | `bank_accounts` | rekening iuran; **maks 1** `isPublic` (divalidasi service) |
| `PopupInfo` | `popup_infos` | popup publik: title, content, isActive, order, startAt/endAt |

Migration `20260929062704_add_rekening_popup`. Nomor rekening dinormalisasi (spasi & strip dibuang).

### Bug yang ditemukan & diperbaiki saat tahap ini
1. **PDF selalu kosong.** `doc.end()` dipanggil di dalam `Promise` constructor, yaitu
   *sebelum* konten ditulis. PDFKit menutup dokumen duluan → file 52 byte. Sekarang
   `doc.end()` dipanggil setelah semua konten, `resolve` lewat event `end`.
2. **`/reports/summary` 500.** `$transaction([a, b, ...categories.map(...)])` lalu
   destructuring posisional: spread membuat indeks bergeser, `perCategory[1]` `undefined`.
   Dipecah jadi dua transaksi terpisah dengan indeks yang jelas.
3. **`groupBy` tidak bisa dikompilasi.** Tipe `IncomeScalarWhereWithAggregatesInput` di
   Prisma 5.22 menghasilkan circular reference TypeScript (error TS2615) yang tidak bisa
   di-cast. Diganti `aggregate` per kategori (kategori hanya 3, hasilnya sama).
4. **Filter tipe transaksi bocor.** Placeholder `where: { id: "__none__" }` dipakai untuk
   menyaring satu sisi, tapi tidak benar-benar menyaring apa pun.
   Sekarang kedua sisi bersifat kondisional: `type=EXPENSE` melewati sisi income (dan
   sebaliknya), dan filter `studentId` juga melewati sisi pengeluaran.

5. **Menghapus income tidak mengembalikan total siswa.** `totalKasPaid`/`totalKomitePaid`
   masih berisi nominal yang sudah dihapus, jadi tidak cocok dengan daftar transaksi.
   `DELETE /api/incomes/:id` sekarang mengunci baris siswa, mengurangi nominal, dan
   **menghitung ulang** `statusKasLunas`/`statusKomiteLunas` dari nominal iuran saat ini.

### Yang belum ada
- **Halaman UI admin**: hanya `login` + shell `dashboard`. Semua endpoint sudah siap,
  tinggal layarannya (CRUD siswa, setoran, pengeluaran, master, laporan + tombol export).
- Halaman publik belum membaca endpoint `/api/public/*`.
- Tidak ada paginasi cursor untuk laporan besar (sekarang `page`/`take`).
- Edit income (`PATCH /api/incomes/:id`) belum ada - baru create, list, delete.
- Laporan Excel tidak punya pivot per kategori siswa (hanya ringkasan per kategori).
- PDF memakai font bawaan Helvetica (WinAnsi) - nama dengan huruf di luar Latin-1
  bisa tampil imperfect; tidak ada font eksternal yang dibundel supaya image tetap kecil.
- `npm audit` masih 1 critical + 5 high.




---

## 2026-09-29 - Halaman Publik (Mobile-first)

- Halaman depan `apps/web/src/app/page.tsx` sekarang halaman publik lengkap
- **Status: halaman publik selesai — tinggal halaman UI admin `/gema`**
- Verifikasi: **browser sungguhan (Playwright/Chromium) 28/28 PASS** di 390px (iPhone 13),
  768px (tablet), dan 1280px (desktop). Regresi API tetap: auth 47/47, aturan bisnis 33/33,
  master+laporan 60/60.

### Isi halaman
| Bagian | Sumber | Catatan |
|---|---|---|
| Header + tombol Informasi | `popup_infos` via `/api/public/popup` | modal Radix; **sheet dari bawah di HP**, dialog tengah di desktop |
| Kartu rekening | `/api/public/rekening` | diambil **di sisi klien**, bukan di-render server |
| 3 kartu: Saldo / Total Pemasukan / Total Pengeluaran | `/api/public/summary` | render server (`force-dynamic`) |
| Transaksi 10 terakhir + pagination | `/api/public/transactions` | render server untuk halaman 1, klik Next ambil via fetch |
| Tombol Download Laporan PDF | `/api/public/laporan.pdf` | `<a target="_blank">` supaya nama file dari `Content-Disposition` dipakai |

### Nomor rekening & "anti-deface"
`AccountCard` sengaja **client-side fetch** supaya nomor rekening tidak ikut tertanam di HTML
awal yang gampang diedit lewat devtools. Teksnya read-only (tanpa `contentEditable`), selalu
di-render apa adanya hasil API, dan diberi `tabular-nums` supaya lebar angka stabil.
Format: `formatNomorRekening()` mengelompokkan 4 digit (`8871234509` → `8871 2345 09`),
mengikuti kebiasaan nomor rekening bank di Indonesia. Ada tombol Salin (`navigator.clipboard`).
**Penting:** ini bukan pengaman sungguhan. Edit di browser cuma mengubah layar pengunjung itu
sendiri; yang dilihat pengguna lain tetap angka asli dari server.

### Responsive
- **Mobile (< 768px):** daftar transaksi berupa **kartu**, bukan tabel. Tabel rupiah di layar
  390px akan sempit dan wrappingnya rusak. Kartu ringkasan 1 kolom, tombol jadi teks pendek
  ("Info", "Unduh PDF").
- **Desktop (≥ 768px):** tabel (`hidden md:block`), kartu disembunyikan (`md:hidden`),
  3 kartu ringkasan dalam 1 baris (`sm:grid-cols-3`), modal ter-center.
- **Anti-overflow:** diuji `scrollWidth - clientWidth == 0` di 390 / 768 / 1280px.
  Teks panjang dipotong dengan `truncate`, nominal pakai `break-words`.
- Modal: `max-h-[85dvh]` + `overflow-y-auto overscroll-contain` supaya bisa di-scroll di HP.

### Nol Referensi ke Admin
Tidak ada **satu pun** link, tombol, atau teks yang menuju admin. Diverifikasi di DOM:
- 0 kemunculan string `gema` di HTML publik
- 0 `href` yang cocok `/gema` atau `/admin` di mobile & desktop
- Satu-satunya `href` non-aset: `/api/public/laporan.pdf`

### Komponen
```
components/public/site-header.tsx        header + slot tombol
components/public/account-card.tsx       rekening (client fetch, skeleton, salin)
components/public/summary-cards.tsx      3 kartu ringkasan
components/public/transactions-history.tsx  history + pagination (kartu/tabel responsif)
components/public/info-button.tsx        tombol info + modal popup
components/public/download-pdf-button.tsx tombol unduh PDF
components/ui/dialog.tsx                 shadcn Dialog (sheet mobile / dialog desktop)
components/ui/table.tsx                  shadcn Table
components/ui/badge.tsx                  shadcn Badge (Tunai/Transfer)
components/ui/skeleton.tsx               shadcn Skeleton
lib/public-api.ts                        klien API publik untuk Server Component
lib/format.ts                            formatRupiah, formatTanggal, formatNomorRekening
```
Dependency baru: `@radix-ui/react-dialog`.

### Catatan
- Halaman tetap berfungsi saat data kosong: kartu rekening menampilkan pesan "Rekening resmi
  belum tersedia", history menampilkan empty state. Sudah diuji setelah data uji dihapus.
- `formatRupiah` memakai `Intl.NumberFormat("id-ID", {currency:"IDR"})` yang menyisipkan
  **non-breaking space** (U+00A0) antara "Rp" dan angka — itu Standar ICU dan justru
  mencegah "Rp" terpisah ke baris sendiri. Kalau grep test, perhatikan karakter itu.
- `force-dynamic` dipakai supaya saldo/transaksi tidak pernah ditampilkan dari cache.

### Yang belum ada
- **Halaman UI admin `/gema`** — masih login + dashboard kosong. Semua endpoint admin sudah siap.
- Filter periode (dari/sampai) di halaman publik; endpoint sudah mendukung `?from=&to=`.
- Halaman publik belum punya halaman detail per kategori.

---

## 2026-09-29 - Halaman UI Admin `/gema`

- Panel admin lengkap: login, dashboard, 5 halaman master data, input pemasukan &
  pengeluaran, laporan detail + viewer bukti, export, pengaturan
- Route memakai route group `(app)` supaya guard sesi hanya membungkus halaman
  admin, bukan halaman login
- Backend tambah 2 endpoint: `POST /api/auth/change-password` & `GET /api/auth/login-logs`
- **Status: UI publik & admin selesai** — aplikasi utuh dan bisa dipakai
- Verifikasi: **UI admin 47/47 PASS** (browser sungguhan, 390px & 1280px), UI publik
  28/28, auth 47/47, aturan bisnis 33/33, master+laporan 60/60

### Peta halaman
| Route | Isi |
|---|---|
| `/gema/login` | form login + CAPTCHA (sudah ada sebelumnya) |
| `/gema/dashboard` | kartu saldo/masuk/keluar + menu Master Data & Transaksi Harian |
| `/gema/master/siswa` | CRUD siswa, progress iuran, status lunas, pencarian |
| `/gema/master/rekening` | CRUD rekening, tandai satu sebagai publik |
| `/gema/master/info` | CRUD popup (judul, isi, urutan, rentang waktu tampil) |
| `/gema/master/iuran` | set nominal kas/bulan, maks bulan, iuran komite + pratinjau tagihan |
| `/gema/master/tahun-ajaran` | CRUD masa ajaran, aktivasi (maks 1 aktif) |
| `/gema/pemasukan` | form kas/komite/umum + logika iuran + multi upload bukti |
| `/gema/pengeluaran` | penerima/toko, nominal, metode, multi upload bukti |
| `/gema/laporan` | daftar transaksi + filter (jenis/tanggal) + hapus + viewer bukti |
| `/gema/export` | filter periode + unduh PDF/Excel + pratinjau ringkasan |
| `/gema/pengaturan` | Telegram, ganti password (indikator kekuatan), riwayat login |

### Logika iuran di form pemasukan
- Kategori `KAS_KELAS` / `KOMITE` memunculkan pemilih siswa; `UMUM` tidak
- Panel info siswa menampilkan sisa tagihan (**nilai diambil dari API**, bukan
  hardcode 15.000/75.000) dan badge lunas
- Validasi klien mencerminkan aturan server: kelipatan iuran, batas maksimum bulan,
  sisa tagihan, dan bukti wajib saat TRANSFER. **Server tetap memvalidasi ulang.**
- Pintasan nominal: 1/3/6 bulan dan "bayar sisa" untuk kas; "penuh"/"bayar sisa" untuk komite
- Setelah submit, daftar siswa di-refresh sehingga progress langsung terupdate

### Navigasi responsif
- **Desktop (≥1024px):** sidebar tetap, dua grup (Transaksi Harian & Master Data)
- **Mobile (<1024px):** bottom bar 5 menu + tombol menu membuka drawer berisi
  semua menu. `main` diberi `pt-16 pb-20` untuk memberi ruang pada topbar dan
  bottom bar yang `fixed`.
- Halaman publik & admin **tidak saling-taut**: `/gema` tidak muncul di mana pun
  di halaman publik, dan halaman publik tidak muncul di admin.

### Bug penting yang ditemukan (semua hanya terlihat di browser sungguhan)
1. **Seluruh form gagal terkirim tanpa pesan.** Input uang memakai
   `min={1} step={500}`, sehingga HTML5 hanya menerima `1, 501, 1001, ...` —
   **15.000 dan 45.000 ditolak browser** dan submit diblokir diam-diam.
   Diperbaiki: semua input uang `step={1}` (Rupiah = bilangan bulat).
   Ditemukan lewat `form.checkValidity()`, bukan lewat HTTP karena tidak ada
   request yang terkirim sama sekali.
2. **Layout mobile remuk: konten hanya 215px dari 390px.** `AdminNav` dirender
   sebagai anak baris `flex` yang juga jadi induk `<main>`, sehingga topbar mobile
   ikut jadi flex item dan memakan lebar. Diperbaiki: topbar jadi `fixed`
   (keluar dari alur flex) + `main` dapat `pt-16`.
3. **Halaman siswa crash** (`items.filter is not a function`): `/api/students`
   mengembalikan objek terpaginate `{items}`, sedangkan `useCrud` mengira array.
   Diperbaiki dengan helper `fetchList()` yang menoleransi dua bentuk respons.
4. **Hanya boleh ada satu siswa tanpa NIS.** Form mengirim `nis: ""` (string
   kosong) alih-alih mengosongkan field, sehingga siswa kedua menabrak unique
   constraint. Diperbaiki: `dto.nis?.trim() || null`.
5. **NIS duplikat jadi HTTP 500** berisi detail internal Prisma. Diperbaiki:
   error `P2002` diterjemahkan jadi 400 yang bisa dibaca pengguna.
6. **Tombol Keluar di sidebar tidak punya nama aksesibel** (hanya ikon).
   Ditambah `aria-label`.
7. **Backdrop drawer & tombol X sama-sama ber-`aria-label` "Tutup menu"** —
   nama aksesibel kembar dan backdrop menutupi tombolnya sendiri. Backdrop
   diubah jadi `<div>`.

### Catatan
- `useCrud` (`lib/use-crud.ts`) dipakai semua halaman master: ambil daftar, submit
  create/update, hapus, dengan pesan error yang seragam.
- Password bot Telegram **tidak pernah dikirim balik ke form**. `GET /api/settings`
  membalas `********`, jadi field token dikosongkan saja saat sudah tersimpan;
  kalau tidak dikosongkan, nilai lamanya tidak ikut tertimpa.
- Ganti password memverifikasi password lama dulu, lalu mengirim notifikasi
  Telegram, membuka kunci akun, dan mereset `failedLoginCount`.
- Halaman laporan menghapus income dan expense lewat endpoint berbeda
  (`type` menentukan path) dan setelah hapus income total siswa dihitung ulang
  oleh server.
- **Catatan soal pengujian:** emulator `isMobile: true` di Playwright membuat
  `elementFromPoint()` tidak sinkron dengan `getBoundingClientRect()` sehingga
  semua hit-test koordinat salah. Test admin memakai viewport 390px + `hasTouch`
  tanpa `isMobile` — CSS breakpoint-nya sama, tapi hit-test jadi andal.

### Yang belum ada
- Edit income (`PATCH /api/incomes/:id`) — halaman laporan baru bisa hapus, belum ubah
- Halaman riwayat login belum ada filter (IP/success/ tanggal)
- Laporan admin belum bisa difilter per siswa (endpoint sudah mendukung `studentId`)
- Tidak ada grafik; semua berupa angka & tabel
- `npm audit` masih 1 critical + 5 high (Next 16 / Nest 12 needed)

---

## 2026-09-30 - Script Admin, Clear Transaksi, Import Siswa & Sesi Idle 5 Menit

- 3 fitur operasional: tambah admin non-interaktif, kosongkan transaksi, import siswa massal
- Sesi admin sekarang **hangus setelah idle 5 menit** (sebelumnya 8 jam, tanpa batas idle)
- **Status: keempat fitur terpasang & teruji**
- Verifikasi: idle timeout diuji end-to-end dengan `SESSION_IDLE_MINUTES=1` (sliding
  refresh menahan sesi 2 menit penuh, lalu 401 setelah diam), import siswa **13 kasus PASS**,
  clear transaksi **12/12 PASS**. Semua diuji di database throwaway `grade6_kas_test`,
  **DB produksi tidak pernah disentuh** (dicek sebelum & sesudah: 4 siswa / 4 income /
  3 expense / 2 user, tidak berubah).

### Script tambah admin (`scripts/create-admin.sh`)
```
./scripts/create-admin.sh                    # prompted: username + password
./scripts/create-admin.sh <username>         # prompted: password saja
./scripts/create-admin.sh <username> <password>
NEW_PASSWORD='...' ./scripts/create-admin.sh <username>
```
- Password lewat **stdin**, bukan argv (sama seperti `change-admin-password.sh`) supaya
  tidak muncul di `ps`/history
- Prompt username ditambahkan karena versi pertama hanya menerima argumen, padahal
  cara yang paling enak dipakai justru tanpa argumen sama sekali
- Bcrypt **12 rounds**, min 8 karakter, min 60 karakter username (mengikuti `@MaxLength`
  di `LoginDto` — username yang lebih panjang akan tersimpan tapi tidak akan bisa login)
- Username ganda ditolak **dua lapis**: cek `findUnique` dulu (pesan ramah), plus ditangkap
  `P2002` kalau dua proses create jalan bersamaan
- Verifikasi ulang `bcrypt.compare` setelah insert; kalau gagal, user **dibatalkan**
  supaya tidak ada akun dengan password yang tidak diketahui

### Script clear transaksi (`scripts/clear-transactions.sh`)
```
./scripts/clear-transactions.sh             # ringkasan dulu, lalu konfirmasi ketik "YA"
./scripts/clear-transactions.sh --dry-run   # hanya ringkasan
./scripts/clear-transactions.sh --yes       # tanpa konfirmasi (otomatisasi)
```
- Menghapus `incomes`, `expenses`, dan file bukti; **me-reset** `totalKasPaid`,
  `totalKomitePaid`, `statusKasLunas`, `statusKomiteLunas` semua siswa
- **Master data tetap utuh**: siswa, kategori, rekening, popup, masa ajaran, pengaturan,
  akun admin
- **Nama file bukti diambil SEBELUM `deleteMany`**. `IncomeProof`/`ExpenseProof` punya
  `onDelete: Cascade`, jadi barisnya hilang bersama induknya — kalau nama file diambil
  setelahnya, file di disk jadi yatim yang tidak pernah bisa dibersihkan
- Delete + reset siswa dalam **satu `$transaction`**, supaya tidak pernah ada keadaan
  setengah jadi (tagihan siswa sudah 0 tapi transaksinya masih ada, atau sebaliknya)
- File dihapus dari disk **setelah** commit. Kalau langkah ini gagal, yang tertinggal hanya
  file yatim — database tetap konsisten dan tidak ada transaksi palsu di laporan
- Tidak ada backup: skrip menampilkan ringkasan & meminta konfirmasi sebelum menghapus

### Import siswa dari CSV
| Route | Isi |
|---|---|
| `GET /api/students/import-template` | unduh template CSV (dilewati `ParseUUIDPipe`) |
| `POST /api/students/import` | multipart field `file`, CSV, maks 500 baris / 1 MB |

- **CSV, bukan XLSX** — bisa dibuka Excel & Google Sheets, dan parsing-nya ditulis sendiri
  (`common/utils/csv.ts`, ±60 baris) tanpa menambah dependency produksi baru
- Hanya kolom **`nama`**. Barrio `students` **tidak punya NIS** — kolomnya benar-benar
  di-drop di migration `20260929112919_drop_student_nis`, jadi catatan NIS di bagian
  "Halaman UI Admin" di dokumen ini sudah usang
- **Idempoten**: nama yang sudah ada (di DB maupun di baris lain dalam file yang sama)
  **dilewati**, bukan error dan bukan duplikat baru. Aman upload ulang file yang sama
- Dedupe menormalisasi spasi berulang + huruf besar-kecil: `"  ahmad   FAUZI  "` dianggap
  sama dengan `"Ahmad Fauzi"`
- Baris bermasalah **tidak membatalkan import**: yang valid tetap masuk, masalahnya
  dikembalikan per nomor baris (nomor mengikuti baris yang terlihat di Excel, header = 1)
- Parser mendukung tanda kutip (`"Budi, Santoso"`), escape `""`, CRLF/LF, dan BOM
  UTF-8/UTF-16. Koma **tanpa** tanda kutip tetap dianggap pemisah kolom — itu perilaku
  CSV standar, dan Excel otomatis memberi tanda kutip saat menyimpan
- File dibaca **memoryStorage**, bukan `diskStorage`, supaya file impor tidak pernah
  nyangkut di `UPLOAD_DIR`. Validasi isi file di server, bukan cuma ekstensi
- Template diawali **BOM UTF-8** supaya Excel di Windows membuka nama ascii/non-ascii
  dengan benar; round-trip template resmi → import sudah diuji
- `@Get("import-template")` **wajib dideklarasikan sebelum `@Get(":id")`**. Nest
  mencocokkan route sesuai urutan deklarasi, jadi kalau `:id` lebih dulu, request ke
  `import-template` tertangkap `ParseUUIDPipe` dan jadi 400 `uuid is expected`.
  (Ini sempat terjadi saat pengujian karena `dist` masih basi.)

### Sesi admin hangus setelah idle 5 menit
| Lapis | Nilai | Sumber |
|---|---|---|
| Umur token sesi | 5 menit | `SESSION_IDLE_MINUTES` (ganti `JWT_EXPIRES_MINUTES`) |
| Perpanjangan | tiap ada aktivitas, maks 1×/60 detik | `SESSION_REFRESH_MIN_INTERVAL_SECONDS` |

Mekanismenya **sliding session**, dan enforce-nya di server:

1. Token sesi (JWT di cookie `gema_session`) berumur **5 menit**.
2. `SessionKeepAlive` (client, di-mount di layout `/gema`) memanggil
   `POST /api/auth/refresh` saat ada aktivitas → dapat token baru, jam 0 ter-reset.
3. Kalau admin diam > 5 menit, token lama kedaluwarsa → request berikutnya **401** →
   frontend mengarahkan ke `/gema/login?expired=1` dengan pesan
   **"Sesi berakhir, silakan login kembali."**
4. Timer idle di sisi klien juga expired pada 5 menit, supaya user diberi tahu
   **sebelum** mencoba menyimpan form — bukan baru gagal saat menekan tombol.

Keputusan desain:
- **Tidak memakai refresh token terpisah.** Token yang berumur lebih panjang justru
  melemahkan aturan idle timeout. Perpanjang = ganti token sesi biasa.
- **Token CSRF dipakai ulang saat refresh, bukan diacak ulang**, hanya umurnya
  diperpanjang. Kalau diacak tiap 60 detik, dua request yang tumpang tindih bisa
  menghasilkan cookie berbeda dan memicu 403 yang membingungkan.
- **Umur cookie sesi dan cookie CSRF selalu disamakan.** Kalau CSRF tidak ikut
  diperpanjang, cookie CSRF habis duluan dan semua POST berikutnya kena 403
  "Token CSRF tidak ada" alih-alih mengarahkan user login ulang.
- Event aktivitas sengaja **tidak** memakai `mousemove` (terlalu bising) — cukup
  `pointerdown`, `keydown`, `wheel`, `touchstart`.
- Redirect dari **server component** juga membawa `?expired=1`: cookie sesi ada tapi
  API menolaknya → "sesi habis"; tidak ada cookie sama sekali → tamu biasa, tanpa pesan.

Catatan: `SESSION_IDLE_MINUTES` ada di dua tempat (backend + `IDLE_MINUTES` di
`session-keepalive.tsx`) dan harus diubah bersama — komentar di file frontend
menunjuk balik ke konstanta backend.

### Yang belum ada
- Import siswa tidak bisa import kolom selain `nama` (mis. kelas, NIS) karena
  `students` belum punya kolom itu — perlu migration dulu
- Import tidak punya "preview sebelum simpan" dan tidak membatalkan sebagian
  (sekali jalan, semua baris valid langsung tersimpan)
- Tidak ada filter "khusus nama yang mengandung spasi ganda" dsb. di UI
- Halaman pengaturan belum menampilkan durasi idle atau tombol logout semua sesi
- `JWT_EXPIRES_MINUTES` dihapus dari `.env.example`; kalau masih ada di `.env` lama
  itu aman diabaikan (kode sudah tidak membacanya)
- `npm audit` masih 1 critical + 5 high

---

## 2026-10-22 - Rekap Iuran Kas Kelas (PDF) & Perbaikan Nama Siswa

- Laporan PDF baru: **tabel nama siswa × kolom bulan**, bulan yang sudah dibayar
  **dicentang hijau**, yang belum **garis strip**. A4 landscape, muat **1 halaman**.
- Tombol unduh diletakkan di halaman **`/gema/export`** yang sudah ada (bukan route baru),
  lengkap dengan pemilih masa ajaran + satu baris ringkasan.
- Sekalian ditemukan & diperbaiki: **7 nama siswa di database punya spasi/TAB di depan**,
  sehingga kolom nama di laporan bergeser.
- Status: **terpasang, ter-deploy, teruji end-to-end** (24 siswa, 1 halaman).

### Endpoint baru
| Method | Route | Keterangan |
|---|---|---|
| `GET` | `/api/reports/rekap-iuran` | Data rekap (JSON) untuk ringkasan di panel admin |
| `GET` | `/api/reports/export/rekap-pdf` | PDF-nya (`Content-Disposition: attachment`) |

- Dua-duanya butuh sesi admin (cookie `gema_session`); GET tidak butuh CSRF token.
- `academicYearId` opsional (default = masa ajaran aktif), divalidasi `@IsUUID("4")` →
  **400** kalau bukan UUID, **404** kalau UUID-nya tidak ada.
- Nama file: `rekap-iuran-kas-kelas-<YYYY-MM-DD>.pdf` (zona waktu `APP_TIMEZONE`).

### Aturan pengisian bulan (paling penting, jangan diubah diam-diam)

```
bulan terbayar = floor(total kas terbayar / iuran per bulan)
```

dan bulan yang dicentang adalah **bulan-bulan awal masa ajaran, berurutan**.
Masa ajaran 2026/2027 = Jul s.d Mei (11 kolom), iuran Rp 15.000/bulan:

| Pembayaran | Hasil |
|---|---|
| ADIBA Rp 165.000 | 11/11 → Jul s.d Mei semua tercentang |
| AISYILA Rp 75.000 | 5/11 → Jul, Agu, Sep, Okt, Nov tercentang |
| NAZHIFA Rp 45.000 | 3/11 → Jul, Agu, Sep tercentang |

Kenapa **bukan** "dari bulan tanggal pembayaran": bayar penuh Rp 165.000 tanggal
5 Agustus akan menutup 11 bulan dari Agustus (Agustus s.d Juni) — Juni di luar masa
ajaran, jadi **Juli terlihat belum bayar padahal lunas**. Mengisi dari awal masa
ajaran membuat "lunas" selalu berarti semua kolom tercentang, konsisten dengan
status lunas di halaman siswa.

Catatan: jumlah kas & komite **dijumlahkan dari tabel `incomes` per `academicYearId`**,
bukan dari `student.totalKasPaid` yang kumulatif — supaya tetap benar kalau nanti
ada lebih dari satu masa ajaran.

### Centang hijau digambar sebagai VEKTOR, bukan teks "✓"

Ini bukan detail kecil. Font bawaan PDFKit (Helvetica) memakai **WinAnsiEncoding** yang
**tidak punya U+2713 CHECK MARK** — kalau ditulis sebagai teks, glyph-nya tampil kotak
rusak atau kosong. Jadi centang & garis strip digambar dengan operasi garis
(`moveTo`/`lineTo`/`stroke`), plus `lineCap("round")` & `lineJoin("round")` supaya
ujungnya membulat seperti centang tulis tangan.

Konsekuensi lain: nama siswa dengan huruf di luar Latin-1 tetap punya batas yang sama
(font bawaan) — lihat catatan di bagian "Halaman UI Admin".

### Layout PDF
- Kop diringkas jadi **satu baris** (masa ajaran + iuran + komite + waktu dibuat),
  `rowHeight` 16, ringkasan 3 baris + legenda.
- **Terukur**: tabel mulai di 90 pt dari atas halaman; baris terakhir + ringkasan +
  legenda berakhir di ~522 pt, sedangkan batas bawah halaman 559 pt. Jadi **sampai
  sekitar 26 siswa** muat di 1 halaman; sisanya tabel otomatis pindah halaman
  **dengan header yang diulang**.
- Kalau `kas.maxMonths` ≠ jumlah bulan masa ajaran, muncul baris catatan kuning
  ("yang dihitung adalah N bulan") daripada diam-diam memakai angka yang berbeda.

### Verifikasi (semua read-only ke DB produksi)
- Sesi JWT dibuat **langsung dari `JWT_SECRET`** (HS256) — tanpa login, tanpa mengubah
  password admin. Query DB hanya READ.
- Panjang PDF dicek lewat `pdfinfo` → `Pages: 1`, `Page size: 841.89 x 595.28 (A4)`.
- Isi PDF dicek lewat `pdftotext -layout` (nama, kolom, ringkasan) **dan** lewat
  **analisis piksel PPM** (`pdftoppm` → `.ppm`): 84 operasi stroke hijau = 83 centang
  (bulan + komite) + 1 legenda, 208 abu-abu = 205 garis strip + 1 legenda + 2 garis
  tabel. Posisi centang per kolom dicek (baris ADIBA = 11 centang tepat di 11 kolom
  bulan, AISYAH = 2, AISYILA = 5).
- Smoke test seluruh endpoint yang terdampak: `summary`, `transactions`, `export/pdf`,
  `export/excel`, `students`, `academic-years`, `settings`, `incomes`, `auth/me`,
  `auth/daily-report`, halaman publik → **17/17 PASS**.

### Perbaikan: nama siswa tidak lagi bisa punya spasi di depan

- Akar masalah: `CreateStudentDto.name` / `UpdateStudentDto.name` **tidak melakukan
  trim**. Import CSV aman (`normalizeCell` sudah trim), tapi input manual dari form
  tidak — hasilnya nama tersimpan apa adanya.
- Perbaikan: `@Transform(trimName)` di `apps/api/src/students/dto/student.dto.ts`
  (create & update).
- ⚠️ **Turunan dari trim**: `@IsString()` menerima string kosong. Sebelum trim, `"   "`
  tersimpan apa adanya; sesudah trim jadi `""` — nama kosong yang bakalan muncul
  sebagai baris kosong di laporan. Jadi ditambahkan juga
  `@IsNotEmpty({ message: "Nama siswa tidak boleh kosong." })`.
- Diverifikasi **pakai `dist` hasil build** (`nest build` = tsc + `experimentalDecorators`),
  bukan tsx: 7/7 PASS. ⚠️ tsx/esbuild **tidak bisa** memuat DTO NestJS — ia memakai
  dekorator ES baru, sedangkan `ValidateBy` butuh semantik dekorator lama. Kalau
  script uji error `Cannot read properties of undefined (reading 'constructor')`,
  itu artefak harness, bukan bug. Solusinya: `require("reflect-metadata")` lebih dulu
  + `NODE_PATH=<repo>/node_modules`.
- **Data produksi**: 7 baris dibersihkan. Backup nama lama (beserta `id`) ada di
  `/tmp/opencode/backup-nama-siswa.txt`.
- ⚠️ **Jebakan SQL**: `btrim()` PostgreSQL **hanya memotong spasi biasa, bukan TAB**.
  7 nama itu diawali `TAB (0x09) + 2 spasi`, jadi `btrim()` tidak melakukan apa-apa
  (UPDATE tetap melaporkan "7 rows updated" karena nilainya tidak berubah).
  Yang benar: `regexp_replace(name, '^[[:space:]]+|[[:space:]]+$', '', 'g')`.
  Di sisi TypeScript tidak ada masalah — `String.trim()` memang memotong semua
  whitespace termasuk TAB.

### Doc drift yang ditutup: laporan saldo harian Telegram

Fitur ini sudah jalan di kode tapi **tidak pernah ditulis** di dokumen ini:

| Method | Route | Keterangan |
|---|---|---|
| `GET` | `/api/auth/daily-report` | Status: aktif/tidak, jam kirim, cron expression |
| `PATCH` | `/api/auth/daily-report` | Ubah `{ enabled, time }` (`time` format `HH:MM` WIB) |
| `POST` | `/api/auth/daily-report/send-now` | Kirim sekarang (untuk verifikasi manual) |

- Pengaturannya di tabel `settings` (`telegram.dailyReportEnabled`,
  `telegram.dailyReportTime`), default **mati, jam 07:00 WIB**.
- Cron **didaftarkan ulang tiap kali pengaturan berubah** lewat `SchedulerRegistry`
  (bukan dekorator `@Cron`), karena jamnya bisa diubah dari UI.

### Yang belum ada
- Rekap iuran **belum bisa difilter per kelas/kategori** — semua siswa masuk
- Belum ada versi **Excel** rekap per bulan (yang ada file Excel-nya masih rekap transaksi)
- Pratinjau tabel rekap **belum ada** di UI (hanya PDF + 1 baris ringkasan)
- Rekap **tidak menyimpan snapshot**: data diambil dari `incomes` saat dipanggil, jadi
  kalau ada koreksi transaksi lampau, rekap ikut berubah
- `npm audit` masih 1 critical + 5 high

## 2026-11-03 - Kas tidak lagi wajib kelipatan Rp 15.000

- `applyKasRules()` (`apps/api/src/income/income.service.ts`) **tidak lagi menolak**
  nominal bukan kelipatan iuran bulanan. Guard `statusKasLunas` dan batas
  `kasMaxTotal` tetap. Alasan: orang tua kadang menyetor Rp 50.000, dan menolak
  setoran nyata hanya membuat kas tidak tercatat.
- Bulan lunas tetap `floor(total / kasMonthly)` — **tidak ada kode laporan yang
  perlu diubah**, `build()` di `rekap-iuran.service.ts` dan `serialize()` di
  `students.service.ts` sudah memakai pembulatan ke bawah. Rp 50.000 → 3 bulan
  (Jul–Sep), `3/11`, sisa Rp 115.000; lebih Rp 5.000 menjadi kredit bulan ke-4.
- Validasi klien di `pemasukan/page.tsx` ikut dihapus (modulo), dan batas maks
  diganti `amount > student.kas.remainingAmount` supaya angkanya sama persis
  dengan yang dicek server.
- ⚠️ **Regresi yang ikut diperbaiki**: `totals.totalTagihan` sempat diubah jadi
  `rows.length * komiteAmount` untuk laporan komite, padahal dipakai juga oleh
  laporan **kas**. Sekarang `totalTagihan` kembali ke tagihan kas
  (`siswa x target bulan x iuran`) dan tagihan komite punya field sendiri,
  `totalTagihanKomite`, yang dipakai `toPdfKomite()`.
- Uji di container: `POST /api/incomes` Rp 50.000 → **201**, rekap `3/11`,
  sisa Rp 115.000. PDF kas tetap **landscape** (841,89 x 595,28), komite
  **portrait** (595,28 x 841,89), masing-masing 1 halaman.
- **Lebar tabel `toPdfKomite()`**: dulu `headWidths` totalnya dipatok 307 pt,
  padahal A4 portrait (margin 36) menyisakan ~523 pt — kolom "Sisa" berhenti di
  tengah halaman. Sekarang kolom No/Status/Sisa tetap (30/90/140) dan kolom
  **Nama mengisi sisa lebar**, jadi tabel berakhir tepat di margin kanan
  (xMax 559,28 = 595,28 - 36). Diverifikasi dengan `pdftotext -bbox`.

## 2026-11-09 - Laporan harian 07:00: PDF arus kas + backup database

Sekali sehari jam **07:00 WIB** Telegram menerima tiga hal, dikirim
**terpisah** supaya satu gagal tidak menggagalkan yang lain:

1. Pesan teks ringkasan (saldo, total masuk/keluar, siswa lunas kas/komite).
2. `grade6_laporan_YYYYMMDD-HHmmss.pdf` — detail **seluruh** pemasukan &
   pengeluaran (tanpa filter tanggal), dari
   `ReportExportService.toPdf({ type: ALL })`. Jadi tiap kiriman berisi riwayat
   lengkap, bukan hanya sehari.
3. `grade6-kas-YYYYMMDD-HHmmss.sql.gz` — backup database.

- ⚠️ Dulu PDF difilter **hari kemarin** (laporan jalan pagi). Sekarang seluruh
  transaksi: laporan harian dipakai sebagai rekap berjalan, dan PDF sehari
  kosong ("Tidak ada transaksi") tidak berguna.
- `fileStamp()` di `common/utils/datetime.ts` dipakai bersama oleh nama file
  laporan dan backup (`20261109-233458`, zona `APP_TIMEZONE`, bukan UTC).
- Backup: `DatabaseBackupService` (`apps/api/src/common/backup/`). Koneksi
  diambil dari `DATABASE_URL` (sumber yang sama dengan Prisma), password lewat
  env `PGPASSWORD` **bukan argumen** supaya tidak muncul di daftar proses.
  `pg_dump --no-owner --no-privileges` → `gzipSync` → `sendDocument`.
- ⚠️ `pg_dump` **harus ada di image**: runtime `Dockerfile` memasang
  `postgresql-client`. Tanpa itu `spawn` gagal `ENOENT` dan backup `false`.
- `TelegramService.sendDocument()` memakai timeout **60 detik** (dokumen jauh
  lebih besar dari pesan teks yang 8 detik). Batas Telegram 50 MB belum dicek
  di kode — `shortcut: data sekolah masih ~12 KB ter-gzip, tolak lebih awal
  kalau suatu saat backup lewat 45 MB.`
- `auth.module.ts` sekarang `imports: [ReportsModule]` + provider
  `DatabaseBackupService` (AuthModule `@Global`, jadi exporter bisa dipakai
  dari service ini).
- Verifikasi di container: `POST /api/auth/daily-report/send-now` →
  `{delivered:true, pdf:true, backup:true}` dalam **3 detik**; log menyebut
  `grade6_laporan_20261110-....pdf` dan `grade6-kas-....sql.gz`.
  `GET /api/auth/daily-report` → `{"enabled":true,"time":"07:00",
  "cronExpression":"0 7 * * *","timezone":"Asia/Jakarta"}`.
- Backup diuji terpisah: hasil `pg_dump | gzip` = 12 KB, `gzip -t` OK,
  13 tabel `COPY public`.
- Restore: `gunzip -c grade6-kas-<stamp>.sql.gz | psql -U <user> -d <db>`.
  Dump tanpa owner/privilege, jadi bisa masuk ke user lain.
- Halaman **Pengaturan → Laporan Harian** (`DailyReportSettings`) ikut
  menampilkan judul/deskripsi baru, default jam `07:00`, dan pesan hasil
  `send-now` yang menyebut ringkasan/PDF/backup mana yang gagal.
