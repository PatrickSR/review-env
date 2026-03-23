import { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "react-router-dom"
import { usePageTitle } from "@/contexts/page-title"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircleIcon,
  PanelRightOpenIcon,
  PanelRightCloseIcon,
  ExternalLinkIcon,
  SquareIcon,
  RefreshCwIcon,
  Loader2Icon,
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

  // MR 验证状态
  const [mrValidation, setMrValidation] = useState<MrValidation | null>(null)
  const [validating, setValidating] = useState(true)

  // 容器状态
  const [containerStatus, setContainerStatus] = useState<ContainerStatus | null>(null)

  // 镜像列表
  const [images, setImages] = useState<ImageItem[]>([])
  const [startingImage, setStartingImage] = useState<number | null>(null)

  // 右侧面板
  const [panelOpen, setPanelOpen] = useState(false)

  // 轮询定时器
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

  // MR 验证通过后查询容器状态
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

  // 启动容器
  const startContainer = async (imageId: number) => {
    setStartingImage(imageId)
    try {
      const res = await fetch(`/mr/${projectId}/${mrIid}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      })
      if (res.ok) {
        // 启动后开始轮询
        setContainerStatus({ status: "creating" })
      }
    } catch {
      // 静默
    } finally {
      setStartingImage(null)
    }
  }

  // 停止容器
  const stopContainer = async () => {
    await fetch(`/mr/${projectId}/${mrIid}/stop`, { method: "POST" })
    setContainerStatus({ status: "not_found" })
  }

  // --- 渲染 ---

  // 加载中
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

  // MR 无效
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

  // ttyd iframe URL
  const ttydUrl =
    containerStatus?.status === "ready" && containerStatus.ports?.["7681"]
      ? `http://${location.hostname}:${containerStatus.ports["7681"]}/`
      : null

  return (
    <div className="flex flex-1 overflow-hidden -my-4 md:-my-6">
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 无容器：镜像选择 */}
        {containerStatus?.status === "not_found" && (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-2xl space-y-4">
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
          </div>
        )}

        {/* 容器初始化中 */}
        {(containerStatus?.status === "creating" || containerStatus?.status === "initializing") && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">
                {containerStatus.status === "creating" ? "正在创建容器..." : "正在初始化环境..."}
              </p>
            </div>
          </div>
        )}

        {/* 容器出错 */}
        {containerStatus?.status === "error" && (
          <div className="flex flex-1 items-center justify-center px-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircleIcon className="size-12 text-destructive" />
              <p className="text-lg font-medium">容器启动失败</p>
              <p className="text-muted-foreground">{containerStatus.error || "未知错误"}</p>
            </div>
          </div>
        )}

        {/* 终端 iframe */}
        {ttydUrl && (
          <iframe
            src={ttydUrl}
            className="flex-1 w-full border-0"
            title="终端"
          />
        )}

        {/* 初始加载容器状态 */}
        {!containerStatus && mrValidation?.valid && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" />
              <span>正在查询容器状态...</span>
            </div>
          </div>
        )}
      </div>

      {/* 右侧信息面板 */}
      {mrValidation?.valid && containerStatus && containerStatus.status !== "not_found" && (
        <div
          className={`border-l bg-background transition-all duration-200 flex flex-col shrink-0 ${
            panelOpen ? "w-[280px]" : "w-[40px]"
          }`}
        >
          {/* 展开/收起按钮 */}
          <button
            className="flex items-center justify-center h-10 hover:bg-accent transition-colors"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            {panelOpen ? (
              <PanelRightCloseIcon className="size-4" />
            ) : (
              <PanelRightOpenIcon className="size-4" />
            )}
          </button>

          {panelOpen && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
              {/* MR 信息 */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">MR 信息</p>
                <p className="font-medium truncate">!{mrIid} {mrValidation.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  分支: {mrValidation.source_branch}
                </p>
                {mrValidation.author && (
                  <p className="text-xs text-muted-foreground">作者: {mrValidation.author}</p>
                )}
              </div>

              {/* 端口映射 */}
              {containerStatus.ports && Object.keys(containerStatus.ports).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">端口映射</p>
                  <div className="space-y-1">
                    {Object.entries(containerStatus.ports)
                      .filter(([port]) => port !== "7681")
                      .map(([containerPort, hostPort]) => (
                        <a
                          key={containerPort}
                          href={`http://${location.hostname}:${hostPort}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs hover:underline text-primary"
                        >
                          <ExternalLinkIcon className="size-3" />
                          {containerPort} → {hostPort}
                        </a>
                      ))}
                  </div>
                </div>
              )}

              {/* 镜像信息 */}
              {containerStatus.image_display_name && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">当前镜像</p>
                  <p className="text-xs">{containerStatus.image_display_name}</p>
                </div>
              )}

              {/* 操作按钮 */}
              {containerStatus.status === "ready" && (
                <div className="space-y-2 pt-2">
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
