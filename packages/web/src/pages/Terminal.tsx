import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "react-router-dom"
import { usePageTitle } from "@/contexts/page-title"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  SquareIcon,
  Loader2Icon,
  MonitorIcon,
} from "lucide-react"
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

interface MrValidation {
  valid: boolean
  reason?: string
  title?: string
  source_branch?: string
  author?: string
}

interface ContainerStatus {
  status: "not_found" | "creating" | "initializing" | "ready" | "error"
  ports?: Record<string, number>
  error?: string
  container_id?: string
  image_display_name?: string
}

interface ImageItem {
  id: number
  name: string
  display_name: string
  image: string
}

export function Terminal() {
  const { projectId, mrIid } = useParams<{ projectId: string; mrIid: string }>()
  const { setTitle } = usePageTitle()

  const [mrValidation, setMrValidation] = useState<MrValidation | null>(null)
  const [validating, setValidating] = useState(true)
  const [containerStatus, setContainerStatus] = useState<ContainerStatus | null>(null)
  const [images, setImages] = useState<ImageItem[]>([])
  const [startingImage, setStartingImage] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 验证 MR
  useEffect(() => {
    setValidating(true)
    fetch(`/api/projects/${projectId}/mrs/${mrIid}/validate`)
      .then((r) => r.json())
      .then((data: MrValidation) => {
        setMrValidation(data)
        if (data.valid && data.title) {
          setTitle(`!${mrIid} ${data.title}`)
        }
        setValidating(false)
      })
      .catch(() => {
        setMrValidation({ valid: false, reason: "无法验证 MR 状态" })
        setValidating(false)
      })
  }, [projectId, mrIid])

  // 查询容器状态
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/mr/${projectId}/${mrIid}/status`)
      if (res.ok) {
        const data: ContainerStatus = await res.json()
        setContainerStatus(data)
        return data
      }
    } catch {
      // 静默
    }
    return null
  }, [projectId, mrIid])

  useEffect(() => {
    if (mrValidation?.valid) {
      fetchStatus()
    }
  }, [mrValidation, fetchStatus])

  // 容器状态轮询（creating/initializing 时每 2 秒轮询）
  useEffect(() => {
    if (
      containerStatus &&
      (containerStatus.status === "creating" || containerStatus.status === "initializing")
    ) {
      pollRef.current = setInterval(async () => {
        const data = await fetchStatus()
        if (data && data.status !== "creating" && data.status !== "initializing") {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }, 2000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [containerStatus?.status, fetchStatus])

  // 无容器时加载镜像列表
  useEffect(() => {
    if (containerStatus?.status === "not_found") {
      fetch(`/mr/${projectId}/${mrIid}/images`)
        .then((r) => r.json())
        .then(setImages)
        .catch(() => setImages([]))
    }
  }, [containerStatus?.status, projectId, mrIid])

  const startContainer = async (imageId: number) => {
    setStartingImage(imageId)
    try {
      const res = await fetch(`/mr/${projectId}/${mrIid}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      })
      if (res.ok) {
        setContainerStatus({ status: "creating" })
      }
    } catch {
      // 静默
    } finally {
      setStartingImage(null)
    }
  }

  const stopContainer = async () => {
    await fetch(`/mr/${projectId}/${mrIid}/stop`, { method: "POST" })
    setContainerStatus({ status: "not_found" })
  }

  const openIde = () => {
    const port = containerStatus?.ports?.["8080"]
    if (port) {
      window.open(`http://${location.hostname}:${port}/`, "_blank")
    }
  }

  // IDE URL
  const ideUrl =
    containerStatus?.status === "ready" && containerStatus.ports?.["8080"]
      ? `http://${location.hostname}:${containerStatus.ports["8080"]}/`
      : null

  // 应用端口（过滤掉 code-server 的 8080）
  const appPorts = containerStatus?.ports
    ? Object.entries(containerStatus.ports).filter(([port]) => port !== "8080")
    : []

  // --- 渲染 ---

  if (validating) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
          <span>正在验证 MR 状态...</span>
        </div>
      </div>
    )
  }

  if (mrValidation && !mrValidation.valid) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircleIcon className="size-12 text-destructive" />
          <p className="text-lg font-medium">无法访问该 MR</p>
          <p className="text-muted-foreground">
            {mrValidation.reason || "该 MR 已关闭或不存在，请检查 MR 状态"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* 无容器：镜像选择 */}
        {containerStatus?.status === "not_found" && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-medium">选择镜像启动环境</h2>
              <p className="text-sm text-muted-foreground">
                MR !{mrIid} — {mrValidation?.title}
              </p>
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {images.map((img) => (
                  <Card
                    key={img.id}
                    className="cursor-pointer transition-colors hover:bg-accent"
                    onClick={() => !startingImage && startContainer(img.id)}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">{img.display_name}</CardTitle>
                      <CardDescription className="text-xs font-mono truncate">
                        {img.image}
                      </CardDescription>
                      {startingImage === img.id && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Loader2Icon className="size-3 animate-spin" />
                          启动中...
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-sm">
                该项目尚未配置任何镜像，请联系管理员
              </div>
            )}
          </div>
        )}

        {/* 容器初始化中 */}
        {(containerStatus?.status === "creating" || containerStatus?.status === "initializing") && (
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">
              {containerStatus.status === "creating" ? "正在创建容器..." : "正在初始化环境..."}
            </p>
          </div>
        )}

        {/* 容器出错 */}
        {containerStatus?.status === "error" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircleIcon className="size-12 text-destructive" />
            <p className="text-lg font-medium">容器启动失败</p>
            <p className="text-muted-foreground">{containerStatus.error || "未知错误"}</p>
          </div>
        )}

        {/* 控制面板：容器就绪 */}
        {containerStatus?.status === "ready" && (
          <div className="space-y-6">
            {/* MR 信息 */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 text-sm text-emerald-600 font-medium">
                <span className="size-2 rounded-full bg-emerald-500" />
                运行中
              </div>
              <h2 className="text-lg font-medium">
                MR !{mrIid} — {mrValidation?.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                分支: {mrValidation?.source_branch}
                {mrValidation?.author && ` · 作者: ${mrValidation.author}`}
              </p>
              {containerStatus.image_display_name && (
                <p className="text-xs text-muted-foreground">
                  镜像: {containerStatus.image_display_name}
                </p>
              )}
            </div>

            {/* 打开 IDE 按钮 */}
            <div className="flex justify-center">
              <Button size="lg" className="gap-2" onClick={openIde} disabled={!ideUrl}>
                <MonitorIcon className="size-4" />
                打开 IDE
              </Button>
            </div>

            {ideUrl && (
              <p className="text-center text-xs text-muted-foreground font-mono">{ideUrl}</p>
            )}

            {/* 端口映射 */}
            {appPorts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">服务端口</p>
                <div className="space-y-1">
                  {appPorts.map(([containerPort, hostPort]) => (
                    <a
                      key={containerPort}
                      href={`http://${location.hostname}:${hostPort}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm hover:underline text-primary"
                    >
                      <ExternalLinkIcon className="size-3.5" />
                      {containerPort} → {hostPort}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 停止容器 */}
            <div className="pt-2">
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive" size="sm" className="w-full" />}
                >
                  <SquareIcon className="size-3 mr-1.5" />
                  停止容器
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认停止容器</AlertDialogTitle>
                    <AlertDialogDescription>
                      停止后容器数据将丢失，确定要继续吗？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={stopContainer}>确认停止</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {/* 初始加载容器状态 */}
        {!containerStatus && mrValidation?.valid && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
            <span>正在查询容器状态...</span>
          </div>
        )}
      </div>
    </div>
  )
}
