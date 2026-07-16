import { apiClient } from './api/client';

const supabase = apiClient.getSupabase();

// ─── Types publics ────────────────────────────────────────────────────────────

export type AuthorRole = 'user' | 'pro' | 'admin';

export interface PromoComment {
  id:              string;
  promoId:         string;
  userId:          string;
  parentId:        string | null;
  content:         string;
  isPinned:        boolean;
  createdAt:       string;
  authorName:      string;
  authorAvatarUrl: string | null;
  authorRole:      AuthorRole;
}

/** PromoComment enrichi d'une profondeur calculée pour le rendu aplati des threads. */
export interface FlatComment extends PromoComment {
  depth: number;
}

// ─── Mappage ligne DB → PromoComment ─────────────────────────────────────────

interface DbRow {
  id:         string;
  promo_id:   string;
  user_id:    string;
  parent_id:  string | null;
  content:    string;
  is_pinned:  boolean;
  created_at: string;
  users_profiles?: {
    display_name: string;
    avatar_url:   string | null;
    role:         string | null;
  } | null;
}

function rowToComment(row: DbRow): PromoComment {
  const rawRole = row.users_profiles?.role ?? 'user';
  const authorRole: AuthorRole =
    rawRole === 'pro' || rawRole === 'admin' ? rawRole : 'user';

  return {
    id:              row.id,
    promoId:         row.promo_id,
    userId:          row.user_id,
    parentId:        row.parent_id ?? null,
    content:         row.content,
    isPinned:        row.is_pinned,
    createdAt:       row.created_at,
    authorName:      row.users_profiles?.display_name ?? 'Anonyme',
    authorAvatarUrl: row.users_profiles?.avatar_url    ?? null,
    authorRole,
  };
}

// ─── Aplatissement du thread en liste avec profondeurs ───────────────────────

/**
 * Transforme la liste plate retournée par Supabase en une liste ordonnée pour
 * le rendu UI. L'algorithme DFS garantit que les réponses apparaissent juste
 * après leur parent, avec leur profondeur calculée.
 *
 * Les commentaires épinglés (is_pinned = true) sont garantis en tête de liste
 * par le tri SQL (is_pinned DESC), puis les threads partent à partir d'eux.
 */
function flattenToDepthList(comments: PromoComment[]): FlatComment[] {
  // Map parentId → enfants (dans l'ordre chronologique issu de la DB)
  const byParent = new Map<string | null, PromoComment[]>();

  for (const c of comments) {
    const key = c.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }

  const result: FlatComment[] = [];

  function traverse(parentId: string | null, depth: number): void {
    const children = byParent.get(parentId);
    if (!children) return;
    for (const child of children) {
      result.push({ ...child, depth });
      traverse(child.id, depth + 1);
    }
  }

  // Les commentaires racine arrivent de la DB triés : épinglés d'abord, puis chronologique
  traverse(null, 0);

  return result;
}

// ─── Requête SELECT partagée ──────────────────────────────────────────────────

const COMMENT_SELECT = `
  id,
  promo_id,
  user_id,
  parent_id,
  content,
  is_pinned,
  created_at,
  users_profiles(display_name, avatar_url, role)
` as const;

// ─── Fonctions du service ─────────────────────────────────────────────────────

/**
 * Charge tous les commentaires d'une promo sous forme de thread aplati.
 * Triés par : épinglés d'abord, puis chronologique ascendant.
 */
export async function getCommentsForPromo(promoId: string): Promise<FlatComment[]> {
  const { data, error } = await supabase
    .from('promo_comments')
    .select(COMMENT_SELECT)
    .eq('promo_id', promoId)
    .order('is_pinned', { ascending: false })
    .order('created_at',  { ascending: true  });

  if (error || !data) return [];

  const comments = (data as unknown as DbRow[]).map(rowToComment);
  return flattenToDepthList(comments);
}

/**
 * Insère un commentaire (réponse directe ou thread).
 * Retourne le commentaire créé enrichi des informations de l'auteur.
 */
export async function postComment(
  promoId:  string,
  content:  string,
  parentId?: string,
): Promise<{ success: boolean; comment?: PromoComment }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const payload: Record<string, unknown> = {
    promo_id:  promoId,
    user_id:   user.id,
    content:   content.trim(),
  };
  if (parentId) payload.parent_id = parentId;

  const { data, error } = await supabase
    .from('promo_comments')
    .insert(payload)
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) return { success: false };

  return { success: true, comment: rowToComment(data as unknown as DbRow) };
}

/**
 * Épingle ou désépingle un commentaire via la RPC SECURITY DEFINER.
 * Réservé aux admins et aux commerçants propriétaires du magasin de la promo.
 */
export async function togglePinComment(
  commentId: string,
  pin:       boolean,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('pin_promo_comment', {
    p_comment_id: commentId,
    p_pin:        pin,
  });

  if (error) return false;
  return data === true;
}
