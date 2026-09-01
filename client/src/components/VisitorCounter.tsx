import { useEffect, useState } from 'react';

const COUNTER_API = 'https://countapi.mileshilliard.com/api/v1';
const COUNTER_KEY = 'wheeljah_sc_link_visits';
const SESSION_KEY = 'scholarlink-visitor-counted';
const INITIAL_VALUE = 22;

interface CounterResponse {
  value?: number;
}

async function readCounter(): Promise<number> {
  const response = await fetch(`${COUNTER_API}/get/${COUNTER_KEY}`);
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
      : fetch(`${COUNTER_API}/hit/${COUNTER_KEY}`)
        .then(async response => {
          if (!response.ok) throw new Error('counter unavailable');
          sessionStorage.setItem(SESSION_KEY, 'true');
          const data = await response.json() as CounterResponse;
          return typeof data.value === 'number' ? data.value : INITIAL_VALUE;
        });

    request.then(setValue).catch(() => setValue(INITIAL_VALUE));
  }, []);

  return <>{value.toLocaleString()}</>;
}
