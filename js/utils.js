/**
 * utils.js — Napovednik 2026
 * Shared utilities: Supabase client, auth, tournament state, helpers.
 * Loaded first on every page via <script src="js/utils.js"></script>
 *
 * Exposes a global `NP` namespace used by all other scripts.
 */

/* ── SUPABASE CLIENT ─────────────────────────────────────── */
// Supabase JS v2 loaded via CDN in each HTML page before this script:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

const _SUPABASE_URL  = 'https://bnmlijpfztkhyfvjbkly.supabase.co';
const _SUPABASE_ANON = window.__NP_ANON_KEY__ || '';  // injected by Vercel env at build time

// Initialise once, reuse everywhere via NP.db
const _client = supabase.createClient(_SUPABASE_URL, _SUPABASE_ANON);

/* ── GLOBAL NAMESPACE ────────────────────────────────────── */
window.NP = {

  /** Raw Supabase client — use for direct queries when helpers aren't enough */
  db: _client,

  /* ── AUTH ──────────────────────────────────────────────── */
  /*
   * Simple username + password auth against the users table.
   * Session stored in localStorage as JSON.
   * No Supabase Auth — Supabase is used only for data storage.
   *
   * localStorage key: 'np_session'
   * Value: full users row as JSON
   */

  _SESSION_KEY: 'np_session',

  /**
   * Attempts login against the users table.
   * On success stores user row in localStorage.
   */
  async login(username, password) {
    const { data, error } = await _client
      .from('users')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .eq('password', password)
      .single();
    if (error || !data) {
      return { success: false, message: 'Napačno uporabniško ime ali geslo.' };
    }
    localStorage.setItem(this._SESSION_KEY, JSON.stringify(data));
    this._userProfileCache = data;
    return { success: true, user: data };
  },

  /**
   * Returns the current session from localStorage, or null.
   * Synchronous — no network call.
   */
  getSession() {
    try {
      const raw = localStorage.getItem(this._SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  /**
   * Returns the current user profile from localStorage.
   * No DB call — uses the stored session.
   */
  _userProfileCache: null,
  getUserProfile() {
    if (this._userProfileCache) return this._userProfileCache;
    this._userProfileCache = this.getSession();
    return this._userProfileCache;
  },

  /**
   * Re-fetches user profile from DB and updates localStorage.
   * Call after any profile update.
   */
  async refreshUserProfile() {
    const session = this.getSession();
    if (!session?.id) return null;
    const { data, error } = await _client
      .from('users').select('*').eq('id', session.id).single();
    if (error || !data) return null;
    localStorage.setItem(this._SESSION_KEY, JSON.stringify(data));
    this._userProfileCache = data;
    return data;
  },

  clearUserProfileCache() { this._userProfileCache = null; },

  /** Redirects to login.html if not logged in. Synchronous. */
  requireAuth(loginPath = 'login.html') {
    if (!this.getSession()) { window.location.href = loginPath; return false; }
    return true;
  },

  /** Redirects to index.html if already logged in. */
  redirectIfLoggedIn(homePath = 'index.html') {
    if (this.getSession()) window.location.href = homePath;
  },

  isAdmin() { return this.getUserProfile()?.is_admin === true; },

  requireAdmin(homePath = 'index.html') {
    if (!this.requireAuth()) return false;
    if (!this.isAdmin()) { window.location.href = homePath; return false; }
    return true;
  },

  signOut(loginPath = 'login.html') {
    localStorage.removeItem(this._SESSION_KEY);
    this._userProfileCache = null;
    this._tournamentCache  = null;
    window.location.href = loginPath;
  },

  /* ── TOURNAMENT STATE ──────────────────────────────────── */

  /**
   * getTournamentNow()
   *
   * The single most important helper. Merges tournament_phases + themed_days
   * into one object describing exactly what today looks like.
   *
   * Returns:
   * {
   *   phase: {            ← active row from tournament_phases
   *     id, name, phase_code,
   *     starts_at, ends_at,
   *     multiplier,
   *     features: { ... }  ← JSONB plugin list
   *   },
   *   themedDay: null | {  ← active row from themed_days (today only)
   *     id, theme_date, theme_code, theme_name_sl,
   *     theme_flag_iso2, banner_color_primary,
   *     sponsor_name, sponsor_logo_url, sponsor_tagline_sl,
   *     features: { ... }   ← JSONB plugin list
   *   },
   *   plugins: { ... },    ← merged features (themed_day overrides phase)
   *   today: Date,         ← current date (UTC midnight)
   *   isThemedDay: bool,
   *   multiplier: number   ← phase multiplier (1 / 2 / 3)
   * }
   *
   * Cached for 5 minutes to avoid hammering Supabase on every page load.
   */
  _tournamentCache: null,
  _tournamentCacheTime: 0,
  _CACHE_TTL_MS: 5 * 60 * 1000,

  async getTournamentNow() {
    const now = Date.now();
    if (this._tournamentCache && (now - this._tournamentCacheTime) < this._CACHE_TTL_MS) {
      return this._tournamentCache;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // Use local date for themed_days (Ljubljana time)
    const _ld = new Date();
    const todayISO = `${_ld.getFullYear()}-${String(_ld.getMonth()+1).padStart(2,'0')}-${String(_ld.getDate()).padStart(2,'0')}`;

    // Fetch active phase and today's themed day in parallel
    const [phaseRes, themedRes] = await Promise.all([
      _client
        .from('tournament_phases')
        .select('*')
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at',   new Date().toISOString())
        .order('starts_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      _client
        .from('themed_days')
        .select('*')
        .eq('theme_date', todayISO)
        .limit(1)
        .maybeSingle(),
    ]);

    if (phaseRes.error && phaseRes.error.code !== 'PGRST116') {
      console.warn('getTournamentNow phase error:', phaseRes.error.message);
    }

    const phase      = phaseRes.data  ?? null;
    const themedDay  = themedRes.data ?? null;

    // Merge plugins: phase features are the base, themed_day features override
    const plugins = {
      ...(phase?.features     ?? {}),
      ...(themedDay?.features ?? {}),
    };

    const result = {
      phase,
      themedDay,
      plugins,
      today,
      isThemedDay: themedDay !== null,
      multiplier:  phase?.multiplier ?? 1,
    };

    this._tournamentCache     = result;
    this._tournamentCacheTime = now;
    return result;
  },

  /** Force-invalidate the tournament cache (call from admin panel after edits) */
  invalidateTournamentCache() {
    this._tournamentCache     = null;
    this._tournamentCacheTime = 0;
  },

  /* ── PLUGIN HELPERS ────────────────────────────────────── */

  /**
   * Returns true if a given plugin key is active today.
   * Shortcut for: (await getTournamentNow()).plugins[key] === true
   *
   * @param {string} key  - plugin key e.g. 'alias_names', 'win98_theme'
   * @param {object} [state] - pre-fetched tournament state (avoids second DB call)
   */
  hasPlugin(key, state) {
    if (!state) throw new Error('hasPlugin: pass a pre-fetched tournament state object');
    return state.plugins[key] === true;
  },

  /**
   * Returns the alias for a user on the current themed day.
   * Falls back to display_name if no alias or no themed day today.
   *
   * alias format in DB: { "it": {"full":"Mario Rossi","short":"ROSSI"}, ... }
   *
   * @param {object} profile     - user row from users table
   * @param {object} state       - pre-fetched tournament state
   * @param {'full'|'short'} [variant='full']
   */
  getAlias(profile, state, variant = 'full') {
    if (!state.isThemedDay) return profile.display_name;
    if (!this.hasPlugin('alias_names', state)) return profile.display_name;
    const code = state.themedDay?.theme_code;
    if (!code) return profile.display_name;
    const aliasMap = profile.aliases ?? {};
    const entry = aliasMap[code];
    if (!entry) return profile.display_name;
    return entry[variant] ?? profile.display_name;
  },

  /* ── DATE / TIME HELPERS ─────────────────────────────────*/

  /**
   * Returns a human-readable countdown string: "3d 4h" / "2h 15m" / "45m" / "< 1m"
   * @param {string|Date} targetISO — future datetime
   */
  formatCountdown(targetISO) {
    const diff = new Date(targetISO) - new Date();
    if (diff <= 0) return '—';
    const totalMins = Math.floor(diff / 60000);
    const days  = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const mins  = totalMins % 60;
    if (days  > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins  > 0) return `${mins}m`;
    return '< 1m';
  },

  /**
   * Returns true if a match deadline has passed (i.e. predictions locked).
   * Deadline = kickoff_time minus 1 hour.
   * @param {string} kickoffISO
   */
  isPredictionLocked(kickoffISO) {
    const deadline = new Date(kickoffISO) - 60 * 60 * 1000;
    return Date.now() >= deadline;
  },

  /**
   * Formats a UTC datetime string for Slovenian display.
   * e.g. "2026-06-16T18:00:00Z" → "16. jun, 18:00"
   * @param {string} iso
   * @param {boolean} [includeDate=true]
   */
  formatKickoff(iso, includeDate = true) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    const months = ['jan','feb','mar','apr','maj','jun','jul','avg','sep','okt','nov','dec'];
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (!includeDate) return time;
    return `${d.getDate()}. ${months[d.getMonth()]}, ${time}`;
  },

  /**
   * Returns 'today' | 'tomorrow' | 'YYYY-MM-DD' for grouping matches by day.
   * @param {string} iso
   */
  matchDayLabel(iso) {
    const matchDay = new Date(iso);
    matchDay.setUTCHours(0,0,0,0);
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const diff = Math.round((matchDay - today) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    return matchDay.toISOString().split('T')[0];
  },

  /* ── SCORING HELPERS ─────────────────────────────────────*/

  /**
   * Calculates raw points for a single prediction (before phase multiplier).
   * Returns: 3 (exact score) | 1 (correct outcome) | 0 (wrong)
   * Outcome = H/D/A based on goals, AET counts, penalties don't affect result.
   *
   * @param {object} pred   - { pred_home, pred_away }
   * @param {object} match  - { home_score_120, away_score_120, home_score_90, away_score_90 }
   *   Uses _120 if available (AET played), otherwise _90.
   */
  calcBasePoints(pred, match) {
    // Determine final score (AET counts, penalties don't)
    const fh = match.home_score_120 ?? match.home_score_90;
    const fa = match.away_score_120 ?? match.away_score_90;
    if (fh === null || fa === null) return null; // match not finished

    const ph = pred.pred_home;
    const pa = pred.pred_away;

    // Exact score
    if (ph === fh && pa === fa) return 3;

    // Correct outcome
    const outcome = fh > fa ? 'H' : fh < fa ? 'A' : 'D';
    const predOut = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
    if (outcome === predOut) return 1;

    return 0;
  },

  /**
   * Applies the phase multiplier to base points.
   * @param {number} basePoints   - 0 | 1 | 3
   * @param {number} multiplier   - 1 | 2 | 3
   */
  applyMultiplier(basePoints, multiplier) {
    return basePoints * multiplier;
  },

  /* ── DOM HELPERS ─────────────────────────────────────────*/

  /**
   * Shorthand for document.querySelector.
   * Returns null (not throws) if not found.
   */
  qs(selector, root = document) {
    return root.querySelector(selector);
  },

  /**
   * Shorthand for document.querySelectorAll, returns Array.
   */
  qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  },

  /**
   * Shows a toast notification.
   * Requires a <div class="toast-container"> in the DOM (added by each page).
   *
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=4000] ms
   */
  toast(message, type = 'info', duration = 4000) {
    let container = this.qs('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    container.appendChild(t);
    setTimeout(() => t.remove(), duration);
  },

  /**
   * Sets an element's inner text safely (no XSS).
   * No-ops if element not found.
   */
  setText(selector, text, root = document) {
    const el = this.qs(selector, root);
    if (el) el.textContent = text;
  },

  /**
   * Shows or hides an element by toggling the 'hidden' class.
   */
  setVisible(selector, visible, root = document) {
    const el = this.qs(selector, root);
    if (!el) return;
    el.classList.toggle('hidden', !visible);
  },

  /* ── FLAG / TEAM HELPERS ─────────────────────────────────*/

  /**
   * Returns a flagcdn.com URL for a given ISO 3166-1 alpha-2 country code.
   * @param {string} iso2  e.g. 'fr', 'de', 'br'
   * @param {number} [width=40]
   */
  flagUrl(code, width = 40) {
    if (!code) return '';
    return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
  },

  /**
   * Returns an <img> element for a country flag.
   * @param {string} iso2
   * @param {string} [alt]
   */
  flagImg(iso2, alt = '') {
    const img = document.createElement('img');
    img.src    = this.flagUrl(iso2);
    img.alt    = alt || iso2;
    img.width  = 26;
    img.height = 18;
    img.style.objectFit  = 'cover';
    img.style.borderRadius = '2px';
    return img;
  },

  /* ── MISC ────────────────────────────────────────────────*/

  /**
   * Debounce — delays fn execution until after `wait` ms of silence.
   * Useful for search inputs.
   */
  debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  /**
   * Shuffles an array in place (Fisher-Yates).
   * Used by some plugins (6/7 Day random colours, quiz option randomisation).
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  /**
   * Returns the ordinal rank suffix for Slovenian (1., 2., 3. — same for all).
   */
  ordinal(n) {
    return `${n}.`;
  },

  /**
   * Returns gender-conjugated Slovenian verb/adjective.
   * @param {object} profile - user profile with .gender ('m'|'f')
   * @param {string} masculine - masculine form
   * @param {string} feminine  - feminine form
   * @returns {string}
   *
   * Usage: NP.conj(profile, 'odgovoril', 'odgovorila')
   *        NP.conj(profile, 'napovedal', 'napovedala')
   *        NP.conj(profile, 'izbral', 'izbrala')
   *        NP.conj(profile, 'zmagal', 'zmagala')
   */
  conj(profile, masculine, feminine) {
    return profile?.gender === 'f' ? feminine : masculine;
  },

};

/* ── VERCEL ANON KEY INJECTION ───────────────────────────── */
// In production, Vercel injects the anon key via a build-time script tag:
//   <script>window.__NP_ANON_KEY__ = 'eyJ...';</script>
// For local development, set it in a local config file or .env.
// The anon key is safe to expose — RLS policies enforce access control.
