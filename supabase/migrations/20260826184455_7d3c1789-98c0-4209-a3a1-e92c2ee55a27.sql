INSERT INTO public.channel_endpoints (agency_id, channel, identifier, identifier_key, is_active, label)
SELECT a.id, 'whatsapp', '1251679104695078', '1251679104695078', true, 'Ovelo WhatsApp sender (Meta phone number ID)'
FROM public.agencies a
WHERE a.id = '999c49b3-8833-458c-b31e-c7c038f0d370'
ON CONFLICT (channel, identifier_key) DO UPDATE
  SET is_active = true, identifier = EXCLUDED.identifier, label = EXCLUDED.label, updated_at = now();