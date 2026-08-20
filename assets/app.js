/* Dashboard Insentif AFPS & RFPM — Departemen Promotion M3
   Data: data/dashboard.json (hasil konversi SWS mingguan) + config/scheme.json */

'use strict';

const S = {
  cfg: null, data: null,
  kuartal: '', region: '', afps: '', sumber: '', cari: '',
  tab: 'ringkasan', limit: 200,
  sort: { afps: null, rfpm: null, detail: null, catatan: null },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const NF = new Intl.NumberFormat('id-ID');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const int = (v) => NF.format(Math.round(v || 0));
const pct = (v) => (v * 100).toFixed(0) + '%';

function rp(v) {
  if (v == null || v === '') return '—';
  return 'Rp ' + NF.format(Math.round(v));
}
function rpShort(v) {
  if (!v) return 'Rp 0';
  if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(v % 1e9 ? 1 : 0).replace('.', ',') + ' M';
  if (v >= 1e6) return 'Rp ' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',') + ' jt';
  if (v >= 1e3) return 'Rp ' + Math.round(v / 1e3) + ' rb';
  return 'Rp ' + NF.format(v);
}
function tanggal(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${+d} ${bulan[+m - 1]} ${y}`;
}

/* ---------------------------------------------------------------- muat data */

async function muat() {
  try {
    const [cfg, data] = await Promise.all([
      fetch('config/scheme.json', { cache: 'no-cache' }).then((r) => r.json()),
      fetch('data/dashboard.json', { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error('data/dashboard.json belum tersedia (status ' + r.status + ')');
        return r.json();
      }),
    ]);
    S.cfg = cfg; S.data = data;
    S.kuartal = cfg.periode_aktif || '';
    init();
  } catch (e) {
    $('#loading').classList.add('hidden');
    const g = $('#gagal');
    g.classList.remove('hidden');
    g.innerHTML = `<strong>Data belum bisa dimuat.</strong> ${esc(e.message)}<br>
      Unggah file SWS terbaru ke folder <code>data/raw/</code> agar GitHub Actions membuat <code>data/dashboard.json</code>.`;
  }
}

function init() {
  const { cfg, data } = S;
  document.title = `${cfg.judul} — Promotion M3`;
  $('#judul').textContent = cfg.judul;
  $('#subjudul').textContent = cfg.subjudul || '';

  const m = data.meta;
  const dibuat = m.dibuat ? new Date(m.dibuat) : null;
  $('#chips').innerHTML = [
    m.week ? `Data SWS <strong>Minggu ${m.week}</strong>` : 'Data SWS',
    m.grfpm ? `<strong>${esc(m.grfpm)}</strong>` : '',
    `<strong>${int(m.ringkas.jumlah_afps)}</strong> AFPS · <strong>${int(m.ringkas.jumlah_region)}</strong> region`,
    dibuat ? `Diperbarui <strong>${dibuat.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</strong>` : '',
  ].filter(Boolean).map((t) => `<span class="chip">${t}</span>`).join('');

  const fk = $('#f-kuartal');
  const adaKuartal = new Set(data.deals.map((d) => d.kuartal).filter(Boolean));
  const daftar = cfg.kuartal.filter((q) => adaKuartal.has(q.id));
  for (const q of daftar) fk.add(new Option(`${q.label} (${q.rentang})`, q.id));
  fk.add(new Option('Semua kuartal (tanpa hitung insentif)', 'ALL'));
  if (!daftar.some((q) => q.id === S.kuartal)) S.kuartal = daftar.length ? daftar[daftar.length - 1].id : 'ALL';
  fk.value = S.kuartal;

  for (const r of data.region) $('#f-region').add(new Option(r.nama, r.nama));
  isiAfps();

  fk.onchange = () => { S.kuartal = fk.value; render(); };
  $('#f-region').onchange = (e) => { S.region = e.target.value; S.afps = ''; isiAfps(); render(); };
  $('#f-afps').onchange = (e) => { S.afps = e.target.value; render(); };
  $('#f-sumber').onchange = (e) => { S.sumber = e.target.value; render(); };
  $('#f-cari').oninput = (e) => { S.cari = e.target.value.trim().toUpperCase(); S.limit = 200; render(); };
  $('#reset').onclick = () => {
    S.region = S.afps = S.sumber = ''; S.cari = ''; S.limit = 200;
    $('#f-region').value = ''; $('#f-sumber').value = ''; $('#f-cari').value = '';
    isiAfps(); render();
  };
  $('#lagi').onclick = () => { S.limit += 200; render(); };
  $$('.tab').forEach((b) => { b.onclick = () => pilihTab(b.dataset.tab); });
  $('#tema').onclick = temaToggle;
  $$('[data-unduh]').forEach((b) => { b.onclick = () => unduh(b.dataset.unduh); });

  $('#loading').classList.add('hidden');
  $('#app').classList.remove('hidden');
  render();
}

function isiAfps() {
  const sel = $('#f-afps');
  sel.innerHTML = '<option value="">Semua AFPS</option>';
  S.data.afps.filter((a) => !S.region || a.region === S.region)
    .forEach((a) => sel.add(new Option(a.nama, a.nama)));
  sel.value = S.afps;
}

function temaToggle() {
  const el = document.documentElement;
  const gelap = el.dataset.theme === 'dark'
    || (el.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  el.dataset.theme = gelap ? 'light' : 'dark';
  render();
}

function pilihTab(t) {
  S.tab = t;
  $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  $$('main > section').forEach((s) => s.classList.toggle('hidden', s.id !== 'p-' + t));
  render();
}

/* ---------------------------------------------------------------- seleksi & KPI */

const kpiOtomatis = () => S.cfg.kpi.filter((k) => k.otomatis);
const kpiById = (id) => S.cfg.kpi.find((k) => k.id === id);

function terpilih() {
  const q = S.kuartal;
  return S.data.deals.filter((d) => {
    if (q !== 'ALL' && d.kuartal !== q) return false;
    if (q === 'ALL' && !d.valid) return false;
    if (S.region && d.region !== S.region) return false;
    if (S.afps && d.afps !== S.afps) return false;
    if (S.sumber && d.sumber !== S.sumber) return false;
    if (S.cari) {
      const hay = `${d.outlet} ${d.afps} ${d.kota} ${d.kecamatan} ${d.ap} ${d.brand} ${d.jenis} ${d.kategori}`.toUpperCase();
      if (!hay.includes(S.cari)) return false;
    }
    return true;
  });
}

/** Tier yang dicapai: pakai ambang persentase, atau ambang jumlah outlet absolut. */
function tierOf(tiers, ach, target) {
  for (const t of tiers || []) {
    if (t.min != null) { if (ach >= t.min) return t; }
    else if (target > 0 && ach / target >= t.pct) return t;
  }
  return null;
}

/** Hitung capaian tiap KPI untuk satu pemilik (AFPS atau RFPM). */
function capaian(deals, peran, jumlahAfps) {
  const hitungInsentif = S.kuartal !== 'ALL';
  const hasil = {};
  let insentif = 0;
  for (const k of kpiOtomatis()) {
    const cfgPeran = k[peran];
    const ach = deals.filter((d) => d.kpi === k.id).length;
    let target = 0;
    if (cfgPeran) {
      target = peran === 'afps'
        ? (cfgPeran.target || 0) * (jumlahAfps || 1)              // target per AFPS x jumlah AFPS dalam lingkup
        : (cfgPeran.target != null ? cfgPeran.target              // target tetap per RFPM
          : (cfgPeran.target_per_afps || 0) * (jumlahAfps || 0)); // target per AFPS x jumlah AFPS di region
    }
    const t = hitungInsentif && target > 0 ? tierOf(cfgPeran.tiers, ach, target) : null;
    hasil[k.id] = { ach, target, tier: t, tiers: cfgPeran ? cfgPeran.tiers : [], insentif: t ? t.insentif : 0 };
    insentif += t ? t.insentif : 0;
  }
  hasil.lainnya = { ach: deals.filter((d) => d.kpi === 'lainnya').length, target: 0, tier: null, insentif: 0 };
  hasil.total = deals.length;
  hasil.insentif = insentif;
  hasil.hitungInsentif = hitungInsentif;
  return hasil;
}

/** Sel tabel KPI: titik warna tier + capaian/target. */
function selKpi(c, hitung) {
  const kelas = !hitung || !c.target ? 't0' : (!c.tier ? 't0'
    : (c.tier === tierKe(c, 0) ? 't100' : (c.tier === tierKe(c, 1) ? 't85' : 't75')));
  return `<span class="dot ${kelas}" title="${!hitung ? 'insentif tidak dihitung' : (c.tier ? c.tier.label : 'belum tercapai')}"></span>`
    + `${int(c.ach)} <span class="muted">/ ${int(c.target)}</span>`;
}
function tierKe(c, i) { return c.tiers ? c.tiers[i] : null; }

function legendaTier(sel) {
  const el = $(sel);
  if (!el) return;
  el.innerHTML = S.kuartal === 'ALL'
    ? '<span class="muted">Pilih satu kuartal untuk melihat tier dan estimasi insentif.</span>'
    : ['<span><i class="dot t100"></i>≥100% target</span>', '<span><i class="dot t85"></i>≥85%</span>',
       '<span><i class="dot t75"></i>≥75%</span>', '<span><i class="dot t0"></i>di bawah 75% — tanpa insentif</span>'].join('');
  el.className = 'legend-tier';
}

function badgeTier(c) {
  if (!c.hitung) return '<span class="badge t0">—</span>';
  if (!c.tier) return '<span class="badge t0">Belum tercapai</span>';
  const i = (c.tiers || []).indexOf(c.tier);
  return `<span class="badge ${['t100', 't85', 't75'][i] || 't0'}">${esc(c.tier.label)}</span>`;
}

/* ---------------------------------------------------------------- render */

function render() {
  if (S.tab === 'ringkasan') renderRingkasan();
  if (S.tab === 'afps') renderAfps();
  if (S.tab === 'rfpm') renderRfpm();
  if (S.tab === 'detail') renderDetail();
  if (S.tab === 'skema') renderSkema();
  if (S.tab === 'catatan') renderCatatan();
  const m = S.data.meta;
  $('#footer-meta').innerHTML = `Sumber: <strong>${esc(m.file_sumber)}</strong> — sheet EXT (${int(m.ringkas.ext_total)} baris kontrak, ${int(m.ringkas.ext_deal)} deal perpanjangan)
    dan sheet NOO (${int(m.ringkas.noo_total)} baris target, ${int(m.ringkas.noo_deal_ap)} sudah deal/ber-AP).
    ${esc(S.cfg.catatan_sumber || '')}`;
}

function labelKuartal() {
  if (S.kuartal === 'ALL') return 'semua kuartal';
  const q = S.cfg.kuartal.find((x) => x.id === S.kuartal);
  return q ? `${q.label} (${q.rentang})` : S.kuartal;
}

function renderRingkasan() {
  const d = terpilih();
  const perp = d.filter((x) => x.sumber === 'PERPANJANGAN');
  const noo = d.filter((x) => x.sumber === 'NOO');

  const lingkup = S.afps ? [S.data.afps.find((a) => a.nama === S.afps)].filter(Boolean)
    : S.data.afps.filter((a) => !S.region || a.region === S.region);
  const totalInsentif = lingkup.reduce((s, a) => s + capaian(d.filter((x) => x.afps === a.nama), 'afps').insentif, 0);
  const maksInsentif = kpiOtomatis().reduce((s, k) => s + (k.afps ? k.afps.tiers[0].insentif : 0), 0) * lingkup.length;

  $('#tiles').innerHTML = [
    { k: 'Total outlet deal', v: int(d.length), d: labelKuartal() },
    { k: 'Perpanjangan kontrak', v: int(perp.length), d: 'sheet EXT — status DEAL' },
    { k: 'NOO menjadi AP', v: int(noo.length), d: 'sheet NOO — nomor AP terbit' },
    {
      k: 'Estimasi insentif AFPS',
      v: S.kuartal === 'ALL' ? '—' : rpShort(totalInsentif),
      d: S.kuartal === 'ALL' ? 'pilih satu kuartal untuk menghitung'
        : `dari maksimum ${rpShort(maksInsentif)} · ${lingkup.length} AFPS`,
    },
  ].map((t) => `<div class="tile"><div class="k">${t.k}</div><div class="v">${t.v}</div><div class="d">${esc(t.d)}</div></div>`).join('');

  const jumlahAfps = lingkup.length;
  const peran = 'afps';
  const c = capaian(d, peran, jumlahAfps);
  $('#kpi-hint').textContent = `Akumulasi ${S.afps || S.region || 'GRFPM 2'} — ${labelKuartal()}. `
    + `Target agregat = target per AFPS × ${jumlahAfps} AFPS.`;

  const perAfps = lingkup.map((a) => capaian(d.filter((x) => x.afps === a.nama), 'afps'));
  $('#kpi-cards').innerHTML = kpiOtomatis().map((k) => {
    const ach = c[k.id].ach;
    const target = c[k.id].target;
    const tercapai = perAfps.filter((x) => x[k.id].tier).length;
    const p = target ? Math.min(ach / target, 1) : 0;
    const warna = target && ach / target >= 1 ? 'var(--good)' : (target && ach / target >= 0.75 ? 'var(--s1)' : 'var(--s2)');
    return `<div class="kpi">
      <div class="name">${k.no}. ${esc(k.nama)}</div>
      <div class="num">${int(ach)} <small>/ ${int(target)} outlet</small></div>
      <div class="bar"><span style="width:${(p * 100).toFixed(1)}%;background:${warna}"></span></div>
      <div class="meta"><span>${target ? pct(ach / target) : '—'} dari target</span>
        <span>${c.hitungInsentif ? `<strong>${tercapai}</strong> dari ${lingkup.length} AFPS dapat insentif` : ''}</span></div>
      <div class="kontrak">${esc(k.kontrak)}</div>
    </div>`;
  }).join('');

  const lain = c.lainnya.ach;
  $('#kpi-note').innerHTML = S.kuartal === 'ALL'
    ? 'Insentif tidak dihitung untuk "semua kuartal" karena target skema berlaku per 3 bulan. Pilih satu kuartal untuk melihat estimasi insentif.'
    : `Perpanjangan dan NOO digabung per channel sesuai ketentuan skema (dealing NOO/Takeover mencakup outlet yang layak perpanjang dan sudah diperpanjang).
       ${lain ? `<strong>${int(lain)}</strong> deal channel DTW/POI, Sport, dan Rest Area ditampilkan di tabel tetapi tidak masuk KPI Q3 2026.` : ''}`;

  chartKuartal();
  chartMinggu(d);
  chartRegion(d);
  chartChannel(d);
}

/* ---------------------------------------------------------------- tabel per AFPS */

function barisAfps() {
  const d = terpilih();
  return S.data.afps
    .filter((a) => (!S.region || a.region === S.region) && (!S.afps || a.nama === S.afps))
    .map((a) => {
      const milik = d.filter((x) => x.afps === a.nama);
      const c = capaian(milik, 'afps', 1);
      return {
        nama: a.nama, region: a.region,
        perpanjangan: milik.filter((x) => x.sumber === 'PERPANJANGAN').length,
        noo: milik.filter((x) => x.sumber === 'NOO').length,
        c,
      };
    });
}

function renderAfps() {
  const rows = barisAfps();
  $('#afps-hint').textContent = `Target per AFPS untuk ${labelKuartal()}: `
    + kpiOtomatis().map((k) => `${k.nama} ${k.afps.target}`).join(' · ');
  $('#afps-count').textContent = `${rows.length} AFPS`;

  const kols = [
    { k: 'nama', t: 'AFPS', v: (r) => esc(r.nama) },
    { k: 'region', t: 'Region', v: (r) => esc(r.region) },
    { k: 'perpanjangan', t: 'Perpanjangan', n: 1, v: (r) => int(r.perpanjangan) },
    { k: 'noo', t: 'NOO ber-AP', n: 1, v: (r) => int(r.noo) },
  ];
  for (const k of kpiOtomatis()) {
    kols.push({ k: 'kpi_' + k.id, t: k.nama_pendek, n: 1, s: (r) => r.c[k.id].ach, v: (r) => selKpi(r.c[k.id], r.c.hitungInsentif) });
  }
  kols.push({ k: 'lainnya', t: 'Luar KPI', n: 1, s: (r) => r.c.lainnya.ach, v: (r) => int(r.c.lainnya.ach) });
  kols.push({
    k: 'insentif', t: 'Estimasi insentif', n: 1, s: (r) => r.c.insentif,
    v: (r) => (r.c.hitungInsentif ? `<strong>${rp(r.c.insentif)}</strong>` : '<span class="muted">—</span>'),
  });

  const total = {
    nama: `TOTAL ${rows.length} AFPS`, region: '',
    perpanjangan: rows.reduce((s, r) => s + r.perpanjangan, 0),
    noo: rows.reduce((s, r) => s + r.noo, 0),
    c: {
      hitungInsentif: rows.length ? rows[0].c.hitungInsentif : false,
      insentif: rows.reduce((s, r) => s + r.c.insentif, 0),
      lainnya: { ach: rows.reduce((s, r) => s + r.c.lainnya.ach, 0) },
      ...Object.fromEntries(kpiOtomatis().map((k) => [k.id, {
        ach: rows.reduce((s, r) => s + r.c[k.id].ach, 0),
        target: rows.reduce((s, r) => s + r.c[k.id].target, 0),
      }])),
    },
  };
  tabel($('#t-afps'), kols, urut(rows, 'afps'), 'afps', total);
  legendaTier('#afps-legend');
}

/* ---------------------------------------------------------------- tabel per RFPM */

function barisRfpm() {
  const d = terpilih();
  return S.data.region
    .filter((r) => !S.region || r.nama === S.region)
    .map((r) => {
      const milik = d.filter((x) => x.region === r.nama);
      return {
        nama: r.nama, jumlah_afps: r.jumlah_afps,
        perpanjangan: milik.filter((x) => x.sumber === 'PERPANJANGAN').length,
        noo: milik.filter((x) => x.sumber === 'NOO').length,
        c: capaian(milik, 'rfpm', r.jumlah_afps),
      };
    });
}

function renderRfpm() {
  const rows = barisRfpm();
  $('#rfpm-hint').textContent = `Satu region diperlakukan sebagai satu RFPM. Target Kuliner & Lokpen = 15 outlet × jumlah AFPS di region; Foodcourt = 5 outlet per RFPM. Periode: ${labelKuartal()}.`;
  $('#rfpm-count').textContent = `${rows.length} region`;

  const kols = [
    { k: 'nama', t: 'RFPM / Region', v: (r) => esc(r.nama) },
    { k: 'jumlah_afps', t: 'AFPS', n: 1, v: (r) => int(r.jumlah_afps) },
    { k: 'perpanjangan', t: 'Perpanjangan', n: 1, v: (r) => int(r.perpanjangan) },
    { k: 'noo', t: 'NOO ber-AP', n: 1, v: (r) => int(r.noo) },
  ];
  for (const k of kpiOtomatis()) {
    kols.push({ k: 'kpi_' + k.id, t: k.nama_pendek, n: 1, s: (r) => r.c[k.id].ach, v: (r) => selKpi(r.c[k.id], r.c.hitungInsentif) });
  }
  kols.push({
    k: 'insentif', t: 'Estimasi insentif', n: 1, s: (r) => r.c.insentif,
    v: (r) => (r.c.hitungInsentif ? `<strong>${rp(r.c.insentif)}</strong>` : '<span class="muted">—</span>'),
  });
  tabel($('#t-rfpm'), kols, urut(rows, 'rfpm'), 'rfpm');
  legendaTier('#rfpm-legend');

  const manual = S.cfg.kpi.filter((k) => !k.otomatis);
  const maks = S.cfg.kpi.reduce((s, k) => s + (k.rfpm ? k.rfpm.tiers[0].insentif : 0), 0);
  const otomatisMaks = kpiOtomatis().reduce((s, k) => s + (k.rfpm ? k.rfpm.tiers[0].insentif : 0), 0);
  $('#rfpm-note').innerHTML = `Insentif RFPM maksimum menurut skema adalah ${rpShort(maks)} per kuartal; yang dapat dihitung otomatis dari SWS hanya ${rpShort(otomatisMaks)}. `
    + manual.map((k) => `<strong>${esc(k.nama)}</strong> — ${esc(k.keterangan)}`).join(' ');
}

/* ---------------------------------------------------------------- detail outlet */

function kolomDetail() {
  const sensitif = S.cfg.tampilkan_data_sensitif;
  const kols = [
    { k: 'sumber', t: 'Sumber', v: (r) => (r.sumber === 'NOO' ? 'NOO' : 'Perpanjangan') },
    { k: 'outlet', t: 'Nama outlet', v: (r) => `<span title="${esc(r.outlet)}">${esc(r.outlet)}</span>`, cls: 'wrapcell' },
    { k: 'afps', t: 'AFPS', v: (r) => esc(r.afps) },
    { k: 'region', t: 'Region', v: (r) => esc(r.region) },
    { k: 'kota', t: 'Kota', v: (r) => esc(r.kota) },
    { k: 'channel', t: 'Channel', v: (r) => esc(r.channel) },
    { k: 'jenis', t: 'Jenis outlet', v: (r) => esc(r.jenis) },
    { k: 'kpi', t: 'KPI', v: (r) => esc((kpiById(r.kpi) || { nama_pendek: 'Luar KPI' }).nama_pendek) },
    { k: 'brand', t: 'Brand', v: (r) => esc(r.brand) },
    { k: 'kontrak', t: 'BB/BR/BL', v: (r) => esc(r.kontrak) },
    { k: 'tgl_deal', t: 'Tgl deal', v: (r) => tanggal(r.tgl_deal) },
    { k: 'week_deal', t: 'Week', n: 1, v: (r) => (r.week_deal == null ? '—' : 'W' + r.week_deal) },
    { k: 'kuartal', t: 'Kuartal', v: (r) => esc(r.kuartal || '—') },
    { k: 'ap', t: 'Nomor AP', v: (r) => esc(r.ap || '—') },
    { k: 'kontrak_akhir_baru', t: 'Kontrak s/d', v: (r) => tanggal(r.kontrak_akhir_baru) },
    { k: 'alamat', t: 'Alamat', v: (r) => `<span title="${esc(r.alamat)}">${esc(r.alamat)}</span>`, cls: 'wrapcell' },
    { k: 'pic', t: 'PIC', v: (r) => esc(r.pic) },
  ];
  if (sensitif) {
    kols.push(
      { k: 'telp', t: 'No. telp PIC', v: (r) => esc(r.telp || '—') },
      { k: 'kompensasi', t: 'Kompensasi', n: 1, v: (r) => rp(r.kompensasi) },
      { k: 'branding', t: 'Branding', n: 1, v: (r) => rp(r.branding) },
      { k: 'nilai_total', t: 'Total kontrak', n: 1, v: (r) => rp(r.nilai_total) },
      { k: 'omset', t: 'Omset/minggu', n: 1, s: (r) => r.omset_week || r.omset_karton || 0,
        v: (r) => (r.omset_week != null ? rp(r.omset_week) : (r.omset_karton != null ? int(r.omset_karton) + ' krt' : '—')) },
    );
  }
  return kols;
}

function renderDetail() {
  const rows = urut(terpilih(), 'detail');
  const tampil = rows.slice(0, S.limit);
  $('#detail-count').textContent = `Menampilkan ${int(tampil.length)} dari ${int(rows.length)} outlet`;
  $('#lagi').classList.toggle('hidden', tampil.length >= rows.length);
  tabel($('#t-detail'), kolomDetail(), tampil, 'detail');
}

/* ---------------------------------------------------------------- skema & catatan */

function renderSkema() {
  const baris = S.cfg.kpi.map((k) => {
    const a = k.afps, r = k.rfpm;
    // label tier hanya ditulis ulang bila ambangnya jumlah outlet (beda dari judul kolom persentase)
    const tier = (c, i) => {
      const t = c && c.tiers[i];
      if (!t) return '<span class="muted">—</span>';
      return t.min != null ? `${esc(t.label)} · ${rpShort(t.insentif)}` : rpShort(t.insentif);
    };
    return `<tr>
      <td class="num">${k.no}</td>
      <td class="wrapcell"><strong>${esc(k.nama)}</strong><br><span class="muted">${esc(k.kontrak || '')}</span></td>
      <td>${a ? int(a.target) + ' outlet' : '<span class="muted">—</span>'}</td>
      <td>${r ? (r.target != null ? int(r.target) + ' outlet' : int(r.target_per_afps) + ' × jml AFPS') : '—'}</td>
      <td>${tier(a, 0)}</td><td>${tier(a, 1)}</td><td>${tier(a, 2)}</td>
      <td>${tier(r, 0)}</td><td>${tier(r, 1)}</td><td>${tier(r, 2)}</td>
      <td class="wrapcell">${k.otomatis ? '<span class="badge t100">Dihitung otomatis</span>' : '<span class="badge t0">Manual</span>'}</td>
    </tr>`;
  }).join('');
  const totAfps = kpiOtomatis().reduce((s, k) => s + k.afps.tiers[0].insentif, 0);
  const totRfpm = S.cfg.kpi.reduce((s, k) => s + (k.rfpm ? k.rfpm.tiers[0].insentif : 0), 0);
  $('#t-skema').innerHTML = `
    <thead><tr>
      <th class="nosort num">No</th><th class="nosort">Activity</th>
      <th class="nosort">Target AFPS<br>/3 bulan</th><th class="nosort">Target RFPM<br>/3 bulan</th>
      <th class="nosort">AFPS ≥100%</th><th class="nosort">AFPS ≥85%</th><th class="nosort">AFPS ≥75%</th>
      <th class="nosort">RFPM ≥100%</th><th class="nosort">RFPM ≥85%</th><th class="nosort">RFPM ≥75%</th>
      <th class="nosort">Status hitung</th>
    </tr></thead><tbody>${baris}</tbody>
    <tfoot><tr><td colspan="4">Maksimum per kuartal</td>
      <td>${rpShort(totAfps)}</td><td colspan="2"></td><td>${rpShort(totRfpm)}</td><td colspan="3"></td></tr></tfoot>`;

  $('#skema-catatan').innerHTML = S.cfg.kpi.map((k) =>
    `<div class="note ${k.otomatis ? 'info' : ''}"><strong>${k.no}. ${esc(k.nama)}</strong> — ${esc(k.keterangan)}</div>`).join('');

  const peta = Object.entries(S.cfg.channel_ke_kpi).map(([ch, id]) => {
    const k = kpiById(id);
    const jml = S.data.deals.filter((d) => d.channel === ch).length;
    return `<tr><td>${esc(ch)}</td><td>${esc(k ? k.nama : S.cfg.kpi_lainnya.nama)}</td><td class="num">${int(jml)}</td></tr>`;
  }).join('');
  $('#t-mapping').innerHTML = `
    <thead><tr><th class="nosort">Channel di SWS</th><th class="nosort">Dihitung sebagai KPI</th><th class="nosort num">Jumlah deal (semua kuartal)</th></tr></thead>
    <tbody>${peta}</tbody>`;
}

function renderCatatan() {
  const rows = urut(S.data.issues.filter((i) =>
    (!S.region || i.region === S.region) && (!S.afps || i.afps === S.afps)), 'catatan');
  $('#catatan-count').textContent = `${int(rows.length)} baris perlu diperiksa`;
  tabel($('#t-catatan'), [
    { k: 'sheet', t: 'Sheet', v: (r) => esc(r.sheet) },
    { k: 'no_outlet', t: 'No outlet', n: 1, v: (r) => esc(r.no_outlet) },
    { k: 'outlet', t: 'Nama outlet', v: (r) => `<span title="${esc(r.outlet)}">${esc(r.outlet)}</span>`, cls: 'wrapcell' },
    { k: 'afps', t: 'AFPS', v: (r) => esc(r.afps) },
    { k: 'region', t: 'Region', v: (r) => esc(r.region) },
    { k: 'masalah', t: 'Catatan', v: (r) => esc(r.masalah), cls: 'wrapcell' },
  ], rows, 'catatan');
}

/* ---------------------------------------------------------------- tabel generik */

function urut(rows, key) {
  const s = S.sort[key];
  if (!s) return rows;
  const kol = s.kol;
  const nilai = (r) => (kol.s ? kol.s(r) : (r[kol.k] ?? ''));
  return rows.slice().sort((a, b) => {
    const x = nilai(a), y = nilai(b);
    if (typeof x === 'number' && typeof y === 'number') return s.asc ? x - y : y - x;
    return s.asc ? String(x).localeCompare(String(y), 'id') : String(y).localeCompare(String(x), 'id');
  });
}

function tabel(el, kols, rows, key, total) {
  const s = S.sort[key];
  const th = kols.map((k, i) => {
    const aktif = s && s.kol.k === k.k ? (s.asc ? ' ▲' : ' ▼') : '';
    return `<th data-i="${i}" class="${k.n ? 'num ' : ''}${k.nosort ? 'nosort' : ''}" ${k.nosort ? '' : 'title="Klik untuk mengurutkan"'}>${esc(k.t)}${aktif}</th>`;
  }).join('');
  const body = rows.length
    ? rows.map((r) => `<tr>${kols.map((k) => `<td class="${k.n ? 'num ' : ''}${k.cls || ''}">${k.v(r)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${kols.length}" class="muted" style="padding:24px;text-align:center">Tidak ada data untuk filter ini.</td></tr>`;
  const foot = total ? `<tfoot><tr>${kols.map((k) => `<td class="${k.n ? 'num ' : ''}">${k.v(total)}</td>`).join('')}</tr></tfoot>` : '';
  el.innerHTML = `<thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}`;
  $$('thead th:not(.nosort)', el).forEach((h) => {
    h.onclick = () => {
      const kol = kols[+h.dataset.i];
      S.sort[key] = S.sort[key] && S.sort[key].kol.k === kol.k ? { kol, asc: !S.sort[key].asc } : { kol, asc: false };
      render();
    };
  });
}

/* ---------------------------------------------------------------- unduh CSV */

function unduh(jenis) {
  let kols, rows, nama;
  if (jenis === 'afps') { kols = null; rows = barisAfps(); nama = 'ringkasan-afps'; }
  if (jenis === 'rfpm') { kols = null; rows = barisRfpm(); nama = 'ringkasan-rfpm'; }
  if (jenis === 'detail') { kols = kolomDetail(); rows = terpilih(); nama = 'detail-outlet'; }
  if (jenis === 'catatan') {
    kols = [{ k: 'sheet', t: 'Sheet' }, { k: 'no_outlet', t: 'No outlet' }, { k: 'outlet', t: 'Outlet' },
      { k: 'afps', t: 'AFPS' }, { k: 'region', t: 'Region' }, { k: 'masalah', t: 'Catatan' }];
    rows = S.data.issues; nama = 'catatan-data';
  }
  let head, isi;
  if (kols) {
    head = kols.map((k) => k.t);
    isi = rows.map((r) => kols.map((k) => r[k.k] ?? ''));
  } else {
    const ids = kpiOtomatis().map((k) => k.id);
    head = ['Nama', jenis === 'rfpm' ? 'Jumlah AFPS' : 'Region', 'Perpanjangan', 'NOO ber-AP',
      ...ids.flatMap((id) => [kpiById(id).nama + ' (capaian)', kpiById(id).nama + ' (target)']), 'Estimasi insentif'];
    isi = rows.map((r) => [r.nama, jenis === 'rfpm' ? r.jumlah_afps : r.region, r.perpanjangan, r.noo,
      ...ids.flatMap((id) => [r.c[id].ach, r.c[id].target]), r.c.insentif]);
  }
  const csv = [head, ...isi].map((baris) => baris.map((v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nama}-${S.kuartal}-W${S.data.meta.week || 'x'}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------------------------------------------------------- grafik (SVG) */

const TT = () => $('#tt');

function pasangTooltip(root) {
  $$('[data-tt]', root).forEach((el) => {
    el.style.cursor = 'default';
    el.addEventListener('mousemove', (e) => {
      const t = TT();
      t.innerHTML = el.dataset.tt;
      t.style.opacity = '1';
      const r = t.getBoundingClientRect();
      const x = Math.min(e.clientX + 14, innerWidth - r.width - 8);
      const y = Math.max(8, e.clientY - r.height - 12);
      t.style.left = x + 'px'; t.style.top = y + 'px';
    });
    el.addEventListener('mouseleave', () => { TT().style.opacity = '0'; });
  });
}

function kosong(sel, teks) {
  $(sel).innerHTML = `<p class="muted" style="padding:24px 0;text-align:center">${teks}</p>`;
}

/** Batang membulat 4px di ujung data, menempel pada baseline. */
function batangV(x, y, w, h, r = 4) {
  const rr = Math.max(0, Math.min(r, h, w / 2));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}
function batangH(x, y, w, h, r = 4) {
  const rr = Math.max(0, Math.min(r, w, h / 2));
  return `M${x},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} L${x},${y + h} Z`;
}
function skalaAtas(maks) {
  if (maks <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(maks)));
  return Math.ceil(maks / (p / 2)) * (p / 2);
}

/** Deal per kuartal — batang berkelompok, dua seri. */
function chartKuartal() {
  const semua = S.data.deals.filter((d) => d.valid
    && (!S.region || d.region === S.region) && (!S.afps || d.afps === S.afps)
    && (!S.sumber || d.sumber === S.sumber)
    && (!S.cari || `${d.outlet} ${d.afps} ${d.kota} ${d.ap}`.toUpperCase().includes(S.cari)));
  const kuartals = S.cfg.kuartal.filter((q) => semua.some((d) => d.kuartal === q.id));
  if (!kuartals.length) return kosong('#chart-kuartal', 'Belum ada deal dengan tanggal valid.');

  const seri = [
    { nama: 'Perpanjangan', warna: 'var(--s1)', v: kuartals.map((q) => semua.filter((d) => d.kuartal === q.id && d.sumber === 'PERPANJANGAN').length) },
    { nama: 'NOO ber-AP', warna: 'var(--s2)', v: kuartals.map((q) => semua.filter((d) => d.kuartal === q.id && d.sumber === 'NOO').length) },
  ].filter((s) => !S.sumber || s.nama.startsWith(S.sumber === 'NOO' ? 'NOO' : 'Perpanjangan'));

  const W = 640, H = 250, l = 40, r = 10, t = 26, b = 36;
  const iw = W - l - r, ih = H - t - b;
  const maks = skalaAtas(Math.max(1, ...seri.flatMap((s) => s.v)));
  const band = iw / kuartals.length;
  const lebar = Math.min(46, (band - 16) / seri.length - 2);

  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = t + ih - (ih * i) / 4;
    g += `<line x1="${l}" y1="${y}" x2="${W - r}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>
          <text x="${l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${int((maks * i) / 4)}</text>`;
  }
  kuartals.forEach((q, i) => {
    const x0 = l + band * i + (band - (lebar + 2) * seri.length) / 2;
    const aktif = q.id === S.kuartal;
    g += `<text x="${l + band * i + band / 2}" y="${H - 14}" text-anchor="middle" font-size="12"
           fill="${aktif ? 'var(--ink)' : 'var(--ink-2)'}" font-weight="${aktif ? 650 : 400}">${esc(q.label)}</text>`;
    seri.forEach((s, j) => {
      const v = s.v[i];
      const h = v > 0 ? Math.max((v / maks) * ih, 3) : 0;
      const x = x0 + j * (lebar + 2);
      const y = t + ih - h;
      g += `<path d="${batangV(x, y, lebar, h)}" fill="${s.warna}"
             data-tt="<b>${esc(q.label)} — ${esc(s.nama)}</b>${int(v)} outlet"/>`;
      if (v > 0) g += `<text x="${x + lebar / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="var(--ink-2)" font-variant-numeric="tabular-nums">${int(v)}</text>`;
    });
  });
  g += `<line x1="${l}" y1="${t + ih}" x2="${W - r}" y2="${t + ih}" stroke="var(--axis)" stroke-width="1"/>`;
  $('#chart-kuartal').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Jumlah deal per kuartal">${g}</svg>`;
  pasangTooltip($('#chart-kuartal'));
}

/** Deal per minggu — garis 2px, dua seri, penanda titik pada hover. */
function chartMinggu(deals) {
  const pakai = deals.filter((d) => (d.week_iso ?? d.week_deal) != null).map((d) => ({ ...d, w: d.week_iso ?? d.week_deal }));
  $('#figsub-minggu').textContent = `Minggu tanggal deal — ${labelKuartal()}`;
  if (!pakai.length) return kosong('#chart-minggu', 'Tidak ada data minggu deal pada filter ini.');

  const wmin = Math.min(...pakai.map((d) => d.w));
  const wmax = Math.max(...pakai.map((d) => d.w));
  const weeks = [];
  for (let w = wmin; w <= wmax; w++) weeks.push(w);
  const seri = [
    { nama: 'Perpanjangan', warna: 'var(--s1)', v: weeks.map((w) => pakai.filter((d) => d.w === w && d.sumber === 'PERPANJANGAN').length) },
    { nama: 'NOO ber-AP', warna: 'var(--s2)', v: weeks.map((w) => pakai.filter((d) => d.w === w && d.sumber === 'NOO').length) },
  ].filter((s) => !S.sumber || s.nama.startsWith(S.sumber === 'NOO' ? 'NOO' : 'Perpanjangan'));

  const W = 640, H = 250, l = 40, r = 12, t = 20, b = 34;
  const iw = W - l - r, ih = H - t - b;
  const maks = skalaAtas(Math.max(1, ...seri.flatMap((s) => s.v)));
  const X = (i) => l + (weeks.length > 1 ? (iw * i) / (weeks.length - 1) : iw / 2);
  const Y = (v) => t + ih - (v / maks) * ih;

  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = t + ih - (ih * i) / 4;
    g += `<line x1="${l}" y1="${y}" x2="${W - r}" y2="${y}" stroke="var(--grid)"/>
          <text x="${l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${int((maks * i) / 4)}</text>`;
  }
  const langkah = Math.max(1, Math.ceil(weeks.length / 12));
  weeks.forEach((w, i) => {
    if (i % langkah === 0 || i === weeks.length - 1) {
      g += `<text x="${X(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--muted)">W${w}</text>`;
    }
  });
  seri.forEach((s) => {
    const d = s.v.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    g += `<path d="${d}" fill="none" stroke="${s.warna}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (weeks.length <= 20) {
      s.v.forEach((v, i) => { g += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="${s.warna}" stroke="var(--surface)" stroke-width="2"/>`; });
    }
  });
  weeks.forEach((w, i) => {
    const lebar = weeks.length > 1 ? iw / (weeks.length - 1) : iw;
    const isi = seri.map((s) => `${s.nama}: <strong>${int(s.v[i])}</strong>`).join('<br>');
    g += `<rect x="${X(i) - lebar / 2}" y="${t}" width="${lebar}" height="${ih}" fill="transparent"
           data-tt="<b>Minggu ${w}</b>${isi}"/>`;
  });
  g += `<line x1="${l}" y1="${t + ih}" x2="${W - r}" y2="${t + ih}" stroke="var(--axis)"/>`;
  $('#chart-minggu').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Jumlah deal per minggu">${g}</svg>`;
  pasangTooltip($('#chart-minggu'));
}

