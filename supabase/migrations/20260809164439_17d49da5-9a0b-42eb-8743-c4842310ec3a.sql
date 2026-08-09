ALTER TABLE public.maintenance_cases
  ADD COLUMN IF NOT EXISTS communication_channel text NOT NULL DEFAULT 'phone';

ALTER TABLE public.maintenance_cases
  DROP CONSTRAINT IF EXISTS maintenance_cases_communication_channel_check;

ALTER TABLE public.maintenance_cases
  ADD CONSTRAINT maintenance_cases_communication_channel_check
  CHECK (communication_channel IN ('phone', 'whatsapp'));

-- Backfill: ElevenLabs WhatsApp conversations use `conv_...` ids and/or the
-- raw x-elevenlabs-history transcript envelope. Everything else is Telnyx phone.
UPDATE public.maintenance_cases
SET communication_channel = 'whatsapp'
WHERE communication_channel <> 'whatsapp'
  AND (
    conversation_id LIKE 'conv\_%'
    OR (transcript IS NOT NULL AND transcript LIKE '{%x-elevenlabs-history%')
  );

-- Phone-only fields must not be fabricated for WhatsApp cases.
UPDATE public.maintenance_cases
SET call_duration_secs = NULL,
    call_recording_url = NULL,
    recording_storage_path = NULL,
    call_control_id = NULL,
    call_leg_id = NULL,
    enrichment_status = 'not_applicable'
WHERE communication_channel = 'whatsapp'
  AND (
    call_duration_secs IS NOT NULL
    OR call_recording_url IS NOT NULL
    OR recording_storage_path IS NOT NULL
    OR call_control_id IS NOT NULL
    OR call_leg_id IS NOT NULL
    OR enrichment_status <> 'not_applicable'
  );

-- Normalise raw ElevenLabs history JSON transcripts into the canonical
-- "role: text" form used by phone cases. Only touches rows that still hold
-- the raw envelope, so it is safe and idempotent.
UPDATE public.maintenance_cases mc
SET transcript = normalised.text
FROM (
  SELECT c.id,
         string_agg(
           CASE WHEN lower(entry->>'role') = 'agent' THEN 'assistant' ELSE lower(entry->>'role') END
           || ': ' || btrim(entry->>'message'),
           E'\n' ORDER BY ord
         ) AS text
  FROM public.maintenance_cases c
  CROSS JOIN LATERAL jsonb_array_elements((c.transcript::jsonb)->'entries') WITH ORDINALITY AS t(entry, ord)
  WHERE c.transcript LIKE '{%x-elevenlabs-history%'
    AND lower(coalesce(entry->>'role','')) IN ('agent','assistant','user')
    AND btrim(coalesce(entry->>'message','')) <> ''
  GROUP BY c.id
) AS normalised
WHERE mc.id = normalised.id
  AND normalised.text IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_cases TO authenticated;
GRANT ALL ON public.maintenance_cases TO service_role;