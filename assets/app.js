/* Dashboard Insentif AFPS & RFPM — Departemen Promotion M3
   Data: data/dashboard.json (hasil konversi SWS) atau file SWS .xlsx yang diunggah langsung. */

'use strict';

const S = {
  cfg: null, data: null,
  // Semua filter berupa daftar; daftar kosong berarti "semua".
  kuartal: [], bulan: [], akhir: [], region: [], afps: [], sumber: [], cari: '',
  view: 'insentif', limit: 200, sort: {}, ui: {},
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const NF = new Intl.NumberFormat('id-ID');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const int = (v) => NF.format(Math.round(v || 0));
const pct = (v) => (v * 100).toFixed(0) + '%';
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const rp = (v) => (v == null || v === '' ? '—' : 'Rp ' + NF.format(Math.round(v)));
function rpPendek(v) {
  if (!v) return 'Rp 0';
  if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(v % 1e9 ? 1 : 0).replace('.', ',') + ' M';
  if (v >= 1e6) return 'Rp ' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',') + ' jt';
  if (v >= 1e3) return 'Rp ' + Math.round(v / 1e3) + ' rb';
  return 'Rp ' + NF.format(v);
}
function tanggal(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${+d} ${BULAN[+m - 1]} ${y}`;
}

/* ================================================================ pembacaan SWS (.xlsx) di browser
   Port dari scripts/convert_sws.py — hasilnya berbentuk sama persis. */

const TAHUN_VALID = [2025, 2026];

function teks(v) {
  if (v == null) return '';
  const s = String(v).replace(/\s+/g, ' ').trim();
  const l = s.toLowerCase();
  return (l === 'none' || s === '-' || l === '#n/a' || l === 'n/a') ? '' : s;
}
const UP = (v) => teks(v).toUpperCase();

const BULAN_ID = {
  jan: 1, feb: 2, peb: 2, mar: 3, mrt: 3, apr: 4, mei: 5, may: 5,
  jun: 6, jul: 7, agu: 8, ags: 8, agt: 8, aug: 8, sep: 9, okt: 10,
  oct: 10, nov: 11, nop: 11, des: 12, dec: 12,
};
const tahunPenuh = (y) => (+y < 100 ? +y + 2000 : +y);

/** Tanggal dari sel SWS: objek Date, serial Excel, atau teks (termasuk nama bulan Indonesia).
    Aturannya dibuat sama persis dengan scripts/convert_sws.py. */
function keTanggal(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === 'number' && isFinite(v)) {
    return (v >= 20000 && v <= 80000) ? new Date(Math.round((v - 25569) * 86400000)) : null;
  }
  const s = teks(v);
  if (!s) return null;
  let d, bl, y, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; bl = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})/))) { d = +m[1]; bl = +m[2]; y = tahunPenuh(m[3]); }
  else if ((m = s.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,12})[-/. ](\d{2,4})/))) {
    bl = BULAN_ID[m[2].slice(0, 3).toLowerCase()];
    if (!bl) return null;
    d = +m[1]; y = tahunPenuh(m[3]);
  } else return null;
  if (bl < 1 || bl > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, bl - 1, d));
  return (t.getUTCMonth() === bl - 1 && t.getUTCDate() === d) ? t : null;
}
const keIso = (d) => (d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` : null);
const tahunDari = (d) => (d ? d.getUTCFullYear() : null);
const kuartalDari = (d) => (d ? `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}` : null);

