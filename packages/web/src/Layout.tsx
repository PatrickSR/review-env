import { Link, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { path: "/", label: "首页" },
  { path: "/projects", label: "项目管理" },
  { path: "/containers", label: "容器监控" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg text-gray-800">Review Env</span>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`text-sm px-3 py-1 rounded ${
              location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path))
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
