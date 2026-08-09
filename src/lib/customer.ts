import type { Customer } from "@/generated/prisma/client";

/** Full customer record, snake_case, per create_customer.yaml's CustomerItem. */
export function toCustomerItem(customer: Customer) {
  return {
    id: customer.id,
    no: customer.no,
    name: customer.name,
    bp_number: customer.bpNumber,
    unique_identifier: customer.uniqueIdentifier,
    address: customer.address,
    region: customer.region,
    territory: customer.territory,
    main_contact: customer.mainContact,
    contact_number: customer.contactNumber,
    email: customer.email,
    location: customer.location,
    fnb_or_yps: customer.fnbOrYps,
    psa_status: customer.psaStatus,
    psa_contract: customer.psaContract,
    psa_end_date: customer.psaEndDate?.toISOString() ?? null,
    sales_rep: customer.salesRep,
    ops_team: customer.opsTeam,
    created_at: customer.createdAt.toISOString(),
    updated_at: customer.updatedAt.toISOString(),
  };
}

/** Lightweight subset for the /new form's autocomplete, per search_customers.yaml's CustomerSummary. */
export function toCustomerSummary(customer: Customer) {
  return {
    id: customer.id,
    no: customer.no,
    name: customer.name,
    address: customer.address,
    region: customer.region,
    main_contact: customer.mainContact,
  };
}
