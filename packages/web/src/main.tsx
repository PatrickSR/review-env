import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import "@/index.css"
import { App } from "@/App"
import { PageTitleProvider } from "@/contexts/page-title"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PageTitleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </PageTitleProvider>
  </StrictMode>
)
