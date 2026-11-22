// Servidor de salas. Guarda las partidas completas (manos incluidas) y a cada jugador solo le entrega su vista.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  handleRequest,
  makeRoomCode,
  type AwardResult,
  type InviteEntry,
  type PlayerProfile,
  type RankingEntry,
  type RoomPatch,
  type RoomRecord,
  type RoomStore,
  type SecretRecord,
  type StoredRoom,
  type TournamentEntry,
} from '../_shared/games/roomService.ts';
import type { GameId } from '../_shared/games/shared.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const UNIQUE_VIOLATION = '23505';
const MAX_CODE_ATTEMPTS = 6;
const MAX_BODY_BYTES = 16_384;
const MAX_WAITING_ROOMS = 10;
const ROOM_COLUMNS = 'id, code, game, status, players, version, is_public, created_at';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** La fila de `rooms` tal como la guarda la base de datos. */
interface RoomRow {
  id: string;
  code: string;
  game: string;
  status: string;
  players: RoomRecord['players'];
  version: number;
  is_public: boolean | null;
  created_at: string | null;
}

function toRecord(row: RoomRow): RoomRecord {
  return {
    id: row.id,
    code: row.code,
    game: row.game as RoomRecord['game'],
    status: row.status as RoomRecord['status'],
    players: row.players,
    version: row.version,
    isPublic: row.is_public ?? false,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
  };
}

