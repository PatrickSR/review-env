import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EllipsisVerticalIcon, PlusIcon, Trash2Icon, PlayIcon, XIcon } from "lucide-react"

interface DockerImage {
  id: string
  name: string
  tag: string
  size: number
  created: number
  managed: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTime(epoch: number): string {
  const d = new Date(epoch * 1000)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return "刚刚"
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  return `${Math.floor(diff / 86400_000)} 天前`
}

export function Images() {
  const navigate = useNavigate()
  const [images, setImages] = useState<DockerImage[]>([])
  const [testContainer, setTestContainer] = useState<{ containerId: string; image: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DockerImage | null>(null)

  const load = () => {
    fetch("/api/docker/images").then((r) => r.json()).then(setImages)
  }

  useEffect(() => { load() }, [])

  const deleteImage = async (id: string) => {
    await fetch(`/api/docker/images/${encodeURIComponent(id)}`, { method: "DELETE" })
    load()
  }

  const [testReady, setTestReady] = useState(false)

  const startTest = async (imageName: string, tag: string) => {
    setTestLoading(true)
    setTestReady(false)
    try {
      const res = await fetch("/api/docker/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: `${imageName}:${tag}` }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestContainer({ containerId: data.containerId, image: `${imageName}:${tag}` })
        // Poll until ttyd is ready (use GET because ttyd doesn't support HEAD)
        const poll = async () => {
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 1000))
            try {
              const check = await fetch(`/api/docker/test/${data.containerId}/terminal/token`)
              if (check.ok) { setTestReady(true); return }
            } catch {}
          }
        }
        poll()
      }
    } finally {
      setTestLoading(false)
    }
  }

  const stopTest = async () => {
    if (!testContainer) return
    await fetch(`/api/docker/test/${testContainer.containerId}`, { method: "DELETE" })
    setTestContainer(null)
  }

  const columns = useMemo<ColumnDef<DockerImage>[]>(() => [
    {
      accessorKey: "name",
      header: "镜像名称",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.managed && <Badge variant="outline" className="text-xs">review</Badge>}
          <span>{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "tag",
      header: "Tag",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.tag}</span>,
    },
    {
      accessorKey: "size",
      header: "大小",
      cell: ({ row }) => <span className="text-muted-foreground">{formatSize(row.original.size)}</span>,
    },
    {
      accessorKey: "created",
      header: "创建时间",
      cell: ({ row }) => <span className="text-muted-foreground">{formatTime(row.original.created)}</span>,
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
              <DropdownMenuItem
                disabled={testLoading}
                onClick={() => startTest(row.original.name, row.original.tag)}
              >
                <PlayIcon />
                测试运行
              </DropdownMenuItem>
              {row.original.managed && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteTarget(row.original)}
                  >
                    <Trash2Icon />
                    删除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [testLoading])

  const table = useReactTable({
    data: images,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">镜像管理</h2>
        <Button onClick={() => navigate("/images/build")}>
          <PlusIcon />
          构建新镜像
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
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
                  暂无镜像
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除此镜像？</AlertDialogTitle>
            <AlertDialogDescription>
              删除镜像「{deleteTarget?.name}:{deleteTarget?.tag}」后将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { deleteImage(deleteTarget.id); setDeleteTarget(null) } }}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test container terminal overlay */}
      {testContainer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700">
            <span className="text-sm text-zinc-300">
              测试容器: {testContainer.image}
            </span>
            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={stopTest}>
              <XIcon className="size-4 mr-1" />
              停止并关闭
            </Button>
          </div>
          {testReady ? (
            <iframe
              className="flex-1 w-full border-none"
              src={`/api/docker/test/${testContainer.containerId}/terminal/`}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
              终端启动中...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
