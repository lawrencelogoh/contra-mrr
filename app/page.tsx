"use client";

import { useState } from "react";
import {
  FlexRender,
  columnFilteringFeature,
  coreFeatures,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

type Freelancer = {
  name: string;
  mrr: number;
  totalEarned: number;
  rating: number;
};

const freelancers: Freelancer[] = [
  { name: "Ada Lovelace", mrr: 1450, totalEarned: 12400, rating: 4.9 },
  { name: "Grace Hopper", mrr: 1100, totalEarned: 9800, rating: 4.8 },
  { name: "Alan Turing", mrr: 860, totalEarned: 7250, rating: 4.7 },
];

const formatCurrency = (value: number) =>
  value >= 1000
    ? `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`
    : `$${value.toLocaleString("en-US")}`;

const features = tableFeatures({
  ...coreFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
});
const columnHelper = createColumnHelper<typeof features, Freelancer>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "index",
    header: "#",
    cell: (info) => info.row.index + 1,
  }),
  columnHelper.accessor("name", {
    header: "Freelancer",
    enableSorting: false,
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("mrr", {
    header: "MRR",
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor("totalEarned", {
    header: "Total Earned",
    cell: (info) => formatCurrency(info.getValue()),
  }),
  columnHelper.accessor("rating", {
    header: "Rating",
    cell: (info) => info.getValue(),
  }),
]);

export default function Home() {
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useTable({
    features,
    columns,
    data: freelancers,
    globalFilterFn: "includesString",
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <main className="flex w-full flex-col gap-6 px-3 pb-8 pt-8">
      <input
        value={globalFilter}
        onChange={(event) => setGlobalFilter(event.target.value)}
        placeholder="Search freelancers..."
        className="mx-auto block w-full max-w-3xl rounded-full border border-gray-300 px-6 py-3 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      <div className="w-full overflow-hidden rounded-xl border border-gray-300">
        <table className="w-full border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-gray-200">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-gray-300 px-6 py-4 text-base font-semibold uppercase tracking-wide"
                  >
                    <span className="flex items-center gap-1.5">
                      <FlexRender header={header} />
                      {header.column.getCanSort() && (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="text-xs text-gray-500 transition-colors hover:text-gray-900"
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
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 text-base">
                    <FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
