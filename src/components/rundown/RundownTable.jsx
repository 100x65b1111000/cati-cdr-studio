import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCdr } from '../../context/CdrContext';
import { rangeDates } from '../../utils/dateRange';
import { loadFromStorage, saveToStorage } from '../../utils/storage';
import Pagination from '../common/Pagination';
import EmptyState from '../ui/EmptyState';
import SkeletonRows from '../ui/SkeletonRows';
import SortHeaderCell from '../ui/SortHeaderCell';
import RundownToolbar from './RundownToolbar';
import { COLUMNS, COLUMN_BY_ID, defaultVisibleColumns } from './columns';

const collator = new Intl.Collator(undefined, { numeric: true });
const numeric = (a, b) => collator.compare(a, b);

// Auto layout splits leftover width across every column, so short numbers end up
// with huge gutters. Pin each column to its content and let one eat the slack.
const FLEX_COLUMN = 'break_stamps';
const colWidth = (id) => (id === FLEX_COLUMN ? 'w-full' : 'w-1');

function mergeVisibleColumns(saved) {
  const base = defaultVisibleColumns();
  if (!saved) return base;
  Object.keys(base).forEach((id) => {
    if (typeof saved[id] === 'boolean') base[id] = saved[id];
  });
  return base;
}

export default function RundownTable({ preview = false }) {
  const {
    analysis,
    dateRange,
    setDateRange,
    extNameMap,
    updateManualOverride,
    setSelectedAgentDetail,
    isParsing
  } = useCdr();

  const restoredRef = useRef(loadFromStorage('view_state', null));
  const [searchQuery, setSearchQuery] = useState(() => restoredRef.current?.search || '');
  const [visibleColumns, setVisibleColumns] = useState(() => mergeVisibleColumns(restoredRef.current?.visibleColumns));
  const [connView, setConnView] = useState(() => (restoredRef.current?.connView === 'split' ? 'split' : 'total'));
  const [sortField, setSortField] = useState(() => {
    const saved = restoredRef.current?.sort?.field;
    return COLUMN_BY_ID[saved] ? saved : 'extension';
  });
  const [sortAsc, setSortAsc] = useState(() => restoredRef.current?.sort?.asc !== false);
  const [pageSize, setPageSize] = useState(() => restoredRef.current?.pageSize || 25);
  const [selectedExtensions, setSelectedExtensions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const datasetKey = useMemo(() => Object.keys(analysis).sort(numeric).join(','), [analysis]);

  const dateSet = useMemo(() => new Set(rangeDates(dateRange, analysis)), [dateRange, analysis]);

  const extensionsInRange = useMemo(() => {
    const list = [];
    Object.keys(analysis).forEach((ext) => {
      if (Object.keys(analysis[ext]).some((d) => dateSet.has(d))) list.push(ext);
    });
    return list.sort(numeric);
  }, [analysis, dateSet]);

  // A genuinely new dataset selects every agent again. Restoring a saved subset
  // happens once, after the first dataset is known.
  const restoredSelectionRef = useRef(false);
  useEffect(() => {
    setSelectedExtensions(extensionsInRange);
    setCurrentPage(1);
  }, [datasetKey]);

  useEffect(() => {
    if (restoredSelectionRef.current || extensionsInRange.length === 0) return;
    restoredSelectionRef.current = true;
    const saved = restoredRef.current?.extensions;
    if (!Array.isArray(saved)) return;
    const valid = saved.filter((e) => extensionsInRange.includes(e));
    if (valid.length > 0) setSelectedExtensions(valid);
  }, [extensionsInRange]);

  const rows = useMemo(() => {
    const selected = new Set(selectedExtensions);
    const q = searchQuery.toLowerCase().trim();
    const out = [];

    Object.keys(analysis).forEach((ext) => {
      if (!selected.has(ext)) return;
      const name = extNameMap[ext] || '-';
      Object.keys(analysis[ext]).forEach((dateStr) => {
        if (!dateSet.has(dateStr)) return;
        const item = analysis[ext][dateStr];
        if (q) {
          const hit =
            ext.toLowerCase().includes(q) ||
            name.toLowerCase().includes(q) ||
            (item.region_summary || '').toLowerCase().includes(q);
          if (!hit) return;
        }
        out.push(item);
      });
    });

    const col = COLUMN_BY_ID[sortField];
    if (col?.value) {
      const dir = sortAsc ? 1 : -1;
      out.sort((a, b) => {
        const av = col.value(a);
        const bv = col.value(b);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return out;
  }, [analysis, extNameMap, selectedExtensions, searchQuery, dateSet, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const pageRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize]
  );

  const filters = useMemo(
    () => ({
      dateRange,
      search: searchQuery,
      extensions: selectedExtensions,
      visibleColumns,
      connView,
      sort: { field: sortField, asc: sortAsc },
      pageSize
    }),
    [dateRange, searchQuery, selectedExtensions, visibleColumns, connView, sortField, sortAsc, pageSize]
  );

  // The sidebar preview mounts a second copy of this view. Only the real one
  // gets to own the saved state, or the preview's fresh selection would overwrite
  // the agent subset the user restored.
  useEffect(() => {
    if (preview) return;
    const id = setTimeout(() => saveToStorage('view_state', filters), 400);
    return () => clearTimeout(id);
  }, [filters, preview]);

  const applyFilters = (saved) => {
    if (!saved) return;
    if (saved.dateRange) setDateRange(saved.dateRange);
    setSearchQuery(saved.search || '');
    setSelectedExtensions((saved.extensions || []).filter((e) => extensionsInRange.includes(e)));
    setVisibleColumns(mergeVisibleColumns(saved.visibleColumns));
    setConnView(saved.connView === 'split' ? 'split' : 'total');
    if (COLUMN_BY_ID[saved.sort?.field]) {
      setSortField(saved.sort.field);
      setSortAsc(saved.sort.asc !== false);
    }
    setPageSize(saved.pageSize || 25);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (field === sortField) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const openDetail = (row) => setSelectedAgentDetail({ ext: row.extension, dateStr: row.date });
  const setOverride = (ext, date, field, value) => updateManualOverride(ext, date, field, value);
  const shownColumns = COLUMNS.filter((c) => visibleColumns[c.id]);
  const ctx = { connView, setOverride, openDetail };

  const noData = Object.keys(analysis).length === 0;

  return (
    <div className="space-y-4">
      <RundownToolbar
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        selectedExtensions={selectedExtensions}
        setSelectedExtensions={(exts) => {
          setSelectedExtensions(exts);
          setCurrentPage(1);
        }}
        availableExtensions={extensionsInRange}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        connView={connView}
        setConnView={setConnView}
        filters={filters}
        onApplyFilters={applyFilters}
        rows={rows}
      />

      <div className="panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-k-ink-muted">
            <thead className="sticky top-0 z-[25] border-b border-k-hairline glass-head text-[10px] uppercase tracking-wider">
              <tr>
                {shownColumns.map((col) =>
                  col.value ? (
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
                  ) : (
                    <th
                      key={col.id}
                      scope="col"
                      className={`px-3 py-3.5 text-[10px] font-semibold uppercase tracking-wider text-k-ink-muted ${colWidth(
                        col.id
                      )} ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-k-hairline/60">
              {isParsing ? (
                <SkeletonRows cols={shownColumns.length || 1} />
              ) : shownColumns.length === 0 ? (
                <tr>
                  <td colSpan={1}>
                    <EmptyState
                      title="Every column is hidden"
                      body="Turn fields back on in the Columns menu, or reset to the default set."
                      action={
                        <button
                          type="button"
                          onClick={() => setVisibleColumns(defaultVisibleColumns())}
                          className="rounded-lg bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
                        >
                          Show default columns
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={shownColumns.length}>
                    <EmptyState
                      title={noData ? 'No calls loaded' : 'Nothing matches these filters'}
                      body={
                        noData
                          ? 'Load the sample data or drop a CDR CSV to build the rundown.'
                          : 'Widen the date range, clear the search, or select more agents in the toolbar.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={`${row.extension}_${row.date}`}
                    onClick={(e) => {
                      if (e.target.closest('input, button, a')) return;
                      openDetail(row);
                    }}
                    className="h-[38px] cursor-default transition-colors hover:bg-k-surface-hover/40"
                  >
                    {shownColumns.map((col) => (
                      <td
                        key={col.id}
                        className={`whitespace-nowrap px-3 align-middle ${colWidth(col.id)} ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {col.cell(row, ctx)}
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
          totalItems={rows.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
    </div>
  );
}
