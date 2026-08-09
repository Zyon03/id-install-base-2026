"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, TextField } from "@mui/material";
import {
  DataGrid,
  getGridStringOperators,
  type GridColDef,
  type GridFilterModel,
  type GridPaginationModel,
} from "@mui/x-data-grid";

// Shape of one row, mirroring `EquipmentListItem` in
// contracts/equipment/list_equipment.yaml exactly (snake_case, as returned by the API).
export interface EquipmentListItem {
  id: string;
  customer_id: string;
  customer_no: number;
  customer_name: string;
  address: string | null;
  region: string | null;
  territory: string | null;
  main_contact: string | null;
  contact_number: string | null;
  email: string | null;
  location: string | null;
  fnb_or_yps: string | null;
  psa_status: string | null;
  psa_contract: string | null;
  psa_end_date: string | null;
  sales_rep: string | null;
  ops_team: string | null;
  equip_tag: string | null;
  model: string | null;
  compressor_type: string | null;
  serial_number: string | null;
  brand: string | null;
  motor_make_model: string | null;
  motor_serial: string | null;
  motor_kw: number | null;
  year_installed: number | null;
  year_commissioned: number | null;
  running_hours: number | null;
  last_service_date: string | null;
  comments: string | null;
  area_classification: string | null;
  equipment_sales_person: string | null;
  controller_type: string | null;
  oil_type: string | null;
  oil_charge: string | null;
  ref_type: string | null;
  ref_charge: string | null;
  detailed_comments: string | null;
  third_party_compressor_model: string | null;
  third_party_run_hours: number | null;
  third_party_psa_contract: string | null;
  condenser_make_model: string | null;
  ammonia_pump_make_model: string | null;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

interface EquipmentListResponse {
  data: {
    equipment: EquipmentListItem[];
    pagination: Pagination;
  };
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  };
}

// The contract only supports exact-match filtering on these 9 fields (plus free-text
// `search`, handled separately) — every other column is read-only/unfilterable.
const FILTERABLE_FIELDS = [
  "region",
  "territory",
  "fnb_or_yps",
  "psa_status",
  "brand",
  "compressor_type",
  "controller_type",
  "oil_type",
  "ref_type",
] as const;

type FilterableField = (typeof FILTERABLE_FIELDS)[number];

function isFilterableField(field: string): field is FilterableField {
  return (FILTERABLE_FIELDS as readonly string[]).includes(field);
}

// Restrict the column filter menu to "equals" only, since that's all the API supports —
// showing "contains"/"starts with" etc. would silently do nothing on the server.
const equalsOnlyOperators = getGridStringOperators().filter((operator) => operator.value === "equals");

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filterableColumnProps(): Partial<GridColDef<EquipmentListItem>> {
  return { filterable: true, filterOperators: equalsOnlyOperators };
}

