SELECT 
  b.id,
  b.title,
  (regexp_match(b.pages_v2::text, 'imports/([^/"]+)/'))[1] AS session_id,
  (
    SELECT count(*) 
    FROM regexp_matches(b.pages_v2::text, 'imports/[^/"]+/', 'g')
  ) AS hits
FROM books b
WHERE b.pages_v2::text LIKE '%/imports/%'
ORDER BY b.id;
