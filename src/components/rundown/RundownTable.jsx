import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useCdr } from '../../context/CdrContext';
import { rangeDates } from '../../utils/dateRange';
import { loadFromStorage } from '../../utils/storage';
import { mergeOrder } from '../../utils/columnOrder';
import useDebouncedSave from '../../hooks/useDebouncedSave';
import DayScopeSelect from '../ui/DayScopeSelect';
import Pagination from '../common/Pagination';
import EmptyState from '../ui/EmptyState';
import SkeletonRows from '../ui/SkeletonRows';
import SortHeaderCell from '../ui/SortHeaderCell';
import RundownToolbar from './RundownToolbar';
import { COLUMNS, COLUMN_BY_ID, defaultVisibleColumns } from './columns';

const collator = new Intl.Collator(undefined, { numeric: true });
const numeric = (a, b) => collator.compare(a, b);

const COLUMN_IDS = COLUMNS.map((c) => c.id);

// `navigator.clipboard` exists only in a secure context, and the team browses this app
// over plain http on the LAN, where it is undefined. The textarea path is the old
// execCommand route, which still needs the click that got us here.
function copyText(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.cssText = 'position:fixed;opacity:0';
    document.body.append(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    if (ok) resolve();
    else reject(new Error('copy refused'));
  });
}

// Auto layout splits leftover width across every column, so short numbers end up
// with huge gutters. Pin each column to its content and let one eat the slack.
const FLEX_COLUMN = 'break_stamps';
const colWidth = (id) => (id === FLEX_COLUMN ? 'w-full' : 'w-1');

function mergeVisibleColumns(saved) {
  const base = defaultVisibleColumns();
  if (!saved) return base;
  Object.keys(base).forEach((id) => {
    // Locked columns ignore whatever an old view_state or saved view stored.
    if (COLUMN_BY_ID[id]?.locked) return;
    if (typeof saved[id] === 'boolean') base[id] = saved[id];
  });
  return base;
}

const agentCount = (n) => `${n} ${n === 1 ? 'agent' : 'agents'}`;

