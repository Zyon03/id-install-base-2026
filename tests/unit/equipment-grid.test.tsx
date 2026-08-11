import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEquipmentQueryParams,
  computeEquipmentDiff,
  EquipmentGrid,
  updateEquipmentRow,
  type EquipmentListItem,
} from "@/components/installs/EquipmentGrid";
import type { GridFilterModel, GridPaginationModel, GridSortModel } from "@mui/x-data-grid";

// jsdom has no ResizeObserver; MUI X Data Grid needs one to measure its viewport.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const EXAMPLE_ITEM: EquipmentListItem = {
  id: "clx1a2b3c4d5e6f7g8h9i0j1",
  customer_id: "clx0000000000000000001",
  customer_no: 1,
  customer_name: "Acme Testing Co",
  address: "1 Fake Street",
  region: "Testville",
  territory: "Testville",
  main_contact: "Ms. Example",
  contact_number: null,
  email: null,
  location: null,
  fnb_or_yps: "F&B",
  psa_status: "No PSA",
  psa_contract: null,
  psa_end_date: null,
  sales_rep: null,
  ops_team: null,
  equip_tag: null,
  model: "Model A",
  compressor_type: null,
  serial_number: "SN-001",
  brand: "Frick",
  motor_make_model: null,
  motor_serial: null,
  motor_kw: null,
  year_installed: null,
  year_commissioned: null,
  running_hours: null,
  last_service_date: null,
  comments: null,
  area_classification: null,
  equipment_sales_person: null,
  controller_type: "Quantum LX",
  oil_type: null,
  oil_charge: null,
  ref_type: null,
  ref_charge: null,
  detailed_comments: null,
  third_party_compressor_model: null,
  third_party_run_hours: null,
  third_party_psa_contract: null,
  condenser_make_model: null,
  ammonia_pump_make_model: null,
  created_at: "2026-08-09T10:20:54.000Z",
  updated_at: "2026-08-09T10:20:54.000Z",
};

function buildResponse(
  overrides?: Partial<{
    equipment: EquipmentListItem[];
    pagination: Partial<{ page: number; page_size: number; total_items: number; total_pages: number }>;
  }>,
) {
  return {
    data: {
      equipment: overrides?.equipment ?? [EXAMPLE_ITEM],
      pagination: {
        page: 1,
        page_size: 50,
        total_items: 1,
        total_pages: 1,
        ...overrides?.pagination,
      },
    },
  };
}

