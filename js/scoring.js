/**
 * scoring.js — Napovednik 2026
 * All scoring logic: match points, phase multipliers, bonus picks,
 * trivia weekly scores, leaderboard helpers.
 *
 * Dependencies: utils.js must be loaded first.
 *
 * This file contains pure calculation functions (no DB writes).
 * DB writes happen in the pages that call these functions.
 * Exception: NP.scoring.recalcUser() and NP.scoring.recalcAll()
 * which are admin-only utilities used from selektor.html.
 */

NP.scoring = {

  /* ══════════════════════════════════════════════════════════
     MATCH SCORING
     ══════════════════════════════════════════════════════════ */

  /**
   * Calculates points for a single prediction against the actual result.
   *
   * Rules:
   *   - 3 pts: exact score (e.g. pred 2-1, result 2-1)
   *   - 1 pt:  correct outcome (H/D/A) but wrong score
   *   - 0 pts: wrong outcome
   *
   * AET: uses home_score_120/away_score_120 if available.
   * Penalties: never affect the score — a 1-1 AET result stays 1-1
   *   regardless of the penalty shootout.
   * Multiplier is applied separately via applyMultiplier().
   *
   * @param {{ pred_home: number, pred_away: number }} pred
   * @param {{ home_score_90, away_score_90, home_score_120, away_score_120 }} match
   * @returns {number|null}  0 | 1 | 3, or null if match not finished
   */
  calcBasePoints(pred, match) {
    // Guard against null/undefined pred values
    if (!pred || pred.pred_home == null || pred.pred_away == null) return null;
    // Determine final score — AET counts, penalties do not
    const fh = match.home_score_120 ?? match.home_score_90;
    const fa = match.away_score_120 ?? match.away_score_90;
    if (fh === null || fh === undefined || fa === null || fa === undefined) return null;

    const ph = Number(pred.pred_home);
    const pa = Number(pred.pred_away);

    // Exact score
    if (ph === fh && pa === fa) return 3;

    // Correct outcome
    if (this._outcome(ph, pa) === this._outcome(fh, fa)) return 1;

    return 0;
  },

  /**
   * Applies the phase multiplier.
   * Base points of 0 stay 0 regardless of multiplier.
   *
   * @param {number} basePoints  0 | 1 | 3
   * @param {number} multiplier  1 | 2 | 3
   * @returns {number}
   */
  applyMultiplier(basePoints, multiplier) {
    return basePoints * (multiplier ?? 1);
  },

  /**
   * Full points for a prediction: base × multiplier.
   * Convenience wrapper around calcBasePoints + applyMultiplier.
   *
   * @returns {number|null}  null if match not finished
   */
  calcPoints(pred, match, multiplier) {
    const base = this.calcBasePoints(pred, match);
    if (base === null) return null;
    return this.applyMultiplier(base, multiplier);
  },

  /**
   * Returns 'H' | 'D' | 'A' for a score.
   * @private
   */
  _outcome(home, away) {
    if (home > away) return 'H';
    if (home < away) return 'A';
    return 'D';
  },

  /**
   * Returns a human-readable result label for display.
   * e.g. { label: '✓ 2–1 točno', type: 'exact' }
   *      { label: '✓ Pravilni izid', type: 'correct' }
   *      { label: '✗ Napačno', type: 'wrong' }
   *      { label: '—', type: 'pending' }
   *
   * @param {{ pred_home, pred_away }} pred
   * @param {object} match
   * @param {number} multiplier
   * @returns {{ label: string, type: string, points: number|null }}
   */
  getResultLabel(pred, match, multiplier = 1) {
    const base = this.calcBasePoints(pred, match);
    if (base === null) return { label: '—', type: 'pending', points: null };
    const pts = this.applyMultiplier(base, multiplier);
    if (base === 3) return { label: `✓ Natančno · +${pts}`, type: 'exact',   points: pts };
    if (base === 1) return { label: `✓ Pravilno · +${pts}`,  type: 'correct', points: pts };
    return             { label: '✗ Napačno',               type: 'wrong',   points: 0 };
  },

  /* ══════════════════════════════════════════════════════════
     BONUS PICK SCORING
     ══════════════════════════════════════════════════════════ */

  /**
   * Tournament winner bonus: +10 pts if user picked the correct champion.
   * Only awarded once the tournament is over (final match finished).
   *
   * @param {number} userPickTeamId   - user's picked team_id
   * @param {number} actualWinnerTeamId - actual champion team_id
   * @returns {number}  10 | 0
   */
  calcWinnerBonus(userPickTeamId, actualWinnerTeamId) {
    if (!actualWinnerTeamId) return 0;
    return userPickTeamId === actualWinnerTeamId ? 10 : 0;
  },

  /**
   * Top scorer bonus: +8 pts for exact pick, +3 pts if the picked player
   * ties for the golden boot (up to 5-way tie allowed per spec).
   *
   * @param {number}   userPickPlayerId   - user's picked player_id
   * @param {number[]} topScorerPlayerIds - array of tied top scorers (1–5 players)
   * @param {boolean}  isExactWinner      - true if only 1 top scorer and it's the pick
   * @returns {number}  8 | 3 | 0
   */
  calcTopScorerBonus(userPickPlayerId, topScorerPlayerIds, isExactWinner = false) {
    if (!topScorerPlayerIds?.length) return 0;
    const inTopScorers = topScorerPlayerIds.includes(userPickPlayerId);
    if (!inTopScorers) return 0;
    // Exact winner: only 1 top scorer and it matches
    if (isExactWinner && topScorerPlayerIds.length === 1) return 8;
    // In the tie group (2–5 way tie): +3
    return 3;
  },

  /**
   * Calculates all bonus points for a user.
   * Returns a breakdown object.
   *
   * @param {object} userBonusPick  - row from bonus_picks table
   * @param {object} tournamentResult - { winner_team_id, top_scorer_player_ids }
   * @returns {{ winner: number, top_scorer: number, total: number }}
   */
  calcBonusTotal(userBonusPick, tournamentResult) {
    if (!userBonusPick || !tournamentResult) {
      return { winner: 0, top_scorer: 0, total: 0 };
    }
    const winner = this.calcWinnerBonus(
      userBonusPick.winner_team_id,
      tournamentResult.winner_team_id,
    );
    const topScorerIds = tournamentResult.top_scorer_player_ids ?? [];
    const top_scorer = this.calcTopScorerBonus(
      userBonusPick.top_scorer_player_id,
      topScorerIds,
      topScorerIds.length === 1,
    );
    return { winner, top_scorer, total: winner + top_scorer };
  },

  /* ══════════════════════════════════════════════════════════
     TRIVIA SCORING
     ══════════════════════════════════════════════════════════ */

  /**
   * Points per correct trivia answer: always 1, regardless of phase.
   * Trivia points are not multiplied.
   */
  TRIVIA_POINTS_PER_CORRECT: 1,

  /**
   * Calculates total trivia points for a user in a given week.
   *
   * @param {object[]} answers  - trivia_answers rows: [{ is_correct, ... }]
   * @returns {{ correct: number, total: number, points: number }}
   */
  calcTriviaWeek(answers) {
    const correct = answers.filter(a => a.is_correct).length;
    return {
      correct,
      total:  answers.length,
      points: correct * this.TRIVIA_POINTS_PER_CORRECT,
    };
  },

  /**
   * Determines the weekly Trivialist — the user with the most correct answers
   * in the week. Tiebreak: earliest submission time (first correct answer wins).
   *
   * @param {object[]} weeklyScores - [{ user_id, correct, earliest_answer_at }]
   * @returns {object|null}  The winning user's score row, or null
   */
  findWeeklyTrivialist(weeklyScores) {
    if (!weeklyScores?.length) return null;
    return weeklyScores.reduce((best, cur) => {
      if (!best) return cur;
      if (cur.correct > best.correct) return cur;
      if (cur.correct === best.correct) {
        // Tiebreak: earlier first-answer wins
        return new Date(cur.earliest_answer_at) < new Date(best.earliest_answer_at)
          ? cur : best;
      }
      return best;
    }, null);
  },

  /**
   * Checks eligibility: a user needs ≥1 match prediction OR ≥1 trivia answer
   * to appear in the leaderboard.
   *
   * @param {{ prediction_count: number, trivia_answer_count: number }} stats
   * @returns {boolean}
   */
  isEligible(stats) {
    return (stats.prediction_count ?? 0) >= 1 ||
           (stats.trivia_answer_count ?? 0) >= 1;
  },

  /* ══════════════════════════════════════════════════════════
     LEADERBOARD HELPERS
     ══════════════════════════════════════════════════════════ */

  /**
   * Calculates the total score for a user from component parts.
   *
   * @param {{ match_points, trivia_points, bonus_points }} breakdown
   * @returns {number}
   */
  calcTotal(breakdown) {
    return (breakdown.match_points  ?? 0) +
           (breakdown.trivia_points ?? 0) +
           (breakdown.bonus_points  ?? 0);
  },

  /**
   * Assigns ranks to an array of leaderboard entries (already sorted desc by total).
   * Handles ties — two users on the same points share the same rank.
   * The next rank after a tie of 2 at #3 is #5 (standard competition ranking).
   *
   * @param {{ total_points: number, user_id: string }[]} sorted - sorted desc
   * @returns {object[]} same array with .rank property added
   */
  assignRanks(sorted) {
    let rank = 1;
    return sorted.map((entry, i) => {
      if (i > 0 && sorted[i].total_points < sorted[i - 1].total_points) {
        rank = i + 1;
      }
      return { ...entry, rank };
    });
  },

  /**
   * Calculates rank delta (change since the last snapshot).
   * Returns positive = moved up, negative = moved down, 0 = same.
   *
   * @param {number} currentRank
   * @param {number} previousRank
   * @returns {number}
   */
  calcDelta(currentRank, previousRank) {
    if (!previousRank) return 0;
    return previousRank - currentRank; // positive = improved
  },

  /* ══════════════════════════════════════════════════════════
     ADMIN RECALCULATION UTILITIES
     These hit Supabase directly — only call from selektor.html.
     ══════════════════════════════════════════════════════════ */

  /**
   * Recalculates and stores points for all predictions of a single match.
   * Call after an admin enters the match result.
   *
   * Flow:
   *   1. Fetch the match (scores + phase multiplier via tournament_phases)
   *   2. Fetch all predictions for that match
   *   3. Calculate points for each
   *   4. Update predictions.points in bulk
   *
   * @param {number} matchId
   * @returns {{ updated: number, errors: string[] }}
   */
  async recalcMatch(matchId) {
    const errors = [];

    // 1. Fetch match
    const { data: match, error: mErr } = await NP.db
      .from('matches')
      .select('id, phase, kickoff_at, home_score_90, away_score_90, home_score_120, away_score_120')
      .eq('id', matchId)
      .single();

    if (mErr) return { updated: 0, errors: [mErr.message] };

    // 2. Fetch multiplier from tournament_phases separately
    const now = match.kickoff_at ?? new Date().toISOString();
    const { data: phase } = await NP.db
      .from('tournament_phases')
      .select('multiplier')
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const multiplier = phase?.multiplier ?? 1;

    // Check match is finished
    if (match.home_score_90 === null) {
      return { updated: 0, errors: ['Match not finished yet'] };
    }

    // 2. Fetch all predictions for this match
    const { data: preds, error: pErr } = await NP.db
      .from('predictions')
      .select('id, pred_home, pred_away')
      .eq('match_id', matchId);

    if (pErr) return { updated: 0, errors: [pErr.message] };
    if (!preds?.length) return { updated: 0, errors: [] };

    // 3. Calculate and update each prediction individually
    let updated = 0;
    for (const pred of preds) {
      const pts = this.calcPoints(pred, match, multiplier) ?? 0;
      const { error: uErr } = await NP.db
        .from('predictions')
        .update({ points_awarded: pts })
        .eq('id', pred.id);
      if (uErr) errors.push(uErr.message);
      else updated++;
    }

    return { updated, errors };
  },

  /**
   * Recalculates the full leaderboard totals for a single user.
   * Sums all predictions.points + trivia points + bonus points
   * and writes to leaderboard_snapshots (or a summary table).
   *
   * @param {string} userId  - uuid
   * @returns {{ total_points: number, correct_scores: number, correct_outcomes: number }}
   */
  async recalcUser(userId) {
    // Sum points_awarded directly — no join needed
    const { data: preds } = await NP.db
      .from('predictions')
      .select('points_awarded')
      .eq('user_id', userId)
      .not('points_awarded', 'is', null)
      .gt('points_awarded', 0);

    let match_points = 0, correct_scores = 0, correct_outcomes = 0;
    (preds ?? []).forEach(p => {
      const pts = p.points_awarded ?? 0;
      match_points += pts;
      if (pts >= 3) { correct_scores++; correct_outcomes++; }
      else if (pts >= 1) correct_outcomes++;
    });

    return { total_points: match_points, match_points, trivia_points: 0, correct_scores, correct_outcomes };
  },

  /**
   * Saves a leaderboard snapshot for all users.
   * Call once per day (or after each match result entry) from selektor.html.
   * Snapshots are used to calculate rank delta.
   *
   * @returns {{ saved: number, errors: string[] }}
   */
  async saveLeaderboardSnapshot() {
    const errors = [];

    // Fetch all users
    const { data: users, error: uErr } = await NP.db
      .from('users')
      .select('id');
    if (uErr) return { saved: 0, errors: [uErr.message] };

    // Recalc each user
    const snapshots = [];
    for (const user of users ?? []) {
      try {
        const stats = await this.recalcUser(user.id);
        snapshots.push({
          user_id:        user.id,
          total_points:   stats.total_points,
          match_points:   stats.match_points,
          trivia_points:  stats.trivia_points,
          correct_scores: stats.correct_scores,
          correct_outcomes: stats.correct_outcomes,
          snapshot_date:  new Date().toISOString().split('T')[0],
        });
      } catch (e) {
        errors.push(`User ${user.id}: ${e.message}`);
      }
    }

    // Rank assignment
    snapshots.sort((a, b) => b.total_points - a.total_points);
    const ranked = this.assignRanks(snapshots);

    // Upsert all snapshots
    const { error: sErr } = await NP.db
      .from('leaderboard_snapshots')
      .upsert(ranked, { onConflict: 'user_id,snapshot_date' });
    if (sErr) errors.push(sErr.message);

    return { saved: ranked.length, errors };
  },

  async rebuildLeaderboard() {
    const errors = [];
    const { data: users, error: uErr } = await NP.db
      .from('users').select('id, display_name, avatar_team_iso2');
    if (uErr) return { saved: 0, errors: [uErr.message] };

    // Fetch existing bonus_points so rebuild never overwrites them
    const { data: bonusRows } = await NP.db
      .from('leaderboard').select('user_id, bonus_points');
    const bonusMap = {};
    (bonusRows ?? []).forEach(r => { bonusMap[r.user_id] = r.bonus_points ?? 0; });

    const rows = [];
    for (const user of users ?? []) {
      try {
        const stats = await this.recalcUser(user.id);
        const bonus = bonusMap[user.id] ?? 0;
        rows.push({
          user_id:          user.id,
          display_name:     user.display_name,
          flag_iso2:        user.avatar_team_iso2 ?? null,
          total_points:     stats.total_points + bonus,
          match_points:     stats.match_points,
          bonus_points:     bonus,
          trivia_points:    0,
          correct_scores:   stats.correct_scores,
          correct_outcomes: stats.correct_outcomes,
          delta:            0,
        });
      } catch (e) { errors.push(`User ${user.id}: ${e.message}`); }
    }

    rows.sort((a, b) => b.total_points - a.total_points);
    const ranked = this.assignRanks(rows);
    const { error: lErr } = await NP.db
      .from('leaderboard').upsert(ranked, { onConflict: 'user_id' });
    if (lErr) errors.push(lErr.message);
    return { saved: ranked.length, errors };
  },

  /* ══════════════════════════════════════════════════════════
     DISPLAY HELPERS
     ══════════════════════════════════════════════════════════ */

  /**
   * Returns a CSS class name for a prediction chip based on result.
   * Maps to .pred-chip.exact / .correct / .wrong / .pending / .locked
   *
   * @param {{ pred_home, pred_away }} pred
   * @param {object} match
   * @param {boolean} isLocked  - true if prediction deadline has passed
   */
  predChipClass(pred, match, isLocked = false) {
    const base = this.calcBasePoints(pred, match);
    if (base === null) return isLocked ? 'locked' : 'pending';
    if (base === 3)    return 'exact';
    if (base === 1)    return 'correct';
    return 'wrong';
  },

  /**
   * Renders a complete prediction chip HTML string for a match row.
   * Includes the score text for exact predictions.
   *
   * @param {{ pred_home, pred_away }|null} pred  null = no prediction made
   * @param {object} match
   * @param {number} multiplier
   * @param {boolean} isLocked
   * @returns {string}  HTML string
   */
  renderPredChip(pred, match, multiplier = 1, isLocked = false) {
    if (!pred) {
      return isLocked
        ? `<span class="pred-chip locked">🔒 Zaklenjena</span>`
        : `<span class="pred-chip missing">✗ Manjka</span>`;
    }

    const { label, type, points } = this.getResultLabel(pred, match, multiplier);

    if (type === 'pending') {
      return isLocked
        ? `<span class="pred-chip locked">🔒 ${pred.pred_home}–${pred.pred_away}</span>`
        : `<span class="pred-chip pending">✓ ${pred.pred_home}–${pred.pred_away}</span>`;
    }

    return `<span class="pred-chip ${type}">${label}</span>`;
  },

  /**
   * Returns phase multiplier badge HTML for use in match rows.
   * Only renders if multiplier > 1.
   *
   * @param {number} multiplier
   * @returns {string}  HTML string or empty string
   */
  renderMultiplierBadge(multiplier) {
    if (!multiplier || multiplier <= 1) return '';
    return `<span class="mult-badge mult-x${multiplier}">×${multiplier}</span>`;
  },

  /* ══════════════════════════════════════════════════════════
     PHASE MULTIPLIER LOOKUP
     ══════════════════════════════════════════════════════════ */

  /**
   * Returns the expected multiplier for a given phase code.
   * Source of truth — matches the spec exactly.
   *
   * Group / R32 / R16 → ×1
   * QF / SF / 3rd place → ×2
   * Final → ×3
   *
   * @param {string} phaseCode
   * @returns {number}
   */
  multiplierForPhase(phaseCode) {
    const map = {
      group: 1,
      r32:   1,
      r16:   1,
      qf:    2,
      sf:    2,
      third: 2,
      final: 3,
    };
    return map[phaseCode] ?? 1;
  },

};

/* ── Re-expose convenience methods on NP directly for backwards compat ── */
// utils.js already has NP.calcBasePoints and NP.applyMultiplier as thin wrappers.
// They now delegate to the full implementations here.
NP.calcBasePoints  = (pred, match) => NP.scoring.calcBasePoints(pred, match);
NP.applyMultiplier = (base, mult)  => NP.scoring.applyMultiplier(base, mult);
