"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Pagination,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  DataGrid,
  getGridStringOperators,
  type GridColDef,
  type GridColumnGroupingModel,
  type GridFilterModel,
  type GridPaginationModel,
  type GridSortModel,
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

// Exactly the fields listed in `UpdateEquipmentRequest` in
// contracts/equipment/update_equipment.yaml. Everything else on the row —
// id/customer_id/customer_no (system-generated) and created_at/updated_at
// (system-managed timestamps) — is not user-editable.
const EDITABLE_FIELDS = [
  "customer_name",
  "address",
  "region",
  "territory",
  "main_contact",
  "contact_number",
  "email",
  "location",
  "fnb_or_yps",
  "psa_status",
  "psa_contract",
  "psa_end_date",
  "sales_rep",
  "ops_team",
  "equip_tag",
  "model",
  "compressor_type",
  "serial_number",
  "brand",
  "motor_make_model",
  "motor_serial",
  "motor_kw",
  "year_installed",
  "year_commissioned",
  "running_hours",
  "last_service_date",
  "comments",
  "area_classification",
  "equipment_sales_person",
  "controller_type",
  "oil_type",
  "oil_charge",
  "ref_type",
  "ref_charge",
  "detailed_comments",
  "third_party_compressor_model",
  "third_party_run_hours",
  "third_party_psa_contract",
  "condenser_make_model",
  "ammonia_pump_make_model",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

// The PATCH body shape: a partial diff of only the fields that actually
// changed, keyed by the same EditableField set as the contract's
// UpdateEquipmentRequest schema.
type EquipmentUpdatePayload = Partial<Pick<EquipmentListItem, EditableField>>;

function editableColumnProps(): Partial<GridColDef<EquipmentListItem>> {
  return { editable: true };
}

// Converts an edited Date (from the date-picker edit component) back into the
// ISO string the row/API expect, pairing with the read-mode `valueGetter:
// toDate` on date columns so the row's underlying value stays a string.
function dateValueSetter(field: "psa_end_date" | "last_service_date") {
  return (value: unknown, row: EquipmentListItem): EquipmentListItem => ({
    ...row,
    [field]: value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null,
  });
}

// Pure diff of only the fields that changed between the grid's edited row and
// its previous value, restricted to the contract's editable field set. Sending
// only the diff (rather than the full row) matters for correctness, not just
// efficiency — the API only validates fields present in the request body, so
// this avoids tripping required-field validation on unrelated blank legacy
// fields elsewhere on the row.
export function computeEquipmentDiff(
  newRow: EquipmentListItem,
  oldRow: EquipmentListItem,
): EquipmentUpdatePayload {
  const diff: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (newRow[field] !== oldRow[field]) {
      diff[field] = newRow[field];
    }
  }
  return diff as EquipmentUpdatePayload;
}

