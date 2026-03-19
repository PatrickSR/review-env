import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContainerIcon, FolderIcon, GaugeIcon } from "lucide-react"

interface Stats {
  active_containers: number
  configured_projects: number
  max_containers: number
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
  }, [])

  if (!stats) {
    return (
      <div className="px-4 lg:px-6 text-muted-foreground">加载中...</div>
    )
  }

  const usagePercent =
    stats.max_containers > 0
      ? Math.round((stats.active_containers / stats.max_containers) * 100)
      : 0

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>活跃容器</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.active_containers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <ContainerIcon className="size-3" />
              {usagePercent}% 使用率
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            当前运行中的容器数量
          </div>
          <div className="text-muted-foreground">
            最大限制 {stats.max_containers} 个
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>已配置项目</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.configured_projects}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <FolderIcon className="size-3" />
              项目
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            已接入的 GitLab 项目
          </div>
          <div className="text-muted-foreground">
            每个项目可配置多个镜像
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>最大容器限制</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.max_containers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <GaugeIcon className="size-3" />
              上限
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            系统允许的最大并发容器数
          </div>
          <div className="text-muted-foreground">
            通过 MAX_CONTAINERS 环境变量配置
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
