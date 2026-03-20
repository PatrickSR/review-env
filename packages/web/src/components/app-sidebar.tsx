import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  FolderIcon,
  ContainerIcon,
  TerminalSquareIcon,
  BoxIcon,
} from "lucide-react"

const data = {
  navMain: [
    {
      title: "首页",
      url: "/",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "项目管理",
      url: "/projects",
      icon: <FolderIcon />,
    },
    {
      title: "镜像管理",
      url: "/images",
      icon: <BoxIcon />,
    },
    {
      title: "容器监控",
      url: "/containers",
      icon: <ContainerIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const navigate = useNavigate()

  const navMainWithActive = data.navMain.map((item) => ({
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
        <NavMain items={navMainWithActive} />
      </SidebarContent>
    </Sidebar>
  )
}