// Sends the diff between newRow/oldRow to PATCH /api/equipment/{id} and
// resolves with the server's updated row. Extracted as a standalone function
// (rather than inlined in the DataGrid's processRowUpdate prop) so it can be
// unit tested directly without driving the full DataGrid edit-mode UI in
// jsdom.
export async function updateEquipmentRow(
  newRow: EquipmentListItem,
  oldRow: EquipmentListItem,
): Promise<EquipmentListItem> {
  const diff = computeEquipmentDiff(newRow, oldRow);

  if (Object.keys(diff).length === 0) {
    return oldRow;
  }

  const response = await fetch(`/api/equipment/${oldRow.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(diff),
  });

  if (!response.ok) {
    const body: ApiErrorResponse | null = await response.json().catch(() => null);
    throw new Error(
      body?.error?.message ?? `Failed to update equipment (status ${response.status}).`,
    );
  }

  const body = (await response.json()) as { data: EquipmentListItem };
  return body.data;
}

/** Sends DELETE /api/equipment/{id}. Extracted for the same testability reason as updateEquipmentRow. */
export async function deleteEquipmentRow(id: string): Promise<void> {
  const response = await fetch(`/api/equipment/${id}`, { method: "DELETE" });

  if (!response.ok) {
    const body: ApiErrorResponse | null = await response.json().catch(() => null);
    throw new Error(
      body?.error?.message ?? `Failed to delete equipment (status ${response.status}).`,
    );
  }
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Builds the GET /api/equipment query string from the grid's controlled
// state. Extracted as a standalone function (rather than inlined in the
// fetch effect) for the same testability reason as computeEquipmentDiff —
// driving MUI X Data Grid's actual filter-panel UI through userEvent in
// jsdom is unreliable, so the param-building logic is unit tested directly
// instead of through the DOM.
export function buildEquipmentQueryParams(
  paginationModel: GridPaginationModel,
  search: string,
  filterModel: GridFilterModel,
  sortModel: GridSortModel,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(paginationModel.page + 1));
  params.set("page_size", String(paginationModel.pageSize));
  if (search.trim()) params.set("search", search.trim());

  for (const item of filterModel.items) {
    if (!isFilterableField(item.field)) continue;
    if (item.value === undefined || item.value === null || item.value === "") continue;
    params.set(item.field, String(item.value));
  }

  // Community edition only supports single-column sort.
  const [sortItem] = sortModel;
  if (sortItem?.sort) {
    params.set("sort_by", sortItem.field);
    params.set("sort_order", sortItem.sort);
  }

  return params;
}

function filterableColumnProps(): Partial<GridColDef<EquipmentListItem>> {
  return { filterable: true, filterOperators: equalsOnlyOperators };
}

// Every column is sortable — the contract supports server-side sort on any
// EquipmentListItem field via sort_by/sort_order.
const columns: GridColDef<EquipmentListItem>[] = [
  { field: "id", headerName: "ID", width: 220, filterable: false },
  { field: "customer_id", headerName: "Customer ID", width: 220, filterable: false },
  {
    field: "customer_no",
    headerName: "Customer No.",
    type: "number",
    width: 130,
    filterable: false,
  },
  {
    field: "customer_name",
    headerName: "Customer Name",
    width: 200,
    filterable: false,
    ...editableColumnProps(),
  },
  { field: "address", headerName: "Address", width: 220, filterable: false, ...editableColumnProps() },
  { field: "region", headerName: "Region", width: 140, ...filterableColumnProps(), ...editableColumnProps() },
  {
    field: "territory",
    headerName: "Territory",
    width: 140,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "main_contact",
    headerName: "Main Contact",
    width: 160,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "contact_number",
    headerName: "Contact Number",
    width: 150,
    filterable: false,
    ...editableColumnProps(),
  },
  { field: "email", headerName: "Email", width: 200, filterable: false, ...editableColumnProps() },
  { field: "location", headerName: "Location", width: 160, filterable: false, ...editableColumnProps() },
  {
    field: "fnb_or_yps",
    headerName: "F&B / YPS",
    width: 120,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "psa_status",
    headerName: "PSA Status",
    width: 150,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "psa_contract",
    headerName: "PSA Contract",
    width: 160,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "psa_end_date",
    headerName: "PSA End Date",
    type: "date",
    width: 140,
    filterable: false,
    valueGetter: (value) => toDate(value),
    valueSetter: dateValueSetter("psa_end_date"),
    ...editableColumnProps(),
  },
  { field: "sales_rep", headerName: "Sales Rep", width: 150, filterable: false, ...editableColumnProps() },
  { field: "ops_team", headerName: "Ops Team", width: 150, filterable: false, ...editableColumnProps() },
  { field: "equip_tag", headerName: "Equip Tag", width: 140, filterable: false, ...editableColumnProps() },
  { field: "model", headerName: "Model", width: 160, filterable: false, ...editableColumnProps() },
  {
    field: "compressor_type",
    headerName: "Compressor Type",
    width: 160,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "serial_number",
    headerName: "Serial Number",
    width: 160,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "brand",
    headerName: "Brand",
    width: 140,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "motor_make_model",
    headerName: "Motor Make/Model",
    width: 180,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "motor_serial",
    headerName: "Motor Serial",
    width: 150,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "motor_kw",
    headerName: "Motor KW",
    type: "number",
    width: 110,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "year_installed",
    headerName: "Year Installed",
    type: "number",
    width: 130,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "year_commissioned",
    headerName: "Year Commissioned",
    type: "number",
    width: 160,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "running_hours",
    headerName: "Running Hours",
    type: "number",
    width: 140,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "last_service_date",
    headerName: "Last Service Date",
    type: "date",
    width: 160,
    filterable: false,
    valueGetter: (value) => toDate(value),
    valueSetter: dateValueSetter("last_service_date"),
    ...editableColumnProps(),
  },
  { field: "comments", headerName: "Comments", width: 220, filterable: false, ...editableColumnProps() },
  {
    field: "area_classification",
    headerName: "Area Classification",
    width: 170,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "equipment_sales_person",
    headerName: "Equipment Sales Person",
    width: 190,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "controller_type",
    headerName: "Controller Type",
    width: 150,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "oil_type",
    headerName: "Oil Type",
    width: 130,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "oil_charge",
    headerName: "Oil Charge",
    width: 130,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "ref_type",
    headerName: "Ref Type",
    width: 130,
    ...filterableColumnProps(),
    ...editableColumnProps(),
  },
  {
    field: "ref_charge",
    headerName: "Ref Charge",
    width: 130,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "detailed_comments",
    headerName: "Detailed Comments",
    width: 220,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "third_party_compressor_model",
    headerName: "3rd Party Compressor Model",
    width: 210,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "third_party_run_hours",
    headerName: "3rd Party Run Hours",
    type: "number",
    width: 170,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "third_party_psa_contract",
    headerName: "3rd Party PSA Contract",
    width: 190,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "condenser_make_model",
    headerName: "Condenser Make/Model",
    width: 190,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "ammonia_pump_make_model",
    headerName: "Ammonia Pump Make/Model",
    width: 210,
    filterable: false,
    ...editableColumnProps(),
  },
  {
    field: "created_at",
    headerName: "Created At",
    type: "dateTime",
    width: 180,
    filterable: false,
    valueGetter: (value) => toDate(value),
  },
  {
    field: "updated_at",
    headerName: "Updated At",
    type: "dateTime",
    width: 180,
    filterable: false,
    valueGetter: (value) => toDate(value),
  },
];

// Mirrors the source sheet's 5 section groups exactly (see COLUMNS in
// src/lib/xlsx.ts, the source of truth for this grouping). `id`/`customer_id`/
// `created_at`/`updated_at` are our own added metadata, not part of the
// original sheet, so they're left ungrouped (and hidden by default below).
const columnGroupingModel: GridColumnGroupingModel = [
  {
    groupId: "contact_information",
    headerName: "Contact Information",
    children: [
      { field: "customer_no" },
      { field: "customer_name" },
      { field: "address" },
      { field: "region" },
      { field: "territory" },
      { field: "main_contact" },
      { field: "contact_number" },
      { field: "email" },
      { field: "location" },
      { field: "fnb_or_yps" },
      { field: "psa_status" },
      { field: "psa_contract" },
      { field: "psa_end_date" },
    ],
  },
  {
    groupId: "internal_information",
    headerName: "Internal Information",
    children: [{ field: "sales_rep" }, { field: "ops_team" }],
  },
  {
    groupId: "equipment",
    headerName: "Equipment",
    children: [
      { field: "equip_tag" },
      { field: "model" },
      { field: "compressor_type" },
      { field: "serial_number" },
      { field: "brand" },
      { field: "motor_make_model" },
      { field: "motor_serial" },
      { field: "motor_kw" },
      { field: "year_installed" },
      { field: "year_commissioned" },
      { field: "running_hours" },
      { field: "last_service_date" },
      { field: "comments" },
      { field: "area_classification" },
      { field: "equipment_sales_person" },
    ],
  },
  {
    groupId: "detailed_information",
    headerName: "Detailed Information",
    children: [
      { field: "controller_type" },
      { field: "oil_type" },
      { field: "oil_charge" },
      { field: "ref_type" },
      { field: "ref_charge" },
      { field: "detailed_comments" },
    ],
  },
  {
    groupId: "third_party_equipment",
    headerName: "3rd Party Equipment",
    children: [
      { field: "third_party_compressor_model" },
      { field: "third_party_run_hours" },
      { field: "third_party_psa_contract" },
      { field: "condenser_make_model" },
      { field: "ammonia_pump_make_model" },
    ],
  },
];

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

export function EquipmentGrid() {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EquipmentListItem[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageCount = Math.max(1, Math.ceil(rowCount / paginationModel.pageSize));

  // Row-action column (delete) needs access to component state, so it's built
  // here rather than in the module-level `columns` array.
  const allColumns = useMemo<GridColDef<EquipmentListItem>[]>(
    () => [
      {
        field: "actions",
        headerName: "",
        width: 56,
        sortable: false,
        filterable: false,
        editable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <IconButton
            aria-label="Delete row"
            size="small"
            onClick={() => setDeleteTarget(params.row)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      },
      ...columns,
    ],
    [],
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEquipmentRow(deleteTarget.id);
      setRows((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      setRowCount((prev) => Math.max(0, prev - 1));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete equipment.");
    } finally {
      setDeleting(false);
    }
  };

  // Controlled/server-mode pagination doesn't get page-number or first/last buttons from the
  // grid's default footer — build one from our own paginationModel state instead of reaching
  // into the grid's internal API. Overriding the whole `pagination` slot also drops the
  // default footer's rows-per-page selector and "X-Y of Z" range text, so those are
  // reimplemented here too rather than lost.
  function CustomPagination() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const rangeStart = rowCount === 0 ? 0 : paginationModel.page * paginationModel.pageSize + 1;
    const rangeEnd = Math.min((paginationModel.page + 1) * paginationModel.pageSize, rowCount);

    return (
      <Stack
        direction="row"
        spacing={{ xs: 1, sm: 3 }}
        sx={{ alignItems: "center", px: 1, py: 0.5, flexWrap: "wrap", rowGap: 1 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Rows per page:
          </Typography>
          <FormControl size="small" variant="standard">
            <Select
              value={paginationModel.pageSize}
              onChange={(event) =>
                setPaginationModel({ page: 0, pageSize: Number(event.target.value) })
              }
              inputProps={{ "aria-label": "Rows per page" }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <MenuItem key={size} value={size}>
                  {size}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {rangeStart}–{rangeEnd} of {rowCount}
        </Typography>
        <Pagination
          color="primary"
          count={pageCount}
          page={paginationModel.page + 1}
          onChange={(_event, value) =>
            setPaginationModel((prev) => ({ ...prev, page: value - 1 }))
          }
          showFirstButton
          showLastButton
          size="small"
          siblingCount={isMobile ? 0 : 1}
        />
      </Stack>
    );
  }

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

  const handleSortModelChange = useCallback((model: GridSortModel) => {
    setSortModel(model);
    setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
  }, []);

  // MUI X Data Grid's standard server-validated edit pattern: if this promise
  // resolves, the resolved row becomes the committed row; if it rejects, the
  // grid automatically reverts the cell to its previous value and calls
  // onProcessRowUpdateError below. Known limitation: this only updates the one
  // edited row in local grid state. If a customer-level field (e.g. region) is
  // edited and that customer has other equipment rows currently loaded, those
  // other rows won't reflect the change until the next fetch (pagination/
  // filter/search change or reload) — acceptable for v1, not worth the
  // complexity of scanning/patching every row sharing customer_id client-side.
  const handleProcessRowUpdate = useCallback(
    async (newRow: EquipmentListItem, oldRow: EquipmentListItem) => {
      const updated = await updateEquipmentRow(newRow, oldRow);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      return updated;
    },
    [],
  );

  const handleProcessRowUpdateError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Failed to update equipment.");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchEquipment() {
      setLoading(true);
      setError(null);

      const params = buildEquipmentQueryParams(paginationModel, search, filterModel, sortModel);

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
  }, [paginationModel, search, filterModel, sortModel]);

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
          columns={allColumns}
          columnGroupingModel={columnGroupingModel}
          rowCount={rowCount}
          loading={loading}
          paginationMode="server"
          filterMode="server"
          sortingMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          filterModel={filterModel}
          onFilterModelChange={handleFilterModelChange}
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          processRowUpdate={handleProcessRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          disableRowSelectionOnClick
          slots={{ pagination: CustomPagination }}
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
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete equipment record?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the record for{" "}
            <strong>{deleteTarget?.customer_name}</strong>
            {deleteTarget?.model ? ` (${deleteTarget.model})` : ""}. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" disabled={deleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
