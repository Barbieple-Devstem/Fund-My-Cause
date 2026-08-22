"use client";

import React, { useState, useEffect } from "react";
import {
  Trash2,
  Plus,
  Copy,
  Check,
  X,
  Clock,
  Shield,
  Loader2,
} from "lucide-react";

type Role = "Owner" | "Admin" | "Editor" | "Viewer" | "Contributor";

interface TeamMember {
  address: string;
  role: Role;
  addedAt: number;
  expiresAt: number;
  isActive: boolean;
}

interface PendingInvitation {
  code: string;
  invitee: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
  accepted: boolean;
}

interface RoleDelegate {
  delegator: string;
  delegatee: string;
  role: Role;
  expiresAt: number;
  isActive: boolean;
}

interface TeamManagementProps {
  campaignId: string;
  currentUserAddress: string;
  onTeamUpdate?: () => void;
}

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  Owner: [
    "Create Campaign",
    "Edit Metadata",
    "Manage Team",
    "Withdraw Funds",
    "Approve Contributions",
    "Update Status",
    "Configure Settings",
    "Manage Delegations",
    "Multi-Sig",
    "View Analytics",
  ],
  Admin: [
    "Edit Metadata",
    "Manage Team",
    "Approve Contributions",
    "Update Status",
    "Configure Settings",
    "Multi-Sig",
    "View Analytics",
  ],
  Editor: ["Edit Metadata", "View Analytics"],
  Viewer: ["View Analytics"],
  Contributor: ["View Analytics", "Approve Contributions"],
};

const ROLE_COLORS: Record<Role, string> = {
  Owner: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Editor:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  Contributor:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const ADMIN_INVITE_ROLES: Role[] = ["Admin", "Editor", "Viewer", "Contributor"];
const DELEGATION_ROLES: Role[] = ["Editor", "Viewer", "Contributor"];
const DELEGATION_DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}
    >
      {role}
    </span>
  );
}

