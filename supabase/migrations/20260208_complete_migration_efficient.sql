-- Ultra-efficient migration using EXCEPT to find missing rows
-- This avoids the slow NOT EXISTS subquery in the loop

DO $$
DECLARE
  batch_size INT := 100000;
  rows_inserted INT;
  total_inserted INT := 0;
  batch_num INT := 0;
BEGIN
  -- Create temporary table with missing IDs (this is fast with EXCEPT)
  CREATE TEMP TABLE missing_ids AS
  SELECT transcript_id
  FROM transcript_search_context_new
  EXCEPT
  SELECT transcript_id
  FROM transcript_search_context_temp;

  RAISE NOTICE 'Found % missing transcript IDs', (SELECT COUNT(*) FROM missing_ids);

  -- Create index on temp table for fast lookups
  CREATE INDEX idx_missing_ids ON missing_ids(transcript_id);

  -- Now insert in batches using the pre-computed missing IDs
  LOOP
    batch_num := batch_num + 1;
    RAISE NOTICE 'Processing batch %', batch_num;

    -- Insert batch by joining with missing_ids
    WITH batch_to_insert AS (
      SELECT src.*
      FROM transcript_search_context_new src
      INNER JOIN missing_ids m ON m.transcript_id = src.transcript_id
      LIMIT batch_size
    )
    INSERT INTO transcript_search_context_temp
    SELECT * FROM batch_to_insert
    ON CONFLICT (transcript_id) DO NOTHING;

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    total_inserted := total_inserted + rows_inserted;

    RAISE NOTICE 'Batch %: inserted % rows (total: %)',
      batch_num, rows_inserted, total_inserted;

    -- Remove inserted IDs from missing_ids to avoid re-processing
    DELETE FROM missing_ids
    WHERE transcript_id IN (
      SELECT transcript_id
      FROM transcript_search_context_temp
      ORDER BY transcript_id DESC
      LIMIT batch_size
    );

    -- Exit if no more rows
    EXIT WHEN rows_inserted = 0 OR (SELECT COUNT(*) FROM missing_ids) = 0;

    -- Small delay
    PERFORM pg_sleep(0.1);
  END LOOP;

  DROP TABLE missing_ids;

  RAISE NOTICE 'Migration complete! Total inserted: %', total_inserted;
END $$;

-- Verify completion
SELECT
  (SELECT COUNT(*) FROM transcript_search_context_new) as source_count,
  (SELECT COUNT(*) FROM transcript_search_context_temp) as dest_count,
  (SELECT COUNT(*) FROM transcript_search_context_new) -
  (SELECT COUNT(*) FROM transcript_search_context_temp) as remaining;
