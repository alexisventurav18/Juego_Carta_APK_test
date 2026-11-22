import type { GameState } from '../src/games';
import {
  makeRoomCode,
  type AwardResult,
  type InviteEntry,
  type PlayerProfile,
  type RankingEntry,
  type RoomPatch,
  type RoomRecord,
  type RoomStore,
  type StoredRoom,
  type TournamentEntry,
} from '../src/games/roomService';
import type { GameId } from '../src/games/shared';
import type { ProgressSnapshot } from '../src/games/progress';

/**
 * Almacén en memoria con la misma interfaz que el de Supabase: salas,
 * perfiles, ranking, amistades, invitaciones, torneos y premios. Lo usan
 * los tests de `roomService`, `matchmaking` y `rankingServer`.
 */
export class MemoryStore implements RoomStore {
  rooms = new Map<string, StoredRoom>();
  failNextUpdate = false;
  private seq = 0;
  private profiles = new Map<string, PlayerProfile>();
  private friendships: { requesterId: string; addresseeId: string; status: 'pending' | 'accepted' }[] = [];
  private invites: { from: string; to: string; code: string; game: GameId; status: 'pending' | 'accepted'; createdAt: number }[] =
    [];
  private rankings = new Map<string, RankingEntry>();
  private rankingAwards = new Set<string>();
  private tournaments = new Map<string, { id: string; game: GameId; startsAt: number; endsAt: number }>();
  private tournamentEntries = new Map<string, TournamentEntry>();
  private tournamentAwards = new Set<string>();
  private claims = new Set<string>();
  private progress = new Map<string, { economy: ProgressSnapshot; updatedAt: number }>();

