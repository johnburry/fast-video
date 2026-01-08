'use client';

import { useEffect, useState } from 'react';

export default function DebugUrlPage() {
  const [info, setInfo] = useState<any>({});

  useEffect(() => {
    setInfo({
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-4">URL Debug Page</h1>
      <pre className="bg-gray-900 p-4 rounded">
        {JSON.stringify(info, null, 2)}
      </pre>
    </div>
  );
}
