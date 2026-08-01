import { useState, useEffect, useRef, useCallback } from "react";
import { Message } from "../types"
import { api } from "../services/api"

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  docFilter?: string | string[]
}

function speak(text: string) {
  speechSynthesis.cancel()

  const utter = new SpeechSynthesisUtterance(text)

  utter.rate = 1

  utter.pitch = 1

  speechSynthesis.speak(utter)
}

export function useChat() {
  const firstId = crypto.randomUUID()

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
  const saved = localStorage.getItem("secureRag_sessions")

  if (saved) return JSON.parse(saved)

  return [
    {
      id: firstId,
      title: "New Chat",
      messages: [],
      docFilter: "All Documents",
    },
  ]
})
  const [currentChat, setCurrentChat] = useState<string>(firstId)
  const currentChatRef = useRef(currentChat)
  
  const [aiVoice, setAiVoice] = useState(() => localStorage.getItem("sentra_voice") !== "off")
  const aiVoiceRef = useRef(aiVoice)
  useEffect(() => {
    localStorage.setItem("sentra_voice", aiVoice ? "on" : "off")
    aiVoiceRef.current = aiVoice
  }, [aiVoice])

  useEffect(() => {
      currentChatRef.current = currentChat
  }, [currentChat])
  const [loading, setLoading] = useState(false)
  const [answerMode, setAnswerMode] = useState("detailed")
  const [searchQuery, setSearchQuery] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const currentSession = sessions.find((s) => s.id === currentChat)!
  const docFilter = currentSession?.docFilter || "All Documents"

  const docFilterRef = useRef(docFilter)
  useEffect(() => {
    docFilterRef.current = docFilter
  }, [docFilter])

  const setDocFilter = useCallback((filter: string | string[]) => {
    setSessions(prev => prev.map(s => s.id === currentChatRef.current ? { ...s, docFilter: filter } : s))
  }, [])


  const sendMessage = useCallback(
    async (text: string) => {
      // Capture current chat ID at call-time — not stale closure value
      const activeChatId = currentChatRef.current
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date(),
      }

      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeChatId
            ? {
                ...session,
                title:
                  session.messages.filter((m) => m.role === "user").length === 0
                    ? text.slice(0, 40)
                    : session.title,
                messages: [...session.messages, userMsg],
              }
            : session
        )
      )

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)

      try {
        const data = await api.query(text, docFilterRef.current, answerMode, controller.signal)
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.answer,
          confidence: data.confidence,
          sources: data.sources,
          images: data.images,
          evidencePages: data.evidencePages,
          imageChunks: data.imageChunks,
          sourceChunks: data.source_chunks,
          blocked: data.blocked,
          timestamp: new Date(),
          citations: data.citations,
          low_confidence: data.low_confidence,
        }
        // Always write to the session that initiated the request
        setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...s.messages, aiMsg] } : s))
        if (aiVoiceRef.current) speak(data.answer)
      } catch (e: any) {
        if (e.name === 'CanceledError' || e.name === 'AbortError' || e.code === 'ERR_CANCELED') {
          const stoppedMsg: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: "Response generation stopped.",
            timestamp: new Date(),
          }
          setSessions((prev) =>
            prev.map((session) =>
              session.id === activeChatId
                ? { ...session, messages: [...session.messages, stoppedMsg] }
                : session
            )
          )
          return
        }
        const err: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${e.message}`,
          timestamp: new Date(),
        }
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeChatId
              ? { ...session, messages: [...session.messages, err] }
              : session
          )
        )
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        setLoading(false)
      }
    },
    [answerMode]
  )

  const runAction = useCallback(
    async (action: string, language = "Spanish") => {
      const activeChatId = currentChatRef.current
      const label: Record<string, string> = {
        summarize: "Summarize the selected document(s)",
        explain: "Explain the selected document(s) simply",
        translate: `Translate the selected document(s) to ${language}`,
        compare: "Compare the selected documents",
        extract: "Extract key facts, figures, and action items",
      }
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: `⚡ ${label[action] ?? action}`,
        timestamp: new Date(),
      }
      setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...s.messages, userMsg] } : s))

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      try {
        const data = await api.action(action, docFilterRef.current, language, controller.signal)
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.answer,
          confidence: data.confidence,
          sources: data.sources,
          timestamp: new Date(),
        }
        setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...s.messages, aiMsg] } : s))
      } catch (e: any) {
        if (e.name === 'CanceledError' || e.name === 'AbortError' || e.code === 'ERR_CANCELED') {
          const stoppedMsg: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: "Response generation stopped.",
            timestamp: new Date(),
          }
          setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...s.messages, stoppedMsg] } : s))
          return
        }
        const err: Message = { id: Date.now().toString(), role: "assistant", content: `Error: ${e.message}`, timestamp: new Date() }
        setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...s.messages, err] } : s))
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        setLoading(false)
      }
    },
    []
  )

  const newChat = () => {
    const id = crypto.randomUUID()
    // Update ref immediately so any in-flight request goes to old session
    currentChatRef.current = id
    setSessions((prev) => [{ id, title: "New Chat", messages: [], docFilter: "All Documents" }, ...prev])
    setCurrentChat(id)
  }

  const deleteChat = (id: string) => {
  setSessions(prev => {
    const rest = prev.filter(s => s.id !== id)
    if (rest.length === 0) {
      const nid = crypto.randomUUID()
      const fresh = [{ id: nid, title: "New Chat", messages: [], docFilter: "All Documents" }]
      setCurrentChat(nid)
      return fresh
    }
    if (id === currentChat) setCurrentChat(rest[0].id)
    return rest
  })
}

const renameChat = (id: string, title: string) => {
  setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s))
}

  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions

  return {
    messages: currentSession?.messages ?? [],
    sessions,
    filteredSessions,
    searchQuery,
    setSearchQuery,
    currentChat,
    setCurrentChat,
    newChat,
    deleteChat,
    renameChat,
    loading,
    sendMessage,
    runAction,
    docFilter,
    setDocFilter,
    answerMode,
    setAnswerMode,
    stop,
    aiVoice,
    setAiVoice,
  }
}

