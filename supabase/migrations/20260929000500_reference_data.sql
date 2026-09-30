-- Reference data that is true in every environment (not demo).

insert into public.company (legal_name, licence_no, licensing_authority, address_lines, website)
values ('Lantana Vision FZ-LLC', 'FDCW2089', 'RAKEZ',
        array['Compass Building, Al Shohada Road', 'Al Hamra Industrial Zone-FZ', 'Ras Al Khaimah, United Arab Emirates'],
        'https://www.lantanavision.com');

insert into public.currencies (code, name, minor_unit, symbol) values
  ('AED', 'UAE dirham', 2, 'AED'),
  ('USD', 'US dollar', 2, '$'),
  ('EUR', 'Euro', 2, '€'),
  ('GBP', 'Pound sterling', 2, '£'),
  ('SAR', 'Saudi riyal', 2, 'SAR'),
  ('XAF', 'Central African CFA franc', 0, 'FCFA'),
  ('XOF', 'West African CFA franc', 0, 'CFA'),
  ('TZS', 'Tanzanian shilling', 2, 'TSh'),
  ('NGN', 'Nigerian naira', 2, '₦'),
  ('KES', 'Kenyan shilling', 2, 'KSh'),
  ('MRU', 'Mauritanian ouguiya', 2, 'UM'),
  ('ZAR', 'South African rand', 2, 'R');

-- Hard pegs. Floating rates are entered by users (or seeded as demo).
insert into public.fx_rates (rate_date, base, quote, rate, source) values
  ('2020-01-01', 'USD', 'AED', 3.6725, 'peg'),
  ('2020-01-01', 'SAR', 'AED', 0.9793333333, 'peg');

insert into public.pipeline_stages (key, label, sort_order, default_probability, is_advanced, is_terminal, is_won) values
  ('lead',           'Lead',               10,   5, false, false, false),
  ('qualified',      'Qualified',          20,  10, false, false, false),
  ('nda_signed',     'NDA/NCNDA signed',   30,  15, false, false, false),
  ('mandate_signed', 'Mandate signed',     40,  25, false, false, false),
  ('introduced',     'Introduced',         50,  35, false, false, false),
  ('due_diligence',  'Due diligence',      60,  50, true,  false, false),
  ('term_sheet',     'Term sheet',         70,  70, true,  false, false),
  ('closing',        'Closing',            80,  85, true,  false, false),
  ('closed_won',     'Closed-won',         90, 100, false, true,  true),
  ('closed_lost',    'Closed-lost',       100,   0, false, true,  false);

insert into public.countries (code, name, region) values
  ('DZ','Algeria','africa'),('AO','Angola','africa'),('BJ','Benin','africa'),('BW','Botswana','africa'),
  ('BF','Burkina Faso','africa'),('BI','Burundi','africa'),('CV','Cabo Verde','africa'),('CM','Cameroon','africa'),
  ('CF','Central African Republic','africa'),('TD','Chad','africa'),('KM','Comoros','africa'),('CG','Congo','africa'),
  ('CD','DR Congo','africa'),('CI','Côte d''Ivoire','africa'),('DJ','Djibouti','africa'),('EG','Egypt','africa'),
  ('GQ','Equatorial Guinea','africa'),('ER','Eritrea','africa'),('SZ','Eswatini','africa'),('ET','Ethiopia','africa'),
  ('GA','Gabon','africa'),('GM','Gambia','africa'),('GH','Ghana','africa'),('GN','Guinea','africa'),
  ('GW','Guinea-Bissau','africa'),('KE','Kenya','africa'),('LS','Lesotho','africa'),('LR','Liberia','africa'),
  ('LY','Libya','africa'),('MG','Madagascar','africa'),('MW','Malawi','africa'),('ML','Mali','africa'),
  ('MR','Mauritania','africa'),('MU','Mauritius','africa'),('MA','Morocco','africa'),('MZ','Mozambique','africa'),
  ('NA','Namibia','africa'),('NE','Niger','africa'),('NG','Nigeria','africa'),('RW','Rwanda','africa'),
  ('ST','São Tomé and Príncipe','africa'),('SN','Senegal','africa'),('SC','Seychelles','africa'),('SL','Sierra Leone','africa'),
  ('SO','Somalia','africa'),('ZA','South Africa','africa'),('SS','South Sudan','africa'),('SD','Sudan','africa'),
  ('TZ','Tanzania','africa'),('TG','Togo','africa'),('TN','Tunisia','africa'),('UG','Uganda','africa'),
  ('ZM','Zambia','africa'),('ZW','Zimbabwe','africa'),('EH','Western Sahara','africa'),
  ('AE','United Arab Emirates','gcc'),('SA','Saudi Arabia','gcc'),('QA','Qatar','gcc'),('KW','Kuwait','gcc'),
  ('BH','Bahrain','gcc'),('OM','Oman','gcc'),
  ('GB','United Kingdom','other'),('US','United States','other'),('FR','France','other'),('CH','Switzerland','other'),
  ('DE','Germany','other'),('CN','China','other'),('IN','India','other'),('TR','Türkiye','other');
