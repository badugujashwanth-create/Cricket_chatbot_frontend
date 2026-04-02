function parseRequestError(payload = {}, fallbackMessage = 'Request failed.') {
  return (
    String(payload?.summary || payload?.message || payload?.error || '').trim() ||
    fallbackMessage
  );
}

window.Home = function Home() {
  const [messages, setMessages] = React.useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask any cricket question about players, teams, matches, comparisons, records, or live scores. I will answer in one clear response block.'
    }
  ]);
  const [inputValue, setInputValue] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  async function submitQuestion(forcedQuestion) {
    const question = String(forcedQuestion ?? inputValue).trim();
    if (!question || isLoading) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: question
      }
    ]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(parseRequestError(payload, 'Request failed.'));
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: String(payload.summary || 'No answer returned.').trim(),
          payload
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: error?.message || 'Something went wrong while reaching the cricket assistant.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white">
      <Header />

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-36 pt-6 sm:px-6">
        <ChatWindow messages={messages} isLoading={isLoading} />
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <InputBox
            value={inputValue}
            disabled={isLoading}
            onChange={setInputValue}
            onSubmit={() => submitQuestion()}
          />
        </div>
      </div>
    </div>
  );
};
