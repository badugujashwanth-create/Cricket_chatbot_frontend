import { CornerDownLeft, Send } from 'lucide-react';

const MAX_QUESTION_LENGTH = 500;

export default function InputBox({ value, onChange, onSubmit, disabled = false }) {
  const cleanValue = String(value || '');
  const canSubmit = Boolean(cleanValue.trim()) && !disabled;

  function handleSubmit() {
    if (!canSubmit || typeof onSubmit !== 'function') return;
    onSubmit(cleanValue);
  }

  return (
    <form
      className="rounded-[26px] border border-white/10 bg-panel/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.44)] backdrop-blur-xl sm:p-4"
      aria-busy={disabled}
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1" htmlFor="cricket-question">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Ask a cricket question
          </span>
          <textarea
            id="cricket-question"
            value={cleanValue}
            rows={2}
            maxLength={MAX_QUESTION_LENGTH}
            disabled={disabled}
            aria-describedby="composer-help composer-count"
            placeholder="For example: What is LBW?"
            className="min-h-[72px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300/60 focus:ring-2 focus:ring-sky-300/20 disabled:cursor-wait disabled:opacity-70"
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
          disabled={!canSubmit}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 text-sm font-bold text-slate-950 shadow-glow transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[132px]"
        >
          <Send aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
          {disabled ? 'Working' : 'Ask'}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-4 px-1 text-xs text-slate-500">
        <span id="composer-help" className="inline-flex items-center gap-1.5">
          <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Enter to ask · Shift + Enter for a new line
        </span>
        <span id="composer-count" aria-live="polite">
          {cleanValue.length}/{MAX_QUESTION_LENGTH}
        </span>
      </div>
    </form>
  );
}