describe("EquipmentGrid", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildResponse(),
    } as Response);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders equipment rows returned by the API", async () => {
    render(<EquipmentGrid />);

    expect(await screen.findByText("Acme Testing Co")).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalled();
    const requestUrl = new URL(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string,
      "http://localhost",
    );
    expect(requestUrl.pathname).toBe("/api/equipment");
    expect(requestUrl.searchParams.get("page")).toBe("1");
    expect(requestUrl.searchParams.get("page_size")).toBe("50");
  });

  it("re-fetches with a search query param when the search input changes", async () => {
    const user = userEvent.setup();
    render(<EquipmentGrid />);

    await screen.findByText("Acme Testing Co");
    const initialCallCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    const searchBox = screen.getByLabelText(/search/i);
    await user.type(searchBox, "Acme");

    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        initialCallCount,
      );
    });

    const lastCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const requestUrl = new URL(lastCall![0] as string, "http://localhost");
    expect(requestUrl.searchParams.get("search")).toBe("Acme");
  });

  it("groups columns under the source sheet's section headers", async () => {
    render(<EquipmentGrid />);

    await screen.findByText("Acme Testing Co");

    expect(screen.getByText("Contact Information")).toBeInTheDocument();
    expect(screen.getByText("Internal Information")).toBeInTheDocument();
    expect(screen.getByText("Equipment")).toBeInTheDocument();
    expect(screen.getByText("Detailed Information")).toBeInTheDocument();
    expect(screen.getByText("3rd Party Equipment")).toBeInTheDocument();
  });

  it("renders page-number and first/last pagination controls, and jumping to a page re-fetches it", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildResponse({ pagination: { total_items: 500, total_pages: 10 } }),
    } as Response);

    const user = userEvent.setup();
    render(<EquipmentGrid />);
    await screen.findByText("Acme Testing Co");

    expect(screen.getByLabelText(/go to first page/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/go to last page/i)).toBeInTheDocument();
    const page3Button = screen.getByRole("button", { name: /go to page 3/i });
    await user.click(page3Button);

    await waitFor(() => {
      const lastCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1);
      const requestUrl = new URL(lastCall![0] as string, "http://localhost");
      expect(requestUrl.searchParams.get("page")).toBe("3");
    });
  });

  it("shows the rows-per-page selector and the current range/total text", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildResponse({ pagination: { total_items: 422, total_pages: 9 } }),
    } as Response);

    render(<EquipmentGrid />);
    await screen.findByText("Acme Testing Co");

    expect(screen.getByText(/rows per page/i)).toBeInTheDocument();
    expect(screen.getByText("1–50 of 422")).toBeInTheDocument();
  });

  it("changing rows-per-page updates page_size and resets to page 1", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildResponse({ pagination: { total_items: 422, total_pages: 9 } }),
    } as Response);

    const user = userEvent.setup();
    render(<EquipmentGrid />);
    await screen.findByText("Acme Testing Co");

    await user.click(screen.getByLabelText(/rows per page/i));
    await user.click(await screen.findByRole("option", { name: "100" }));

    await waitFor(() => {
      const lastCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1);
      const requestUrl = new URL(lastCall![0] as string, "http://localhost");
      expect(requestUrl.searchParams.get("page_size")).toBe("100");
      expect(requestUrl.searchParams.get("page")).toBe("1");
    });
  });

  it("re-fetches with sort_by/sort_order query params when a column is sorted", async () => {
    const user = userEvent.setup();
    render(<EquipmentGrid />);
    await screen.findByText("Acme Testing Co");

    const brandHeader = screen.getByRole("columnheader", { name: /^brand$/i });
    await user.click(brandHeader);

    await waitFor(() => {
      const lastCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1);
      const requestUrl = new URL(lastCall![0] as string, "http://localhost");
      expect(requestUrl.searchParams.get("sort_by")).toBe("brand");
      expect(requestUrl.searchParams.get("sort_order")).toBe("asc");
    });
  });

  it("shows an error alert when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: "server_error", message: "Something broke" } }),
    } as Response);

    render(<EquipmentGrid />);

    expect(await screen.findByText("Something broke")).toBeInTheDocument();
  });
});

// Driving MUI X Data Grid's actual filter-panel UI through userEvent in
// jsdom is unreliable (same reasoning as the cell-edit tests below), so the
// query-param-building logic behind the grid's search/filter/sort/pagination
// state is unit tested directly via its extracted pure function instead.
describe("buildEquipmentQueryParams", () => {
  const basePagination: GridPaginationModel = { page: 0, pageSize: 50 };
  const noFilters: GridFilterModel = { items: [] };
  const noSort: GridSortModel = [];

  it("always sets page (1-indexed) and page_size", () => {
    const params = buildEquipmentQueryParams({ page: 2, pageSize: 25 }, "", noFilters, noSort);
    expect(params.get("page")).toBe("3");
    expect(params.get("page_size")).toBe("25");
  });

  it("omits search when blank or whitespace-only, trims it otherwise", () => {
    expect(buildEquipmentQueryParams(basePagination, "  ", noFilters, noSort).has("search")).toBe(false);
    expect(buildEquipmentQueryParams(basePagination, " frick ", noFilters, noSort).get("search")).toBe(
      "frick",
    );
  });

  it("includes a filter on an allowlisted field with a non-empty value", () => {
    const filterModel: GridFilterModel = { items: [{ field: "region", operator: "equals", value: "Java" }] };
    const params = buildEquipmentQueryParams(basePagination, "", filterModel, noSort);
    expect(params.get("region")).toBe("Java");
  });

  it("ignores a filter on a field the API doesn't support filtering on", () => {
    const filterModel: GridFilterModel = {
      items: [{ field: "customer_name", operator: "equals", value: "Acme" }],
    };
    const params = buildEquipmentQueryParams(basePagination, "", filterModel, noSort);
    expect(params.has("customer_name")).toBe(false);
  });

  it.each([undefined, null, ""])("ignores a filterable field with an empty value (%p)", (value) => {
    const filterModel: GridFilterModel = { items: [{ field: "region", operator: "equals", value }] };
    const params = buildEquipmentQueryParams(basePagination, "", filterModel, noSort);
    expect(params.has("region")).toBe(false);
  });

  it("applies multiple simultaneous column filters", () => {
    const filterModel: GridFilterModel = {
      items: [
        { field: "region", operator: "equals", value: "Java" },
        { field: "brand", operator: "equals", value: "Frick" },
      ],
    };
    const params = buildEquipmentQueryParams(basePagination, "", filterModel, noSort);
    expect(params.get("region")).toBe("Java");
    expect(params.get("brand")).toBe("Frick");
  });

  it("sets sort_by/sort_order from the first sort model entry, omitting them when unsorted", () => {
    expect(buildEquipmentQueryParams(basePagination, "", noFilters, noSort).has("sort_by")).toBe(false);

    const sortModel: GridSortModel = [{ field: "brand", sort: "desc" }];
    const params = buildEquipmentQueryParams(basePagination, "", noFilters, sortModel);
    expect(params.get("sort_by")).toBe("brand");
    expect(params.get("sort_order")).toBe("desc");
  });

  it("combines search, filter, and sort together in one request", () => {
    const filterModel: GridFilterModel = { items: [{ field: "oil_type", operator: "equals", value: "Synthetic" }] };
    const sortModel: GridSortModel = [{ field: "customer_name", sort: "asc" }];
    const params = buildEquipmentQueryParams({ page: 1, pageSize: 100 }, "compressor", filterModel, sortModel);

    expect(Object.fromEntries(params.entries())).toEqual({
      page: "2",
      page_size: "100",
      search: "compressor",
      oil_type: "Synthetic",
      sort_by: "customer_name",
      sort_order: "asc",
    });
  });
});

