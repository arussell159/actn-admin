"use client"

import * as React from "react"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type SortingState,
} from "@tanstack/react-table"
import { z } from "zod"

import { ClientCell, CountryCell } from "@/components/country-cell"
import { AppLink } from "@/components/app-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getAgentProfileUrl } from "@/lib/agents"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { EllipsisVerticalIcon, Columns3Icon, ChevronDownIcon, PlusIcon, ChevronsLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, ReceiptTextIcon } from "lucide-react"

// New in v9: declare the features this table uses — anything you don't
// register is tree-shaken out of the bundle.
const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

const columnHelper = createColumnHelper<
  typeof features,
  z.infer<typeof schema>
>()

const statusViews = [
  { label: "Initiated", value: "Initiated" },
  { label: "Draft Available", value: "Draft Available" },
  { label: "Changes Needed", value: "Changes Needed" },
  { label: "Missing Docs", value: "Missing Docs" },
  { label: "Validation Submitted", value: "Validation Submitted" },
]

const statusPillClasses: Record<string, string> = {
  Initiated:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  Pending:
    "border-sky-200 bg-sky-200 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  "Missing Docs":
    "border-rose-200 bg-rose-100 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  "Draft Available":
    "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  "Changes Needed":
    "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  "Draft Approved":
    "border-green-200 bg-green-100 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  "Validation Submitted":
    "border-emerald-950 bg-slate-800 text-lime-300 dark:border-lime-900 dark:bg-slate-900 dark:text-lime-300",
  Completed:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  Rejected:
    "border-red-200 bg-red-100 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  Cancelled:
    "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300",
}

export const schema = z.object({
  id: z.number(),
  billOfLading: z.string(),
  lastUpdated: z.string(),
  status: z.string(),
  country: z.string(),
  client: z.string(),
  invoiceNumber: z.string(),
  invoicePaid: z.boolean(),
  agent: z.string(),
})

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`block max-w-full justify-start overflow-hidden text-left text-ellipsis whitespace-nowrap ${statusPillClasses[status] ?? "text-muted-foreground"}`}
    >
      {status}
    </Badge>
  )
}

function InvoiceStatusBadge({ item }: { item: z.infer<typeof schema> }) {
  const invoiceClass = !item.invoiceNumber
    ? "flex max-w-full min-w-0 justify-start overflow-hidden text-left whitespace-nowrap border-muted bg-muted text-muted-foreground [&>svg]:shrink-0"
    : item.invoicePaid
      ? "flex max-w-full min-w-0 justify-start overflow-hidden text-left whitespace-nowrap border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300 [&>svg]:shrink-0"
      : "flex max-w-full min-w-0 justify-start overflow-hidden text-left whitespace-nowrap border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 [&>svg]:shrink-0"

  return (
    <Badge variant="outline" className={invoiceClass}>
      <ReceiptTextIcon />
      <span className="min-w-0 truncate">{item.invoiceNumber || "No invoice"}</span>
    </Badge>
  )
}

const columns = columnHelper.columns([
  columnHelper.accessor("billOfLading", {
    header: "Bill of Lading",
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  }),
  columnHelper.accessor("lastUpdated", {
    header: "Last Updated",
    cell: ({ row }) => (
      <div className="w-32 text-muted-foreground">
        {row.original.lastUpdated}
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  }),
  columnHelper.accessor("country", {
    header: "Country",
    cell: ({ row }) => (
      <CountryCell country={row.original.country} className="max-w-44" />
    ),
  }),
  columnHelper.accessor("client", {
    header: "Client",
    cell: ({ row }) => (
      <ClientCell client={row.original.client} className="max-w-36" />
    ),
  }),
  columnHelper.accessor("invoiceNumber", {
    header: "Invoice Number",
    cell: ({ row }) => <InvoiceStatusBadge item={row.original} />,
  }),
  columnHelper.accessor("agent", {
    header: "Agent",
    cell: ({ row }) => {
      const isAssigned = row.original.agent !== "Assign agent"
      if (isAssigned) {
        return (
          <AppLink
            href={getAgentProfileUrl(row.original.agent)}
            className="block truncate text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
          >
            {row.original.agent}
          </AppLink>
        )
      }
      return (
        <>
          <Label htmlFor={`${row.original.id}-agent`} className="sr-only">
            Agent
          </Label>
          <Select
            items={[
              { label: "Eddie Lake", value: "Eddie Lake" },
              { label: "Jamik Tashpulatov", value: "Jamik Tashpulatov" },
            ]}
          >
            <SelectTrigger
              className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
              id={`${row.original.id}-agent`}
            >
              <SelectValue placeholder="Assign agent" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                <SelectItem value="Jamik Tashpulatov">
                  Jamik Tashpulatov
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </>
      )
    },
  }),
  columnHelper.display({
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-open:bg-muted"
              size="icon"
            />
          }
        >
          <EllipsisVerticalIcon
          />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
])

export function DataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[]
}) {
  const [data] = React.useState(() => initialData)
  const [activeStatus, setActiveStatus] = React.useState(statusViews[0].value)
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const filteredData = React.useMemo(
    () => data.filter((row) => row.status === activeStatus),
    [activeStatus, data]
  )

  const table = useTable({
    features,
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })
  return (
    <Tabs
      value={activeStatus}
      onValueChange={(value) => {
        setActiveStatus(value)
        table.setPageIndex(0)
      }}
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select
          value={activeStatus}
          onValueChange={(value) => {
            if (!value) return
            setActiveStatus(value)
            table.setPageIndex(0)
          }}
          items={statusViews}
        >
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusViews.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          {statusViews.map((status) => (
            <TabsTrigger key={status.value} value={status.value}>
              {status.label}
              <Badge variant="secondary">
                {data.filter((row) => row.status === status.value).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <Columns3Icon data-icon="inline-start" />
              Columns
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <PlusIcon
            />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value={activeStatus}
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : (
                          <FlexRender header={header} />
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredRowModel().rows.length} shipment records
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.state.pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
                items={[10, 20, 30, 40, 50].map((pageSize) => ({
                  label: `${pageSize}`,
                  value: `${pageSize}`,
                }))}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.state.pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.state.pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon
                />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon
                />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon
                />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon
                />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  return (
    <Button
      variant="link"
      className="h-auto w-fit px-0 text-left text-foreground"
      render={
        <AppLink href={`/classic/${encodeURIComponent(item.billOfLading)}`} />
      }
    >
      {item.billOfLading}
    </Button>
  )
}

