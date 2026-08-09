"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// Lightweight subset returned by GET /api/customers, per
// contracts/customers/search_customers.yaml's CustomerSummary.
interface CustomerSummary {
  id: string;
  no: number;
  name: string;
  address: string | null;
  region: string | null;
  main_contact: string | null;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  };
}

interface SearchCustomersResponse {
  data: { customers: CustomerSummary[] };
}

interface CreateCustomerResponse {
  data: { id: string };
}

interface CreateEquipmentResponse {
  data: { id: string };
}

type CustomerMode = "existing" | "new";

// String-keyed form state — every input is a controlled text/number/date
// field, converted to the right JSON type only when building the API payload
// (see buildCreateCustomerPayload/buildCreateEquipmentPayload below).
export interface CustomerFormValues {
  [key: string]: string;
  name: string;
  address: string;
  region: string;
  main_contact: string;
  territory: string;
  contact_number: string;
  email: string;
  location: string;
  fnb_or_yps: string;
  psa_status: string;
  psa_contract: string;
  psa_end_date: string;
  sales_rep: string;
  ops_team: string;
  bp_number: string;
  unique_identifier: string;
}

export interface EquipmentFormValues {
  [key: string]: string;
  equip_tag: string;
  model: string;
  compressor_type: string;
  serial_number: string;
  brand: string;
  motor_make_model: string;
  motor_serial: string;
  motor_kw: string;
  year_installed: string;
  year_commissioned: string;
  running_hours: string;
  last_service_date: string;
  comments: string;
  area_classification: string;
  equipment_sales_person: string;
  controller_type: string;
  oil_type: string;
  oil_charge: string;
  ref_type: string;
  ref_charge: string;
  detailed_comments: string;
  third_party_compressor_model: string;
  third_party_run_hours: string;
  third_party_psa_contract: string;
  condenser_make_model: string;
  ammonia_pump_make_model: string;
}

const initialCustomerValues: CustomerFormValues = {
  name: "",
  address: "",
  region: "",
  main_contact: "",
  territory: "",
  contact_number: "",
  email: "",
  location: "",
  fnb_or_yps: "",
  psa_status: "",
  psa_contract: "",
  psa_end_date: "",
  sales_rep: "",
  ops_team: "",
  bp_number: "",
  unique_identifier: "",
};

const initialEquipmentValues: EquipmentFormValues = {
  equip_tag: "",
  model: "",
  compressor_type: "",
  serial_number: "",
  brand: "",
  motor_make_model: "",
  motor_serial: "",
  motor_kw: "",
  year_installed: "",
  year_commissioned: "",
  running_hours: "",
  last_service_date: "",
  comments: "",
  area_classification: "",
  equipment_sales_person: "",
  controller_type: "",
  oil_type: "",
  oil_charge: "",
  ref_type: "",
  ref_charge: "",
  detailed_comments: "",
  third_party_compressor_model: "",
  third_party_run_hours: "",
  third_party_psa_contract: "",
  condenser_make_model: "",
  ammonia_pump_make_model: "",
};

interface FieldConfig<T> {
  name: keyof T & string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "int" | "date";
  multiline?: boolean;
  helper?: string;
}

// The 4 required + 12 optional customer-side fields from SPEC.md / the
// create_customer contract. Required fields are always visible; optional
// ones (plus the 2 "Internal Information" fields below) live behind a
// "Show more fields" Accordion so the common path (4 fields) stays fast.
const CUSTOMER_REQUIRED_FIELDS: FieldConfig<CustomerFormValues>[] = [
  { name: "name", label: "Customer Name", required: true },
  { name: "address", label: "Address", required: true },
  { name: "region", label: "Region", required: true },
  { name: "main_contact", label: "Main Contact", required: true },
];

