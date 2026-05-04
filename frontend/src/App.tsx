import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'

const TLDRAW_LICENSE_KEY = import.meta.env.VITE_TLDRAW_LICENSE_KEY || ''

export function App() {
  const handleMount = (editor: Editor) => {
    // Expose editor globally for MCP server REST API integration
    ;(window as any).__tldraw_editor = editor

    // Notify canvas server that editor is ready
    fetch('/api/editor-ready', { method: 'POST' }).catch(() => {
      // Canvas server might not be running yet
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        licenseKey={TLDRAW_LICENSE_KEY}
        persistenceKey="tldraw-mcp"
        onMount={handleMount}
      />
    </div>
  )
}
