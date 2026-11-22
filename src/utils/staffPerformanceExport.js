import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildStaffPerformanceTableHtml(staffMetrics = [], periodLabel = '', columns = [], mode = 'weekly') {
  const list = Array.isArray(staffMetrics) ? staffMetrics : [];
  const cols = Array.isArray(columns) ? columns : [];
  const dateText = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const modeTitle = mode === 'monthly' ? 'Monthly Period' : 'Weekly Period';
  const headerLine = `${modeTitle}: ${periodLabel || dateText}`;

  const totalColsCount = cols.length + 2;

  const colHeadersHtml = cols
    .map(
      (col) => `
      <th class="sp-col">
        <div>${escapeHtml(col.label)}</div>
        ${col.shortDate ? `<div class="sp-sub">${escapeHtml(col.shortDate)}</div>` : ''}
      </th>`
    )
    .join('');

  const columnTotals = {};
  cols.forEach((c) => {
    columnTotals[c.key] = 0;
  });
  let grandTotal = 0;

  const rowsHtml =
    list.length === 0
      ? `<tr><td colspan="${totalColsCount}" style="text-align:center;padding:18px 12px;">No staff performance records found.</td></tr>`
      : list
          .map((s) => {
            const buckets = s?.bucketCounts || {};
            const rowTotal =
              cols.length > 0
                ? cols.reduce((sum, c) => {
                    const val = Number(buckets[c.key]) || 0;
                    columnTotals[c.key] += val;
                    return sum + val;
                  }, 0)
                : Number(s?.completed) || 0;
            grandTotal += rowTotal;

            const cellsHtml = cols
              .map((c) => `<td class="sp-col">${(Number(buckets[c.key]) || 0).toLocaleString()}</td>`)
              .join('');

            return `
          <tr>
            <td class="sp-name">${escapeHtml(s?.name || 'Staff')}</td>
            ${cellsHtml}
            <td class="sp-total-col">${rowTotal.toLocaleString()}</td>
          </tr>`;
          })
          .join('');

  const totalCellsHtml = cols
    .map((c) => `<td class="sp-col">${(columnTotals[c.key] || 0).toLocaleString()}</td>`)
    .join('');

  return `
    <table class="sp-export-table ${mode === 'monthly' ? 'sp-monthly' : ''}">
      <thead>
        <tr class="sp-date-row">
          <th colspan="${totalColsCount}">${escapeHtml(headerLine)}</th>
        </tr>
        <tr class="sp-head-row">
          <th class="sp-name">Staff Name</th>
          ${colHeadersHtml}
          <th class="sp-total-col">Total Completed</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="sp-total-row">
          <td class="sp-name">Total</td>
          ${totalCellsHtml}
          <td class="sp-total-col">${grandTotal.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  `;
}

const SHARED_TABLE_CSS = `
  .sp-export-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #000000;
    background: #ffffff;
    color: #000000;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-variant-numeric: tabular-nums;
    page-break-inside: avoid;
  }
  .sp-export-table th,
  .sp-export-table td {
    border: 1px solid #000000;
    background: #ffffff;
    color: #000000;
    padding: 13px 6px;
    font-size: 11.5px;
  }
  .sp-export-table.sp-monthly th,
  .sp-export-table.sp-monthly td {
    padding: 11px 3.5px;
    font-size: 10px;
  }
  .sp-date-row th {
    text-align: left;
    font-weight: 700;
    font-size: 12px;
    padding: 10px 12px !important;
    border-bottom: 1.5px solid #000000;
  }
  .sp-head-row th {
    font-weight: 700;
    border-bottom: 1.5px solid #000000;
    text-align: center;
  }
  .sp-sub {
    font-size: 9.5px;
    font-weight: 500;
    margin-top: 2px;
  }
  .sp-name {
    text-align: left !important;
    padding-left: 12px !important;
    font-weight: 600;
    min-width: 150px;
  }
  .sp-col {
    text-align: center;
  }
  .sp-total-col {
    text-align: center;
    font-weight: 700;
    min-width: 82px;
  }
  .sp-total-row td {
    font-weight: 800;
    border-top: 1.5px solid #000000;
    border-bottom: 1.5px solid #000000;
  }
`;

export async function downloadStaffPerformancePdf(staffMetrics = [], periodLabel = '', columns = [], mode = 'weekly') {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '740px';
  container.style.background = '#ffffff';
  container.innerHTML = `<style>${SHARED_TABLE_CSS}</style>${buildStaffPerformanceTableHtml(staffMetrics, periodLabel, columns, mode)}`;
  document.body.appendChild(container);

  try {
    const tableEl = container.querySelector('.sp-export-table');
    const canvas = await html2canvas(tableEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 780,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    let imgW = availW;
    let imgH = (canvas.height * imgW) / canvas.width;
    if (imgH > availH) {
      const ratio = availH / imgH;
      imgW *= ratio;
      imgH = availH;
    }
    const x = (pageW - imgW) / 2;
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', x, margin, imgW, imgH);
    const dateStamp = new Date().toISOString().split('T')[0];
    pdf.save(`USTP_Staff_Completed_Report_${mode}_${dateStamp}.pdf`);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

export function printStaffPerformanceReport(staffMetrics = [], periodLabel = '', columns = [], mode = 'weekly') {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title></title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html {
        margin: 0;
        padding: 0;
      }
      body {
        margin: 0;
        padding: 10mm;
        background: #ffffff;
        color: #000000;
        font-family: 'Segoe UI', Arial, sans-serif;
      }
      ${SHARED_TABLE_CSS}
    </style>
  </head>
  <body>
    ${buildStaffPerformanceTableHtml(staffMetrics, periodLabel, columns, mode)}
  </body>
</html>`);
  doc.close();

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(cleanup, 1500);
    }
  }, 100);
}
