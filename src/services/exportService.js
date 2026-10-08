import Papa from 'papaparse';

const EXCEL_COLUMN_WIDTHS = {
  'Extension': 11,
  'Agent Name': 18,
  'Shift Date': 12,
  'Calls by Region': 48,
  'Total Calls': 12,
  'Connected': 12,
  'Not Connected': 14,
  'Calls / Hr': 11,
  'Half Done(s)': 12,
  'Survey(s)': 11,
  'Total Talk Time': 15,
  'First Call Time': 14,
  'Last Call Time': 14,
  'Breaks': 24,
  'Total Break Time': 16,
  'Net Active Time': 15
};

const EXCEL_TEXT_COLUMNS = new Set(['Extension', 'Agent Name', 'Shift Date', 'Calls by Region', 'Breaks']);
const EXCEL_INT_COLUMNS = new Set(['Total Calls', 'Connected', 'Not Connected', 'Half Done(s)', 'Survey(s)', 'Total Breaks']);

const EXCEL_THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'D6D6D6' } },
  bottom: { style: 'thin', color: { rgb: 'D6D6D6' } },
  left: { style: 'thin', color: { rgb: 'D6D6D6' } },
  right: { style: 'thin', color: { rgb: 'D6D6D6' } }
};

function excelHeaderStyle() {
  return {
    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '2D4F67' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '1F1F28' } },
      bottom: { style: 'thin', color: { rgb: '1F1F28' } },
      left: { style: 'thin', color: { rgb: '1F1F28' } },
      right: { style: 'thin', color: { rgb: '1F1F28' } }
    }
  };
}

function excelDataStyle(header, zebra) {
  const style = {
    font: { sz: 10, color: { rgb: '1F1F28' } },
    alignment: {
      horizontal: EXCEL_TEXT_COLUMNS.has(header) ? 'left' : 'center',
      vertical: 'center',
      wrapText: header === 'Breaks'
    },
    border: EXCEL_THIN_BORDER
  };
  if (zebra) {
    style.fill = { patternType: 'solid', fgColor: { rgb: 'F2F3F5' } };
  }
  return style;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Exports exactly what the rundown table shows: filtered rows, visible columns,
// current column order, and the active Call Stats view.
export async function exportRundownToExcel(rows, visibleColumns, connView) {
  const module = await import('xlsx-js-style');
  const XLSX = module.default && module.default.utils ? module.default : module;

  const exportRows = rows.map((row) => {
    const exportRow = {};
    if (visibleColumns.extension) exportRow['Extension'] = row.extension;
    if (visibleColumns.name) exportRow['Agent Name'] = row.name;
    if (visibleColumns.date) exportRow['Shift Date'] = row.date;
    if (visibleColumns.region) exportRow['Calls by Region'] = row.region_summary;
    if (visibleColumns.connected) {
      if (connView === 'total') {
        exportRow['Total Calls'] = row.total_calls;
      } else {
        exportRow['Connected'] = row.connected_calls;
        exportRow['Not Connected'] = row.not_connected_calls;
      }
    }
    if (visibleColumns.calls_per_hour) exportRow['Calls / Hr'] = parseFloat(row.calls_per_hour) || 0;
    if (visibleColumns.half_dones) exportRow['Half Done(s)'] = row.half_dones;
    if (visibleColumns.surveys) exportRow['Survey(s)'] = row.surveys;
    if (visibleColumns.talk_time) exportRow['Total Talk Time'] = row.total_talk_time_formatted;
    if (visibleColumns.shift_span) {
      exportRow['First Call Time'] = row.first_call;
      exportRow['Last Call Time'] = row.last_call;
    }
    if (visibleColumns.break_stamps) {
      exportRow['Breaks'] = row.breaks_list && row.breaks_list.length > 0
        ? row.breaks_list.map((brk) => `${brk.start} - ${brk.end} (${brk.duration_formatted})`).join('\n')
        : '-';
    }
    if (visibleColumns.breaks_count) exportRow['Total Breaks'] = row.breaks_count;
    if (visibleColumns.total_break_time) {
      exportRow['Total Break Time'] = row.total_break_formatted;
    }
    if (visibleColumns.net_active) exportRow['Net Active Time'] = row.net_active_formatted;
    return exportRow;
  });

  if (exportRows.length === 0) return;

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const range = XLSX.utils.decode_range(ws['!ref']);

  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell ? cell.v : '');
  }

  ws['!cols'] = headers.map((header) => ({ wch: EXCEL_COLUMN_WIDTHS[header] || 14 }));
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 24 };
  // Grow data row heights so stacked break stamps stay fully visible
  const breaksCol = headers.indexOf('Breaks');
  for (let r = 1; r <= range.e.r; r++) {
    const breaksCell = breaksCol >= 0 ? ws[XLSX.utils.encode_cell({ r, c: breaksCol })] : null;
    const lines = breaksCell && typeof breaksCell.v === 'string' && breaksCell.v.includes('\n')
      ? breaksCell.v.split('\n').length
      : 1;
    ws['!rows'][r] = { hpt: Math.max(18, lines * 14 + 4) };
  }

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const header = headers[c];
      if (r === 0) {
        cell.s = excelHeaderStyle();
      } else {
        cell.s = excelDataStyle(header, r % 2 === 0);
        if (cell.t === 'n' && EXCEL_INT_COLUMNS.has(header)) cell.z = '0';
        if (cell.t === 'n' && header === 'Calls / Hr') cell.z = '0.0';
        if (header === 'Half Done(s)' && Number(cell.v) > 0) {
          cell.s = { ...cell.s, fill: { patternType: 'solid', fgColor: { rgb: 'FFF3B0' } } };
        } else if (header === 'Survey(s)' && Number(cell.v) > 0) {
          cell.s = { ...cell.s, fill: { patternType: 'solid', fgColor: { rgb: 'C6EFCE' } } };
        }
      }
    }
  }

  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: range.s.c }, e: { r: range.e.r, c: range.e.c } })
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rundown Report");
  XLSX.writeFile(wb, "CATI_Rundown_Report.xlsx");
}

export function exportRundownToCSV(parsedAnalysis, extNameMap) {
  const exportRows = [];

  Object.keys(parsedAnalysis).sort().forEach(ext => {
    const name = extNameMap[ext] || '-';
    Object.keys(parsedAnalysis[ext]).sort().forEach(dateStr => {
      const data = parsedAnalysis[ext][dateStr];
      exportRows.push({
        Extension: ext,
        Name: name,
        Date: dateStr,
        Connected: data.connected_calls,
        NotConnected: data.not_connected_calls,
        CallsPerHour: data.calls_per_hour,
        HalfDones: data.half_dones,
        Surveys: data.surveys,
        TalkTime: data.total_talk_time_formatted,
        BreaksCount: data.breaks_count,
        NetActiveTime: data.net_active_formatted
      });
    });
  });

  const csv = Papa.unparse(exportRows);
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'CATI_Rundown_Report.csv');
}

export function exportAnalysisToJSON(parsedAnalysis) {
  saveBlob(new Blob([JSON.stringify(parsedAnalysis, null, 2)], { type: 'application/json' }), 'rundown_report.json');
}
