/** Classes Tailwind do editor visual v2 (fundo escuro). */
export const editorDark = {
  label: 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400',
  input:
    'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none',
  textarea:
    'min-h-[120px] w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none',
  hint: 'mt-1 text-xs text-slate-500',
  btn: {
    primary:
      'inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
    success:
      'inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50',
    secondary:
      'inline-flex items-center justify-center gap-2 rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50',
    ghost:
      'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50',
    danger: 'text-xs text-red-400 hover:underline p-0 border-0 bg-transparent',
    link: 'text-xs text-indigo-400 hover:underline p-0 border-0 bg-transparent',
    tab: 'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm text-slate-300 hover:bg-slate-800 hover:text-white',
    tabActive:
      'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm bg-indigo-600 text-white shadow-sm',
    icon: 'shrink-0 rounded-md bg-slate-700 p-2 text-slate-200 transition-colors hover:bg-slate-600',
  },
};
