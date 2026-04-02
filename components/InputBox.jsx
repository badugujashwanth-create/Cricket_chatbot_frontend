window.InputBox = function InputBox({
  value,
  onChange,
  onSubmit,
  disabled = false
}) {
  return (
    <form
      className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-panel/90 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Message</span>
        <textarea
          value={value}
          rows={1}
          disabled={disabled}
          placeholder="Ask about players, teams, matches, comparisons, or records..."
          className="min-h-[60px] w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cricket/35 focus:ring-2 focus:ring-cricket/20"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
      </label>

      <button
        type="submit"
        disabled={disabled || !String(value || '').trim()}
        className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-cricket px-6 text-sm font-semibold text-slate-950 shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[120px]"
      >
        Send
      </button>
    </form>
  );
};
