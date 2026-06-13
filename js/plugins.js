/**
 * plugins.js — Napovednik 2026
 * Reads the merged tournament state from NP.getTournamentNow()
 * and applies all active plugins to the current page.
 *
 * Dependencies: utils.js must be loaded first.
 *
 * Usage — call once per page after DOM is ready:
 *   await NP.applyPlugins();
 *
 * Individual plugin functions are also exposed on NP for
 * pages that need to call them directly (e.g. selektor.html).
 */

/* ── ENTRY POINT ─────────────────────────────────────────── */

NP.applyPlugins = async function (stateOverride) {
  const state   = stateOverride ?? await NP.getTournamentNow();
  const profile = await NP.getUserProfile();
  const p       = state.plugins;

  // Fetch app_config for runtime-controllable settings (no deploy needed)
  let cfg = {};
  try {
    const { data } = await NP.db.from('app_config').select('key, value');
    (data || []).forEach(row => { cfg[row.key] = row.value; });
  } catch (e) { /* silent fallback */ }

  // Always apply
  _applyStandingBanner(state, profile);
  _applyPhaseAccent(state);

  // ── System overlays ──────────────────────────────────────
  if (p.maintenance_mode) { _applyMaintenance(p); return; }

  // Announcement: app_config takes priority over features
  const annActive = cfg.announcement_banner === 'true' || cfg.announcement_banner === true;
  const annText   = cfg.announcement_text || p.announcement_text;
  if (annActive && annText) _applyAnnouncementBanner({ ...p, announcement_text: annText });

  // Custom banners from app_config
  const slotA = document.getElementById('custom-banner-a');
  const slotB = document.getElementById('custom-banner-b');
  if (slotA && cfg.custom_banner_a) slotA.innerHTML = cfg.custom_banner_a;
  if (slotB && cfg.custom_banner_b) slotB.innerHTML = cfg.custom_banner_b;

  // ── Phase plugins ─────────────────────────────────────────
  if (p.countdown)                  _applyCountdown(state);
  if (p.welcome_message)            _applyWelcomeMessage(p);
  if (p.missing_predictions_warning) _applyMissingPredictionsWarning();
  if (p.weekly_prize)               _applyWeeklyPrize(p);
  if (p.weekly_trivialist)          _applyWeeklyTrivialist(p);
  if (p.pre_launch_trivialist)      _applyPreLaunchTrivialist(p);
  if (p.prediction_progress)        _applyPredictionProgress();
  if (p.multiplier_badge)           _applyMultiplierBadge(state);
  if (p.show_top_scorers)           _applyTopScorers();
  if (p.daily_recap_card)           _applyDailyRecapCard(p);
  if (p.match_of_the_day)           _applyMatchOfTheDay(p);
  if (p.show_bracket)               _applyBracketBar(state);
  if (p.tension_mode)               _applyTensionMode();
  if (p.bracket_lock_countdown)     _applyBracketLockCountdown(p);
  if (p.confetti_on_load)           _applyConfetti();
  if (p.show_winner_banner)         _applyWinnerBanner(p);
  if (p.final_standings)            _applyFinalStandings();
  if (p.podium)                     _applyPodium();
  if (p.stats_unlocked)             _applyStatsUnlocked();
  if (p.final_recap_video)          _applyFinalRecapVideo(p);
  if (p.trivia_bonus_applied)       _applyTriviaBonusApplied();

  // ── National day plugins ──────────────────────────────────
  if (state.isThemedDay) {
    _applyThemedBanner(state, profile);
    if (p.alias_names && profile.full_game === true)    _applyAliasNames(state, profile);
    if (p.hello_message_native) _applyHelloMessageNative(p, profile, state);
    if (p.food_fact_card)    _applyFoodFactCard(p);
    if (p.no_team_note)      _applyNoTeamNote(p);
    if (p.national_holiday)  _applyNationalHoliday(p);
    if (p.jersey_preview && profile.full_game === true) _applyJerseyPreview(state, profile);
  }

  // ── Transfer Deadline Day ─────────────────────────────────
  if (p.unlock_winner_pick)  _applyUnlockWinnerPick();

  // ── 6/7 Day ───────────────────────────────────────────────
  if (p.everyone_is_67)      _applyEveryoneIs67(state);
  if (p.random_colors)       _applyRandomColors();
  if (p.shake_screen)        _applyShakeScreen();
  if (p.progress_bar_67)     _applyProgressBar67();

  // ── Win98 Day ─────────────────────────────────────────────
  if (p.win98_theme)         _applyWin98Theme();
  if (p.win98_clippy)        _applyWin98Clippy();
  if (p.win98_bsod)          _applyWin98Bsod();
  if (p.win98_error_dialogs) _applyWin98ErrorDialogs();
  if (p.win98_startup_sound) _applyWin98StartupSound();
  if (p.win98_loading_bar)   _applyWin98LoadingBar();
  if (p.win98_fake_download) _applyWin98FakeDownload();
  if (p.win98_nav_labels)    _applyWin98NavLabels();
  if (p.win98_floppy_save)   _applyWin98FloppySave();
  if (p.win98_start_button)  _applyWin98StartButton();
  if (p.win98_visitor_counter) _applyWin98VisitorCounter();
  if (p.win98_myspace_ad)    _applyWin98MyspaceAd();
  if (p.win98_under_construction) _applyWin98UnderConstruction();

  // ── Office Day ────────────────────────────────────────────
  if (p.office_theme)        _applyOfficeTheme();
  if (p.office_nav_labels)   _applyOfficeNavLabels();
  if (p.office_greeting)     _applyOfficeGreeting(p, profile);
  if (p.office_dashboard)    _applyOfficeDashboard();
  if (p.office_fake_print)   _applyOfficeFakePrint();
  if (p.office_fake_teams)   _applyOfficeFakeTeams(p);
  if (p.office_fake_download) _applyOfficeFakeDownload();
  if (p.office_nps_survey)   _applyOfficeNpsSurvey();
  if (p.office_progress_bar) _applyOfficeProgressBar();
  if (p.office_udemy_card)   _applyOfficeUdemyCard();
  if (p.office_terms)        _applyOfficeTerms();
  if (p.office_excel_sponsor) _applyOfficeExcelSponsor();
};

/* ═══════════════════════════════════════════════════════════
   ALWAYS-ON
   ═══════════════════════════════════════════════════════════ */

/**
 * Renders the standing banner (regular or national-day variant).
 * Targets: [data-slot="standing-banner"] on every page.
 */