/** Fila de `player_profiles` tal como la guarda la base de datos. */
interface ProfileRow {
  player_id: string;
  name: string;
  avatar: string | null;
  level: number | null;
  key_hash: string;
  friend_code: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): PlayerProfile {
  return {
    playerId: row.player_id,
    name: row.name,
    ...(row.avatar ? { avatar: row.avatar } : {}),
    ...(row.level !== null ? { level: row.level } : {}),
    keyHash: row.key_hash,
    friendCode: row.friend_code,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

interface RankingRow {
  player_id: string;
  name: string;
  avatar: string | null;
  level: number | null;
  points: number;
  wins: number;
  losses: number;
  matches: number;
}

function toRankingEntry(row: RankingRow): RankingEntry {
  return {
    playerId: row.player_id,
    name: row.name,
    ...(row.avatar ? { avatar: row.avatar } : {}),
    ...(row.level !== null ? { level: row.level } : {}),
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    matches: row.matches,
  };
}

interface TournamentRow {
  player_id: string;
  name: string;
  avatar: string | null;
  level: number | null;
  points: number;
  wins: number;
  matches: number;
}

function toTournamentEntry(row: TournamentRow): TournamentEntry {
  return {
    playerId: row.player_id,
    name: row.name,
    ...(row.avatar ? { avatar: row.avatar } : {}),
    ...(row.level !== null ? { level: row.level } : {}),
    points: row.points,
    wins: row.wins,
    matches: row.matches,
  };
}

async function fetchProfile(column: 'player_id' | 'friend_code', value: string): Promise<PlayerProfile | null> {
  const { data, error } = await db.from('player_profiles').select('*').eq(column, value).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProfile(data as ProfileRow) : null;
}

async function fetchProfiles(ids: string[]): Promise<PlayerProfile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from('player_profiles').select('*').in('player_id', ids);
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(toProfile);
}

/** La clave de premio es "sala:versión" (ver `RoomStore.awardRanking`). */
function splitAwardKey(awardKey: string): { roomId: string; version: number } {
  const idx = awardKey.lastIndexOf(':');
  return { roomId: awardKey.slice(0, idx), version: Number(awardKey.slice(idx + 1)) };
}

function toAwardJson(results: AwardResult[]) {
  return results.map((r) => ({
    player_id: r.playerId,
    name: r.name,
    avatar: r.avatar ?? null,
    level: r.level ?? null,
    points: r.points,
    outcome: r.outcome,
  }));
}

async function load(column: 'id' | 'code', value: string): Promise<StoredRoom | null> {
  const { data: room, error } = await db.from('rooms').select(ROOM_COLUMNS).eq(column, value).maybeSingle();
  if (error) throw new Error(error.message);
  if (!room) return null;
  const { data: secret, error: secretError } = await db
    .from('room_secrets')
    .select('state, keys')
    .eq('room_id', room.id)
    .maybeSingle();
  if (secretError) throw new Error(secretError.message);
  return {
    room: toRecord(room as RoomRow),
    secret: { state: secret?.state ?? null, keys: secret?.keys ?? {} },
  };
}

const store: RoomStore = {
  findById: (id) => load('id', id),
  findByCode: (code) => load('code', code),

  async findWaiting(game) {
    const { data, error } = await db
      .from('rooms')
      .select(ROOM_COLUMNS)
      .eq('game', game)
      .eq('status', 'waiting')
      .eq('is_public', true)
      .order('created_at', { ascending: true })
      .limit(MAX_WAITING_ROOMS);
    if (error) throw new Error(error.message);
    const rooms: StoredRoom[] = [];
    for (const row of data ?? []) {
      const stored = await load('id', (row as RoomRow).id);
      if (stored) rooms.push(stored);
    }
    return rooms;
  },

  async create(room, secret: SecretRecord) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const { data, error } = await db
        .from('rooms')
        .insert({
          code: makeRoomCode(),
          game: room.game,
          status: room.status,
          players: room.players,
          is_public: room.isPublic,
          created_at: new Date(room.createdAt).toISOString(),
        })
        .select(ROOM_COLUMNS)
        .maybeSingle();
      if (error?.code === UNIQUE_VIOLATION) continue;
      if (error || !data) throw new Error(error?.message ?? 'No se pudo crear la sala.');
      const { error: secretError } = await db
        .from('room_secrets')
        .insert({ room_id: data.id, state: secret.state, keys: secret.keys });
      if (secretError) {
        await db.from('rooms').delete().eq('id', data.id);
        throw new Error(secretError.message);
      }
      return { room: toRecord(data as RoomRow), secret };
    }
    throw new Error('No se pudo generar un código de sala libre.');
  },

  async update(roomId: string, expectedVersion: number, patch: RoomPatch) {
    const { data, error } = await db.rpc('apply_room_update', {
      p_room_id: roomId,
      p_expected_version: expectedVersion,
      p_status: patch.status,
      p_players: patch.players,
      p_state: patch.state,
      p_keys: patch.keys,
      p_is_public: patch.isPublic,
    });
    if (error) throw new Error(error.message);
    return data === true;
  },

  async remove(roomId: string) {
    // room_secrets se borra en cascada por la clave foránea (ON DELETE CASCADE).
    const { error } = await db.from('rooms').delete().eq('id', roomId);
    if (error) throw new Error(error.message);
  },

  getProfile: (playerId) => fetchProfile('player_id', playerId),
  getProfileByFriendCode: (code) => fetchProfile('friend_code', code),

  async upsertProfile(profile: PlayerProfile) {
    const existing = await fetchProfile('player_id', profile.playerId);
    if (existing && existing.keyHash !== profile.keyHash) return 'keyConflict';
    const { error } = await db.from('player_profiles').upsert(
      {
        player_id: profile.playerId,
        name: profile.name,
        avatar: profile.avatar ?? null,
        level: profile.level ?? null,
        key_hash: profile.keyHash,
        // El código de amigo no cambia una vez creado.
        friend_code: existing?.friendCode ?? profile.friendCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id' },
    );
    if (error) {
      if (error.code === UNIQUE_VIOLATION && error.message.includes('friend_code')) return 'codeConflict';
      throw new Error(error.message);
    }
    return 'ok';
  },

  async awardRanking(awardKey, season, game, results) {
    const { roomId, version } = splitAwardKey(awardKey);
    const { data, error } = await db.rpc('apply_ranking_award', {
      p_room_id: roomId,
      p_match_version: version,
      p_season: season,
      p_game: game,
      p_results: toAwardJson(results),
    });
    if (error) throw new Error(error.message);
    return data === true;
  },

  async awardTournament(awardKey, tournamentId, results) {
    const { roomId, version } = splitAwardKey(awardKey);
    const { data, error } = await db.rpc('apply_tournament_award', {
      p_room_id: roomId,
      p_match_version: version,
      p_tournament_id: tournamentId,
      p_results: toAwardJson(results),
    });
    if (error) throw new Error(error.message);
    return data === true;
  },

  async getRanking(season, game, limit) {
    const { data, error } = await db
      .from('rankings')
      .select('player_id, name, avatar, level, points, wins, losses, matches')
      .eq('season', season)
      .eq('game', game)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('player_id', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data as RankingRow[]).map(toRankingEntry);
  },

  async getRankingEntry(season, game, playerId) {
    const { data, error } = await db
      .from('rankings')
      .select('player_id, name, avatar, level, points, wins, losses, matches')
      .eq('season', season)
      .eq('game', game)
      .eq('player_id', playerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const { data: rank, error: rankError } = await db.rpc('ranking_position', {
      p_season: season,
      p_game: game,
      p_player_id: playerId,
    });
    if (rankError) throw new Error(rankError.message);
    if (typeof rank !== 'number') return null;
    return { entry: toRankingEntry(data as RankingRow), rank };
  },

  async listFriendships(playerId) {
    const { data, error } = await db
      .from('friendships')
      .select('requester_id, addressee_id, status')
      .or(`requester_id.eq.${playerId},addressee_id.eq.${playerId}`);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { requester_id: string; addressee_id: string; status: string }[];
    const friendIds = new Set<string>();
    const inIds: string[] = [];
    const outIds: string[] = [];
    for (const row of rows) {
      if (row.status === 'accepted') {
        friendIds.add(row.requester_id === playerId ? row.addressee_id : row.requester_id);
      } else if (row.addressee_id === playerId) {
        inIds.push(row.requester_id);
      } else {
        outIds.push(row.addressee_id);
      }
    }
    const byId = new Map(
      (await fetchProfiles([...friendIds, ...inIds, ...outIds])).map((p) => [p.playerId, p]),
    );
    const pick = (ids: string[]) =>
      ids.flatMap((id) => {
        const profile = byId.get(id);
        return profile ? [profile] : [];
      });
    return { friends: pick([...friendIds]), pendingIn: pick(inIds), pendingOut: pick(outIds) };
  },

  async sendFriendRequest(requesterId, addresseeId) {
    const target = await fetchProfile('player_id', addresseeId);
    if (!target) return 'notFound';
    const { data, error } = await db
      .from('friendships')
      .select('requester_id, addressee_id, status')
      .or(
        `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`,
      );
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { requester_id: string; status: string }[]) {
      if (row.status === 'accepted') return 'alreadyFriends';
      if (row.requester_id === requesterId) return 'exists';
      // El otro ya la pidió: se acepta sola.
      const { error: acceptError } = await db
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester_id', addresseeId)
        .eq('addressee_id', requesterId)
        .eq('status', 'pending');
      if (acceptError) throw new Error(acceptError.message);
      return 'accepted';
    }
    const { error: insertError } = await db
      .from('friendships')
      .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' });
    if (insertError) throw new Error(insertError.message);
    return 'ok';
  },

  async respondFriendRequest(requesterId, addresseeId, accept) {
    if (accept) {
      const { data, error } = await db
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('requester_id', requesterId)
        .eq('addressee_id', addresseeId)
        .eq('status', 'pending')
        .select('requester_id');
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0 ? 'ok' : 'notFound';
    }
    const { data, error } = await db
      .from('friendships')
      .delete()
      .eq('requester_id', requesterId)
      .eq('addressee_id', addresseeId)
      .eq('status', 'pending')
      .select('requester_id');
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0 ? 'ok' : 'notFound';
  },

  async removeFriendship(playerId, friendId) {
    const { error } = await db
      .from('friendships')
      .delete()
      .or(
        `and(requester_id.eq.${playerId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${playerId})`,
      );
    if (error) throw new Error(error.message);
  },

  async searchPlayers(query, excludeId) {
    // Sin comodines ni comas: el texto va dentro de un filtro ilike y de un or().
    const clean = query.trim().replace(/[%_,\\]/g, '').toUpperCase();
    if (!clean) return [];
    const { data, error } = await db
      .from('player_profiles')
      .select('*')
      .neq('player_id', excludeId)
      .or(`friend_code.eq.${clean},name.ilike.${clean}%`)
      .limit(10);
    if (error) throw new Error(error.message);
    return (data as ProfileRow[]).map(toProfile);
  },

  async createInvite(fromId, toId, code, game) {
    const { error } = await db
      .from('room_invites')
      .insert({ from_id: fromId, to_id: toId, code, game, status: 'pending' });
    if (error) throw new Error(error.message);
  },

  async listInvites(toId): Promise<InviteEntry[]> {
    const { data, error } = await db
      .from('room_invites')
      .select('from_id, code, game, created_at')
      .eq('to_id', toId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { from_id: string; code: string; game: string; created_at: string }[];
    const byId = new Map((await fetchProfiles(rows.map((r) => r.from_id))).map((p) => [p.playerId, p]));
    return rows.flatMap((row) => {
      const from = byId.get(row.from_id);
      return from
        ? [
            {
              from: row.from_id,
              fromName: from.name,
              code: row.code,
              game: row.game as GameId,
              createdAt: new Date(row.created_at).getTime(),
            },
          ]
        : [];
    });
  },

  async acceptInvite(code, toId) {
    const { error } = await db
      .from('room_invites')
      .update({ status: 'accepted' })
      .eq('code', code)
      .eq('to_id', toId)
      .eq('status', 'pending');
    if (error) throw new Error(error.message);
  },

  async listActivePlayers() {
    const { data, error } = await db.from('rooms').select('code, players').in('status', ['waiting', 'playing']);
    if (error) throw new Error(error.message);
    const active = new Map<string, string>();
    for (const row of (data ?? []) as { code: string; players: { id: string }[] }[]) {
      for (const player of row.players ?? []) active.set(player.id, row.code);
    }
    return active;
  },

  async ensureTournament(tournament) {
    const now = Date.now();
    const status = now < tournament.startsAt ? 'upcoming' : now < tournament.endsAt ? 'active' : 'finished';
    const { error } = await db.from('tournaments').upsert(
      {
        id: tournament.id,
        game: tournament.game,
        starts_at: new Date(tournament.startsAt).toISOString(),
        ends_at: new Date(tournament.endsAt).toISOString(),
        status,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  },

  async getTournamentEntries(tournamentId, limit) {
    const { data, error } = await db
      .from('tournament_entries')
      .select('player_id, name, avatar, level, points, wins, matches')
      .eq('tournament_id', tournamentId)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .order('player_id', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data as TournamentRow[]).map(toTournamentEntry);
  },

  async getTournamentEntry(tournamentId, playerId) {
    const { data, error } = await db
      .from('tournament_entries')
      .select('player_id, name, avatar, level, points, wins, matches')
      .eq('tournament_id', tournamentId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const { data: rank, error: rankError } = await db.rpc('tournament_position', {
      p_tournament_id: tournamentId,
      p_player_id: playerId,
    });
    if (rankError) throw new Error(rankError.message);
    if (typeof rank !== 'number') return null;
    return { entry: toTournamentEntry(data as TournamentRow), rank };
  },

  async claimPrize(scope, key, playerId, place, coins) {
    const table = scope === 'season' ? 'season_prize_claims' : 'tournament_prize_claims';
    const row =
      scope === 'season'
        ? { season: key, player_id: playerId, place, coins }
        : { tournament_id: key, player_id: playerId, place, coins };
    const { data, error } = await db
      .from(table)
      .upsert(row, { onConflict: scope === 'season' ? 'season,player_id' : 'tournament_id,player_id', ignoreDuplicates: true })
      .select('player_id');
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido.' }, 405);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'Solicitud demasiado grande.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'Solicitud no válida.' }, 400);
  }
  // Los errores de juego van con código 200 y { ok: false }; así el navegador siempre puede leer el mensaje.
  return json(await handleRequest(store, body));
});
