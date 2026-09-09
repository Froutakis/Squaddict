import { useEffect, useState } from 'react';

export function useNow(intervalMs = 60000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(tick);
  }, [intervalMs]);

  return now;
}
