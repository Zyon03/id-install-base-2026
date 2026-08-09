import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EquipmentGrid, type EquipmentListItem } from "@/components/installs/EquipmentGrid";

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
