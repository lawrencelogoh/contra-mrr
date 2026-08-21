"use client";

import Image from "next/image";
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
  link: string;
  displayUsername: string;
  platformEarningsBadge: string;
  profileImageUrl: string;
  hiredCount: number;
  firstName: string;
  lastName: string;
  title: string;
  rating: number;
};

const freelancers: Freelancer[] = [
  { link: "https://contral.com/danielgbright", displayUsername: "danielgbright", platformEarningsBadge: "$750k+", profileImageUrl: "https://api.navii.dev/avatar/danielgbright.png?size=256", hiredCount: 72, firstName: "Daniel G", lastName: "Bright", title: "Brand and web design for startup at inflection points", rating: 4.9 },
  { link: "https://contral.com/maralowen", displayUsername: "maralowen", platformEarningsBadge: "$500k+", profileImageUrl: "https://api.navii.dev/avatar/maralowen.png?size=256", hiredCount: 54, firstName: "Mara", lastName: "Lowen", title: "Product design partner for early-stage SaaS teams", rating: 5 },
  { link: "https://contral.com/jtremblay", displayUsername: "jtremblay", platformEarningsBadge: "$1M+", profileImageUrl: "https://api.navii.dev/avatar/jtremblay.png?size=256", hiredCount: 118, firstName: "Jonah", lastName: "Tremblay", title: "Full-stack engineer shipping MVPs in weeks not months", rating: 4.8 },
  { link: "https://contral.com/priyasharma", displayUsername: "priyasharma", platformEarningsBadge: "$250k+", profileImageUrl: "https://api.navii.dev/avatar/priyasharma.png?size=256", hiredCount: 31, firstName: "Priya", lastName: "Sharma", title: "Growth marketing that turns launches into momentum", rating: 4.9 },
  { link: "https://contral.com/okekec", displayUsername: "okekec", platformEarningsBadge: "$100k+", profileImageUrl: "https://api.navii.dev/avatar/okekec.png?size=256", hiredCount: 19, firstName: "Chidi", lastName: "Okeke", title: "Brand identity systems for founders who hate templates", rating: 4.7 },
  { link: "https://contral.com/sophieln", displayUsername: "sophieln", platformEarningsBadge: "$400k+", profileImageUrl: "https://api.navii.dev/avatar/sophieln.png?size=256", hiredCount: 47, firstName: "Sophie", lastName: "Lindqvist", title: "No-code builds for operators who need it live yesterday", rating: 4.8 },
  { link: "https://contral.com/mhernandez", displayUsername: "mhernandez", platformEarningsBadge: "$850k+", profileImageUrl: "https://api.navii.dev/avatar/mhernandez.png?size=256", hiredCount: 93, firstName: "Mateo", lastName: "Hernandez", title: "Conversion copywriting for B2B pipelines", rating: 5 },
  { link: "https://contral.com/aikeda", displayUsername: "aikeda", platformEarningsBadge: "$300k+", profileImageUrl: "https://api.navii.dev/avatar/aikeda.png?size=256", hiredCount: 38, firstName: "Aiko", lastName: "Keda", title: "Data dashboards your exec team will actually open", rating: 4.6 },
  { link: "https://contral.com/tomwhit", displayUsername: "tomwhit", platformEarningsBadge: "$50k+", profileImageUrl: "https://api.navii.dev/avatar/tomwhit.png?size=256", hiredCount: 11, firstName: "Tom", lastName: "Whitfield", title: "Motion design that makes products feel alive", rating: 4.9 },
  { link: "https://contral.com/nadiahk", displayUsername: "nadiahk", platformEarningsBadge: "$600k+", profileImageUrl: "https://api.navii.dev/avatar/nadiahk.png?size=256", hiredCount: 66, firstName: "Nadia", lastName: "Haq", title: "AI integration for teams drowning in manual work", rating: 4.8 },
];

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

// Approximate MRR from the lifetime earnings badge (e.g. "$750k+"),
// assuming it accrued steadily over 24 months. Not stored in the database.
const parseEarningsBadge = (badge: string): number => {
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

const approximateMrr = (badge: string): number =>
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
  }),  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "freelancer",
    header: "Freelancer",
    enableSorting: false,
    cell: (info) => {
      const f = info.row.original;
      return (
        <span className="flex items-center gap-3">
          <Image
            src={f.profileImageUrl}
            alt={`${f.firstName} ${f.lastName}`}
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
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor((row) => parseEarningsBadge(row.platformEarningsBadge), {
    id: "earned",
    header: "Earned",
    cell: (info) => (
      <span className="text-sm text-zinc-900">
        {info.row.original.platformEarningsBadge}
      </span>
    ),
  }),
  columnHelper.accessor("hiredCount", {
    header: "Hired",
    cell: (info) => <span className="text-sm text-zinc-900">{info.getValue()}</span>,
  }),
  columnHelper.accessor("rating", {
    header: "Rating",
    cell: (info) => (
      <span className="text-sm text-zinc-900">
        {info.getValue().toFixed(1)} ★
      </span>
    ),
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

  const rows = table.getRowModel().rows;

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 bg-zinc-50 px-3 pb-8 pt-8">
      <input
        value={globalFilter}
        onChange={(event) => setGlobalFilter(event.target.value)}
        placeholder="Search freelancers..."
        className="mx-auto block w-full max-w-3xl rounded-full border border-zinc-200 bg-white px-6 py-3 text-lg text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      />
      <div className="w-full overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-zinc-100">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-zinc-200 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500"
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
                  className="px-6 py-16 text-center text-sm text-zinc-500"
                >
                  No freelancers found. Try a different search.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-3.5 align-middle">
                      <FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
