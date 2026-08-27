# Dashboard Insentif AFPS & RFPM — Departemen Promotion M3

Dashboard web statis yang menampilkan **perpanjangan kontrak yang sudah dilakukan AFPS per kuartal**
dan **outlet NOO yang sudah menjadi AP**, diukur terhadap **Skema Insentif Q3 2026**.
Sumber datanya adalah file master **SWS (Super Work Sheet)** yang diperbarui setiap minggu.

Halaman ini dapat diakses publik lewat tautan — tidak perlu login, tidak perlu server.

---

## 1. Mengaktifkan tautan publik (sekali saja)

**Settings → Pages → Build and deployment → Source: _Deploy from a branch_ →
Branch: `claude/web-dashboard-insentif-publik-2zp9so` (atau branch default yang dipakai) → folder `/ (root)` → Save.**

Sekitar satu menit kemudian dashboard hidup di:

```
https://dimscm.github.io/dimscm/
```

Halaman langsung memakai `data/dashboard.json` yang sudah ada di repositori, jadi tautan ini
berfungsi walau GitHub Actions sedang tidak aktif.

## 2. Memperbarui data setiap minggu

Ada dua cara, hasil angkanya identik (sudah diuji baris per baris).

**A. Lewat browser — paling cepat, tanpa commit.**
Klik **Ganti file SWS** di kanan atas, pilih file SWS terbaru. Dashboard membaca `.xlsx` itu
langsung di komputer Anda (± 6 detik untuk file 18 MB) dan seluruh angka dihitung ulang.
Tidak ada data yang dikirim ke mana pun. Bila hasilnya ingin dibagikan, klik
**Unduh HTML (dengan data)** — satu berkas HTML mandiri berisi data saat itu, bisa dibuka
tanpa internet dan dikirim lewat WhatsApp/email.
Catatan: perubahan ini hanya di layar Anda; pengunjung tautan publik masih melihat data lama.

**B. Lewat repositori — permanen, semua orang ikut melihat.**

1. Buka folder [`data/raw/`](data/raw).
2. Klik **Add file → Upload files**, unggah file SWS terbaru (mis. `SWS_W34__G2.xlsx`),
   hapus file minggu sebelumnya, lalu **Commit changes**.
3. GitHub Actions menjalankan `scripts/convert_sws.py` dan meng-commit `data/dashboard.json` baru;
   GitHub Pages menerbitkan ulang halaman.

### Bila GitHub Actions tidak bisa jalan

Percobaan di repositori ini gagal sebelum runner dialokasikan — tanpa log sama sekali, yang biasanya
berarti kuota/pengaturan penagihan Actions di akun. Periksa **Settings → Billing → Plans and usage**.
Selama itu belum aktif, pakai cara A untuk kebutuhan harian, atau perbarui dari komputer:

```bash
git pull
pip install -r scripts/requirements.txt
python scripts/convert_sws.py data/raw/SWS_W34__G2.xlsx
git add data/dashboard.json data/raw && git commit -m "data: SWS W34" && git push
```

## 3. Isi dashboard

| Halaman | Isi |
|---|---|
| **Insentif** | Kartu total deal & estimasi insentif, capaian tiap KPI terhadap target skema, tabel per AFPS dan per RFPM, grafik deal per kuartal dan per minggu |
| **Detail SWS** | Keterangan detail tiap outlet yang sudah deal — dapat dicari, diurutkan, dan diunduh sebagai CSV |
| **Skema Insentif** | Tabel skema beserta tier, dan pemetaan channel SWS ke tiap KPI |
| **Catatan Data** | Baris SWS yang tidak konsisten dan perlu diperbaiki admin |

Filter di bagian atas berlaku untuk semua halaman: **kuartal, bulan, akhir kontrak, RFPM/region, AFPS,
sumber, dan pencarian**.
Setiap filter dapat dipilih lebih dari satu (mis. Q1 + Q2, atau region Cibosi + Jakut-Jaktim 1); tanpa centang
berarti semua. Angka di sebelah kanan tiap pilihan adalah jumlah outlet deal pada pilihan itu.

**Cara insentif dihitung saat kuartal dipilih lebih dari satu.** Target skema berlaku per 3 bulan, jadi tier
dinilai per kuartal lalu insentifnya dijumlahkan — bukan dari total gabungan. Kolom target pada tabel sudah
dikalikan jumlah kuartal yang aktif, dan titik warna pada sel KPI bersifat indikatif atas gabungan kuartal.

**Filter bulan.** Daftarnya selalu lengkap: bila kuartal dipilih, ketiga bulannya ditampilkan;
bila tidak, daftar berjalan dari bulan pertama yang ada datanya sampai **Desember tahun terakhir**.
Bulan yang belum ada dealnya tetap muncul dengan angka 0 agar bisa dipilih untuk periode berjalan.
Berguna untuk melihat capaian bulanan.

**Filter akhir kontrak.** Berdasarkan tanggal berakhirnya kontrak baru, sehingga jangkauannya jauh melewati
tanggal deal — pada data W33 sampai 2036. Gunakan untuk menyiapkan perpanjangan: ketik tahunnya di kotak
pencarian dropdown (mis. `2027`) lalu klik **Pilih semua** untuk mengambil seluruh bulan di tahun itu.
Karena filter ini hanya mengambil sebagian isi kuartal, estimasi insentif ikut ditampilkan sebagai "—". Bila bulan yang dipilih memotong kuartal (mis. hanya
Januari dari Q1), estimasi insentif ditampilkan sebagai "—" karena syarat skema adalah 3 bulan penuh; angka
capaian tetap ditampilkan. Kosongkan filter bulan untuk memunculkan kembali estimasi insentif.

## 4. Cara angka dihitung

**Sumber baris**

- **Perpanjangan** — sheet `EXT`, baris dengan `DEAL/NO DEAL/PROSES` = `DEAL`.
- **NOO ber-AP** — sheet `NOO`, baris dengan status `DEAL` dan/atau `NOMOR AP` sudah terisi.

**Format tanggal.** Kolom tanggal di SWS bercampur: objek tanggal Excel, serial angka, dan teks
(`12/06/2026`, `5 Mei 2026`, `26-Juli-2026`, `13 Ags 2026`). Semuanya dibaca, termasuk nama bulan
Indonesia. Aturan parsing di `scripts/convert_sws.py` dan `assets/app.js` sengaja dibuat sama persis
agar hasil dari kedua jalur (unggah di browser vs konversi di repositori) identik.

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
assets/app.js                  filter, perhitungan KPI, tabel, grafik SVG, pembaca .xlsx di browser
vendor/xlsx.full.min.js        SheetJS 0.18.5 (dipakai tombol "Ganti file SWS")
config/scheme.json             skema insentif & pengaturan — satu-satunya tempat angka skema
scripts/convert_sws.py         konversi SWS .xlsx → data/dashboard.json
data/raw/                      tempat mengunggah file SWS mingguan
data/dashboard.json            data hasil konversi yang dibaca halaman (dibuat otomatis)
.github/workflows/dashboard.yml  otomatisasi konversi data mingguan
```