async function _applyStandingBanner(state, profile) {
  const slot = NP.qs('[data-slot="standing-banner"]');
  if (!slot || !profile) return;

  const alias = profile.full_game === true
    ? NP.getAlias(profile, state, 'full')
    : (profile.alias_limited || profile.display_name);
  const isNationalDay = state.isThemedDay && state.plugins.alias_names && profile.full_game === true;

  // Fetch live stats
  const { data: lb } = await NP.db
    .from('leaderboard')
    .select('rank, total_points, correct_scores, correct_outcomes, delta')
    .eq('user_id', profile.id)
    .maybeSingle();

  const rank         = lb?.rank           ?? '—';
  const pts          = lb?.total_points   ?? 0;
  const scores       = lb?.correct_scores ?? 0;
  const triviaCorrect = lb?.trivia_correct ?? 0;
  const triviaTotal   = lb?.trivia_total   ?? 0;
  const delta        = lb?.delta          ?? 0;

  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
  const deltaText  = delta > 0 ? `▲ ${delta} danes` : delta < 0 ? `▼ ${Math.abs(delta)} danes` : '— danes';

  // Slovenian plurals
  function nTock(n) {
    if (n === 1) return '1 točka';
    if (n === 2) return '2 točki';
    if (n === 3) return '3 točke';
    if (n === 4) return '4 točke';
    return n + ' točk';
  }
  function nNapovedi(n) {
    if (n === 1) return '1 točna napoved';
    if (n === 2) return '2 točni napovedi';
    if (n === 3) return '3 točne napovedi';
    if (n === 4) return '4 točne napovedi';
    return n + ' točnih napovedi';
  }

  if (isNationalDay) {
    const td  = state.themedDay;
    const bg  = td.banner_color_primary  ?? '#449d44';

    // First name of alias for greeting e.g. "Forza, Enricco!"
    const aliasFirst = alias.split(' ')[0];
    const nativeGreeting = (td.greeting_native ?? '').replace('{alias}', aliasFirst);

    // Sponsor
    const sponsorHtml = td.sponsor_logo_url
      ? `<img src="${_esc(td.sponsor_logo_url)}" alt="${_esc(td.sponsor_name ?? '')}"
           style="height:28px;max-width:90px;object-fit:contain;background:#fff;border-radius:6px;padding:3px 8px;display:block">`
      : td.sponsor_name
        ? `<span style="font-size:.88rem;font-weight:800;color:#fff;
             background:rgba(255,255,255,.15);padding:3px 10px;border-radius:6px">${_esc(td.sponsor_name)}</span>`
        : '';

    // Flag image
    const flagImg = `<img src="${NP.flagUrl(td.theme_flag_iso2, 40)}"
      style="width:20px;height:14px;object-fit:cover;border-radius:2px;
             border:1px solid rgba(255,255,255,.3);flex-shrink:0"
      alt="" onerror="this.style.display='none'">`;

    slot.innerHTML = `
      <div style="background:${bg};border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-card);display:flex;flex-direction:column;width:100%">

        <!-- DESKTOP LAYOUT: old horizontal row (hidden on mobile) -->
        <div class="td-desktop-row" style="display:flex;align-items:center;padding:10px 18px;gap:12px;width:100%">
          <div class="standing-rank" style="color:#fff">#${rank}</div>
          <div class="standing-divider" style="background:rgba(255,255,255,.3)"></div>
          <div class="standing-info">
            <div class="standing-name" style="color:#fff">
              ${_esc(alias)}
              <span style="font-size:.6rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;opacity:.75;margin-left:7px">
                aka ${_esc(profile.original_name ?? profile.display_name)}
              </span>
            </div>
            <div class="standing-pts" style="color:rgba(255,255,255,.8)">
              ${nNapovedi(scores)} · Trivia ${triviaCorrect}/${triviaTotal} pravilnih
            </div>
          </div>
          <div class="standing-divider" style="background:rgba(255,255,255,.3)"></div>
          <div class="standing-stat">
            <div class="standing-stat-num" style="color:#fff">${pts}</div>
            <div class="standing-stat-label" style="color:rgba(255,255,255,.7)">Točk</div>
          </div>
          <div class="standing-divider" style="background:rgba(255,255,255,.3)"></div>
          <div class="delta-chip ${deltaClass}" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.3)">${deltaText}</div>
        </div>

        <!-- DESKTOP BOTTOM: greeting + sponsor in one row (hidden on mobile) -->
        <div class="td-desktop-row" style="display:flex;align-items:center;padding:6px 18px 8px;border-top:1px solid rgba(255,255,255,.15)">
          <div style="display:flex;align-items:center;gap:7px;font-size:.78rem;color:rgba(255,255,255,.9);flex:1;min-width:0">
            ${flagImg}
            <span style="font-weight:600">${_esc(td.greeting_sl ?? '')}</span>
            ${nativeGreeting ? `<span style="opacity:.5">·</span><span style="font-style:italic">${_esc(nativeGreeting)}</span>` : ''}
          </div>
          ${sponsorHtml ? `
          <div style="display:flex;align-items:center;gap:7px;flex-shrink:0">
            <span style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.6);white-space:nowrap">sponzor dneva</span>
            ${sponsorHtml}
          </div>` : ''}
        </div>

        <!-- MOBILE LAYOUT: greeting band + scoreboard + sponsor footer (hidden on desktop) -->
        <div class="td-mobile-col">

          <div class="td-band" style="background:rgba(0,0,0,.18);padding:7px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.12)">
            <p style="font-size:.75rem;font-weight:700;color:rgba(255,255,255,.95);display:flex;align-items:center;gap:6px;min-width:0;margin:0">
              <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(td.greeting_sl ?? '')}</span>
              ${nativeGreeting ? `<span style="opacity:.4">·</span><span style="font-style:italic;opacity:.85;white-space:nowrap">${_esc(nativeGreeting)}</span>` : ''}
            </p>
            ${flagImg}
          </div>

          <div style="display:flex;align-items:flex-end;justify-content:space-between;padding:14px 18px 10px">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div class="standing-rank" style="color:#fff;font-size:2.4rem">#${rank}</div>
              <div>
                <div style="font-size:1.05rem;font-weight:800;color:#fff;line-height:1.1">${_esc(alias)}</div>
                <div style="font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:2px">
                  aka ${_esc(profile.original_name ?? profile.display_name)}
                </div>
              </div>
            </div>
            <div style="text-align:right;line-height:1">
              <div style="font-size:1.8rem;font-weight:900;color:#fff;letter-spacing:-.02em">${pts}</div>
              <div style="font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6)">Točk</div>
            </div>
          </div>

          <div style="padding:0 18px 14px">
            <div class="standing-pts" style="color:rgba(255,255,255,.7);font-size:.72rem">
              ${nNapovedi(scores)} · Trivia ${triviaCorrect}/${triviaTotal} pravilnih
            </div>
          </div>

          ${sponsorHtml ? `
          <div style="background:#fff;padding:7px 16px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(0,0,0,.06)">
            <span style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa">Sponzor dneva</span>
            ${sponsorHtml}
          </div>` : ''}

        </div>

      </div>`;

  } else {
    slot.innerHTML = `
      <div class="standing-banner">
        <div class="standing-rank">#${rank}</div>
        <div class="standing-divider"></div>
        <div class="standing-info">
          <div class="standing-name">${_esc(profile.original_name ?? profile.display_name)}</div>
          <div class="standing-pts">${nNapovedi(scores)} · Trivia ${triviaCorrect}/${triviaTotal} pravilnih</div>
        </div>
        <div class="standing-divider"></div>
        <div class="standing-stat">
          <div class="standing-stat-num">${pts}</div>
          <div class="standing-stat-label">Točk</div>
        </div>
        <div class="standing-divider"></div>
        <div class="delta-chip ${deltaClass}">${deltaText}</div>
      </div>`;
  }
}

/** Builds the bottom strip of a national day banner */
function _themedBannerBottom(td, profile, state) {
  const txtColor = td.banner_color_secondary ?? '#ffffff';
  const sponsorHtml = td.sponsor_logo_url
    ? `<img src="${_esc(td.sponsor_logo_url)}" alt="${_esc(td.sponsor_name ?? '')}" style="height:28px;max-width:80px;object-fit:contain;filter:brightness(0) invert(1)">`
    : td.sponsor_name
      ? `<span style="font-size:.85rem;font-weight:800;color:${txtColor}">${_esc(td.sponsor_name)}</span>`
      : '';
  if (!td.greeting_sl && !sponsorHtml) return '';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:8px 16px 10px;border-top:1px solid rgba(255,255,255,.15);margin-top:4px;width:100%">
      <div style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:${txtColor};opacity:.9">
        ${td.theme_flag_iso2 ? `<span style="font-size:1rem">${_flagEmoji(td.theme_flag_iso2)}</span>` : ''}
        <span style="font-weight:600">${_esc(td.theme_name_sl ?? '')}</span>
        <span style="opacity:.7">·</span>
        <span>${_esc(td.greeting_sl ?? '')}</span>
      </div>
      ${sponsorHtml ? `
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${txtColor};opacity:.6">sponzor dneva</span>
        ${sponsorHtml}
      </div>` : ''}
    </div>`;
}

/**
 * Applies the phase accent colour by adding a body class.
 * CSS handles the rest via .phase-knockout, .phase-qf etc.
 */
function _applyPhaseAccent(state) {
  const code = state.phase?.phase_code ?? 'group';
  const map = {
    group:   '',
    r32:     'phase-knockout',
    r16:     'phase-knockout',
    qf:      'phase-qf',
    sf:      'phase-sf',
    third:   'phase-third',
    final:   'phase-final',
  };
  const cls = map[code];
  if (cls) document.body.classList.add(cls);
}

/* ═══════════════════════════════════════════════════════════
   SYSTEM OVERLAYS
   ═══════════════════════════════════════════════════════════ */

function _applyMaintenance(p) {
  document.body.innerHTML = `
    <div class="maintenance-overlay">
      <div class="maintenance-icon">🔧</div>
      <div class="maintenance-title">Vzdrževanje</div>
      <div class="maintenance-text">${_esc(p.maintenance_message ?? 'Napovednik je trenutno v vzdrževanju. Kmalu nazaj!')}</div>
    </div>`;
}

function _applyAnnouncementBanner(p) {
  const existing = NP.qs('.announcement-bar');
  if (existing) {
    const textEl = NP.qs('.ann-text', existing);
    if (textEl && p.announcement_text) textEl.innerHTML = p.announcement_text;
    return;
  }
  const bar = document.createElement('div');
  bar.className = 'announcement-bar';
  bar.innerHTML = `
    <span class="ann-icon">📢</span>
    <span class="ann-text">${p.announcement_text ?? ''}</span>
    <button class="ann-dismiss" onclick="this.closest('.announcement-bar').remove()">✕</button>`;
  // Insert into dedicated slot if present, otherwise fall back to body.prepend
  const slot = document.getElementById('announcement-slot');
  if (!slot) return; // Only show on pages with a designated slot
  if (slot) slot.appendChild(bar);
}

/* ═══════════════════════════════════════════════════════════
   PHASE PLUGINS
   ═══════════════════════════════════════════════════════════ */

function _applyCountdown(state) {
  NP.qsa('[data-slot="countdown"]').forEach(el => {
    const end = state.phase?.ends_at;
    if (!end) { el.textContent = '—'; return; }
    el.textContent = NP.formatCountdown(end);
    // Refresh every minute
    setInterval(() => { el.textContent = NP.formatCountdown(end); }, 60000);
  });
}

function _applyWelcomeMessage(p) {
  NP.qsa('[data-slot="welcome-message"]').forEach(el => {
    el.textContent = p.welcome_text ?? '';
    NP.setVisible('[data-slot="welcome-message"]', true);
  });
}

async function _applyMissingPredictionsWarning() {
  const profile = await NP.getUserProfile();
  if (!profile) return;
  // Count upcoming matches with no prediction
  const { count } = await NP.db
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .is('home_score_90', null) // not yet played
    .not('id', 'in',
      NP.db.from('predictions').select('match_id').eq('user_id', profile.id)
    );
  if (!count || count === 0) return;
  NP.qsa('[data-slot="missing-predictions"]').forEach(el => {
    el.innerHTML = `<span class="badge badge-red">⚠️ ${count} tekem brez napovedi</span>`;
    NP.setVisible('[data-slot="missing-predictions"]', true);
  });
}

function _applyWeeklyPrize(p) {
  NP.qsa('[data-slot="weekly-prize"]').forEach(el => {
    el.innerHTML = `
      <div class="card-body" style="display:flex;align-items:center;gap:10px">
        <span style="font-size:1.4rem">${p.weekly_prize_emoji ?? '🎁'}</span>
        <div>
          <div style="font-size:.8rem;font-weight:700">${_esc(p.weekly_prize_sponsor ?? '')}</div>
          <div style="font-size:.72rem;color:var(--muted)">${_esc(p.weekly_prize_label ?? '')}</div>
        </div>
      </div>`;
  });
}

function _applyWeeklyTrivialist(p) {
  NP.qsa('[data-slot="weekly-trivialist"]').forEach(el => {
    if (!p.trivialist_name) return;
    el.innerHTML = `
      <div class="announcement-bar" style="border-bottom:none;background:var(--gold-bg)">
        <span class="ann-icon">🏆</span>
        <span class="ann-text">
          <strong>Trivialist ${_esc(p.trivialist_week ?? '')}. tedna: ${_esc(p.trivialist_name)}</strong>
          ${p.trivialist_prize ? ` · ${_esc(p.trivialist_prize)} te čaka!` : ''}
        </span>
      </div>`;
  });
}

function _applyPreLaunchTrivialist(p) {
  _applyWeeklyTrivialist(p); // same markup, different slot context
}

async function _applyPredictionProgress() {
  const profile = await NP.getUserProfile();
  if (!profile) return;
  const { count: total } = await NP.db
    .from('matches').select('id', { count: 'exact', head: true }).is('home_score_90', null);
  const { count: done  } = await NP.db
    .from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', profile.id);
  const pct = total ? Math.round((done / total) * 100) : 0;
  NP.qsa('[data-slot="prediction-progress"]').forEach(el => {
    el.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill ${pct === 100 ? 'complete' : pct > 50 ? '' : 'partial'}"
               style="width:${pct}%"></div>
        </div>
        <div class="progress-label">${done ?? 0}/${total ?? 0} oddanih</div>
      </div>`;
  });
}

