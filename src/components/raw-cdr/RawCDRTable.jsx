import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useCdr } from '../../context/CdrContext';
import { createShiftDateResolver } from '../../services/shiftCalculator';
import { inDateRange, rangeDates } from '../../utils/dateRange';
import Pagination from '../common/Pagination';
import DayScopeSelect from '../ui/DayScopeSelect';
import SearchInput from '../ui/SearchInput';
import ExtensionFilter from '../ui/ExtensionFilter';
import Segmented from '../ui/Segmented';
import SortHeaderCell from '../ui/SortHeaderCell';
import EmptyState from '../ui/EmptyState';
import Chip from '../ui/Chip';

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

const collator = new Intl.Collator(undefined, { numeric: true });

const RESPONSES = [
  { id: 'ALL', label: 'All' },
  { id: 'ANSWERED', label: 'Answered' },
  { id: 'NOT_ANSWERED', label: 'Not answered' }
];

export default function RawCDRTable() {
  const { rawCalls, shiftConfig, dateRange, analysis, extNameMap } = useCdr();

  const [search, setSearch] = useState('');
  const [selectedExts, setSelectedExts] = useState([]);
  const [response, setResponse] = useState('ALL');
  const [dayScope, setDayScope] = useState('');
  const [sortField, setSortField] = useState('start_time');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const resolveShiftDate = useMemo(() => createShiftDateResolver(shiftConfig), [shiftConfig]);
  const dateSet = useMemo(() => new Set(rangeDates(dateRange, analysis)), [dateRange, analysis]);

  // Every extension the loaded file actually contains, so the badge denominator is
  // the population in front of you rather than the whole directory. Deliberately not
  // date-scoped: narrowing the range must not silently drop an agent you picked.
  const extensions = useMemo(
    () => [...new Set(rawCalls.map((c) => c.extension))].sort(collator.compare),
    [rawCalls]
  );
  useEffect(() => {
    setSelectedExts(extensions);
    setCurrentPage(1);
  }, [extensions]);

  // A call's shift is not its calendar day: a 01:00 call belongs to the shift that
  // opened the evening before. Everything below — the filter, the bands, the counts —
  // speaks that same shift date.
  const shiftOf = useCallback((call) => resolveShiftDate(call.start_time), [resolveShiftDate]);

  const allRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    const picked = new Set(selectedExts);
    return rawCalls.filter((call) => {
      if (!inDateRange(shiftOf(call), dateRange, dateSet)) return false;
      if (!picked.has(call.extension)) return false;
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
  }, [rawCalls, search, selectedExts, response, shiftOf, dateRange, dateSet]);

  const shiftDays = useMemo(() => {
    const counts = new Map();
    allRows.forEach((call) => {
      const day = shiftOf(call);
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return Array.from(counts, ([date, calls]) => ({
      date,
      hint: `${calls} ${calls === 1 ? 'call' : 'calls'}`
    })).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [allRows, shiftOf]);

  // A day that left the range stops scoping the list without the control lying about
  // what was picked.
  const scope = shiftDays.some((d) => d.date === dayScope) ? dayScope : '';
  const grouped = !scope && shiftDays.length > 1;

  const filtered = useMemo(() => {
    const rows = allRows.filter((call) => !scope || shiftOf(call) === scope);
    const col = COLUMNS.find((c) => c.id === sortField);
    if (!col?.value) return rows;
    const dir = sortAsc ? 1 : -1;
    rows.sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    // Stable sort again: the chosen column orders the calls, the shift date orders
    // the blocks they sit in.
    if (grouped) rows.sort((a, b) => (shiftOf(a) < shiftOf(b) ? -1 : shiftOf(a) > shiftOf(b) ? 1 : 0));
    return rows;
  }, [allRows, sortField, sortAsc, scope, grouped, shiftOf]);

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

        <ExtensionFilter
          extensions={extensions}
          names={extNameMap}
          selected={selectedExts}
          onChange={(exts) => {
            setSelectedExts(exts);
            setCurrentPage(1);
          }}
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

        <div className="ml-auto flex items-center gap-1.5">
          <Chip tone="throughput">{rawCalls.length} calls</Chip>
          <Chip tone="success">{answered} answered</Chip>
        </div>
      </div>

      <DayScopeSelect
        days={shiftDays}
        value={scope}
        onChange={(day) => {
          setDayScope(day);
          setCurrentPage(1);
        }}
      />

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
                pageRows.map((call, idx) => {
                  const day = shiftOf(call);
                  const firstOfDay = idx === 0 || shiftOf(pageRows[idx - 1]) !== day;
                  return (
                    <Fragment key={`${call.extension}_${call.start_time.getTime()}_${idx}`}>
                      {grouped && firstOfDay && (
                        <tr>
                          <td colSpan={COLUMNS.length} className="bg-k-sunken/70 px-3 py-1.5">
                            <span className="num text-[10px] font-semibold uppercase tracking-wider text-k-ink-muted">
                              {day}
                            </span>
                            <span className="num ml-2 text-[10px] text-k-ink-faint">
                              {` · ${shiftDays.find((d) => d.date === day)?.hint || ''}`}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="glow-row h-[34px]">
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
                                    : 'text-k-talk'
                            }`}
                          >
                            {col.cell(call)}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })
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
