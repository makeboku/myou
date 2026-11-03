import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '../lib/utils';
import { API_BASE_URL } from '../config';

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted p-3 rounded-lg overflow-x-auto text-sm my-2"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>')
    .replace(/\n/g, '<br>');
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ChatPage: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history })
      });

      if (!res.ok || !res.body) {
        throw new Error('Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const token = JSON.parse(data).response;
              if (token) {
                fullReply += token;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullReply };
                  return updated;
                });
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `❌ ${t('chat.error')}` };
        return updated;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (messages.length === 0) return;
    setMessages([]);
    inputRef.current?.focus();
  };

  const copyMessage = async (content: string) => {
    await copyText(content);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex items-center justify-between py-4 border-b">
        <h1 className="text-xl font-bold">{t('chat.title')}</h1>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="px-3 py-1.5 text-sm rounded-full bg-muted/60 hover:bg-muted/80 transition-colors"
          >
            {t('chat.clear')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-20">
            <div className="text-5xl mb-4 opacity-30">💬</div>
            <p className="text-lg">{t('chat.welcome')}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted rounded-bl-sm'
            }`}>
              {msg.role === 'assistant' && msg.content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              ) : msg.role === 'assistant' && !msg.content ? (
                <span className="text-muted-foreground animate-pulse">{t('chat.thinking')}</span>
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              )}
              {msg.role === 'assistant' && msg.content && (
                <button
                  onClick={() => copyMessage(msg.content)}
                  className="mt-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {t('chat.copy')}
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="py-4 border-t">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-full border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? '...' : t('chat.send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