/** Pencapaian KPI per region dengan penanda target. */
function chartRegion(deals) {
  const daftar = S.data.region.filter((r) => !S.region || r.nama === S.region);
  if (!daftar.length) return kosong('#chart-region', 'Tidak ada region.');
  const hitungTarget = S.kuartal !== 'ALL' && !S.afps;

  const rows = daftar.map((r) => {
    const milik = deals.filter((d) => d.region === r.nama && d.kpi !== 'lainnya');
    const target = kpiOtomatis().reduce((s, k) => s + (k.rfpm.target != null ? k.rfpm.target : k.rfpm.target_per_afps * r.jumlah_afps), 0);
    return { nama: r.nama, v: milik.length, target, afps: r.jumlah_afps };
  }).sort((a, b) => b.v - a.v);

  const barisTinggi = 30, W = 640, l = 168, r = 56, t = 8;
  const H = t + rows.length * barisTinggi + 12;
  const iw = W - l - r;
  const maks = skalaAtas(Math.max(1, ...rows.map((x) => Math.max(x.v, hitungTarget ? x.target : 0))));

  let g = '';
  rows.forEach((row, i) => {
    const y = t + i * barisTinggi;
    const h = 16;
    const w = (row.v / maks) * iw;
    const capai = hitungTarget && row.target ? row.v / row.target : null;
    const warna = capai == null ? 'var(--s1)' : (capai >= 1 ? 'var(--good)' : (capai >= 0.75 ? 'var(--s1)' : 'var(--s2)'));
    g += `<text x="${l - 10}" y="${y + h - 2}" text-anchor="end" font-size="12" fill="var(--ink-2)">${esc(row.nama)}</text>`;
    if (hitungTarget && row.target) {
      g += `<path d="${batangH(l, y + 2, (row.target / maks) * iw, h)}" fill="var(--grid)"/>`;
    }
    g += `<path d="${batangH(l, y + 2, Math.max(w, 1), h)}" fill="${warna}"
           data-tt="<b>${esc(row.nama)}</b>${int(row.v)} outlet KPI${hitungTarget ? ` dari target ${int(row.target)} (${pct(row.v / row.target)})` : ''}<br>${row.afps} AFPS"/>`;
    g += `<text x="${l + Math.max(w, 1) + 8}" y="${y + h - 2}" font-size="12" fill="var(--ink)" font-variant-numeric="tabular-nums">${int(row.v)}</text>`;
    if (hitungTarget && row.target) {
      const xt = l + (row.target / maks) * iw;
      g += `<line x1="${xt}" y1="${y}" x2="${xt}" y2="${y + h + 4}" stroke="var(--ink-2)" stroke-width="2"
             data-tt="<b>Target ${esc(row.nama)}</b>${int(row.target)} outlet"/>`;
    }
  });
  $('#chart-region').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pencapaian KPI per region">${g}</svg>`
    + (hitungTarget ? '<div class="legend"><span><i style="background:var(--good)"></i>≥100% target</span><span><i style="background:var(--s1)"></i>75–99%</span><span><i style="background:var(--s2)"></i>&lt;75%</span><span><i style="background:var(--grid)"></i>sisa menuju target</span></div>' : '');
  pasangTooltip($('#chart-region'));
}