export default function RundownTable() {
  const {
    analysis,
    dateRange,
    setDateRange,
    extNameMap,
    updateManualOverride,
    setSelectedAgentDetail,
    addToast,
    isParsing,
    slide
  } = useCdr();

  const restoredRef = useRef(loadFromStorage('view_state', null));
  const [searchQuery, setSearchQuery] = useState(() => restoredRef.current?.search || '');
  const [visibleColumns, setVisibleColumns] = useState(() => mergeVisibleColumns(restoredRef.current?.visibleColumns));
  const [order, setOrder] = useState(() => mergeOrder(restoredRef.current?.order, COLUMN_IDS));
  // Which column is currently in flight. Kept here rather than in the header so the
  // body cells can tint the same column: a highlight over the handle alone reads as a
  // hover, not as "this whole column moves".
  const [dragCol, setDragCol] = useState(null);
  const [connView, setConnView] = useState(() => (restoredRef.current?.connView === 'split' ? 'split' : 'total'));
  const [sortField, setSortField] = useState(() => {
    const saved = restoredRef.current?.sort?.field;
    return COLUMN_BY_ID[saved] ? saved : 'extension';
  });
  const [sortAsc, setSortAsc] = useState(() => restoredRef.current?.sort?.asc !== false);
  const [pageSize, setPageSize] = useState(() => restoredRef.current?.pageSize || 25);
  const [selectedExtensions, setSelectedExtensions] = useState([]);
  const [dayScope, setDayScope] = useState(() => restoredRef.current?.dayScope || '');
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

  // The table is already one row per agent per shift; what a multi-day range lacked
  // is any way to tell the shifts apart. This list is the source for both fixes — the
  // day scope control and the bands that split the flat list into one block per date.
  const allRows = useMemo(() => {
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

    return out;
  }, [analysis, extNameMap, selectedExtensions, searchQuery, dateSet]);

  const shiftDays = useMemo(() => {
    const counts = new Map();
    allRows.forEach((row) => counts.set(row.date, (counts.get(row.date) || 0) + 1));
    return Array.from(counts, ([date, agents]) => ({ date, agents })).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [allRows]);

  // A day that left the range stops scoping the table, but the control keeps showing
  // what the user picked until they pick something else.
  const scope = shiftDays.some((d) => d.date === dayScope) ? dayScope : '';
  const grouped = !scope && shiftDays.length > 1;

  const rows = useMemo(() => {
    const out = allRows.filter((row) => !scope || row.date === scope);
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
    // Array#sort is stable, so this second pass keeps the order above inside each
    // day while making the days themselves the outer grouping.
    if (grouped) out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out;
  }, [allRows, sortField, sortAsc, scope, grouped]);

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
      // The effective scope, not the raw pick: a saved view must not resurrect a day
      // that the saved range no longer covers.
      dayScope: scope,
      visibleColumns,
      order,
      connView,
      sort: { field: sortField, asc: sortAsc },
      pageSize
    }),
    [dateRange, searchQuery, selectedExtensions, scope, visibleColumns, order, connView, sortField, sortAsc, pageSize]
  );

  useDebouncedSave('view_state', filters);

  const applyFilters = (saved) => {
    if (!saved) return;
    if (saved.dateRange) setDateRange(saved.dateRange);
    setSearchQuery(saved.search || '');
    setSelectedExtensions((saved.extensions || []).filter((e) => extensionsInRange.includes(e)));
    setDayScope(typeof saved.dayScope === 'string' ? saved.dayScope : '');
    setVisibleColumns(mergeVisibleColumns(saved.visibleColumns));
    setOrder(mergeOrder(saved.order, COLUMN_IDS));
    setConnView(saved.connView === 'split' ? 'split' : 'total');
    if (COLUMN_BY_ID[saved.sort?.field]) {
      setSortField(saved.sort.field);
      setSortAsc(saved.sort.asc !== false);
    }
    setPageSize(saved.pageSize || 25);
    setCurrentPage(1);
  };

  const pickDay = (date) => {
    setDayScope(date);
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

  // Every figure in the grid is a copy target, so one number can be lifted into a sheet
  // without exporting the row. One handler on the cell, not a button per figure: the
  // values stay text. What gets copied is the nearest `.num` — the chip or figure the
  // pointer is on — so a click on one break stamp takes that stamp and not the column.
  // The cells that answer for themselves keep their click.
  const copyCell = (e) => {
    if (e.target.closest('button, input')) return;
    const text = (e.target.closest('.num') || e.currentTarget).innerText.trim();
    if (!text || text === '-') return;
    copyText(text)
      .then(() => addToast(`Copied ${text.replace(/\s+/g, ' ')}`, 'info'))
      .catch(() => addToast('The browser refused the copy.', 'error'));
  };

  // Dragging a handle reorders `order`, the full id list; visibility is applied on top
  // of it, so a hidden column keeps its slot and reappears where it was put.
  const shownColumns = order.map((id) => COLUMN_BY_ID[id]).filter((col) => col && visibleColumns[col.id]);
  const shownIds = shownColumns.map((col) => col.id);
  const ctx = { connView, setOverride, openDetail };

  const noData = Object.keys(analysis).length === 0;

  return (
    <div className={`animate__animated ${slide} flex min-h-0 flex-1 flex-col space-y-4`}>
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
        order={order}
        setOrder={setOrder}
        connView={connView}
        setConnView={setConnView}
        filters={filters}
        onApplyFilters={applyFilters}
      />

      <DayScopeSelect
        days={shiftDays.map((d) => ({ date: d.date, hint: agentCount(d.agents) }))}
        value={scope}
        onChange={pickDay}
      />

      <div className="panel report-panel overflow-hidden rounded-md">
        <div aria-busy={isParsing || undefined} className="report-region overflow-auto">
          <table className="w-full text-left text-xs text-k-ink-muted">
            <thead className="sticky top-0 z-[25] border-b border-k-hairline thead text-meta font-bold">
              <tr>
                {shownColumns.map((col) => (
                  <SortHeaderCell
                    key={col.id}
                    label={col.label}
                    field={col.id}
                    sortField={sortField}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                    align={col.align}
                    className={colWidth(col.id)}
                    sortable={!!col.value}
                    order={order}
                    setOrder={setOrder}
                    shownIds={shownIds}
                    dragging={dragCol}
                    setDragging={setDragCol}
                  />
                ))}
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
                          className="rounded bg-k-accent px-3.5 py-2 text-xs font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
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
                          ? 'Upload a CDR CSV from the sidebar to build the rundown.'
                          : 'Widen the date range, clear the search, or select more agents in the toolbar.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => (
                  <Fragment key={`${row.extension}_${row.date}`}>
                    {grouped && (i === 0 || pageRows[i - 1].date !== row.date) && (
                      <tr>
                        <td colSpan={shownColumns.length} className="bg-k-sunken/70 px-3 py-1.5">
                          <span className="num text-2xs font-medium text-k-ink-muted">
                            {row.date}
                          </span>
                          <span className="num ml-2 text-2xs text-k-ink-muted">
                            {` · ${agentCount(shiftDays.find((d) => d.date === row.date)?.agents || 0)}`}
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className="row-hover h-[38px]">
                      {shownColumns.map((col) => (
                        <td
                          key={col.id}
                          onClick={copyCell}
                          className={`whitespace-nowrap px-3 align-middle cursor-copy ${colWidth(col.id)} ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          } ${dragCol === col.id ? 'bg-k-accent-fg/15' : ''}`}
                        >
                          {col.cell(row, ctx)}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
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
        />
      </div>
    </div>
  );
}