const CUSTOMER_OPTIONAL_FIELDS: FieldConfig<CustomerFormValues>[] = [
  { name: "territory", label: "Territory" },
  { name: "contact_number", label: "Contact Number" },
  { name: "email", label: "Email" },
  { name: "location", label: "Location" },
  { name: "fnb_or_yps", label: "F&B / YPS" },
  { name: "psa_status", label: "PSA Status" },
  { name: "psa_contract", label: "PSA Contract" },
  { name: "psa_end_date", label: "PSA End Date", type: "date" },
  { name: "bp_number", label: "BP Number" },
  { name: "unique_identifier", label: "Unique Identifier" },
];

const CUSTOMER_INTERNAL_FIELDS: FieldConfig<CustomerFormValues>[] = [
  { name: "sales_rep", label: "Sales Rep" },
  { name: "ops_team", label: "Ops Team" },
];

// Matches EquipmentGrid.tsx's "Equipment" columnGroupingModel group.
const EQUIPMENT_FIELDS: FieldConfig<EquipmentFormValues>[] = [
  { name: "equip_tag", label: "Equip Tag", required: true },
  { name: "model", label: "Model", required: true },
  { name: "compressor_type", label: "Compressor Type", required: true },
  { name: "serial_number", label: "Serial Number", required: true },
  { name: "brand", label: "Brand (Manufacture)", required: true },
  { name: "motor_make_model", label: "Motor Make/Model", required: true },
  { name: "motor_serial", label: "Motor Serial", required: true },
  { name: "motor_kw", label: "Motor KW", required: true, type: "number" },
  { name: "year_installed", label: "Year Installed", type: "int" },
  { name: "year_commissioned", label: "Year Commissioned", type: "int" },
  { name: "running_hours", label: "Running Hours", type: "number" },
  { name: "last_service_date", label: "Last Service Date", type: "date" },
  { name: "comments", label: "Comments", multiline: true },
  { name: "area_classification", label: "Area Classification" },
  { name: "equipment_sales_person", label: "Equipment Sales Person" },
];

// Matches EquipmentGrid.tsx's "Detailed Information" columnGroupingModel group.
const DETAILED_FIELDS: FieldConfig<EquipmentFormValues>[] = [
  { name: "controller_type", label: "Controller Type", required: true },
  { name: "oil_type", label: "Oil Type", required: true },
  { name: "oil_charge", label: "Oil Charge" },
  { name: "ref_type", label: "Ref Type", required: true },
  { name: "ref_charge", label: "Ref Charge" },
  { name: "detailed_comments", label: "Detailed Comments", multiline: true },
];

// Matches EquipmentGrid.tsx's "3rd Party Equipment" columnGroupingModel group.
const THIRD_PARTY_FIELDS: FieldConfig<EquipmentFormValues>[] = [
  { name: "third_party_compressor_model", label: "3rd Party Compressor Model" },
  { name: "third_party_run_hours", label: "3rd Party Run Hours", type: "number" },
  { name: "third_party_psa_contract", label: "3rd Party PSA Contract" },
  { name: "condenser_make_model", label: "Condenser Make/Model" },
  { name: "ammonia_pump_make_model", label: "Ammonia Pump Make/Model" },
];

const REQUIRED_MESSAGE = "This field is required";

function validateFieldValue<T>(field: FieldConfig<T>, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return field.required ? REQUIRED_MESSAGE : null;
  }
  if (field.type === "int" && !/^-?\d+$/.test(trimmed)) {
    return "Must be a whole number";
  }
  if (field.type === "number" && Number.isNaN(Number(trimmed))) {
    return "Must be a number";
  }
  return null;
}

/** Validates just the customer side of the form, mode-aware. Exported for direct unit testing. */
export function validateCustomerForm(
  mode: CustomerMode,
  selectedCustomer: CustomerSummary | null,
  values: CustomerFormValues,
): Record<string, string> {
  if (mode === "existing") {
    return selectedCustomer
      ? {}
      : { customer: 'Select an existing customer, or switch to "New customer" to add one.' };
  }

  const errors: Record<string, string> = {};
  for (const field of CUSTOMER_REQUIRED_FIELDS) {
    const message = validateFieldValue(field, values[field.name]);
    if (message) errors[field.name] = message;
  }
  return errors;
}

