import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { EquipmentForm } from "@/components/new/EquipmentForm";

const EXISTING_CUSTOMER = {
  id: "cust-1",
  no: 1,
  name: "Acme Testing Co",
  address: "1 Fake Street",
  region: "Testville",
  main_contact: "Ms. Example",
};

const VALID_EQUIPMENT_VALUES = {
  equip_tag: "CMP-001",
  model: "RXF 85 H",
  compressor_type: "Screw",
  serial_number: "10241H19882765",
  brand: "Frick",
  motor_make_model: "ABB M3BP",
  motor_serial: "MS-001",
  motor_kw: "75",
  controller_type: "Quantum LX",
  oil_type: "Synthetic",
  ref_type: "R717",
};

const EQUIPMENT_FIELD_LABELS: Record<keyof typeof VALID_EQUIPMENT_VALUES, RegExp> = {
  equip_tag: /^equip tag\b/i,
  model: /^model\b/i,
  compressor_type: /^compressor type\b/i,
  serial_number: /^serial number\b/i,
  brand: /^brand\b/i,
  motor_make_model: /^motor make\/model\b/i,
  motor_serial: /^motor serial\b/i,
  motor_kw: /^motor kw\b/i,
  controller_type: /^controller type\b/i,
  oil_type: /^oil type\b/i,
  ref_type: /^ref type\b/i,
};

// This form renders 40+ MUI text fields at once, which is noticeably slower
// to mount/type into under jsdom than a typical small form — give the
// autocomplete's debounced search room to resolve rather than tripping
// Testing Library's default 1000ms findBy timeout.
const FIND_TIMEOUT = 5000;
const TEST_TIMEOUT = 20000;

async function selectExistingCustomer(user: ReturnType<typeof userEvent.setup>) {
  const customerInput = screen.getByRole("combobox", { name: /search for an existing customer/i });
  await user.type(customerInput, "Acme");
  const option = await screen.findByRole(
    "option",
    { name: /acme testing co/i },
    { timeout: FIND_TIMEOUT },
  );
  await user.click(option);
}

async function fillRequiredEquipmentFields(
  user: ReturnType<typeof userEvent.setup>,
  skip: (keyof typeof VALID_EQUIPMENT_VALUES)[] = [],
) {
  for (const [field, label] of Object.entries(EQUIPMENT_FIELD_LABELS) as [
    keyof typeof VALID_EQUIPMENT_VALUES,
    RegExp,
  ][]) {
    if (skip.includes(field)) continue;
    await user.type(screen.getByLabelText(label), VALID_EQUIPMENT_VALUES[field]);
  }
}

function buildFetchMock(options: {
  searchCustomers?: () => unknown;
  createCustomer?: () => { ok: boolean; status?: number; body: unknown };
  createEquipment?: () => { ok: boolean; status?: number; body: unknown };
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";

    if (url.pathname === "/api/customers" && method === "GET") {
      const body = options.searchCustomers
        ? options.searchCustomers()
        : { data: { customers: [] } };
      return { ok: true, json: async () => body } as Response;
    }

    if (url.pathname === "/api/customers" && method === "POST") {
      const result = options.createCustomer
        ? options.createCustomer()
        : { ok: true, status: 201, body: { data: { id: "new-cust-1" } } };
      return { ok: result.ok, status: result.status ?? 201, json: async () => result.body } as Response;
    }

    if (url.pathname === "/api/equipment" && method === "POST") {
      const result = options.createEquipment
        ? options.createEquipment()
        : { ok: true, status: 201, body: { data: { id: "eq-1" } } };
      return { ok: result.ok, status: result.status ?? 201, json: async () => result.body } as Response;
    }

    throw new Error(`Unhandled fetch: ${method} ${url.pathname}`);
  });
}

