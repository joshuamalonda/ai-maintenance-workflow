CREATE TABLE public.telnyx_messaging_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  message_id text,
  direction text,
  from_number text,
  to_number text,
  occurred_at timestamptz,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telnyx_messaging_events_received_at ON public.telnyx_messaging_events (received_at DESC);
CREATE INDEX idx_telnyx_messaging_events_message_id ON public.telnyx_messaging_events (message_id);

GRANT ALL ON public.telnyx_messaging_events TO service_role;

ALTER TABLE public.telnyx_messaging_events ENABLE ROW LEVEL SECURITY;
-- No policies: only server-side privileged code (service role) may read/write.