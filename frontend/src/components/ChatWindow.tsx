import { useEffect, useRef } from 'react'
import { Message } from '../types'
import MessageBubble from './MessageBubble'
import { Loader } from './core/Loader'

interface Props {
  messages: Message[]
  loading: boolean
}

export default function ChatWindow({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="h-full overflow-y-auto py-6 scroll-smooth">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
      {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

      {loading && (
        <div className="flex gap-3 items-start">
          <div className="flex px-2 py-3">
            <Loader />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
      </div>
    </div>
  )
}