/** Validates the equipment side of the form (all 26 fields). Exported for direct unit testing. */
export function validateEquipmentForm(values: EquipmentFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of [...EQUIPMENT_FIELDS, ...DETAILED_FIELDS, ...THIRD_PARTY_FIELDS]) {
    const message = validateFieldValue(field, values[field.name]);
    if (message) errors[field.name] = message;
  }
  return errors;
}

/** Builds the POST /api/customers body from CreateCustomerRequest's shape. Exported for testing. */
export function buildCreateCustomerPayload(values: CustomerFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    address: values.address.trim(),
    region: values.region.trim(),
    main_contact: values.main_contact.trim(),
  };

  const optionalStringFields: (keyof CustomerFormValues)[] = [
    "territory",
    "contact_number",
    "email",
    "location",
    "fnb_or_yps",
    "psa_status",
    "psa_contract",
    "sales_rep",
    "ops_team",
    "bp_number",
    "unique_identifier",
  ];
  for (const field of optionalStringFields) {
    const trimmed = values[field].trim();
    if (trimmed) payload[field] = trimmed;
  }

  const psaEndDate = values.psa_end_date.trim();
  if (psaEndDate) payload.psa_end_date = new Date(psaEndDate).toISOString();

  return payload;
}

/** Builds the POST /api/equipment body from CreateEquipmentRequest's shape. Exported for testing. */
export function buildCreateEquipmentPayload(
  values: EquipmentFormValues,
  customerId: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    customer_id: customerId,
    equip_tag: values.equip_tag.trim(),
    model: values.model.trim(),
    compressor_type: values.compressor_type.trim(),
    serial_number: values.serial_number.trim(),
    brand: values.brand.trim(),
    motor_make_model: values.motor_make_model.trim(),
    motor_serial: values.motor_serial.trim(),
    motor_kw: Number(values.motor_kw.trim()),
    controller_type: values.controller_type.trim(),
    oil_type: values.oil_type.trim(),
    ref_type: values.ref_type.trim(),
  };

  const optionalStringFields: (keyof EquipmentFormValues)[] = [
    "comments",
    "area_classification",
    "equipment_sales_person",
    "oil_charge",
    "ref_charge",
    "detailed_comments",
    "third_party_compressor_model",
    "third_party_psa_contract",
    "condenser_make_model",
    "ammonia_pump_make_model",
  ];
  for (const field of optionalStringFields) {
    const trimmed = values[field].trim();
    if (trimmed) payload[field] = trimmed;
  }

  const yearInstalled = values.year_installed.trim();
  if (yearInstalled) payload.year_installed = parseInt(yearInstalled, 10);

  const yearCommissioned = values.year_commissioned.trim();
  if (yearCommissioned) payload.year_commissioned = parseInt(yearCommissioned, 10);

  const runningHours = values.running_hours.trim();
  if (runningHours) payload.running_hours = Number(runningHours);

  const thirdPartyRunHours = values.third_party_run_hours.trim();
  if (thirdPartyRunHours) payload.third_party_run_hours = Number(thirdPartyRunHours);

  const lastServiceDate = values.last_service_date.trim();
  if (lastServiceDate) payload.last_service_date = new Date(lastServiceDate).toISOString();

  return payload;
}

async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const body: ApiErrorResponse | null = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

const SEARCH_DEBOUNCE_MS = 300;

