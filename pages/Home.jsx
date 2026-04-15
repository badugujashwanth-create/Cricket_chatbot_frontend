import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import ChatWindow from '../components/ChatWindow';
import Header from '../components/Header';
import InputBox from '../components/InputBox';

function parseRequestError(payload = {}, fallbackMessage = 'Request failed.') {
  return (
    String(payload?.summary || payload?.message || payload?.error || '').trim() ||
    fallbackMessage
  );
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export default function Home() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask any cricket question about players, teams, matches, comparisons, records, or live scores. I will answer in one clear response block.'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => setLiveConnected(true));
    socket.on('disconnect', () => setLiveConnected(false));
    socket.on('live-score-alert', (payload = {}) => {
      const summary = String(payload.summary || '').trim();
      if (!summary) return;
      setMessages((current) => {
        const nextMessage = {
          id: `live-${payload.match_id || payload.type || Date.now()}`,
          role: 'assistant',
          content: summary,
          payload: {
            type: 'match',
            title: String(payload.title || 'Live Cricket Alert').trim(),
            summary,
            stats: {},
            extra: {
              action: String(payload.type || 'live_alert').trim(),
              sources: ['Socket.IO', payload.source || 'Live Push'].filter(Boolean),
              recent_matches: [],
              chartData: null
            }
          }
        };

        const alreadyPresent = current.some(
          (message) => message.id === nextMessage.id || message.content === nextMessage.content
        );
        return alreadyPresent ? current : [...current, nextMessage];
      });
    });

    return () => {
      socket.close();
    };
  }, []);

  async function submitQuestion(question) {
    const cleanQuestion = String(question).trim();
    if (!cleanQuestion) {
      throw new Error('Please type your question.');
    }

    const response = await fetch('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ question: cleanQuestion })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(parseRequestError(payload, 'Request failed.'));
    }

    return payload;
  }

  return (
    <div className="min-h-screen text-white">
      <Header liveConnected={liveConnected} />

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-36 pt-6 sm:px-6">
        <ChatWindow messages={messages} isLoading={isLoading} />
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <InputBox
            value={inputValue}
            disabled={isLoading}
            onChange={setInputValue}
            setMessages={setMessages}
            setIsLoading={setIsLoading}
            onSubmit={submitQuestion}
          />
        </div>
      </div>
    </div>
  );
}
