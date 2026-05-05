-- =============================================================================
-- Reparo de livros com pages_v2 apontando para imports/<sessionId>/ orfao.
-- =============================================================================
-- Causa: finalizeImportSession + remapImportedStorageInPagesV2 nao atuou
-- corretamente quando o mesmo importSessionId foi usado para >1 livro
-- (ficheiros ja tinham sido movidos no 1.o uso).
--
-- Sintoma: GET /media/pages/<user>/imports/<sid>/<file> retorna 404 porque
-- o ficheiro foi movido para books/<bookId>/.
--
-- Estrategia: substituir a string '/imports/8ghlROvC_G-n6F5U/' por
-- '/books/12/' em pages_v2 e pages (livros 12 e 13). Os ficheiros fisicos
-- estao em books/12/. O livro 13 passa a partilhar midias com o 12 (situacao
-- de dev; pode-se apagar 13 ou re-importar depois).
-- =============================================================================

-- Mostra o estado antes (para auditoria nos logs)
DO $$
DECLARE
  cnt12 int;
  cnt13 int;
BEGIN
  SELECT (length(pages_v2::text) - length(replace(pages_v2::text, '/imports/8ghlROvC_G-n6F5U/', ''))) / length('/imports/8ghlROvC_G-n6F5U/')
    INTO cnt12 FROM books WHERE id = 12;
  SELECT (length(pages_v2::text) - length(replace(pages_v2::text, '/imports/8ghlROvC_G-n6F5U/', ''))) / length('/imports/8ghlROvC_G-n6F5U/')
    INTO cnt13 FROM books WHERE id = 13;
  RAISE NOTICE 'antes: book 12 tem % ocorrencias, book 13 tem %', cnt12, cnt13;
END $$;

UPDATE books
SET
  pages_v2 = REPLACE(
               REPLACE(pages_v2::text, '/imports/8ghlROvC_G-n6F5U/', '/books/12/'),
               ',"importSessionId":"8ghlROvC_G-n6F5U"',
               ''
             )::jsonb,
  pages = REPLACE(
            REPLACE(pages::text, '/imports/8ghlROvC_G-n6F5U/', '/books/12/'),
            ',"importSessionId":"8ghlROvC_G-n6F5U"',
            ''
          )::jsonb
WHERE id IN (12, 13);

-- Mostra o estado depois
DO $$
DECLARE
  cnt12 int;
  cnt13 int;
BEGIN
  SELECT (length(pages_v2::text) - length(replace(pages_v2::text, '/imports/8ghlROvC_G-n6F5U/', ''))) / length('/imports/8ghlROvC_G-n6F5U/')
    INTO cnt12 FROM books WHERE id = 12;
  SELECT (length(pages_v2::text) - length(replace(pages_v2::text, '/imports/8ghlROvC_G-n6F5U/', ''))) / length('/imports/8ghlROvC_G-n6F5U/')
    INTO cnt13 FROM books WHERE id = 13;
  RAISE NOTICE 'depois: book 12 tem % ocorrencias, book 13 tem %', cnt12, cnt13;
END $$;
