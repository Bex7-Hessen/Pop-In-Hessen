// Spiel-Logik: unabhängig von der Oberfläche, läuft auch in Node (für Tests)
(function (root) {
  'use strict';
  var DATA = root.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  var WEEKS = 34;
  var POS = ['TW', 'AB', 'MF', 'ST'];
  var POS_NAME = { TW: 'Torwart', AB: 'Abwehr', MF: 'Mittelfeld', ST: 'Sturm' };
  var FORMATIONS = {
    '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '3-5-2': [3, 5, 2],
    '4-5-1': [4, 5, 1], '5-3-2': [5, 3, 2], '3-4-3': [3, 4, 3]
  };
  var EINSATZ = { normal: { str: 1, card: 1, fit: 1 }, hart: { str: 1.04, card: 1.8, fit: 1.12 }, brutal: { str: 1.08, card: 3, fit: 1.25 } };
  var TRAINING = {
    locker: { name: 'Regeneration', desc: 'Viel Erholung, gute Laune, kaum Fortschritt.', fit: 28, mor: 4, grow: 0.3, inj: 0 },
    normal: { name: 'Ausgewogen', desc: 'Solider Mix aus Belastung und Erholung.', fit: 18, mor: 0, grow: 1, inj: 0 },
    hart: { name: 'Knochenhart', desc: 'Schnellere Entwicklung, aber müde Beine und Verletzungsgefahr.', fit: 8, mor: -3, grow: 1.9, inj: 0.012 },
    taktik: { name: 'Taktikschulung', desc: 'Mannschaft spielt im nächsten Spiel 3 % stärker.', fit: 16, mor: 0, grow: 0.5, inj: 0 }
  };
  var STADIUM_BUILD = [
    { add: 2000, cost: 2500000, weeks: 3 },
    { add: 5000, cost: 6000000, weeks: 6 },
    { add: 10000, cost: 11000000, weeks: 10 }
  ];
  var MAX_SQUAD = 30;

  // ---------- Zufall ----------
  function rnd() { return Math.random(); }
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function chance(p) { return rnd() < p; }
  function gauss() { return (rnd() + rnd() + rnd() + rnd() - 2) / 0.8165; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function weighted(items, wf) {
    var tot = 0, i;
    for (i = 0; i < items.length; i++) tot += Math.max(0, wf(items[i]));
    if (tot <= 0) return items.length ? pick(items) : null;
    var r = rnd() * tot;
    for (i = 0; i < items.length; i++) { r -= Math.max(0, wf(items[i])); if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function roundNice(v) {
    if (v >= 1000000) return Math.round(v / 50000) * 50000;
    if (v >= 100000) return Math.round(v / 10000) * 10000;
    return Math.round(v / 1000) * 1000;
  }

  // ---------- Spieler ----------
  function value(p) {
    var a = p.age;
    var af = a <= 21 ? 1.4 : a <= 25 ? 1.25 : a <= 28 ? 1 : a <= 30 ? 0.75 : a <= 32 ? 0.5 : 0.3;
    var v = 50000 * Math.pow(1.12, p.str - 40) * af;
    if (a <= 23 && p.pot > p.str) v *= 1 + (p.pot - p.str) / 40;
    return roundNice(Math.max(10000, v));
  }
  function salaryFor(p) { return roundNice(60000 + value(p) * 0.4 + Math.max(0, p.str - 40) * 15000); }

  function newPlayer(S, base, pos, age) {
    if (age == null) age = ri(18, 34);
    var str = base + gauss() * 6 - (age < 22 ? (22 - age) * 2 : 0) - (age > 31 ? (age - 31) * 1.5 : 0);
    str = Math.round(clamp(str, 25, 95));
    var pot = age < 24 ? str + ri(0, (24 - age) * 4 + 6) : str + ri(0, 3);
    var p = {
      id: S.nextId++,
      fn: pick(DATA.firstNames), ln: pick(DATA.lastNames),
      pos: pos, age: age, str: str, pot: Math.min(97, pot),
      fit: ri(85, 100), mor: ri(60, 80),
      club: -1, con: ri(1, 4), sal: 0,
      inj: 0, sus: 0, yel: 0, goals: 0, apps: 0,
      ask: 0, listedW: 0, neg: -1
    };
    p.sal = salaryFor(p);
    S.players[p.id] = p;
    return p;
  }
  function pname(p) { return p.fn.charAt(0) + '. ' + p.ln; }
  function fullName(p) { return p.fn + ' ' + p.ln; }
  function available(p) { return p.inj <= 0 && p.sus <= 0; }

  function movePlayer(S, p, to) {
    var from = p.club;
    if (from >= 0) {
      var c = S.clubs[from];
      c.squad = c.squad.filter(function (id) { return id !== p.id; });
      c.lineup = c.lineup.map(function (id) { return id === p.id ? null : id; });
    } else {
      S.free = S.free.filter(function (id) { return id !== p.id; });
    }
    p.club = to;
    p.ask = 0; p.listedW = 0;
    if (to >= 0) S.clubs[to].squad.push(p.id);
    else if (to === -1) S.free.push(p.id);
    // to === -2: Karriereende
    if (to === -2) delete S.players[p.id];
  }
  function squad(S, cid) { return S.clubs[cid].squad.map(function (id) { return S.players[id]; }); }

  // ---------- Aufstellung ----------
  function slotsFor(f) {
    var d = FORMATIONS[f], s = ['TW'], i;
    for (i = 0; i < d[0]; i++) s.push('AB');
    for (i = 0; i < d[1]; i++) s.push('MF');
    for (i = 0; i < d[2]; i++) s.push('ST');
    return s;
  }
  function posFactor(pp, sp) {
    if (pp === sp) return 1;
    if (pp === 'TW' || sp === 'TW') return pp === 'TW' ? 0.35 : 0.3;
    var o = { AB: 0, MF: 1, ST: 2 };
    return Math.abs(o[pp] - o[sp]) === 1 ? 0.85 : 0.7;
  }
  function effStr(p, sp) {
    return p.str * posFactor(p.pos, sp) * (0.65 + 0.35 * p.fit / 100) * (0.9 + 0.2 * p.mor / 100);
  }
  function autoLineup(S, c) {
    var slots = slotsFor(c.formation);
    var pool = squad(S, c.id).filter(available);
    var lineup = new Array(slots.length).fill(null);
    var used = {};
    function score(p, sp) { return p.str * posFactor(p.pos, sp) * (0.55 + 0.45 * p.fit / 100); }
    // 1. Durchgang: nur Spieler auf ihrer Stammposition
    slots.forEach(function (sp, i) {
      var best = null;
      pool.forEach(function (p) { if (!used[p.id] && p.pos === sp && (!best || score(p, sp) > score(best, sp))) best = p; });
      if (best) { lineup[i] = best.id; used[best.id] = 1; }
    });
    // 2. Durchgang: Lücken mit den Besten auffüllen
    slots.forEach(function (sp, i) {
      if (lineup[i] != null) return;
      var best = null;
      pool.forEach(function (p) { if (!used[p.id] && (!best || score(p, sp) > score(best, sp))) best = p; });
      if (best) { lineup[i] = best.id; used[best.id] = 1; }
    });
    c.lineup = lineup;
    return lineup;
  }
  // Ungültige Spieler (verletzt, gesperrt, verkauft) ersetzen; gibt Liste der Ersetzungen zurück
  function repairLineup(S, c) {
    var slots = slotsFor(c.formation);
    if (!c.lineup || c.lineup.length !== slots.length) { autoLineup(S, c); return ['Aufstellung automatisch erstellt']; }
    var changes = [];
    var used = {};
    c.lineup.forEach(function (id) { if (id != null) used[id] = 1; });
    c.lineup = c.lineup.map(function (id, i) {
      var p = id != null ? S.players[id] : null;
      if (p && p.club === c.id && available(p)) return id;
      var sp = slots[i], best = null;
      squad(S, c.id).forEach(function (q) {
        if (used[q.id] || !available(q)) return;
        if (!best || effStr(q, sp) > effStr(best, sp)) best = q;
      });
      if (best) {
        used[best.id] = 1;
        changes.push((p ? pname(p) : 'Lücke') + ' → ' + pname(best));
        return best.id;
      }
      return null;
    });
    return changes;
  }
  function teamStrength(S, cid) {
    // Durchschnitt der besten 14 – für Einschätzungen
    var arr = squad(S, cid).map(function (p) { return p.str; }).sort(function (a, b) { return b - a; }).slice(0, 14);
    if (!arr.length) return 0;
    return Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length);
  }

  // ---------- Spielsimulation ----------
  function rate(S, side) {
    var slots = slotsFor(side.club.formation);
    var tw = 0, ab = 0, mf = 0, st = 0;
    side.on.forEach(function (id, i) {
      if (id == null) return;
      var e = effStr(S.players[id], slots[i]);
      if (slots[i] === 'TW') tw += e; else if (slots[i] === 'AB') ab += e; else if (slots[i] === 'MF') mf += e; else st += e;
    });
    var m = EINSATZ[side.club.tactic.einsatz].str * (side.home ? 1.05 : 1) * (side.club.taktikBonus ? 1.03 : 1);
    return { tw: tw * m, def: (ab + 0.3 * mf) * m, mid: (mf + 0.25 * (ab + st)) * m, att: (st + 0.35 * mf + 0.1 * ab) * m };
  }

  function simulateMatch(S, hc, ac) {
    repairLineup(S, hc); repairLineup(S, ac);
    var sides = [
      { club: hc, home: true, on: hc.lineup.slice(), subs: 3, goals: 0, yel: {} },
      { club: ac, home: false, on: ac.lineup.slice(), subs: 3, goals: 0, yel: {} }
    ];
    var played = {};
    sides.forEach(function (sd) { sd.on.forEach(function (id) { if (id != null) played[id] = sd; }); });
    var ev = [];
    var r = [rate(S, sides[0]), rate(S, sides[1])];
    var dirty = false;
    var len = 90 + ri(1, 4);
    var ausr = { defensiv: { own: 0.8, opp: 0.85 }, normal: { own: 1, opp: 1 }, offensiv: { own: 1.2, opp: 1.12 } };

    function bench(sd) {
      return sd.club.squad.map(function (id) { return S.players[id]; })
        .filter(function (p) { return available(p) && !played[p.id]; });
    }
    function sub(sd, idx, min) {
      var sp = slotsFor(sd.club.formation)[idx];
      if (sd.subs <= 0) { sd.on[idx] = null; return; }
      var b = bench(sd), best = null;
      b.forEach(function (p) { if (!best || effStr(p, sp) > effStr(best, sp)) best = p; });
      if (!best) { sd.on[idx] = null; return; }
      sd.subs--;
      var out = sd.on[idx];
      sd.on[idx] = best.id; played[best.id] = sd;
      ev.push({ m: min, t: 'S', s: sides.indexOf(sd), p: best.id, p2: out });
    }

    for (var min = 1; min <= len; min++) {
      if (dirty) { r = [rate(S, sides[0]), rate(S, sides[1])]; dirty = false; }
      for (var t = 0; t < 2; t++) {
        var sd = sides[t], op = sides[1 - t], rs = r[t], ro = r[1 - t];
        var aOwn = ausr[sd.club.tactic.ausr], aOpp = ausr[op.club.tactic.ausr];
        var midRatio = rs.mid / Math.max(1, ro.mid);
        var chRate = 4.7 / 90 * Math.pow(midRatio, 1.4) * aOwn.own * (aOpp.own < 1 ? 0.95 : 1);
        if (chance(chRate)) {
          var q = rs.att / Math.max(1, 0.6 * ro.def + 1.2 * ro.tw);
          var pg = clamp(0.205 * Math.pow(q / 0.88, 1.8) * aOpp.opp, 0.04, 0.65);
          var slots = slotsFor(sd.club.formation);
          var cands = [];
          sd.on.forEach(function (id, i) { if (id != null && slots[i] !== 'TW') cands.push({ id: id, sp: slots[i] }); });
          var sh = weighted(cands, function (c) { return (c.sp === 'ST' ? 5 : c.sp === 'MF' ? 2.4 : 0.7) * S.players[c.id].str; });
          if (!sh) continue;
          var keeper = op.on[0];
          if (chance(pg)) {
            sd.goals++;
            ev.push({ m: min, t: 'G', s: t, p: sh.id, sc: sides[0].goals + ':' + sides[1].goals });
          } else {
            ev.push({ m: min, t: 'C', s: t, p: sh.id, p2: keeper });
          }
        }
        // Karten
        var ein = EINSATZ[sd.club.tactic.einsatz];
        if (chance(1.7 / 90 * ein.card)) {
          var ids = sd.on.filter(function (id) { return id != null; });
          var cp = pick(ids);
          if (cp != null) {
            if (sd.yel[cp]) {
              ev.push({ m: min, t: 'R', s: t, p: cp, gr: 1 });
              sd.on[sd.on.indexOf(cp)] = null; S.players[cp].sus += 1; dirty = true;
            } else {
              sd.yel[cp] = 1;
              ev.push({ m: min, t: 'Y', s: t, p: cp });
              S.players[cp].yel++;
              if (S.players[cp].yel % 5 === 0) S.players[cp].sus += 1;
            }
          }
        }
        if (chance(0.045 / 90 * Math.pow(ein.card, 1.5))) {
          var ids2 = sd.on.filter(function (id) { return id != null; });
          var rp = pick(ids2);
          if (rp != null) {
            ev.push({ m: min, t: 'R', s: t, p: rp });
            sd.on[sd.on.indexOf(rp)] = null; S.players[rp].sus += ri(2, 3); dirty = true;
          }
        }
        // Verletzungen (Gegner spielt hart → mehr Risiko)
        var oein = EINSATZ[op.club.tactic.einsatz];
        if (chance(0.16 / 90 * oein.card)) {
          var idx = ri(0, sd.on.length - 1);
          var ip = sd.on[idx];
          if (ip != null) {
            var pl = S.players[ip];
            if (chance(1.4 - pl.fit / 100)) {
              pl.inj = ri(1, 6);
              ev.push({ m: min, t: 'I', s: t, p: ip, w: pl.inj });
              sub(sd, idx, min); dirty = true;
            }
          }
        }
      }
    }
    // Nachwirkungen: Frische, Einsätze
    Object.keys(played).forEach(function (id) {
      var p = S.players[id], sd = played[id];
      if (!p) return;
      p.apps++;
      p.fit = clamp(p.fit - ri(10, 17) * EINSATZ[sd.club.tactic.einsatz].fit, 5, 100);
      p.playedW = 1;
    });
    ev.forEach(function (e) { if (e.t === 'G') S.players[e.p].goals++; });
    hc.taktikBonus = false; ac.taktikBonus = false;
    return { hg: sides[0].goals, ag: sides[1].goals, ev: ev };
  }

  // ---------- Spielplan & Tabelle ----------
  function roundRobin(ids) {
    var arr = shuffle(ids.slice()), n = arr.length, rounds = [], r, i;
    for (r = 0; r < n - 1; r++) {
      var ms = [];
      for (i = 0; i < n / 2; i++) {
        var h = arr[i], a = arr[n - 1 - i];
        if ((i === 0 && r % 2 === 1) || (i > 0 && i % 2 === 1)) { var t = h; h = a; a = t; }
        ms.push([h, a]);
      }
      rounds.push(ms);
      arr.splice(1, 0, arr.pop());
    }
    return rounds.concat(rounds.map(function (ms) { return ms.map(function (m) { return [m[1], m[0]]; }); }));
  }
  function table(S, li) {
    var L = S.leagues[li], rows = {};
    L.clubs.forEach(function (cid) { rows[cid] = { cid: cid, sp: 0, s: 0, u: 0, n: 0, tg: 0, gt: 0, pts: 0, form: [] }; });
    L.results.forEach(function (wk) {
      wk.forEach(function (m) {
        var h = rows[m.h], a = rows[m.a];
        if (!h || !a) return;
        h.sp++; a.sp++; h.tg += m.hg; h.gt += m.ag; a.tg += m.ag; a.gt += m.hg;
        if (m.hg > m.ag) { h.s++; a.n++; h.pts += 3; h.form.push('S'); a.form.push('N'); }
        else if (m.hg < m.ag) { a.s++; h.n++; a.pts += 3; h.form.push('N'); a.form.push('S'); }
        else { h.u++; a.u++; h.pts++; a.pts++; h.form.push('U'); a.form.push('U'); }
      });
    });
    return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (x, y) {
      return y.pts - x.pts || (y.tg - y.gt) - (x.tg - x.gt) || y.tg - x.tg || S.clubs[x.cid].name.localeCompare(S.clubs[y.cid].name);
    });
  }
  function position(S, cid) {
    var t = table(S, S.clubs[cid].league);
    for (var i = 0; i < t.length; i++) if (t[i].cid === cid) return i + 1;
    return 0;
  }
  function nextMatch(S, cid) {
    var L = S.leagues[S.clubs[cid].league];
    if (S.week >= WEEKS) return null;
    var ms = L.fixtures[S.week];
    for (var i = 0; i < ms.length; i++) {
      if (ms[i][0] === cid) return { opp: ms[i][1], home: true };
      if (ms[i][1] === cid) return { opp: ms[i][0], home: false };
    }
    return null;
  }

  // ---------- Neues Spiel ----------
  function setupGoals(S) {
    S.leagues.forEach(function (L, li) {
      var ranked = L.clubs.slice().sort(function (a, b) { return teamStrength(S, b) - teamStrength(S, a); });
      ranked.forEach(function (cid, i) {
        var g;
        if (li === 0) g = i < 2 ? { pos: 2, text: 'Meisterschaft (Platz 1–2)' } : i < 6 ? { pos: 6, text: 'Europapokal (Platz 1–6)' } : i < 11 ? { pos: 11, text: 'Gesichertes Mittelfeld (Platz 1–11)' } : { pos: 15, text: 'Klassenerhalt (Platz 1–15)' };
        else g = i < 3 ? { pos: 3, text: 'Aufstieg (Platz 1–3)' } : i < 8 ? { pos: 8, text: 'Oberes Mittelfeld (Platz 1–8)' } : { pos: 15, text: 'Klassenerhalt (Platz 1–15)' };
        S.clubs[cid].goal = g;
      });
    });
  }

  function newGame(humans) {
    var S = {
      v: 1, season: 1, year: 2026, week: 0, nextId: 1,
      players: {}, free: [], clubs: [], leagues: [],
      humans: [], phase: 'turns', turn: 0, last: null, msgId: 1
    };
    DATA.leagues.forEach(function (ld, li) {
      var L = { name: ld.name, clubs: [], fixtures: [], results: [] };
      ld.clubs.forEach(function (cd) {
        var rep = cd[4];
        var c = {
          id: S.clubs.length, name: cd[0], short: cd[1], c1: cd[2], c2: cd[3], rep: rep, league: li,
          squad: [], lineup: [], formation: pick(['4-4-2', '4-4-2', '4-3-3', '3-5-2', '4-5-1']),
          tactic: { einsatz: 'normal', ausr: 'normal' }, training: 'normal',
          money: li === 0 ? roundNice(2000000 + (rep - 60) * 450000) : roundNice(600000 + (rep - 45) * 120000),
          fans: li === 0 ? Math.round(18000 + (rep - 60) * 1700) : Math.round(7000 + (rep - 45) * 900),
          stadium: { cap: li === 0 ? roundNice(24000 + (rep - 60) * 1400) : roundNice(10000 + (rep - 45) * 700), price: li === 0 ? 25 : 16, build: null },
          sponsor: li === 0 ? roundNice(120000 + (rep - 60) * 9000) : roundNice(45000 + (rep - 45) * 3000),
          human: -1, board: 60, goal: null, taktikBonus: false,
          fin: { last: {}, season: {} }
        };
        S.clubs.push(c);
        L.clubs.push(c.id);
        var base = rep - 8;
        var plan = [['TW', 3], ['AB', 8], ['MF', 8], ['ST', 5]];
        plan.forEach(function (pp) {
          for (var k = 0; k < pp[1]; k++) {
            var p = newPlayer(S, base, pp[0]);
            p.club = c.id; c.squad.push(p.id);
          }
        });
        autoLineup(S, c);
      });
      L.fixtures = roundRobin(L.clubs);
      S.leagues.push(L);
    });
    for (var i = 0; i < 40; i++) {
      var fp = newPlayer(S, ri(40, 66), pick(['TW', 'AB', 'AB', 'MF', 'MF', 'ST']));
      fp.club = -1; S.free.push(fp.id);
    }
    humans.forEach(function (h, i) {
      var c = S.clubs[h.club];
      c.human = i;
      S.humans.push({ name: h.name, club: h.club, inbox: [], done: false, firedCount: 0 });
    });
    setupGoals(S);
    humans.forEach(function (h, i) {
      var c = S.clubs[h.club];
      msg(S, i, 'Willkommen, Trainer!', 'Der Vorstand von ' + c.name + ' begrüßt dich herzlich. Unser Saisonziel: ' + c.goal.text +
        '. Enttäusche uns nicht – die Geduld des Präsidenten ist begrenzt.');
    });
    return S;
  }

  // ---------- Nachrichten ----------
  function msg(S, hi, title, text, choices) {
    var h = S.humans[hi];
    h.inbox.unshift({ id: S.msgId++, s: S.season, w: S.week, title: title, text: text, choices: choices || null, done: !choices, read: false });
    if (h.inbox.length > 40) h.inbox.length = 40;
  }

  // ---------- Finanzen ----------
  function book(c, key, amount) {
    c.money += amount;
    c.fin.last[key] = (c.fin.last[key] || 0) + amount;
    c.fin.season[key] = (c.fin.season[key] || 0) + amount;
  }
  function attendance(S, c, opp) {
    var ref = c.league === 0 ? 25 : 16;
    var mor = squad(S, c.id).reduce(function (a, p) { return a + p.mor; }, 0) / Math.max(1, c.squad.length);
    var demand = c.fans * Math.pow(ref / c.stadium.price, 0.9) * (0.75 + 0.5 * mor / 100) * (1 + (opp.rep - 60) / 150);
    return Math.max(500, Math.min(c.stadium.cap, Math.round(demand)));
  }

  // ---------- Spieltag ----------
  function playMatchday(S) {
    S.clubs.forEach(function (c) { c.fin.last = {}; });
    var out = [];
    Object.keys(S.players).forEach(function (id) { S.players[id].playedW = 0; });
    S.leagues.forEach(function (L, li) {
      var res = [];
      L.fixtures[S.week].forEach(function (m) {
        var hc = S.clubs[m[0]], ac = S.clubs[m[1]];
        var r = simulateMatch(S, hc, ac);
        var att = attendance(S, hc, ac);
        book(hc, 'tickets', att * hc.stadium.price);
        res.push({ h: m[0], a: m[1], hg: r.hg, ag: r.ag, att: att });
        out.push({ li: li, h: m[0], a: m[1], hg: r.hg, ag: r.ag, att: att, ev: r.ev });
        // Moral
        [[hc, r.hg - r.ag], [ac, r.ag - r.hg]].forEach(function (x) {
          var d = x[1] > 0 ? 6 : x[1] < 0 ? -6 : 1;
          squad(S, x[0].id).forEach(function (p) { p.mor = clamp(p.mor + d + (p.playedW ? 0 : (p.str > teamStrength(S, x[0].id) ? -3 : -1)), 5, 100); });
        });
      });
      L.results[S.week] = res;
    });
    S.last = { season: S.season, week: S.week, matches: out };
    S.phase = 'konferenz';
    return out;
  }

  function postMatchday(S) {
    var wk = S.week;
    S.clubs.forEach(function (c) {
      var tr = TRAINING[c.training] || TRAINING.normal;
      if (c.training === 'taktik') c.taktikBonus = true;
      squad(S, c.id).forEach(function (p) {
        if (p.inj > 0) p.inj--;
        // Sperren gelten ab dem nächsten Spiel – wer diese Woche gespielt hat, sitzt sie erst noch ab
        if (p.sus > 0 && !p.playedW) p.sus--;
        p.fit = clamp(p.fit + tr.fit, 5, 100);
        p.mor = clamp(p.mor + tr.mor + (60 - p.mor) * 0.08, 5, 100);
        if (p.str < p.pot) {
          var base = p.age <= 21 ? 0.09 : p.age <= 24 ? 0.06 : p.age <= 28 ? 0.03 : 0.01;
          if (chance(base * tr.grow * (p.playedW ? 1.3 : 1))) p.str++;
        }
        if (tr.inj && p.inj <= 0 && chance(tr.inj)) {
          p.inj = ri(1, 3);
          if (c.human >= 0) msg(S, c.human, 'Trainingsverletzung', fullName(p) + ' hat sich beim harten Training verletzt und fällt ' + p.inj + ' Woche(n) aus.');
        }
      });
      // laufende Einnahmen/Ausgaben
      var tv = c.league === 0 ? 100000 : 40000;
      book(c, 'tv', tv);
      book(c, 'sponsor', c.sponsor);
      var sal = squad(S, c.id).reduce(function (a, p) { return a + p.sal; }, 0);
      book(c, 'gehalt', -Math.round(sal / WEEKS));
      book(c, 'stadion', -Math.round(c.stadium.cap * 1.2));
      // Stadionausbau
      if (c.stadium.build) {
        c.stadium.build.weeks--;
        if (c.stadium.build.weeks <= 0) {
          c.stadium.cap += c.stadium.build.add;
          if (c.human >= 0) msg(S, c.human, 'Stadionausbau fertig', 'Die neue Tribüne ist fertig! Dein Stadion fasst jetzt ' + fmtNum(c.stadium.cap) + ' Zuschauer.');
          c.stadium.build = null;
        }
      }
    });
    aiTransfers(S);
    humanListedSales(S);
    S.humans.forEach(function (h, hi) {
      boardUpdate(S, hi);
      if (chance(0.45)) randomEvent(S, hi);
      // Vertragswarnung
      if (wk === 24) {
        var exp = squad(S, h.club).filter(function (p) { return p.con <= 1; });
        if (exp.length) msg(S, hi, 'Auslaufende Verträge', 'Folgende Verträge laufen zum Saisonende aus: ' + exp.map(pname).join(', ') +
          '. Verlängere rechtzeitig im Kader, sonst sind die Spieler weg!');
      }
    });
    // AI: Aufstellung, Taktik
    S.clubs.forEach(function (c) {
      if (c.human < 0) { autoLineup(S, c); c.tactic.einsatz = chance(0.15) ? 'hart' : 'normal'; }
    });
    S.week++;
    S.humans.forEach(function (h) { h.done = false; });
    if (S.week >= WEEKS) { S.seasonReport = seasonEnd(S); S.phase = 'season'; }
    else S.phase = 'summary';
  }

  // ---------- Vorstand ----------
  function boardUpdate(S, hi) {
    var h = S.humans[hi], c = S.clubs[h.club];
    var last = S.leagues[c.league].results[S.week] || [];
    var m = null;
    last.forEach(function (x) { if (x.h === c.id || x.a === c.id) m = x; });
    var d = 0;
    if (m) {
      var gd = m.h === c.id ? m.hg - m.ag : m.ag - m.hg;
      d += gd > 0 ? 3 : gd < 0 ? -3 : 0;
      if (gd <= -4) d -= 3;
    }
    if (S.week >= 5) {
      var pos = position(S, c.id);
      d += pos <= c.goal.pos ? 1 : -Math.min(4, Math.ceil((pos - c.goal.pos) / 2));
    }
    if (c.money < 0) d -= 2;
    if (c.money < -3000000) d -= 5;
    c.board = clamp(c.board + d, 0, 100);
    if (c.board <= 0) fire(S, hi, 'Der Vorstand hat das Vertrauen in dich verloren.');
    else if (c.board <= 20 && d < 0) msg(S, hi, 'Vorstand stinksauer', 'Der Präsident lässt ausrichten: "Noch so eine Woche und Sie können Ihre Sachen packen!" (Vertrauen: ' + c.board + '%)');
  }
  function fire(S, hi, reason) {
    var h = S.humans[hi], old = S.clubs[h.club];
    old.human = -1; old.board = 60;
    h.firedCount++;
    var cand = S.clubs.filter(function (c) { return c.human < 0 && c.id !== old.id && c.league === 1; })
      .sort(function (a, b) { return a.rep - b.rep; }).slice(0, 6);
    var nc = pick(cand);
    nc.human = hi; nc.board = 55; h.club = nc.id;
    msg(S, hi, 'ENTLASSEN!', reason + ' Du bist bei ' + old.name + ' entlassen. Zum Glück klingelt das Telefon: ' + nc.name +
      ' bietet dir einen Neuanfang an. Saisonziel dort: ' + nc.goal.text + '.');
  }

  // ---------- Transfers ----------
  function askingPrice(S, p) {
    if (p.club < 0) return 0;
    if (p.ask) return p.ask;
    var c = S.clubs[p.club];
    var top = c.lineup.indexOf(p.id) >= 0;
    return roundNice(value(p) * (top ? 1.6 : 1.25));
  }
  function signFee(p) { return roundNice(value(p) * 0.15); }
  function demandSalary(p, extra) { return roundNice(salaryFor(p) * (extra || 1.1)); }

  // Angebot eines Menschen für einen Spieler. Ergebnis: {ok, text}
  function makeOffer(S, hi, pid, amount) {
    var h = S.humans[hi], c = S.clubs[h.club], p = S.players[pid];
    if (!p) return { ok: false, text: 'Spieler nicht gefunden.' };
    if (p.club === c.id) return { ok: false, text: 'Der Spieler gehört schon dir.' };
    if (c.squad.length >= MAX_SQUAD) return { ok: false, text: 'Dein Kader ist voll (max. ' + MAX_SQUAD + ' Spieler).' };
    var key = S.season * 100 + S.week;
    if (p.club >= 0 && S.clubs[p.club].human >= 0) return { ok: false, text: 'Dieser Spieler gehört einem Mitspieler. Klärt das am Tresen!' };
    var fee = p.club < 0 ? signFee(p) : amount;
    if (c.money - fee < -1000000) return { ok: false, text: 'Die Bank spielt nicht mit – zu wenig Geld.' };
    if (p.club >= 0) {
      if (p.neg === key && hi === p.negH) return { ok: false, text: S.clubs[p.club].name + ' verhandelt diese Woche nicht mehr mit dir.' };
      var ask = askingPrice(S, p);
      var pr = amount >= ask ? 1 : amount >= ask * 0.9 ? 0.5 : amount >= ask * 0.8 ? 0.2 : 0;
      if (!chance(pr)) {
        p.neg = key; p.negH = hi;
        return { ok: false, text: S.clubs[p.club].name + ' lehnt dein Angebot ab. "Da müssen Sie schon mehr bieten!"' };
      }
      book(S.clubs[p.club], 'transfer', amount);
    }
    book(c, 'transfer', -fee);
    p.sal = demandSalary(p);
    p.con = p.age >= 32 ? 1 : 3;
    p.mor = 75;
    var from = p.club >= 0 ? S.clubs[p.club].name : 'vereinslos';
    movePlayer(S, p, c.id);
    return { ok: true, text: fullName(p) + ' (' + from + ') wechselt zu ' + c.name + '! Ablöse: ' + fmtMoney(fee) + ', Gehalt: ' + fmtMoney(p.sal) + '/Saison.' };
  }
  function listPlayer(S, pid, factor) {
    var p = S.players[pid];
    if (!factor) { p.ask = 0; p.listedW = 0; return; }
    p.ask = roundNice(value(p) * factor); p.listedW = S.season * 100 + S.week;
  }
  function quickSell(S, hi, pid) {
    var p = S.players[pid], c = S.clubs[p.club];
    var buyers = S.clubs.filter(function (x) { return x.human < 0 && x.squad.length < MAX_SQUAD; });
    var b = pick(buyers);
    var price = roundNice(value(p) * 0.7);
    book(c, 'transfer', price);
    book(b, 'transfer', -price);
    movePlayer(S, p, b.id);
    p.con = 3; p.sal = salaryFor(p);
    return fullName(p) + ' wechselt für ' + fmtMoney(price) + ' zu ' + b.name + '.';
  }
  function releasePlayer(S, hi, pid) {
    var p = S.players[pid], c = S.clubs[p.club];
    var cost = roundNice(p.sal * p.con * 0.5);
    book(c, 'transfer', -cost);
    movePlayer(S, p, -1);
    return fullName(p) + ' wurde entlassen. Abfindung: ' + fmtMoney(cost) + '.';
  }
  function extendOffer(S, p) {
    var mult = p.mor < 40 ? 1.35 : p.mor < 60 ? 1.2 : 1.1;
    return { sal: demandSalary(p, mult), years: p.age >= 33 ? 1 : p.age >= 30 ? 2 : 3 };
  }
  function extendContract(S, pid) {
    var p = S.players[pid], o = extendOffer(S, p);
    p.sal = o.sal; p.con = Math.min(5, p.con + o.years); p.mor = clamp(p.mor + 8, 0, 100);
  }

  function marketList(S) {
    var ids = S.free.slice();
    Object.keys(S.players).forEach(function (k) {
      var p = S.players[k];
      if (p.club >= 0 && p.ask > 0) ids.push(p.id);
    });
    return ids.map(function (id) { return S.players[id]; });
  }

  function aiTransfers(S) {
    var key = S.season * 100 + S.week;
    S.clubs.forEach(function (c) {
      if (c.human >= 0) return;
      var sq = squad(S, c.id);
      // Spieler auf Transferliste setzen
      if (chance(0.12) && sq.length > 20) {
        var ts = teamStrength(S, c.id);
        var cand = sq.filter(function (p) { return c.lineup.indexOf(p.id) < 0 && p.ask === 0; });
        var lp = pick(cand);
        if (lp) listPlayer(S, lp.id, (ri(95, 130) / 100) * (lp.str > ts ? 1.2 : 1));
      }
      // alte Angebote zurückziehen
      sq.forEach(function (p) { if (p.ask && key - p.listedW > 8) listPlayer(S, p.id, 0); });
      // Einkaufen
      var need = null;
      var counts = { TW: 0, AB: 0, MF: 0, ST: 0 };
      sq.forEach(function (p) { counts[p.pos]++; });
      if (sq.length < 20) need = counts.TW < 2 ? 'TW' : POS.slice(1).sort(function (a, b) { return counts[a] - counts[b]; })[0];
      else if (chance(0.06)) need = pick(['AB', 'MF', 'ST']);
      if (!need || sq.length >= 28) return;
      var ts2 = teamStrength(S, c.id);
      var market = marketList(S).filter(function (p) {
        if (p.pos !== need || p.club === c.id) return false;
        if (p.club >= 0 && S.clubs[p.club].human >= 0) return false;
        var price = p.club < 0 ? signFee(p) : p.ask;
        return price < c.money * 0.5 && p.str >= ts2 - 10 && p.str <= ts2 + 8;
      }).sort(function (a, b) { return b.str - a.str; });
      var t = market[0];
      if (!t) return;
      var price = t.club < 0 ? signFee(t) : t.ask;
      if (t.club >= 0) book(S.clubs[t.club], 'transfer', price);
      book(c, 'transfer', -price);
      movePlayer(S, t, c.id);
      t.con = ri(2, 4); t.sal = salaryFor(t);
    });
  }
  function humanListedSales(S) {
    S.humans.forEach(function (h, hi) {
      var c = S.clubs[h.club];
      squad(S, c.id).forEach(function (p) {
        if (!p.ask) return;
        var f = p.ask / value(p);
        var pr = f <= 1.0 ? 0.35 : f <= 1.2 ? 0.18 : f <= 1.5 ? 0.07 : 0.01;
        if (!chance(pr)) return;
        var buyers = S.clubs.filter(function (b) {
          if (b.human >= 0 || b.squad.length >= MAX_SQUAD || b.money < p.ask) return false;
          var ts = teamStrength(S, b.id);
          return p.str >= ts - 12 && p.str <= ts + 12;
        });
        var b = pick(buyers);
        if (!b) return;
        var price = p.ask;
        book(c, 'transfer', price); book(b, 'transfer', -price);
        movePlayer(S, p, b.id);
        p.con = ri(2, 4); p.sal = salaryFor(p);
        msg(S, hi, 'Spieler verkauft', fullName(p) + ' wechselt für ' + fmtMoney(price) + ' zu ' + b.name + '.');
      });
    });
  }

  // ---------- Zufallsereignisse (à la Anstoß) ----------
  function rndPlayer(S, c, filt) {
    var arr = squad(S, c.id).filter(filt || function (p) { return p.inj <= 0; });
    return arr.length ? pick(arr) : null;
  }
  var EVENTS = [
    function golf(S, hi, c) {
      var p = rndPlayer(S, c); if (!p) return;
      p.inj = ri(1, 3);
      msg(S, hi, 'Golfunfall', fullName(p) + ' hat sich beim Golfspielen mit dem Präsidenten den Knöchel verknackst. Er fällt ' + p.inj + ' Woche(n) aus. Der Präsident hat übrigens gewonnen.');
    },
    function disco(S, hi, c) {
      var p = rndPlayer(S, c); if (!p) return;
      msg(S, hi, 'Nachts in der Disco', fullName(p) + ' wurde um 4 Uhr morgens tanzend auf dem Tresen der Diskothek „Flutlicht“ fotografiert. Wie reagierst du?', [
        { label: 'Geldstrafe 25.000 €', fx: { money: 25000, pid: p.id, pmor: -20, team: 2 } },
        { label: 'Öffentlich rüffeln', fx: { pid: p.id, pmor: -10, team: 3, board: 1 } },
        { label: 'Ein Auge zudrücken', fx: { pid: p.id, pmor: 5, team: -3, board: -2 } }
      ]);
    },
    function fan(S, hi, c) {
      var a = roundNice(ri(20, 150) * 1000);
      book(c, 'sonstiges', a);
      msg(S, hi, 'Großzügiger Fan', 'Ein Lottogewinner und glühender Fan von ' + c.name + ' überweist dem Verein ' + fmtMoney(a) + '. Danke, Herbert!');
    },
    function rasen(S, hi, c) {
      var a = roundNice(ri(40, 160) * 1000);
      book(c, 'sonstiges', -a);
      msg(S, hi, 'Maulwurf im Stadion', 'Ein Maulwurf hat den Rasen umgegraben. Die Reparatur kostet ' + fmtMoney(a) + '. Der Platzwart schwört Rache.');
    },
    function interview(S, hi, c) {
      var nm = nextMatch(S, c.id);
      if (!nm) return;
      var o = S.clubs[nm.opp];
      msg(S, hi, 'Interview-Anfrage', 'Das „Kicker-Echo“ will vor dem Spiel gegen ' + o.name + ' ein Statement. Was sagst du?', [
        { label: '„Wir hauen die weg!“', fx: { team: 7, board: -1, risky: 1 } },
        { label: 'Gegner loben', fx: { team: 2, board: 1 } },
        { label: '„Kein Kommentar.“', fx: {} }
      ]);
    },
    function praesident(S, hi, c) {
      msg(S, hi, 'Geburtstag des Präsidenten', 'Der Präsident wird 70 und wünscht sich eine rauschende Feier im VIP-Raum – auf Kosten der Mannschaftskasse.', [
        { label: 'Feier sponsern (80.000 €)', fx: { money: -80000, board: 10 } },
        { label: 'Blumenstrauß schicken', fx: { money: -500, board: 1 } },
        { label: 'Ablehnen', fx: { board: -6 } }
      ]);
    },
    function gehalt(S, hi, c) {
      var p = rndPlayer(S, c, function (x) { return x.str >= teamStrength(S, c.id); }); if (!p) return;
      msg(S, hi, 'Gehaltsforderung', 'Berater von ' + fullName(p) + ' ruft an: "Mein Klient fühlt sich unterbezahlt. 25 % mehr oder er wird unglücklich."', [
        { label: 'Zahlen (+25 % Gehalt)', fx: { pid: p.id, psal: 1.25, pmor: 20 } },
        { label: 'Ablehnen', fx: { pid: p.id, pmor: -25 } }
      ]);
    },
    function heiler(S, hi, c) {
      var p = rndPlayer(S, c, function (x) { return x.inj >= 2; }); if (!p) return;
      msg(S, hi, 'Wunderheiler', 'Ein dubioser Wunderheiler aus dem Allgäu verspricht, ' + fullName(p) + ' mit Kräutern und Handauflegen sofort zu heilen. Kosten: 40.000 €.', [
        { label: 'Versuchen wir es!', fx: { money: -40000, pid: p.id, heal: 1 } },
        { label: 'Nein danke', fx: {} }
      ]);
    },
    function trainingslager(S, hi, c) {
      msg(S, hi, 'Kurztrainingslager', 'Ein Hotel am Gardasee bietet ein Kurztrainingslager an. Frische und Stimmung würden profitieren. Kosten: 150.000 €.', [
        { label: 'Buchen', fx: { money: -150000, team: 6, fit: 12 } },
        { label: 'Zu teuer', fx: {} }
      ]);
    },
    function talent(S, hi, c) {
      msg(S, hi, 'Talent entdeckt', 'Dein Chefscout hat auf einem Bolzplatz ein 17-jähriges Riesentalent entdeckt. Ein Jugendvertrag kostet 60.000 €.', [
        { label: 'Verpflichten', fx: { money: -60000, youth: 1 } },
        { label: 'Kein Interesse', fx: {} }
      ]);
    },
    function sponsor(S, hi, c) {
      var a = roundNice(c.sponsor * ri(2, 5));
      msg(S, hi, 'Sponsorenangebot', 'Die Würstchenfabrik „Wurst-Willi“ möchte für ' + fmtMoney(a) + ' ihr Logo auf die Trikothosen drucken. Die Fans könnten murren.', [
        { label: 'Annehmen', fx: { money: a, fans: -0.02, team: -2 } },
        { label: 'Ablehnen', fx: { board: -1 } }
      ]);
    },
    function hund(S, hi, c) {
      var p = rndPlayer(S, c, function (x) { return x.pos === 'TW'; }); if (!p) return;
      p.mor = clamp(p.mor + 5, 0, 100);
      msg(S, hi, 'Hund frisst Handschuhe', 'Der Hund von Torwart ' + fullName(p) + ' hat dessen Glückshandschuhe gefressen. Die Kabine lacht – die Stimmung steigt.');
    },
    function grippe(S, hi, c) {
      var n = 0;
      squad(S, c.id).forEach(function (p) { if (chance(0.25)) { p.fit = clamp(p.fit - 20, 5, 100); n++; } });
      msg(S, hi, 'Grippewelle', 'Eine Grippewelle geht durch die Kabine. ' + n + ' Spieler sind geschwächt (Frische −20).');
    },
    function wetten(S, hi, c) {
      msg(S, hi, 'Mannschaftsabend', 'Der Mannschaftsrat fragt, ob der Verein den Bowlingabend bezahlt (15.000 €).', [
        { label: 'Klar, Runde geht auf uns!', fx: { money: -15000, team: 5 } },
        { label: 'Zahlt selbst', fx: { team: -3 } }
      ]);
    }
  ];
  function randomEvent(S, hi) {
    var c = S.clubs[S.humans[hi].club];
    pick(EVENTS)(S, hi, c);
  }
  function resolveChoice(S, hi, msgId, ci) {
    var h = S.humans[hi], c = S.clubs[h.club];
    var m = h.inbox.filter(function (x) { return x.id === msgId; })[0];
    if (!m || m.done) return '';
    var fx = m.choices[ci].fx, res = [];
    m.done = true; m.picked = ci;
    if (fx.money) { book(c, 'sonstiges', fx.money); res.push((fx.money > 0 ? '+' : '') + fmtMoney(fx.money)); }
    if (fx.board) { c.board = clamp(c.board + fx.board, 0, 100); res.push('Vorstand ' + (fx.board > 0 ? '+' : '') + fx.board); }
    if (fx.team) {
      var tm = fx.team;
      if (fx.risky && chance(0.4)) { tm = -4; res.push('Der Gegner hängt das Zitat in die Kabine – Bumerang!'); }
      squad(S, c.id).forEach(function (p) { p.mor = clamp(p.mor + tm, 5, 100); });
      res.push('Stimmung ' + (tm > 0 ? '+' : '') + tm);
    }
    if (fx.fit) squad(S, c.id).forEach(function (p) { p.fit = clamp(p.fit + fx.fit, 5, 100); });
    if (fx.fans) c.fans = Math.round(c.fans * (1 + fx.fans));
    var p = fx.pid != null ? S.players[fx.pid] : null;
    if (p && p.club === c.id) {
      if (fx.pmor) p.mor = clamp(p.mor + fx.pmor, 5, 100);
      if (fx.psal) p.sal = roundNice(p.sal * fx.psal);
      if (fx.heal) {
        if (chance(0.6)) { p.inj = 0; res.push(pname(p) + ' ist wie durch ein Wunder geheilt!'); }
        else res.push('Der Heiler ist mit dem Geld verschwunden. ' + pname(p) + ' bleibt verletzt.');
      }
    }
    if (fx.youth) {
      var y = newPlayer(S, c.rep - 14, pick(['AB', 'MF', 'ST']), 17);
      y.pot = Math.min(97, y.str + ri(18, 32)); y.sal = 30000; y.con = 3;
      y.club = -1; S.free.push(y.id);
      movePlayer(S, y, c.id);
      res.push(fullName(y) + ' (' + POS_NAME[y.pos] + ') ist jetzt im Kader.');
    }
    m.result = res.join(' · ');
    return m.result;
  }

  // ---------- Saisonende ----------
  function seasonEnd(S) {
    var rep = { season: S.season, tables: [], up: [], down: [], champion: [], humans: [], retired: [] };
    var tabs = S.leagues.map(function (L, li) { return table(S, li); });
    rep.tables = tabs.map(function (t) { return t.map(function (r) { return r.cid; }); });
    rep.champion = [tabs[0][0].cid, tabs[1][0].cid];
    // Prämien
    tabs.forEach(function (t, li) {
      t.forEach(function (r, i) {
        var c = S.clubs[r.cid];
        var prize = li === 0 ? roundNice(5000000 - i * 250000) : roundNice(1500000 - i * 70000);
        book(c, 'praemie', prize);
        if (i === 0) c.fans = Math.round(c.fans * 1.12);
        c.rep = clamp(Math.round(c.rep * 0.7 + teamStrength(S, c.id) * 0.3 + (li === 0 ? 8 : 0) - i * 0.3), 30, 95);
      });
    });
    // Vorstand & Saisonziel
    S.humans.forEach(function (h, hi) {
      var c = S.clubs[h.club];
      var pos = position(S, c.id);
      var ok = pos <= c.goal.pos;
      rep.humans.push({ hi: hi, club: c.id, league: c.league, pos: pos, goal: c.goal.text, ok: ok });
      c.board = clamp(c.board + (ok ? 25 : -25), 0, 100);
      msg(S, hi, 'Saisonbilanz', c.name + ' beendet die Saison auf Platz ' + pos + '. Ziel war: ' + c.goal.text + '. ' +
        (ok ? 'Der Vorstand ist hochzufrieden!' : 'Der Vorstand ist enttäuscht.'));
      if (c.board <= 0) fire(S, hi, 'Saisonziel klar verfehlt.');
    });
    // Auf-/Abstieg: 3 Plätze
    var down = tabs[0].slice(-3).map(function (r) { return r.cid; });
    var up = tabs[1].slice(0, 3).map(function (r) { return r.cid; });
    rep.up = up; rep.down = down;
    down.forEach(function (cid) {
      var c = S.clubs[cid]; c.league = 1; c.fans = Math.round(c.fans * 0.85); c.sponsor = roundNice(c.sponsor * 0.6);
      c.stadium.price = Math.min(c.stadium.price, 20);
    });
    up.forEach(function (cid) {
      var c = S.clubs[cid]; c.league = 0; c.fans = Math.round(c.fans * 1.25); c.sponsor = roundNice(c.sponsor * 1.6);
    });
    S.leagues[0].clubs = S.leagues[0].clubs.filter(function (id) { return down.indexOf(id) < 0; }).concat(up);
    S.leagues[1].clubs = S.leagues[1].clubs.filter(function (id) { return up.indexOf(id) < 0; }).concat(down);
    // Spieler: Alter, Verträge, Karriereende
    Object.keys(S.players).forEach(function (k) {
      var p = S.players[k];
      p.age++; p.yel = 0; p.goals = 0; p.apps = 0; p.sus = 0;
      if (p.age >= 30) p.str = Math.max(20, p.str - ri(0, 2) - (p.age >= 33 ? ri(1, 3) : 0));
      if (p.age >= 30) p.pot = Math.min(p.pot, p.str);
      var retire = p.age >= 37 || (p.age >= 34 && chance(0.4));
      if (retire) {
        if (p.club >= 0 && S.clubs[p.club].human >= 0) rep.retired.push({ hi: S.clubs[p.club].human, name: fullName(p) });
        movePlayer(S, p, -2);
        return;
      }
      if (p.club < 0) return;
      p.con--;
      if (p.con <= 0) {
        var c = S.clubs[p.club];
        if (c.human >= 0) {
          msg(S, c.human, 'Vertrag ausgelaufen', fullName(p) + ' hat den Verein ablösefrei verlassen.');
          movePlayer(S, p, -1);
        } else if (p.str >= teamStrength(S, c.id) - 6 && p.age < 33) {
          p.con = ri(1, 3); p.sal = salaryFor(p);
        } else movePlayer(S, p, -1);
      }
    });
    rep.retired.forEach(function (r) { msg(S, r.hi, 'Karriereende', r.name + ' hat seine Karriere beendet. Danke für alles!'); });
    // Jugend & Kader auffüllen
    S.clubs.forEach(function (c) {
      for (var y = 0; y < 2; y++) {
        var yp = newPlayer(S, c.rep - 12, pick(['TW', 'AB', 'MF', 'MF', 'ST']), ri(17, 18));
        yp.pot = Math.min(97, yp.str + ri(10, 30)); yp.sal = 25000; yp.con = 3;
        yp.club = c.id; c.squad.push(yp.id);
        if (c.human >= 0) msg(S, c.human, 'Jugendspieler', 'Aus der eigenen Jugend rückt ' + fullName(yp) + ' (' + POS_NAME[yp.pos] + ', 17) in den Profikader auf.');
      }
      if (c.human < 0) {
        var sq = squad(S, c.id), counts = { TW: 0, AB: 0, MF: 0, ST: 0 };
        sq.forEach(function (p) { counts[p.pos]++; });
        var need = { TW: 3, AB: 7, MF: 7, ST: 4 };
        POS.forEach(function (ps) {
          while (counts[ps] < need[ps]) {
            var np = newPlayer(S, c.rep - 8, ps, ri(21, 29));
            np.club = c.id; c.squad.push(np.id); counts[ps]++;
          }
        });
        sq = squad(S, c.id).sort(function (a, b) { return a.str - b.str; });
        while (c.squad.length > 27) { movePlayer(S, sq.shift(), -1); }
        c.tactic.einsatz = 'normal';
      }
      c.lineup = [];
      autoLineup(S, c);
      c.fin.season = {};
      c.board = clamp(c.board, 30, 100);
    });
    // Vereinslose: ausdünnen, auffrischen
    S.free = S.free.filter(function (id) { return S.players[id]; });
    shuffle(S.free);
    while (S.free.length > 60) movePlayer(S, S.players[S.free[0]], -2);
    for (var i = 0; i < 20; i++) { var fp = newPlayer(S, ri(40, 68), pick(['TW', 'AB', 'MF', 'ST'])); fp.club = -1; S.free.push(fp.id); }
    // Neue Saison
    S.leagues.forEach(function (L) { L.fixtures = roundRobin(L.clubs); L.results = []; });
    S.season++; S.year++; S.week = 0;
    setupGoals(S);
    S.humans.forEach(function (h, hi) {
      var c = S.clubs[h.club];
      msg(S, hi, 'Neue Saison ' + S.year + '/' + String(S.year + 1).slice(2), 'Der Vorstand erwartet in ' + S.leagues[c.league].name + ': ' + c.goal.text + '.');
    });
    return rep;
  }

  // ---------- Formatierung ----------
  function fmtNum(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtMoney(v) {
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1000000) return s + (a / 1000000).toFixed(a >= 10000000 ? 1 : 2).replace('.', ',') + ' Mio €';
    if (a >= 1000) return s + fmtNum(a / 1000) + ' T€';
    return s + fmtNum(a) + ' €';
  }

  var E = {
    WEEKS: WEEKS, POS: POS, POS_NAME: POS_NAME, FORMATIONS: FORMATIONS, TRAINING: TRAINING, STADIUM_BUILD: STADIUM_BUILD, MAX_SQUAD: MAX_SQUAD,
    newGame: newGame, playMatchday: playMatchday, postMatchday: postMatchday, simulateMatch: simulateMatch,
    autoLineup: autoLineup, repairLineup: repairLineup, slotsFor: slotsFor, effStr: effStr, posFactor: posFactor,
    teamStrength: teamStrength, table: table, position: position, nextMatch: nextMatch, squad: squad,
    value: value, salaryFor: salaryFor, askingPrice: askingPrice, signFee: signFee, demandSalary: demandSalary,
    makeOffer: makeOffer, listPlayer: listPlayer, quickSell: quickSell, releasePlayer: releasePlayer,
    extendOffer: extendOffer, extendContract: extendContract, marketList: marketList,
    resolveChoice: resolveChoice, book: book, attendance: attendance, msg: msg,
    pname: pname, fullName: fullName, available: available, fmtMoney: fmtMoney, fmtNum: fmtNum, ri: ri
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  root.ENGINE = E;
})(typeof window !== 'undefined' ? window : globalThis);
