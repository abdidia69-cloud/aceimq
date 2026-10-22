# Aceimq — paket proyek bersih

Paket ini berisi aplikasi Node.js + Express untuk upload video, membuat tautan halaman video publik, dan menyimpan link afiliasi opsional.

## Menjalankan di komputer

1. Install Node.js versi 18 atau lebih baru.
2. Ekstrak ZIP ke folder yang mudah ditemukan.
3. Buka terminal/Command Prompt di folder yang berisi `package.json`.
4. Jalankan:

   ```bash
   npm install
   npm start
   ```

5. Buka `http://localhost:3000`.

## Cara upload dan berbagi

1. Buka halaman utama dan pilih video.
2. Opsional: isi judul dan URL afiliasi.
3. Tunggu upload selesai.
4. Salin **Tautan halaman video publik** yang dihasilkan. Jangan bagikan tautan mentah `/uploads/...` sebagai pengganti halaman publik.

Link afiliasi akan ditampilkan secara jelas pada halaman video dan dibuka ketika penonton menekan tombolnya. Video tetap berada di tab pertama.

## Deploy ke hosting / domain

- Hosting harus mendukung aplikasi Node.js dan menjalankan `npm start`.
- Atur environment variable `PUBLIC_BASE_URL` ke domain publik HTTPS, misalnya `https://aceimq.fun` (hanya jika DNS dan HTTPS sudah diarahkan/aktif).
- Opsional: atur `MAX_UPLOAD_MB` sesuai kemampuan hosting.
- Pastikan folder `uploads/` dan file `videos.json` memiliki izin tulis dan penyimpanan persisten.
- Untuk mengakses file video lama, salin folder `uploads/` dan file `videos.json` lama ke folder proyek baru sebelum menjalankan aplikasi.
- Jika aplikasi hanya berjalan di `localhost`, tautannya tidak bisa diakses orang lain melalui internet.

## Struktur folder

```text
aceimq/
├── server.js
├── package.json
├── videos.json
├── uploads/
└── public/
    ├── index.html
    ├── app.js
    ├── video.html
    ├── video.js
    └── not-found.html
```

## Catatan kompatibilitas video

MP4 dengan video H.264 dan audio AAC umumnya paling kompatibel untuk browser. File MOV/MKV tertentu mungkin berhasil diunggah tetapi tidak bisa diputar di semua browser, tergantung codec di dalamnya.

## Troubleshooting

- **Halaman upload tidak terbuka:** pastikan `npm start` masih berjalan dan buka `http://localhost:3000`.
- **Link publik 404:** periksa ID video, file di `uploads/`, dan metadata `videos.json`.
- **Terus memuat:** coba buka `/health` pada domain yang sama. Respons normal berbentuk JSON dengan `"ok": true`.
- **Upload berhasil tetapi video tidak diputar:** uji file MP4 H.264/AAC; periksa juga log server dan apakah hosting melayani file `/uploads/...`.
- **Tautan hasil upload memakai localhost:** set `PUBLIC_BASE_URL` ke domain publik yang benar lalu restart/redeploy aplikasi. Mengubahnya tidak otomatis memindahkan file atau mengatur DNS.

## Data penting

`uploads/` menyimpan file video. `videos.json` menyimpan metadata dan hubungan ID ke file. Jangan menghapus keduanya jika ingin tautan video lama tetap bekerja.
