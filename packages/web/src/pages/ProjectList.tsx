import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Project {
  id: number;
  name: string;
  gitlab_project_id: number;
  project_path: string;
}

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);

  const loadProjects = () => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  };

  useEffect(() => { loadProjects(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此项目？关联的容器将被停止。")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    loadProjects();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">项目管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          添加项目
        </button>
      </div>

      {showForm && <AddProjectForm onDone={() => { setShowForm(false); loadProjects(); }} />}

      <div className="bg-white rounded-lg border border-gray-200">
        {projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">暂无项目</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">名称</th>
                <th className="text-left p-3">GitLab 路径</th>
                <th className="text-left p-3">Project ID</th>
                <th className="text-right p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link to={`/projects/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link>
                  </td>
                  <td className="p-3 text-gray-600">{p.project_path}</td>
                  <td className="p-3 text-gray-600">{p.gitlab_project_id}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">删除</button>
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

function AddProjectForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: "", gitlab_project_id: "", project_path: "",
    gitlab_pat: "", webhook_secret: "",
    git_user_name: "review-bot", git_user_email: "review-bot@company.com",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, gitlab_project_id: Number(form.gitlab_project_id) }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "创建失败");
      return;
    }
    onDone();
  };

  const fields = [
    { key: "name", label: "项目名称", required: true },
    { key: "gitlab_project_id", label: "GitLab Project ID", required: true },
    { key: "project_path", label: "项目路径 (group/project)", required: true },
    { key: "gitlab_pat", label: "GitLab PAT", required: true },
    { key: "webhook_secret", label: "Webhook Secret", required: true },
    { key: "git_user_name", label: "Git 用户名" },
    { key: "git_user_email", label: "Git 邮箱" },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs text-gray-600">{f.label}{f.required && " *"}</span>
            <input
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
              value={(form as any)[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              required={f.required}
            />
          </label>
        ))}
      </div>
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      <div className="flex gap-2 mt-3">
        <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded text-sm">创建</button>
        <button type="button" onClick={onDone} className="text-gray-600 text-sm">取消</button>
      </div>
    </form>
  );
}
