import { useEffect, useState, useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { SquareIcon } from "lucide-react"

interface Container {
  id: number
  project_name: string
  gitlab_project_id: number
  mr_iid: number
  image_display_name: string
  created_at: number
  ports: Record<number, number>
}

function formatDuration(createdAt: number): string {
  const seconds = Math.floor(Date.now() / 1000) - createdAt
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function Containers() {
  const [containers, setContainers] = useState<Container[]>([])

  const load = () => {
    fetch("/api/containers").then((r) => r.json()).then(setContainers)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  const handleStop = async (id: number) => {
    await fetch(`/api/containers/${id}`, { method: "DELETE" })
    load()
  }

  const columns = useMemo<ColumnDef<Container>[]>(() => [
    {
      accessorKey: "project_name",
      header: "项目",
      cell: ({ row }) => row.original.project_name || "Unknown",
    },
    {
      accessorKey: "mr_iid",
      header: "MR",
      cell: ({ row }) => `#${row.original.mr_iid}`,
    },
    {
      accessorKey: "image_display_name",
      header: "镜像",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.image_display_name || "Unknown"}</span>
      ),
    },
    {
      id: "duration",
      header: "运行时长",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDuration(row.original.created_at)}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="ghost" size="sm" className="text-destructive" />}
            >
              <SquareIcon />
              停止
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确定要停止此容器？</AlertDialogTitle>
                <AlertDialogDescription>
                  停止项目「{row.original.project_name}」的 MR #{row.original.mr_iid} 容器后，用户将无法继续使用该开发环境。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleStop(row.original.id)}>
                  停止
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ], [])

  const table = useReactTable({
    data: containers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
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
                  暂无运行中的容器
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
