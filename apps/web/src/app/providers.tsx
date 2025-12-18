"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EncryptionProvider } from "@/contexts/EncryptionContext";
import { SessionProvider } from "@/contexts/SessionContext";
import EncryptionModals from "@/components/encryption/EncryptionModals";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <EncryptionProvider>
          {children}
          <EncryptionModals />
          <SessionTimeoutWarning />
        </EncryptionProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
