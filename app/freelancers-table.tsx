"use client";

import Image from "next/image";
import { useState } from "react";
import {
  FlexRender,
  columnFilteringFeature,
  coreFeatures,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";

export type Freelancer = {
  link: string;
  displayUsername: string;
  platformEarningsBadge: string | null;
  hiredCount: number;
  firstName: string;
  lastName: string | null;
  title: string | null;
  rating: number | null;
  gigEarnings: number | null;
};

const profileImageUrl = (displayUsername: string) =>
  `https://api.navii.dev/avatar/${displayUsername}.png?size=256`;

const fullName = (f: Freelancer) =>
  `${f.firstName} ${f.lastName ?? ""}`.trim();

const features = tableFeatures({
  ...coreFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
});
const columnHelper = createColumnHelper<typeof features, Freelancer>();

// Approximate MRR from the lifetime earnings badge (e.g. "$750k+"),
// assuming it accrued steadily over 24 months. Not stored in the database.
const parseEarningsBadge = (badge: string | null): number => {
  if (!badge) return 0;
  const match = /\$([\d.]+)\s*([km])?/i.exec(badge);
  if (!match) return 0;
  const scale =
    match[2]?.toLowerCase() === "m"
      ? 1_000_000
      : match[2]?.toLowerCase() === "k"
        ? 1_000
        : 1;
  return Number(match[1]) * scale;
};

const formatCurrency = (value: number) =>
  value >= 1000
    ? `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`
    : `$${value.toLocaleString("en-US")}`;

const approximateMrr = (badge: string | null): number =>
  Math.round(parseEarningsBadge(badge) / 24);

const columns = columnHelper.columns([
  columnHelper.display({
    id: "rank",
    header: "#",
    cell: (info) => (
      <span className="text-sm font-medium text-zinc-500">
        {info.row.getDisplayIndex() + 1}
      </span>
    ),
  }),
  columnHelper.accessor((row) => fullName(row), {
    id: "freelancer",
    header: "Freelancer",
    enableSorting: false,
    cell: (info) => {
      const f = info.row.original;
      return (
        <span className="flex items-center gap-3">
          <Image
            src={profileImageUrl(f.displayUsername)}
            alt={fullName(f)}
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-md border border-zinc-200 bg-zinc-100 object-cover"
          />
          <span className="flex min-w-0 flex-col justify-center">
            <span className="truncate text-sm font-medium leading-tight text-zinc-900">
              {info.getValue()}
            </span>
            <span className="mt-0.5 truncate text-xs leading-tight text-zinc-500">
              {f.title}
            </span>
          </span>
        </span>
      );
    },
  }),
  columnHelper.accessor((row) => approximateMrr(row.platformEarningsBadge), {
    id: "mrr",
    header: "MRR",
    cell: (info) => (
      <span className="text-sm text-zinc-900">
        {info.row.original.platformEarningsBadge
          ? formatCurrency(info.getValue())
          : "—"}
      </span>
    ),
  }),
  columnHelper.accessor(
    (row) => parseEarningsBadge(row.platformEarningsBadge),
    {
      id: "earned",
      header: "Earned",
      cell: (info) => (
        <span className="text-sm text-zinc-900">
          {info.row.original.platformEarningsBadge ?? "—"}
        </span>
      ),
    },
  ),
  columnHelper.accessor("hiredCount", {
    header: "Hired",
    cell: (info) => (
      <span className="text-sm text-zinc-900">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("gigEarnings", {
    id: "gigEarnings",
    header: "Gig Earnings",
    cell: (info) => {
      const value = info.getValue();
      return (
        <span className="text-sm text-zinc-900">
          {value != null ? formatCurrency(value) : "—"}
        </span>
      );
    },
  }),
  columnHelper.accessor("rating", {
    header: "Rating",
    cell: (info) => {
      const rating = info.getValue();
      return (
        <span className="text-sm text-zinc-900">
          {rating != null ? `${rating.toFixed(1)} ★` : "—"}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: "profile",
    header: "Profile",
    cell: (info) => (
      <a
        href={info.row.original.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center whitespace-nowrap rounded-md border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        View Profile
      </a>
    ),
  }),
]);

export default function FreelancersTable({
  freelancers,
}: {
  freelancers: Freelancer[];
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features,
    columns,
    data: freelancers,
    globalFilterFn: "includesString",
    state: { globalFilter, pagination, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <main className="flex min-h-screen w-full flex-col bg-zinc-50 pb-8 pt-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6">
        <input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Search freelancers..."
          className="mx-auto block w-full max-w-3xl rounded-full border border-zinc-200 bg-white px-6 py-3 text-lg text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <div className="flex w-full flex-col gap-2">
          <p className="self-end text-xs text-zinc-500">
            {rows.length.toLocaleString()} of{" "}
            {freelancers.length.toLocaleString()}{" "}
            {freelancers.length === 1 ? "freelancer" : "freelancers"}
          </p>
          <div className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <table className="w-full border-collapse text-left">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="bg-zinc-100">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border-b border-zinc-200 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500"
                      >
                        <span className="flex items-center gap-1.5">
                          <FlexRender header={header} />
                          {header.column.getCanSort() && (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="text-xs text-zinc-400 transition-colors hover:text-zinc-600"
                              aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                            >
                              {header.column.getIsSorted() === "asc"
                                ? "▲"
                                : header.column.getIsSorted() === "desc"
                                  ? "▼"
                                  : "⇅"}
                            </button>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-5 py-16 text-center text-sm text-zinc-500"
                    >
                      {freelancers.length === 0
                        ? "No freelancers yet."
                        : "No freelancers found. Try a different search."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      {row.getAllCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-3.5 align-middle">
                          <FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            Page {pagination.pageIndex + 1} of {pageCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Rows per page
              <select
                value={pagination.pageSize}
                onChange={(event) => table.setPageSize(Number(event.target.value))}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="First page"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next ›
            </button>
            <button
              type="button"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Last page"
            >
              »
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
