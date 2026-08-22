import type { Metadata } from "next";
import {
  fetchApiStatus,
  HEALTH_COMPONENTS,
  type ComponentHealth,
} from "@/lib/graphql/client";

export const metadata: Metadata = { title: "System Status | Fund-My-Cause" };
export const revalidate = 30; // re-fetch every 30 seconds

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    healthy: "bg-green-100  text-green-800  border-green-300",
    degraded: "bg-yellow-100 text-yellow-800 border-yellow-300",
    unhealthy: "bg-red-100    text-red-800    border-red-300",
  };
  const dot: Record<string, string> = {
    healthy: "bg-green-500",
    degraded: "bg-yellow-500",
    unhealthy: "bg-red-500",
  };
  const icons: Record<string, string> = {
    healthy: "✓",
    degraded: "⚠",
    unhealthy: "✗",
  };
  const cls = colours[status] ?? colours.unhealthy;
  const d = dot[status] ?? dot.unhealthy;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      <span className={`h-2 w-2 rounded-full ${d}`} aria-hidden="true" />
      <span aria-hidden="true">{icons[status] ?? ""}</span>
      <span>{status}</span>
    </span>
  );
}

function ComponentRow({ name, data }: { name: string; data: ComponentHealth }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="capitalize text-sm font-medium text-gray-700">
        {name}
      </span>
      <div className="flex items-center gap-4">
        {data.latencyMs >= 0 && (
          <span className="text-xs text-gray-400">{data.latencyMs} ms</span>
        )}
        <StatusBadge status={data.status} />
      </div>
    </div>
  );
}

export default async function StatusPage() {
  const data = await fetchApiStatus();

  if (!data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">System Status</h1>
        <p className="text-gray-500">Unable to reach the API gateway.</p>
        <StatusBadge status="unhealthy" />
      </main>
    );
  }

  const uptimeH = Math.floor(data.uptime / 3600);
  const uptimeM = Math.floor((data.uptime % 3600) / 60);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">System Status</h1>
        <StatusBadge status={data.status} />
      </div>

      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white shadow-sm">
        {HEALTH_COMPONENTS.map((name) => (
          <ComponentRow key={name} name={name} data={data.components[name]} />
        ))}
      </div>

      <div className="mt-6 flex gap-6 text-xs text-gray-400">
        <span>Version {data.version}</span>
        <span>
          Uptime {uptimeH}h {uptimeM}m
        </span>
        <span>Updated {new Date(data.timestamp).toLocaleTimeString()}</span>
      </div>
    </main>
  );
}