describe("EquipmentForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pushMock.mockClear();
  });

  it("selects an existing customer via the autocomplete, fills required fields, and submits to POST /api/equipment with the right customer_id", async () => {
    const fetchMock = buildFetchMock({
      searchCustomers: () => ({ data: { customers: [EXISTING_CUSTOMER] } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup({ delay: null });
    render(<EquipmentForm />);

    await selectExistingCustomer(user);

    await fillRequiredEquipmentFields(user);

    await user.click(screen.getByRole("button", { name: /save install/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/installs"), { timeout: FIND_TIMEOUT });

    const equipmentCall = fetchMock.mock.calls.find(
      (call) =>
        new URL(String(call[0]), "http://localhost").pathname === "/api/equipment" &&
        (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(equipmentCall).toBeDefined();
    const body = JSON.parse((equipmentCall![1] as RequestInit).body as string);
    expect(body.customer_id).toBe("cust-1");
    expect(body.equip_tag).toBe(VALID_EQUIPMENT_VALUES.equip_tag);
    expect(body.model).toBe(VALID_EQUIPMENT_VALUES.model);
    expect(body.motor_kw).toBe(75);

    // No customer was created inline.
    const customerCreateCall = fetchMock.mock.calls.find(
      (call) =>
        new URL(String(call[0]), "http://localhost").pathname === "/api/customers" &&
        (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(customerCreateCall).toBeUndefined();
  }, TEST_TIMEOUT);

  it("creates a new customer inline, then creates the equipment record with the returned customer_id", async () => {
    const fetchMock = buildFetchMock({
      createCustomer: () => ({
        ok: true,
        status: 201,
        body: { data: { id: "brand-new-cust-id" } },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup({ delay: null });
    render(<EquipmentForm />);

    await user.click(screen.getByRole("button", { name: /\+ new customer/i }));

    await user.type(screen.getByLabelText(/^customer name\b/i), "Fresh Foods Ltd");
    await user.type(screen.getByLabelText(/^address\b/i), "42 New Street");
    await user.type(screen.getByLabelText(/^region\b/i), "Jakarta");
    await user.type(screen.getByLabelText(/^main contact\b/i), "Mr. New");

    await fillRequiredEquipmentFields(user);

    await user.click(screen.getByRole("button", { name: /save install/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/installs"), { timeout: FIND_TIMEOUT });

    const customerCallIndex = fetchMock.mock.calls.findIndex(
      (call) =>
        new URL(String(call[0]), "http://localhost").pathname === "/api/customers" &&
        (call[1] as RequestInit | undefined)?.method === "POST",
    );
    const equipmentCallIndex = fetchMock.mock.calls.findIndex(
      (call) =>
        new URL(String(call[0]), "http://localhost").pathname === "/api/equipment" &&
        (call[1] as RequestInit | undefined)?.method === "POST",
    );

    expect(customerCallIndex).toBeGreaterThanOrEqual(0);
    expect(equipmentCallIndex).toBeGreaterThan(customerCallIndex);

    const customerBody = JSON.parse(
      (fetchMock.mock.calls[customerCallIndex][1] as RequestInit).body as string,
    );
    expect(customerBody).toMatchObject({
      name: "Fresh Foods Ltd",
      address: "42 New Street",
      region: "Jakarta",
      main_contact: "Mr. New",
    });

    const equipmentBody = JSON.parse(
      (fetchMock.mock.calls[equipmentCallIndex][1] as RequestInit).body as string,
    );
    expect(equipmentBody.customer_id).toBe("brand-new-cust-id");
    expect(equipmentBody.equip_tag).toBe(VALID_EQUIPMENT_VALUES.equip_tag);
  }, TEST_TIMEOUT);

  it("blocks submission and shows an inline error when a required field is left blank, without calling the API", async () => {
    const fetchMock = buildFetchMock({
      searchCustomers: () => ({ data: { customers: [EXISTING_CUSTOMER] } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup({ delay: null });
    render(<EquipmentForm />);

    await selectExistingCustomer(user);

    // Leave "Brand" blank — every other required field is filled.
    await fillRequiredEquipmentFields(user, ["brand"]);

    await user.click(screen.getByRole("button", { name: /save install/i }));

    expect(
      await screen.findByText(/fix the highlighted fields/i, {}, { timeout: FIND_TIMEOUT }),
    ).toBeInTheDocument();
    expect(screen.getByText("This field is required")).toBeInTheDocument();

    const equipmentPostCall = fetchMock.mock.calls.find(
      (call) =>
        new URL(String(call[0]), "http://localhost").pathname === "/api/equipment" &&
        (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(equipmentPostCall).toBeUndefined();
    expect(pushMock).not.toHaveBeenCalled();
  }, TEST_TIMEOUT);

  it("surfaces a server-side rejection via an Alert, keeps the form data, and does not navigate", async () => {
    const fetchMock = buildFetchMock({
      searchCustomers: () => ({ data: { customers: [EXISTING_CUSTOMER] } }),
      createEquipment: () => ({
        ok: false,
        status: 400,
        body: { error: { code: "validation_error", message: "Motor KW must be a positive number." } },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup({ delay: null });
    render(<EquipmentForm />);

    await selectExistingCustomer(user);

    await fillRequiredEquipmentFields(user);

    await user.click(screen.getByRole("button", { name: /save install/i }));

    expect(
      await screen.findByText("Motor KW must be a positive number.", {}, { timeout: FIND_TIMEOUT }),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();

    // Entered data must still be there — nothing was cleared on failure.
    expect(screen.getByLabelText(/^equip tag\b/i)).toHaveValue(VALID_EQUIPMENT_VALUES.equip_tag);
    expect(screen.getByLabelText(/^model\b/i)).toHaveValue(VALID_EQUIPMENT_VALUES.model);
  }, TEST_TIMEOUT);
});