function _applyMultiplierBadge(state) {
  const m = state.multiplier ?? 1;
  if (m <= 1) return;
  NP.qsa('[data-slot="multiplier-badge"]').forEach(el => {
    el.innerHTML = `<span class="mult-badge mult-x${m}">×${m} točke</span>`;
  });
}

async function _applyTopScorers() {
  const { data } = await NP.db
    .from('top_scorers')
    .select('player_id, name, goals, team_iso2')
    .order('goals', { ascending: false })
    .limit(5);
  if (!data?.length) return;
  NP.qsa('[data-slot="top-scorers"]').forEach(el => {
    el.innerHTML = data.map((s, i) => `
      <div class="lb-row">
        <div class="lb-rank ${i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : ''}">${i + 1}</div>
        <img src="${NP.flagUrl(s.team_iso2)}" class="lb-avatar" alt="">
        <div class="lb-name">${_esc(s.name)}</div>
        <div class="lb-pts">${s.goals} ⚽</div>
      </div>`).join('');
  });
}

function _applyDailyRecapCard(p) {
  NP.qsa('[data-slot="daily-recap"]').forEach(el => {
    if (p.recap_text) el.innerHTML = `<p style="font-size:.85rem;color:var(--text-mid)">${_esc(p.recap_text)}</p>`;
  });
}

function _applyMatchOfTheDay(p) {
  NP.qsa('[data-slot="match-of-the-day"]').forEach(el => {
    if (p.motd_label) el.innerHTML = `
      <div class="badge badge-gold">⭐ ${_esc(p.motd_label)}</div>`;
  });
}

function _applyBracketBar(state) {
  NP.qsa('[data-slot="bracket-bar"]').forEach(el => {
    el.innerHTML = _buildBracketBar(state);
  });
}

function _buildBracketBar(state) {
  const code = state.phase?.phase_code ?? 'group';
  const phases = [
    { code: 'group', label: 'Skupinski', mult: 1, count: '48 tekem' },
    { code: 'r32',   label: 'R32',       mult: 1, count: '32 tekem', mergeWith: 'r16' },
    { code: 'r16',   label: 'R32 → R16', mult: 1, count: '24 tekem' },
    { code: 'qf',    label: 'QF · SF · 3.', mult: 2, count: '7 tekem', mergeWith: 'sf' },
    { code: 'final', label: 'Finale',    mult: 3, count: '1 tekma' },
  ];
  const order = ['group','r16','qf','final'];
  let html = '<div class="bracket-bar compact">';
  order.forEach((c, i) => {
    const ph    = phases.find(p => p.code === c);
    const done  = _phaseOrder(code) > _phaseOrder(c);
    const active = code === c || (c === 'r16' && (code === 'r32' || code === 'r16'));
    const cls   = done ? 'done' : active ? 'active' : 'upcoming';
    html += `
      <div class="bracket-phase ${cls} mult-x${ph.mult}">
        <span class="bracket-phase-name">${ph.label}</span>
        <span class="bracket-phase-mult">×${ph.mult}</span>
      </div>`;
    if (i < order.length - 1) {
      html += `<div class="bracket-sep${done ? ' done' : ''}">→</div>`;
    }
  });
  return html + '</div>';
}

function _phaseOrder(code) {
  return { group:0, r32:1, r16:1, qf:2, sf:2, third:2, final:3 }[code] ?? 0;
}

function _applyTensionMode() {
  document.body.classList.add('tension-mode');
  // tension-mode CSS can add subtle pulsing accents — defined in style.css as needed
}

function _applyBracketLockCountdown(p) {
  NP.qsa('[data-slot="bracket-lock-countdown"]').forEach(el => {
    if (!p.bracket_lock_at) return;
    const update = () => { el.textContent = `Zaklep v: ${NP.formatCountdown(p.bracket_lock_at)}`; };
    update();
    setInterval(update, 60000);
  });
}