function mingguIso(d) {
  if (!d) return null;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const awal = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - awal) / 86400000 + 1) / 7);
}
function keAngka(v) {
  if (typeof v === 'number' && isFinite(v)) return Math.round(v * 100) / 100;
  const s = teks(v).replace(/Rp/gi, '').replace(/\./g, '').replace(/,/g, '.').replace(/\s/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : null;
}
const keBulat = (v) => { const n = keAngka(v); return n == null ? null : Math.round(n); };

/** Pencari kolom berdasarkan nama header; tahan newline, spasi ganda, dan nama ganda. */
function petaKolom(header) {
  const peta = new Map();
  header.forEach((h, i) => {
    const k = UP(h);
    if (k) { if (!peta.has(k)) peta.set(k, []); peta.get(k).push(i); }
  });
  return {
    idx(nama, ke = 0) {
      const k = UP(nama);
      let c = peta.get(k);
      if (!c) {
        c = [];
        peta.forEach((v, key) => { if (key.startsWith(k)) c.push(...v); });
        c.sort((a, b) => a - b);
      }
      return c.length ? (c[ke] ?? c[c.length - 1]) : null;
    },
    get(row, nama, ke = 0) { const i = this.idx(nama, ke); return i == null ? null : row[i]; },
  };
}

function bacaSheet(wb, nama) {
  const ws = wb.Sheets[nama];
  if (!ws) throw new Error(`Sheet "${nama}" tidak ada di file ini. Sheet tersedia: ${wb.SheetNames.join(', ')}`);
  const baris = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  let h = -1;
  for (let i = 0; i < Math.min(12, baris.length); i++) {
    if ((baris[i] || []).some((c) => UP(c) === 'NO OUTLET')) { h = i; break; }
  }
  if (h < 0) throw new Error(`Baris header (kolom "No Outlet") tidak ditemukan di sheet ${nama}.`);
  const kol = petaKolom(baris[h]);
  const data = baris.slice(h + 1).filter((r) => r && (teks(kol.get(r, 'No Outlet')) || teks(kol.get(r, 'NAMA OUTLET'))));
  return { kol, data };
}

/** Catatan bila tanggal akhir kontrak tidak masuk akal terhadap tanggal deal. */
function cekAkhirKontrak(tglDeal, akhir) {
  if (!tglDeal || !akhir) return [];
  if (akhir < tglDeal) return [`Tanggal akhir kontrak (${keIso(akhir)}) mendahului tanggal deal (${keIso(tglDeal)})`];
  if ((akhir - tglDeal) / 86400000 > 6 * 365) {
    return [`Kontrak berlaku lebih dari 6 tahun (${keIso(tglDeal)} s/d ${keIso(akhir)}) — periksa tahunnya`];
  }
  return [];
}

function rapikanGrfpm(v) {
  const s = UP(v).replace('GRPFM', 'GRFPM');
  const m = s.match(/(\d+)/);
  return (m && s.includes('GRFPM')) ? `GRFPM ${parseInt(m[1], 10)}` : (s || '');
}

/** Susun dokumen data dari workbook SWS. */
function dariWorkbook(wb, namaFile) {
  const chToKpi = {};
  Object.entries(S.cfg.channel_ke_kpi).forEach(([k, v]) => { chToKpi[UP(k)] = v; });
  const ext = bacaSheet(wb, 'EXT');
  const noo = bacaSheet(wb, 'NOO');
  const deals = [], issues = [], mentah = [];

  const catat = (sheet, r, kol, masalah, kolomOutlet) => {
    masalah.forEach((m) => issues.push({
      sheet, no_outlet: teks(kol.get(r, 'No Outlet')), outlet: teks(kol.get(r, kolomOutlet)),
      afps: UP(kol.get(r, sheet === 'EXT' ? 'Nama AFPS' : 'NAMA AFPS')), region: UP(kol.get(r, 'REGION')), masalah: m,
    }));
  };

  // ---- EXT: perpanjangan kontrak
  for (const r of ext.data) {
    const kol = ext.kol;
    const afps = UP(kol.get(r, 'Nama AFPS')), region = UP(kol.get(r, 'REGION')), gr = rapikanGrfpm(kol.get(r, 'GRFPM'));
    mentah.push([afps, region, gr]);
    let status = UP(kol.get(r, 'DEAL/NO DEAL/ PROSES')) || 'BELUM DIVISIT';
    if (status.startsWith('NO DEAL')) status = 'NO DEAL';
    if (status !== 'DEAL') continue;

    const channel = UP(kol.get(r, 'CHANNEL'));
    const tgl = keTanggal(kol.get(r, 'TANGGAL DEAL'));
    const apBaru = teks(kol.get(r, 'NOMOR AP', 1));
    const masalah = [];
    if (!tgl) masalah.push('Status DEAL tetapi TANGGAL DEAL kosong');
    else if (!TAHUN_VALID.includes(tahunDari(tgl))) masalah.push('Tanggal deal di luar rentang wajar: ' + keIso(tgl));
    if (!apBaru) masalah.push('Sudah DEAL tetapi nomor AP baru belum terisi');
    masalah.push(...cekAkhirKontrak(tgl, keTanggal(kol.get(r, 'TANGGAL END KONTRAK NEW'))));
    catat('EXT', r, kol, masalah, 'NAMA OUTLET');
    const valid = !!tgl && TAHUN_VALID.includes(tahunDari(tgl));

    deals.push({
      sumber: 'PERPANJANGAN', no_outlet: teks(kol.get(r, 'No Outlet')), outlet: teks(kol.get(r, 'NAMA OUTLET')),
      grfpm: gr, region, kota: UP(kol.get(r, 'KOTA')), kecamatan: UP(kol.get(r, 'KECAMATAN')), afps,
      jenis: UP(kol.get(r, 'JENIS OUTLET')), channel, kpi: chToKpi[channel] || 'lainnya', kategori: '',
      brand: UP(kol.get(r, 'BRAND', 1)) || UP(kol.get(r, 'BRAND')),
      kontrak: UP(kol.get(r, 'BB/BR/BL', 1)) || UP(kol.get(r, 'BB/BR/BL')),
      takeover: UP(kol.get(r, 'TAKEOVER OR BUKAN TAKEOVER')), alamat: teks(kol.get(r, 'ALAMAT OUTLET')),
      pic: teks(kol.get(r, 'NAMA PIC')), telp: teks(kol.get(r, 'NO TELP PIC')), kode_outlet: teks(kol.get(r, 'KODE OUTLET')),
      ap: apBaru, ap_lama: teks(kol.get(r, 'NOMOR AP')),
      tgl_visit: keIso(keTanggal(kol.get(r, 'TANGGAL VISIT'))), tgl_deal: keIso(tgl),
      week_deal: keBulat(kol.get(r, 'WEEK DEAL')), week_iso: valid ? mingguIso(tgl) : null,
      kuartal: valid ? kuartalDari(tgl) : null,
      kontrak_habis: keIso(keTanggal(kol.get(r, 'TANGGAL BERAKHIR KONTRAK'))),
      kontrak_mulai_baru: keIso(keTanggal(kol.get(r, 'TANGGAL START KONTRAK NEW'))),
      kontrak_akhir_baru: keIso(keTanggal(kol.get(r, 'TANGGAL END KONTRAK NEW'))),
      kompensasi: keAngka(kol.get(r, 'NILAI KOMPENSASI NEW IN RUPIAH')),
      branding: keAngka(kol.get(r, 'NILAI BRANDING/ REVISUAL IN RUPIAH')),
      nilai_total: keAngka(kol.get(r, 'TOTAL', 1)), omset_week: keAngka(kol.get(r, 'OMSET PER WEEK IN RUPIAH')),
      ikat_target: UP(kol.get(r, 'ADA IKAT TARGET (V)')), valid,
    });
  }

  // ---- NOO: sudah deal / sudah terbit AP
  for (const r of noo.data) {
    const kol = noo.kol;
    const afps = UP(kol.get(r, 'NAMA AFPS')), region = UP(kol.get(r, 'REGION')), gr = rapikanGrfpm(kol.get(r, 'GRFPM'));
    mentah.push([afps, region, gr]);
    let status = UP(kol.get(r, 'DEAL/ PROSES')) || 'BELUM DIVISIT';
    if (status.startsWith('NO DEAL')) status = 'NO DEAL';
    const ap = teks(kol.get(r, 'NOMOR AP'));
    if (status !== 'DEAL' && !ap) continue;

    const channel = UP(kol.get(r, 'CHANNEL'));
    const tgl = keTanggal(kol.get(r, 'TGL DEAL'));
    const masalah = [];
    if (status === 'DEAL' && !ap) masalah.push('Status DEAL tetapi nomor AP belum terisi (belum diakui sebagai NOO ber-AP)');
    if (ap && status !== 'DEAL') masalah.push(`Sudah ada nomor AP tetapi status masih '${status || 'kosong'}'`);
    if (!tgl) masalah.push('Sudah DEAL/ber-AP tetapi TGL DEAL kosong');
    else if (!TAHUN_VALID.includes(tahunDari(tgl))) masalah.push('Tanggal deal di luar rentang wajar: ' + keIso(tgl));
    masalah.push(...cekAkhirKontrak(tgl, keTanggal(kol.get(r, 'TANGGAL END KONTRAK BASED ON PKS'))));
    catat('NOO', r, kol, masalah, 'NAMA OUTLET');
    const adaTgl = !!tgl && TAHUN_VALID.includes(tahunDari(tgl));

    deals.push({
      sumber: 'NOO', no_outlet: teks(kol.get(r, 'No Outlet')), outlet: teks(kol.get(r, 'NAMA OUTLET')),
      grfpm: gr, region, kota: UP(kol.get(r, 'KOTA')), kecamatan: UP(kol.get(r, 'KECAMATAN')), afps,
      jenis: UP(kol.get(r, 'JENIS OUTLET')), channel, kpi: chToKpi[channel] || 'lainnya',
      kategori: UP(kol.get(r, 'KATEGORI KPI')),
      brand: UP(kol.get(r, 'BRAND', 1)) || UP(kol.get(r, 'BRAND')), kontrak: UP(kol.get(r, 'BB/BR/BL')),
      takeover: UP(kol.get(r, 'TAKEOVER/BUKAN TAKEOVER')), alamat: teks(kol.get(r, 'ALAMAT OUTLET')),
      pic: teks(kol.get(r, 'NAMA PIC')), telp: teks(kol.get(r, 'NO TELP PIC')), kode_outlet: teks(kol.get(r, 'KODE OUTLET')),
      ap, spsd: teks(kol.get(r, 'NO SPSD')), prioritas: UP(kol.get(r, 'PRIORITAS/TIDAK PRIORITAS')),
      rating: keAngka(kol.get(r, 'RATING GOOGLE')), skor: keAngka(kol.get(r, 'TOTAL SCORE')),
      siswa: keBulat(kol.get(r, 'JUMLAH SISWA')),
      tgl_visit: keIso(keTanggal(kol.get(r, 'TGL VISIT'))), tgl_deal: keIso(tgl),
      week_deal: keBulat(kol.get(r, 'WEEK DEAL')), week_iso: adaTgl ? mingguIso(tgl) : null,
      kuartal: adaTgl ? kuartalDari(tgl) : null,
      kontrak_mulai_baru: keIso(keTanggal(kol.get(r, 'TANGGAL START KONTRAK BASED ON PKS'))),
      kontrak_akhir_baru: keIso(keTanggal(kol.get(r, 'TANGGAL END KONTRAK BASED ON PKS'))),
      kompensasi: keAngka(kol.get(r, 'NILAI KOMPENSASI NEW IN RUPIAH')),
      branding: keAngka(kol.get(r, 'NILAI BRANDING/ REVISUAL IN RUPIAH')),
      nilai_total: keAngka(kol.get(r, 'TOTAL')), omset_karton: keAngka(kol.get(r, 'OMSET PER WEEK IN KARTON')),
      ikat_target: UP(kol.get(r, 'ADA IKAT TARGET (V)')), valid: !!ap && adaTgl,
    });
  }

  // ---- pemetaan AFPS -> region (kemunculan terbanyak)
  const hitung = {}, grf = {};
  mentah.forEach(([a, reg, gr]) => {
    if (!a) return;
    hitung[a] = hitung[a] || {}; grf[a] = grf[a] || {};
    if (reg) hitung[a][reg] = (hitung[a][reg] || 0) + 1;
    if (gr) grf[a][gr] = (grf[a][gr] || 0) + 1;
  });
  const puncak = (o) => Object.entries(o || {}).sort((x, y) => y[1] - x[1])[0]?.[0] || '';
  const petaAfps = {};
  Object.keys(hitung).forEach((a) => { petaAfps[a] = { region: puncak(hitung[a]) || 'TANPA REGION', grfpm: puncak(grf[a]) }; });
  deals.forEach((d) => {
    const i = petaAfps[d.afps];
    if (i) { d.region = i.region || d.region; d.grfpm = d.grfpm || i.grfpm; }
  });

  const perRegion = {};
  Object.entries(petaAfps).forEach(([a, i]) => { (perRegion[i.region] = perRegion[i.region] || []).push(a); });
  const mw = String(namaFile || '').match(/[_\-\s]?W(\d{1,2})/i);

  return {
    meta: {
      week: mw ? parseInt(mw[1], 10) : null, file_sumber: namaFile || '(diunggah)',
      dibuat: new Date().toISOString(),
      grfpm: puncak(deals.reduce((o, d) => { if (d.grfpm) o[d.grfpm] = (o[d.grfpm] || 0) + 1; return o; }, {})),
      ringkas: {
        ext_total: ext.data.length, ext_deal: deals.filter((d) => d.sumber === 'PERPANJANGAN').length,
        noo_total: noo.data.length, noo_deal_ap: deals.filter((d) => d.sumber === 'NOO').length,
        jumlah_afps: Object.keys(petaAfps).length, jumlah_region: Object.keys(perRegion).length,
      },
    },
    afps: Object.entries(petaAfps).map(([nama, i]) => ({ nama, region: i.region, grfpm: i.grfpm }))
      .sort((a, b) => (a.region + a.nama).localeCompare(b.region + b.nama, 'id')),
    region: Object.entries(perRegion).map(([nama, a]) => ({ nama, afps: a.sort(), jumlah_afps: a.length }))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    deals, issues,
  };
}

/* ================================================================ filter pilihan ganda */

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const labelBulan = (ym) => { const [y, m] = ym.split('-'); return `${BULAN[+m - 1]} ${y}`; };
const labelBulanPanjang = (ym) => { const [y, m] = ym.split('-'); return `${NAMA_BULAN[+m - 1]} ${y}`; };
function labelKuartalId(id) {
  const q = S.cfg.kuartal.find((x) => x.id === id);
  if (q) return `${q.label} · ${q.rentang}`;
  const [y, k] = id.split('-Q');
  return `Q${k} ${y}`;
}
/** Deret bulan berurutan dari `awal` sampai `akhir`, format YYYY-MM. */
function rentangBulan(awal, akhir) {
  const out = [];
  let [y, m] = awal.split('-').map(Number);
  const [ya, ma] = akhir.split('-').map(Number);
  while (y < ya || (y === ya && m <= ma)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

/** Tiga bulan dalam satu kuartal, format YYYY-MM. */
function bulanKuartal(id) {
  const [y, k] = id.split('-Q');
  return [0, 1, 2].map((i) => `${y}-${String((k - 1) * 3 + 1 + i).padStart(2, '0')}`);
}

function tutupSemuaPopup() {
  $$('.ms-pop').forEach((p) => p.classList.add('hidden'));
  $$('.ms-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
document.addEventListener('click', (e) => { if (!e.target.closest('.ms')) tutupSemuaPopup(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tutupSemuaPopup(); });

/**
 * Dropdown centang untuk satu filter. `key` adalah nama daftar di S
 * (daftar kosong = semua). Isi daftar diubah langsung, lalu onChange dipanggil.
 */
function multiPilih(host, key, opsi, kosongLabel, onChange) {
  const pakaiCari = opsi.length > 12;
  host.innerHTML = `<div class="ms">
      <button class="ms-btn" type="button" aria-expanded="false"></button>
      <div class="ms-pop hidden">
        ${pakaiCari ? '<input type="search" class="ms-cari" placeholder="Cari…" autocomplete="off">' : ''}
        <div class="ms-aksi"><button type="button" data-aksi="semua">Pilih semua</button><button type="button" data-aksi="kosong">Kosongkan</button></div>
        <div class="ms-list"></div>
      </div>
    </div>`;
  const btn = $('.ms-btn', host), pop = $('.ms-pop', host), list = $('.ms-list', host), cari = $('.ms-cari', host);

  const label = () => {
    const a = S[key];
    btn.textContent = !a.length ? kosongLabel
      : (a.length === 1 ? (() => { const o = opsi.find((x) => x.v === a[0]) || {}; return o.ts || o.t || a[0]; })() : `${a.length} dipilih`);
    btn.classList.toggle('aktif', a.length > 0);
  };
  const gambar = () => {
    const q = (cari ? cari.value : '').trim().toUpperCase();
    const tampil = opsi.filter((o) => !q || o.t.toUpperCase().includes(q));
    list.innerHTML = tampil.length
      ? tampil.map((o) => `<label><input type="checkbox" value="${esc(o.v)}"${S[key].includes(o.v) ? ' checked' : ''}>
          <span>${esc(o.t)}</span>${o.n != null ? `<span class="ms-n${o.n ? '' : ' nol'}">${int(o.n)}</span>` : ''}</label>`).join('')
      : '<div class="ms-kosong">Tidak ada pilihan yang cocok.</div>';
    $$('input', list).forEach((inp) => {
      inp.onchange = () => {
        const a = S[key], i = a.indexOf(inp.value);
        if (inp.checked && i < 0) a.push(inp.value);
        if (!inp.checked && i >= 0) a.splice(i, 1);
        label(); onChange();
      };
    });
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    const tertutup = pop.classList.contains('hidden');
    tutupSemuaPopup();
    if (tertutup) { pop.classList.remove('hidden'); btn.setAttribute('aria-expanded', 'true'); gambar(); if (cari) cari.focus(); }
  };
  pop.onclick = (e) => e.stopPropagation();
  if (cari) cari.oninput = gambar;
  $$('[data-aksi]', pop).forEach((b) => {
    b.onclick = () => {
      const q = (cari ? cari.value : '').trim().toUpperCase();
      const kena = opsi.filter((o) => !q || o.t.toUpperCase().includes(q)).map((o) => o.v);
      S[key] = b.dataset.aksi === 'semua' ? Array.from(new Set([...S[key], ...kena])) : S[key].filter((v) => !kena.includes(v));
      label(); gambar(); onChange();
    };
  });
  label();
  return { label, gambar };
}

/** Bangun/segarkan seluruh filter. Pilihan bulan mengikuti kuartal, AFPS mengikuti region. */
function buatFilter(hanya) {
  const D = S.data.deals.filter((d) => d.valid);
  const hitung = (f, sumber = D) => sumber.reduce((o, d) => { const k = f(d); if (k) o[k] = (o[k] || 0) + 1; return o; }, {});

  if (!hanya || hanya === 'kuartal') {
    const c = hitung((d) => d.kuartal);
    const opsi = Object.keys(c).sort().map((id) => ({ v: id, t: labelKuartalId(id), ts: id.replace(/(\d{4})-Q(\d)/, 'Q$2 $1'), n: c[id] }));
    S.ui.kuartal = multiPilih($('#f-kuartal'), 'kuartal', opsi, 'Semua kuartal', () => {
      buatFilter('bulan'); render();
    });
  }
  if (!hanya || hanya === 'kuartal' || hanya === 'bulan') {
    const dalamKuartal = D.filter((d) => !S.kuartal.length || S.kuartal.includes(d.kuartal));
    const c = hitung((d) => (d.tgl_deal || '').slice(0, 7), dalamKuartal);
    let daftar;
    if (S.kuartal.length) {
      daftar = S.kuartal.slice().sort().flatMap(bulanKuartal);   // tiga bulan penuh tiap kuartal terpilih
    } else {
      const ada = Object.keys(hitung((d) => (d.tgl_deal || '').slice(0, 7))).sort();
      // Sampai Desember tahun terakhir, agar bulan yang belum ada dealnya tetap bisa dipilih.
      daftar = ada.length ? rentangBulan(ada[0], `${ada[ada.length - 1].slice(0, 4)}-12`) : [];
    }
    const opsi = daftar.map((m) => ({ v: m, t: labelBulanPanjang(m), ts: labelBulan(m), n: c[m] || 0 }));
    S.bulan = S.bulan.filter((m) => daftar.includes(m));         // buang bulan di luar kuartal terpilih
    S.ui.bulan = multiPilih($('#f-bulan'), 'bulan', opsi, 'Semua bulan', render);
  }
  if (!hanya) {
    // Periode berakhirnya kontrak baru — jangkauannya jauh melewati tanggal deal (2027, 2028, dst).
    const c = hitung((d) => (d.kontrak_akhir_baru || '').slice(0, 7));
    const tanpa = D.filter((d) => !d.kontrak_akhir_baru).length;
    const opsi = Object.keys(c).sort().map((m) => ({ v: m, t: labelBulanPanjang(m), ts: labelBulan(m), n: c[m] }));
    if (tanpa) opsi.push({ v: '-', t: 'Tanpa tanggal akhir kontrak', ts: 'Tanpa tanggal', n: tanpa });
    S.ui.akhir = multiPilih($('#f-akhir'), 'akhir', opsi, 'Semua periode', render);
  }
  if (!hanya || hanya === 'region') {
    const c = hitung((d) => d.region);
    const opsi = S.data.region.map((r) => ({ v: r.nama, t: r.nama, n: c[r.nama] || 0 }));
    S.ui.region = multiPilih($('#f-region'), 'region', opsi, 'Semua region', () => {
      buatFilter('afps'); render();
    });
  }
  if (!hanya || hanya === 'region' || hanya === 'afps') {
    const c = hitung((d) => d.afps);
    const daftar = S.data.afps.filter((a) => !S.region.length || S.region.includes(a.region));
    const opsi = daftar.map((a) => ({ v: a.nama, t: a.nama, n: c[a.nama] || 0 }));
    S.afps = S.afps.filter((n) => daftar.some((a) => a.nama === n));
    S.ui.afps = multiPilih($('#f-afps'), 'afps', opsi, 'Semua AFPS', render);
  }
  if (!hanya) {
    const c = hitung((d) => d.sumber);
    S.ui.sumber = multiPilih($('#f-sumber'), 'sumber', [
      { v: 'PERPANJANGAN', t: 'Perpanjangan', n: c.PERPANJANGAN || 0 },
      { v: 'NOO', t: 'NOO ber-AP', n: c.NOO || 0 },
    ], 'Semua sumber', render);
  }
}

/** Kuartal yang sedang dihitung (daftar kosong = seluruh kuartal pada data). */
function kuartalAktif() {
  if (S.kuartal.length) return S.kuartal.slice().sort();
  return Array.from(new Set(S.data.deals.filter((d) => d.valid && d.kuartal).map((d) => d.kuartal))).sort();
}
/** True bila kuartal tidak terpotong filter lain — syarat insentif boleh dihitung. */
function bulanPenuh() {
  if (S.akhir.length) return false;   // saringan akhir kontrak hanya mengambil sebagian deal satu kuartal
  if (!S.bulan.length) return true;
  const adaDiData = new Set(S.data.deals.filter((d) => d.valid && d.tgl_deal).map((d) => d.tgl_deal.slice(0, 7)));
  return kuartalAktif().every((q) => bulanKuartal(q).filter((m) => adaDiData.has(m)).every((m) => S.bulan.includes(m)));
}

/* ================================================================ pemuatan awal */

function tertanam(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
}

async function muat() {
  try {
    S.cfg = tertanam('cfgTertanam') || await fetch('config/scheme.json', { cache: 'no-cache' }).then((r) => r.json());
    S.data = tertanam('dataTertanam');
    if (!S.data) {
      const r = await fetch('data/dashboard.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('data/dashboard.json belum tersedia (status ' + r.status + ')');
      S.data = await r.json();
    }
    mulai();
  } catch (e) {
    $('#loading').classList.add('hidden');
    const g = $('#gagal');
    g.classList.remove('hidden');
    g.innerHTML = `<h2>Data belum bisa dimuat</h2><p class="hint">${esc(e.message)}</p>
      <p>Klik <strong>Ganti file SWS</strong> di kanan atas untuk membaca file SWS langsung dari komputer Anda.</p>`;
    siapkanTombolFile();
  }
}

function mulai() {
  const { cfg, data } = S;
  $('#judul').textContent = cfg.judul;
  $('#subjudul').textContent = cfg.subjudul || '';
  $('#brand-sub').textContent = data.meta.grfpm || 'Promotion M3';
  document.title = cfg.judul + ' — Promotion M3';

  const adaKuartal = new Set(data.deals.filter((d) => d.valid).map((d) => d.kuartal).filter(Boolean));
  if (!S.kuartal.length && adaKuartal.has(cfg.periode_aktif)) S.kuartal = [cfg.periode_aktif];
  S.kuartal = S.kuartal.filter((q) => adaKuartal.has(q));
  buatFilter();

  $('#f-cari').oninput = (e) => { S.cari = e.target.value.trim().toUpperCase(); S.limit = 200; render(); };
  $('#reset').onclick = () => {
    S.kuartal = []; S.bulan = []; S.akhir = []; S.region = []; S.afps = []; S.sumber = []; S.cari = ''; S.limit = 200;
    $('#f-cari').value = '';
    buatFilter(); render();
  };
  $('#lagi').onclick = () => { S.limit += 200; render(); };
  $$('.navitem').forEach((b) => { b.onclick = () => pilihView(b.dataset.view); });
  $$('[data-unduh]').forEach((b) => { b.onclick = () => unduhCsv(b.dataset.unduh); });
  if (document.getElementById('dataTertanam')) {
    $('#btn-html').classList.add('hidden');   // berkas mandiri tidak bisa membangun ulang dirinya
  } else {
    $('#btn-html').onclick = unduhHtml;
  }
  siapkanTombolFile();

  $('#loading').classList.add('hidden');
  $('#gagal').classList.add('hidden');
  $('#isi').classList.remove('hidden');
  render();
}

function pilihView(v) {
  S.view = v;
  $$('.navitem').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $$('main section').forEach((s) => s.classList.toggle('hidden', s.id !== 'v-' + v));
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------------------------------------------------------- unggah file SWS */

function siapkanTombolFile() {
  const input = $('#file-sws'), btn = $('#btn-ganti');
  if (typeof XLSX === 'undefined') {  // berkas HTML mandiri: pembaca .xlsx tidak ikut ditanam
    btn.disabled = true;
    btn.title = 'Hanya tersedia pada dashboard online, bukan pada berkas HTML hasil unduhan.';
    return;
  }
  btn.onclick = () => input.click();
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const label = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<span class="spinner dark" style="border:2px solid rgba(0,0,0,.15);border-top-color:#161721"></span>Membaca…';
    try {
      if (typeof XLSX === 'undefined') throw new Error('Pustaka pembaca Excel belum termuat — periksa koneksi internet, lalu muat ulang halaman.');
      if (!S.cfg) S.cfg = await fetch('config/scheme.json', { cache: 'no-cache' }).then((r) => r.json());
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
      S.data = dariWorkbook(wb, f.name);
      S.region = S.afps = S.sumber = ''; S.cari = ''; S.limit = 200; S.sort = {};
      $('#f-cari').value = '';
      mulai();
    } catch (e) {
      alert('Gagal membaca file: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = label; input.value = '';
    }
  };
}

/* ---------------------------------------------------------------- seleksi & perhitungan */

const kpiOtomatis = () => S.cfg.kpi.filter((k) => k.otomatis);
const kpiById = (id) => S.cfg.kpi.find((k) => k.id === id);

function terpilih() {
  const bulan = S.bulan.length ? new Set(S.bulan) : null;
  return S.data.deals.filter((d) => {
    if (!d.valid) return false;
    if (S.kuartal.length && !S.kuartal.includes(d.kuartal)) return false;
    if (bulan && !bulan.has((d.tgl_deal || '').slice(0, 7))) return false;
    if (S.akhir.length && !S.akhir.includes(d.kontrak_akhir_baru ? d.kontrak_akhir_baru.slice(0, 7) : '-')) return false;
    if (S.region.length && !S.region.includes(d.region)) return false;
    if (S.afps.length && !S.afps.includes(d.afps)) return false;
    if (S.sumber.length && !S.sumber.includes(d.sumber)) return false;
    if (S.cari) {
      const hay = `${d.outlet} ${d.afps} ${d.kota} ${d.kecamatan} ${d.ap} ${d.brand} ${d.jenis} ${d.kategori}`.toUpperCase();
      if (!hay.includes(S.cari)) return false;
    }
    return true;
  });
}

/** Tier yang dicapai: ambang persentase, atau ambang jumlah outlet absolut. */
function tierOf(tiers, ach, target) {
  for (const t of tiers || []) {
    if (t.min != null) { if (ach >= t.min) return t; }
    else if (target > 0 && ach / target >= t.pct) return t;
  }
  return null;
}

/**
 * Capaian tiap KPI untuk satu pemilik (AFPS atau RFPM).
 * Target skema berlaku per 3 bulan, jadi insentif dihitung per kuartal lalu dijumlahkan.
 * Bila filter bulan memotong kuartal, insentif tidak dihitung (capaian tetap tampil).
 */
function capaian(deals, peran, jumlahAfps) {
  const kuartals = kuartalAktif();
  const hitung = bulanPenuh();
  const hasil = { hitung, total: deals.length, insentif: 0, kuartals };
  for (const k of kpiOtomatis()) {
    const c = k[peran];
    let targetPerKuartal = 0;
    if (c) {
      targetPerKuartal = peran === 'afps'
        ? (c.target || 0) * (jumlahAfps || 1)
        : (c.target != null ? c.target : (c.target_per_afps || 0) * (jumlahAfps || 0));
    }
    const milik = deals.filter((d) => d.kpi === k.id);
    let ach = 0, insentif = 0, tierTunggal = null;
    kuartals.forEach((q) => {
      const n = milik.filter((d) => d.kuartal === q).length;
      ach += n;
      if (!hitung || !targetPerKuartal) return;
      const t = tierOf(c.tiers, n, targetPerKuartal);
      if (t) insentif += t.insentif;
      if (kuartals.length === 1) tierTunggal = t;
    });
    const target = targetPerKuartal * kuartals.length;
    const tier = kuartals.length === 1 ? tierTunggal
      : (hitung && target ? tierOf(c.tiers, ach, target) : null);   // lebih dari satu kuartal: indikatif
    hasil[k.id] = { ach, target, tier, tiers: c ? c.tiers : [], insentif };
    hasil.insentif += insentif;
  }
  hasil.lainnya = { ach: deals.filter((d) => d.kpi === 'lainnya').length, target: 0, tier: null, tiers: [] };
  return hasil;
}

function selKpi(c, hitung) {
  const i = (c.tiers || []).indexOf(c.tier);
  const kelas = !hitung || !c.target || !c.tier ? 'd0' : (['d100', 'd85', 'd75'][i] || 'd0');
  const judul = !hitung ? 'insentif tidak dihitung' : (c.tier ? c.tier.label : 'belum tercapai');
  return `<span class="dot ${kelas}" title="${judul}"></span>${int(c.ach)} <span class="muted">/ ${int(c.target)}</span>`;
}
function labelKuartal() {
  const k = kuartalAktif();
  const nama = (id) => { const q = S.cfg.kuartal.find((x) => x.id === id); return q ? q.label : id.replace('-Q', ' Q'); };
  let t = !S.kuartal.length ? `semua kuartal (${k.length})`
    : (k.length === 1 ? nama(k[0]) : k.map(nama).join(' + '));
  if (S.bulan.length) t += ' — ' + S.bulan.slice().sort().map(labelBulan).join(', ');
  return t;
}

/* ---------------------------------------------------------------- render */

function render() {
  const m = S.data.meta, d = m.dibuat ? new Date(m.dibuat) : null;
  $('#sidemeta').innerHTML = [
    m.week ? `Data SWS <b>Minggu ${m.week}</b>` : 'Data SWS',
    `<b>${int(m.ringkas.jumlah_afps)}</b> AFPS · <b>${int(m.ringkas.jumlah_region)}</b> region`,
    d ? `Diperbarui<br><b>${d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</b>` : '',
  ].filter(Boolean).join('<br>');
  $('#footer-meta').innerHTML = `Sumber: <strong>${esc(m.file_sumber)}</strong> — sheet EXT ${int(m.ringkas.ext_total)} baris kontrak (${int(m.ringkas.ext_deal)} deal perpanjangan), sheet NOO ${int(m.ringkas.noo_total)} baris target (${int(m.ringkas.noo_deal_ap)} sudah deal/ber-AP). ${esc(S.cfg.catatan_sumber || '')}`;

  const bagian = [];
  bagian.push(!S.kuartal.length ? 'semua kuartal' : (S.kuartal.length === 1 ? labelKuartalId(S.kuartal[0]).split(' · ')[0] : S.kuartal.slice().sort().map((q) => labelKuartalId(q).split(' · ')[0]).join(' + ')));
  if (S.bulan.length) bagian.push('bulan ' + S.bulan.slice().sort().map(labelBulan).join(', '));
  if (S.akhir.length) {                       // ringkas per tahun agar barisnya tidak kepanjangan
    const perTahun = {};
    S.akhir.forEach((m) => { const y = m === '-' ? '-' : m.slice(0, 4); (perTahun[y] = perTahun[y] || []).push(m); });
    bagian.push('akhir kontrak ' + Object.keys(perTahun).sort().map((y) => (y === '-' ? 'tanpa tanggal'
      : (perTahun[y].length > 3 ? `${y} (${perTahun[y].length} bulan)` : perTahun[y].sort().map(labelBulan).join(', ')))).join(' · '));
  }
  if (S.region.length) bagian.push(S.region.length === 1 ? S.region[0] : `${S.region.length} region (${S.region.join(', ')})`);
  if (S.afps.length) bagian.push(S.afps.length === 1 ? S.afps[0] : `${S.afps.length} AFPS`);
  if (S.sumber.length === 1) bagian.push(S.sumber[0] === 'NOO' ? 'NOO ber-AP saja' : 'perpanjangan saja');
  if (S.cari) bagian.push(`pencarian “${S.cari}”`);
  $('#ringkas-filter').innerHTML = `Filter aktif: <strong>${esc(bagian.join(' · '))}</strong> — <strong>${int(terpilih().length)}</strong> outlet`;

  if (S.view === 'insentif') renderInsentif();
  if (S.view === 'detail') renderDetail();
  if (S.view === 'skema') renderSkema();
  if (S.view === 'catatan') renderCatatan();
}

function renderInsentif() {
  const d = terpilih();
  const perp = d.filter((x) => x.sumber === 'PERPANJANGAN').length;
  const noo = d.length - perp;
  const lingkup = S.data.afps.filter((a) => (!S.region.length || S.region.includes(a.region))
    && (!S.afps.length || S.afps.includes(a.nama)));
  const perAfps = lingkup.map((a) => capaian(d.filter((x) => x.afps === a.nama), 'afps'));
  const totalInsentif = perAfps.reduce((s, c) => s + c.insentif, 0);
  const c = capaian(d, 'afps', lingkup.length);
  const maks = kpiOtomatis().reduce((s, k) => s + k.afps.tiers[0].insentif, 0) * lingkup.length * c.kuartals.length;

  $('#tiles').innerHTML = [
    { ic: '🏪', bg: 'bg-biru', num: int(d.length), lbl: 'Total outlet deal', sub: labelKuartal() },
    { ic: '🔁', bg: 'bg-hijau', num: int(perp), lbl: 'Perpanjangan kontrak', sub: 'sheet EXT — status DEAL' },
    { ic: '🆕', bg: 'bg-oranye', num: int(noo), lbl: 'NOO menjadi AP', sub: 'sheet NOO — nomor AP terbit' },
    {
      ic: '💰', bg: 'bg-ungu', num: c.hitung ? rpPendek(totalInsentif) : '—', lbl: 'Estimasi insentif AFPS',
      sub: c.hitung ? `dari maks ${rpPendek(maks)} · ${lingkup.length} AFPS · ${c.kuartals.length} kuartal`
        : 'periode terpotong filter',
    },
  ].map((t) => `<div class="kpi-solid ${t.bg}"><div class="ic">${t.ic}</div>
      <div class="num">${t.num}</div><div class="lbl">${esc(t.lbl)}</div><div class="sub2">${esc(t.sub)}</div></div>`).join('');

  const cakupan = S.afps.length === 1 ? S.afps[0] : (S.region.length === 1 ? S.region[0] : (S.data.meta.grfpm || 'Semua'));
  $('#kpi-hint').textContent = `${cakupan} — ${labelKuartal()}. Target agregat = target per AFPS × ${lingkup.length} AFPS`
    + (c.kuartals.length > 1 ? ` × ${c.kuartals.length} kuartal.` : '.');
  $('#kpi-cards').innerHTML = kpiOtomatis().map((k) => {
    const ach = c[k.id].ach, target = c[k.id].target;
    const p = target ? Math.min(ach / target, 1) : 0;
    const dapat = perAfps.filter((x) => x[k.id].tier).length;
    return `<div class="kpi-white">
      <div class="nm">${k.no}. ${esc(k.nama)}</div>
      <div class="val">${int(ach)} <small>/ ${int(target)} outlet</small></div>
      <div class="bar"><span style="width:${(p * 100).toFixed(1)}%"></span></div>
      <div class="ket"><span>${target ? pct(ach / target) : '—'} dari target</span>
        <span>${c.hitung ? `<strong>${dapat}</strong>/${lingkup.length} AFPS dapat insentif` : ''}</span></div>
      <div class="ket2">${esc(k.kontrak)}</div>
    </div>`;
  }).join('');
  const catatanKpi = [`Perpanjangan dan NOO digabung per channel sesuai ketentuan skema.`];
  if (c.lainnya.ach) catatanKpi.push(`<strong>${int(c.lainnya.ach)}</strong> deal channel DTW/POI, Sport, dan Rest Area ditampilkan tetapi tidak masuk KPI.`);
  if (!c.hitung) catatanKpi.push(`<strong>Insentif tidak dihitung</strong> karena filter ${S.akhir.length ? 'akhir kontrak' : 'bulan'} hanya mengambil sebagian isi kuartal — target skema berlaku per 3 bulan penuh. Kosongkan filter tersebut untuk melihat estimasi insentif.`);
  else if (c.kuartals.length > 1) catatanKpi.push(`Insentif dihitung <strong>per kuartal lalu dijumlahkan</strong> (${c.kuartals.length} kuartal). Titik warna pada tabel bersifat indikatif atas gabungan kuartal.`);
  $('#kpi-note').innerHTML = catatanKpi.join(' ');

  // ---- tabel per AFPS
  const rowsA = barisAfps(d);
  $('#afps-hint').textContent = `Target per AFPS per kuartal: ` + kpiOtomatis().map((k) => `${k.nama_pendek} ${k.afps.target}`).join(' · ')
    + (c.kuartals.length > 1 ? ` — kolom target sudah dikali ${c.kuartals.length} kuartal.` : '.');
  $('#afps-count').textContent = `${rowsA.length} AFPS`;
  const kolsA = [
    { k: 'nama', t: 'AFPS', teks: 1, v: (r) => esc(r.nama) },
    { k: 'region', t: 'Region', teks: 1, v: (r) => esc(r.region) },
    { k: 'perpanjangan', t: 'Perpanjangan', n: 1, v: (r) => int(r.perpanjangan) },
    { k: 'noo', t: 'NOO ber-AP', n: 1, v: (r) => int(r.noo) },
    ...kpiOtomatis().map((k) => ({ k: 'k' + k.id, t: k.nama_pendek, n: 1, s: (r) => r.c[k.id].ach, v: (r) => selKpi(r.c[k.id], r.c.hitung) })),
    { k: 'lain', t: 'Luar KPI', n: 1, s: (r) => r.c.lainnya.ach, v: (r) => int(r.c.lainnya.ach) },
    { k: 'insentif', t: 'Estimasi insentif', n: 1, s: (r) => r.c.insentif, v: (r) => (r.c.hitung ? `<strong>${rp(r.c.insentif)}</strong>` : '<span class="muted">—</span>') },
  ];
  const totA = {
    nama: `TOTAL ${rowsA.length} AFPS`, region: '',
    perpanjangan: rowsA.reduce((s, r) => s + r.perpanjangan, 0), noo: rowsA.reduce((s, r) => s + r.noo, 0),
    c: {
      hitung: c.hitung, insentif: rowsA.reduce((s, r) => s + r.c.insentif, 0),
      lainnya: { ach: rowsA.reduce((s, r) => s + r.c.lainnya.ach, 0) },
      ...Object.fromEntries(kpiOtomatis().map((k) => [k.id, {
        ach: rowsA.reduce((s, r) => s + r.c[k.id].ach, 0), target: rowsA.reduce((s, r) => s + r.c[k.id].target, 0), tiers: [],
      }])),
    },
  };
  tabel($('#t-afps'), kolsA, urut(rowsA, 'afps'), 'afps', totA);
  $('#legend-tier').innerHTML = !c.hitung ? `<span class="muted">Kosongkan filter ${S.akhir.length ? 'akhir kontrak' : 'bulan'} untuk melihat tier dan estimasi insentif.</span>`
    : ['<span><i class="dot d100" style="border-radius:50%"></i>≥100%</span>', '<span><i class="dot d85" style="border-radius:50%"></i>≥85%</span>',
       '<span><i class="dot d75" style="border-radius:50%"></i>≥75%</span>', '<span><i class="dot d0" style="border-radius:50%"></i>di bawah 75% — tanpa insentif</span>'].join('');

  // ---- tabel per RFPM
  const rowsR = barisRfpm(d);
  $('#rfpm-hint').textContent = `Satu region = satu RFPM. Target Kuliner & Lokpen = 15 outlet × jumlah AFPS di region per kuartal; Foodcourt = 5 outlet per RFPM per kuartal. Periode: ${labelKuartal()}.`;
  $('#rfpm-count').textContent = `${rowsR.length} region`;
  tabel($('#t-rfpm'), [
    { k: 'nama', t: 'RFPM / Region', teks: 1, v: (r) => esc(r.nama) },
    { k: 'jumlah_afps', t: 'AFPS', n: 1, v: (r) => int(r.jumlah_afps) },
    { k: 'perpanjangan', t: 'Perpanjangan', n: 1, v: (r) => int(r.perpanjangan) },
    { k: 'noo', t: 'NOO ber-AP', n: 1, v: (r) => int(r.noo) },
    ...kpiOtomatis().map((k) => ({ k: 'k' + k.id, t: k.nama_pendek, n: 1, s: (r) => r.c[k.id].ach, v: (r) => selKpi(r.c[k.id], r.c.hitung) })),
    { k: 'insentif', t: 'Estimasi insentif', n: 1, s: (r) => r.c.insentif, v: (r) => (r.c.hitung ? `<strong>${rp(r.c.insentif)}</strong>` : '<span class="muted">—</span>') },
  ], urut(rowsR, 'rfpm'), 'rfpm');

  const manual = S.cfg.kpi.filter((k) => !k.otomatis);
  const maksR = S.cfg.kpi.reduce((s, k) => s + (k.rfpm ? k.rfpm.tiers[0].insentif : 0), 0);
  const otoR = kpiOtomatis().reduce((s, k) => s + (k.rfpm ? k.rfpm.tiers[0].insentif : 0), 0);
  $('#rfpm-note').innerHTML = `Insentif RFPM maksimum menurut skema ${rpPendek(maksR)} per kuartal; yang dapat dihitung otomatis dari SWS ${rpPendek(otoR)}. `
    + manual.map((k) => `<strong>${esc(k.nama)}</strong> — ${esc(k.keterangan)}`).join(' ');

  chartKuartal();
  chartMinggu(d);
}

function barisAfps(d) {
  return S.data.afps
    .filter((a) => (!S.region.length || S.region.includes(a.region)) && (!S.afps.length || S.afps.includes(a.nama)))
    .map((a) => {
      const milik = d.filter((x) => x.afps === a.nama);
      return {
        nama: a.nama, region: a.region,
        perpanjangan: milik.filter((x) => x.sumber === 'PERPANJANGAN').length,
        noo: milik.filter((x) => x.sumber === 'NOO').length,
        c: capaian(milik, 'afps', 1),
      };
    });
}
function barisRfpm(d) {
  return S.data.region.filter((r) => !S.region.length || S.region.includes(r.nama)).map((r) => {
    const milik = d.filter((x) => x.region === r.nama);
    return {
      nama: r.nama, jumlah_afps: r.jumlah_afps,
      perpanjangan: milik.filter((x) => x.sumber === 'PERPANJANGAN').length,
      noo: milik.filter((x) => x.sumber === 'NOO').length,
      c: capaian(milik, 'rfpm', r.jumlah_afps),
    };
  });
}

function kolomDetail() {
  const s = S.cfg.tampilkan_data_sensitif;
  const k = [
    { k: 'sumber', t: 'Sumber', teks: 1, v: (r) => (r.sumber === 'NOO' ? 'NOO' : 'Perpanjangan') },
    { k: 'outlet', t: 'Nama outlet', teks: 1, cls: 'potong', v: (r) => `<span title="${esc(r.outlet)}">${esc(r.outlet)}</span>` },
    { k: 'afps', t: 'AFPS', teks: 1, v: (r) => esc(r.afps) },
    { k: 'region', t: 'Region', teks: 1, v: (r) => esc(r.region) },
    { k: 'kota', t: 'Kota', teks: 1, v: (r) => esc(r.kota) },
    { k: 'channel', t: 'Channel', teks: 1, v: (r) => esc(r.channel) },
    { k: 'jenis', t: 'Jenis outlet', teks: 1, v: (r) => esc(r.jenis) },
    { k: 'kpi', t: 'KPI', teks: 1, v: (r) => esc((kpiById(r.kpi) || { nama_pendek: 'Luar KPI' }).nama_pendek) },
    { k: 'brand', t: 'Brand', teks: 1, v: (r) => esc(r.brand) },
    { k: 'kontrak', t: 'BB/BR/BL', v: (r) => esc(r.kontrak) },
    { k: 'tgl_deal', t: 'Tgl deal', v: (r) => tanggal(r.tgl_deal) },
    { k: 'week_deal', t: 'Week', n: 1, v: (r) => (r.week_deal == null ? '—' : 'W' + r.week_deal) },
    { k: 'kuartal', t: 'Kuartal', v: (r) => esc(r.kuartal || '—') },
    { k: 'ap', t: 'Nomor AP', v: (r) => esc(r.ap || '—') },
    { k: 'kontrak_akhir_baru', t: 'Kontrak s/d', v: (r) => tanggal(r.kontrak_akhir_baru) },
    { k: 'alamat', t: 'Alamat', teks: 1, cls: 'potong', v: (r) => `<span title="${esc(r.alamat)}">${esc(r.alamat)}</span>` },
    { k: 'pic', t: 'PIC', teks: 1, v: (r) => esc(r.pic) },
  ];
  if (s) k.push(
    { k: 'telp', t: 'No. telp PIC', v: (r) => esc(r.telp || '—') },
    { k: 'kompensasi', t: 'Kompensasi', n: 1, v: (r) => rp(r.kompensasi) },
    { k: 'branding', t: 'Branding', n: 1, v: (r) => rp(r.branding) },
    { k: 'nilai_total', t: 'Total kontrak', n: 1, v: (r) => rp(r.nilai_total) },
    { k: 'omset', t: 'Omset/minggu', n: 1, s: (r) => r.omset_week || r.omset_karton || 0,
      v: (r) => (r.omset_week != null ? rp(r.omset_week) : (r.omset_karton != null ? int(r.omset_karton) + ' krt' : '—')) },
  );
  return k;
}

function renderDetail() {
  const rows = urut(terpilih(), 'detail');
  const tampil = rows.slice(0, S.limit);
  $('#detail-count').textContent = `Menampilkan ${int(tampil.length)} dari ${int(rows.length)} outlet`;
  $('#lagi').classList.toggle('hidden', tampil.length >= rows.length);
  tabel($('#t-detail'), kolomDetail(), tampil, 'detail');
}

function renderSkema() {
  const tier = (c, i) => {
    const t = c && c.tiers[i];
    if (!t) return '<span class="muted">—</span>';
    return t.min != null ? `${esc(t.label)} · ${rpPendek(t.insentif)}` : rpPendek(t.insentif);
  };
  const baris = S.cfg.kpi.map((k) => `<tr>
      <td class="num">${k.no}</td>
      <td class="teks"><strong>${esc(k.nama)}</strong><br><span class="muted" style="font-size:11px">${esc(k.kontrak || '')}</span></td>
      <td>${k.afps ? int(k.afps.target) + ' outlet' : '<span class="muted">—</span>'}</td>
      <td>${k.rfpm ? (k.rfpm.target != null ? int(k.rfpm.target) + ' outlet' : int(k.rfpm.target_per_afps) + ' × AFPS') : '—'}</td>
      <td>${tier(k.afps, 0)}</td><td>${tier(k.afps, 1)}</td><td>${tier(k.afps, 2)}</td>
      <td>${tier(k.rfpm, 0)}</td><td>${tier(k.rfpm, 1)}</td><td>${tier(k.rfpm, 2)}</td>
      <td class="teks">${k.otomatis ? '<span class="pill p100">Otomatis</span>' : '<span class="pill p0">Manual</span>'}</td>
    </tr>`).join('');
  const totA = kpiOtomatis().reduce((s, k) => s + k.afps.tiers[0].insentif, 0);
  const totR = S.cfg.kpi.reduce((s, k) => s + (k.rfpm ? k.rfpm.tiers[0].insentif : 0), 0);
  $('#t-skema').innerHTML = `<thead><tr>
      <th class="nosort num">No</th><th class="nosort">Activity</th>
      <th class="nosort">Target AFPS</th><th class="nosort">Target RFPM</th>
      <th class="nosort">AFPS ≥100%</th><th class="nosort">AFPS ≥85%</th><th class="nosort">AFPS ≥75%</th>
      <th class="nosort">RFPM ≥100%</th><th class="nosort">RFPM ≥85%</th><th class="nosort">RFPM ≥75%</th>
      <th class="nosort">Hitung</th></tr></thead>
    <tbody>${baris}</tbody>
    <tfoot><tr><td colspan="4" class="teks">Maksimum per kuartal</td><td>${rpPendek(totA)}</td><td colspan="2"></td><td>${rpPendek(totR)}</td><td colspan="3"></td></tr></tfoot>`;
  $('#skema-catatan').innerHTML = S.cfg.kpi.map((k) =>
    `<div class="note ${k.otomatis ? '' : 'warn'}"><strong>${k.no}. ${esc(k.nama)}</strong> — ${esc(k.keterangan)}</div>`).join('');
  $('#t-mapping').innerHTML = `<thead><tr><th class="nosort">Channel di SWS</th><th class="nosort">Dihitung sebagai KPI</th><th class="nosort num">Jumlah deal (semua kuartal)</th></tr></thead><tbody>`
    + Object.entries(S.cfg.channel_ke_kpi).map(([ch, id]) => {
      const k = kpiById(id);
      return `<tr><td class="teks">${esc(ch)}</td><td class="teks">${esc(k ? k.nama : S.cfg.kpi_lainnya.nama)}</td><td class="num">${int(S.data.deals.filter((d) => d.channel === ch).length)}</td></tr>`;
    }).join('') + '</tbody>';
}

function renderCatatan() {
  const rows = urut(S.data.issues.filter((i) => (!S.region.length || S.region.includes(i.region))
    && (!S.afps.length || S.afps.includes(i.afps))), 'catatan');
  $('#catatan-count').textContent = `${int(rows.length)} baris perlu diperiksa`;
  tabel($('#t-catatan'), [
    { k: 'sheet', t: 'Sheet', v: (r) => esc(r.sheet) },
    { k: 'no_outlet', t: 'No outlet', n: 1, v: (r) => esc(r.no_outlet) },
    { k: 'outlet', t: 'Nama outlet', teks: 1, cls: 'potong', v: (r) => `<span title="${esc(r.outlet)}">${esc(r.outlet)}</span>` },
    { k: 'afps', t: 'AFPS', teks: 1, v: (r) => esc(r.afps) },
    { k: 'region', t: 'Region', teks: 1, v: (r) => esc(r.region) },
    { k: 'masalah', t: 'Catatan', teks: 1, v: (r) => esc(r.masalah) },
  ], rows, 'catatan');
}

/* ---------------------------------------------------------------- tabel generik */

function urut(rows, key) {
  const s = S.sort[key];
  if (!s) return rows;
  const nilai = (r) => (s.kol.s ? s.kol.s(r) : (r[s.kol.k] ?? ''));
  return rows.slice().sort((a, b) => {
    const x = nilai(a), y = nilai(b);
    if (typeof x === 'number' && typeof y === 'number') return s.asc ? x - y : y - x;
    return s.asc ? String(x).localeCompare(String(y), 'id') : String(y).localeCompare(String(x), 'id');
  });
}

function tabel(el, kols, rows, key, total) {
  const s = S.sort[key];
  const th = kols.map((k, i) => {
    const arah = s && s.kol.k === k.k ? (s.asc ? ' ▲' : ' ▼') : '';
    return `<th data-i="${i}" class="${k.n ? 'num ' : ''}${k.nosort ? 'nosort' : ''}">${esc(k.t)}${arah}</th>`;
  }).join('');
  const body = rows.length
    ? rows.map((r) => `<tr>${kols.map((k) => `<td class="${k.n ? 'num ' : ''}${k.teks ? 'teks ' : ''}${k.cls || ''}">${k.v(r)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${kols.length}" class="teks muted" style="padding:26px;text-align:center">Tidak ada data untuk filter ini.</td></tr>`;
  const foot = total ? `<tfoot><tr>${kols.map((k) => `<td class="${k.n ? 'num ' : ''}${k.teks ? 'teks ' : ''}">${k.v(total)}</td>`).join('')}</tr></tfoot>` : '';
  el.innerHTML = `<thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}`;
  $$('thead th:not(.nosort)', el).forEach((h) => {
    h.onclick = () => {
      const kol = kols[+h.dataset.i];
      S.sort[key] = S.sort[key] && S.sort[key].kol.k === kol.k ? { kol, asc: !S.sort[key].asc } : { kol, asc: false };
      render();
    };
  });
}

/* ---------------------------------------------------------------- unduhan */

function unduhBerkas(isi, nama, tipe) {
  const blob = new Blob([isi], { type: tipe });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nama;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function unduhCsv(jenis) {
  let head, isi, nama;
  const ids = kpiOtomatis().map((k) => k.id);
  if (jenis === 'afps' || jenis === 'rfpm') {
    const rows = jenis === 'afps' ? barisAfps(terpilih()) : barisRfpm(terpilih());
    nama = 'ringkasan-' + jenis;
    head = ['Nama', jenis === 'rfpm' ? 'Jumlah AFPS' : 'Region', 'Perpanjangan', 'NOO ber-AP',
      ...ids.flatMap((id) => [kpiById(id).nama + ' (capaian)', kpiById(id).nama + ' (target)']), 'Estimasi insentif'];
    isi = rows.map((r) => [r.nama, jenis === 'rfpm' ? r.jumlah_afps : r.region, r.perpanjangan, r.noo,
      ...ids.flatMap((id) => [r.c[id].ach, r.c[id].target]), r.c.insentif]);
  } else if (jenis === 'detail') {
    const kols = kolomDetail();
    nama = 'detail-outlet'; head = kols.map((k) => k.t);
    isi = terpilih().map((r) => kols.map((k) => r[k.k] ?? ''));
  } else {
    nama = 'catatan-data';
    head = ['Sheet', 'No outlet', 'Outlet', 'AFPS', 'Region', 'Catatan'];
    isi = S.data.issues.map((r) => [r.sheet, r.no_outlet, r.outlet, r.afps, r.region, r.masalah]);
  }
  const csv = [head, ...isi].map((b) => b.map((v) => {
    const t = String(v ?? '');
    return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }).join(';')).join('\r\n');
  const periode = (S.kuartal.length ? S.kuartal.slice().sort().join('_') : 'semua') + (S.bulan.length ? '-' + S.bulan.slice().sort().join('_') : '');
  unduhBerkas('﻿' + csv, `${nama}-${periode}-W${S.data.meta.week || 'x'}.csv`, 'text/csv;charset=utf-8');
}

/** Satu berkas HTML mandiri berisi data saat ini — untuk dibagikan/arsip. */
async function unduhHtml() {
  const btn = $('#btn-html'), label = btn.textContent;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Menyiapkan…';
  try {
    const ambil = (u) => fetch(u, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(u + ' tidak terbaca (' + r.status + ')');
      return r.text();
    });
    const [html, css, js] = await Promise.all([
      ambil(location.pathname.endsWith('/') ? location.pathname + 'index.html' : location.pathname),
      ambil('assets/styles.css'), ambil('assets/app.js'),
    ]);
    // Pembaca .xlsx tidak ikut ditanam (≈900 KB); berkas unduhan tetap bisa dibaca,
    // hanya tombol "Ganti file SWS" yang non-aktif di sana.
    const aman = (t) => t.replace(/<\/script>/gi, '<\\/script>');
    // Pengganti dibungkus fungsi: teks pengganti memuat pola $&, $` dan $$ milik
    // String.replace yang kalau dibiarkan akan menyalin isi berkas dua kali.
    const ganti = (teks, cari, isi) => teks.replace(cari, () => isi);
    let out = ganti(html, '<link rel="stylesheet" href="assets/styles.css">', `<style>\n${css}\n</style>`);
    out = ganti(out, '<script src="vendor/xlsx.full.min.js"></script>', '');
    out = ganti(out, '<script src="assets/app.js"></script>',
      `<script id="cfgTertanam" type="application/json">${aman(JSON.stringify(S.cfg))}</script>\n`
      + `<script id="dataTertanam" type="application/json">${aman(JSON.stringify(S.data))}</script>\n`
      + `<script>\n${aman(js)}\n</script>`);
    unduhBerkas(out, `dashboard-insentif-W${S.data.meta.week || 'x'}.html`, 'text/html;charset=utf-8');
  } catch (e) {
    alert('Gagal menyiapkan berkas: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

/* ---------------------------------------------------------------- grafik (SVG, tanpa pustaka) */

const WARNA = { biru: '#0B5CAD', oranye: '#EB6834' };

function pasangTooltip(root) {
  const tt = $('#tt');
  $$('[data-tt]', root).forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      tt.innerHTML = el.dataset.tt; tt.style.opacity = '1';
      const r = tt.getBoundingClientRect();
      tt.style.left = Math.min(e.clientX + 14, innerWidth - r.width - 8) + 'px';
      tt.style.top = Math.max(8, e.clientY - r.height - 12) + 'px';
    });
    el.addEventListener('mouseleave', () => { tt.style.opacity = '0'; });
  });
}
const kosong = (sel, teks) => { $(sel).innerHTML = `<p class="muted" style="padding:24px 0;text-align:center">${teks}</p>`; };

function batangV(x, y, w, h, r = 4) {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}
function skalaAtas(maks) {
  if (maks <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(maks)));
  return Math.ceil(maks / (p / 2)) * (p / 2);
}
const seriAktif = (nama) => !S.sumber.length || S.sumber.includes(nama.startsWith('NOO') ? 'NOO' : 'PERPANJANGAN');

/** Deal per kuartal — batang berkelompok, dua seri, berlabel langsung. */
function chartKuartal() {
  const bulan = S.bulan.length ? new Set(S.bulan) : null;
  const semua = S.data.deals.filter((d) => d.valid
    && (!S.region.length || S.region.includes(d.region)) && (!S.afps.length || S.afps.includes(d.afps))
    && (!S.sumber.length || S.sumber.includes(d.sumber))
    && (!bulan || bulan.has((d.tgl_deal || '').slice(0, 7)))
    && (!S.akhir.length || S.akhir.includes(d.kontrak_akhir_baru ? d.kontrak_akhir_baru.slice(0, 7) : '-'))
    && (!S.cari || `${d.outlet} ${d.afps} ${d.kota} ${d.ap}`.toUpperCase().includes(S.cari)));
  const qs = S.cfg.kuartal.filter((q) => semua.some((d) => d.kuartal === q.id));
  if (!qs.length) return kosong('#chart-kuartal', 'Belum ada deal dengan tanggal valid.');

  const seri = [
    { nama: 'Perpanjangan', warna: WARNA.biru, v: qs.map((q) => semua.filter((d) => d.kuartal === q.id && d.sumber === 'PERPANJANGAN').length) },
    { nama: 'NOO ber-AP', warna: WARNA.oranye, v: qs.map((q) => semua.filter((d) => d.kuartal === q.id && d.sumber === 'NOO').length) },
  ].filter((s) => seriAktif(s.nama));

  const W = 620, H = 240, l = 38, r = 10, t = 26, b = 34, iw = W - l - r, ih = H - t - b;
  const maks = skalaAtas(Math.max(1, ...seri.flatMap((s) => s.v)));
  const band = iw / qs.length, lebar = Math.min(44, (band - 16) / seri.length - 2);

  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = t + ih - (ih * i) / 4;
    g += `<line x1="${l}" y1="${y}" x2="${W - r}" y2="${y}" stroke="rgba(22,23,33,.08)"/>
          <text x="${l - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#8C8DA0">${int((maks * i) / 4)}</text>`;
  }
  qs.forEach((q, i) => {
    const x0 = l + band * i + (band - (lebar + 2) * seri.length) / 2;
    const aktif = S.kuartal.includes(q.id);
    g += `<text x="${l + band * i + band / 2}" y="${H - 12}" text-anchor="middle" font-size="11.5"
           fill="${aktif ? '#161721' : '#6C6D82'}" font-weight="${aktif ? 800 : 500}">${esc(q.label)}</text>`;
    seri.forEach((s, j) => {
      const v = s.v[i], h = v > 0 ? Math.max((v / maks) * ih, 3) : 0;
      const x = x0 + j * (lebar + 2), y = t + ih - h;
      g += `<path d="${batangV(x, y, lebar, h)}" fill="${s.warna}" data-tt="<b>${esc(q.label)} — ${esc(s.nama)}</b>${int(v)} outlet"/>`;
      if (v > 0) g += `<text x="${x + lebar / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" fill="#6C6D82">${int(v)}</text>`;
    });
  });
  g += `<line x1="${l}" y1="${t + ih}" x2="${W - r}" y2="${t + ih}" stroke="rgba(22,23,33,.18)"/>`;
  $('#chart-kuartal').innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Jumlah deal per kuartal">${g}</svg>`;
  pasangTooltip($('#chart-kuartal'));
}

/** Deal per minggu — garis 2px, dua seri, crosshair per minggu. */
function chartMinggu(deals) {
  $('#figsub-minggu').textContent = `Minggu tanggal deal — ${labelKuartal()}`;
  const pakai = deals.filter((d) => (d.week_iso ?? d.week_deal) != null).map((d) => ({ ...d, w: d.week_iso ?? d.week_deal }));
  if (!pakai.length) return kosong('#chart-minggu', 'Tidak ada data minggu deal pada filter ini.');

  const wmin = Math.min(...pakai.map((d) => d.w)), wmax = Math.max(...pakai.map((d) => d.w));
  const weeks = []; for (let w = wmin; w <= wmax; w++) weeks.push(w);
  const seri = [
    { nama: 'Perpanjangan', warna: WARNA.biru, v: weeks.map((w) => pakai.filter((d) => d.w === w && d.sumber === 'PERPANJANGAN').length) },
    { nama: 'NOO ber-AP', warna: WARNA.oranye, v: weeks.map((w) => pakai.filter((d) => d.w === w && d.sumber === 'NOO').length) },
  ].filter((s) => seriAktif(s.nama));

  const W = 620, H = 240, l = 38, r = 12, t = 18, b = 32, iw = W - l - r, ih = H - t - b;
  const maks = skalaAtas(Math.max(1, ...seri.flatMap((s) => s.v)));
  const X = (i) => l + (weeks.length > 1 ? (iw * i) / (weeks.length - 1) : iw / 2);
  const Y = (v) => t + ih - (v / maks) * ih;

  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = t + ih - (ih * i) / 4;
    g += `<line x1="${l}" y1="${y}" x2="${W - r}" y2="${y}" stroke="rgba(22,23,33,.08)"/>
          <text x="${l - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#8C8DA0">${int((maks * i) / 4)}</text>`;
  }
  const langkah = Math.max(1, Math.ceil(weeks.length / 12));
  weeks.forEach((w, i) => {
    if (i % langkah === 0 || i === weeks.length - 1) g += `<text x="${X(i)}" y="${H - 11}" text-anchor="middle" font-size="10.5" fill="#8C8DA0">W${w}</text>`;
  });
  seri.forEach((s) => {
    g += `<path d="${s.v.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.warna}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (weeks.length <= 20) s.v.forEach((v, i) => { g += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="${s.warna}" stroke="#fff" stroke-width="2"/>`; });
  });
  weeks.forEach((w, i) => {
    const lebar = weeks.length > 1 ? iw / (weeks.length - 1) : iw;
    g += `<rect x="${X(i) - lebar / 2}" y="${t}" width="${lebar}" height="${ih}" fill="transparent"
           data-tt="<b>Minggu ${w}</b>${seri.map((s) => `${s.nama}: <strong>${int(s.v[i])}</strong>`).join('<br>')}"/>`;
  });
  g += `<line x1="${l}" y1="${t + ih}" x2="${W - r}" y2="${t + ih}" stroke="rgba(22,23,33,.18)"/>`;
  $('#chart-minggu').innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Jumlah deal per minggu">${g}</svg>`;
  pasangTooltip($('#chart-minggu'));
}

/* Jalankan setelah seluruh definisi siap (data tertanam dimuat tanpa await). */
muat();
