import { Routes, Route } from "react-router-dom"
import { Layout } from "@/Layout"
import { Dashboard } from "@/pages/Dashboard"
import { ProjectList } from "@/pages/ProjectList"
import { ProjectDetail } from "@/pages/ProjectDetail"
import { Containers } from "@/pages/Containers"
import { Images } from "@/pages/Images"
import { ImageBuild } from "@/pages/ImageBuild"

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/images" element={<Images />} />
        <Route path="/images/build" element={<ImageBuild />} />
        <Route path="/containers" element={<Containers />} />
      </Route>
    </Routes>
  )
}
