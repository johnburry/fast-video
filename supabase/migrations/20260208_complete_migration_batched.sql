-- Complete migration in batches using DO block to avoid timeout
-- This processes 50,000 rows at a time

DO $$
DECLARE
  batch_size INT := 50000;
  rows_inserted INT;
  total_inserted INT := 0;
  batch_num INT := 0;
BEGIN
  LOOP
    batch_num := batch_num + 1;
    RAISE NOTICE 'Processing batch %', batch_num;

    -- Insert batch
    WITH rows_to_insert AS (
      SELECT src.*
      FROM transcript_search_context_new src
      WHERE NOT EXISTS (
        SELECT 1
        FROM transcript_search_context_temp dest
        WHERE dest.transcript_id = src.transcript_id
      )
      LIMIT batch_size
    )
    INSERT INTO transcript_search_context_temp
    SELECT * FROM rows_to_insert
    ON CONFLICT (transcript_id) DO NOTHING;

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    total_inserted := total_inserted + rows_inserted;

    RAISE NOTICE 'Inserted % rows (total: %)', rows_inserted, total_inserted;

    -- Exit if no more rows to insert
    EXIT WHEN rows_inserted = 0;

    -- Small delay to avoid overwhelming the database
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Migration complete! Total inserted: %', total_inserted;
END $$;

-- Check final counts
SELECT
  (SELECT COUNT(*) FROM transcript_search_context_new) as source_count,
  (SELECT COUNT(*) FROM transcript_search_context_temp) as dest_count,
  (SELECT COUNT(*) FROM transcript_search_context_new) -
  (SELECT COUNT(*) FROM transcript_search_context_temp) as remaining;
