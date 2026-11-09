/**
 * Aturan keamanan login admin (path /gema).
 *
 * Token Telegram TIDAK ada di sini - diambil dari tabel `settings`
 * (key: telegram.botToken & telegram.chatId). Lihat TelegramService.
 */

/** Jumlah kegagalan login sebelum CAPTCHA wajib muncul. */
export const CAPTCHA_THRESHOLD = 5;

/** Setiap kelipatan gagal login sebanyak ini memicu notifikasi + lock sementara. */
export const LOCK_THRESHOLD = 5;

/** Durasi lock sementara (menit). */
export const LOCK_MINUTES = 15;

/**
 * Sesi admin hangus setelah idle selama ini (menit).
 *
 * Ini adalah umur token sesi (JWT), BUKAN batas waktu login. Sesi yang aktif
 * diperpanjang otomatis oleh frontend lewat `POST /api/auth/refresh` setiap
 * ada aktivitas, jadi selama admin memakai panel, sesi tidak akan berakhir.
 * Diam > 5 menit -> token kedaluwarsa -> request berikutnya 401 -> frontend
 * mengarahkan ke halaman login dengan pesan "sesi berakhir".
 *
 * Konsekuensi: kalau tab dibiarkan terbuka tapi tidak disentuh sama sekali
 * (mis. ditinggal semalam), user harus login lagi. Itu memang yang diminta.
 */
export const SESSION_IDLE_MINUTES = 5;

/**
 * Jeda minimum antar permintaan perpanjangan sesi (detik).
 *
 * Tanpa ini, satu movement mouse saja bisa memicu puluhan request refresh per
 * detik dan menghabiskan kuota rate limit (API_RATE_LIMIT).
 */
export const SESSION_REFRESH_MIN_INTERVAL_SECONDS = 60;

/** Nama cookie sesi (httpOnly, tidak dibaca JavaScript). */
export const SESSION_COOKIE = "gema_session";

/** Nama cookie token CSRF (readable frontend, dikirim balik lewat header). */
export const CSRF_COOKIE = "gema_csrf";

/** Header yang dipakai frontend untuk mengirim token CSRF. */
export const CSRF_HEADER = "x-csrf-token";

/** Umur token CAPTCHA (detik). */
export const CAPTCHA_TTL_SECONDS = 300;
