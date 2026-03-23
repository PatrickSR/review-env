import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  LayoutDashboardIcon,
  FolderIcon,
  ContainerIcon,
  TerminalSquareIcon,
  BoxIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  CircleIcon,
} from "lucide-react"

interface Project {
  id: number
  name: string
  gitlab_project_id: number
}

interface MrItem {
  iid: number
  title: string
  source_branch: string
  author: string
  web_url: string
  has_container: boolean
}

interface Container {
  project_id?: number
  gitlab_project_id?: number
  mr_iid?: number
}

const globalNav = [
  { title: "首页", url: "/", icon: <LayoutDashboardIcon /> },
  { title: "项目管理", url: "/projects", icon: <FolderIcon /> },
  { title: "镜像管理", url: "/images", icon: <BoxIcon /> },
  { title: "容器监控", url: "/containers", icon: <ContainerIcon /> },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ projectId: string; mrIid: string }>()

  const [projects, setProjects] = useState<Project[]>([])
  const [containers, setContainers] = useState<Container[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())
  const [mrCache, setMrCache] = useState<Record<number, MrItem[]>>({})
  const [loadingMrs, setLoadingMrs] = useState<Set<number>>(new Set())

  // 初始加载：项目列表 + 容器列表
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects).catch(() => {})
    fetch("/api/containers").then((r) => r.json()).then(setContainers).catch(() => {})
  }, [])

  // 获取项目的 MR 列表
  const fetchMrs = useCallback(async (projectId: number) => {
    setLoadingMrs((prev) => new Set(prev).add(projectId))
    try {
      const res = await fetch(`/api/projects/${projectId}/mrs`)
      if (res.ok) {
        const mrs: MrItem[] = await res.json()
        setMrCache((prev) => ({ ...prev, [projectId]: mrs }))
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingMrs((prev) => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })
    }
  }, [])

  // 展开/收起项目
  const toggleProject = useCallback((projectId: number) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
        // 首次展开时获取 MR 列表
        if (!mrCache[projectId]) {
          fetchMrs(projectId)
        }
      }
      return next
    })
  }, [mrCache, fetchMrs])

  // 刷新项目 MR 列表（清除缓存重新请求）
  const refreshMrs = useCallback((e: React.MouseEvent, projectId: number) => {
    e.stopPropagation()
    fetchMrs(projectId)
  }, [fetchMrs])

  // 当前终端页面的 projectId 和 mrIid（用于高亮）
  const activeGitlabProjectId = location.pathname.startsWith("/mr/") ? Number(params.projectId) : null
  const activeMrIid = location.pathname.startsWith("/mr/") ? Number(params.mrIid) : null

  const navMainWithActive = globalNav.map((item) => ({
    ...item,
    isActive:
      item.url === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.url),
    onClick: () => navigate(item.url),
  }))

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              onClick={() => navigate("/")}
            >
              <TerminalSquareIcon className="size-5!" />
              <span className="text-base font-semibold">Review Env</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* 上半部分：项目 + MR 树 */}
        <SidebarGroup>
          <SidebarGroupLabel>项目</SidebarGroupLabel>
          <SidebarMenu>
            {projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id)
              const isLoading = loadingMrs.has(project.id)
              const mrs = mrCache[project.id]
              const isActiveProject = activeGitlabProjectId === project.gitlab_project_id

              return (
                <SidebarMenuItem key={project.id} className="group/menu-item">
                  <SidebarMenuButton
                    onClick={() => toggleProject(project.id)}
                    isActive={isActiveProject}
                  >
                    <ChevronRightIcon
                      className={`size-4 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                    <span className="truncate">{project.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover onClick={(e) => refreshMrs(e, project.id)}>
                    <RefreshCwIcon className={`transition-transform ${isLoading ? "animate-spin" : ""}`} />
                  </SidebarMenuAction>

                  {isExpanded && (
                    <SidebarMenuSub>
                      {isLoading && !mrs ? (
                        <SidebarMenuSubItem>
                          <div className="px-2 py-1 space-y-1.5">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                          </div>
                        </SidebarMenuSubItem>
                      ) : mrs && mrs.length > 0 ? (
                        mrs.map((mr) => (
                          <SidebarMenuSubItem key={mr.iid}>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <SidebarMenuSubButton
                                    isActive={isActiveProject && activeMrIid === mr.iid}
                                    onClick={() => navigate(`/mr/${project.gitlab_project_id}/${mr.iid}`)}
                                  />
                                }
                              >
                                {mr.has_container && (
                                  <CircleIcon className="size-2 shrink-0 fill-green-500 text-green-500" />
                                )}
                                <span className="truncate">!{mr.iid} {mr.title}</span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[240px]">
                                !{mr.iid} {mr.title}
                              </TooltipContent>
                            </Tooltip>
                          </SidebarMenuSubItem>
                        ))
                      ) : mrs && mrs.length === 0 ? (
                        <SidebarMenuSubItem>
                          <span className="px-2 py-1 text-xs text-muted-foreground">暂无 Open MR</span>
                        </SidebarMenuSubItem>
                      ) : null}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )
            })}
            {projects.length === 0 && (
              <SidebarMenuItem>
                <span className="px-2 py-1 text-xs text-muted-foreground">暂无项目</span>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* 下半部分：全局导航 */}
        <NavMain items={navMainWithActive} />
      </SidebarContent>
    </Sidebar>
  )
}
