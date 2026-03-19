import { useEffect, useState } from "react";

interface Stats {
  active_containers: number;
  configured_projects: number;
  max_containers: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return <div className="text-gray-500">加载中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">概览</h1>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="活跃容器" value={stats.active_containers} />
        <StatCard label="已配置项目" value={stats.configured_projects} />
        <StatCard label="最大容器限制" value={stats.max_containers} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
