import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NewEntryPage from "@/app/new/page";

describe("NewEntryPage", () => {
  it("renders the New Entry heading", () => {
    render(<NewEntryPage />);
    expect(screen.getByRole("heading", { name: /new entry/i })).toBeInTheDocument();
  });
});
