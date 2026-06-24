import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { checkAiHealth, getAiBaseUrl, type AiServiceStatus } from '@/lib/aiApi';

interface AiServiceContextValue {
  status: AiServiceStatus;
  baseUrl: string;
  recheck: () => Promise<void>;
}

const AiServiceContext = createContext<AiServiceContextValue | null>(null);

export function AiServiceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiServiceStatus>('checking');

  const recheck = useCallback(async () => {
    setStatus('checking');
    const ok = await checkAiHealth();
    setStatus(ok ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    recheck();
    const id = window.setInterval(recheck, 60_000);
    return () => window.clearInterval(id);
  }, [recheck]);

  const value = useMemo(
    () => ({ status, baseUrl: getAiBaseUrl(), recheck }),
    [status, recheck],
  );

  return <AiServiceContext.Provider value={value}>{children}</AiServiceContext.Provider>;
}

export function useAiService() {
  const ctx = useContext(AiServiceContext);
  if (!ctx) {
    return {
      status: 'unknown' as AiServiceStatus,
      baseUrl: getAiBaseUrl(),
      recheck: async () => false,
    };
  }
  return ctx;
}
