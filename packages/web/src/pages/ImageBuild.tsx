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

const TOOLS = [
  { id: "claude-code", label: "Claude Code", description: "Anthropic AI 编码助手" },
]

const RUNTIMES = [
  { id: "node", label: "Node", description: "node:22" },
  { id: "python", label: "Python", description: "python:3.12" },
]

type BuildState = "idle" | "building" | "success" | "error"

export function ImageBuild() {
  const navigate = useNavigate()
  const [tool, setTool] = useState("claude-code")
  const [runtime, setRuntime] = useState("node")
  const [name, setName] = useState("claude-code-node")
  const [tag, setTag] = useState("latest")
  const [buildState, setBuildState] = useState<BuildState>("idle")
  const [logs, setLogs] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-generate name when tool/runtime changes
  useEffect(() => {
    setName(`${tool}-${runtime}`)
  }, [tool, runtime])

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
        body: JSON.stringify({ tool, runtime, name, tag }),
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

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const event = line.slice(7)
            // Next line should be data
            continue
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.message) {
                setLogs((prev) => [...prev, data.message])
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      // Check last event type from logs
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
              <CardTitle>AI 工具</CardTitle>
              <CardDescription>选择要安装的 AI 编码工具</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {TOOLS.map((t) => (
                  <div
                    key={t.id}
                    className={`cursor-pointer rounded-lg border p-4 min-w-[160px] transition-colors ${
                      tool === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setTool(t.id)}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>运行环境</CardTitle>
              <CardDescription>选择容器的基础运行环境</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {RUNTIMES.map((r) => (
                  <div
                    key={r.id}
                    className={`cursor-pointer rounded-lg border p-4 min-w-[160px] transition-colors ${
                      runtime === r.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setRuntime(r.id)}
                  >
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.description}</div>
                  </div>
                ))}
              </div>
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

          <Button className="self-start" onClick={startBuild} disabled={!name}>
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
