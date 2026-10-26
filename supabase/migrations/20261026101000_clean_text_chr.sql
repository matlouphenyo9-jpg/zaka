-- clean_text_ok built from code points (chr) instead of regex escapes: a backslash-escaped version applied through a
-- JSON tool call arrived with doubled backslashes, which turned the class into a range covering A–Z and rejected
-- normal capitalised names for a few minutes (B4 Issues found). chr() has nothing that can be mis-escaped.
create or replace function public.clean_text_ok(v text, max_len int) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select v is null or (
    char_length(v) between 1 and max_len
    and v ~ '[[:alpha:]]'
    and v !~ ('[' || chr(1) || '-' || chr(8) || chr(11) || chr(12) || chr(14) || '-' || chr(31) || chr(127) || '-' || chr(159)
              || chr(173) || chr(1564) || chr(6158) || chr(8203) || '-' || chr(8207) || chr(8234) || '-' || chr(8238)
              || chr(8288) || '-' || chr(8292) || chr(8294) || '-' || chr(8303) || chr(65279) || chr(65529) || '-' || chr(65531) || ']')
    and v = btrim(v)
  )
$$;