// The MUI X Data Grid's cell edit UI (double-click to enter edit mode, type,
// commit) is known-fiddly to drive reliably through userEvent in jsdom — the
// edit input's mount/unmount timing and focus handling don't always resolve
// deterministically in the test environment. Rather than fight that, the
// diff-computation and PATCH-calling logic that backs `processRowUpdate` is
// extracted into standalone functions (`computeEquipmentDiff`,
// `updateEquipmentRow`) and unit tested directly here — this covers the
// actual persistence/error-handling logic precisely, without depending on
// DataGrid's internal edit-mode DOM structure.
describe("computeEquipmentDiff", () => {
  it("returns only the fields that changed, restricted to editable fields", () => {
    const newRow: EquipmentListItem = { ...EXAMPLE_ITEM, region: "Jakarta", motor_kw: 9.2 };

    expect(computeEquipmentDiff(newRow, EXAMPLE_ITEM)).toEqual({
      region: "Jakarta",
      motor_kw: 9.2,
    });
  });

  it("ignores changes to non-editable fields such as customer_no or id", () => {
    const newRow: EquipmentListItem = {
      ...EXAMPLE_ITEM,
      customer_no: 999,
      id: "some-other-id",
      updated_at: "2026-08-09T12:00:00.000Z",
    };

    expect(computeEquipmentDiff(newRow, EXAMPLE_ITEM)).toEqual({});
  });

  it("returns an empty object when nothing changed", () => {
    expect(computeEquipmentDiff(EXAMPLE_ITEM, EXAMPLE_ITEM)).toEqual({});
  });
});

