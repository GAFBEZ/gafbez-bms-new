import Link from "next/link";
import { Pencil } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { StaffMember } from "@/types";

interface StaffTableProps {
  staff: StaffMember[];
  currentUserId: string;
}

function RoleBadge({ role }: { role: StaffMember["role"] }) {
  return (
    <span
      className={
        role === "admin"
          ? "rounded-full bg-brand-gold-soft px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
          : "rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400"
      }
    >
      {role === "admin" ? "Admin" : "Staff"}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "rounded-full bg-green-50 dark:bg-green-950/40 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400"
          : "rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400"
      }
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function StaffTable({ staff, currentUserId }: StaffTableProps) {
  if (staff.length === 0) {
    return (
      <EmptyState
        title="No staff profiles yet"
        description="Staff profiles are created automatically once you add a login for someone in the Supabase Dashboard."
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3 sm:hidden">
        {staff.map((member) => (
          <li
            key={member.id}
            className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                  {member.fullName || "Unnamed staff member"}
                  {member.id === currentUserId && (
                    <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(You)</span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">{member.email ?? "—"}</p>
              </div>
              <Link
                href={`/dashboard/staff-management/${member.id}/edit`}
                aria-label={`Edit ${member.fullName || member.email || "staff member"}`}
                className="shrink-0 rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">{member.branchName ?? "No branch"}</span>
              <RoleBadge role={member.role} />
              <StatusBadge isActive={member.isActive} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm sm:block">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th scope="col" className="px-4 py-3 font-medium">
              Staff
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Branch
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Role
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {staff.map((member) => (
            <tr key={member.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {member.fullName || "Unnamed staff member"}
                  {member.id === currentUserId && (
                    <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(You)</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{member.email ?? "—"}</p>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{member.branchName ?? "—"}</td>
              <td className="px-4 py-3">
                <RoleBadge role={member.role} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge isActive={member.isActive} />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/staff-management/${member.id}/edit`}
                  aria-label={`Edit ${member.fullName || member.email || "staff member"}`}
                  className="rounded-md p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
