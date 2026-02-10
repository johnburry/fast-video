import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { importChannelJob } from '@/inngest/functions';

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    importChannelJob,
  ],
});