// All columns are non-sortable — the contract has no server-side sort, and a client-side
// sort would misleadingly only sort the current page.
const columns: GridColDef<EquipmentListItem>[] = [
  { field: "id", headerName: "ID", width: 220, filterable: false, sortable: false },
  { field: "customer_id", headerName: "Customer ID", width: 220, filterable: false, sortable: false },
  {
    field: "customer_no",
    headerName: "Customer No.",
    type: "number",
    width: 130,
    filterable: false,
    sortable: false,
  },
  { field: "customer_name", headerName: "Customer Name", width: 200, filterable: false, sortable: false },
  { field: "address", headerName: "Address", width: 220, filterable: false, sortable: false },
  { field: "region", headerName: "Region", width: 140, sortable: false, ...filterableColumnProps() },
  { field: "territory", headerName: "Territory", width: 140, sortable: false, ...filterableColumnProps() },
  { field: "main_contact", headerName: "Main Contact", width: 160, filterable: false, sortable: false },
  { field: "contact_number", headerName: "Contact Number", width: 150, filterable: false, sortable: false },
  { field: "email", headerName: "Email", width: 200, filterable: false, sortable: false },
  { field: "location", headerName: "Location", width: 160, filterable: false, sortable: false },
  { field: "fnb_or_yps", headerName: "F&B / YPS", width: 120, sortable: false, ...filterableColumnProps() },
  { field: "psa_status", headerName: "PSA Status", width: 150, sortable: false, ...filterableColumnProps() },
  { field: "psa_contract", headerName: "PSA Contract", width: 160, filterable: false, sortable: false },
  {
    field: "psa_end_date",
    headerName: "PSA End Date",
    type: "date",
    width: 140,
    filterable: false,
    sortable: false,
    valueGetter: (value) => toDate(value),
  },
  { field: "sales_rep", headerName: "Sales Rep", width: 150, filterable: false, sortable: false },
  { field: "ops_team", headerName: "Ops Team", width: 150, filterable: false, sortable: false },
  { field: "equip_tag", headerName: "Equip Tag", width: 140, filterable: false, sortable: false },
  { field: "model", headerName: "Model", width: 160, filterable: false, sortable: false },
  {
    field: "compressor_type",
    headerName: "Compressor Type",
    width: 160,
    sortable: false,
    ...filterableColumnProps(),
  },
  { field: "serial_number", headerName: "Serial Number", width: 160, filterable: false, sortable: false },
  { field: "brand", headerName: "Brand", width: 140, sortable: false, ...filterableColumnProps() },
  { field: "motor_make_model", headerName: "Motor Make/Model", width: 180, filterable: false, sortable: false },
  { field: "motor_serial", headerName: "Motor Serial", width: 150, filterable: false, sortable: false },
  { field: "motor_kw", headerName: "Motor KW", type: "number", width: 110, filterable: false, sortable: false },
  {
    field: "year_installed",
    headerName: "Year Installed",
    type: "number",
    width: 130,
    filterable: false,
    sortable: false,
  },
  {
    field: "year_commissioned",
    headerName: "Year Commissioned",
    type: "number",
    width: 160,
    filterable: false,
    sortable: false,
  },
  {
    field: "running_hours",
    headerName: "Running Hours",
    type: "number",
    width: 140,
    filterable: false,
    sortable: false,
  },
  {
    field: "last_service_date",
    headerName: "Last Service Date",
    type: "date",
    width: 160,
    filterable: false,
    sortable: false,
    valueGetter: (value) => toDate(value),
  },
  { field: "comments", headerName: "Comments", width: 220, filterable: false, sortable: false },
  {
    field: "area_classification",
    headerName: "Area Classification",
    width: 170,
    filterable: false,
    sortable: false,
  },
  {
    field: "equipment_sales_person",
    headerName: "Equipment Sales Person",
    width: 190,
    filterable: false,
    sortable: false,
  },
  {
    field: "controller_type",
    headerName: "Controller Type",
    width: 150,
    sortable: false,
    ...filterableColumnProps(),
  },
  { field: "oil_type", headerName: "Oil Type", width: 130, sortable: false, ...filterableColumnProps() },
  { field: "oil_charge", headerName: "Oil Charge", width: 130, filterable: false, sortable: false },
  { field: "ref_type", headerName: "Ref Type", width: 130, sortable: false, ...filterableColumnProps() },
  { field: "ref_charge", headerName: "Ref Charge", width: 130, filterable: false, sortable: false },
  {
    field: "detailed_comments",
    headerName: "Detailed Comments",
    width: 220,
    filterable: false,
    sortable: false,
  },
  {
    field: "third_party_compressor_model",
    headerName: "3rd Party Compressor Model",
    width: 210,
    filterable: false,
    sortable: false,
  },
  {
    field: "third_party_run_hours",
    headerName: "3rd Party Run Hours",
    type: "number",
    width: 170,
    filterable: false,
    sortable: false,
  },
  {
    field: "third_party_psa_contract",
    headerName: "3rd Party PSA Contract",
    width: 190,
    filterable: false,
    sortable: false,
  },
  {
    field: "condenser_make_model",
    headerName: "Condenser Make/Model",
    width: 190,
    filterable: false,
    sortable: false,
  },
  {
    field: "ammonia_pump_make_model",
    headerName: "Ammonia Pump Make/Model",
    width: 210,
    filterable: false,
    sortable: false,
  },
  {
    field: "created_at",
    headerName: "Created At",
    type: "dateTime",
    width: 180,
    filterable: false,
    sortable: false,
    valueGetter: (value) => toDate(value),
  },
  {
    field: "updated_at",
    headerName: "Updated At",
    type: "dateTime",
    width: 180,
    filterable: false,
    sortable: false,
    valueGetter: (value) => toDate(value),
  },
];

const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export function EquipmentGrid() {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EquipmentListItem[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the free-text search box before it drives a re-fetch, and jump back to page 1
  // so the user doesn't land on a now out-of-range page.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const handleFilterModelChange = useCallback((model: GridFilterModel) => {
    setFilterModel(model);
    setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchEquipment() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(paginationModel.page + 1));
      params.set("page_size", String(paginationModel.pageSize));
      if (search.trim()) params.set("search", search.trim());

      for (const item of filterModel.items) {
        if (!isFilterableField(item.field)) continue;
        if (item.value === undefined || item.value === null || item.value === "") continue;
        params.set(item.field, String(item.value));
      }

      try {
        const response = await fetch(`/api/equipment?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const body: ApiErrorResponse | null = await response.json().catch(() => null);
          throw new Error(body?.error?.message ?? `Failed to load equipment (status ${response.status}).`);
        }

        const body = (await response.json()) as EquipmentListResponse;
        setRows(body.data.equipment);
        setRowCount(body.data.pagination.total_items);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load equipment.");
      } finally {
        setLoading(false);
      }
    }

    fetchEquipment();

    return () => controller.abort();
  }, [paginationModel, search, filterModel]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField
        label="Search"
        placeholder="Search by customer, address, equip tag, model, or serial number"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        size="small"
        fullWidth
        sx={{ maxWidth: 480 }}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={rowCount}
          loading={loading}
          paginationMode="server"
          filterMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          filterModel={filterModel}
          onFilterModelChange={handleFilterModelChange}
          pageSizeOptions={[25, 50, 100]}
          disableColumnSorting
          disableRowSelectionOnClick
          initialState={{
            columns: {
              columnVisibilityModel: {
                id: false,
                customer_id: false,
                created_at: false,
                updated_at: false,
              },
            },
          }}
          sx={{ height: 640, bgcolor: "background.paper" }}
        />
      </Box>
    </Box>
  );
}