describe("updateEquipmentRow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns oldRow without calling fetch when the diff is empty", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await updateEquipmentRow(EXAMPLE_ITEM, EXAMPLE_ITEM);

    expect(result).toBe(EXAMPLE_ITEM);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("PATCHes only the diff and resolves with the server's updated row on success", async () => {
    const updatedItem: EquipmentListItem = { ...EXAMPLE_ITEM, region: "Jakarta" };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: updatedItem }),
    } as Response);
    global.fetch = fetchSpy as unknown as typeof fetch;

    const newRow: EquipmentListItem = { ...EXAMPLE_ITEM, region: "Jakarta" };
    const result = await updateEquipmentRow(newRow, EXAMPLE_ITEM);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`/api/equipment/${EXAMPLE_ITEM.id}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ region: "Jakarta" });
    expect(result).toEqual(updatedItem);
  });

  it("throws with the API's error message on a non-2xx response, leaving the row unchanged", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: "validation_error", message: "Region is required" },
      }),
    } as Response);

    const newRow: EquipmentListItem = { ...EXAMPLE_ITEM, region: null };

    await expect(updateEquipmentRow(newRow, EXAMPLE_ITEM)).rejects.toThrow("Region is required");
  });
});

describe("EquipmentGrid delete with confirmation", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not call the API until the confirm dialog is accepted", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return { ok: true, json: async () => ({ data: { id: EXAMPLE_ITEM.id } }) } as Response;
      }
      return { ok: true, json: async () => buildResponse() } as Response;
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EquipmentGrid />);
    await screen.findByText("Acme Testing Co");

    await user.click(screen.getByRole("button", { name: /delete row/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const deleteCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCalls).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Acme Testing Co")).toBeInTheDocument();
  });

  it("deletes the row via DELETE /api/equipment/{id} and removes it from the grid on confirm", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return { ok: true, json: async () => ({ data: { id: EXAMPLE_ITEM.id } }) } as Response;
      }
      return { ok: true, json: async () => buildResponse() } as Response;
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EquipmentGrid />);
    await screen.findByText("Acme Testing Co");

    await user.click(screen.getByRole("button", { name: /delete row/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(screen.queryByText("Acme Testing Co")).not.toBeInTheDocument());

    const deleteCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall?.[0]).toBe(`/api/equipment/${EXAMPLE_ITEM.id}`);
  });

  it("shows an error and keeps the row when the delete fails", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: "internal_error", message: "Delete failed" } }),
        } as Response;
      }
      return { ok: true, json: async () => buildResponse() } as Response;
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EquipmentGrid />);
    await screen.findByText("Acme Testing Co");

    await user.click(screen.getByRole("button", { name: /delete row/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();
    // The row must still be present as an actual grid cell — allow for the
    // name also appearing in the (still-open, since the delete failed)
    // confirmation dialog text.
    const matches = screen.getAllByText("Acme Testing Co");
    const inGridCell = matches.some((el) => el.closest('[role="gridcell"]') !== null);
    expect(inGridCell).toBe(true);
  });
});

describe("EquipmentGrid inline cell editing (wired end to end)", () => {
  it("persists an edited cell via PATCH /api/equipment/{id} and reflects the server's response", async () => {
    const updatedItem: EquipmentListItem = {
      ...EXAMPLE_ITEM,
      brand: "Grasso",
      updated_at: "2026-08-09T12:00:00.000Z",
    };

    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        expect(JSON.parse(init.body as string)).toEqual({ brand: "Grasso" });
        return { ok: true, json: async () => ({ data: updatedItem }) } as Response;
      }
      return { ok: true, json: async () => buildResponse() } as Response;
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EquipmentGrid />);

    const cellContent = await screen.findByText("Frick");
    const cell = cellContent.closest('[role="gridcell"]') as HTMLElement;
    expect(cell).not.toBeNull();

    await user.dblClick(cell);
    const input = await waitFor(() => within(cell).getByRole("textbox") as HTMLInputElement);
    await user.clear(input);
    await user.type(input, "Grasso{Enter}");

    expect(await screen.findByText("Grasso")).toBeInTheDocument();
  });

  it("reverts the cell and surfaces the error via the Alert when the PATCH fails", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: { code: "validation_error", message: "Brand is required" },
          }),
        } as Response;
      }
      return { ok: true, json: async () => buildResponse() } as Response;
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<EquipmentGrid />);

    const cellContent = await screen.findByText("Frick");
    const cell = cellContent.closest('[role="gridcell"]') as HTMLElement;
    expect(cell).not.toBeNull();

    await user.dblClick(cell);
    const input = await waitFor(() => within(cell).getByRole("textbox") as HTMLInputElement);
    await user.clear(input);
    await user.type(input, "Broken Edit{Enter}");

    // On a rejected processRowUpdate, MUI X Data Grid keeps the cell in edit
    // mode (so the user can correct the value) rather than snapping straight
    // back to view mode — but it does NOT commit the invalid value: the
    // grid's underlying row data is left untouched. Confirm the error surfaced
    // via the shared Alert, then cancel the edit (Escape) to observe that the
    // committed cell value reverted to the pre-edit value, never having been
    // saved as "Broken Edit".
    expect(await screen.findByText("Brand is required")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(await screen.findByText("Frick")).toBeInTheDocument();
    expect(screen.queryByText("Broken Edit")).not.toBeInTheDocument();
  });
});
