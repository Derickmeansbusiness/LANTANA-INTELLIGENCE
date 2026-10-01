-- Demo business data. Every row is is_demo = true and can be removed with
-- Settings → Wipe demo data (public.wipe_demo_data).
--
-- Parties, agreement terms and flags come from the brief. Project names,
-- ticket sizes, dates and finance figures are illustrative placeholders.
-- All dates are relative to today so the demo never goes stale.
--
-- Principals are looked up by full_name, so this file also works on a hosted
-- project once the two principal accounts exist. The test manager/staff
-- accounts are optional.

create or replace function pg_temp.act(p_user uuid, p_at timestamptz)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false);
  perform set_config('app.occurred_at', p_at::text, false);
end $$;

do $$
declare
  m uuid := (select id from public.profiles where full_name = 'Maimouna Baba Danpullo' limit 1);
  f uuid := (select id from public.profiles where full_name = 'Fai Shey Derick' limit 1);
  s uuid := (select id from public.profiles where role = 'staff' and email like '%@lantana.test' limit 1);
  mg uuid := (select id from public.profiles where role = 'manager' and email like '%@lantana.test' limit 1);
  t0 timestamptz := now();
  d0 date := private.today_dubai();

  -- organizations
  o_pjm uuid := 'a0000000-0000-4000-8000-000000000001';
  o_fam uuid := 'a0000000-0000-4000-8000-000000000002';
  o_gs  uuid := 'a0000000-0000-4000-8000-000000000003';
  o_fai uuid := 'a0000000-0000-4000-8000-000000000004';
  o_mau uuid := 'a0000000-0000-4000-8000-000000000005';
  o_dla uuid := 'a0000000-0000-4000-8000-000000000006';
  o_rak uuid := 'a0000000-0000-4000-8000-000000000007';
  c_pat uuid := 'a1000000-0000-4000-8000-000000000001';

  -- deals
  d_mau uuid := 'd0000000-0000-4000-8000-000000000001';
  d_dod uuid := 'd0000000-0000-4000-8000-000000000002';
  d_mor uuid := 'd0000000-0000-4000-8000-000000000003';
  d_dar uuid := 'd0000000-0000-4000-8000-000000000004';
  d_dla uuid := 'd0000000-0000-4000-8000-000000000005';
  d_lag uuid := 'd0000000-0000-4000-8000-000000000006';
  d_kgl uuid := 'd0000000-0000-4000-8000-000000000007';

  -- contracts & documents
  k_pjm uuid := 'e0000000-0000-4000-8000-000000000001';
  k_fam uuid := 'e0000000-0000-4000-8000-000000000002';
  k_fai uuid := 'e0000000-0000-4000-8000-000000000003';
  k_rak uuid := 'e0000000-0000-4000-8000-000000000004';
  fo_agr uuid := 'f1000000-0000-4000-8000-000000000001';
  fo_cor uuid := 'f1000000-0000-4000-8000-000000000002';
  fo_crp uuid := 'f1000000-0000-4000-8000-000000000003';
  fo_pre uuid := 'f1000000-0000-4000-8000-000000000004';
  doc_pjm uuid := 'f0000000-0000-4000-8000-000000000001';
  doc_fam uuid := 'f0000000-0000-4000-8000-000000000002';
  doc_fai uuid := 'f0000000-0000-4000-8000-000000000003';
  doc_mau uuid := 'f0000000-0000-4000-8000-000000000004';
  doc_rak uuid := 'f0000000-0000-4000-8000-000000000005';
  doc_pre uuid := 'f0000000-0000-4000-8000-000000000006';

  p_mau uuid := 'b1000000-0000-4000-8000-000000000001';
  p_cor uuid := 'b1000000-0000-4000-8000-000000000002';

  fam_end date := d0 + 42;      -- Faminas mandate: current term end
  rak_end date := d0 + 60;      -- co-working lease end
  bank uuid := 'ba000000-0000-4000-8000-000000000001';
  acc record;
  i integer;
