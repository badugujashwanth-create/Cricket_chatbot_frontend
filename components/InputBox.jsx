export default function InputBox({
  value,
  onChange,
  onSubmit,
  setMessages = () => {},
  setIsLoading = () => {},
  disabled = false
}) {
  async function handleSubmit() {
    const question = String(value || '').trim();
    if (!question || disabled || typeof onSubmit !== 'function') return;

    const requestId = `request-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const statusMessageId = `${requestId}-status`;
    const userMessage = {
      id: `${requestId}-user`,
      role: 'user',
      content: question
    };
    const statusMessage = {
      id: statusMessageId,
      role: 'system',
      content: '\u{1F9E0} Analyzing query intent...',
      isStatus: true
    };

    setMessages((current) => [...current, userMessage, statusMessage]);
    onChange('');
    setIsLoading(true);

    try {
      const payload = await onSubmit(question);
      const assistantMessage = {
        id: `${requestId}-assistant`,
        role: 'assistant',
        content: String(payload?.summary || 'No answer returned.').trim(),
        payload
      };

      setMessages((current) => {
        const statusIndex = current.findIndex((message) => message.id === statusMessageId);
        const withoutStatus = current.filter((message) => message.id !== statusMessageId);
        if (statusIndex === -1) {
          return [...withoutStatus, assistantMessage];
        }
        withoutStatus.splice(statusIndex, 0, assistantMessage);
        return withoutStatus;
      });
    } catch (error) {
      const errorMessage = {
        id: `${requestId}-error`,
        role: 'assistant',
        content: error?.message || 'Something went wrong while reaching the cricket assistant.'
      };

      setMessages((current) => {
        const statusIndex = current.findIndex((message) => message.id === statusMessageId);
        const withoutStatus = current.filter((message) => message.id !== statusMessageId);
        if (statusIndex === -1) {
          return [...withoutStatus, errorMessage];
        }
        withoutStatus.splice(statusIndex, 0, errorMessage);
        return withoutStatus;
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-panel/90 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Message</span>
        <textarea
          value={value}
          rows={1}
          disabled={disabled}
          placeholder="Ask about players, teams, matches, comparisons, records, or live scores..."
          className="min-h-[60px] w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cricket/35 focus:ring-2 focus:ring-cricket/20"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
      </label>

      <button
        type="submit"
        disabled={disabled || !String(value || '').trim()}
        className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-cricket px-6 text-sm font-semibold text-slate-950 shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[140px]"
      >
        Send
      </button>
    </form>
  );
}
