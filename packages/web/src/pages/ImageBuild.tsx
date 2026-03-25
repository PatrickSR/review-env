import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeftIcon, HammerIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"

const DEFAULT_DOCKERFILE = `FROM ghcr.io/patricksr/review-base:latest

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \\
    apt-get install -y nodejs && \\
    rm -rf /var/lib/apt/lists/*

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code
`

type BuildState = "idle" | "building" | "success" | "error"

export function ImageBuild() {
  const navigate = useNavigate()
  const [dockerfile, setDockerfile] = useState(DEFAULT_DOCKERFILE)
  const [name, setName] = useState("my-review-image")
  const [tag, setTag] = useState("latest")
  const [buildState, setBuildState] = useState<BuildState>("idle")
  const [logs, setLogs] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const startBuild = async () => {
    setBuildState("building")
    setLogs([])

    try {
      const res = await fetch("/api/docker/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dockerfile, name, tag }),
      })

      if (!res.ok || !res.body) {
        setBuildState("error")
        setLogs((prev) => [...prev, "请求失败"])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let currentEvent = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7)
            continue
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.message) {
                setLogs((prev) => [...prev, data.message])
              }
              if (currentEvent === "error") setBuildState("error")
              if (currentEvent === "complete") setBuildState("success")
            } catch { /* ignore parse errors */ }
            currentEvent = ""
          }
        }
      }

      setBuildState((prev) => prev === "building" ? "success" : prev)
    } catch {
      setBuildState("error")
      setLogs((prev) => [...prev, "构建连接失败"])
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/images")}>
          <ArrowLeftIcon />
        </Button>
        <h2 className="text-lg font-semibold">构建新镜像</h2>
      </div>

      {buildState === "idle" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Dockerfile</CardTitle>
              <CardDescription>编写或粘贴 Dockerfile 内容，基于 review-base 镜像扩展</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={dockerfile}
                onChange={(e) => setDockerfile(e.target.value)}
                className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y"
                placeholder="FROM ghcr.io/patricksr/review-base:latest"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>镜像信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="img-name">镜像名称</Label>
                  <Input id="img-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="img-tag">Tag</Label>
                  <Input id="img-tag" value={tag} onChange={(e) => setTag(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="self-start" onClick={startBuild} disabled={!name || !dockerfile.trim()}>
            <HammerIcon className="size-4 mr-1" />
            开始构建
          </Button>
        </>
      )}

      {buildState !== "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {buildState === "building" && "正在构建..."}
              {buildState === "success" && (
                <><CheckCircleIcon className="text-green-500" /> 构建成功</>
              )}
              {buildState === "error" && (
                <><XCircleIcon className="text-red-500" /> 构建失败</>
              )}
            </CardTitle>
            <CardDescription>{name}:{tag}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              ref={logRef}
              className="bg-zinc-950 text-zinc-300 rounded-lg p-4 font-mono text-xs max-h-[400px] overflow-y-auto"
            >
              {logs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap">{line}</div>
              ))}
              {buildState === "building" && (
                <div className="text-zinc-500 animate-pulse">▊</div>
              )}
            </div>
            {buildState !== "building" && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => navigate("/images")}>
                  返回镜像列表
                </Button>
                {buildState === "error" && (
                  <Button onClick={() => { setBuildState("idle"); setLogs([]) }}>
                    重新配置
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
