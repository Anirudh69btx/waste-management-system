import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as adminApi from "@/api/admin";
import type { AdminUser } from "@/api/types";
import { RoleChangeModal } from "../components/RoleChangeModal";

vi.mock("@/api/admin", () => ({
  changeUserRole: vi.fn(),
}));

const sampleUser: AdminUser = {
  id: "user-gen-1",
  email: "supplier1@cwm.io",
  full_name: "Anirudh Sharma",
  role: "GENERATOR",
  organization_name: "Green Mill",
  phone_number: "+919000000002",
  is_active: true,
  is_verified: true,
  created_at: "2026-02-15T10:00:00Z",
  deactivation_reason: null,
  last_role_change_at: null,
};

describe("RoleChangeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables submit button when reason is shorter than 10 characters", () => {
    render(
      <RoleChangeModal
        open={true}
        onClose={vi.fn()}
        user={sampleUser}
        onChanged={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /update role/i });
    expect(submitBtn).toBeDisabled();

    const reasonInput = screen.getByLabelText(/reason for change/i);
    fireEvent.change(reasonInput, { target: { value: "Too short" } });
    expect(submitBtn).toBeDisabled();
  });

  it("calls changeUserRole when valid role and reason are submitted", async () => {
    const onChanged = vi.fn();
    const onClose = vi.fn();
    vi.mocked(adminApi.changeUserRole).mockResolvedValue({
      ...sampleUser,
      role: "RECYCLER",
    });

    render(
      <RoleChangeModal
        open={true}
        onClose={onClose}
        user={sampleUser}
        onChanged={onChanged}
      />
    );

    const roleSelect = screen.getByLabelText(/new role/i);
    fireEvent.change(roleSelect, { target: { value: "RECYCLER" } });

    const reasonInput = screen.getByLabelText(/reason for change/i);
    fireEvent.change(reasonInput, {
      target: { value: "Verified recycler facility documents" },
    });

    const submitBtn = screen.getByRole("button", { name: /update role/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminApi.changeUserRole).toHaveBeenCalledWith("user-gen-1", {
        new_role: "RECYCLER",
        reason: "Verified recycler facility documents",
      });
    });
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
