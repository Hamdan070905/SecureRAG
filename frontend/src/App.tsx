import { useChat } from "./hooks/useChat"
import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import KnowledgeBase from './pages/KnowledgeBase'
import Analytics from './pages/Analytics'
import Security from './pages/Security'
import Architecture from './pages/Architecture'
import Settings from './pages/Settings'
import { Page } from './types'
import { api } from './services/api'
import { PixelCanvas } from './components/ui/pixel-canvas'

export default function App() {
  const [page, setPage] = useState<Page>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const chat = useChat()

  const [analytics, setAnalytics] = useState({ documents: 0, chunks: 0, words: 0 });

  // Deep Link Listener for securerag:// scheme
  useEffect(() => {
    const handleDeepLinkEvent = (event: any, url: string) => {
      console.log("Deep link received in React:", url);
      // Example routing logic:
      // securerag://settings -> opens settings page
      if (url.includes("settings")) {
        setPage("settings");
      } else if (url.includes("knowledge")) {
        setPage("knowledge");
      }
    };

    if ((window as any).electron?.ipcRenderer) {
      (window as any).electron.ipcRenderer.on("deep-link", handleDeepLinkEvent);
      (window as any).electron.ipcRenderer.send("renderer-ready");
    }

    return () => {
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.removeListener("deep-link", handleDeepLinkEvent);
      }
    };
  }, []);

  useEffect(() => {
    api.analytics().then(setAnalytics).catch(console.error);
  }, []);

  useEffect(() => {
    if (chat.sessions && chat.sessions.length > 0) {
      localStorage.setItem('secureRag_sessions', JSON.stringify(chat.sessions));
    }
  }, [chat.sessions]);

  const speakResponse = (text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const exportChatAs = (format: 'txt' | 'md' | 'pdf') => {
    const activeMessages = (chat as any).messages || [];
    if (activeMessages.length === 0) return;
    const ts = (m: any) => m.timestamp ? new Date(m.timestamp).toLocaleString() : 'Just now';
    if (format === 'txt') {
      const textData = activeMessages.map((m: any) =>
        `[${(m.role || 'user').toUpperCase()}] (${ts(m)}): \n${m.content || ''}`
      ).join('\n\n-----------------------------------\n\n');
      const blob = new Blob([textData], { type: 'text/plain' });
      downloadBlob(blob, 'secure_rag_chat_export.txt');
      return;
    }
    if (format === 'md') {
      const mdData = activeMessages.map((m: any) =>
        `**${(m.role || 'user').toUpperCase()}** _(${ts(m)})_\n\n${m.content || ''}`
      ).join('\n\n---\n\n');
      const blob = new Blob([`# SecureRAG Chat Export\n\n${mdData}`], { type: 'text/markdown' });
      downloadBlob(blob, 'secure_rag_chat_export.md');
      return;
    }
    if (format === 'pdf') {
      import('jspdf').then(({ default: jsPDF }) => {
        const doc = new jsPDF();
        const margin = 14;
        let y = 20;
        doc.setFontSize(14);
        doc.text('SecureRAG Chat Export', margin, y);
        y += 10;
        doc.setFontSize(10);
        activeMessages.forEach((m: any) => {
          const header = `${(m.role || 'user').toUpperCase()} (${ts(m)})`;
          const lines = doc.splitTextToSize(`${header}\n${m.content || ''}`, 180);
          if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
          doc.text(lines, margin, y);
          y += lines.length * 5 + 6;
        });
        doc.save('secure_rag_chat_export.pdf');
      }).catch(() => alert('PDF export requires the "jspdf" package.'));
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    (window as any).__exportSecureRagChat = () => exportChatAs('txt');
    (window as any).__exportSecureRagChatAs = exportChatAs;
    (window as any).__speakSecureRagText = speakResponse;
  }, [chat]);

  const pages: Record<Page, JSX.Element> = {
    dashboard: <Dashboard onNavigate={setPage} />,
    chat: <Chat chat={chat} />,
    knowledge: <KnowledgeBase />,
    analytics: <Analytics />,
    security: <Security />,
    architecture: <Architecture />,
    settings: <Settings />,
  }

  return (
    <div className="flex h-screen bg-[#090909] overflow-hidden relative" id="app-root">
      {/* Pixel canvas background */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-15">
        <PixelCanvas />
      </div>

      {/* Sidebar overlay backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar — always overlay, slides in/out */}
      <Sidebar
        chats={chat.sessions}
        currentChat={chat.currentChat}
        onNavigate={(p) => { setPage(p as Page); setSidebarOpen(false); }}
        currentPage={page}
        loading={chat.loading}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        onSelectChat={(id) => {
          chat.setCurrentChat(id);
          setPage('chat');
          setSidebarOpen(false);
        }}
        onNewChat={() => {
          chat.newChat();
          setPage('chat');
          setSidebarOpen(false);
        }}
        onDeleteChat={chat.deleteChat}
        onRenameChat={chat.renameChat}
      />

      {/* Main content — always full width */}
      <div className="flex flex-col flex-1 min-w-0 relative z-10 w-full">
        <Navbar
          page={page}
          onNavigate={setPage}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-hidden">
          {pages[page]}
        </main>
      </div>
    </div>
  )
}