  async findById(id: string) {
    return this.rooms.get(id) ?? null;
  }
  async findByCode(code: string) {
    return [...this.rooms.values()].find((r) => r.room.code === code) ?? null;
  }
  async findWaiting(game: GameId) {
    return [...this.rooms.values()]
      .filter((r) => r.room.game === game && r.room.isPublic && r.room.status === 'waiting')
      .sort((a, b) => a.room.createdAt - b.room.createdAt);
  }
  async create(room: Pick<RoomRecord, 'game' | 'status' | 'players' | 'isPublic' | 'createdAt'>, secret: StoredRoom['secret']) {
    const id = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`;
    const stored: StoredRoom = { room: { ...room, id, code: makeRoomCode(), version: 0 }, secret };
    this.rooms.set(id, stored);
    return stored;
  }
  async update(roomId: string, expectedVersion: number, patch: RoomPatch) {
    const stored = this.rooms.get(roomId);
    if (this.failNextUpdate) {
      this.failNextUpdate = false;
      return false;
    }
    if (!stored || stored.room.version !== expectedVersion) return false;
    stored.room = {
      ...stored.room,
      status: patch.status,
      players: patch.players,
      version: expectedVersion + 1,
      isPublic: patch.isPublic,
    };
    stored.secret = { state: patch.state, keys: patch.keys };
    return true;
  }
  async remove(roomId: string) {
    this.rooms.delete(roomId);
  }
  setCreatedAt(roomId: string, createdAt: number) {
    this.rooms.get(roomId)!.room.createdAt = createdAt;
  }
  fullState(roomId: string): GameState {
    const state = this.rooms.get(roomId)?.secret.state;
    if (!state) throw new Error('sin estado');
    return state;
  }

  async getProfile(playerId: string) {
    return this.profiles.get(playerId) ?? null;
  }
  async getProfileByFriendCode(code: string) {
    return [...this.profiles.values()].find((p) => p.friendCode === code) ?? null;
  }
  async upsertProfile(profile: PlayerProfile) {
    const existing = this.profiles.get(profile.playerId);
    if (existing && existing.keyHash !== profile.keyHash) return 'keyConflict';
    if (!existing && [...this.profiles.values()].some((p) => p.friendCode === profile.friendCode)) {
      return 'codeConflict';
    }
    this.profiles.set(profile.playerId, { ...profile, friendCode: existing?.friendCode ?? profile.friendCode });
    return 'ok';
  }

  async awardRanking(awardKey: string, season: string, game: string, results: AwardResult[]) {
    if (this.rankingAwards.has(awardKey)) return false;
    this.rankingAwards.add(awardKey);
    for (const r of results) {
      // Cada partida suma en su juego y en el total ('all').
      for (const g of [game, 'all']) {
        if (g === 'all' && game === 'all') continue;
        const key = `${season}:${g}:${r.playerId}`;
        const row = this.rankings.get(key) ?? {
          playerId: r.playerId,
          name: r.name,
          avatar: r.avatar,
          level: r.level,
          points: 0,
          wins: 0,
          losses: 0,
          matches: 0,
        };
        row.name = r.name;
        row.avatar = r.avatar;
        row.level = r.level;
        row.points += r.points;
        if (r.outcome === 'win') row.wins += 1;
        if (r.outcome === 'loss') row.losses += 1;
        row.matches += 1;
        this.rankings.set(key, row);
      }
    }
    return true;
  }

  async awardTournament(awardKey: string, tournamentId: string, results: AwardResult[]) {
    if (this.tournamentAwards.has(awardKey)) return false;
    this.tournamentAwards.add(awardKey);
    for (const r of results) {
      const key = `${tournamentId}:${r.playerId}`;
      const row = this.tournamentEntries.get(key) ?? {
        playerId: r.playerId,
        name: r.name,
        avatar: r.avatar,
        level: r.level,
        points: 0,
        wins: 0,
        matches: 0,
      };
      row.name = r.name;
      row.avatar = r.avatar;
      row.level = r.level;
      row.points += r.points;
      if (r.outcome === 'win') row.wins += 1;
      row.matches += 1;
      this.tournamentEntries.set(key, row);
    }
    return true;
  }

  async getRanking(season: string, game: string, limit: number) {
    return sortRanking(
      [...this.rankings.entries()].filter(([key]) => key.startsWith(`${season}:${game}:`)).map(([, entry]) => entry),
    ).slice(0, limit);
  }

  async getRankingEntry(season: string, game: string, playerId: string) {
    const sorted = sortRanking(
      [...this.rankings.entries()].filter(([key]) => key.startsWith(`${season}:${game}:`)).map(([, entry]) => entry),
    );
    const index = sorted.findIndex((entry) => entry.playerId === playerId);
    if (index === -1) return null;
    return { entry: sorted[index], rank: index + 1 };
  }

  async listFriendships(playerId: string) {
    const friends: PlayerProfile[] = [];
    const pendingIn: PlayerProfile[] = [];
    const pendingOut: PlayerProfile[] = [];
    for (const friendship of this.friendships) {
      if (friendship.status === 'accepted') {
        const other =
          friendship.requesterId === playerId
            ? friendship.addresseeId
            : friendship.addresseeId === playerId
              ? friendship.requesterId
              : null;
        if (other) {
          const profile = this.profiles.get(other);
          if (profile) friends.push(profile);
        }
      } else if (friendship.addresseeId === playerId) {
        const profile = this.profiles.get(friendship.requesterId);
        if (profile) pendingIn.push(profile);
      } else if (friendship.requesterId === playerId) {
        const profile = this.profiles.get(friendship.addresseeId);
        if (profile) pendingOut.push(profile);
      }
    }
    return { friends, pendingIn, pendingOut };
  }

  async sendFriendRequest(requesterId: string, addresseeId: string) {
    if (!this.profiles.has(addresseeId)) return 'notFound';
    const existing = this.friendships.find(
      (f) =>
        (f.requesterId === requesterId && f.addresseeId === addresseeId) ||
        (f.requesterId === addresseeId && f.addresseeId === requesterId),
    );
    if (existing) {
      if (existing.status === 'accepted') return 'alreadyFriends';
      if (existing.requesterId === requesterId) return 'exists';
      existing.status = 'accepted';
      return 'accepted';
    }
    this.friendships.push({ requesterId, addresseeId, status: 'pending' });
    return 'ok';
  }

  async respondFriendRequest(requesterId: string, addresseeId: string, accept: boolean) {
    const index = this.friendships.findIndex(
      (f) => f.requesterId === requesterId && f.addresseeId === addresseeId && f.status === 'pending',
    );
    if (index === -1) return 'notFound';
    if (accept) this.friendships[index].status = 'accepted';
    else this.friendships.splice(index, 1);
    return 'ok';
  }

  async removeFriendship(playerId: string, friendId: string) {
    this.friendships = this.friendships.filter(
      (f) =>
        !(
          (f.requesterId === playerId && f.addresseeId === friendId) ||
          (f.requesterId === friendId && f.addresseeId === playerId)
        ),
    );
  }

  async searchPlayers(query: string, excludeId: string) {
    const clean = query.trim().toUpperCase();
    if (!clean) return [];
    return [...this.profiles.values()]
      .filter(
        (p) => p.playerId !== excludeId && (p.friendCode.toUpperCase() === clean || p.name.toUpperCase().startsWith(clean)),
      )
      .slice(0, 10);
  }

  async createInvite(fromId: string, toId: string, code: string, game: GameId) {
    this.invites.push({ from: fromId, to: toId, code, game, status: 'pending', createdAt: Date.now() });
  }

  async listInvites(toId: string): Promise<InviteEntry[]> {
    return this.invites
      .filter((invite) => invite.to === toId && invite.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .flatMap((invite) => {
        const from = this.profiles.get(invite.from);
        return from
          ? [{ from: invite.from, fromName: from.name, code: invite.code, game: invite.game, createdAt: invite.createdAt }]
          : [];
      });
  }

  async acceptInvite(code: string, toId: string) {
    for (const invite of this.invites) {
      if (invite.code === code && invite.to === toId && invite.status === 'pending') invite.status = 'accepted';
    }
  }

  async listActivePlayers() {
    const active = new Map<string, string>();
    for (const stored of this.rooms.values()) {
      if (stored.room.status === 'waiting' || stored.room.status === 'playing') {
        for (const player of stored.room.players) active.set(player.id, stored.room.code);
      }
    }
    return active;
  }

  async ensureTournament(tournament: { id: string; game: GameId; startsAt: number; endsAt: number }) {
    if (!this.tournaments.has(tournament.id)) this.tournaments.set(tournament.id, tournament);
  }

  async getTournamentEntries(tournamentId: string, limit: number) {
    return sortTournament(
      [...this.tournamentEntries.entries()]
        .filter(([key]) => key.startsWith(`${tournamentId}:`))
        .map(([, entry]) => entry),
    ).slice(0, limit);
  }

  async getTournamentEntry(tournamentId: string, playerId: string) {
    const sorted = sortTournament(
      [...this.tournamentEntries.entries()]
        .filter(([key]) => key.startsWith(`${tournamentId}:`))
        .map(([, entry]) => entry),
    );
    const index = sorted.findIndex((entry) => entry.playerId === playerId);
    if (index === -1) return null;
    return { entry: sorted[index], rank: index + 1 };
  }

  async claimPrize(scope: 'season' | 'tournament', key: string, playerId: string, _place: number, _coins: number) {
    const claimKey = `${scope}:${key}:${playerId}`;
    if (this.claims.has(claimKey)) return false;
    this.claims.add(claimKey);
    return true;
  }

  // Respaldo del progreso en la nube (A+B): foto en memoria, por jugador.
  async getProgress(playerId: string) {
    return this.progress.get(playerId) ?? null;
  }
  async saveProgress(playerId: string, economy: ProgressSnapshot, updatedAt: number) {
    this.progress.set(playerId, { economy, updatedAt });
  }
}

function byStanding(a: { points: number; wins: number; playerId: string }, b: { points: number; wins: number; playerId: string }) {
  return b.points - a.points || b.wins - a.wins || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0);
}

function sortRanking(entries: RankingEntry[]): RankingEntry[] {
  return [...entries].sort(byStanding);
}

function sortTournament(entries: TournamentEntry[]): TournamentEntry[] {
  return [...entries].sort(byStanding);
}
