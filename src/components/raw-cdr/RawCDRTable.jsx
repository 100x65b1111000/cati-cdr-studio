import React, { useEffect, useMemo, useState } from 'react';
import { useCdr } from '../../context/CdrContext';
import { createShiftDateResolver } from '../../services/shiftCalculator';
import { inDateRange, rangeDates } from '../../utils/dateRange';
import Pagination from '../common/Pagination';
import SearchInput from '../ui/SearchInput';
import Segmented from '../ui/Segmented';
import SortHeaderCell from '../ui/SortHeaderCell';
import EmptyState from '../ui/EmptyState';

const COLUMNS = [
  { id: 'start_time', label: 'Call start', align: 'left', value: (c) => c.start_time.getTime(), cell: (c) => c.start_time.toISOString().replace('T', ' ').slice(0, 19) },
  { id: 'extension', label: 'Ext', align: 'left', value: (c) => c.extension, cell: (c) => c.extension },
  { id: 'destination', label: 'Destination', align: 'left', cell: (c) => c.raw?.DESTINATION || c.raw?.CLID || '-' },
  { id: 'direction', label: 'Dir', align: 'left', value: (c) => c.direction, cell: (c) => c.direction },
  { id: 'response', label: 'Response', align: 'left', value: (c) => c.response, cell: (c) => (
    <span
      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
        c.response === 'ANSWERED' ? 'bg-k-success/10 text-k-success' : 'bg-k-danger/10 text-k-danger'
      }`}
    >
      {c.response}
    </span>
  ) },
  { id: 'duration', label: 'Duration', align: 'right', value: (c) => c.duration, cell: (c) => `${c.duration}s` },
  { id: 'region', label: 'Region', align: 'left', value: (c) => (c.region || '').toLowerCase(), cell: (c) => c.region || '-' }
];

// Auto layout splits leftover width across every column, so short values end up
// with huge gutters. Pin each column to its content and let one eat the slack.
const FLEX_COLUMN = 'destination';
const colWidth = (id) => (id === FLEX_COLUMN ? 'w-full' : 'w-1');

const RESPONSES = [
  { id: 'ALL', label: 'All' },
  { id: 'ANSWERED', label: 'Answered' },
  { id: 'NOT_ANSWERED', label: 'Not answered' }
];

export default function RawCDRTable() {
  const { rawCalls, shiftConfig, dateRange, analysis } = useCdr();

  const [search, setSearch] = useState('');
  const [response, setResponse] = useState('ALL');
  const [sortField, setSortField] = useState('start_time');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const resolveShiftDate = useMemo(() => createShiftDateResolver(shiftConfig), [shiftConfig]);
  const dateSet = useMemo(() => new Set(rangeDates(dateRange, analysis)), [dateRange, analysis]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = rawCalls.filter((call) => {
      if (!inDateRange(resolveShiftDate(call.start_time), dateRange, dateSet)) return false;
      if (response === 'ANSWERED' && call.response !== 'ANSWERED') return false;
      if (response === 'NOT_ANSWERED' && call.response === 'ANSWERED') return false;
      if (!q) return true;
      return (
        (call.extension || '').toLowerCase().includes(q) ||
        (call.raw?.DESTINATION || '').toLowerCase().includes(q) ||
        (call.raw?.CLID || '').toLowerCase().includes(q) ||
        (call.region || '').toLowerCase().includes(q)
      );
    });

    const col = COLUMNS.find((c) => c.id === sortField);
    if (!col?.value) return rows;
    const dir = sortAsc ? 1 : -1;
    return rows.sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rawCalls, search, response, sortField, sortAsc, resolveShiftDate, dateRange, dateSet]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field) => {
    if (field === sortField) setSortAsc((v) => !v);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const answered = filtered.filter((c) => c.response === 'ANSWERED').length;

  return (
    <div className="space-y-4">
      <div className="no-print panel relative z-30 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5">
        <SearchInput
          value={search}
          onChange={(q) => {
            setSearch(q);
            setCurrentPage(1);
          }}
          label="Extension, number or region"
          placeholder="Extension, number or region"
          className="w-64 flex-none"
        />

        <Segmented
          label="Response filter"
          options={RESPONSES}
          value={response}
          onChange={(id) => {
            setResponse(id);
            setCurrentPage(1);
          }}
        />

        <p className="num ml-auto text-[11px] text-k-ink-muted">
          {filtered.length} of {rawCalls.length} calls
          <span className="text-k-ink-muted"> · {answered} answered</span>
        </p>
      </div>

      <div className="panel overflow-hidden rounded-xl">
        <div className="max-h-[70vh] overflow-auto print:max-h-none">
          <table className="w-full text-left text-xs text-k-ink-muted">
            <thead className="sticky top-0 z-[25] border-b border-k-hairline glass-head text-[10px] uppercase tracking-wider">
              <tr>
                {COLUMNS.map((col) => (
                  <SortHeaderCell
                    key={col.id}
                    label={col.label}
                    field={col.id}
                    sortField={sortField}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                    align={col.align}
                    className={colWidth(col.id)}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-k-hairline/60">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      title={rawCalls.length === 0 ? 'No calls loaded' : 'No call matches'}
                      body={
                        rawCalls.length === 0
                          ? 'Load the sample data or drop a CDR CSV first.'
                          : 'Clear the search, widen the response filter, or extend the date range.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((call, idx) => (
                  <tr
                    key={`${call.extension}_${call.start_time.getTime()}_${idx}`}
                    className="h-[34px] transition-colors hover:bg-k-surface-hover/40"
                  >
                    {COLUMNS.map((col) => (
                      <td
                        key={col.id}
                        className={`num whitespace-nowrap px-3 align-middle ${colWidth(col.id)} ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        } ${
                          col.id === 'extension'
                            ? 'font-semibold text-k-accent'
                            : col.id === 'duration'
                              ? 'text-k-throughput'
                              : col.id === 'start_time' || col.id === 'region' || col.id === 'direction' || col.id === 'response'
                                ? 'text-k-ink-muted'
                                : 'text-k-ink'
                        }`}
                      >
                        {col.cell(call)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[25, 50, 100, 200]}
        />
      </div>
    </div>
  );
}
