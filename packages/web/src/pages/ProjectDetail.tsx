import { useEffect, useState, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EllipsisVerticalIcon, PlusIcon, Trash2Icon, PencilIcon, SaveIcon, XIcon } from "lucide-react"

interface Project {
  id: number
  name: string
  gitlab_url: string
  gitlab_project_id: number
  project_path: string
  gitlab_pat: string
  webhook_secret: string
  git_user_name: string
  git_user_email: string
}

interface ProjectImage {
  id: number
  name: string
  display_name: string
  image: string
  env_vars: string
  ports: string
  sort_order: number
  enabled: number
}

export function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [images, setImages] = useState<ProjectImage[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Project>>({})
  const [deleteTarget, setDeleteTarget] = useState<ProjectImage | null>(null)
  const [editTarget, setEditTarget] = useState<ProjectImage | null>(null)

  const load = () => {
    fetch(`/api/projects/${id}`).then((r) => r.json()).then((p) => { setProject(p); setForm(p) })
    fetch(`/api/projects/${id}/images`).then((r) => r.json()).then(setImages)
  }

  useEffect(() => { load() }, [id])

  const saveProject = async () => {
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setEditing(false)
    load()
  }

  const toggleImage = async (img: ProjectImage) => {
    await fetch(`/api/projects/${id}/images/${img.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: img.enabled ? 0 : 1 }),
    })
    load()
  }

  const deleteImage = async (imgId: number) => {
    await fetch(`/api/projects/${id}/images/${imgId}`, { method: "DELETE" })
    load()
  }

  const projectFields = [
    { key: "name", label: "名称" },
    { key: "project_path", label: "项目路径（自动获取）", readOnly: true },
    { key: "gitlab_pat", label: "GitLab PAT" },
    { key: "webhook_secret", label: "Webhook Secret" },
    { key: "git_user_name", label: "Git 用户名" },
    { key: "git_user_email", label: "Git 邮箱" },
  ]

  const imageColumns = useMemo<ColumnDef<ProjectImage>[]>(() => [
    {
      accessorKey: "display_name",
      header: "显示名",
    },
    {
      accessorKey: "name",
      header: "标识",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "image",
      header: "镜像地址",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">{row.original.image}</span>
      ),
    },
    {
      accessorKey: "enabled",
      header: "状态",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className="cursor-pointer"
          onClick={() => toggleImage(row.original)}
        >
          {row.original.enabled ? "已启用" : "已禁用"}
        </Badge>
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
              <DropdownMenuItem onClick={() => toggleImage(row.original)}>
                {row.original.enabled ? "禁用" : "启用"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEditTarget(row.original)}>
                <PencilIcon />
                编辑
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(row.original)}>
                <Trash2Icon />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [id])

  const imageTable = useReactTable({
    data: images,
    columns: imageColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (!project) return <div className="text-muted-foreground px-4 lg:px-6">加载中...</div>

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>GitLab Project ID: {project.gitlab_project_id}</CardDescription>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              编辑
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveProject}>
                <SaveIcon />
                保存
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm(project) }}>
                <XIcon />
                取消
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {projectFields.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label htmlFor={`proj-${f.key}`}>{f.label}</Label>
                {editing && !("readOnly" in f && f.readOnly) ? (
                  <Input
                    id={`proj-${f.key}`}
                    value={(form as any)[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{(project as any)[f.key]}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>镜像配置</CardTitle>
            <CardDescription>管理该项目可用的开发环境镜像</CardDescription>
          </div>
          <ImageFormModal mode="create" projectId={Number(id)} onDone={load} />
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                {imageTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {imageTable.getRowModel().rows?.length ? (
                  imageTable.getRowModel().rows.map((row) => (
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
                    <TableCell colSpan={imageColumns.length} className="h-24 text-center">
                      暂无镜像配置
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除此镜像配置？</AlertDialogTitle>
            <AlertDialogDescription>
              删除镜像「{deleteTarget?.display_name}」后将无法恢复。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { deleteImage(deleteTarget.id); setDeleteTarget(null) } }}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editTarget && (
        <ImageFormModal
          mode="edit"
          projectId={Number(id)}
          image={editTarget}
          onDone={() => { setEditTarget(null); load() }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}

function ImageFormModal({
  mode,
  projectId,
  image,
  onDone,
  onClose,
}: {
  mode: "create" | "edit"
  projectId: number
  image?: ProjectImage
  onDone: () => void
  onClose?: () => void
}) {
  const [open, setOpen] = useState(mode === "edit")
  const [form, setForm] = useState({
    name: image?.name ?? "",
    display_name: image?.display_name ?? "",
    image: image?.image ?? "",
    ports: image?.ports ?? "",
  })
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>(() => {
    if (!image?.env_vars) return []
    try {
      const obj = JSON.parse(image.env_vars)
      return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }))
    } catch { return [] }
  })
  const [error, setError] = useState("")
  const [dockerImages, setDockerImages] = useState<{ name: string; tag: string }[]>([])
  const [imageSearch, setImageSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (open) {
      fetch("/api/docker/images").then((r) => r.json()).then((imgs: any[]) => {
        setDockerImages(imgs.map((i: any) => ({ name: i.name, tag: i.tag })))
      })
    }
  }, [open])

  const filteredImages = dockerImages.filter((img) => {
    const full = `${img.name}:${img.tag}`
    return full.toLowerCase().includes(imageSearch.toLowerCase())
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) onClose?.()
  }

  const handleSubmit = async () => {
    setError("")
    const envObj: Record<string, string> = {}
    for (const { key, value } of envVars) {
      if (key.trim()) envObj[key.trim()] = value
    }
    const body = { ...form, env_vars: JSON.stringify(envObj) }

    const url = mode === "edit"
      ? `/api/projects/${projectId}/images/${image!.id}`
      : `/api/projects/${projectId}/images`
    const method = mode === "edit" ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || (mode === "edit" ? "更新失败" : "创建失败"))
      return
    }
    setOpen(false)
    if (mode === "create") {
      setForm({ name: "", display_name: "", image: "", ports: "" })
      setEnvVars([])
    }
    onDone()
  }

  const title = mode === "edit" ? "编辑镜像" : "添加镜像"
  const description = mode === "edit" ? "修改开发环境镜像配置" : "为项目添加新的开发环境镜像配置"
  const submitLabel = mode === "edit" ? "保存" : "创建"

  const formContent = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 overflow-y-auto text-sm max-h-[60vh]">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="img-name">标识名 *</Label>
            <Input id="img-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="img-display">显示名 *</Label>
            <Input id="img-display" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-col gap-3 relative">
          <Label>Docker 镜像 *</Label>
          <Input
            value={form.image}
            placeholder="搜索或选择镜像..."
            onChange={(e) => {
              setForm({ ...form, image: e.target.value })
              setImageSearch(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => { setImageSearch(form.image); setShowDropdown(true) }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />
          {showDropdown && filteredImages.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
              {filteredImages.map((img, i) => (
                <div
                  key={i}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
                  onMouseDown={() => {
                    setForm({ ...form, image: `${img.name}:${img.tag}` })
                    setShowDropdown(false)
                  }}
                >
                  {img.name}:{img.tag}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="img-ports">映射端口</Label>
          <Input
            id="img-ports"
            value={form.ports}
            placeholder="3000, 5173, 8080"
            onChange={(e) => setForm({ ...form, ports: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">逗号分隔的端口号，容器创建时会自动映射到宿主机随机端口</p>
        </div>
        <div className="flex flex-col gap-3">
          <Label>环境变量</Label>
          <div className="flex flex-col gap-2">
            {envVars.map((env, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="变量名"
                  value={env.key}
                  onChange={(e) => {
                    const next = [...envVars]
                    next[i] = { ...next[i]!, key: e.target.value }
                    setEnvVars(next)
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="值"
                  value={env.value}
                  onChange={(e) => {
                    const next = [...envVars]
                    next[i] = { ...next[i]!, value: e.target.value }
                    setEnvVars(next)
                  }}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground"
                  onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}
            >
              <PlusIcon className="size-4 mr-1" />
              添加变量
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
        <Button onClick={handleSubmit}>{submitLabel}</Button>
      </DialogFooter>
    </>
  )

  if (mode === "edit") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">{formContent}</DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon />
        添加镜像
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">{formContent}</DialogContent>
    </Dialog>
  )
}