function ConfirmDialog({
  titleId,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  titleId: string;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TeamManagement({
  campaignId,
  currentUserAddress,
  onTeamUpdate,
}: TeamManagementProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingInvitation[]
  >([]);
  const [delegations, setDelegations] = useState<RoleDelegate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "members" | "invitations" | "delegations"
  >("members");

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Viewer");
  const [delegateAddress, setDelegateAddress] = useState("");
  const [delegateRole, setDelegateRole] = useState<Role>("Editor");
  const [delegateDuration, setDelegateDuration] = useState<string>("7");

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [memberToRevokeDelegation, setMemberToRevokeDelegation] = useState<
    string | null
  >(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch team data
  useEffect(() => {
    fetchTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      // This will be replaced with actual API call
      const mockMembers: TeamMember[] = [
        {
          address: currentUserAddress,
          role: "Owner",
          addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          expiresAt: 0,
          isActive: true,
        },
      ];
      setTeamMembers(mockMembers);
      setPendingInvitations([]);
      setDelegations([]);
      setError(null);
    } catch (err) {
      setError("Failed to load team data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      setError("Email cannot be empty");
      return;
    }

    try {
      const newInvitation: PendingInvitation = {
        code: `inv_${Math.random().toString(36).substr(2, 9)}`,
        invitee: inviteEmail,
        role: inviteRole,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        accepted: false,
      };

      setPendingInvitations((prev) => [...prev, newInvitation]);
      setInviteEmail("");
      setError(null);
      setSuccessMessage(`Invitation sent to ${inviteEmail}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      onTeamUpdate?.();
    } catch (err) {
      setError("Failed to send invitation");
      console.error(err);
    }
  };

  const handleRemoveMember = async (address: string) => {
    try {
      setTeamMembers((prev) => prev.filter((m) => m.address !== address));
      setMemberToRemove(null);
      setSuccessMessage("Member removed successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      onTeamUpdate?.();
    } catch (err) {
      setError("Failed to remove member");
      console.error(err);
    }
  };

  const handleCreateDelegation = async () => {
    if (!delegateAddress.trim()) {
      setError("Address cannot be empty");
      return;
    }

    try {
      const expiresAt =
        Date.now() + parseInt(delegateDuration, 10) * 24 * 60 * 60 * 1000;
      const newDelegation: RoleDelegate = {
        delegator: currentUserAddress,
        delegatee: delegateAddress,
        role: delegateRole,
        expiresAt,
        isActive: true,
      };

      setDelegations((prev) => [...prev, newDelegation]);
      setDelegateAddress("");
      setError(null);
      setSuccessMessage("Delegation created successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      onTeamUpdate?.();
    } catch (err) {
      setError("Failed to create delegation");
      console.error(err);
    }
  };

  const handleRevokeDelegation = async (delegatee: string) => {
    try {
      setDelegations((prev) => prev.filter((d) => d.delegatee !== delegatee));
      setMemberToRevokeDelegation(null);
      setSuccessMessage("Delegation revoked successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      onTeamUpdate?.();
    } catch (err) {
      setError("Failed to revoke delegation");
      console.error(err);
    }
  };

  const copyInvitationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString();

  const getDaysRemaining = (expiresAt: number) => {
    if (expiresAt === 0) return null;
    const days = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };

  const isOwner = teamMembers.some(
    (m) => m.address === currentUserAddress && m.role === "Owner",
  );
  const isAdmin =
    isOwner ||
    teamMembers.some(
      (m) => m.address === currentUserAddress && m.role === "Admin",
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team data...
      </div>
    );
  }

  const cardCls =
    "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";
  const inputCls =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";
  const selectCls = inputCls;

  const TABS: { key: typeof activeTab; label: string; count: number }[] = [
    { key: "members", label: "Team Members", count: teamMembers.length },
    {
      key: "invitations",
      label: "Invitations",
      count: pendingInvitations.length,
    },
    { key: "delegations", label: "Delegations", count: delegations.length },
  ];

  return (
    <div className="w-full space-y-4" data-testid="team-management">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
        >
          {successMessage}
        </div>
      )}

      <div
        role="tablist"
        aria-label="Team management"
        className="grid w-full grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow dark:bg-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Team Members Tab */}
      {activeTab === "members" && (
        <div className="space-y-4" role="tabpanel">
          {isAdmin && (
            <div className={cardCls}>
              <h3 className="mb-3 text-base font-semibold">
                Invite Team Member
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input
                  className={inputCls}
                  placeholder="Email address"
                  aria-label="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select
                  className={selectCls}
                  aria-label="Invite role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                >
                  {(!isOwner ? (["Viewer"] as Role[]) : ADMIN_INVITE_ROLES).map(
                    (role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ),
                  )}
                </select>
                <button
                  onClick={handleInviteMember}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 md:col-span-2"
                >
                  <Plus className="h-4 w-4" />
                  Send Invitation
                </button>
              </div>
            </div>
          )}

          <div className={cardCls}>
            <h3 className="mb-3 text-base font-semibold">Current Team</h3>
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.address}
                  data-testid={`team-member-${member.address}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">
                        {member.address.slice(0, 6)}...
                        {member.address.slice(-4)}
                      </code>
                      <RoleBadge role={member.role} />
                      {!member.isActive && (
                        <span className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-500 dark:border-gray-700">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Added {formatDate(member.addedAt)}
                      {member.expiresAt > 0 && (
                        <> • Expires {formatDate(member.expiresAt)}</>
                      )}
                    </p>
                  </div>
                  {isAdmin && member.address !== currentUserAddress && (
                    <button
                      aria-label={`Remove ${member.address}`}
                      onClick={() => setMemberToRemove(member.address)}
                      className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === "invitations" && (
        <div role="tabpanel">
          <div className={cardCls}>
            <h3 className="mb-3 text-base font-semibold">
              Pending Invitations
            </h3>
            {pendingInvitations.length === 0 ? (
              <p className="text-gray-500">No pending invitations</p>
            ) : (
              <div className="space-y-3">
                {pendingInvitations.map((invitation) => {
                  const daysRemaining = getDaysRemaining(invitation.expiresAt);
                  return (
                    <div
                      key={invitation.code}
                      data-testid={`invitation-${invitation.code}`}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{invitation.invitee}</p>
                          <RoleBadge role={invitation.role} />
                          {invitation.accepted && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs dark:border-green-800 dark:bg-green-950/40">
                              <Check className="h-3 w-3" />
                              Accepted
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Clock className="h-3 w-3" />
                          {daysRemaining && daysRemaining > 0
                            ? `Expires in ${daysRemaining} days`
                            : "Expired"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="max-w-xs truncate rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                          {invitation.code}
                        </code>
                        <button
                          aria-label={`Copy invitation code for ${invitation.invitee}`}
                          onClick={() => copyInvitationCode(invitation.code)}
                          className="rounded-lg p-2 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          {copiedCode === invitation.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delegations Tab */}
      {activeTab === "delegations" && (
        <div className="space-y-4" role="tabpanel">
          {isAdmin && (
            <div className={cardCls}>
              <h3 className="mb-3 text-base font-semibold">
                Create Delegation
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input
                  className={inputCls}
                  placeholder="Delegatee address"
                  aria-label="Delegatee address"
                  value={delegateAddress}
                  onChange={(e) => setDelegateAddress(e.target.value)}
                />
                <select
                  className={selectCls}
                  aria-label="Delegate role"
                  value={delegateRole}
                  onChange={(e) => setDelegateRole(e.target.value as Role)}
                >
                  {DELEGATION_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select
                  className={selectCls}
                  aria-label="Delegation duration"
                  value={delegateDuration}
                  onChange={(e) => setDelegateDuration(e.target.value)}
                >
                  {DELEGATION_DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleCreateDelegation}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  <Shield className="h-4 w-4" />
                  Delegate
                </button>
              </div>
            </div>
          )}

          <div className={cardCls}>
            <h3 className="mb-3 text-base font-semibold">Active Delegations</h3>
            {delegations.length === 0 ? (
              <p className="text-gray-500">No active delegations</p>
            ) : (
              <div className="space-y-3">
                {delegations.map((delegation) => {
                  const daysRemaining = getDaysRemaining(delegation.expiresAt);
                  return (
                    <div
                      key={delegation.delegatee}
                      data-testid={`delegation-${delegation.delegatee}`}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <code className="rounded bg-gray-100 px-2 py-1 text-sm dark:bg-gray-800">
                            {delegation.delegatee.slice(0, 6)}...
                            {delegation.delegatee.slice(-4)}
                          </code>
                          <RoleBadge role={delegation.role} />
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          Delegated by:{" "}
                          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
                            {delegation.delegator.slice(0, 6)}...
                            {delegation.delegator.slice(-4)}
                          </code>
                          {daysRemaining && daysRemaining > 0
                            ? ` • Expires in ${daysRemaining} days`
                            : " • Expired"}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          aria-label={`Revoke delegation for ${delegation.delegatee}`}
                          onClick={() =>
                            setMemberToRevokeDelegation(delegation.delegatee)
                          }
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permissions Reference */}
      <div className={cardCls} data-testid="role-permissions-reference">
        <h3 className="mb-3 text-base font-semibold">
          Role Permissions Reference
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(ROLE_PERMISSIONS) as [Role, string[]][]).map(
            ([role, permissions]) => (
              <div key={role} className="space-y-2">
                <h4
                  className={`rounded p-2 font-semibold ${ROLE_COLORS[role]}`}
                >
                  {role}
                </h4>
                <ul className="ml-2 space-y-1 text-sm">
                  {permissions.map((perm) => (
                    <li key={perm} className="flex items-start">
                      <Check className="mr-2 mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Confirm dialogs */}
      {memberToRemove && (
        <ConfirmDialog
          titleId="remove-member-title"
          title="Remove Team Member"
          description="Are you sure you want to remove this team member? They will no longer have access to this campaign."
          confirmLabel="Remove"
          onCancel={() => setMemberToRemove(null)}
          onConfirm={() => handleRemoveMember(memberToRemove)}
        />
      )}

      {memberToRevokeDelegation && (
        <ConfirmDialog
          titleId="revoke-delegation-title"
          title="Revoke Delegation"
          description="Are you sure you want to revoke this delegation? The delegatee will lose their delegated permissions."
          confirmLabel="Revoke"
          onCancel={() => setMemberToRevokeDelegation(null)}
          onConfirm={() => handleRevokeDelegation(memberToRevokeDelegation)}
        />
      )}
    </div>
  );
}