export function EquipmentForm() {
  const router = useRouter();

  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerSummary[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  const [customerValues, setCustomerValues] = useState<CustomerFormValues>(initialCustomerValues);
  const [equipmentValues, setEquipmentValues] = useState<EquipmentFormValues>(initialEquipmentValues);

  const [customerErrors, setCustomerErrors] = useState<Record<string, string>>({});
  const [equipmentErrors, setEquipmentErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Debounced search-as-you-type against GET /api/customers, mirroring
  // EquipmentGrid's search-debounce pattern.
  useEffect(() => {
    if (customerMode !== "existing") return;

    const controller = new AbortController();

    async function searchCustomers() {
      setCustomerSearchLoading(true);
      try {
        const params = new URLSearchParams();
        if (customerSearchInput.trim()) params.set("search", customerSearchInput.trim());
        params.set("limit", "20");

        const response = await fetch(`/api/customers?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const body = (await response.json()) as SearchCustomersResponse;
        setCustomerOptions(body.data.customers);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        setCustomerSearchLoading(false);
      }
    }

    const timeout = setTimeout(searchCustomers, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [customerSearchInput, customerMode]);

  const handleCustomerModeChange = (mode: CustomerMode) => {
    setCustomerMode(mode);
    setCustomerErrors({});
    if (mode === "new") {
      setSelectedCustomer(null);
    }
  };

  const handleCustomerFieldChange = (name: keyof CustomerFormValues, value: string) => {
    setCustomerValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleEquipmentFieldChange = (name: keyof EquipmentFormValues, value: string) => {
    setEquipmentValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextCustomerErrors = validateCustomerForm(customerMode, selectedCustomer, customerValues);
    const nextEquipmentErrors = validateEquipmentForm(equipmentValues);

    if (Object.keys(nextCustomerErrors).length > 0 || Object.keys(nextEquipmentErrors).length > 0) {
      setCustomerErrors(nextCustomerErrors);
      setEquipmentErrors(nextEquipmentErrors);
      setFormError("Fix the highlighted fields before submitting.");
      setApiError(null);
      return;
    }

    setCustomerErrors({});
    setEquipmentErrors({});
    setFormError(null);
    setApiError(null);
    setSubmitting(true);

    try {
      let customerId: string;

      if (customerMode === "existing") {
        // Validated above: selectedCustomer is non-null whenever mode is "existing".
        customerId = (selectedCustomer as CustomerSummary).id;
      } else {
        const response = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildCreateCustomerPayload(customerValues)),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, "Failed to create the customer."));
        }
        const body = (await response.json()) as CreateCustomerResponse;
        customerId = body.data.id;
      }

      const equipmentResponse = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateEquipmentPayload(equipmentValues, customerId)),
      });
      if (!equipmentResponse.ok) {
        throw new Error(
          await readApiErrorMessage(equipmentResponse, "Failed to create the equipment record."),
        );
      }
      (await equipmentResponse.json()) as CreateEquipmentResponse;

      router.push("/installs");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
    >
      {apiError && <Alert severity="error">{apiError}</Alert>}
      {formError && <Alert severity="error">{formError}</Alert>}

      <Paper sx={{ p: 3 }} elevation={1}>
        <Typography variant="h6" component="h2" gutterBottom>
          Contact Information
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            variant={customerMode === "existing" ? "contained" : "outlined"}
            size="small"
            onClick={() => handleCustomerModeChange("existing")}
          >
            Existing customer
          </Button>
          <Button
            variant={customerMode === "new" ? "contained" : "outlined"}
            size="small"
            onClick={() => handleCustomerModeChange("new")}
          >
            + New customer
          </Button>
        </Stack>

        {customerMode === "existing" ? (
          <Autocomplete<CustomerSummary>
            options={customerOptions}
            loading={customerSearchLoading}
            value={selectedCustomer}
            onChange={(_event, value) => setSelectedCustomer(value)}
            inputValue={customerSearchInput}
            onInputChange={(_event, value) => setCustomerSearchInput(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            filterOptions={(options) => options}
            noOptionsText='No matching customers. Try "+ New customer" above to add one.'
            renderOption={(props, option) => {
              const { key, ...rest } = props as typeof props & { key: string };
              const detail = [option.address, option.region].filter(Boolean).join(", ");
              return (
                <li key={key} {...rest}>
                  {option.name}
                  {detail ? ` — ${detail}` : ""}
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for an existing customer"
                placeholder="Search by name or address"
                error={Boolean(customerErrors.customer)}
                helperText={customerErrors.customer ?? "Start typing a customer name or address"}
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        {customerSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        ) : (
          <Box className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CUSTOMER_REQUIRED_FIELDS.map((field) =>
                renderField(field, customerValues, customerErrors, (name, value) =>
                  handleCustomerFieldChange(name as keyof CustomerFormValues, value),
                ),
              )}
            </div>

            <Accordion disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Show more customer fields</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {CUSTOMER_OPTIONAL_FIELDS.map((field) =>
                      renderField(field, customerValues, customerErrors, (name, value) =>
                        handleCustomerFieldChange(name as keyof CustomerFormValues, value),
                      ),
                    )}
                  </div>
                  <Typography variant="subtitle2" color="text.secondary">
                    Internal Information
                  </Typography>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {CUSTOMER_INTERNAL_FIELDS.map((field) =>
                      renderField(field, customerValues, customerErrors, (name, value) =>
                        handleCustomerFieldChange(name as keyof CustomerFormValues, value),
                      ),
                    )}
                  </div>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3 }} elevation={1}>
        <Typography variant="h6" component="h2" gutterBottom>
          Equipment
        </Typography>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPMENT_FIELDS.map((field) =>
            renderField(field, equipmentValues, equipmentErrors, (name, value) =>
              handleEquipmentFieldChange(name as keyof EquipmentFormValues, value),
            ),
          )}
        </div>
      </Paper>

      <Paper sx={{ p: 3 }} elevation={1}>
        <Typography variant="h6" component="h2" gutterBottom>
          Detailed Information
        </Typography>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DETAILED_FIELDS.map((field) =>
            renderField(field, equipmentValues, equipmentErrors, (name, value) =>
              handleEquipmentFieldChange(name as keyof EquipmentFormValues, value),
            ),
          )}
        </div>
      </Paper>

      <Paper sx={{ p: 3 }} elevation={1}>
        <Typography variant="h6" component="h2" gutterBottom>
          3rd Party Equipment
        </Typography>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THIRD_PARTY_FIELDS.map((field) =>
            renderField(field, equipmentValues, equipmentErrors, (name, value) =>
              handleEquipmentFieldChange(name as keyof EquipmentFormValues, value),
            ),
          )}
        </div>
      </Paper>

      <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
        <Button type="submit" variant="contained" size="large" disabled={submitting}>
          {submitting ? "Saving..." : "Save Install"}
        </Button>
      </Stack>
    </Box>
  );
}

// Shared TextField renderer for both the customer and equipment sections.
// Takes a plain string-keyed record rather than being generic over
// CustomerFormValues/EquipmentFormValues directly — callers narrow their
// own onChange handler's field-name argument back to the right keyof type.
interface RenderableField {
  name: string;
  label: string;
  required?: boolean;
  type?: FieldConfig<unknown>["type"];
  multiline?: boolean;
  helper?: string;
}

function renderField(
  field: RenderableField,
  values: Record<string, string>,
  errors: Record<string, string>,
  onChange: (name: string, value: string) => void,
) {
  const rawValue = values[field.name];
  const errorMessage = errors[field.name];
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(field.name, event.target.value);

  if (field.type === "date") {
    return (
      <TextField
        key={field.name}
        label={field.label}
        required={field.required}
        fullWidth
        size="small"
        type="date"
        value={rawValue}
        onChange={handleChange}
        error={Boolean(errorMessage)}
        helperText={errorMessage ?? field.helper}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    );
  }

  if (field.type === "number" || field.type === "int") {
    return (
      <TextField
        key={field.name}
        label={field.label}
        required={field.required}
        fullWidth
        size="small"
        type="number"
        value={rawValue}
        onChange={handleChange}
        error={Boolean(errorMessage)}
        helperText={errorMessage ?? field.helper}
        slotProps={{ htmlInput: field.type === "int" ? { step: 1 } : { step: "any" } }}
      />
    );
  }

  return (
    <TextField
      key={field.name}
      label={field.label}
      required={field.required}
      fullWidth
      size="small"
      value={rawValue}
      onChange={handleChange}
      error={Boolean(errorMessage)}
      helperText={errorMessage ?? field.helper}
      multiline={field.multiline}
      minRows={field.multiline ? 2 : undefined}
    />
  );
}
