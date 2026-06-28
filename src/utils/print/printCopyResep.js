/**
 * Copy Resep Print Utilities
 * Handles print logic for Copy Resep module
 * Paper target: A4 Portrait (210mm × 297mm)
 */

export function generateCopyResepHTML(copyResep, copyResepSettings) {
  const {
    pharmacyName = 'Apotek',
    pharmacyAddress = '',
    pharmacyCity = '',
    pharmacyPhone = '',
    pharmacyEmail = '',
    pharmacyWebsite = '',
    logo = '',
    pharmacistName = '',
    pharmacistSIPA = '',
    pharmacistTitle = 'Apoteker',
    footerNote = '',
    footerLegal = '',
    footerExtra = '',
  } = copyResepSettings || {};

  const {
    nomorCopyResep,
    tanggal,
    namaDokter,
    tanggalResep,
    pasien = {},
    obat = [],
    keterangan = '',
    catatanTambahan = '',
  } = copyResep;

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  };

  const fullAddress = [pharmacyAddress, pharmacyCity].filter(Boolean).join(', ');

  const medicineRows = obat.map((item, i) => {
    if (item.tipe === 'racikan') {
      const komponenLines = (item.komponenRacikan || '')
        .split('\n')
        .filter(Boolean)
        .map(line => `<div class="racikan-line">— ${line.trim()}</div>`)
        .join('');
      return `
    <div class="med-item">
      <div class="med-number">${i + 1}.</div>
      <div class="med-detail">
        <div class="med-name">🧪 ${item.namaRacikan || 'Racikan'}${item.jumlah && item.satuan ? ` <span class="med-form">— ${item.jumlah} ${item.satuan}</span>` : ''}</div>
        <div class="racikan-box">
          <div class="racikan-label">Komposisi:</div>
          ${komponenLines}
        </div>
        <div class="med-signa"><span class="signa-label">S.</span> ${item.signa || '-'}</div>
        ${item.keterangan ? `<div class="med-notes">${item.keterangan}</div>` : ''}
      </div>
    </div>`;
    } else {
      return `
    <div class="med-item">
      <div class="med-number">${i + 1}.</div>
      <div class="med-detail">
        <div class="med-name">${item.namaObat || '-'}${item.bentukSediaan ? ` – <span class="med-form">${item.bentukSediaan}</span>` : ''}${item.kekuatanDosis ? ` <span class="med-dose">${item.kekuatanDosis}</span>` : ''}</div>
        <div class="med-signa">
          <span class="signa-label">S.</span> ${item.signa || '-'}
          ${item.jumlah ? `<span class="med-qty">#${item.jumlah}</span>` : ''}
        </div>
        ${item.keterangan ? `<div class="med-notes">${item.keterangan}</div>` : ''}
      </div>
    </div>`;
    }
  }).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Salinan Resep ${nomorCopyResep || ''}</title>
  <style>
    /* ── RESET & BASE ─────────────────────────────── */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12px;
      line-height: 1.5;
      color: #000;
      background: #fff;
    }

    /* ── PRINT MEDIA ─────────────────────────────── */
    @page {
      size: A4 portrait;
      margin: 10mm;
    }

    @media print {
      html, body {
        width: 210mm;
      }
      .no-print { display: none !important; }
    }

    body {
      padding: 0;
      position: relative;
    }

    /* ── WATERMARK ─────────────────────────────────── */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 96px;
      font-weight: 900;
      color: rgba(0, 0, 0, 0.07);
      text-transform: uppercase;
      letter-spacing: 8px;
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
      font-family: Arial, sans-serif;
    }

    .content-wrapper {
      position: relative;
      z-index: 1;
    }

    /* ── HEADER / KOP ──────────────────────────── */
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }

    .header .logo-wrap {
      flex-shrink: 0;
    }

    .header .logo {
      max-width: 70px;
      max-height: 70px;
    }

    .header .clinic-info {
      flex: 1;
    }

    .header .apotek-label {
      font-size: 10px;
      font-weight: bold;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }

    .header .clinic-name {
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #000;
    }

    .header .clinic-address {
      font-size: 11px;
      color: #333;
      margin-top: 2px;
    }

    .header .clinic-contacts {
      font-size: 10.5px;
      color: #444;
      margin-top: 2px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* ── TITLE STRIP ─────────────────────────────── */
    .title-strip {
      background: #1a1a1a;
      color: #fff;
      text-align: center;
      padding: 6px 0;
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 14px;
      border-radius: 2px;
    }

    /* ── META SECTION ────────────────────────────── */
    .meta-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      gap: 20px;
    }

    .meta-left {
      flex: 1;
    }

    .meta-right {
      text-align: right;
      font-size: 11px;
      color: #444;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      margin-bottom: 3px;
    }

    .meta-label {
      color: #555;
      min-width: 110px;
    }

    .meta-sep {
      color: #555;
      flex-shrink: 0;
    }

    .meta-value {
      color: #000;
    }

    .meta-divider {
      height: 0;
      border-top: 0.5px dashed #ccc;
      margin: 5px 0;
    }

    /* ── PATIENT SECTION ─────────────────────────── */
    .patient-section {
      border: 1px solid #999;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 14px;
      background: #fafafa;
    }

    .section-title {
      font-size: 10px;
      font-weight: bold;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
      border-bottom: 0.5px solid #ddd;
      padding-bottom: 3px;
    }

    .patient-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 20px;
    }

    .patient-row {
      display: flex;
      gap: 6px;
      font-size: 11.5px;
      align-items: baseline;
    }

    .patient-label {
      color: #555;
      min-width: 80px;
      flex-shrink: 0;
      font-size: 11px;
    }

    .patient-colon { color: #555; flex-shrink: 0; }
    .patient-value { font-weight: 500; }

    .patient-row-full {
      display: flex;
      gap: 6px;
      font-size: 11.5px;
      align-items: baseline;
      grid-column: 1 / -1;
    }

    /* ── MEDICINES SECTION ───────────────────────── */
    .medicines-section {
      margin-bottom: 14px;
      border-top: 1px solid #333;
      padding-top: 8px;
    }

    .medicines-header {
      display: none;
    }

    .medicines-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }

    .medicines-table th {
      background: #f0f0f0;
      border: 0.5px solid #ccc;
      padding: 5px 8px;
      text-align: left;
      font-size: 10px;
      font-weight: bold;
      color: #444;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .medicines-table td {
      border: 0.5px solid #ddd;
      padding: 6px 8px;
      vertical-align: top;
    }

    .medicines-table tr:nth-child(even) td {
      background: #fafafa;
    }

    .med-item {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 0.5px dashed #ccc;
    }

    .med-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }

    .med-number {
      font-weight: bold;
      min-width: 18px;
      flex-shrink: 0;
      font-size: 11.5px;
    }

    .med-detail { flex: 1; }

    .med-name {
      font-weight: bold;
      font-size: 12px;
    }

    .med-form {
      font-weight: normal;
      font-style: italic;
      font-size: 11px;
    }

    .med-dose {
      font-weight: bold;
      font-size: 11px;
      color: #333;
    }

    .med-signa {
      font-size: 11px;
      color: #222;
      margin-top: 2px;
    }

    .signa-label {
      font-style: italic;
      font-weight: bold;
    }

    .med-qty {
      font-weight: bold;
      margin-left: 8px;
      color: #000;
    }

    .med-notes {
      font-size: 10.5px;
      color: #555;
      font-style: italic;
      margin-top: 2px;
    }

    .racikan-box {
      background: #f5f5f5;
      border: 0.5px solid #ddd;
      border-radius: 3px;
      padding: 4px 8px;
      margin: 3px 0;
    }

    .racikan-label {
      font-size: 9.5px;
      color: #666;
      font-style: italic;
      margin-bottom: 2px;
    }

    .racikan-line {
      font-size: 11px;
      color: #222;
      line-height: 1.6;
    }

    /* ── NOTES SECTION ───────────────────────────── */
    .notes-section {
      border: 0.8px solid #ccc;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 11.5px;
      color: #333;
    }

    /* ── SIGNATURE SECTION ───────────────────────── */
    .signature-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px solid #999;
    }

    .signature-box {
      text-align: center;
      min-width: 120px;
    }

    .signature-role {
      font-size: 11px;
      color: #555;
      margin-bottom: 2px;
    }

    .signature-space {
      height: 40px;
    }

    .signature-name {
      font-size: 12px;
      font-weight: bold;
      border-top: 1px solid #000;
      padding-top: 3px;
    }

    .signature-sipa {
      font-size: 10.5px;
      color: #555;
      margin-top: 1px;
    }

    /* ── FOOTER ───────────────────────────────────── */
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 0.5px solid #ccc;
      text-align: center;
    }

    .footer-note {
      font-size: 10.5px;
      color: #555;
      margin-bottom: 2px;
    }

    .footer-legal {
      font-size: 10px;
      color: #777;
      font-style: italic;
    }

    .footer-extra {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <!-- WATERMARK -->
  <div class="watermark">SALINAN RESEP</div>

  <div class="content-wrapper">

    <!-- KOP APOTEK -->
    <div class="header">
      ${logo ? `<div class="logo-wrap"><img src="${logo}" alt="logo" class="logo" /></div>` : ''}
      <div class="clinic-info">
        <div class="apotek-label">Apotek</div>
        <div class="clinic-name">${pharmacyName}</div>
        ${fullAddress ? `<div class="clinic-address">${fullAddress}</div>` : ''}
        <div class="clinic-contacts">
          ${pharmacyPhone ? `<span>📞 ${pharmacyPhone}</span>` : ''}
          ${pharmacyEmail ? `<span>✉ ${pharmacyEmail}</span>` : ''}
          ${pharmacyWebsite ? `<span>🌐 ${pharmacyWebsite}</span>` : ''}
        </div>
      </div>
    </div>

    <!-- TITLE STRIP -->
    <div class="title-strip">SALINAN RESEP</div>

    <!-- META -->
    <div class="meta-section">
      <div class="meta-left">
        <div class="meta-row">
          <span class="meta-label">No. Salinan Resep</span>
          <span class="meta-sep">:</span>
          <strong class="meta-value">${nomorCopyResep || '-'}</strong>
        </div>
        <div class="meta-row">
          <span class="meta-label">Tanggal</span>
          <span class="meta-sep">:</span>
          <strong class="meta-value">${formatDate(tanggal)}</strong>
        </div>
        ${(namaDokter || tanggalResep) ? `
        <div class="meta-divider"></div>
        ${namaDokter ? `
        <div class="meta-row">
          <span class="meta-label">Dari Dokter</span>
          <span class="meta-sep">:</span>
          <strong class="meta-value">${namaDokter}</strong>
        </div>` : ''}
        ${tanggalResep ? `
        <div class="meta-row">
          <span class="meta-label">Tanggal Resep</span>
          <span class="meta-sep">:</span>
          <strong class="meta-value">${formatDate(tanggalResep)}</strong>
        </div>` : ''}
        ` : ''}
      </div>
    </div>

    <!-- DATA PASIEN -->
    <div class="patient-section">
      <div class="section-title">📋 Data Pasien</div>
      <div class="patient-grid">
        <div class="patient-row">
          <span class="patient-label">Nama Pasien</span>
          <span class="patient-colon">:</span>
          <span class="patient-value">${pasien.nama || '-'}</span>
        </div>
        <div class="patient-row">
          <span class="patient-label">Umur</span>
          <span class="patient-colon">:</span>
          <span class="patient-value">${pasien.umur ? `${pasien.umur} tahun` : '-'}</span>
        </div>
        <div class="patient-row">
          <span class="patient-label">Jenis Kelamin</span>
          <span class="patient-colon">:</span>
          <span class="patient-value">${pasien.jenisKelamin === 'L' ? 'Laki-laki' : pasien.jenisKelamin === 'P' ? 'Perempuan' : '-'}</span>
        </div>
        <div class="patient-row">
          <span class="patient-label">No. Rekam Medis</span>
          <span class="patient-colon">:</span>
          <span class="patient-value">${pasien.nomorRekamMedis || '-'}</span>
        </div>
        ${pasien.alamat ? `
        <div class="patient-row-full">
          <span class="patient-label">Alamat</span>
          <span class="patient-colon">:</span>
          <span class="patient-value">${pasien.alamat}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- DAFTAR OBAT -->
    <div class="medicines-section">
      ${obat.length === 0
        ? '<div style="color:#999; font-style:italic; font-size:11px; padding:8px 0;">Tidak ada obat.</div>'
        : medicineRows
      }
    </div>

    <!-- KETERANGAN -->
    ${keterangan || catatanTambahan ? `
    <div class="notes-section">
      ${keterangan ? `<div><strong>Keterangan:</strong> ${keterangan}</div>` : ''}
      ${catatanTambahan ? `<div style="margin-top:4px;"><strong>Catatan:</strong> ${catatanTambahan}</div>` : ''}
    </div>` : ''}

    <!-- TANDA TANGAN APOTEKER -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-role">${pharmacistTitle || 'Apoteker'}</div>
        <div class="signature-space"></div>
        <div class="signature-name">${pharmacistName || 'Apoteker'}</div>
        ${pharmacistSIPA ? `<div class="signature-sipa">SIPA: ${pharmacistSIPA}</div>` : ''}
      </div>
    </div>

    <!-- FOOTER -->
    ${footerNote || footerLegal || footerExtra ? `
    <div class="footer">
      ${footerNote ? `<div class="footer-note">${footerNote}</div>` : ''}
      ${footerLegal ? `<div class="footer-legal">${footerLegal}</div>` : ''}
      ${footerExtra ? `<div class="footer-extra">${footerExtra}</div>` : ''}
    </div>` : ''}

  </div>
</body>
</html>`;
}

export function printCopyResep(copyResep, copyResepSettings) {
  const html = generateCopyResepHTML(copyResep, copyResepSettings);
  const w = window.open('', '_blank', 'width=800,height=1000,left=100,top=100');
  if (!w) {
    alert('Popup diblokir browser. Izinkan popup untuk mencetak copy resep.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    setTimeout(() => w.close(), 500);
  }, 400);
}
