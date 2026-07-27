CREATE TABLE public.maintenance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE,
  tenant_name text NOT NULL,
  property_address text NOT NULL,
  issue_category text NOT NULL,
  issue_description text NOT NULL,
  urgency text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'needs_attention',
  ai_summary text,
  ai_confidence numeric,
  last_ai_action text,
  source_channel text NOT NULL DEFAULT 'email',
  reported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.maintenance_cases TO anon;
GRANT SELECT ON public.maintenance_cases TO authenticated;
GRANT ALL ON public.maintenance_cases TO service_role;

ALTER TABLE public.maintenance_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Maintenance cases are viewable by console users"
  ON public.maintenance_cases FOR SELECT
  USING (true);

INSERT INTO public.maintenance_cases
  (reference_code, tenant_name, property_address, issue_category, issue_description, urgency, status, ai_summary, ai_confidence, last_ai_action, source_channel, reported_at)
VALUES
('MC-1042','Amelia Hart','Flat 3, 18 Cranbourne Road, Bristol BS6 5HT','Heating','No hot water or heating since yesterday evening. Boiler shows an F1 fault code and resets for a few minutes before shutting down again.','high','needs_attention','Tenant reports total loss of heating and hot water with an F1 boiler fault, typically low system pressure. AI attempted a guided repressurisation walkthrough; fault persisted. Escalated for a Gas Safe engineer visit within 24 hours.',0.91,'Escalated to human — engineer dispatch required','whatsapp', now() - interval '3 hours'),
('MC-1041','Daniel Okafor','24B Marlow Gardens, Bristol BS7 9QT','Leak','Water dripping through the kitchen ceiling below the upstairs bathroom, getting worse when the shower is used.','critical','needs_attention','Active water ingress from an upstairs bathroom into the kitchen below. AI advised the tenant to stop using the shower and isolate the supply. Risk of electrical contact with ceiling light fitting flagged. Emergency plumber authorisation requested.',0.95,'Requested emergency contractor approval','phone', now() - interval '55 minutes'),
('MC-1040','Priya Raman','9 Selwyn Court, Bath BA2 3LP','Electrical','Sockets in the living room stopped working after the trip switch went. Resetting the consumer unit trips it again.','high','needs_attention','Repeat RCD trip isolated to the living room ring circuit. AI ran a safe appliance-isolation checklist with the tenant; circuit still trips with all loads removed, indicating a wiring fault. Qualified electrician required.',0.88,'Diagnostic checklist completed with tenant','email', now() - interval '9 hours'),
('MC-1039','Sofia Lindqvist','Flat 12, Harbour View, Bristol BS1 6TG','Appliance','Washing machine will not drain and leaves standing water in the drum after every cycle.','medium','in_progress','Likely blocked drain pump filter on a landlord-supplied appliance. AI booked an appliance engineer for Thursday morning and confirmed a two-hour window with the tenant.',0.82,'Appointment booked and confirmed with tenant','email', now() - interval '2 days'),
('MC-1038','Marcus Bell','77 Ashford Lane, Bristol BS16 4DE','Plumbing','Toilet in the main bathroom is running continuously and the flush is weak.','low','in_progress','Continuous cistern fill consistent with a worn flush valve. Non-urgent. AI raised a job with the standing plumbing contractor and is awaiting a scheduling response.',0.9,'Awaiting contractor scheduling response','whatsapp', now() - interval '4 days'),
('MC-1037','Grace Whitmore','Flat 5, 210 Gloucester Road, Bristol BS7 8NU','Damp & Mould','Black mould spreading on the bedroom wall behind the wardrobe, with a musty smell.','high','in_progress','Surface mould on a north-facing external wall, likely condensation-driven. AI issued interim ventilation guidance and arranged a damp survey. Photos received and attached to the job.',0.79,'Damp survey scheduled for next week','email', now() - interval '6 days'),
('MC-1036','Tobias Reid','31 Kingsdown Parade, Bristol BS6 5UF','Locks & Security','Front door lock stiff and key difficult to turn, occasionally will not lock at all.','medium','completed','Worn euro cylinder replaced by a locksmith. Tenant confirmed the door locks smoothly and received two new keys. Job closed with invoice matched.',0.93,'Closed after tenant confirmation','phone', now() - interval '12 days'),
('MC-1035','Nadia Farouk','Flat 8, Waterside Mews, Bath BA1 2QP','Heating','Radiators in two bedrooms staying cold while the rest of the flat heats up.','low','completed','Cold spots caused by trapped air. AI guided the tenant through bleeding both radiators; heat restored the same day with no contractor visit required.',0.87,'Resolved by AI self-serve guidance','whatsapp', now() - interval '15 days'),
('MC-1034','Oliver Pennington','142 Church Road, Bristol BS5 9JJ','Pest Control','Mice heard in the kitchen at night and droppings found under the sink.','medium','completed','Pest control contractor treated and proofed entry points around the kitchen pipework. Follow-up visit completed with no further activity reported.',0.9,'Follow-up inspection closed','email', now() - interval '21 days');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_maintenance_cases_updated_at
BEFORE UPDATE ON public.maintenance_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();