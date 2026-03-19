import { useEffect, useState } from "react";

interface Container {
  id: number;
  project_name: string;
  gitlab_project_id: number;
  mr_iid: number;
  image_display_name: string;
  created_at: number;
  ports: Record<number, number>;
}

function formatDuration(createdAt: number): string {
  const seconds = Math.floor(Date.now() / 1000) - createdAt;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function Containers() {
  const [containers, setContainers] = useState<Container[]>([]);

  const load = () => {
    fetch("/api/containers").then((r) => r.json()).then(setContainers);
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const handleStop = async (id: number) => {
    if (!confirm("确定要停止此容器？")) return;
    await fetch(`/api/containers/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">容器监控</h1>
      <div className="bg-white rounded-lg border border-gray-200">
        {containers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无运行中的容器</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">项目</th>
                <th className="text-left p-3">MR</th>
                <th className="text-left p-3">镜像</th>
                <th className="text-left p-3">运行时长</th>
                <th className="text-right p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3">{c.project_name || "Unknown"}</td>
                  <td className="p-3">#{c.mr_iid}</td>
                  <td className="p-3 text-gray-600">{c.image_display_name || "Unknown"}</td>
                  <td className="p-3 text-gray-600">{formatDuration(c.created_at)}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleStop(c.id)} className="text-red-600 hover:underline text-xs">停止</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
