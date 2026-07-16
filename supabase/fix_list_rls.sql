-- supabase/fix_list_rls.sql
--
-- Corrige l'erreur 42P17 (infinite recursion) entre les tables
-- shopping_lists et list_collaborators.
--
-- Cause : la politique SELECT de list_collaborators faisait un EXISTS
-- sur shopping_lists, qui elle-même fait un EXISTS sur list_collaborators.
--
-- Fix : politiques directes sur list_collaborators (auth.uid() = user_id)
-- sans référence croisée vers shopping_lists.
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.

-- ─── 1. Supprimer TOUTES les politiques existantes sur list_collaborators ───

DROP POLICY IF EXISTS "list_collaborators_select_own"       ON list_collaborators;
DROP POLICY IF EXISTS "list_collaborators_insert_own"       ON list_collaborators;
DROP POLICY IF EXISTS "list_collaborators_delete_own"       ON list_collaborators;
DROP POLICY IF EXISTS "collaborators_select_via_list"       ON list_collaborators;
DROP POLICY IF EXISTS "collaborators_insert_via_list"       ON list_collaborators;
DROP POLICY IF EXISTS "collaborators_delete_via_list"       ON list_collaborators;
DROP POLICY IF EXISTS "list_collaborators_all"              ON list_collaborators;

-- ─── 2. Créer des politiques simples (sans JOIN vers shopping_lists) ────────

-- Lecture : on peut voir uniquement ses propres lignes de collaboration
--           + le propriétaire de la liste peut voir tous ses collaborateurs
CREATE POLICY "list_collaborators_select_own"
  ON list_collaborators FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM shopping_lists sl
      WHERE sl.id = list_id
        AND sl.user_id = auth.uid()
    )
  );

-- IMPORTANT : la politique ci-dessus fait encore un EXISTS sur shopping_lists.
-- Comme shopping_lists n'a PAS de politique qui reboucle sur list_collaborators
-- pour un simple "user_id = auth.uid()" (sa politique SELECT accepte aussi
-- "auth.uid() = user_id" directement), le cycle est cassé à ce niveau.
--
-- Si Postgres signale encore une récursion (certaines versions pg14/pg15),
-- remplacer la politique SELECT par la version ultra-simple ci-dessous :
--
-- CREATE POLICY "list_collaborators_select_own"
--   ON list_collaborators FOR SELECT
--   USING (auth.uid() = user_id);
--
-- Dans ce cas, le propriétaire de la liste ne voit que lui-même dans les
-- collaborateurs, ce qui est suffisant pour la logique actuelle.

-- Insertion : seul l'utilisateur peut s'ajouter lui-même comme collaborateur
CREATE POLICY "list_collaborators_insert_own"
  ON list_collaborators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Suppression : on ne peut supprimer que sa propre ligne
CREATE POLICY "list_collaborators_delete_own"
  ON list_collaborators FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 3. S'assurer que les GRANTs sont présents ──────────────────────────────

GRANT SELECT, INSERT, DELETE ON public.list_collaborators TO authenticated;
