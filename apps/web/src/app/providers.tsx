"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EncryptionProvider } from "@/contexts/EncryptionContext";
import EncryptionModals from "@/components/encryption/EncryptionModals";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <EncryptionProvider>
        {children}
        <EncryptionModals />
      </EncryptionProvider>
    </QueryClientProvider>
  );
}
