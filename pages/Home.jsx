import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import ChatWindow from '../components/ChatWindow';
import Header from '../components/Header';
import InputBox from '../components/InputBox';

function normalizeUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function cleanResponseText(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonSafely(value = '') {
  if (!String(value || '').trim()) return {};
  try {
    return JSON.parse(value);
  } catch (_) {
    return {};
  }
}

function parseRequestError(payload = {}, fallbackMessage = 'Request failed.') {
  if (typeof payload === 'string') return cleanResponseText(payload) || fallbackMessage;
  return String(payload?.summary || payload?.message || payload?.error || '').trim() || fallbackMessage;
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

const BACKEND_ORIGIN = normalizeUrl(
  import.meta.env.VITE_BACKEND_URL ||
    (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)
);
const SOCKET_URL = normalizeUrl(import.meta.env.VITE_SOCKET_URL || BACKEND_ORIGIN);
const QUERY_URL = `${BACKEND_ORIGIN}/api/query`;
const STATUS_URL = `${BACKEND_ORIGIN}/api/status`;

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(STATUS_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Status request failed (${response.status}).`);
        return response.json();
      })
      .then((payload) => setRuntimeStatus(payload))
      .catch((error) => {
        if (error?.name !== 'AbortError') setRuntimeStatus(null);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => setLiveConnected(true));
    socket.on('disconnect', () => setLiveConnected(false));
    socket.on('live-score-alert', (payload = {}) => {
      const alertType = String(payload.type || '').trim();
      if (alertType === 'socket_ready') return;

      const summary = String(payload.summary || '').trim();
      if (!summary) return;
      setMessages((current) => {
        const nextMessage = {
          id: `update-${payload.match_id || payload.type || Date.now()}`,
          role: 'assistant',
          content: summary,
          payload: {
            type: 'match',
            title: String(payload.title || 'Cricket update').trim(),
            summary,
            stats: {},
            extra: {
              action: String(payload.type || 'update').trim(),
              evidence_state: 'available',
              archive_evidence: false,
              sources: ['Update channel', payload.source].filter(Boolean),
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

    return () => socket.close();
  }, []);

  async function requestQuestion(question) {
    let response;
    try {
      response = await fetch(QUERY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
    } catch (_) {
      throw new Error('The local API is unavailable. Start the backend and try again.');
    }

    const responseText = await response.text().catch(() => '');
    const payload = parseJsonSafely(responseText);
    if (!response.ok) {
      throw new Error(
        parseRequestError(payload, cleanResponseText(responseText) || `Request failed (${response.status}).`)
      );
    }
    return payload;
  }

  async function runQuestion(rawQuestion) {
    const question = String(rawQuestion || '').trim();
    if (!question || isLoading) return;

    const requestId = createRequestId();
    const statusId = `${requestId}-status`;
    setMessages((current) => [
      ...current,
      { id: `${requestId}-user`, role: 'user', content: question },
      { id: statusId, role: 'system', content: 'Routing the question against available evidence.', isStatus: true }
    ]);
    setInputValue('');
    setIsLoading(true);

    try {
      const payload = await requestQuestion(question);
      const assistantMessage = {
        id: `${requestId}-assistant`,
        role: 'assistant',
        content: String(payload?.summary || 'No answer returned.').trim(),
        payload
      };
      setMessages((current) =>
        current.map((message) => (message.id === statusId ? assistantMessage : message))
      );
    } catch (error) {
      const errorMessage = {
        id: `${requestId}-error`,
        role: 'assistant',
        content: error?.message || 'The cricket API could not complete this request.',
        isError: true
      };
      setMessages((current) =>
        current.map((message) => (message.id === statusId ? errorMessage : message))
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-white">
      <Header liveConnected={liveConnected} runtimeStatus={runtimeStatus} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          runtimeStatus={runtimeStatus}
          onPrompt={runQuestion}
          onClear={() => setMessages([])}
        />
      </main>

      <footer className="border-t border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
          <InputBox
            value={inputValue}
            disabled={isLoading}
            onChange={setInputValue}
            onSubmit={runQuestion}
          />
        </div>
      </footer>
    </div>
  );
}
