export function devLog(...args) {
  if (process.env.NODE_ENV !== 'development') return;
  if (process.env.NEXT_PUBLIC_DEBUG !== '1') return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

