// Oberfläche: Rendering und Bedienung
(function () {
  'use strict';
  var E = window.ENGINE;
  var KEY = 'steilpass-save-v1';
  var S = null;
  var U = { screen: 'title', tab: 'buero', teamTab: 'aufstellung', ligaTab: 'tabelle', ligaView: null, ligaWeek: null,
    mkPos: 'Alle', mkSort: 'str', mkAfford: false, unlocked: -1, sheet: null, konf: null, setup: null };
  var app = document.getElementById('app');
  var sheetEl = document.getElementById('sheet');
  var fm = E.fmtMoney, fn = E.fmtNum;

  // ---------- Speichern ----------
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Speichern fehlgeschlagen'); } }
  function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
  function loadSave() {
    try { var t = localStorage.getItem(KEY); if (t) { S = JSON.parse(t); return true; } } catch (e) { /* kaputter Spielstand */ }
    return false;
  }
  function validSave(x) { return x && x.v === 1 && x.clubs && x.players && x.humans && x.leagues; }
  function exportSave() {
    var name = 'steilpass-' + S.year + '-spieltag' + (S.week + 1) + '.json';
    var text = JSON.stringify(S);
    var blob = new Blob([text], { type: 'application/json' });
    var file = null;
    try { file = new File([blob], name, { type: 'application/json' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Steilpass Spielstand', text: 'Du bist dran! Öffne Steilpass → „Spielstand laden“.' })
        .catch(function () { /* abgebrochen */ });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Spielstand gespeichert: ' + name);
  }
  function importSave() {
    var inp = document.getElementById('file');
    inp.value = '';
    inp.onchange = function () {
      var f = inp.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var x = JSON.parse(rd.result);
          if (!validSave(x)) throw new Error('ungültig');
          S = x; U.unlocked = -1; U.konf = null; closeSheet(); save();
          U.screen = 'game'; render(); toast('Spielstand geladen');
        } catch (e) { toast('Das ist kein gültiger Steilpass-Spielstand.'); }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  // ---------- Helfer ----------
  function h(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function badge(c, big) { return '<span class="badge' + (big ? ' big' : '') + '" style="background:' + c.c1 + ';color:' + c.c2 + '">' + c.short + '</span>'; }
  function bar(v, col) { return '<div class="bar"><i style="width:' + Math.max(2, Math.min(100, v)) + '%;background:' + col + '"></i></div>'; }
  function fitCol(v) { return v >= 75 ? 'var(--green)' : v >= 50 ? 'var(--accent)' : 'var(--red)'; }
  function stars(p) {
    var n = p.pot >= 88 ? 5 : p.pot >= 80 ? 4 : p.pot >= 70 ? 3 : p.pot >= 60 ? 2 : 1;
    return '<span class="stars">' + '★★★★★'.slice(0, n) + '<s>' + '★★★★★'.slice(n) + '</s></span>';
  }
  function toast(t) {
    var el = document.getElementById('toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  function me() { return S.humans[S.turn]; }
  function myClub() { return S.clubs[me().club]; }
  function posText(cid) { return S.week > 0 ? E.position(S, cid) + '.' : '–'; }
  function status(p) {
    var s = '';
    if (p.inj > 0) s += '<span class="tag red">🚑 ' + p.inj + '</span>';
    if (p.sus > 0) s += '<span class="tag red">🟥 ' + p.sus + '</span>';
    if (p.ask > 0) s += '<span class="tag">💲</span>';
    if (p.con <= 1 && p.club >= 0) s += '<span class="tag warn">📄</span>';
    return s;
  }
  function seasonLabel() { return S.year + '/' + String(S.year + 1).slice(2); }
  function pl(id) { return S.players[id]; }
  function nm(id) { var p = pl(id); return p ? E.pname(p) : '?'; }

  // ---------- Hauptrender ----------
  function render() {
    var html;
    if (U.screen === 'title' || !S) html = U.screen === 'setup' ? renderSetup() : renderTitle();
    else if (S.phase === 'konferenz') html = renderKonferenz();
    else if (S.phase === 'summary') html = renderSummary();
    else if (S.phase === 'season') html = renderSeason();
    else if (S.humans.length > 1 && U.unlocked !== S.turn) html = renderHandover();
    else html = renderGame();
    app.innerHTML = html;
    if (U.sheet) renderSheet();
  }

  // ---------- Titel ----------
  function renderTitle() {
    var cont = hasSave();
    return '<div class="title-screen">' +
      '<div class="logo"><div class="ball">⚽</div><h1>STEILPASS</h1><p>Der Fußballmanager für dich und deine Freunde</p></div>' +
      '<div class="menu">' +
      (cont ? '<button class="btn primary big" data-a="continue">▶ Weiterspielen</button>' : '') +
      '<button class="btn ' + (cont ? '' : 'primary ') + 'big" data-a="newGame">Neues Spiel</button>' +
      '<button class="btn big" data-a="import">📂 Spielstand laden</button>' +
      '<button class="btn ghost" data-a="help">So wird gespielt</button>' +
      '</div><p class="foot">Inspiriert von den Klassikern der 90er. Alle Vereine und Spieler sind frei erfunden.</p></div>';
  }

  function renderSetup() {
    var st = U.setup;
    if (st.step === 1) {
      var rows = '';
      for (var i = 0; i < st.n; i++) {
        rows += '<label class="field"><span>Manager ' + (i + 1) + '</span><input data-name="' + i + '" maxlength="16" value="' + h(st.names[i] || '') + '" placeholder="Name"></label>';
      }
      return '<div class="page setup"><h2>Neues Spiel</h2><p class="muted">Wie viele Manager spielen mit? Ihr reicht das Handy nach jedem Zug weiter – oder schickt euch den Spielstand per Messenger.</p>' +
        '<div class="chips">' + [1, 2, 3, 4].map(function (n) { return '<button class="chip' + (st.n === n ? ' on' : '') + '" data-a="setupN" data-n="' + n + '">' + n + ' Spieler</button>'; }).join('') + '</div>' +
        rows + '<div class="row gap"><button class="btn" data-a="toTitle">Zurück</button><button class="btn primary grow" data-a="setupNext">Weiter: Vereine wählen</button></div></div>';
    }
    var cur = st.pick, taken = st.clubs;
    var list = DATA.leagues[st.league].clubs.map(function (cd, i) {
      var cid = st.league * 18 + i, rep = cd[4];
      var tk = taken.indexOf(cid);
      var diff = rep >= 80 || (st.league === 1 && rep >= 58) ? 'Favorit' : rep >= 68 || (st.league === 1 && rep >= 52) ? 'Mittelfeld' : 'Außenseiter';
      var c = { c1: cd[2], c2: cd[3], short: cd[1] };
      return '<button class="clubpick' + (tk >= 0 ? ' taken' : '') + '" data-a="pickClub" data-c="' + cid + '"' + (tk >= 0 && tk !== cur ? ' disabled' : '') + '>' +
        badge(c) + '<span class="grow"><b>' + h(cd[0]) + '</b><small>' + diff + (tk >= 0 ? ' · ' + h(st.names[tk]) : '') + '</small></span><span class="rep">' + bar((rep - 40) * 1.8, 'var(--accent)') + '</span></button>';
    }).join('');
    return '<div class="page setup"><h2>' + h(st.names[cur]) + ', wähle deinen Verein</h2>' +
      '<p class="muted">Kleiner Verein = mehr Herausforderung. In der 2. Liga startest du mit wenig Geld, aber geringen Erwartungen.</p>' +
      '<div class="chips">' + [0, 1].map(function (l) { return '<button class="chip' + (st.league === l ? ' on' : '') + '" data-a="setupLeague" data-l="' + l + '">' + DATA.leagues[l].name + '</button>'; }).join('') + '</div>' +
      '<div class="list">' + list + '</div>' +
      '<div class="row gap sticky-bottom"><button class="btn" data-a="setupBack">Zurück</button></div></div>';
  }

  // ---------- Übergabe ----------
  function renderHandover() {
    var hm = me(), c = S.clubs[hm.club];
    return '<div class="handover"><div class="phone">📱</div><p class="muted">Spieltag ' + (S.week + 1) + ' · Saison ' + seasonLabel() + '</p>' +
      '<h2>Übergib das Handy an</h2><div class="who">' + h(hm.name) + '</div><div class="row center">' + badge(c, true) + '<b>' + h(c.name) + '</b></div>' +
      '<button class="btn primary big" data-a="unlock">Ich bin ' + h(hm.name) + ' – los geht\'s!</button>' +
      '<div class="fern"><p class="muted small">Spielt ihr nicht am selben Handy? Schick den Spielstand an ' + h(hm.name) + ' – er/sie öffnet ihn über „Spielstand laden“.</p>' +
      '<button class="btn ghost" data-a="export">📤 Spielstand senden</button> <button class="btn ghost" data-a="toTitle">Hauptmenü</button></div></div>';
  }

  // ---------- Manager-Ansicht ----------
  var TABS = [['buero', '🏢', 'Büro'], ['team', '👕', 'Team'], ['markt', '💶', 'Transfers'], ['finanzen', '📊', 'Finanzen'], ['liga', '🏆', 'Liga']];
  function renderGame() {
    var c = myClub(), hm = me();
    var unread = hm.inbox.filter(function (m) { return !m.done; }).length;
    var head = '<header class="top" style="--club:' + c.c1 + '">' + badge(c) +
      '<div class="grow"><b>' + h(c.name) + '</b><small>' + h(hm.name) + ' · ' + S.leagues[c.league].name + ' · Spieltag ' + (S.week + 1) + '/34</small></div>' +
      '<div class="money ' + (c.money < 0 ? 'neg' : '') + '">' + fm(c.money) + '</div>' +
      '<button class="icon" data-a="menu" aria-label="Menü">☰</button></header>';
    var body = { buero: tabBuero, team: tabTeam, markt: tabMarkt, finanzen: tabFinanzen, liga: tabLiga }[U.tab]();
    var nav = '<nav class="tabs">' + TABS.map(function (t) {
      return '<button class="' + (U.tab === t[0] ? 'on' : '') + '" data-a="tab" data-t="' + t[0] + '"><span>' + t[1] + '</span>' + t[2] +
        (t[0] === 'buero' && unread ? '<em>' + unread + '</em>' : '') + '</button>';
    }).join('') + '</nav>';
    var end = '<button class="endturn" data-a="endTurn">Zug beenden ▶</button>';
    return head + '<main class="page">' + body + '</main>' + end + nav;
  }

  // Büro
  function tabBuero() {
    var c = myClub(), hm = me(), out = '';
    var nmx = E.nextMatch(S, c.id);
    if (nmx) {
      var o = S.clubs[nmx.opp];
      out += '<section class="card next"><div class="label">Nächstes Spiel · Spieltag ' + (S.week + 1) + '</div><div class="vs">' +
        '<div>' + badge(nmx.home ? c : o, true) + '<b>' + h((nmx.home ? c : o).short) + '</b><small>Platz ' + posText(nmx.home ? c.id : o.id) + '</small></div>' +
        '<div class="vstext">' + (nmx.home ? 'HEIM' : 'AUSWÄRTS') + '</div>' +
        '<div>' + badge(nmx.home ? o : c, true) + '<b>' + h((nmx.home ? o : c).short) + '</b><small>Platz ' + posText(nmx.home ? o.id : c.id) + '</small></div></div>' +
        '<div class="cmp"><span>Stärke ' + E.teamStrength(S, c.id) + '</span><span>' + h(o.name) + ': ' + E.teamStrength(S, o.id) + '</span></div></section>';
    }
    // Aufstellungsprobleme
    var bad = c.lineup.filter(function (id) { var p = id != null ? pl(id) : null; return !p || p.club !== c.id || !E.available(p); }).length;
    if (bad) out += '<section class="card warnbox"><b>⚠️ Aufstellung unvollständig</b><p>' + bad + ' Position(en) sind nicht (einsatzfähig) besetzt.</p><button class="btn small" data-a="repair">Automatisch ersetzen</button> <button class="btn small ghost" data-a="tab" data-t="team">Zur Aufstellung</button></section>';
    // Vorstand
    out += '<section class="card"><div class="label">Vorstand</div><div class="row"><span class="grow">Vertrauen</span><b>' + c.board + ' %</b></div>' +
      bar(c.board, c.board > 50 ? 'var(--green)' : c.board > 25 ? 'var(--accent)' : 'var(--red)') +
      '<div class="row mt"><span class="grow muted">Saisonziel</span><span>' + h(c.goal.text) + '</span></div>' +
      '<div class="row"><span class="grow muted">Tabellenplatz</span><span>' + posText(c.id) + '</span></div></section>';
    // Letztes Spiel
    if (S.last && S.last.season === S.season && S.last.week === S.week - 1) {
      var lm = S.last.matches.filter(function (m) { return m.h === c.id || m.a === c.id; })[0];
      if (lm) out += '<section class="card"><div class="label">Letztes Spiel</div>' + matchReport(lm) + '</section>';
    }
    // Posteingang
    out += '<section class="card"><div class="label">Posteingang</div>';
    if (!hm.inbox.length) out += '<p class="muted">Keine Nachrichten.</p>';
    hm.inbox.slice(0, 15).forEach(function (m) {
      out += '<div class="msg' + (m.done ? '' : ' open') + '"><div class="row"><b class="grow">' + h(m.title) + '</b><small class="muted">' + (m.s === S.season ? 'ST ' + (m.w + 1) : 'Vorsaison') + '</small></div><p>' + h(m.text) + '</p>';
      if (m.choices && !m.done) out += '<div class="choices">' + m.choices.map(function (ch, i) { return '<button class="btn small" data-a="choice" data-m="' + m.id + '" data-i="' + i + '">' + h(ch.label) + '</button>'; }).join('') + '</div>';
      if (m.choices && m.done) out += '<p class="result">➜ ' + h(m.choices[m.picked].label) + (m.result ? ' · ' + h(m.result) : '') + '</p>';
      out += '</div>';
    });
    out += '</section>';
    return out;
  }
  function matchReport(m) {
    var hc = S.clubs[m.h], ac = S.clubs[m.a];
    var ev = m.ev.filter(function (e) { return e.t === 'G' || e.t === 'R' || e.t === 'I'; }).map(function (e) {
      var ic = e.t === 'G' ? '⚽' : e.t === 'R' ? '🟥' : '🚑';
      return '<li class="' + (e.s ? 'away' : 'home') + '">' + ic + ' ' + e.m + '\' ' + h(nm(e.p)) + (e.t === 'G' ? ' (' + e.sc + ')' : '') + '</li>';
    }).join('');
    return '<div class="score">' + badge(hc) + ' <b>' + m.hg + ' : ' + m.ag + '</b> ' + badge(ac) + '</div><ul class="events">' + ev + '</ul><p class="muted small center">' + fn(m.att) + ' Zuschauer</p>';
  }

  // Team
  function tabTeam() {
    var sub = [['aufstellung', 'Aufstellung'], ['kader', 'Kader'], ['training', 'Training']];
    var out = '<div class="chips seg">' + sub.map(function (s) { return '<button class="chip' + (U.teamTab === s[0] ? ' on' : '') + '" data-a="teamTab" data-t="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (U.teamTab === 'aufstellung') out += teamLineup();
    else if (U.teamTab === 'kader') out += teamSquad();
    else out += teamTraining();
    return out;
  }
  function lineRatings(c) {
    var slots = E.slotsFor(c.formation), sum = { TW: 0, AB: 0, MF: 0, ST: 0 }, cnt = { TW: 0, AB: 0, MF: 0, ST: 0 };
    c.lineup.forEach(function (id, i) { var p = id != null ? pl(id) : null; cnt[slots[i]]++; if (p) sum[slots[i]] += E.effStr(p, slots[i]); });
    var r = {}; Object.keys(sum).forEach(function (k) { r[k] = cnt[k] ? Math.round(sum[k] / cnt[k]) : 0; });
    return r;
  }
  function teamLineup() {
    var c = myClub(), slots = E.slotsFor(c.formation);
    var out = '<section class="card"><div class="label">Formation</div><div class="chips">' + Object.keys(E.FORMATIONS).map(function (f) {
      return '<button class="chip' + (c.formation === f ? ' on' : '') + '" data-a="formation" data-f="' + f + '">' + f + '</button>';
    }).join('') + '</div>' +
      '<div class="label mt">Einsatz</div><div class="chips seg">' + ['normal', 'hart', 'brutal'].map(function (x) {
        return '<button class="chip' + (c.tactic.einsatz === x ? ' on' : '') + '" data-a="einsatz" data-v="' + x + '">' + x[0].toUpperCase() + x.slice(1) + '</button>';
      }).join('') + '</div>' +
      '<div class="label mt">Ausrichtung</div><div class="chips seg">' + ['defensiv', 'normal', 'offensiv'].map(function (x) {
        return '<button class="chip' + (c.tactic.ausr === x ? ' on' : '') + '" data-a="ausr" data-v="' + x + '">' + x[0].toUpperCase() + x.slice(1) + '</button>';
      }).join('') + '</div><p class="muted small">Härter = etwas stärker, aber mehr Karten, Verletzungen beim Gegner und müdere Beine.</p></section>';
    var r = lineRatings(c);
    out += '<div class="ratings"><span>TW <b>' + r.TW + '</b></span><span>Abwehr <b>' + r.AB + '</b></span><span>Mittelfeld <b>' + r.MF + '</b></span><span>Sturm <b>' + r.ST + '</b></span></div>';
    // Spielfeld: Reihen von oben (Sturm) nach unten (Tor)
    var rows = { ST: [], MF: [], AB: [], TW: [] };
    slots.forEach(function (sp, i) { rows[sp].push(i); });
    out += '<div class="pitch">' + ['ST', 'MF', 'AB', 'TW'].map(function (sp) {
      return '<div class="prow">' + rows[sp].map(function (i) {
        var p = c.lineup[i] != null ? pl(c.lineup[i]) : null;
        var bad = !p || p.club !== c.id || !E.available(p);
        if (!p || p.club !== c.id) return '<button class="slot empty" data-a="slot" data-i="' + i + '"><span class="shirt">+</span><small>' + sp + '</small></button>';
        var e = Math.round(E.effStr(p, sp));
        return '<button class="slot' + (bad ? ' bad' : '') + (p.pos !== sp ? ' off' : '') + '" data-a="slot" data-i="' + i + '"><span class="shirt" style="background:' + c.c1 + ';color:' + c.c2 + '">' + e + '</span>' +
          '<small>' + h(p.ln) + '</small>' + bar(p.fit, fitCol(p.fit)) + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
    out += '<div class="row gap"><button class="btn grow" data-a="autoLineup">⚡ Auto-Aufstellung</button></div>';
    var bench = E.squad(S, c.id).filter(function (p) { return c.lineup.indexOf(p.id) < 0; }).sort(sortPos);
    out += '<section class="card"><div class="label">Nicht in der Startelf (' + bench.length + ')</div>' + playerRows(bench) + '</section>';
    return out;
  }
  var PO = { TW: 0, AB: 1, MF: 2, ST: 3 };
  function sortPos(a, b) { return PO[a.pos] - PO[b.pos] || b.str - a.str; }
  function playerRows(list, opts) {
    opts = opts || {};
    if (!list.length) return '<p class="muted">Keine Spieler.</p>';
    return '<div class="plist">' + list.map(function (p) {
      var right = opts.price ? '<span class="price">' + fm(opts.price(p)) + '</span>' : bar(p.fit, fitCol(p.fit));
      return '<button class="prow2" data-a="player" data-p="' + p.id + '"><span class="pos ' + p.pos + '">' + p.pos + '</span>' +
        '<span class="grow"><b>' + h(E.fullName(p)) + '</b> ' + status(p) + '<small>' + p.age + ' J.' + (opts.club ? ' · ' + h(p.club >= 0 ? S.clubs[p.club].short : 'vereinslos') : ' · Moral ' + Math.round(p.mor)) + '</small></span>' +
        '<span class="str">' + p.str + '</span><span class="rt">' + right + '</span></button>';
    }).join('') + '</div>';
  }
  function teamSquad() {
    var c = myClub(), sq = E.squad(S, c.id).sort(sortPos);
    var sal = sq.reduce(function (a, p) { return a + p.sal; }, 0);
    return '<p class="muted small">' + sq.length + '/' + E.MAX_SQUAD + ' Spieler · Gehälter ' + fm(sal) + '/Saison · Tippe auf einen Spieler für Details.</p>' +
      '<div class="legend"><span>Pos</span><span class="grow">Name</span><span>Stärke</span><span>Frische</span></div>' + playerRows(sq);
  }
  function teamTraining() {
    var c = myClub();
    return '<p class="muted">Das Training wirkt jede Woche auf Frische, Moral und die Entwicklung junger Spieler.</p>' +
      Object.keys(E.TRAINING).map(function (k) {
        var t = E.TRAINING[k];
        return '<button class="card option' + (c.training === k ? ' on' : '') + '" data-a="training" data-t="' + k + '"><b>' + t.name + '</b><p>' + t.desc + '</p>' +
          '<small>Frische +' + t.fit + ' · Entwicklung ×' + t.grow + (t.mor ? ' · Moral ' + (t.mor > 0 ? '+' : '') + t.mor : '') + '</small></button>';
      }).join('');
  }

  // Transfers
  function tabMarkt() {
    var c = myClub();
    var list = E.marketList(S).filter(function (p) {
      if (p.club === c.id) return false;
      if (p.club >= 0 && S.clubs[p.club].human >= 0) return false;
      if (U.mkPos !== 'Alle' && p.pos !== U.mkPos) return false;
      if (U.mkAfford && priceOf(p) > c.money) return false;
      return true;
    });
    var sorter = { str: function (a, b) { return b.str - a.str; }, price: function (a, b) { return priceOf(a) - priceOf(b); }, age: function (a, b) { return a.age - b.age; } }[U.mkSort];
    list.sort(sorter);
    var mine = E.squad(S, c.id).filter(function (p) { return p.ask > 0; });
    var out = '<div class="chips">' + ['Alle', 'TW', 'AB', 'MF', 'ST'].map(function (x) { return '<button class="chip' + (U.mkPos === x ? ' on' : '') + '" data-a="mkPos" data-v="' + x + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="chips">' + [['str', 'Stärke'], ['price', 'Preis'], ['age', 'Alter']].map(function (x) { return '<button class="chip' + (U.mkSort === x[0] ? ' on' : '') + '" data-a="mkSort" data-v="' + x[0] + '">↓ ' + x[1] + '</button>'; }).join('') +
      '<button class="chip' + (U.mkAfford ? ' on' : '') + '" data-a="mkAfford">nur bezahlbar</button></div>';
    if (mine.length) out += '<section class="card"><div class="label">Deine Angebote auf dem Markt</div>' + playerRows(mine, { price: function (p) { return p.ask; } }) + '</section>';
    out += '<p class="muted small">' + list.length + ' Spieler auf dem Markt. Preise: Ablöse bzw. Handgeld bei Vereinslosen. Tipp: Über die Tabelle kannst du auch Spieler anderer Vereine anfragen.</p>' +
      playerRows(list.slice(0, 80), { price: priceOf, club: true });
    return out;
  }
  function priceOf(p) { return p.club < 0 ? E.signFee(p) : E.askingPrice(S, p); }

  // Finanzen
  function tabFinanzen() {
    var c = myClub();
    var cats = [['tickets', 'Zuschauer'], ['tv', 'TV-Gelder'], ['sponsor', 'Sponsor'], ['praemie', 'Prämien'], ['transfer', 'Transfers'], ['gehalt', 'Gehälter'], ['stadion', 'Stadion'], ['sonstiges', 'Sonstiges']];
    function tbl(f) {
      var sum = 0;
      var rows = cats.map(function (k) { var v = f[k[0]] || 0; sum += v; return v ? '<tr><td>' + k[1] + '</td><td class="' + (v < 0 ? 'neg' : 'pos') + '">' + fm(v) + '</td></tr>' : ''; }).join('');
      return '<table class="fin">' + (rows || '<tr><td class="muted">Noch keine Buchungen</td><td></td></tr>') + '<tr class="sum"><td>Saldo</td><td class="' + (sum < 0 ? 'neg' : 'pos') + '">' + fm(sum) + '</td></tr></table>';
    }
    var nmx = E.nextMatch(S, c.id);
    var opp = nmx ? S.clubs[nmx.opp] : { rep: 60 };
    var att = E.attendance(S, c, opp);
    var sal = E.squad(S, c.id).reduce(function (a, p) { return a + p.sal; }, 0);
    var out = '<section class="card big-money"><div class="label">Kontostand</div><div class="' + (c.money < 0 ? 'neg' : '') + '">' + fm(c.money) + '</div>' +
      '<small class="muted">Gehälter ' + fm(sal) + '/Saison · Sponsor ' + fm(c.sponsor) + '/Spieltag</small></section>';
    out += '<section class="card"><div class="label">Letzter Spieltag</div>' + tbl(c.fin.last) + '</section>';
    out += '<section class="card"><div class="label">Saison ' + seasonLabel() + '</div>' + tbl(c.fin.season) + '</section>';
    out += '<section class="card"><div class="label">Stadion & Eintritt</div>' +
      '<div class="row"><span class="grow">Kapazität</span><b>' + fn(c.stadium.cap) + '</b></div>' +
      '<div class="row"><span class="grow">Fans</span><b>' + fn(c.fans) + '</b></div>' +
      '<div class="row mt"><span class="grow">Eintrittspreis</span><button class="btn small" data-a="price" data-d="-1">−</button><b class="pricev">' + c.stadium.price + ' €</b><button class="btn small" data-a="price" data-d="1">+</button></div>' +
      '<p class="muted small">Prognose ' + (nmx && nmx.home ? 'nächstes Heimspiel' : 'Heimspiel') + ': ' + fn(att) + ' Zuschauer → ' + fm(att * c.stadium.price) + '</p>';
    if (c.stadium.build) out += '<p class="warnline">🏗️ Ausbau +' + fn(c.stadium.build.add) + ' Plätze – fertig in ' + c.stadium.build.weeks + ' Spieltag(en)</p>';
    else out += '<div class="label mt">Stadion ausbauen</div>' + E.STADIUM_BUILD.map(function (b, i) {
      return '<button class="btn block" data-a="build" data-i="' + i + '"' + (c.money < b.cost ? ' disabled' : '') + '>+' + fn(b.add) + ' Plätze · ' + fm(b.cost) + ' · ' + b.weeks + ' Spieltage</button>';
    }).join('');
    out += '</section>';
    return out;
  }

  // Liga
  function tabLiga() {
    var c = myClub();
    if (U.ligaView == null) U.ligaView = c.league;
    var li = U.ligaView;
    var out = '<div class="chips">' + S.leagues.map(function (L, i) { return '<button class="chip' + (li === i ? ' on' : '') + '" data-a="ligaView" data-l="' + i + '">' + L.name + '</button>'; }).join('') + '</div>' +
      '<div class="chips seg">' + [['tabelle', 'Tabelle'], ['spieltag', 'Spieltage'], ['tore', 'Torjäger']].map(function (s) { return '<button class="chip' + (U.ligaTab === s[0] ? ' on' : '') + '" data-a="ligaTab" data-t="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    if (U.ligaTab === 'tabelle') out += tableHtml(li, true);
    else if (U.ligaTab === 'spieltag') {
      var L = S.leagues[li];
      if (U.ligaWeek == null) U.ligaWeek = Math.max(0, Math.min(33, S.week - (L.results[S.week] ? 0 : 1)));
      var w = U.ligaWeek, res = L.results[w];
      out += '<div class="row center gap"><button class="btn small" data-a="ligaWeek" data-d="-1">‹</button><b>Spieltag ' + (w + 1) + '</b><button class="btn small" data-a="ligaWeek" data-d="1">›</button></div><div class="fixtures">';
      L.fixtures[w].forEach(function (m, i) {
        var r = res ? res[i] : null, hc = S.clubs[m[0]], ac = S.clubs[m[1]];
        out += '<div class="fx' + (hc.human >= 0 || ac.human >= 0 ? ' mine' : '') + '"><span class="t r">' + h(hc.name) + '</span>' + '<b>' + (r ? r.hg + ':' + r.ag : '–:–') + '</b><span class="t">' + h(ac.name) + '</span></div>';
      });
      out += '</div>';
    } else {
      var ps = [];
      S.leagues[li].clubs.forEach(function (cid) { E.squad(S, cid).forEach(function (p) { if (p.goals) ps.push(p); }); });
      ps.sort(function (a, b) { return b.goals - a.goals || a.apps - b.apps; });
      out += '<div class="plist">' + ps.slice(0, 20).map(function (p, i) {
        return '<button class="prow2" data-a="player" data-p="' + p.id + '"><span class="rank">' + (i + 1) + '.</span><span class="grow"><b>' + h(E.fullName(p)) + '</b><small>' + h(S.clubs[p.club].name) + '</small></span><span class="str">' + p.goals + '</span></button>';
      }).join('') + '</div>' + (ps.length ? '' : '<p class="muted">Noch keine Tore gefallen.</p>');
    }
    return out;
  }
  function tableHtml(li, clickable, hl) {
    var t = E.table(S, li);
    return '<table class="tbl"><tr><th>#</th><th class="l">Verein</th><th>Sp</th><th>Diff</th><th>Pkt</th></tr>' + t.map(function (r, i) {
      var c = S.clubs[r.cid];
      var zone = li === 0 ? (i >= 15 ? 'down' : i === 0 ? 'champ' : '') : (i < 3 ? 'up' : '');
      return '<tr class="' + zone + (c.human >= 0 ? ' mine' : '') + (hl && hl.indexOf(r.cid) >= 0 ? ' hl' : '') + '"' + (clickable ? ' data-a="club" data-c="' + c.id + '"' : '') + '><td>' + (i + 1) + '</td><td class="l">' + badge(c) + ' ' + h(c.name) +
        (c.human >= 0 ? ' <small>(' + h(S.humans[c.human].name) + ')</small>' : '') + '</td><td>' + r.sp + '</td><td>' + (r.tg - r.gt > 0 ? '+' : '') + (r.tg - r.gt) + '</td><td><b>' + r.pts + '</b></td></tr>';
    }).join('') + '</table>';
  }

  // ---------- Bottom-Sheets ----------
  function openSheet(s) { U.sheet = s; renderSheet(); }
  function closeSheet() { U.sheet = null; sheetEl.className = 'sheet-wrap'; sheetEl.innerHTML = ''; }
  function renderSheet() {
    var s = U.sheet, html = '';
    if (s.type === 'player') html = sheetPlayer(s.id);
    else if (s.type === 'slot') html = sheetSlot(s.i);
    else if (s.type === 'club') html = sheetClub(s.id);
    else if (s.type === 'menu') html = sheetMenu();
    else if (s.type === 'help') html = sheetHelp();
    else if (s.type === 'confirm') html = '<h3>' + h(s.title) + '</h3><p>' + h(s.text) + '</p><div class="row gap"><button class="btn grow" data-a="closeSheet">Abbrechen</button><button class="btn primary grow" data-a="confirmYes">' + h(s.yes || 'OK') + '</button></div>';
    if (!html) { closeSheet(); return; }
    sheetEl.className = 'sheet-wrap open';
    sheetEl.innerHTML = '<div class="backdrop" data-a="closeSheet"></div><div class="sheet"><button class="x" data-a="closeSheet" aria-label="Schließen">✕</button>' + html + '</div>';
  }
  function sheetPlayer(id) {
    var p = pl(id);
    if (!p) return '';
    var c = myClub(), own = p.club === c.id;
    var cl = p.club >= 0 ? S.clubs[p.club] : null;
    var out = '<div class="phead"><span class="pos big ' + p.pos + '">' + p.pos + '</span><div><h3>' + h(E.fullName(p)) + '</h3><small>' + E.POS_NAME[p.pos] + ' · ' + p.age + ' Jahre · ' + (cl ? h(cl.name) : 'vereinslos') + '</small></div></div>' +
      '<div class="stats"><div><b>' + p.str + '</b><small>Stärke</small></div><div>' + stars(p) + '<small>Talent</small></div><div><b>' + Math.round(p.fit) + '</b><small>Frische</small></div><div><b>' + Math.round(p.mor) + '</b><small>Moral</small></div></div>' +
      '<table class="fin"><tr><td>Marktwert</td><td>' + fm(E.value(p)) + '</td></tr>' +
      (p.club >= 0 ? '<tr><td>Gehalt</td><td>' + fm(p.sal) + '/Saison</td></tr><tr><td>Vertrag</td><td>' + p.con + ' Jahr(e)</td></tr>' : '') +
      '<tr><td>Saison</td><td>' + p.apps + ' Spiele · ' + p.goals + ' Tore</td></tr>' +
      (p.inj > 0 ? '<tr><td>Verletzt</td><td class="neg">' + p.inj + ' Woche(n)</td></tr>' : '') +
      (p.sus > 0 ? '<tr><td>Gesperrt</td><td class="neg">' + p.sus + ' Spiel(e)</td></tr>' : '') + '</table>';
    if (own) {
      out += '<div class="label mt">Transfermarkt</div>';
      if (p.ask) out += '<p>Auf der Liste für <b>' + fm(p.ask) + '</b>.</p><button class="btn block" data-a="unlist" data-p="' + p.id + '">Von der Transferliste nehmen</button>';
      else out += '<div class="chips">' + [1, 1.2, 1.5].map(function (f) { return '<button class="chip" data-a="list" data-p="' + p.id + '" data-f="' + f + '">Anbieten für ' + fm(Math.round(E.value(p) * f)) + '</button>'; }).join('') + '</div>' +
        '<p class="muted small">Je höher der Preis, desto länger dauert es, bis ein Verein zuschlägt.</p>';
      var ext = E.extendOffer(S, p);
      out += '<div class="col gap mt"><button class="btn block" data-a="extend" data-p="' + p.id + '">📄 Vertrag +' + ext.years + ' J. verlängern (Gehalt ' + fm(ext.sal) + ')</button>' +
        '<button class="btn block" data-a="quickSell" data-p="' + p.id + '">💨 Sofort verkaufen für ' + fm(Math.round(E.value(p) * 0.7)) + '</button>' +
        '<button class="btn block danger" data-a="release" data-p="' + p.id + '">Entlassen (Abfindung ' + fm(Math.round(p.sal * p.con * 0.5)) + ')</button></div>';
    } else if (p.club >= 0 && cl.human >= 0) {
      out += '<p class="muted mt">Dieser Spieler gehört deinem Mitspieler ' + h(S.humans[cl.human].name) + '.</p>';
    } else if (p.club < 0) {
      out += '<div class="label mt">Verpflichten</div><p>Handgeld <b>' + fm(E.signFee(p)) + '</b>, Gehaltsforderung <b>' + fm(E.demandSalary(p)) + '</b>/Saison, Vertrag ' + (p.age >= 32 ? 1 : 3) + ' Jahr(e).</p>' +
        '<button class="btn primary block" data-a="offer" data-p="' + p.id + '" data-v="0">Verpflichten</button>';
    } else {
      var ask = E.askingPrice(S, p);
      out += '<div class="label mt">Angebot abgeben</div><p>' + h(cl.name) + ' verlangt ca. <b>' + fm(ask) + '</b>' + (p.ask ? ' (auf der Transferliste)' : ' (nicht auf der Liste)') +
        '. Gehaltsforderung: ' + fm(E.demandSalary(p)) + '/Saison.</p><div class="chips">' + [0.8, 0.9, 1, 1.1].map(function (f) {
          var v = Math.round(ask * f / 10000) * 10000;
          return '<button class="chip" data-a="offer" data-p="' + p.id + '" data-v="' + v + '">' + fm(v) + '</button>';
        }).join('') + '</div><p class="muted small">Unter Preis kann klappen – oder der Verein ist beleidigt und verhandelt diese Woche nicht mehr.</p>';
    }
    return out;
  }
  function sheetSlot(i) {
    var c = myClub(), sp = E.slotsFor(c.formation)[i];
    var cur = c.lineup[i];
    var list = E.squad(S, c.id).sort(function (a, b) { return E.effStr(b, sp) - E.effStr(a, sp); });
    return '<h3>Position: ' + E.POS_NAME[sp] + '</h3><p class="muted small">Zahl = Stärke auf dieser Position (inkl. Frische & Moral).</p><div class="plist">' + list.map(function (p) {
      var inL = c.lineup.indexOf(p.id);
      var dis = !E.available(p);
      return '<button class="prow2' + (p.id === cur ? ' sel' : '') + '" data-a="setSlot" data-i="' + i + '" data-p="' + p.id + '"' + (dis ? ' disabled' : '') + '><span class="pos ' + p.pos + '">' + p.pos + '</span>' +
        '<span class="grow"><b>' + h(E.fullName(p)) + '</b> ' + status(p) + '<small>' + (inL >= 0 ? 'Startelf' : 'Bank') + ' · Frische ' + Math.round(p.fit) + '</small></span><span class="str">' + Math.round(E.effStr(p, sp)) + '</span></button>';
    }).join('') + '</div>' + (cur != null ? '<button class="btn block mt" data-a="setSlot" data-i="' + i + '" data-p="">Position leeren</button>' : '');
  }
  function sheetClub(id) {
    var c = S.clubs[id];
    var sq = E.squad(S, id).sort(sortPos);
    return '<div class="phead">' + badge(c, true) + '<div><h3>' + h(c.name) + '</h3><small>' + S.leagues[c.league].name + ' · Platz ' + posText(id) + ' · Stärke ' + E.teamStrength(S, id) +
      (c.human >= 0 ? ' · Manager: ' + h(S.humans[c.human].name) : '') + '</small></div></div>' +
      '<p class="muted small">Stadion ' + fn(c.stadium.cap) + ' · Formation ' + c.formation + '</p>' + playerRows(sq);
  }
  function sheetMenu() {
    return '<h3>Menü</h3><div class="col gap"><button class="btn block" data-a="export">📤 Spielstand teilen / sichern</button>' +
      '<button class="btn block" data-a="import">📂 Spielstand laden</button>' +
      '<button class="btn block" data-a="help">❓ So wird gespielt</button>' +
      '<button class="btn block" data-a="toTitle">🏠 Hauptmenü</button></div><p class="muted small mt">Das Spiel speichert automatisch auf diesem Gerät.</p>';
  }
  function sheetHelp() {
    return '<h3>So wird gespielt</h3><div class="help">' +
      '<p><b>Ziel:</b> Führe deinen Verein zum Erfolg, erfülle das Saisonziel und halte den Vorstand bei Laune. Fällt sein Vertrauen auf 0 %, fliegst du raus – und musst dich bei einem kleinen Zweitligisten neu beweisen.</p>' +
      '<p><b>Ein Zug = eine Woche.</b> Stelle deine Mannschaft auf, wähle Taktik und Training, kaufe und verkaufe Spieler, beantworte die Post. Dann „Zug beenden“.</p>' +
      '<p><b>Mit Freunden:</b> Bis zu 4 Manager. Wenn alle ihren Zug beendet haben, läuft der Spieltag als Live-Konferenz. Am selben Handy einfach weiterreichen. Auf verschiedenen Handys: Spielstand über „Spielstand senden“ (z.&nbsp;B. per WhatsApp) an den nächsten Manager schicken – der lädt ihn, macht seinen Zug und schickt weiter.</p>' +
      '<p><b>Aufstellung:</b> Spieler auf fremden Positionen sind schwächer (rot umrandet). Müde Spieler (Frische) bringen weniger Leistung und verletzen sich öfter.</p>' +
      '<p><b>Einsatz:</b> „Hart“ und „Brutal“ machen dein Team stärker, bringen aber Karten und Sperren.</p>' +
      '<p><b>Geld:</b> Einnahmen aus Zuschauern, TV und Sponsor. Der Eintrittspreis bestimmt die Zuschauerzahl. Gehälter werden jeden Spieltag fällig.</p>' +
      '<p><b>Saisonende:</b> Die letzten 3 der 1. Liga steigen ab, die ersten 3 der 2. Liga auf. Spieler altern, Verträge laufen aus – verlängere rechtzeitig!</p></div>';
  }

  // ---------- Konferenz ----------
  function konfMatches() {
    var leagues = {};
    S.humans.forEach(function (hm) { leagues[S.clubs[hm.club].league] = 1; });
    // Liga laut Ergebnis (Vereinswechsel nach Entlassung möglich)
    return S.last.matches.filter(function (m) { return leagues[m.li] || S.clubs[m.h].human >= 0 || S.clubs[m.a].human >= 0; });
  }
  function startKonf() {
    if (U.konf && U.konf.key === S.season * 100 + S.week) return;
    stopKonf();
    U.konf = { key: S.season * 100 + S.week, min: 0, speed: 1, timer: null };
    tickKonf();
  }
  function tickKonf() {
    var k = U.konf;
    clearTimeout(k.timer);
    if (k.min >= 95) return;
    k.timer = setTimeout(function () {
      k.min++;
      if (k.min === 46 && k.speed < 10) { k.pause = true; }
      render();
      if (k.pause) { k.pause = false; k.timer = setTimeout(tickKonf, 1200 / k.speed); } else tickKonf();
    }, 230 / k.speed);
  }
  function stopKonf() { if (U.konf) clearTimeout(U.konf.timer); }
  function evText(e, m) {
    var club = S.clubs[e.s ? m.a : m.h];
    var v = (e.m + (e.p || 0)) % 4;
    switch (e.t) {
      case 'G': return ['TOOOR für ' + club.name + '! ' + nm(e.p) + ' trifft zum ' + e.sc + '.', nm(e.p) + ' netzt eiskalt ein – ' + e.sc + ' für ' + club.short + '!',
        'Was für ein Hammer von ' + nm(e.p) + '! ' + e.sc + '.', 'Abstauber! ' + nm(e.p) + ' steht goldrichtig – ' + e.sc + '.'][v];
      case 'C': return [nm(e.p) + ' scheitert an ' + nm(e.p2) + '.', 'Pfosten! ' + nm(e.p) + ' hat Pech.', nm(e.p) + ' jagt den Ball über die Latte.', 'Glanzparade von ' + nm(e.p2) + ' gegen ' + nm(e.p) + '!'][v];
      case 'Y': return 'Gelb für ' + nm(e.p) + ' (' + club.short + ').';
      case 'R': return (e.gr ? 'Gelb-Rot' : 'Rote Karte') + ' für ' + nm(e.p) + ' (' + club.short + ')!';
      case 'I': return nm(e.p) + ' (' + club.short + ') verletzt sich – ' + e.w + ' Woche(n) Pause.';
      case 'S': return 'Wechsel bei ' + club.short + ': ' + nm(e.p) + ' für ' + nm(e.p2) + '.';
    }
    return '';
  }
  var EV_ICON = { G: '⚽', C: '💨', Y: '🟨', R: '🟥', I: '🚑', S: '🔁' };
  function renderKonferenz() {
    startKonf();
    var k = U.konf, min = k.min;
    var ms = konfMatches();
    var done = min >= 95;
    var feed = [];
    var byLeague = {}, mineRows = [];
    ms.forEach(function (m) {
      var mine = S.clubs[m.h].human >= 0 || S.clubs[m.a].human >= 0;
      var hg = 0, ag = 0;
      m.ev.forEach(function (e) {
        if (e.m > min) return;
        if (e.t === 'G') { if (e.s) ag++; else hg++; }
        if (e.t === 'G' || (mine && e.t !== 'C') || (mine && e.t === 'C' && e.m >= min - 30)) feed.push({ e: e, m: m, mine: mine });
      });
      var goalNow = m.ev.some(function (e) { return e.t === 'G' && e.m === min; });
      var row = '<div class="fx' + (mine ? ' mine' : '') + (goalNow ? ' goal' : '') + '"><span class="t r">' + h(S.clubs[m.h].name) + '</span><b>' + hg + ':' + ag + '</b><span class="t">' + h(S.clubs[m.a].name) + '</span></div>';
      if (mine) mineRows.push(row);
      else (byLeague[m.li] = byLeague[m.li] || []).push(row);
    });
    feed.sort(function (a, b) { return b.e.m - a.e.m; });
    var clock = done ? 'Abpfiff' : min === 0 ? 'Anpfiff' : (min > 90 ? '90+' + (min - 90) : min) + '\'';
    var out = '<header class="top konf"><div class="grow"><b>Konferenz · Spieltag ' + (S.last.week + 1) + '</b><small>Saison ' + seasonLabel() + '</small></div><div class="clock">' + clock + '</div></header><main class="page">';
    out += '<div class="label">Eure Spiele</div><div class="fixtures live">' + mineRows.join('') + '</div>';
    out += '<div class="label mt">Ticker</div><div class="feed">' + (feed.length ? feed.slice(0, 8).map(function (f) {
      return '<div class="fe ' + f.e.t + (f.mine ? ' mine' : '') + '"><span class="m">' + f.e.m + '\'</span><span>' + EV_ICON[f.e.t] + '</span><span class="grow">' + h(evText(f.e, f.m)) + '</span></div>';
    }).join('') : '<p class="muted">Die Spiele laufen …</p>') + '</div>';
    Object.keys(byLeague).forEach(function (li) { out += '<div class="label mt">Weitere Spiele · ' + S.leagues[li].name + '</div><div class="fixtures live">' + byLeague[li].join('') + '</div>'; });
    out += '</main>';
    out += '<div class="konfbar">' + (done ? '<button class="btn primary big grow" data-a="konfDone">Weiter ▶</button>' :
      [1, 3, 10].map(function (s) { return '<button class="btn' + (k.speed === s ? ' primary' : '') + '" data-a="konfSpeed" data-s="' + s + '">' + s + '×</button>'; }).join('') +
      '<button class="btn grow" data-a="konfSkip">Endstand ⏭</button>') + '</div>';
    return out;
  }

  // ---------- Spieltagsbilanz ----------
  function renderSummary() {
    var out = '<header class="top konf"><div class="grow"><b>Nach Spieltag ' + S.week + '</b><small>Saison ' + seasonLabel() + '</small></div></header><main class="page">';
    S.humans.forEach(function (hm) {
      var c = S.clubs[hm.club];
      var lm = S.last.matches.filter(function (m) { return m.h === c.id || m.a === c.id; })[0];
      out += '<section class="card"><div class="row">' + badge(c) + '<b class="grow">' + h(hm.name) + ' – ' + h(c.name) + '</b><span>Platz ' + E.position(S, c.id) + '</span></div>' + (lm ? matchReport(lm) : '<p class="muted">Kein Spiel (Vereinswechsel).</p>') + '</section>';
    });
    var leagues = [];
    S.humans.forEach(function (hm) { var l = S.clubs[hm.club].league; if (leagues.indexOf(l) < 0) leagues.push(l); });
    leagues.sort().forEach(function (li) { out += '<div class="label">' + S.leagues[li].name + '</div>' + tableHtml(li, false); });
    out += '</main><div class="konfbar"><button class="btn primary big grow" data-a="summaryDone">Weiter zu Spieltag ' + (S.week + 1) + ' ▶</button></div>';
    return out;
  }
  function renderSeason() {
    var r = S.seasonReport;
    var out = '<header class="top konf"><div class="grow"><b>Saisonabschluss ' + (S.year - 1) + '/' + String(S.year).slice(2) + '</b><small>Die neue Saison wartet</small></div></header><main class="page">';
    out += '<section class="card champ"><div class="trophy">🏆</div><div class="label">Meister</div><h2>' + h(S.clubs[r.champion[0]].name) + '</h2><p class="muted">Zweitliga-Meister: ' + h(S.clubs[r.champion[1]].name) + '</p></section>';
    r.humans.forEach(function (x) {
      var hm = S.humans[x.hi], c = S.clubs[x.club];
      out += '<section class="card"><div class="row">' + badge(c) + '<b class="grow">' + h(hm.name) + ' – ' + h(c.name) + '</b></div><p>Platz <b>' + x.pos + '</b> in der ' + S.leagues[x.league].name + '. Ziel: ' + h(x.goal) + ' – ' + (x.ok ? '✅ erfüllt!' : '❌ verfehlt.') + '</p>' +
        (hm.club !== x.club ? '<p class="neg">Entlassen! Neuer Verein: ' + h(S.clubs[hm.club].name) + '</p>' : '') + '</section>';
    });
    out += '<section class="card"><div class="label">Aufsteiger</div><p>' + r.up.map(function (id) { return badge(S.clubs[id]) + ' ' + h(S.clubs[id].name); }).join('<br>') + '</p>' +
      '<div class="label mt">Absteiger</div><p>' + r.down.map(function (id) { return badge(S.clubs[id]) + ' ' + h(S.clubs[id].name); }).join('<br>') + '</p></section>';
    out += '</main><div class="konfbar"><button class="btn primary big grow" data-a="seasonDone">Saison ' + seasonLabel() + ' starten ▶</button></div>';
    return out;
  }

  // ---------- Aktionen ----------
  function confirmBox(title, text, yes, fn2) { U.confirmFn = fn2; openSheet({ type: 'confirm', title: title, text: text, yes: yes }); }
  var A = {
    continue: function () { if (loadSave() && validSave(S)) { U.screen = 'game'; U.unlocked = -1; render(); } else toast('Kein Spielstand gefunden'); },
    newGame: function () {
      if (hasSave()) return confirmBox('Neues Spiel?', 'Der bisherige Spielstand auf diesem Gerät wird überschrieben.', 'Neues Spiel', function () { U.setup = { step: 1, n: 1, names: ['', '', '', ''] }; U.screen = 'setup'; render(); });
      U.setup = { step: 1, n: 1, names: ['', '', '', ''] }; U.screen = 'setup'; render();
    },
    import: function () { closeSheet(); importSave(); },
    export: function () { closeSheet(); exportSave(); },
    help: function () { openSheet({ type: 'help' }); },
    menu: function () { openSheet({ type: 'menu' }); },
    toTitle: function () { closeSheet(); stopKonf(); U.screen = 'title'; render(); },
    closeSheet: function () { closeSheet(); },
    confirmYes: function () { var f = U.confirmFn; closeSheet(); if (f) f(); },
    setupN: function (d) { readNames(); U.setup.n = +d.n; render(); },
    setupNext: function () {
      readNames();
      var st = U.setup;
      for (var i = 0; i < st.n; i++) if (!st.names[i].trim()) st.names[i] = 'Manager ' + (i + 1);
      st.step = 2; st.pick = 0; st.clubs = []; st.league = 0; render(); window.scrollTo(0, 0);
    },
    setupLeague: function (d) { U.setup.league = +d.l; render(); },
    setupBack: function () {
      var st = U.setup;
      if (st.pick > 0) { st.pick--; st.clubs.length = st.pick; } else st.step = 1;
      render();
    },
    pickClub: function (d) {
      var st = U.setup;
      st.clubs[st.pick] = +d.c;
      if (st.pick + 1 < st.n) { st.pick++; render(); window.scrollTo(0, 0); return; }
      var humans = [];
      for (var i = 0; i < st.n; i++) humans.push({ name: st.names[i].trim(), club: st.clubs[i] });
      S = E.newGame(humans);
      U.screen = 'game'; U.unlocked = -1; U.tab = 'buero'; U.ligaView = null; U.ligaWeek = null;
      save(); render(); window.scrollTo(0, 0);
    },
    unlock: function () { U.unlocked = S.turn; U.tab = 'buero'; U.ligaView = null; U.ligaWeek = null; render(); window.scrollTo(0, 0); },
    tab: function (d) { U.tab = d.t; if (d.t === 'team') U.teamTab = U.teamTab || 'aufstellung'; render(); window.scrollTo(0, 0); },
    teamTab: function (d) { U.teamTab = d.t; render(); },
    ligaTab: function (d) { U.ligaTab = d.t; render(); },
    ligaView: function (d) { U.ligaView = +d.l; U.ligaWeek = null; render(); },
    ligaWeek: function (d) { U.ligaWeek = Math.max(0, Math.min(33, U.ligaWeek + (+d.d))); render(); },
    mkPos: function (d) { U.mkPos = d.v; render(); },
    mkSort: function (d) { U.mkSort = d.v; render(); },
    mkAfford: function () { U.mkAfford = !U.mkAfford; render(); },
    formation: function (d) { var c = myClub(); c.formation = d.f; E.autoLineup(S, c); save(); render(); toast('Formation ' + d.f + ' – Aufstellung angepasst'); },
    einsatz: function (d) { myClub().tactic.einsatz = d.v; save(); render(); },
    ausr: function (d) { myClub().tactic.ausr = d.v; save(); render(); },
    training: function (d) { myClub().training = d.t; save(); render(); },
    autoLineup: function () { E.autoLineup(S, myClub()); save(); render(); toast('Beste Elf aufgestellt'); },
    repair: function () { var ch = E.repairLineup(S, myClub()); save(); render(); toast(ch.length ? 'Ersetzt: ' + ch.join(', ') : 'Alles in Ordnung'); },
    slot: function (d) { openSheet({ type: 'slot', i: +d.i }); },
    setSlot: function (d) {
      var c = myClub(), i = +d.i, pid = d.p === '' ? null : +d.p;
      var j = pid != null ? c.lineup.indexOf(pid) : -1;
      if (j >= 0) c.lineup[j] = c.lineup[i];
      c.lineup[i] = pid;
      save(); closeSheet(); render();
    },
    player: function (d) { openSheet({ type: 'player', id: +d.p }); },
    club: function (d) { openSheet({ type: 'club', id: +d.c }); },
    choice: function (d) { var r = E.resolveChoice(S, S.turn, +d.m, +d.i); save(); render(); if (r) toast(r); },
    list: function (d) { E.listPlayer(S, +d.p, +d.f); save(); render(); toast('Spieler auf die Transferliste gesetzt'); },
    unlist: function (d) { E.listPlayer(S, +d.p, 0); save(); render(); },
    extend: function (d) {
      var p = pl(+d.p), o = E.extendOffer(S, p);
      confirmBox('Vertrag verlängern?', E.fullName(p) + ' verlängert um ' + o.years + ' Jahr(e) für ' + fm(o.sal) + ' pro Saison (bisher ' + fm(p.sal) + ').', 'Unterschreiben', function () {
        E.extendContract(S, p.id); save(); render(); toast('Vertrag verlängert');
      });
    },
    quickSell: function (d) {
      var p = pl(+d.p);
      confirmBox('Sofort verkaufen?', E.fullName(p) + ' für ' + fm(Math.round(E.value(p) * 0.7)) + ' an einen anderen Verein abgeben?', 'Verkaufen', function () {
        var t = E.quickSell(S, S.turn, p.id); save(); render(); toast(t);
      });
    },
    release: function (d) {
      var p = pl(+d.p);
      confirmBox('Spieler entlassen?', E.fullName(p) + ' wird vereinslos. Abfindung: ' + fm(Math.round(p.sal * p.con * 0.5)) + '.', 'Entlassen', function () {
        var t = E.releasePlayer(S, S.turn, p.id); save(); render(); toast(t);
      });
    },
    offer: function (d) {
      var r = E.makeOffer(S, S.turn, +d.p, +d.v);
      save();
      if (r.ok) closeSheet();
      render(); toast(r.text);
    },
    price: function (d) { var c = myClub(); c.stadium.price = Math.max(5, Math.min(99, c.stadium.price + (+d.d))); save(); render(); },
    build: function (d) {
      var c = myClub(), b = E.STADIUM_BUILD[+d.i];
      confirmBox('Stadion ausbauen?', '+' + fn(b.add) + ' Plätze für ' + fm(b.cost) + '. Bauzeit: ' + b.weeks + ' Spieltage.', 'Bauen', function () {
        E.book(c, 'stadion', -b.cost); c.stadium.build = { add: b.add, weeks: b.weeks }; save(); render(); toast('Die Bagger rollen an!');
      });
    },
    endTurn: function () {
      var hm = me(), c = myClub();
      var open = hm.inbox.filter(function (m) { return !m.done; });
      var go = function () {
        open.forEach(function (m) { E.resolveChoice(S, S.turn, m.id, m.choices.length - 1); });
        var ch = E.repairLineup(S, c);
        if (ch.length) E.msg(S, S.turn, 'Aufstellung angepasst', 'Vor dem Spiel ersetzt: ' + ch.join(', '));
        hm.done = true;
        var next = -1;
        for (var i = 0; i < S.humans.length; i++) if (!S.humans[i].done) { next = i; break; }
        if (next >= 0) { S.turn = next; U.unlocked = -1; }
        else { E.playMatchday(S); U.konf = null; }
        save(); render(); window.scrollTo(0, 0);
      };
      if (open.length) return confirmBox('Offene Entscheidungen', 'Du hast ' + open.length + ' unbeantwortete Nachricht(en). Beim Beenden wird jeweils die letzte Option gewählt.', 'Trotzdem beenden', go);
      go();
    },
    konfSpeed: function (d) { U.konf.speed = +d.s; tickKonf(); render(); },
    konfSkip: function () { stopKonf(); U.konf.min = 95; render(); },
    konfDone: function () { stopKonf(); E.postMatchday(S); U.konf = null; save(); render(); window.scrollTo(0, 0); },
    summaryDone: function () { startTurns(); },
    seasonDone: function () { S.seasonReport = null; startTurns(); }
  };
  function startTurns() {
    S.phase = 'turns'; S.turn = 0; U.unlocked = -1; U.ligaWeek = null; U.ligaView = null;
    save(); render(); window.scrollTo(0, 0);
  }
  function readNames() {
    document.querySelectorAll('[data-name]').forEach(function (inp) { U.setup.names[+inp.dataset.name] = inp.value; });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    var fnA = A[el.dataset.a];
    if (fnA) { e.preventDefault(); fnA(el.dataset, el); }
  });

  // ---------- Start ----------
  if (loadSave() && !validSave(S)) S = null;
  U.screen = 'title';
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline nicht verfügbar */ });
  }
})();
