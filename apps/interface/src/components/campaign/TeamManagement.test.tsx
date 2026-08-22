import React from "react";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { TeamManagement } from "./TeamManagement";

const OWNER_ADDRESS = "GOWNER0000000000000000000000000000000000000000000000000";
const OTHER_ADDRESS = "GOTHER0000000000000000000000000000000000000000000000000";

const truncated = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

function renderPanel(currentUserAddress = OWNER_ADDRESS) {
  return render(
    <TeamManagement
      campaignId="CTEST123"
      currentUserAddress={currentUserAddress}
    />,
  );
}

describe("TeamManagement", () => {
  it("shows a loading state before team data resolves", () => {
    renderPanel();
    expect(screen.getByText(/loading team data/i)).toBeInTheDocument();
  });

  it("renders the connected owner as a team member once loaded", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Team Members \(1\)/i)).toBeInTheDocument(),
    );

    const row = within(screen.getByTestId(`team-member-${OWNER_ADDRESS}`));
    expect(row.getByText("Owner")).toBeInTheDocument();
    expect(row.getByText(truncated(OWNER_ADDRESS))).toBeInTheDocument();
  });

  it("shows all role permissions in the reference table", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Current Team")).toBeInTheDocument(),
    );

    const reference = within(screen.getByTestId("role-permissions-reference"));
    expect(
      reference.getByText("Role Permissions Reference"),
    ).toBeInTheDocument();
    expect(reference.getByText("Withdraw Funds")).toBeInTheDocument();
    expect(reference.getByText("Manage Delegations")).toBeInTheDocument();
    expect(reference.getByText("Multi-Sig")).toBeInTheDocument();
  });

  it("lets an owner invite a new member with a selected role", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "editor@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/invite role/i), {
      target: { value: "Editor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Invitation sent to editor@example.com"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /invitations/i }));

    await waitFor(() =>
      expect(screen.getByText("editor@example.com")).toBeInTheDocument(),
    );
    const invitationRow = within(
      screen
        .getByText("editor@example.com")
        .closest('[data-testid^="invitation-"]') as HTMLElement,
    );
    expect(invitationRow.getByText("Editor")).toBeInTheDocument();
  });

  it("shows a validation error when inviting with an empty email", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Email cannot be empty",
      ),
    );
  });

  it("hides the invite panel for a user who is neither owner nor admin", async () => {
    renderPanel(OTHER_ADDRESS);
    await waitFor(() =>
      expect(screen.getByText(/Team Members \(1\)/i)).toBeInTheDocument(),
    );

    // The connected address is not part of the mocked team, so it is neither
    // owner nor admin and the invite panel should not render at all.
    expect(screen.queryByText("Invite Team Member")).not.toBeInTheDocument();
  });

  it("hides the create-delegation panel for a user who is neither owner nor admin", async () => {
    renderPanel(OTHER_ADDRESS);
    await waitFor(() =>
      expect(screen.getByText(/Team Members \(1\)/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /delegations/i }));
    expect(screen.queryByText("Create Delegation")).not.toBeInTheDocument();
    expect(screen.getByText("No active delegations")).toBeInTheDocument();
  });

  it("does not show a remove button for the current user's own row", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Current Team")).toBeInTheDocument(),
    );

    expect(
      screen.queryByLabelText(`Remove ${OWNER_ADDRESS}`),
    ).not.toBeInTheDocument();
  });

  it("creates a delegation and lists it under Delegations", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /delegations/i }));
    fireEvent.change(screen.getByLabelText(/delegatee address/i), {
      target: { value: OTHER_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText(/^delegate role$/i), {
      target: { value: "Viewer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delegate/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Delegation created successfully"),
      ).toBeInTheDocument(),
    );

    const row = within(screen.getByTestId(`delegation-${OTHER_ADDRESS}`));
    expect(row.getByText(truncated(OTHER_ADDRESS))).toBeInTheDocument();
    expect(row.getByText("Viewer")).toBeInTheDocument();
  });

  it("revokes a delegation after confirming the dialog", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /delegations/i }));
    fireEvent.change(screen.getByLabelText(/delegatee address/i), {
      target: { value: OTHER_ADDRESS },
    });
    fireEvent.click(screen.getByRole("button", { name: /delegate/i }));
    await waitFor(() =>
      expect(
        screen.getByText("Delegation created successfully"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByLabelText(`Revoke delegation for ${OTHER_ADDRESS}`),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Revoke Delegation");

    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Delegation revoked successfully"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId(`delegation-${OTHER_ADDRESS}`),
    ).not.toBeInTheDocument();
  });

  it("cancelling the revoke dialog keeps the delegation active", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /delegations/i }));
    fireEvent.change(screen.getByLabelText(/delegatee address/i), {
      target: { value: OTHER_ADDRESS },
    });
    fireEvent.click(screen.getByRole("button", { name: /delegate/i }));
    await waitFor(() =>
      expect(
        screen.getByText("Delegation created successfully"),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByLabelText(`Revoke delegation for ${OTHER_ADDRESS}`),
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`delegation-${OTHER_ADDRESS}`),
    ).toBeInTheDocument();
  });

  it("copies an invitation code to the clipboard", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Invite Team Member")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "copy@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() =>
      expect(screen.getByText(/invitation sent/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: /invitations/i }));
    await waitFor(() =>
      expect(
        screen.getByLabelText(/copy invitation code for copy@example\.com/i),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByLabelText(/copy invitation code for copy@example\.com/i),
    );

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^inv_/),
    );
  });
});
