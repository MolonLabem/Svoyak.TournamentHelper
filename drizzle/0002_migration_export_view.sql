CREATE VIEW svoyak_migration_chunks AS
WITH RECURSIVE chunks(id, chunk_index, chunk_count, payload_hex) AS (
  SELECT id, 0, (length(hex(payload)) + 511) / 512, hex(payload)
  FROM tournaments
  UNION ALL
  SELECT id, chunk_index + 1, chunk_count, payload_hex
  FROM chunks
  WHERE chunk_index + 1 < chunk_count
)
SELECT t.id, t.revision, t.updated_at, t.management_key_hash,
       chunks.chunk_index, chunks.chunk_count,
       substr(chunks.payload_hex, chunks.chunk_index * 512 + 1, 512) AS payload_hex_chunk
FROM chunks JOIN tournaments AS t ON t.id = chunks.id
ORDER BY t.id, chunks.chunk_index;
