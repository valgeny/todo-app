'use client';

import { CopilotKit } from '@copilotkit/react-core/v2';
import { CopilotSidebar } from '@copilotkit/react-ui';
import type { ReactNode } from 'react';

import '@copilotkit/react-ui/styles.css';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="todo_agent" useSingleEndpoint={false}>
      <CopilotSidebar
        defaultOpen
        labels={{
          title: 'Todo agent',
          initial: 'Ask me to list, add, or update todos.'
        }}
      >
        {children}
      </CopilotSidebar>
    </CopilotKit>
  );
}
