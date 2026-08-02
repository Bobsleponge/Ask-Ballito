-- P8: HNSW vector index for city-scale corpora (optional upgrade from IVFFlat).

-- Drop IVFFlat if present; create HNSW for better small/medium recall.
drop index if exists public.businesses_embedding_idx;

create index if not exists businesses_embedding_hnsw_idx
  on public.businesses
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Places embeddings (when populated)
create index if not exists places_embedding_hnsw_idx
  on public.places
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