function _applyConfetti() {
  // Lightweight CSS confetti — inject once, remove after 4s
  if (NP.qs('#np-confetti')) return;
  const style = document.createElement('style');
  style.id = 'np-confetti';
  style.textContent = `
    @keyframes confetti-fall {
      0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
    .np-confetti-piece {
      position: fixed; top: 0; width: 8px; height: 14px;
      border-radius: 2px; animation: confetti-fall linear forwards;
      pointer-events: none; z-index: 9999;
    }`;
  document.head.appendChild(style);
  const colours = ['#449d44','#f97316','#eab308','#7c3aed','#ef4444','#3b82f6'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'np-confetti-piece';
    el.style.cssText = `
      left:${Math.random()*100}vw;
      background:${colours[Math.floor(Math.random()*colours.length)]};
      animation-duration:${2.5 + Math.random()*2}s;
      animation-delay:${Math.random()*1.5}s;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

function _applyWinnerBanner(p) {
  NP.qsa('[data-slot="winner-banner"]').forEach(el => {
    if (!p.winner_name) return;
    el.innerHTML = `
      <div class="standing-banner" style="background:linear-gradient(135deg,var(--phase-final),#d97706)">
        <div class="sb-rank">🏆</div>
        <div class="sb-divider"></div>
        <div class="sb-info">
          <div class="sb-name">${_esc(p.winner_name)}</div>
          <div class="sb-pts">Zmagovalec Napovednika 2026!</div>
        </div>
      </div>`;
  });
}

async function _applyFinalStandings() {
  // Reuses the leaderboard slot — final standings are just the full leaderboard
  // Pages that need this render the leaderboard component directly
}

async function _applyPodium() {
  const { data } = await NP.db
    .from('leaderboard')
    .select('rank, display_name, total_points, flag_iso2')
    .lte('rank', 3)
    .order('rank');
  if (!data?.length) return;
  NP.qsa('[data-slot="podium"]').forEach(el => {
    const [p2, p1, p3] = [data[1], data[0], data[2]];
    el.innerHTML = `
      <div class="podium">
        ${p2 ? _podiumPlace(p2, 'p2', 2) : ''}
        ${p1 ? _podiumPlace(p1, 'p1', 1) : ''}
        ${p3 ? _podiumPlace(p3, 'p3', 3) : ''}
      </div>`;
  });
}

function _podiumPlace(p, cls, rank) {
  return `
    <div class="podium-place ${cls}">
      <div class="podium-avatar">${p.flag_iso2 ? _flagEmoji(p.flag_iso2) : '🏅'}</div>
      <div class="podium-name">${_esc(p.display_name)}</div>
      <div class="podium-pts">${p.total_points} točk</div>
      <div class="podium-block">${rank}</div>
    </div>`;
}

function _applyStatsUnlocked() {
  NP.setVisible('[data-slot="stats"]', true);
}

function _applyFinalRecapVideo(p) {
  NP.qsa('[data-slot="recap-video"]').forEach(el => {
    if (!p.recap_video_url) return;
    el.innerHTML = `<video src="${_esc(p.recap_video_url)}" controls style="width:100%;border-radius:var(--radius-lg)"></video>`;
  });
}

function _applyTriviaBonusApplied() {
  NP.qsa('[data-slot="trivia-bonus"]').forEach(el => {
    el.innerHTML = `<span class="badge badge-green">✓ Trivia bonus vštet</span>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   NATIONAL DAY PLUGINS
   ═══════════════════════════════════════════════════════════ */

function _applyThemedBanner(state, profile) {
  // Only apply national day color for full_game users
  if (profile?.full_game !== true) return;
  const bg = state.themedDay?.banner_color_primary;
  if (bg) document.documentElement.style.setProperty('--themed-day-color', bg);
}

function _applyAliasNames(state, profile) {
  // Replace display name everywhere with alias
  const full  = NP.getAlias(profile, state, 'full');
  const short = NP.getAlias(profile, state, 'short');
  NP.qsa('[data-alias="full"]').forEach(el => { el.textContent = full; });
  NP.qsa('[data-alias="short"]').forEach(el => { el.textContent = short; });
  // Also update navbar user chip if present
  const chip = NP.qs('.user-chip-name');
  if (chip) chip.textContent = full;
}

function _applyHelloMessageNative(p, profile, state) {
  const alias = NP.getAlias(profile, state, 'full');
  NP.qsa('[data-slot="hello-message"]').forEach(el => {
    const tmpl = state.themedDay?.greeting_sl ?? '';
    el.textContent = tmpl.replace('{name}', alias);
  });
}

function _applyFoodFactCard(p) {
  NP.qsa('[data-slot="food-fact"]').forEach(el => {
    if (!p.food_fact_text) return;
    el.innerHTML = `
      <div class="card-body" style="font-size:.82rem;color:var(--text-mid)">
        ${p.food_fact_emoji ? `<span style="font-size:1.5rem;display:block;margin-bottom:6px">${p.food_fact_emoji}</span>` : ''}
        ${_esc(p.food_fact_text)}
      </div>`;
  });
}

function _applyNoTeamNote(p) {
  NP.qsa('[data-slot="no-team-note"]').forEach(el => {
    el.innerHTML = `<div class="badge badge-muted">🛋️ ${_esc(p.no_team_text ?? 'Italija ni kvalificirana — gledamo z divana')}</div>`;
    NP.setVisible('[data-slot="no-team-note"]', true);
  });
}

function _applyNationalHoliday(p) {
  NP.qsa('[data-slot="national-holiday"]').forEach(el => {
    el.innerHTML = `<div class="badge badge-green">🇸🇮 ${_esc(p.holiday_name ?? 'Dan državnosti')}</div>`;
    NP.setVisible('[data-slot="national-holiday"]', true);
  });
}

/* ── Jersey name positioning config ──────────────────────────────────────────
   All values in px, based on the original jersey image dimensions.
   Add a new entry for each theme_code with a jersey.

   Fields:
     imageW / imageH   — original image size in px
     nameX  / nameY    — center point of the name area (where text is centered)
     maxNameW          — max allowed text width in px (on original image)
     maxFontSize       — largest allowed font size in px (on original image)
     fontWeight        — CSS font-weight (default 900)
────────────────────────────────────────────────────────────────────────── */
const JERSEY_CONFIG = {
  'italian_day': {
    imageW:      800,
    imageH:      800,
    nameX:       400,   // ← UPDATE: center X of name on back of jersey
    nameY:       180,   // ← UPDATE: center Y of name on back of jersey
    maxNameW:    300,   // ← UPDATE: max text width
    maxFontSize:  52,   // ← UPDATE: largest font size
    fontWeight:  900,
  },
  // 'bosnian_day': { imageW: 800, imageH: 800, nameX: 400, nameY: 180, maxNameW: 300, maxFontSize: 52, fontWeight: 900 },
};

const JERSEY_CONFIG_DEFAULT = {
  imgW: 1024, imgH: 1024,
  centerX: 312, centerY: 147,
  maxWidth: 320, maxFontSize: 52,
  arcRadius: 320,
};

/* Calculates the largest font size (px) where text fits within maxWidthPx.
   Uses Canvas measureText — no DOM needed. */
function _calcJerseyFontSize(text, maxWidthPx, maxFontSizePx,
    weight = 900, family = '"League Spartan", Arial Black, Arial, sans-serif') {
  const ctx = document.createElement('canvas').getContext('2d');
  let fs = Math.ceil(maxFontSizePx);
  while (fs > 7) {
    ctx.font = `${weight} ${fs}px ${family}`;
    if (ctx.measureText(text).width <= maxWidthPx) break;
    fs--;
  }
  return fs;
}

/* Canvas font size for download — uses ORIGINAL image dimensions */
function _jerseyFontSizeCanvas(text, themeCode) {
  const cfg = JERSEY_CONFIG[themeCode] ?? null;
  return _calcJerseyFontSize(
    text,
    cfg?.maxNameW    ?? 300,
    cfg?.maxFontSize ?? 52,
    cfg?.fontWeight  ?? 900
  );
}




/* ═══════════════════════════════════════════════════════════
   TRANSFER DEADLINE DAY
   ═══════════════════════════════════════════════════════════ */

function _applyUnlockWinnerPick() {
  NP.setVisible('[data-slot="winner-pick"]', true);
  NP.qsa('[data-slot="winner-pick"]').forEach(el => {
    el.classList.add('animate-bounce-in');
  });
}

/* ═══════════════════════════════════════════════════════════
   6/7 DAY
   ═══════════════════════════════════════════════════════════ */

function _applyEveryoneIs67(state) {
  // All display names and aliases become "6/7"
  NP.qsa('[data-alias="full"], [data-alias="short"], .lb-name, .sb-name, .day-alias').forEach(el => {
    if (!el.closest('[data-preserve-name]')) el.textContent = '6/7';
  });
  NP.qsa('.user-chip-name').forEach(el => { el.textContent = '6/7'; });
}

function _applyRandomColors() {
  const hues = [0,30,60,90,120,150,180,210,240,270,300,330];
  const h = hues[Math.floor(Math.random() * hues.length)];
  document.documentElement.style.setProperty('--accent',      `hsl(${h},65%,40%)`);
  document.documentElement.style.setProperty('--accent-dark', `hsl(${h},65%,28%)`);
  document.documentElement.style.setProperty('--accent-bg',   `hsl(${h},65%,40%,0.08)`);
  // Reapply on each navigation (single-page, so this fires once per load)
}

function _applyShakeScreen() {
  document.body.classList.add('shake-67');
  setTimeout(() => document.body.classList.remove('shake-67'), 1000);
  // Shake again every 67 seconds (of course)
  setInterval(() => {
    document.body.classList.add('shake-67');
    setTimeout(() => document.body.classList.remove('shake-67'), 1000);
  }, 67000);
}

function _applyProgressBar67() {
  NP.qsa('[data-slot="progress-67"]').forEach(el => {
    el.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" style="width:67%"></div>
        </div>
        <div class="progress-label">6/7</div>
      </div>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   WIN98 DAY
   ═══════════════════════════════════════════════════════════ */

function _applyWin98Theme() {
  document.body.classList.add('theme-win98');
  // Play startup sound is handled separately
}

function _applyWin98Bsod() {
  if (NP.qs('#bsod-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'bsod-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9900;
    background:#0000AA;color:#AAAAAA;
    font-family:'Courier New',monospace;font-size:14px;
    display:none;flex-direction:column;
    align-items:center;justify-content:center;
    padding:40px;text-align:left;cursor:default;user-select:none;`;
  overlay.innerHTML = `
    <div style="max-width:640px;width:100%">
      <div style="background:#AAAAAA;color:#0000AA;padding:2px 8px;font-weight:bold;font-size:15px;margin-bottom:24px;display:inline-block">
        \u00a0Kritična napaka sistema Windows\u00a0
      </div>
      <div style="color:#FFFFFF;line-height:2;margin-bottom:28px">
        Prišlo je do usodne napake pri procesiranju napovedi oddelka.<br>
        <strong>NAPOVED.EXE</strong> je povzročil kritičen izpad pisarniške sinergije.<br><br>
        Napaka: <strong>0x0000002B PREDICTION_OVERFLOW</strong><br>
        Modul: <strong>KORPORATIVNI_KPI_HANDLER.DLL</strong>
      </div>
      <div style="font-size:12px;color:#AAAAAA;line-height:1.8;margin-bottom:28px">
        * Pritisnite katero koli tipko za nadaljevanje ... ali ne.<br>
        * Če se ta zaslon pojavi prvič, ponovni zagon morda ne bo pomagal.<br>
        * Preverite, ali ste pravilno napovedali izid zadnje tekme.<br><br>
        Technical information:<br>
        *** STOP: 0x0000002B (0xC0034A72, 0x00000000, 0xF891AC3D, 0x00000001)<br>
        *** NAPOVED.EXE - Address F891AC3D base at F8910000, DateStamp 3d6dd67c
      </div>
      <div style="color:#FFFFFF;font-size:13px">
        <span id="bsod-blink">█</span>\u00a0 Kliknite kjerkoli za vrnitev v sistem.
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Blinking cursor
  setInterval(() => {
    const b = NP.qs('#bsod-blink');
    if (b) b.style.opacity = b.style.opacity === '0' ? '1' : '0';
  }, 500);

  function _bsodHide() {
    overlay.style.display = 'none';
    document.removeEventListener('keydown', _bsodHide);
    setTimeout(() => {
      const c = NP.qs('#clippy');
      if (c) {
        c.innerHTML = `<strong>📎 Sistem obnovljen!</strong><br><br>
          Zgleda, da si preživel. Čestitam. Napovedi so še vedno napačne.
          <br><br>
          <button onclick="document.getElementById('clippy').remove()"
            style="font-family:'Courier New';font-size:11px;padding:2px 8px;cursor:pointer">
            Ne, hvala
          </button>`;
        c.style.display = 'block';
      }
    }, 600);
  }
  function _bsodShow() {
    overlay.style.display = 'flex';
    document.addEventListener('keydown', _bsodHide, { once: true });
  }
  overlay.addEventListener('click', _bsodHide);

  // Wire to "Optimiziraj napovedi →" hero button — delay so DOM is ready
  setTimeout(() => {
    const heroBtn = NP.qs('.hero-btn-primary');
    if (heroBtn) {
      heroBtn.removeAttribute('href');
      heroBtn.style.cursor = 'pointer';
      heroBtn.addEventListener('click', (e) => { e.preventDefault(); _bsodShow(); });
    }
  }, 500);
}


function _applyWin98Clippy() {
  if (NP.qs('#clippy')) return;
  const clippy = document.createElement('div');
  clippy.id = 'clippy';
  clippy.style.cssText = `
    position:fixed;bottom:80px;right:24px;z-index:8000;
    background:#ffffc0;border:2px solid #808080;border-radius:4px;
    padding:10px 12px;max-width:220px;font-size:12px;font-family:'Courier New',monospace;
    box-shadow:2px 2px 0 #000;cursor:pointer;`;
  clippy.innerHTML = `
    <strong>📎 Vzemi me v korist!</strong><br><br>
    Zdi se, da napovedujete tekme. Želite, da vam pomagam?
    <br><br>
    <button onclick="document.getElementById('clippy').remove()"
      style="font-family:'Courier New';font-size:11px;padding:2px 8px;cursor:pointer">
      Ne, hvala
    </button>`;
  document.body.appendChild(clippy);
}

function _applyWin98ErrorDialogs() {
  // Randomly trigger a fake error dialog after 8–15 seconds
  setTimeout(() => {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);
      z-index:9000;background:#d4d0c8;border:2px solid;
      border-color:#ffffff #808080 #808080 #ffffff;
      min-width:280px;font-family:'Courier New',monospace;font-size:12px;`;
    dialog.innerHTML = `
      <div style="background:linear-gradient(90deg,#000080,#1084d0);color:white;padding:3px 6px;display:flex;justify-content:space-between">
        <span>⚠️ Napovednik.exe</span>
        <button onclick="this.closest('div[style]').remove()"
          style="background:#d4d0c8;border:1px solid;border-color:#fff #808080 #808080 #fff;color:#000;font-size:11px;cursor:pointer;padding:0 4px">✕</button>
      </div>
      <div style="padding:16px;display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:2rem">⚠️</span>
        <div>Napaka pri nalaganju zadetkov.<br>Prosimo kliknite V redu za nadaljevanje.</div>
      </div>
      <div style="padding:8px;text-align:center;border-top:1px solid #808080">
        <button onclick="this.closest('div[style]').remove()"
          style="background:#d4d0c8;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:3px 20px;font-family:'Courier New';cursor:pointer">
          V redu
        </button>
      </div>`;
    document.body.appendChild(dialog);
  }, 8000 + Math.random() * 7000);
}

function _applyWin98StartupSound() {
  // Plays Windows 95 startup sound via Web Audio API (short, royalty-free)
  // We generate a synthetic chime rather than loading an external file
  try {
    const ctx = new AudioContext();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.35);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch (e) { /* AudioContext not available */ }
}

function _applyWin98LoadingBar() {
  if (NP.qs('#win98-loading')) return;
  const bar = document.createElement('div');
  bar.id = 'win98-loading';
  bar.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;height:24px;
    background:#c0c0c0;border-top:2px solid #ffffff;
    font-family:'Courier New';font-size:11px;
    display:flex;align-items:center;padding:0 8px;gap:8px;z-index:7000;`;
  bar.innerHTML = `
    <span id="win98-status">Nalaganje...</span>
    <div style="flex:1;height:12px;background:#fff;border:1px inset #808080">
      <div id="win98-fill" style="height:100%;background:#000080;width:0%;transition:width .4s"></div>
    </div>`;
  document.body.appendChild(bar);
  let pct = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 15;
    if (pct >= 100) { pct = 100; clearInterval(iv); setTimeout(() => bar.remove(), 1200); }
    NP.qs('#win98-fill').style.width = pct + '%';
    NP.qs('#win98-status').textContent = pct < 100 ? `Nalaganje... ${Math.floor(pct)}%` : 'Pripravljeno.';
  }, 400);
}

function _applyWin98FakeDownload() {
  setTimeout(() => {
    NP.toast('📥 Prenos: napovednik_rezultati.zip (2.4 MB)', 'info', 6000);
  }, 12000);
}

function _applyWin98NavLabels() {
  const labels = { 'Home': 'Moj Računalnik', 'Predikcije': 'Datoteke', 'Napovedi': 'Omrežje', 'Rezultati': 'Rezultati.xls', 'Lestvica': 'Lestvica.txt' };
  NP.qsa('.navbar-link').forEach(el => {
    const orig = el.textContent.trim().replace(/^[^\w]+/, '').trim();
    if (labels[orig]) el.textContent = '📁 ' + labels[orig];
  });
}

function _applyWin98FloppySave() {
  NP.qsa('button[data-action="save"], .btn-primary').forEach(btn => {
    if (!btn.textContent.includes('💾')) {
      btn.textContent = '💾 ' + btn.textContent;
    }
  });
}

function _applyWin98StartButton() {
  if (NP.qs('#win98-start')) return;
  const btn = document.createElement('button');
  btn.id = 'win98-start';
  btn.style.cssText = `
    position:fixed;bottom:0;left:0;height:28px;padding:0 12px;
    background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;
    font-family:'Courier New';font-size:12px;font-weight:bold;
    cursor:pointer;z-index:7001;display:flex;align-items:center;gap:4px;`;
  btn.innerHTML = '🪟 <strong>Start</strong>';
  btn.onclick = () => NP.toast('Danes smo vsi Windows 98. 💿', 'info');
  document.body.appendChild(btn);
}

function _applyWin98VisitorCounter() {
  NP.qsa('[data-slot="visitor-counter"]').forEach(el => {
    const n = Math.floor(Math.random() * 9000) + 1000;
    el.innerHTML = `
      <div style="font-family:'Courier New';font-size:11px;color:var(--muted);text-align:center">
        👁️ Obiskovalci: <span style="background:#000;color:#0f0;padding:0 4px">${n}</span>
      </div>`;
  });
}

function _applyWin98MyspaceAd() {
  NP.qsa('[data-slot="myspace-ad"]').forEach(el => {
    el.innerHTML = `
      <div style="background:#fff;border:2px solid #ff6600;padding:8px;text-align:center;font-family:'Courier New';font-size:11px;animation:animate-pulse 1s infinite">
        ✨ <strong>ČESTITKE!</strong> ✨<br>Si 1.000.000. obiskovalec!<br>
        <span style="color:#ff0000">KLIKNI TUKAJ ZA NAGRADO!!!</span>
      </div>`;
  });
}

function _applyWin98UnderConstruction() {
  NP.qsa('[data-slot="under-construction"]').forEach(el => {
    el.innerHTML = `
      <div style="text-align:center;padding:8px;font-family:'Courier New';font-size:11px;color:var(--muted)">
        🚧 Ta stran je v gradnji 🚧
      </div>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   OFFICE DAY
   ═══════════════════════════════════════════════════════════ */

function _applyOfficeTheme() {
  document.body.classList.add('theme-office');
}

function _applyOfficeNavLabels() {
  const labels = {
    'Home': 'Dashboard', 'Predikcije': 'Vnos podatkov',
    'Napovedi': 'Skupni pregled', 'Rezultati': 'Poročilo',
    'Lestvica': 'Izobraževanje',  // "Obvezno izobraževanje"
  };
  NP.qsa('.navbar-link').forEach(el => {
    const orig = el.textContent.trim().replace(/^[^\w]+/, '').trim();
    if (labels[orig]) el.textContent = labels[orig];
  });
  // Override leaderboard label specifically per spec
  const lb = NP.qsa('.navbar-link').find(el => el.textContent.includes('Lestvica'));
  if (lb) lb.textContent = 'Obvezno izobraževanje';
}

function _applyOfficeGreeting(p, profile) {
  NP.qsa('[data-slot="office-greeting"]').forEach(el => {
    const name = profile?.display_name ?? 'Sodelavec';
    el.innerHTML = `
      <div style="font-size:.85rem;color:var(--text-mid);padding:10px 16px;background:var(--blue-bg);border-left:3px solid var(--blue);border-radius:var(--radius-sm)">
        ${_esc(p.office_greeting_text ?? `Pozdravljeni, ${name}. Danes je ${new Date().toLocaleDateString('sl-SI')}. Lepo se imejte.`)}
      </div>`;
  });
}

async function _applyOfficeDashboard() {
  // Top 3 = green circles, middle = orange, bottom 3 = red
  const { data } = await NP.db
    .from('leaderboard')
    .select('rank, display_name, total_points')
    .order('rank')
    .limit(25);
  if (!data) return;
  const total = data.length;
  NP.qsa('[data-slot="office-dashboard"]').forEach(el => {
    el.innerHTML = data.map(p => {
      const cls = p.rank <= 3 ? 'green' : p.rank >= total - 2 ? 'red' : 'orange';
      return `
        <div class="lb-row">
          <div class="office-circle ${cls}"></div>
          <div class="lb-rank">${p.rank}</div>
          <div class="lb-name">${_esc(p.display_name)}</div>
          <div class="lb-pts">${p.total_points}</div>
        </div>`;
    }).join('');
  });
}

function _applyOfficeFakePrint() {
  NP.qsa('[data-action="print"], [data-slot="print-btn"]').forEach(btn => {
    btn.addEventListener('click', () => {
      NP.toast('🖨️ Tiskanje v teku... (Napaka: Tiskalnik ni na voljo)', 'error', 5000);
    });
  });
}

function _applyOfficeFakeTeams(p) {
  // Shows a fake Microsoft Teams notification announcing the weekly trivialist
  if (!p.trivialist_name) return;
  setTimeout(() => {
    NP.toast(`📬 Teams: ${p.trivialist_name} je Trivialist tedna! Nagrada: ${p.weekly_prize_label ?? '🎁'} v sobi 8.`, 'info', 8000);
  }, 3000);
}

function _applyOfficeFakeDownload() {
  setTimeout(() => {
    NP.toast('📥 Prenos: Q2_rezultati_FINAL_v3.xlsx (preneseno)', 'info', 5000);
  }, 10000);
}

function _applyOfficeNpsSurvey() {
  NP.qsa('[data-slot="nps-survey"]').forEach(el => {
    el.innerHTML = `
      <div class="card-body" style="font-size:.82rem">
        <div style="font-weight:700;margin-bottom:8px">Kako ste zadovoljni z Napovednika?</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[1,2,3,4,5,6,7,8,9,10].map(n =>
            `<button onclick="NP.toast('Hvala za oceno ${n}/10!','success')"
              class="btn btn-secondary btn-sm">${n}</button>`
          ).join('')}
        </div>
      </div>`;
  });
}

function _applyOfficeProgressBar() {
  NP.qsa('[data-slot="office-progress"]').forEach(el => {
    el.innerHTML = `
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Letni KPI — Napovedi</div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:73%"></div></div>
        <div class="progress-label">73%</div>
      </div>`;
  });
}

function _applyOfficeUdemyCard() {
  NP.qsa('[data-slot="udemy-card"]').forEach(el => {
    el.innerHTML = `
      <div class="card-body" style="font-size:.82rem;color:var(--text-mid)">
        📚 <strong>Priporočeno izobraževanje:</strong><br>
        "Excel za napredne: VLOOKUP in XLOOKUP" — 4.8 ⭐ · 2h 15min
        <br><br>
        <button class="btn btn-secondary btn-sm" onclick="NP.toast('Dodano v Moja izobraževanja.','success')">
          Dodaj v seznam
        </button>
      </div>`;
  });
}

function _applyOfficeTerms() {
  NP.qsa('[data-slot="office-terms"]').forEach(el => {
    el.innerHTML = `
      <div style="font-size:.68rem;color:var(--muted);line-height:1.5">
        Z uporabo Napovednika 2026 se strinjate s Pogoji uporabe, Politiko zasebnosti
        in Internim pravilnikom o digitalnih orodjih (rev. 2026-01-01).
        Vse napovedi se shranjujejo v skladu z GDPR.
      </div>`;
  });
}

function _applyOfficeExcelSponsor() {
  NP.qsa('[data-slot="excel-sponsor"]').forEach(el => {
    el.innerHTML = `
      <div style="font-size:.72rem;color:var(--muted);text-align:center">
        Podpira: <strong style="color:#217346">Microsoft Excel</strong> 🟩
      </div>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   PRIVATE UTILITIES
   ═══════════════════════════════════════════════════════════ */

/** Escapes HTML entities to prevent XSS */
function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts ISO 3166-1 alpha-2 code to flag emoji.
 * Works by converting each letter to its regional indicator symbol.
 * @param {string} iso2  e.g. 'fr'
 */
function _flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const base = 0x1F1E6 - 65; // 'A' = 65
  const chars = iso2.toUpperCase().split('');
  return String.fromCodePoint(base + chars[0].charCodeAt(0)) +
         String.fromCodePoint(base + chars[1].charCodeAt(0));
}
/* Returns the name overlay div — coords read from themed_days object. */
function _jerseyNameOverlay(name, themeCode, nameColor, td) {
  const cfg  = JERSEY_CONFIG[themeCode] ?? JERSEY_CONFIG_DEFAULT;
  const fill = cfg.color ?? nameColor ?? '#ffffff';
  const imgW  = 1024;
  const imgH  = 1024;
  const cx    = td?.jersey_center_x || cfg.centerX || 312;
  const cy    = td?.jersey_center_y || cfg.centerY || 147;
  const leftPct = (cx / imgW * 100).toFixed(4);
  const topPct  = (cy / imgH * 100).toFixed(4);
  // Font size as % of image width via CSS calc — shrinks for long names
  const len = name.length;
  const basePct = 6.5;
  const shrink  = Math.max(0, (len - 6) * 0.35);
  const fontPct = Math.max(3.0, basePct - shrink).toFixed(2);
  return `<div class="jersey-name" style="
    position:absolute;
    left:${leftPct}%;top:${topPct}%;
    transform:translate(-50%,-50%);
    width:60%;text-align:center;
    color:${fill};
    font-family:Figtree,Arial,sans-serif;font-weight:900;
    font-size:${fontPct}cqw;
    text-shadow:0 1px 3px rgba(0,0,0,.4);letter-spacing:.05em;line-height:1">
    ${name.toUpperCase()}</div>`;
}


function _jerseyAlias(profile, state) {
  // Use jersey-specific alias if set, otherwise fall back to first name of short alias
  const themeCode = state.themedDay?.theme_code;
  const aliases   = profile.aliases ?? {};
  return aliases?.[themeCode]?.jersey
      ?? NP.getAlias(profile, state, 'short').split(' ')[0];
}

function _applyJerseyPreview(state, profile) {
  NP.qsa('[data-slot="jersey-preview"]').forEach(el => {
    NP.setVisible('[data-slot="jersey-preview"]', true);
    const jerseyUrl  = state.themedDay?.jersey_url;
    const tc         = state.themedDay?.theme_code ?? '';
    const td         = state.themedDay;
    const cfg        = JERSEY_CONFIG[tc] ?? JERSEY_CONFIG_DEFAULT;
    const fill       = cfg.color ?? td?.jersey_name_color ?? '#ffffff';
    const jerseyName = _jerseyAlias(profile, state);
    if (!jerseyUrl) return;
    const jcx = td?.jersey_center_x || cfg.centerX || 312;
    const jcy = td?.jersey_center_y || cfg.centerY || 147;
    const jmw = td?.jersey_max_width || cfg.maxWidth || 320;
    const jfs = td?.jersey_font_size || cfg.maxFontSize || 52;
    const overlay = _jerseyNameOverlay(jerseyName, tc, fill, td);
    el.innerHTML = `
      <div class="jersey-module">
        <div class="jersey-module-header">
          <div class="jersey-module-title">👕 Tvoj dres danes</div>
        </div>
        <div class="jersey-inner">
          <div class="jersey-image-wrapper">
            <img src="${_esc(jerseyUrl)}" alt="Dres" style="-webkit-touch-callout:default">
            ${overlay}
          </div>
          <button class="jersey-download-btn"
            onclick="NP.downloadJersey('${_esc(jerseyUrl)}','${_esc(jerseyName)}','${_esc(fill)}','${_esc(tc)}',${jcx},${jcy},${jmw},${jfs})">
            ⬇ Prenesi
          </button>
        </div>
      </div>`;
  });
}

/* ── Jersey modal — full size preview + download ──────────── */
NP.plugins_applyJerseyPreview = function(state, profile) {
  _applyJerseyPreview(state, profile);
};

NP.openJerseyModal = function(jerseyUrl, alias, nameColor, themeCode, cx, cy, maxW, maxFs) {
  document.getElementById('jersey-modal')?.remove();
  const cfg  = JERSEY_CONFIG[themeCode ?? ''] ?? JERSEY_CONFIG_DEFAULT;
  const fill = cfg.color ?? nameColor ?? '#ffffff';
  const _td  = { jersey_center_x: cx||312, jersey_center_y: cy||147 };
  const svg  = _jerseyNameOverlay(alias, themeCode ?? '', fill, _td);

  const modal = document.createElement('div');
  modal.id = 'jersey-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background:var(--bg-mid);border-radius:16px;padding:24px;max-width:420px;width:100%;text-align:center;position:relative">
      <button onclick="document.getElementById('jersey-modal').remove()"
        style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--muted);line-height:1">✕</button>
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:12px">Tvoj dres danes</div>
      <div class="jersey-image-wrapper" style="max-width:340px">
        <img src="${_esc(jerseyUrl)}" alt="Dres">
        ${svg}
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        <button onclick="NP.downloadJersey('${_esc(jerseyUrl)}','${_esc(alias)}','${_esc(fill)}','${_esc(themeCode ?? '')}')"
          style="flex:1;padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;
          font-family:var(--font-main);font-size:.85rem;font-weight:700;cursor:pointer">
          ⬇️ Prenesi JPG
        </button>
        <button onclick="document.getElementById('jersey-modal').remove()"
          style="padding:10px 16px;background:var(--bg-deep);color:var(--text);border:1px solid var(--border);border-radius:10px;
          font-family:var(--font-main);font-size:.85rem;font-weight:600;cursor:pointer">
          Zapri
        </button>
      </div>
      <div style="margin-top:8px;font-size:.68rem;color:var(--muted)">Dolgo pritisni na sliko za shranjevanje na mobitelih</div>
    </div>`;

  document.body.appendChild(modal);
};

/* ── Canvas download ──────────────────────────────────────── */


/* ── Canvas download ──────────────────────────────────────── */
NP.downloadJersey = async function(jerseyUrl, alias, nameColor, theme, cx, cy, maxW, maxFs) {
  const cfg      = JERSEY_CONFIG[theme ?? ''] ?? JERSEY_CONFIG_DEFAULT;
  const fill     = cfg.color ?? nameColor ?? '#ffffff';
  const _cx      = cx    || cfg.centerX    || 312;
  const _cy      = cy    || cfg.centerY    || 147;
  const _maxW    = maxW  || cfg.maxWidth   || 320;
  const _maxFs   = maxFs || cfg.maxFontSize|| 52;
  const fileName = `${alias.toLowerCase().replace(/\s+/g,'-')}-dres.jpg`;

  async function _doShare(dataUrl) {
    if (navigator.canShare) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Moj dres · Napovednik 2026' });
          return 'shared';
        }
      } catch (e) {
        if (e.name === 'AbortError') return 'cancelled';
      }
    }
    const a = document.createElement('a');
    a.href = dataUrl; a.download = fileName; a.click();
    return 'downloaded';
  }

  function _drawName(ctx, W, H) {
    let fs = _maxFs;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${fs}px Figtree, Arial, sans-serif`;
    while (ctx.measureText(alias.toUpperCase()).width > _maxW && fs > 10) {
      fs -= 1;
      ctx.font = `900 ${fs}px Figtree, Arial, sans-serif`;
    }
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4;
    ctx.fillText(alias.toUpperCase(), _cx, _cy);
  }

  let dataUrl = null;

  // Try 1: crossOrigin (works if CORS headers present)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = rej;
      i.src = jerseyUrl + (jerseyUrl.includes('?') ? '&' : '?') + '_cb=' + Date.now();
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1024;
    canvas.height = img.naturalHeight || 1024;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    _drawName(ctx, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  } catch (e) {
    // Try 2: fetch as blob (no CORS needed), draw to canvas
    try {
      const blob = await (await fetch(jerseyUrl)).blob();
      const blobUrl = URL.createObjectURL(blob);
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = blobUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      _drawName(ctx, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      URL.revokeObjectURL(blobUrl);
    } catch (e2) {
      NP.toast('Napaka pri prenosu slike.', 'error');
      return;
    }
  }

  await _doShare(dataUrl);
};

/* ═══════════════════════════════════════════════════════════
   TRANSFER DEADLINE DAY
   ═══════════════════════════════════════════════════════════ */

function _applyUnlockWinnerPick() {
  NP.setVisible('[data-slot="winner-pick"]', true);
  NP.qsa('[data-slot="winner-pick"]').forEach(el => {
    el.classList.add('animate-bounce-in');
  });
}

/* ═══════════════════════════════════════════════════════════
   6/7 DAY
   ═══════════════════════════════════════════════════════════ */

function _applyEveryoneIs67(state) {
  // All display names and aliases become "6/7"
  NP.qsa('[data-alias="full"], [data-alias="short"], .lb-name, .sb-name, .day-alias').forEach(el => {
    if (!el.closest('[data-preserve-name]')) el.textContent = '6/7';
  });
  NP.qsa('.user-chip-name').forEach(el => { el.textContent = '6/7'; });
}

function _applyRandomColors() {
  const hues = [0,30,60,90,120,150,180,210,240,270,300,330];
  const h = hues[Math.floor(Math.random() * hues.length)];
  document.documentElement.style.setProperty('--accent',      `hsl(${h},65%,40%)`);
  document.documentElement.style.setProperty('--accent-dark', `hsl(${h},65%,28%)`);
  document.documentElement.style.setProperty('--accent-bg',   `hsl(${h},65%,40%,0.08)`);
  // Reapply on each navigation (single-page, so this fires once per load)
}

function _applyShakeScreen() {
  document.body.classList.add('shake-67');
  setTimeout(() => document.body.classList.remove('shake-67'), 1000);
  // Shake again every 67 seconds (of course)
  setInterval(() => {
    document.body.classList.add('shake-67');
    setTimeout(() => document.body.classList.remove('shake-67'), 1000);
  }, 67000);
}

function _applyProgressBar67() {
  NP.qsa('[data-slot="progress-67"]').forEach(el => {
    el.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" style="width:67%"></div>
        </div>
        <div class="progress-label">6/7</div>
      </div>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   WIN98 DAY
   ═══════════════════════════════════════════════════════════ */

function _applyWin98Theme() {
  document.body.classList.add('theme-win98');
  // Play startup sound is handled separately
}

function _applyWin98Clippy() {
  if (NP.qs('#clippy')) return;
  const clippy = document.createElement('div');
  clippy.id = 'clippy';
  clippy.style.cssText = `
    position:fixed;bottom:80px;right:24px;z-index:8000;
    background:#ffffc0;border:2px solid #808080;border-radius:4px;
    padding:10px 12px;max-width:220px;font-size:12px;font-family:'Courier New',monospace;
    box-shadow:2px 2px 0 #000;cursor:pointer;`;
  clippy.innerHTML = `
    <strong>📎 Vzemi me v korist!</strong><br><br>
    Zdi se, da napovedujete tekme. Želite, da vam pomagam?
    <br><br>
    <button onclick="document.getElementById('clippy').remove()"
      style="font-family:'Courier New';font-size:11px;padding:2px 8px;cursor:pointer">
      Ne, hvala
    </button>`;
  document.body.appendChild(clippy);
}

function _applyWin98ErrorDialogs() {
  // Randomly trigger a fake error dialog after 8–15 seconds
  setTimeout(() => {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);
      z-index:9000;background:#d4d0c8;border:2px solid;
      border-color:#ffffff #808080 #808080 #ffffff;
      min-width:280px;font-family:'Courier New',monospace;font-size:12px;`;
    dialog.innerHTML = `
      <div style="background:linear-gradient(90deg,#000080,#1084d0);color:white;padding:3px 6px;display:flex;justify-content:space-between">
        <span>⚠️ Napovednik.exe</span>
        <button onclick="this.closest('div[style]').remove()"
          style="background:#d4d0c8;border:1px solid;border-color:#fff #808080 #808080 #fff;color:#000;font-size:11px;cursor:pointer;padding:0 4px">✕</button>
      </div>
      <div style="padding:16px;display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:2rem">⚠️</span>
        <div>Napaka pri nalaganju zadetkov.<br>Prosimo kliknite V redu za nadaljevanje.</div>
      </div>
      <div style="padding:8px;text-align:center;border-top:1px solid #808080">
        <button onclick="this.closest('div[style]').remove()"
          style="background:#d4d0c8;border:2px solid;border-color:#fff #808080 #808080 #fff;padding:3px 20px;font-family:'Courier New';cursor:pointer">
          V redu
        </button>
      </div>`;
    document.body.appendChild(dialog);
  }, 8000 + Math.random() * 7000);
}

function _applyWin98StartupSound() {
  // Plays Windows 95 startup sound via Web Audio API (short, royalty-free)
  // We generate a synthetic chime rather than loading an external file
  try {
    const ctx = new AudioContext();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.35);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch (e) { /* AudioContext not available */ }
}

function _applyWin98LoadingBar() {
  if (NP.qs('#win98-loading')) return;
  const bar = document.createElement('div');
  bar.id = 'win98-loading';
  bar.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;height:24px;
    background:#c0c0c0;border-top:2px solid #ffffff;
    font-family:'Courier New';font-size:11px;
    display:flex;align-items:center;padding:0 8px;gap:8px;z-index:7000;`;
  bar.innerHTML = `
    <span id="win98-status">Nalaganje...</span>
    <div style="flex:1;height:12px;background:#fff;border:1px inset #808080">
      <div id="win98-fill" style="height:100%;background:#000080;width:0%;transition:width .4s"></div>
    </div>`;
  document.body.appendChild(bar);
  let pct = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 15;
    if (pct >= 100) { pct = 100; clearInterval(iv); setTimeout(() => bar.remove(), 1200); }
    NP.qs('#win98-fill').style.width = pct + '%';
    NP.qs('#win98-status').textContent = pct < 100 ? `Nalaganje... ${Math.floor(pct)}%` : 'Pripravljeno.';
  }, 400);
}

function _applyWin98FakeDownload() {
  setTimeout(() => {
    NP.toast('📥 Prenos: napovednik_rezultati.zip (2.4 MB)', 'info', 6000);
  }, 12000);
}

function _applyWin98NavLabels() {
  const labels = { 'Home': 'Moj Računalnik', 'Predikcije': 'Datoteke', 'Napovedi': 'Omrežje', 'Rezultati': 'Rezultati.xls', 'Lestvica': 'Lestvica.txt' };
  NP.qsa('.navbar-link').forEach(el => {
    const orig = el.textContent.trim().replace(/^[^\w]+/, '').trim();
    if (labels[orig]) el.textContent = '📁 ' + labels[orig];
  });
}

function _applyWin98FloppySave() {
  NP.qsa('button[data-action="save"], .btn-primary').forEach(btn => {
    if (!btn.textContent.includes('💾')) {
      btn.textContent = '💾 ' + btn.textContent;
    }
  });
}

function _applyWin98StartButton() {
  if (NP.qs('#win98-start')) return;
  const btn = document.createElement('button');
  btn.id = 'win98-start';
  btn.style.cssText = `
    position:fixed;bottom:0;left:0;height:28px;padding:0 12px;
    background:#c0c0c0;border:2px solid;border-color:#fff #808080 #808080 #fff;
    font-family:'Courier New';font-size:12px;font-weight:bold;
    cursor:pointer;z-index:7001;display:flex;align-items:center;gap:4px;`;
  btn.innerHTML = '🪟 <strong>Start</strong>';
  btn.onclick = () => NP.toast('Danes smo vsi Windows 98. 💿', 'info');
  document.body.appendChild(btn);
}

function _applyWin98VisitorCounter() {
  NP.qsa('[data-slot="visitor-counter"]').forEach(el => {
    const n = Math.floor(Math.random() * 9000) + 1000;
    el.innerHTML = `
      <div style="font-family:'Courier New';font-size:11px;color:var(--muted);text-align:center">
        👁️ Obiskovalci: <span style="background:#000;color:#0f0;padding:0 4px">${n}</span>
      </div>`;
  });
}

function _applyWin98MyspaceAd() {
  NP.qsa('[data-slot="myspace-ad"]').forEach(el => {
    el.innerHTML = `
      <div style="background:#fff;border:2px solid #ff6600;padding:8px;text-align:center;font-family:'Courier New';font-size:11px;animation:animate-pulse 1s infinite">
        ✨ <strong>ČESTITKE!</strong> ✨<br>Si 1.000.000. obiskovalec!<br>
        <span style="color:#ff0000">KLIKNI TUKAJ ZA NAGRADO!!!</span>
      </div>`;
  });
}

function _applyWin98UnderConstruction() {
  NP.qsa('[data-slot="under-construction"]').forEach(el => {
    el.innerHTML = `
      <div style="text-align:center;padding:8px;font-family:'Courier New';font-size:11px;color:var(--muted)">
        🚧 Ta stran je v gradnji 🚧
      </div>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   OFFICE DAY
   ═══════════════════════════════════════════════════════════ */

function _applyOfficeTheme() {
  document.body.classList.add('theme-office');
}

function _applyOfficeNavLabels() {
  const labels = {
    'Home': 'Dashboard', 'Predikcije': 'Vnos podatkov',
    'Napovedi': 'Skupni pregled', 'Rezultati': 'Poročilo',
    'Lestvica': 'Izobraževanje',  // "Obvezno izobraževanje"
  };
  NP.qsa('.navbar-link').forEach(el => {
    const orig = el.textContent.trim().replace(/^[^\w]+/, '').trim();
    if (labels[orig]) el.textContent = labels[orig];
  });
  // Override leaderboard label specifically per spec
  const lb = NP.qsa('.navbar-link').find(el => el.textContent.includes('Lestvica'));
  if (lb) lb.textContent = 'Obvezno izobraževanje';
}

function _applyOfficeGreeting(p, profile) {
  NP.qsa('[data-slot="office-greeting"]').forEach(el => {
    const name = profile?.display_name ?? 'Sodelavec';
    el.innerHTML = `
      <div style="font-size:.85rem;color:var(--text-mid);padding:10px 16px;background:var(--blue-bg);border-left:3px solid var(--blue);border-radius:var(--radius-sm)">
        ${_esc(p.office_greeting_text ?? `Pozdravljeni, ${name}. Danes je ${new Date().toLocaleDateString('sl-SI')}. Lepo se imejte.`)}
      </div>`;
  });
}

async function _applyOfficeDashboard() {
  // Top 3 = green circles, middle = orange, bottom 3 = red
  const { data } = await NP.db
    .from('leaderboard')
    .select('rank, display_name, total_points')
    .order('rank')
    .limit(25);
  if (!data) return;
  const total = data.length;
  NP.qsa('[data-slot="office-dashboard"]').forEach(el => {
    el.innerHTML = data.map(p => {
      const cls = p.rank <= 3 ? 'green' : p.rank >= total - 2 ? 'red' : 'orange';
      return `
        <div class="lb-row">
          <div class="office-circle ${cls}"></div>
          <div class="lb-rank">${p.rank}</div>
          <div class="lb-name">${_esc(p.display_name)}</div>
          <div class="lb-pts">${p.total_points}</div>
        </div>`;
    }).join('');
  });
}

function _applyOfficeFakePrint() {
  NP.qsa('[data-action="print"], [data-slot="print-btn"]').forEach(btn => {
    btn.addEventListener('click', () => {
      NP.toast('🖨️ Tiskanje v teku... (Napaka: Tiskalnik ni na voljo)', 'error', 5000);
    });
  });
}

function _applyOfficeFakeTeams(p) {
  // Shows a fake Microsoft Teams notification announcing the weekly trivialist
  if (!p.trivialist_name) return;
  setTimeout(() => {
    NP.toast(`📬 Teams: ${p.trivialist_name} je Trivialist tedna! Nagrada: ${p.weekly_prize_label ?? '🎁'} v sobi 8.`, 'info', 8000);
  }, 3000);
}

function _applyOfficeFakeDownload() {
  setTimeout(() => {
    NP.toast('📥 Prenos: Q2_rezultati_FINAL_v3.xlsx (preneseno)', 'info', 5000);
  }, 10000);
}

function _applyOfficeNpsSurvey() {
  NP.qsa('[data-slot="nps-survey"]').forEach(el => {
    el.innerHTML = `
      <div class="card-body" style="font-size:.82rem">
        <div style="font-weight:700;margin-bottom:8px">Kako ste zadovoljni z Napovednika?</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${[1,2,3,4,5,6,7,8,9,10].map(n =>
            `<button onclick="NP.toast('Hvala za oceno ${n}/10!','success')"
              class="btn btn-secondary btn-sm">${n}</button>`
          ).join('')}
        </div>
      </div>`;
  });
}

function _applyOfficeProgressBar() {
  NP.qsa('[data-slot="office-progress"]').forEach(el => {
    el.innerHTML = `
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Letni KPI — Napovedi</div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:73%"></div></div>
        <div class="progress-label">73%</div>
      </div>`;
  });
}

function _applyOfficeUdemyCard() {
  NP.qsa('[data-slot="udemy-card"]').forEach(el => {
    el.innerHTML = `
      <div class="card-body" style="font-size:.82rem;color:var(--text-mid)">
        📚 <strong>Priporočeno izobraževanje:</strong><br>
        "Excel za napredne: VLOOKUP in XLOOKUP" — 4.8 ⭐ · 2h 15min
        <br><br>
        <button class="btn btn-secondary btn-sm" onclick="NP.toast('Dodano v Moja izobraževanja.','success')">
          Dodaj v seznam
        </button>
      </div>`;
  });
}

function _applyOfficeTerms() {
  NP.qsa('[data-slot="office-terms"]').forEach(el => {
    el.innerHTML = `
      <div style="font-size:.68rem;color:var(--muted);line-height:1.5">
        Z uporabo Napovednika 2026 se strinjate s Pogoji uporabe, Politiko zasebnosti
        in Internim pravilnikom o digitalnih orodjih (rev. 2026-01-01).
        Vse napovedi se shranjujejo v skladu z GDPR.
      </div>`;
  });
}

function _applyOfficeExcelSponsor() {
  NP.qsa('[data-slot="excel-sponsor"]').forEach(el => {
    el.innerHTML = `
      <div style="font-size:.72rem;color:var(--muted);text-align:center">
        Podpira: <strong style="color:#217346">Microsoft Excel</strong> 🟩
      </div>`;
  });
}

/* ═══════════════════════════════════════════════════════════
   PRIVATE UTILITIES
   ═══════════════════════════════════════════════════════════ */

/** Escapes HTML entities to prevent XSS */
function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts ISO 3166-1 alpha-2 code to flag emoji.
 * Works by converting each letter to its regional indicator symbol.
 * @param {string} iso2  e.g. 'fr'
 */
function _flagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const base = 0x1F1E6 - 65; // 'A' = 65
  const chars = iso2.toUpperCase().split('');
  return String.fromCodePoint(base + chars[0].charCodeAt(0)) +
         String.fromCodePoint(base + chars[1].charCodeAt(0));
}
