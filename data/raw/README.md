# Tempat file SWS mingguan

Unggah file master SWS terbaru ke folder ini, contoh nama: `SWS_W34__G2.xlsx`.

- Nomor minggu diambil dari pola `W..` pada nama file. File dengan nomor minggu terbesar yang dipakai.
- Wajib memiliki sheet `EXT` dan `NOO` dengan susunan kolom seperti SWS yang berjalan sekarang.
- Hapus file minggu sebelumnya saat mengunggah yang baru agar repositori tetap ringan.

Setelah commit, GitHub Actions otomatis memperbarui `data/dashboard.json` dan menerbitkan ulang dashboard.
