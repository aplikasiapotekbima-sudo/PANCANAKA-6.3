/**
 * Prescription Print Utilities
 * Handles print logic for e-prescription module
 * Paper target: 10.5cm x 16.5cm
 */

export function generatePrescriptionHTML(prescription, printSettings) {
  const {
    clinicName = 'Klinik / Apotek',
    clinicAddress = '',
    clinicPhone = '',
    doctorName = '',
    doctorSIP = '',
    logo = '',
    footer = '',
    fontSize = 11,
    marginTop = 8,
    marginRight = 8,
    marginBottom = 8,
    marginLeft = 8,
  } = printSettings || {};

  const { 
    prescriptionNumber, 
    date, 
    patientName, 
    patientAge, 
    patientGender,
    patientWeight,
    diagnosis,
    allergies,
    doctorNotes,
    medicines = [],
    selectedDoctor,
  } = prescription;

  const doctorDisplay = selectedDoctor?.name || doctorName;
  const sipDisplay = selectedDoctor?.sip || doctorSIP;

  const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', { 
    day: '2-digit', month: 'long', year: 'numeric' 
  });

  const medicineRows = medicines.map((med, i) => `
    <div class="med-item">
      <div class="med-number">R/</div>
      <div class="med-detail">
        ${med.text
          ? `<pre class="med-freestyle">${med.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
          : `<div class="med-name">${med.name || ''}${med.strength ? ` ${med.strength}` : ''}</div>
        <div class="med-signa">
          <span class="signa-label">S.</span> ${med.signa || '-'}
          ${med.quantity ? `<span class="med-qty">#${med.quantity}</span>` : ''}
        </div>
        ${med.notes ? `<div class="med-notes">${med.notes}</div>` : ''}`
        }
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Resep ${prescriptionNumber || ''}</title>
  <style>
    /* ── RESET & BASE ─────────────────────────────── */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 10.5cm;
      font-family: 'Times New Roman', Times, serif;
      font-size: ${fontSize}px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }

    body {
      padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
    }

    /* ── PRINT MEDIA ─────────────────────────────── */
    @page {
      size: 10.5cm 16.5cm;
      margin: 0;
    }

    @media print {
      html, body {
        width: 10.5cm;
        height: 16.5cm;
      }
    }

    /* ── HEADER / KOP ──────────────────────────── */
    .header {
      text-align: center;
      border-bottom: 1.5px solid #000;
      padding-bottom: 5px;
      margin-bottom: 5px;
    }

    .header .logo {
      max-width: 55px;
      max-height: 40px;
      display: block;
      margin: 0 auto 3px;
    }

    .header .clinic-name {
      font-size: ${Math.round(fontSize * 1.3)}px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .header .clinic-address {
      font-size: ${Math.round(fontSize * 0.9)}px;
      color: #333;
      margin-top: 1px;
    }

    .header .clinic-phone {
      font-size: ${Math.round(fontSize * 0.9)}px;
      color: #333;
    }

    .header .doctor-name {
      font-size: ${Math.round(fontSize * 1.05)}px;
      font-weight: bold;
      margin-top: 3px;
    }

    .header .doctor-sip {
      font-size: ${Math.round(fontSize * 0.85)}px;
      color: #444;
    }

    /* ── RX MARK ──────────────────────────────── */
    .rx-section {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 5px 0;
    }

    .rx-mark {
      font-size: ${Math.round(fontSize * 2)}px;
      font-style: italic;
      font-weight: bold;
      line-height: 1;
      margin-top: 1px;
    }

    .rx-info {
      flex: 1;
    }

    .rx-info .info-row {
      display: flex;
      gap: 4px;
      margin-bottom: 2px;
      font-size: ${Math.round(fontSize * 0.9)}px;
    }

    .rx-info .info-label {
      color: #555;
      min-width: 40px;
    }

    .rx-info .info-value {
      font-weight: 500;
    }

    .rx-date {
      font-size: ${Math.round(fontSize * 0.9)}px;
      text-align: right;
      color: #444;
    }

    /* ── PATIENT INFO ─────────────────────────── */
    .patient-section {
      border: 0.8px solid #999;
      border-radius: 3px;
      padding: 4px 6px;
      margin-bottom: 6px;
      background: #fafafa;
    }

    .patient-row {
      display: flex;
      gap: 6px;
      margin-bottom: 2px;
      font-size: ${Math.round(fontSize * 0.9)}px;
    }

    .patient-label {
      color: #555;
      min-width: 85px;
      flex-shrink: 0;
    }

    .patient-colon { color: #555; }

    .patient-value { font-weight: 500; }

    /* ── DIAGNOSIS ────────────────────────────── */
    .diagnosis-row {
      font-size: ${Math.round(fontSize * 0.9)}px;
      margin-bottom: 4px;
      padding: 3px 6px;
      background: #f5f5f5;
      border-left: 2px solid #333;
    }

    /* ── MEDICINES ────────────────────────────── */
    .medicines-section {
      min-height: 50px;
      margin-bottom: 6px;
    }

    .med-item {
      display: flex;
      gap: 4px;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 0.5px dashed #ccc;
    }

    .med-item:last-child {
      border-bottom: none;
    }

    .med-number {
      font-weight: bold;
      min-width: 18px;
      flex-shrink: 0;
      font-size: ${Math.round(fontSize * 0.95)}px;
    }

    .med-detail { flex: 1; }

    .med-name {
      font-weight: bold;
      font-size: ${Math.round(fontSize * 1.0)}px;
    }

    .med-signa {
      font-size: ${Math.round(fontSize * 0.9)}px;
      color: #222;
      margin-top: 1px;
    }

    .signa-label {
      font-style: italic;
      font-weight: bold;
    }

    .med-qty {
      font-weight: bold;
      margin-left: 6px;
      color: #000;
    }

    .med-notes {
      font-size: ${Math.round(fontSize * 0.82)}px;
      color: #555;
      font-style: italic;
      margin-top: 1px;
    }

    .med-freestyle {
      margin: 0;
      font-family: inherit;
      font-size: ${Math.round(fontSize * 0.95)}px;
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-word;
      color: #111;
    }

    /* ── DOCTOR NOTES ─────────────────────────── */
    .doctor-notes {
      font-size: ${Math.round(fontSize * 0.9)}px;
      border-top: 0.5px dashed #999;
      padding-top: 4px;
      margin-top: 4px;
      color: #333;
      font-style: italic;
    }

    /* ── ALLERGIES ────────────────────────────── */
    .allergies {
      font-size: ${Math.round(fontSize * 0.88)}px;
      color: #c00;
      margin-bottom: 4px;
    }

    /* ── SIGNATURE AREA ───────────────────────── */
    .signature-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      border-top: 0.8px solid #999;
      padding-top: 5px;
    }

    .signature-box {
      text-align: center;
      min-width: 80px;
    }

    .signature-space {
      height: 28px;
    }

    .signature-name {
      font-size: ${Math.round(fontSize * 0.88)}px;
      font-weight: bold;
      border-top: 0.8px solid #000;
      padding-top: 2px;
    }

    .signature-sip {
      font-size: ${Math.round(fontSize * 0.8)}px;
      color: #555;
    }

    /* ── FOOTER ───────────────────────────────── */
    .footer {
      text-align: center;
      margin-top: 5px;
      font-size: ${Math.round(fontSize * 0.82)}px;
      color: #666;
      border-top: 0.5px solid #ccc;
      padding-top: 3px;
    }

    /* ── PRESCRIPTION NUMBER ──────────────────── */
    .prescription-number {
      font-size: ${Math.round(fontSize * 0.82)}px;
      color: #888;
      text-align: right;
      margin-bottom: 3px;
    }
  </style>
</head>
<body>
  <!-- KOP RESEP -->
  <div class="header">
    ${logo ? `<img src="${logo}" alt="logo" class="logo" />` : ''}
    <div class="clinic-name">${clinicName}</div>
    ${clinicAddress ? `<div class="clinic-address">${clinicAddress}</div>` : ''}
    ${clinicPhone ? `<div class="clinic-phone">Telp: ${clinicPhone}</div>` : ''}
    ${doctorDisplay ? `<div class="doctor-name">${doctorDisplay}</div>` : ''}
    ${sipDisplay ? `<div class="doctor-sip">SIP: ${sipDisplay}</div>` : ''}
  </div>

  <!-- NO RESEP + TANGGAL -->
  ${prescriptionNumber ? `<div class="prescription-number">No. Resep: ${prescriptionNumber}</div>` : ''}
  <div style="display:flex; justify-content:flex-end; font-size:${Math.round(fontSize * 0.9)}px; margin-bottom:4px;">
    ${date ? formatDate(date) : ''}
  </div>

  <!-- DATA PASIEN -->
  <div class="patient-section">
    <div class="patient-row">
      <span class="patient-label">Nama</span>
      <span class="patient-colon">:</span>
      <span class="patient-value">${patientName || '-'}</span>
    </div>
    <div style="display:flex; gap:12px;">
      <div class="patient-row" style="flex:1">
        <span class="patient-label">Umur</span>
        <span class="patient-colon">:</span>
        <span class="patient-value">${patientAge ? `${patientAge} thn` : '-'}</span>
      </div>
      ${patientWeight ? `
      <div class="patient-row" style="flex:1">
        <span class="patient-label">BB</span>
        <span class="patient-colon">:</span>
        <span class="patient-value">${patientWeight} kg</span>
      </div>` : ''}
    </div>
    <div class="patient-row">
      <span class="patient-label">Jenis Kelamin</span>
      <span class="patient-colon">:</span>
      <span class="patient-value">${patientGender === 'L' ? 'Laki-laki' : patientGender === 'P' ? 'Perempuan' : '-'}</span>
    </div>
    ${allergies ? `
    <div class="patient-row" style="color:#c00">
      <span class="patient-label">Alergi</span>
      <span class="patient-colon">:</span>
      <span class="patient-value">${allergies}</span>
    </div>` : ''}
  </div>

  <!-- DIAGNOSIS -->
  ${diagnosis ? `
  <div class="diagnosis-row">
    <strong>Dx:</strong> ${diagnosis}
  </div>` : ''}

  <!-- DAFTAR OBAT -->
  <div class="medicines-section">
    ${medicineRows || '<div style="color:#999; font-style:italic; font-size:10px; padding: 4px 0;">Belum ada obat ditambahkan.</div>'}
  </div>

  <!-- CATATAN DOKTER -->
  ${doctorNotes ? `
  <div class="doctor-notes">
    <strong>Catatan:</strong> ${doctorNotes}
  </div>` : ''}

  <!-- TANDA TANGAN -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-space"></div>
      <div class="signature-name">${doctorDisplay || 'Dokter'}</div>
      ${sipDisplay ? `<div class="signature-sip">SIP: ${sipDisplay}</div>` : ''}
    </div>
  </div>

  <!-- FOOTER -->
  ${footer ? `<div class="footer">${footer}</div>` : ''}
</body>
</html>`;
}

export function printPrescription(prescription, printSettings) {
  const html = generatePrescriptionHTML(prescription, printSettings);
  const w = window.open('', '_blank', 'width=420,height=620,left=100,top=100');
  if (!w) {
    alert('Popup diblokir browser. Izinkan popup untuk mencetak resep.');
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
