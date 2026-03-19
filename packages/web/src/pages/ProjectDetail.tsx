import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface Project {
  id: number;
  name: string;
  gitlab_url: string;
  gitlab_project_id: number;
  project_path: string;
  gitlab_pat: string;
  webhook_secret: string;
  git_user_name: string;
  git_user_email: string;
}

interface ProjectImage {
  id: number;
  name: string;
  display_name: string;
  image: string;
  env_vars: string;
  sort_order: number;
  enabled: number;
}

export function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Project>>({});
  const [showImageForm, setShowImageForm] = useState(false);

  const load = () => {
    fetch(`/api/projects/${id}`).then((r) => r.json()).then((p) => { setProject(p); setForm(p); });
    fetch(`/api/projects/${id}/images`).then((r) => r.json()).then(setImages);
  };

  useEffect(() => { load(); }, [id]);

  const saveProject = async () => {
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditing(false);
    load();
  };

  const toggleImage = async (img: ProjectImage) => {
    await fetch(`/api/projects/${id}/images/${img.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: img.enabled ? 0 : 1 }),
    });
    load();
  };

  const deleteImage = async (imgId: number) => {
    if (!confirm("确定删除此镜像配置？")) return;
    await fetch(`/api/projects/${id}/images/${imgId}`, { method: "DELETE" });
    load();
  };

  if (!project) return <div className="text-gray-500">加载中...</div>;

  const projectFields = [
    { key: "name", label: "名称" },
    { key: "project_path", label: "项目路径" },
    { key: "gitlab_pat", label: "GitLab PAT" },
    { key: "webhook_secret", label: "Webhook Secret" },
    { key: "git_user_name", label: "Git 用户名" },
    { key: "git_user_email", label: "Git 邮箱" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{project.name}</h1>

      <section className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">项目配置</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-blue-600 text-sm">编辑</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveProject} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">保存</button>
              <button onClick={() => { setEditing(false); setForm(project); }} className="text-gray-600 text-sm">取消</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">GitLab Project ID:</span> {project.gitlab_project_id}</div>
          {projectFields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-gray-500 text-xs">{f.label}</span>
              {editing ? (
                <input
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                  value={(form as any)[f.key] || ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <div className="mt-1">{(project as any)[f.key]}</div>
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">镜像配置</h2>
          <button
            onClick={() => setShowImageForm(!showImageForm)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            添加镜像
          </button>
        </div>

        {showImageForm && (
          <AddImageForm projectId={Number(id)} onDone={() => { setShowImageForm(false); load(); }} />
        )}

        {images.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center">暂无镜像配置</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-2">显示名</th>
                <th className="text-left p-2">标识</th>
                <th className="text-left p-2">镜像</th>
                <th className="text-center p-2">状态</th>
                <th className="text-right p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {images.map((img) => (
                <tr key={img.id} className="border-b last:border-0">
                  <td className="p-2">{img.display_name}</td>
                  <td className="p-2 text-gray-600">{img.name}</td>
                  <td className="p-2 text-gray-600 text-xs">{img.image}</td>
                  <td className="p-2 text-center">
                    <button onClick={() => toggleImage(img)} className={`text-xs px-2 py-0.5 rounded ${img.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {img.enabled ? "已启用" : "已禁用"}
                    </button>
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => deleteImage(img.id)} className="text-red-600 text-xs">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function AddImageForm({ projectId, onDone }: { projectId: number; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", display_name: "", image: "", env_vars: "{}" });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "创建失败");
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded p-3 mb-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-600">标识名 *</span>
          <input className="w-full border rounded px-2 py-1 text-sm mt-1" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">显示名 *</span>
          <input className="w-full border rounded px-2 py-1 text-sm mt-1" value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Docker 镜像 *</span>
          <input className="w-full border rounded px-2 py-1 text-sm mt-1" value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">环境变量 (JSON)</span>
          <input className="w-full border rounded px-2 py-1 text-sm mt-1" value={form.env_vars}
            onChange={(e) => setForm({ ...form, env_vars: e.target.value })} />
        </label>
      </div>
      {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      <div className="flex gap-2 mt-2">
        <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm">创建</button>
        <button type="button" onClick={onDone} className="text-gray-600 text-sm">取消</button>
      </div>
    </form>
  );
}