/** Sebaran channel — batang horizontal satu seri, berlabel langsung. */
function chartChannel(deals) {
  const hitung = {};
  deals.forEach((d) => { hitung[d.channel || 'TANPA CHANNEL'] = (hitung[d.channel || 'TANPA CHANNEL'] || 0) + 1; });
  const rows = Object.entries(hitung).map(([k, v]) => ({ nama: k, v })).sort((a, b) => b.v - a.v);
  if (!rows.length) return kosong('#chart-channel', 'Tidak ada data pada filter ini.');

  const barisTinggi = 28, W = 640, l = 150, r = 60, t = 6;
  const H = t + rows.length * barisTinggi + 8;
  const iw = W - l - r;
  const maks = Math.max(...rows.map((x) => x.v));
  const total = rows.reduce((s, x) => s + x.v, 0);

  let g = '';
  rows.forEach((row, i) => {
    const y = t + i * barisTinggi, h = 16;
    const w = Math.max((row.v / maks) * iw, 1);
    const k = kpiById(S.cfg.channel_ke_kpi[row.nama]);
    g += `<text x="${l - 10}" y="${y + h - 2}" text-anchor="end" font-size="12" fill="var(--ink-2)">${esc(row.nama)}</text>
          <path d="${batangH(l, y + 2, w, h)}" fill="var(--s1)"
            data-tt="<b>${esc(row.nama)}</b>${int(row.v)} outlet (${pct(row.v / total)})<br>KPI: ${esc(k ? k.nama : 'di luar KPI Q3')}"/>
          <text x="${l + w + 8}" y="${y + h - 2}" font-size="12" fill="var(--ink)" font-variant-numeric="tabular-nums">${int(row.v)} <tspan fill="var(--muted)">${pct(row.v / total)}</tspan></text>`;
  });
  $('#chart-channel').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sebaran channel outlet">${g}</svg>`;
  pasangTooltip($('#chart-channel'));
}

muat();
