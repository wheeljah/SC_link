import { useEffect, useState } from 'react';

const COUNTER_API = 'https://countapi.mileshilliard.com/api/v1';
const COUNTER_KEY = 'wheeljah_sc_link_visits';
const SESSION_KEY = 'scholarlink-visitor-counted';
const INITIAL_VALUE = 22;

interface CounterResponse {
  value?: number;
}

function counterUrl(operation: 'get' | 'hit'): string {
  return `${COUNTER_API}/${operation}/${COUNTER_KEY}?_=${Date.now()}`;
}

async function readCounter(): Promise<number> {
  const response = await fetch(counterUrl('get'), { cache: 'no-store' });
  if (!response.ok) throw new Error('counter unavailable');
  const data = await response.json() as CounterResponse;
  return typeof data.value === 'number' ? data.value : INITIAL_VALUE;
}

async function recordVisit(): Promise<number> {
  const response = await fetch(counterUrl('hit'), { cache: 'no-store' });
  if (!response.ok) throw new Error('counter unavailable');
  const data = await response.json() as CounterResponse;
  return typeof data.value === 'number' ? data.value : INITIAL_VALUE;
}

export default function VisitorCounter() {
  const [value, setValue] = useState(INITIAL_VALUE);

  useEffect(() => {
    const alreadyCounted = sessionStorage.getItem(SESSION_KEY) === 'true';
    const request = alreadyCounted
      ? readCounter()
      : recordVisit()
        .then(value => {
          sessionStorage.setItem(SESSION_KEY, 'true');
          return value;
        })
        .catch(readCounter);

    request.then(setValue).catch(() => setValue(INITIAL_VALUE));
  }, []);

  return <>{value.toLocaleString()}</>;
}
