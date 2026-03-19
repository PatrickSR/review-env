import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import { EllipsisVerticalIcon, PlusIcon, Trash2Icon, ExternalLinkIcon } from "lucide-react"

interface Project {
  id: number
  name: string
  gitlab_project_id: number
  project_path: string
}

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const navigate = useNavigate()

  const loadProjects = () => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects)
  }

  useEffect(() => { loadProjects() }, [])

  const handleDelete = async (id: number) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" })
    loadProjects()
  }

  const columns = useMemo<ColumnDef<Project>[]>(() => [
    {
      accessorKey: "name",
      header: "名称",
      cell: ({ row }) => (
        <Button
          variant="link"
          className="w-fit px-0 text-left text-foreground"
          onClick={() => navigate(`/projects/${row.original.id}`)}
        >
          {row.original.name}
        </Button>
      ),
    },
    {
      accessorKey: "project_path",
      header: "GitLab 路径",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.project_path}</span>
      ),
    },
    {
      accessorKey: "gitlab_project_id",
      header: "Project ID",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.gitlab_project_id}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="size-8 text-muted-foreground" />}
            >
              <EllipsisVerticalIcon />
              <span className="sr-only">操作</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => navigate(`/projects/${row.original.id}`)}>
                <ExternalLinkIcon />
                查看详情
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger
                  render={<DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()} />}
                >
                  <Trash2Icon />
                  删除
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确定要删除此项目？</AlertDialogTitle>
                    <AlertDialogDescription>
                      删除项目「{row.original.name}」将同时停止关联的容器并移除所有镜像配置。此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(row.original.id)}>
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [navigate])

  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div />
        <AddProjectDrawer onDone={loadProjects} />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  暂无项目
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AddProjectDrawer({ onDone }: { onDone: () => void }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    gitlab_project_id: "",
    project_path: "",
    gitlab_pat: "",
    webhook_secret: "",
    git_user_name: "",
    git_user_email: "",
  })
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    setError("")
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        gitlab_project_id: Number(form.gitlab_project_id),
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "创建失败")
      return
    }
    setOpen(false)
    setForm({ name: "", gitlab_project_id: "", project_path: "", gitlab_pat: "", webhook_secret: "", git_user_name: "", git_user_email: "" })
    onDone()
  }

  return (
    <Drawer direction={isMobile ? "bottom" : "right"} open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon />
          添加项目
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>添加项目</DrawerTitle>
          <DrawerDescription>填写项目信息以添加新的 GitLab 项目配置</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <div className="flex flex-col gap-3">
            <Label htmlFor="add-name">名称 *</Label>
            <Input id="add-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="add-project-id">GitLab Project ID *</Label>
              <Input id="add-project-id" type="number" value={form.gitlab_project_id} onChange={(e) => setForm({ ...form, gitlab_project_id: e.target.value })} />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="add-path">项目路径 *</Label>
              <Input id="add-path" value={form.project_path} onChange={(e) => setForm({ ...form, project_path: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="add-pat">GitLab PAT</Label>
            <Input id="add-pat" type="password" value={form.gitlab_pat} onChange={(e) => setForm({ ...form, gitlab_pat: e.target.value })} />
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="add-secret">Webhook Secret</Label>
            <Input id="add-secret" value={form.webhook_secret} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="add-git-name">Git 用户名</Label>
              <Input id="add-git-name" value={form.git_user_name} onChange={(e) => setForm({ ...form, git_user_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="add-git-email">Git 邮箱</Label>
              <Input id="add-git-email" value={form.git_user_email} onChange={(e) => setForm({ ...form, git_user_email: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DrawerFooter>
          <Button onClick={handleSubmit}>创建</Button>
          <DrawerClose asChild>
            <Button variant="outline">取消</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
