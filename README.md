# Dashboard Insentif AFPS & RFPM — Departemen Promotion M3

Dashboard web statis yang menampilkan **perpanjangan kontrak yang sudah dilakukan AFPS per kuartal**
dan **outlet NOO yang sudah menjadi AP**, diukur terhadap **Skema Insentif Q3 2026**.
Sumber datanya adalah file master **SWS (Super Work Sheet)** yang diperbarui setiap minggu.

Halaman ini dapat diakses publik lewat tautan — tidak perlu login, tidak perlu server.

---

## 1. Memperbarui data setiap minggu

1. Buka folder [`data/raw/`](data/raw) di repositori ini.
2. Klik **Add file → Upload files**, unggah file SWS terbaru (mis. `SWS_W34__G2.xlsx`), lalu **Commit changes**.
3. GitHub Actions otomatis:
   - memilih file dengan nomor minggu (`W..`) terbesar di `data/raw/`,
   - menjalankan `scripts/convert_sws.py` → menghasilkan `data/dashboard.json`,
   - menerbitkan ulang halaman ke GitHub Pages (± 2–3 menit).
4. Muat ulang dashboard. Stempel **Minggu** dan **Diperbarui** di bagian atas berubah bila berhasil.

> Agar repositori tetap ringan, hapus file SWS minggu sebelumnya saat mengunggah yang baru —
> cukup satu file terbaru di `data/raw/`. Riwayat pencapaian tetap aman karena setiap deal
> membawa tanggal dan minggu deal-nya sendiri.

Jika ada yang gagal, buka tab **Actions** di GitHub; langkah yang merah memuat pesan errornya
(paling sering: nama sheet berubah atau file bukan `.xlsx`).

## 2. Mengaktifkan GitHub Pages (sekali saja)

**Settings → Pages → Build and deployment → Source: GitHub Actions.**
Setelah itu tautan publiknya: `https://dimscm.github.io/dimscm/`

Penerbitan hanya berjalan dari **branch default** repositori. Selama pekerjaan ini masih berada di
branch `claude/web-dashboard-insentif-publik-2zp9so`, gabungkan (merge) dulu ke branch default
agar tautan publiknya aktif.

## 3. Isi dashboard

| Tab | Isi |
|---|---|
| **Ringkasan** | Kartu total deal, capaian tiap KPI terhadap target skema, grafik deal per kuartal, per minggu, per RFPM, dan sebaran channel |
| **Per AFPS** | Tabel 32 AFPS: perpanjangan, NOO ber-AP, capaian per KPI, dan estimasi insentif |
| **Per RFPM** | Tabel per region dengan target = target per AFPS × jumlah AFPS di region |
| **Detail Outlet** | Daftar outlet yang sudah deal (dapat dicari, diurutkan, dan diunduh sebagai CSV) |
| **Skema Insentif** | Tabel skema Q3 2026 dan cara pemetaan channel SWS ke masing-masing KPI |
| **Catatan Data** | Baris SWS yang tidak konsisten dan perlu diperbaiki oleh admin |

## 4. Cara angka dihitung

**Sumber baris**

- **Perpanjangan** — sheet `EXT`, baris dengan `DEAL/NO DEAL/PROSES` = `DEAL`.
- **NOO ber-AP** — sheet `NOO`, baris dengan status `DEAL` dan/atau `NOMOR AP` sudah terisi.

**Kuartal** diambil dari **tanggal deal** (bukan kolom `WEEK DEAL`, karena kolom itu kerap tidak
konsisten dengan tanggalnya). Grafik mingguan memakai nomor minggu ISO dari tanggal deal.

**Pemetaan ke KPI** (sesuai ketentuan skema bahwa dealing NOO/Takeover mencakup outlet yang layak
perpanjang dan sudah diperpanjang):

| Channel di SWS | KPI |
|---|---|
| `KULINER` | 1. NOO / Takeover Kuliner — target 15 outlet / 3 bulan per AFPS |
| `LOKPEN`, `SEKOLAH` | 2. NOO Lokpen — target 15 outlet / 3 bulan per AFPS |
| `FOODCOURT` | 3. Dealing NOO Foodcourt / Pujasera — target 3 (AFPS) / 5 (RFPM) |
| `DTW/POI`, `SPORT`, `REST AREA` | Di luar KPI Q3 — tetap ditampilkan, tidak dihitung insentif |

**Tier insentif** mengikuti skema: ≥100%, ≥85%, ≥75% dari target; di bawah itu tidak ada insentif.
Untuk KPI Foodcourt RFPM, ambangnya jumlah outlet (≥5 / 4 / 3), bukan persentase.

**Target RFPM.** File SWS tidak memuat kolom RFPM, jadi **satu region diperlakukan sebagai satu RFPM**;
target Kuliner dan Lokpen = 15 × jumlah AFPS di region tersebut.

**Yang tidak dapat dihitung otomatis.** KPI *Dealing Target Outlet RFPM (15 outlet per RFPM)* tidak ada
penandanya di SWS — tidak ada kolom pemilik deal RFPM. Karena itu estimasi insentif RFPM di dashboard
maksimal Rp 9 juta dari Rp 12 juta pada skema; sisanya diisi manual di luar dashboard.

**Baris yang dikecualikan.** Baris berstatus DEAL tetapi tanggal dealnya kosong atau di luar rentang wajar
(2025–2026) tidak ikut dihitung pada kuartal mana pun, dan didaftar di tab **Catatan Data**.

## 5. Mengubah skema insentif

Semua angka target dan nominal insentif ada di [`config/scheme.json`](config/scheme.json) —
tidak ada angka skema yang ditanam di dalam kode. Ubah file itu (lewat web GitHub pun bisa),
commit, dan dashboard langsung memakai angka baru.

Yang bisa diatur di sana: judul, periode aktif, daftar kuartal, pemetaan channel → KPI,
target dan tier per KPI untuk AFPS maupun RFPM, serta:

```json
"tampilkan_data_sensitif": true
```

Setel ke `false` untuk menyembunyikan **no. telepon PIC, nilai kompensasi, nilai branding, total
kontrak, dan omset** dari tabel detail maupun unduhan CSV. Saat ini bernilai `true`, artinya
**siapa pun yang memiliki tautan dapat melihat data tersebut**.

## 6. Menjalankan di komputer sendiri

```bash
pip install -r scripts/requirements.txt
python scripts/convert_sws.py data/raw/SWS_W33__G2.xlsx
python -m http.server 8000      # buka http://localhost:8000
```

## 7. Struktur berkas

```
index.html                     halaman dashboard
assets/styles.css              tampilan (mendukung mode terang & gelap)
assets/app.js                  filter, perhitungan KPI, tabel, grafik SVG
config/scheme.json             skema insentif & pengaturan — satu-satunya tempat angka skema
scripts/convert_sws.py         konversi SWS .xlsx → data/dashboard.json
data/raw/                      tempat mengunggah file SWS mingguan
data/dashboard.json            data hasil konversi yang dibaca halaman (dibuat otomatis)
.github/workflows/dashboard.yml  otomatisasi konversi + penerbitan Pages
```