begin
  if m is null or f is null then
    raise notice 'Principal profiles not found; skipping demo data.';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- FX (floating rates are demo values; pegs live in the migration)
  -- -------------------------------------------------------------------------
  insert into public.fx_rates (rate_date, base, quote, rate, source, is_demo) values
    ('2025-01-01', 'EUR', 'AED', 4.3000000000, 'demo', true),
    ('2025-01-01', 'GBP', 'AED', 4.9500000000, 'demo', true),
    ('2025-01-01', 'XAF', 'AED', 0.0065553687, 'demo', true),  -- EUR/655.957
    ('2025-01-01', 'XOF', 'AED', 0.0065553687, 'demo', true),
    ('2025-01-01', 'TZS', 'AED', 0.0014990000, 'demo', true),
    ('2025-01-01', 'NGN', 'AED', 0.0023690000, 'demo', true),
    ('2025-01-01', 'KES', 'AED', 0.0284500000, 'demo', true),
    ('2025-01-01', 'MRU', 'AED', 0.0922700000, 'demo', true),
    ('2025-01-01', 'ZAR', 'AED', 0.2050000000, 'demo', true);

  -- -------------------------------------------------------------------------
  -- Organizations & contacts
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '420 days');
  insert into public.organizations (id, name, type, country, regions_of_interest, sectors, description, relationship_owner_id, linked_profile_id, is_demo, created_at) values
    (o_fai, 'Fai Shey Derick', 'introducer', null, '{africa}', '{agriculture,energy,education}',
     'Individual introducer (personal network). Also a Lantana principal: introductions and fee attribution are tracked separately under the NCNDA.',
     m, f, true, t0 - interval '420 days');

  perform pg_temp.act(m, t0 - interval '305 days');
  insert into public.organizations (id, name, type, country, sectors, description, relationship_owner_id, is_demo, created_at) values
    (o_rak, 'RAKEZ (Ras Al Khaimah Economic Zone)', 'government', 'AE', '{}',
     'Licensing authority and co-working landlord.', f, true, t0 - interval '305 days');

  perform pg_temp.act(f, t0 - interval '300 days');
  insert into public.organizations (id, name, type, country, sectors, description, relationship_owner_id, is_demo, created_at) values
    (o_pjm, 'PJM Advisory', 'strategic_partner', 'TZ', '{agriculture,energy,infrastructure,real_estate}',
     'Tanzania project origination partner. Fees per project, agreed at SPV stage.', f, true, t0 - interval '300 days');
  insert into public.contacts (id, organization_id, full_name, country, is_demo, created_at)
  values (c_pat, o_pjm, 'Patrick Joseph Muwowo', 'TZ', true, t0 - interval '300 days');

  perform pg_temp.act(m, t0 - interval '323 days');
  insert into public.organizations (id, name, type, country, regions_of_interest, sectors, ticket_min_minor, ticket_max_minor, ticket_currency, description, relationship_owner_id, is_demo, created_at) values
    (o_fam, 'Faminas Investment Group', 'investor', null, '{africa}', '{agriculture,energy,infrastructure,industry}',
     500000000, 5000000000, 'USD',
     'Africa-wide investor. Non-exclusive mandate; fees agreed deal by deal. Ticket range is a demo estimate.',
     m, true, t0 - interval '323 days');

  perform pg_temp.act(m, t0 - interval '80 days');
  insert into public.organizations (id, name, type, country, sectors, description, relationship_owner_id, is_demo, created_at) values
    (o_gs, 'Global Sphere', 'supplier', 'AE', '{commodities,agriculture}',
     'UAE fertilizer producer (urea, NPK, DAP). Strategic supply partner.', m, true, t0 - interval '80 days'),
    (o_mau, 'Ministry of Agriculture and Food Sovereignty, Mauritania', 'government', 'MR', '{agriculture,commodities}',
     'Fertilizer supply proposal sent.', m, true, t0 - interval '80 days');

  perform pg_temp.act(m, t0 - interval '200 days');
  insert into public.organizations (id, name, type, country, sectors, description, relationship_owner_id, is_demo, created_at) values
    (o_dla, 'Douala Agri-Logistics Sponsor', 'project_owner', 'CM', '{agriculture,infrastructure}',
     'Demo placeholder for the project sponsor on the Faminas-matched opportunity. Replace with the real counterparty.',
     m, true, t0 - interval '200 days');

  -- -------------------------------------------------------------------------
  -- Deals, replaying each stage change at the time it happened
  -- -------------------------------------------------------------------------
  -- Douala cold-chain (Faminas-matched), XAF, 0 decimals
  perform pg_temp.act(m, t0 - interval '200 days');
  insert into public.deals (id, name, country, sector, ticket_minor, currency, stage, project_owner_org_id, fee_terms, spv_planned, owner_id, summary, is_demo, created_at)
  values (d_dla, 'Douala cold-chain & agri-logistics hub', 'CM', 'agriculture', 4200000000, 'XAF', 'lead', o_dla,
          'To be agreed per deal (Faminas mandate: deal-by-deal)', true, m,
          'Cold storage and aggregation for export crops around Douala port. Matched to Faminas on sector and ticket.', true, t0 - interval '200 days');
  perform pg_temp.act(m, t0 - interval '180 days'); update public.deals set stage = 'qualified' where id = d_dla;
  perform pg_temp.act(m, t0 - interval '150 days'); update public.deals set stage = 'mandate_signed' where id = d_dla;
  perform pg_temp.act(m, t0 - interval '120 days'); update public.deals set stage = 'introduced' where id = d_dla;
  perform pg_temp.act(m, t0 - interval '60 days');  update public.deals set stage = 'due_diligence' where id = d_dla;
  perform pg_temp.act(m, t0 - interval '12 days');
  update public.deals set stage = 'term_sheet', probability = 60,
         next_step = 'Return mark-up of Faminas term sheet', next_step_due = d0 + 3 where id = d_dla;

  -- Morogoro agro-processing (PJM origination, Faminas introduced)
  perform pg_temp.act(f, t0 - interval '150 days');
  insert into public.deals (id, name, country, sector, ticket_minor, currency, stage, introducer_org_id, fee_terms, owner_id, summary, is_demo, created_at)
  values (d_mor, 'Morogoro agro-processing hub', 'TZ', 'agriculture', 750000000, 'USD', 'lead', o_pjm,
          'Per project at SPV stage (PJM NCNDA)', f,
          'Maize and sunflower processing with out-grower scheme. Originated by PJM Advisory.', true, t0 - interval '150 days');
  perform pg_temp.act(f, t0 - interval '135 days'); update public.deals set stage = 'qualified' where id = d_mor;
  perform pg_temp.act(f, t0 - interval '120 days'); update public.deals set stage = 'nda_signed' where id = d_mor;
  perform pg_temp.act(f, t0 - interval '90 days');  update public.deals set stage = 'introduced' where id = d_mor;
  perform pg_temp.act(f, t0 - interval '30 days');
  update public.deals set stage = 'due_diligence', next_step = 'Collect audited financials and land titles', next_step_due = d0 + 5 where id = d_mor;

  -- Dodoma solar (PJM)
  perform pg_temp.act(f, t0 - interval '110 days');
  insert into public.deals (id, name, country, sector, ticket_minor, currency, stage, introducer_org_id, fee_terms, owner_id, summary, is_demo, created_at)
  values (d_dod, 'Dodoma solar mini-grid portfolio', 'TZ', 'energy', 1200000000, 'USD', 'lead', o_pjm,
          'Per project at SPV stage (PJM NCNDA)', f,
          'Portfolio of rural mini-grids, phased build. Originated by PJM Advisory.', true, t0 - interval '110 days');
  perform pg_temp.act(f, t0 - interval '95 days'); update public.deals set stage = 'qualified' where id = d_dod;
  perform pg_temp.act(f, t0 - interval '80 days'); update public.deals set stage = 'nda_signed' where id = d_dod;
  perform pg_temp.act(f, t0 - interval '35 days');
  update public.deals set stage = 'introduced', next_step = 'Site visit to shortlisted villages', next_step_due = d0 - 6 where id = d_dod;

  -- Mauritania fertilizer supply (Global Sphere → Ministry)
  perform pg_temp.act(m, t0 - interval '75 days');
  insert into public.deals (id, name, country, sector, ticket_minor, currency, stage, project_owner_org_id, fee_terms, owner_id, summary, is_demo, created_at)
  values (d_mau, 'Mauritania fertilizer supply (urea, NPK, DAP)', 'MR', 'commodities', 1850000000, 'USD', 'lead', o_mau,
          'To be agreed per shipment with Global Sphere', m,
          'Government-to-supplier fertilizer programme. Global Sphere as producer; Ministry as buyer.', true, t0 - interval '75 days');
  perform pg_temp.act(m, t0 - interval '60 days'); update public.deals set stage = 'qualified' where id = d_mau;
  perform pg_temp.act(m, t0 - interval '40 days');
  update public.deals set stage = 'introduced', next_step = 'Follow up with the Ministry on the supply proposal', next_step_due = d0 + 2 where id = d_mau;

  -- Dar es Salaam logistics (PJM) — intentionally left stale
  perform pg_temp.act(m, t0 - interval '60 days');
  insert into public.deals (id, name, country, sector, ticket_minor, currency, stage, introducer_org_id, fee_terms, owner_id, summary, is_demo, created_at)
  values (d_dar, 'Dar es Salaam logistics warehouse', 'TZ', 'infrastructure', 2200000000, 'USD', 'lead', o_pjm,
          'Per project at SPV stage (PJM NCNDA)', m,
          'Bonded warehouse near the port with a long-term anchor tenant.', true, t0 - interval '60 days');
  perform pg_temp.act(m, t0 - interval '50 days'); update public.deals set stage = 'qualified' where id = d_dar;
  perform pg_temp.act(m, t0 - interval '18 days');
  update public.deals set stage = 'introduced', next_step = 'Chase Faminas for first-look feedback' where id = d_dar;

  -- Lagos school campus (Fai's network), NGN
  perform pg_temp.act(f, t0 - interval '10 days');
  insert into public.deals (id, name, country, sector, ticket_minor, currency, stage, introducer_org_id, owner_id, summary, next_step, next_step_due, is_demo, created_at)
  values (d_lag, 'Lagos private school campus expansion', 'NG', 'education', 900000000000, 'NGN', 'lead', o_fai, f,
          'Second campus for an established K-12 operator. Early conversation.', 'Qualification call with the operator', d0 + 6,
          true, t0 - interval '10 days');

  -- Kigali data centre — closed-lost, keeps the history honest
  perform pg_temp.act(f, t0 - interval '240 days');
  insert into public.deals (id, name, country, sector, ticket_minor, currency, stage, owner_id, summary, is_demo, created_at)
  values (d_kgl, 'Kigali data centre co-location', 'RW', 'telecoms', 1500000000, 'USD', 'lead', f,
          'Tier III co-location facility. Sponsor chose a DFI-led round.', true, t0 - interval '240 days');
  perform pg_temp.act(f, t0 - interval '220 days'); update public.deals set stage = 'qualified' where id = d_kgl;
  perform pg_temp.act(f, t0 - interval '100 days'); update public.deals set stage = 'closed_lost', probability = 0 where id = d_kgl;

  insert into public.deal_parties (deal_id, organization_id, role, is_demo) values
    (d_mau, o_gs, 'supplier', true),
    (d_mau, o_mau, 'buyer', true),
    (d_mor, o_fam, 'investor_introduced', true),
    (d_dod, o_fam, 'investor_introduced', true),
    (d_dar, o_fam, 'investor_introduced', true),
    (d_dla, o_fam, 'investor_introduced', true);

  if s is not null then
    insert into public.deal_members (deal_id, user_id, role) values (d_mor, s, 'analyst');
  end if;

  -- -------------------------------------------------------------------------
  -- Documents (metadata only until the real files are uploaded)
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '310 days');
  insert into public.folders (id, name, is_demo) values
    (fo_agr, 'Agreements', true), (fo_cor, 'Correspondence', true),
    (fo_crp, 'Corporate', true), (fo_pre, 'Presentations', true);

  insert into public.documents (id, title, folder_id, doc_type, confidentiality, status, expiry_date, description, is_demo, created_at) values
    (doc_pre, 'Lantana Vision company presentation 2025', fo_pre, 'presentation', 'public', 'final', null,
     'File not uploaded yet.', true, t0 - interval '310 days'),
    (doc_rak, 'RAKEZ co-working lease', fo_crp, 'lease', 'confidential', 'signed', rak_end,
     'File not uploaded yet.', true, t0 - interval '305 days'),
    (doc_fai, 'NCNDA — Fai Shey Derick', fo_agr, 'agreement', 'confidential', 'signed', null,
     'File not uploaded yet.', true, t0 - interval '300 days'),
    (doc_pjm, 'NCNDA — PJM Advisory', fo_agr, 'agreement', 'confidential', 'signed', null,
     'File not uploaded yet. Counterparty signing authority to be confirmed.', true, t0 - interval '300 days'),
    (doc_fam, 'Mandate & Non-Circumvention Agreement — Faminas Investment Group', fo_agr, 'agreement', 'confidential', 'awaiting_signature', null,
     'File not uploaded yet. Signatory and registered address pending.', true, t0 - interval '300 days'),
    (doc_mau, 'Letter to the Ministry of Agriculture and Food Sovereignty — fertilizer supply proposal', fo_cor, 'letter', 'internal', 'final', null,
     'File not uploaded yet.', true, t0 - interval '40 days');

  insert into public.document_links (document_id, entity_type, entity_id) values
    (doc_pjm, 'organization', o_pjm), (doc_fam, 'organization', o_fam), (doc_fai, 'organization', o_fai),
    (doc_mau, 'organization', o_mau), (doc_mau, 'deal', d_mau), (doc_rak, 'organization', o_rak);

  -- -------------------------------------------------------------------------
  -- Contracts
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '300 days');
  insert into public.contracts (id, title, contract_type, counterparty_org_id, document_id, effective_date, term_months, end_date,
    renewal_type, notice_period_days, governing_law, forum, exclusivity, fee_terms, signatory_name,
    signatory_confirmed, signing_authority_confirmed, counterparty_address_confirmed, status, notes, is_demo, created_at) values
    (k_pjm, 'NCNDA — PJM Advisory', 'ncnda', o_pjm, doc_pjm, d0 - 300, 24, (d0 - 300 + interval '24 months')::date,
     'fixed', null, 'Laws of Tanzania', 'Courts of Tanzania', null, 'Fees agreed per project at SPV stage',
     'Patrick Joseph Muwowo', true, false, true, 'active',
     'Confirm Patrick Joseph Muwowo is authorised to bind PJM Advisory (board resolution or power of attorney).',
     true, t0 - interval '300 days'),
    (k_fam, 'Mandate & Non-Circumvention — Faminas Investment Group', 'mandate_non_circumvention', o_fam, doc_fam,
     (fam_end - interval '12 months')::date, 12, fam_end,
     'auto_renew', 30, 'Laws of the DIFC', 'DIFC-LCIA arbitration', 'Non-exclusive', 'Deal by deal',
     null, false, false, false, 'active',
     'Forum clause names DIFC-LCIA. That centre was abolished by Dubai Decree No. 34 of 2021 and its caseload moved to DIAC. Ask counsel how this clause will be read and whether to amend it at renewal.',
     true, t0 - interval '300 days'),
    (k_fai, 'NCNDA — Fai Shey Derick', 'ncnda', o_fai, doc_fai, d0 - 420, 24, (d0 - 420 + interval '24 months')::date,
     'fixed', null, 'Laws of the UAE', 'Courts of Ras Al Khaimah', null, null,
     'Fai Shey Derick', true, true, true, 'active', null, true, t0 - interval '300 days'),
    (k_rak, 'RAKEZ co-working lease', 'lease', o_rak, doc_rak, (rak_end - interval '12 months')::date, 12, rak_end,
     'fixed', null, 'Laws of the UAE', 'Courts of Ras Al Khaimah', null, null,
     null, true, true, true, 'active', null, true, t0 - interval '300 days');

  insert into public.contract_survival_clauses (contract_id, clause, survival_months, is_demo) values
    (k_pjm, 'Non-circumvention and confidentiality', 24, true),
    (k_fai, 'Non-circumvention and confidentiality', 24, true),
    (k_fam, 'Non-circumvention', 24, true);

  -- -------------------------------------------------------------------------
  -- Introductions ledger (inserted in chronological order: the hash chain
  -- records insertion order)
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '120 days');
  insert into public.introductions (introduced_on, deal_id, party_a_org_id, party_b_org_id, channel, summary, is_demo, row_hash)
  values (d0 - 120, d_dla, o_fam, o_dla, 'meeting',
          'Introduced Faminas Investment Group to the Douala project sponsor. Teaser and financial model shared under the Faminas mandate.', true, '');
  perform pg_temp.act(f, t0 - interval '90 days');
  insert into public.introductions (introduced_on, deal_id, party_a_org_id, party_a_contact_id, party_b_org_id, channel, summary, is_demo, row_hash)
  values (d0 - 90, d_mor, o_pjm, c_pat, o_fam, 'email',
          'Introduced PJM Advisory (Patrick Joseph Muwowo) to Faminas Investment Group on the Morogoro agro-processing hub.', true, '');
  perform pg_temp.act(m, t0 - interval '40 days');
  insert into public.introductions (introduced_on, deal_id, party_a_org_id, party_b_org_id, channel, summary, is_demo, row_hash)
  values (d0 - 40, d_mau, o_gs, o_mau, 'letter',
          'Fertilizer supply proposal (urea, NPK, DAP) sent to the Ministry, introducing Global Sphere as supplier.', true, '');
  perform pg_temp.act(f, t0 - interval '35 days');
  insert into public.introductions (introduced_on, deal_id, party_a_org_id, party_a_contact_id, party_b_org_id, channel, summary, is_demo, row_hash)
  values (d0 - 35, d_dod, o_pjm, c_pat, o_fam, 'video_call',
          'Video call introducing the Dodoma mini-grid portfolio to Faminas.', true, '');
  perform pg_temp.act(m, t0 - interval '18 days');
  insert into public.introductions (introduced_on, deal_id, party_a_org_id, party_a_contact_id, party_b_org_id, channel, summary, is_demo, row_hash)
  values (d0 - 18, d_dar, o_pjm, c_pat, o_fam, 'email',
          'Dar es Salaam warehouse teaser sent to Faminas with PJM Advisory copied.', true, '');

  -- -------------------------------------------------------------------------
  -- Projects & tasks
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '45 days');
  insert into public.projects (id, name, description, deal_id, owner_id, status, start_date, target_date, is_demo) values
    (p_mau, 'Mauritania fertilizer supply — execution', 'From proposal to first shipment.', d_mau, m, 'active', d0 - 45, d0 + 120, true),
    (p_cor, 'Company setup & compliance', 'Licence, tax registrations, bank and document hygiene.', null, f, 'active', d0 - 45, d0 + 90, true);

  perform pg_temp.act(f, t0 - interval '60 days');
  insert into public.tasks (title, priority, status, due_date, assignee_id, organization_id, project_id, created_at, is_demo)
  values ('Collect KYC documents from PJM Advisory', 'medium', 'todo', d0 - 50, f, o_pjm, p_cor, t0 - interval '60 days', true);
  perform pg_temp.act(f, t0 - interval '25 days');
  update public.tasks set status = 'done' where title = 'Collect KYC documents from PJM Advisory' and is_demo;

  perform pg_temp.act(m, t0 - interval '45 days');
  insert into public.tasks (title, priority, status, due_date, assignee_id, deal_id, project_id, created_at, is_demo)
  values ('Send Global Sphere product specs (urea 46% N, NPK, DAP) to the Ministry', 'high', 'todo', d0 - 38, m, d_mau, p_mau, t0 - interval '45 days', true);
  perform pg_temp.act(m, t0 - interval '39 days');
  update public.tasks set status = 'done' where deal_id = d_mau and title like 'Send Global Sphere%';

  if s is not null then
    perform pg_temp.act(f, t0 - interval '29 days');
    insert into public.tasks (title, priority, status, due_date, assignee_id, deal_id, created_at, is_demo)
    values ('Build the Morogoro data room index', 'medium', 'todo', d0 - 20, s, d_mor, t0 - interval '29 days', true);
    perform pg_temp.act(s, t0 - interval '21 days');
    update public.tasks set status = 'done' where deal_id = d_mor and title = 'Build the Morogoro data room index';

    perform pg_temp.act(f, t0 - interval '8 days');
    insert into public.tasks (title, description, priority, due_date, assignee_id, deal_id, created_at, is_demo)
    values ('Request audited financials for the Morogoro agro-processing hub',
            'Last three years, plus land title copies for the processing site.', 'medium', d0 + 5, s, d_mor, t0 - interval '8 days', true);
  end if;

  perform pg_temp.act(f, t0 - interval '20 days');
  insert into public.tasks (title, description, priority, due_date, assignee_id, organization_id, contract_id, project_id, created_at, is_demo)
  values ('Confirm Patrick Joseph Muwowo''s authority to sign for PJM Advisory',
          'Ask for a board resolution or power of attorney. Without it the NCNDA may not bind PJM Advisory.',
          'high', d0 - 3, f, o_pjm, k_pjm, p_cor, t0 - interval '20 days', true);

  perform pg_temp.act(f, t0 - interval '16 days');
  insert into public.tasks (title, priority, due_date, assignee_id, deal_id, created_at, is_demo)
  values ('Schedule site visit to the Dodoma mini-grid villages', 'medium', d0 - 6, f, d_dod, t0 - interval '16 days', true);

  perform pg_temp.act(m, t0 - interval '15 days');
  insert into public.tasks (title, priority, due_date, assignee_id, organization_id, contract_id, project_id, created_at, is_demo)
  values ('Get the Faminas signatory name and registered address for the mandate', 'high', d0 + 2, m, o_fam, k_fam, p_cor, t0 - interval '15 days', true);

  perform pg_temp.act(m, t0 - interval '10 days');
  insert into public.tasks (title, priority, due_date, assignee_id, deal_id, project_id, created_at, is_demo)
  values ('Follow up with the Ministry on the fertilizer proposal', 'high', d0 - 1, m, d_mau, p_mau, t0 - interval '10 days', true);

  perform pg_temp.act(m, t0 - interval '5 days');
  insert into public.tasks (title, description, priority, due_date, assignee_id, contract_id, created_at, is_demo)
  values ('Decide: renew the Faminas mandate or give notice',
          'Auto-renews for another year unless notice is given 30 days before the term ends. Also raise the DIFC-LCIA forum clause with counsel.',
          'urgent', fam_end - 32, m, k_fam, t0 - interval '5 days', true);

  perform pg_temp.act(m, t0 - interval '4 days');
  insert into public.tasks (title, priority, due_date, assignee_id, deal_id, created_at, is_demo)
  values ('Mark up the Faminas term sheet for Douala cold-chain', 'high', d0 + 3, m, d_dla, t0 - interval '4 days', true);

  perform pg_temp.act(f, t0 - interval '3 days');
  insert into public.tasks (title, priority, due_date, assignee_id, project_id, created_at, is_demo) values
    ('Upload signed copies of all agreements to the vault', 'medium', d0 + 7, f, p_cor, t0 - interval '3 days', true),
    ('Prepare the Q4 investor update', 'medium', d0 + 21, f, null, t0 - interval '3 days', true);

  -- -------------------------------------------------------------------------
  -- Meetings this week (Dubai local times)
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '2 days');
  insert into public.meetings (title, starts_at, ends_at, location, deal_id, organization_id, attendee_ids, is_demo) values
    ('Morogoro due diligence kick-off', ((d0 - 1) + time '10:00') at time zone 'Asia/Dubai', ((d0 - 1) + time '11:00') at time zone 'Asia/Dubai',
     'Video call', d_mor, o_pjm, array_remove(array[f, s], null), true),
    ('PJM Advisory — Dodoma pipeline call', ((d0 + 1) + time '11:00') at time zone 'Asia/Dubai', ((d0 + 1) + time '11:45') at time zone 'Asia/Dubai',
     'Video call', d_dod, o_pjm, array[f], true),
    ('Faminas investment committee prep', ((d0 + 2) + time '14:00') at time zone 'Asia/Dubai', ((d0 + 2) + time '15:00') at time zone 'Asia/Dubai',
     'Lantana office, RAK', d_dla, o_fam, array[m, f], true),
    ('Global Sphere — shipment schedule and pricing', ((d0 + 3) + time '10:30') at time zone 'Asia/Dubai', ((d0 + 3) + time '11:30') at time zone 'Asia/Dubai',
     'Global Sphere offices', d_mau, o_gs, array[m], true),
    ('Principals'' weekly review', ((d0 + 4) + time '09:00') at time zone 'Asia/Dubai', ((d0 + 4) + time '10:00') at time zone 'Asia/Dubai',
     'Lantana office, RAK', null, null, array[m, f], true);

  -- -------------------------------------------------------------------------
  -- Compliance: listed as UNCONFIRMED. Nothing here drives alerts until a
  -- principal confirms it applies and enters the real date.
  -- -------------------------------------------------------------------------
  perform pg_temp.act(f, t0 - interval '3 days');
  insert into public.compliance_items (title, category, authority, status, owner_id, notes, is_demo) values
    ('Corporate Tax registration and annual return', 'tax', 'Federal Tax Authority', 'unconfirmed', f,
     'Registration applies to free-zone companies too. Confirm the filing deadline with the accountant.', true),
    ('VAT registration', 'tax', 'Federal Tax Authority', 'unconfirmed', f,
     'Mandatory only above AED 375,000 of taxable supplies in 12 months. Confirm whether Lantana has crossed it.', true),
    ('UBO register kept with RAKEZ', 'filing', 'RAKEZ', 'unconfirmed', f, 'Confirm the register is current after any shareholding change.', true);

  -- -------------------------------------------------------------------------
  -- Finance (demo figures)
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '180 days');
  insert into public.accounts (code, name, type, is_demo) values
    ('1000', 'Bank — operating', 'asset', true),
    ('4000', 'Advisory fees', 'income', true),
    ('5000', 'Rent and office', 'expense', true),
    ('5100', 'Licences and government fees', 'expense', true),
    ('5200', 'Travel', 'expense', true),
    ('5300', 'Software and subscriptions', 'expense', true),
    ('5400', 'Professional fees', 'expense', true),
    ('5500', 'Salaries', 'expense', true);

  insert into public.bank_accounts (id, name, currency, opening_balance_minor, opening_date, iban_last4, is_demo)
  values (bank, 'Operating account (AED)', 'AED', 18500000, d0 - 180, null, true);

  for i in 0 .. 5 loop
    insert into public.transactions (txn_date, description, account_id, bank_account_id, amount_minor, currency, is_demo)
    select d0 - 175 + i * 30, 'Co-working desk rent', a.id, bank, -250000, 'AED', true from public.accounts a where a.code = '5000' and a.is_demo;
    insert into public.transactions (txn_date, description, account_id, bank_account_id, amount_minor, currency, is_demo)
    select d0 - 170 + i * 30, 'Software subscriptions', a.id, bank, -65000, 'AED', true from public.accounts a where a.code = '5300' and a.is_demo;
    -- The last month is paid through a real payroll run below.
    continue when i = 5;
    insert into public.transactions (txn_date, description, account_id, bank_account_id, amount_minor, currency, is_payroll, is_demo)
    select d0 - 165 + i * 30, 'Payroll run', a.id, bank, -1800000, 'AED', true, true from public.accounts a where a.code = '5500' and a.is_demo;
  end loop;

  insert into public.transactions (txn_date, description, account_id, bank_account_id, amount_minor, currency, counterparty_org_id, deal_id, is_demo)
  select v.dt, v.descr, a.id, bank, v.amt, v.cur, v.org, v.deal, true
  from (values
    (d0 - 110, 'Legal review of NCNDA templates', '5400', -450000::bigint, 'AED', null::uuid, null::uuid),
    (d0 - 95,  'Travel — Dar es Salaam (PJM meetings)', '5200', -980000, 'AED', o_pjm, d_mor),
    (d0 - 70,  'Advisory fee received — Global Sphere market entry', '4000', 3672500, 'AED', o_gs, null),
    (d0 - 50,  'Travel — Nouakchott (Ministry meeting)', '5200', -1240000, 'AED', o_mau, d_mau),
    (d0 - 20,  'Travel — Douala site visit', '5200', -1120000, 'AED', o_dla, d_dla)
  ) as v(dt, descr, code, amt, cur, org, deal)
  join public.accounts a on a.code = v.code and a.is_demo;

  insert into public.invoices (invoice_no, organization_id, kind, issue_date, due_date, currency, total_minor, status, paid_at, is_demo) values
    ('INV-DEMO-001', o_gs, 'advisory', d0 - 100, d0 - 70, 'USD', 1000000, 'paid', d0 - 70, true),
    ('INV-DEMO-002', o_gs, 'advisory', d0 - 40, d0 - 10, 'USD', 750000, 'sent', null, true);

  -- -------------------------------------------------------------------------
  -- Notifications
  -- -------------------------------------------------------------------------
  insert into public.notifications (user_id, kind, title, body, entity_type, entity_id, is_demo, created_at) values
    (m, 'contract_notice', 'Faminas mandate: notice deadline in ' || (fam_end - 30 - d0) || ' days',
     'The mandate auto-renews on ' || to_char(fam_end, 'DD Mon YYYY') || ' unless notice is given.', 'contract', k_fam, true, t0 - interval '1 day'),
    (f, 'task_overdue', 'Overdue: confirm PJM signing authority', null, 'contract', k_pjm, true, t0 - interval '2 days'),
    (m, 'deal_stale', 'Dar es Salaam logistics warehouse has been quiet for 18 days', null, 'deal', d_dar, true, t0 - interval '6 hours');

  -- -------------------------------------------------------------------------
  -- Phase 2 additions: close dates, milestones, checklists, comments,
  -- dependencies, recurring tasks, interactions, notes
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '2 days');
  update public.deals set expected_close_date = d0 + 45  where id = d_dla;
  update public.deals set expected_close_date = d0 + 120 where id = d_mor;
  update public.deals set expected_close_date = d0 + 90  where id = d_mau;
  update public.deals set expected_close_date = d0 + 200 where id = d_dod;
  update public.deals set expected_close_date = d0 + 240 where id = d_dar;
  update public.deals set expected_close_date = d0 + 330 where id = d_lag;

  insert into public.milestones (project_id, name, due_date, status, sort_order, is_demo) values
    (p_mau, 'Proposal sent to the Ministry', d0 - 40, 'done', 1, true),
    (p_mau, 'Ministry feedback on volumes and pricing', d0 + 20, 'open', 2, true),
    (p_mau, 'Supply contract signed', d0 + 60, 'open', 3, true),
    (p_mau, 'First shipment loaded', d0 + 110, 'open', 4, true),
    (p_cor, 'All signed agreements in the vault', d0 + 7, 'open', 1, true),
    (p_cor, 'Compliance obligations confirmed', d0 + 30, 'open', 2, true);

  insert into public.task_checklist_items (task_id, label, done, sort_order, is_demo)
  select t.id, v.label, v.done, v.ord, true
  from public.tasks t,
       (values ('Check fee clause against the mandate (deal by deal)', true, 1),
               ('Confirm SPV jurisdiction', false, 2),
               ('Flag the exclusivity period', false, 3),
               ('Send mark-up to Faminas', false, 4)) as v(label, done, ord)
  where t.deal_id = d_dla and t.title like 'Mark up the Faminas term sheet%';

  insert into public.task_comments (task_id, body, created_by, is_demo, created_at)
  select t.id, 'Started on the fee clause. The mandate says fees are agreed deal by deal, so we should propose the number here rather than leave it open.', m, true, t0 - interval '3 days'
  from public.tasks t where t.deal_id = d_dla and t.title like 'Mark up the Faminas term sheet%';

  insert into public.task_dependencies (task_id, depends_on_id, is_demo)
  select a.id, b.id, true
  from public.tasks a, public.tasks b
  where a.title = 'Follow up with the Ministry on the fertilizer proposal' and a.is_demo
    and b.title like 'Send Global Sphere product specs%' and b.is_demo;

  perform pg_temp.act(f, t0 - interval '6 days');
  insert into public.tasks (title, description, priority, due_date, assignee_id, project_id, source, recurrence_rule, created_at, is_demo) values
    ('Prepare the monthly management pack', 'Pipeline, cash, overdue items and the introductions logged this month.', 'medium',
     (date_trunc('month', d0) + interval '1 month 4 days')::date, f, p_cor, 'manual', 'FREQ=MONTHLY', t0 - interval '6 days', true),
    ('Weekly pipeline review', 'Walk every open deal: next step, owner, date.', 'medium', d0 + 4, m, null, 'manual', 'FREQ=WEEKLY', t0 - interval '6 days', true);

  perform pg_temp.act(f, t0 - interval '12 days');
  insert into public.interactions (organization_id, contact_id, deal_id, kind, occurred_on, summary, is_demo) values
    (o_pjm, c_pat, d_dod, 'call', d0 - 12, 'Walked through the Dodoma site list. Site visit to be scheduled.', true);
  perform pg_temp.act(m, t0 - interval '9 days');
  insert into public.interactions (organization_id, deal_id, kind, occurred_on, summary, is_demo) values
    (o_fam, d_dla, 'meeting', d0 - 9, 'Reviewed the Douala term sheet structure. Mark-up to follow from Lantana.', true);
  perform pg_temp.act(m, t0 - interval '22 days');
  insert into public.interactions (organization_id, deal_id, kind, occurred_on, summary, is_demo) values
    (o_gs, d_mau, 'visit', d0 - 22, 'Discussed urea, NPK and DAP availability for the Mauritania proposal.', true);
  perform pg_temp.act(f, t0 - interval '15 days');
  insert into public.interactions (organization_id, kind, occurred_on, summary, is_demo) values
    (o_fam, 'email', d0 - 15, 'Asked Faminas for the mandate signatory name and registered address.', true);

  perform pg_temp.act(m, t0 - interval '5 days');
  insert into public.notes (entity_type, entity_id, body, pinned, created_by, is_demo) values
    ('organization', o_fam, 'Mandate signatory and registered address are still outstanding. Do not treat the mandate as fully executed until both are in.', true, m, true),
    ('organization', o_pjm, 'NCNDA signed by Patrick Joseph Muwowo. We still need evidence he can bind PJM Advisory.', true, f, true),
    ('deal', d_mau, 'Volumes and delivery schedule depend on the Ministry''s feedback. Keep Global Sphere updated before quoting prices.', false, m, true);

  -- -------------------------------------------------------------------------
  -- Phase 3 additions: contract owners, tags, one standing obligation
  -- -------------------------------------------------------------------------
  perform pg_temp.act(m, t0 - interval '1 day');
  update public.contracts set owner_id = f where id in (k_pjm, k_fai, k_rak);
  update public.contracts set owner_id = m where id = k_fam;

  insert into public.tags (name, is_demo) values ('NCNDA', true), ('Mandate', true), ('Tanzania', true), ('Mauritania', true), ('Signed copy needed', true);
  insert into public.document_tags (document_id, tag_id)
  select v.doc, t.id from (values
      (doc_pjm, 'NCNDA'), (doc_pjm, 'Tanzania'), (doc_pjm, 'Signed copy needed'),
      (doc_fai, 'NCNDA'), (doc_fai, 'Signed copy needed'),
      (doc_fam, 'Mandate'), (doc_mau, 'Mauritania'), (doc_rak, 'Signed copy needed')) as v(doc, tag)
  join public.tags t on t.name = v.tag and t.is_demo;

  -- The Morogoro data room index is linked to the deal, so staff on the deal can see it.
  insert into public.document_links (document_id, entity_type, entity_id) values (doc_pjm, 'deal', d_mor);

  insert into public.contract_obligations (contract_id, description, owner_id, is_demo)
  values (k_pjm, 'Agree Lantana''s fee with PJM Advisory for each project before the SPV is formed', f, true);

  -- -------------------------------------------------------------------------
  -- Phase 5: people, payroll, leave, checklists, bills, budgets, governance.
  -- Salaries, ID numbers and IBANs are obviously fake and go through the
  -- same encrypting functions the app uses.
  -- -------------------------------------------------------------------------
  declare
    e_mai uuid := 'c5000000-0000-4000-8000-000000000001';
    e_fai uuid := 'c5000000-0000-4000-8000-000000000002';
    e_mgr uuid := 'c5000000-0000-4000-8000-000000000003';
    e_stf uuid := 'c5000000-0000-4000-8000-000000000004';
    e_new uuid := 'c5000000-0000-4000-8000-000000000005';
    cl_new uuid := 'c5100000-0000-4000-8000-000000000001';
    mt_brd uuid := 'c5200000-0000-4000-8000-000000000001';
    last_month date := (date_trunc('month', d0) - interval '1 month')::date;
    this_month date := date_trunc('month', d0)::date;
    run jsonb;
    a_sal uuid := (select id from public.accounts where code = '5500' and is_demo);
  begin
    perform pg_temp.act(m, t0 - interval '200 days');
    insert into public.employees (id, profile_id, full_name, job_title, department, work_email, manager_id, employment_type,
                                  status, on_payroll, start_date, probation_end, work_location,
                                  visa_expiry, emirates_id_expiry, labour_card_expiry, passport_expiry, insurance_expiry, is_demo) values
      (e_mai, m, 'Maimouna Baba Danpullo', 'Founder & Managing Director', 'Management', 'maimouna@lantana.test', null, 'full_time',
       'active', false, d0 - 420, null, 'Ras Al Khaimah', d0 + 260, d0 + 260, null, d0 + 1100, d0 + 120, true),
      (e_fai, f, 'Fai Shey Derick', 'Principal, Strategy & Business Development', 'Management', 'fai@lantana.test', e_mai, 'full_time',
       'active', false, d0 - 400, null, 'Ras Al Khaimah', d0 + 45, d0 + 45, null, d0 + 700, d0 + 120, true),
      (e_mgr, mg, 'Test Manager', 'Operations Manager', 'Operations', 'manager@lantana.test', e_mai, 'full_time',
       'active', true, d0 - 190, d0 - 10, 'Ras Al Khaimah', d0 + 540, d0 + 540, d0 + 540, d0 + 1500, d0 + 120, true),
      (e_stf, s, 'Test Staff', 'Investment Analyst', 'Deals', 'staff@lantana.test', e_fai, 'full_time',
       'active', true, d0 - 160, d0 + 20, 'Ras Al Khaimah', d0 + 570, d0 + 570, d0 + 570, d0 + 2000, d0 + 120, true),
      (e_new, null, 'Aisha Ndiaye', 'Office & Finance Administrator', 'Operations', null, e_mgr, 'full_time',
       'onboarding', true, d0 + 12, d0 + 192, 'Ras Al Khaimah', null, null, null, d0 + 1300, null, true);

    perform public.add_employee_compensation(e_mgr, d0 - 190, 'AED', 750000, 250000, 80000, 0, 'Offer letter terms');
    perform public.add_employee_compensation(e_stf, d0 - 160, 'AED', 500000, 200000, 70000, 0, 'Offer letter terms');
    perform public.add_employee_compensation(e_new, d0 + 12, 'AED', 450000, 150000, 50000, 0, 'Offer accepted');

    perform public.set_employee_identity(e_mgr, jsonb_build_object(
      'nationality', 'KE', 'passport_no', 'AK0000001', 'emirates_id_no', '784-1990-0000001-1',
      'mohre_person_code', '10000000000001', 'iban', 'AE070330000000000000001', 'bank_name', 'Demo Bank', 'bank_routing_code', '803320101'));
    perform public.set_employee_identity(e_stf, jsonb_build_object(
      'nationality', 'CM', 'passport_no', 'CM0000002', 'emirates_id_no', '784-1996-0000002-2',
      'mohre_person_code', '10000000000002', 'iban', 'AE070330000000000000002', 'bank_name', 'Demo Bank', 'bank_routing_code', '803320101'));

    -- Last month paid (it creates its own ledger line), this month in draft.
    perform pg_temp.act(f, t0 - interval '20 days');
    run := public.create_payroll_run(last_month, (last_month + interval '1 month - 1 day')::date);
    perform public.set_payroll_status((run ->> 'id')::uuid, 'approved');
    perform public.set_payroll_status((run ->> 'id')::uuid, 'paid', bank, a_sal, (last_month + interval '1 month - 1 day')::date);
    perform public.set_payroll_wps((run ->> 'id')::uuid, 'accepted', 'WPS-DEMO-' || to_char(last_month, 'YYYYMM'), null);
    perform pg_temp.act(f, t0 - interval '1 day');
    run := public.create_payroll_run(this_month, (this_month + interval '1 month - 1 day')::date);

    -- Leave
    perform pg_temp.act(m, t0 - interval '30 days');
    insert into public.leave_balances (employee_id, year, kind, entitled_days, carried_over, is_demo)
    select e.id, extract(year from d0)::int, k.kind, k.days, 0, true
    from (values (e_mgr), (e_stf), (e_new)) as e(id)
    cross join (values ('annual', 30::numeric), ('sick', 90::numeric)) as k(kind, days);
    perform pg_temp.act(mg, t0 - interval '40 days');
    insert into public.leave_requests (employee_id, kind, start_date, end_date, days, reason, is_demo)
    values (e_mgr, 'annual', d0 - 35, d0 - 31, 5, 'Family visit', true);
    perform pg_temp.act(m, t0 - interval '39 days');
    update public.leave_requests set status = 'approved' where employee_id = e_mgr and is_demo;
    perform pg_temp.act(s, t0 - interval '2 days');
    insert into public.leave_requests (employee_id, kind, start_date, end_date, days, reason, is_demo)
    values (e_stf, 'annual', d0 + 21, d0 + 25, 5, 'Travel home to Douala', true);

    -- Onboarding checklist for the new hire
    perform pg_temp.act(mg, t0 - interval '5 days');
    insert into public.checklists (id, employee_id, kind, title, is_demo)
    values (cl_new, e_new, 'onboarding', 'Onboarding: Aisha Ndiaye', true);
    insert into public.checklist_items (checklist_id, position, title, owner_id, due_date, done_at, is_demo) values
      (cl_new, 1, 'Signed offer letter on file', mg, d0 - 4, t0 - interval '4 days', true),
      (cl_new, 2, 'MOHRE employment contract signed', mg, d0 + 2, null, true),
      (cl_new, 3, 'Entry permit and change of status', mg, d0 + 5, null, true),
      (cl_new, 4, 'Medical fitness test and Emirates ID biometrics', mg, d0 + 15, null, true),
      (cl_new, 5, 'Residence visa stamped', mg, d0 + 25, null, true),
      (cl_new, 6, 'Health insurance enrolled', mg, d0 + 12, null, true),
      (cl_new, 7, 'Salary account opened and added to WPS', f, d0 + 30, null, true),
      (cl_new, 8, 'Laptop, email and Lantana Command login', mg, d0 + 12, null, true),
      (cl_new, 9, 'Confidentiality undertaking signed', s, d0 + 12, null, true);

    -- Finance: bills, rules, budgets, a draft invoice with lines
    perform pg_temp.act(m, t0 - interval '25 days');
    insert into public.bills (supplier_org_id, supplier_name, reference, description, account_id, issue_date, due_date,
                              currency, total_minor, status, paid_at, is_demo)
    select v.org, v.sup, v.ref, v.descr, a.id, v.iss, v.due, 'AED', v.amt, v.st, v.paid, true
    from (values
      (o_rak, null::text, 'RAKEZ-INV-DEMO-1', 'Co-working desk, next quarter', '5000', d0 - 25, d0 + 5, 750000::bigint, 'open', null::date),
      (null::uuid, 'Demo Accounting LLC', 'DA-DEMO-77', 'Bookkeeping and VAT advice, Q3', '5400', d0 - 40, d0 - 10, 315000, 'open', null),
      (null::uuid, 'Demo Accounting LLC', 'DA-DEMO-61', 'Bookkeeping, Q2', '5400', d0 - 130, d0 - 100, 315000, 'paid', d0 - 101)
    ) as v(org, sup, ref, descr, code, iss, due, amt, st, paid)
    join public.accounts a on a.code = v.code and a.is_demo;

    insert into public.category_rules (pattern, account_id, is_demo)
    select v.pat, a.id, true
    from (values ('co-working', '5000'), ('rent', '5000'), ('emirates', '5200'), ('flydubai', '5200'),
                 ('hotel', '5200'), ('google workspace', '5300'), ('microsoft', '5300'), ('rakez', '5100'),
                 ('advisory fee', '4000')) as v(pat, code)
    join public.accounts a on a.code = v.code and a.is_demo;

    insert into public.budgets (account_id, month, amount_minor, currency, is_demo)
    select a.id, (date_trunc('month', d0) + make_interval(months => mo))::date, v.amt, 'AED', true
    from (values ('5000', 250000::bigint), ('5100', 50000), ('5200', 1000000), ('5300', 70000),
                 ('5400', 150000), ('5500', 1800000)) as v(code, amt)
    join public.accounts a on a.code = v.code and a.is_demo
    cross join generate_series(-3, 2) as mo;

    insert into public.invoices (invoice_no, organization_id, kind, issue_date, due_date, currency, total_minor, status,
                                 vat_rate, reference, is_demo)
    values ('INV-DEMO-003', o_gs, 'retainer', d0, d0 + 30, 'USD', 0, 'draft', 5, 'PO GS-DEMO-2210', true);
    insert into public.invoice_items (invoice_id, position, description, quantity, unit_price_minor, is_demo)
    select i.id, v.pos, v.descr, v.qty, v.price, true
    from public.invoices i
    cross join (values (1, 'Market-entry advisory retainer, October', 1::numeric, 500000::bigint),
                       (2, 'Site visit support, Nouakchott (days)', 2::numeric, 75000::bigint)) as v(pos, descr, qty, price)
    where i.invoice_no = 'INV-DEMO-003';

    -- Governance
    perform pg_temp.act(m, t0 - interval '60 days');
    insert into public.corporate_records (kind, title, reference_no, authority, detail, issue_date, expiry_date, document_id, is_demo)
    values ('lease', 'Co-working agreement (Compass Building)', 'FDCW2089', 'RAKEZ', 'Flexi desk; required for licence renewal',
            d0 - 280, d0 + 85, doc_rak, true);
    insert into public.meetings (id, title, kind, starts_at, ends_at, location, attendee_ids, notes, minutes, minutes_approved_at, is_demo)
    values (mt_brd, 'Board meeting: H2 priorities', 'board', t0 - interval '60 days', t0 - interval '60 days' + interval '90 minutes',
            'Lantana office, RAK', array[m, f],
            'Agenda: pipeline review, banking, hiring.',
            E'Present: Maimouna Baba Danpullo (chair), Fai Shey Derick.\n\n1. Pipeline: focus on the Mauritania supply deal and the Morogoro project.\n2. Banking: open a USD account for fee receipts.\n3. Hiring: approve an office and finance administrator.',
            t0 - interval '55 days', true);
    insert into public.resolutions (meeting_id, ref_no, title, body, kind, status, passed_on, is_demo) values
      (mt_brd, 'BR-DEMO-01', 'Open a USD operating account', 'Resolved that the company opens a USD account for fee receipts, with both principals as joint signatories.', 'board', 'passed', d0 - 60, true),
      (mt_brd, 'BR-DEMO-02', 'Hire an office and finance administrator', 'Resolved to hire one administrator on a full-time UAE employment contract.', 'board', 'passed', d0 - 60, true);
  end;

  -- Tidy up session state so nothing after this runs as a demo user.
  perform set_config('request.jwt.claims', '', false);
  perform set_config('app.occurred_at', '', false);
end $$;
