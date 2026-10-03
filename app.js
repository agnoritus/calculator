(function () {
  'use strict';
  const { evaluate, format, MathErr } = window.AgnoritusEngine;
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // [label, input, class, aria-label, span]
  const SCI = [
    ['sin', 'sin(', 's'], ['cos', 'cos(', 's'], ['tan', 'tan(', 's'], ['π', 'π', 's', 'Pi'], ['e', 'e', 's', 'Euler’s number'],
    ['sin⁻¹', 'asin(', 's', 'Arc sine'], ['cos⁻¹', 'acos(', 's', 'Arc cosine'], ['tan⁻¹', 'atan(', 's', 'Arc tangent'], ['Ans', 'Ans', 's', 'Previous answer'], ['x!', '!', 's', 'Factorial'],
    ['log', 'log(', 's', 'Log base 10'], ['ln', 'ln(', 's', 'Natural log'], ['10ˣ', '10^(', 's', 'Ten to the power'], ['eˣ', 'e^(', 's', 'e to the power'], ['|x|', 'abs(', 's', 'Absolute value'],
    ['√x', '√(', 's', 'Square root'], ['∛x', '∛(', 's', 'Cube root'], ['x²', '^2', 's', 'Square'], ['x³', '^3', 's', 'Cube'], ['xʸ', '^', 's', 'Power'],
    ['(', '(', 'p', 'Open parenthesis', 2], [')', ')', 'p', 'Close parenthesis', 2], ['1/x', '^(−1)', 's', 'Reciprocal']
  ];
  const PAD = [
    ['AC', 'ac', 'f', 'All clear'], ['DEL', 'del', 'f', 'Delete'], ['%', '%', 'o', 'Percent'], ['÷', '÷', 'o', 'Divide'],
    ['7', '7', 'n'], ['8', '8', 'n'], ['9', '9', 'n'], ['×', '×', 'o', 'Multiply'],
    ['4', '4', 'n'], ['5', '5', 'n'], ['6', '6', 'n'], ['−', '−', 'o', 'Subtract'],
    ['1', '1', 'n'], ['2', '2', 'n'], ['3', '3', 'n'], ['+', '+', 'o', 'Add'],
    ['0', '0', 'n', 'Zero', 2], ['.', '.', 'n', 'Decimal point'], ['=', 'eq', 'eq', 'Equals']
  ];

  function build(list, cls) {
    const wrap = document.createElement('div');
    wrap.className = cls;
    list.forEach(([label, v, c, aria, span]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key ' + c + (span ? ' w2' : '');
      b.textContent = label;
      b.dataset.in = v;
      if (aria) b.setAttribute('aria-label', aria);
      wrap.appendChild(b);
    });
    $('keys').appendChild(wrap);
  }
  build(SCI, 'sci');
  build(PAD, 'pad');

  const st = { expr: '', res: '', just: false, ans: null, deg: store.get('agn-deg', '1') === '1', err: '', hist: [] };
  try { st.hist = JSON.parse(store.get('agn-hist', '[]')) || []; } catch (e) { st.hist = []; }
  const main = $('main'), sub = $('sub');
  const OP = '+−×÷';
  const FN_END = /(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|ln\(|abs\(|√\(|∛\(|Ans)$/;

  function opts() { return { deg: st.deg, ans: st.ans }; }

  function render() {
    const text = st.just ? st.res : st.expr || '0';
    main.textContent = text;
    main.className = 'main' + (text.length > 30 ? ' xs' : text.length > 20 ? ' s' : text.length > 12 ? ' m' : '');
    main.scrollLeft = main.scrollWidth;
    sub.className = 'sub';
    if (st.err) { sub.textContent = st.err; sub.classList.add('err'); return; }
    if (st.just) { sub.textContent = st.expr + ' ='; return; }
    let prev = '';
    if (st.expr && !/^[0-9.]+$/.test(st.expr)) {
      try { const v = evaluate(st.expr, opts()); if (v != null) prev = '= ' + format(v); } catch (e) {}
    }
    sub.textContent = prev;
    sub.scrollLeft = sub.scrollWidth;
  }

  function clear() { st.expr = ''; st.res = ''; st.just = false; st.err = ''; render(); }

  function del() {
    if (st.just) return clear();
    st.err = '';
    st.expr = FN_END.test(st.expr) ? st.expr.replace(FN_END, '') : st.expr.slice(0, -1);
    render();
  }

  function equals() {
    if (!st.expr || st.just) return;
    try {
      const v = evaluate(st.expr, opts());
      st.res = format(v); st.ans = v; st.just = true; st.err = '';
      if (st.res !== st.expr) {
        st.hist.unshift({ e: st.expr, r: st.res });
        st.hist = st.hist.slice(0, 50);
        store.set('agn-hist', JSON.stringify(st.hist));
        renderHistory();
      }
    } catch (e) {
      st.err = e instanceof MathErr ? e.message : 'Syntax error';
    }
    render();
  }

  function press(t) {
    if (t === 'ac') return clear();
    if (t === 'del') return del();
    if (t === 'eq') return equals();
    const c = t[0], isBin = OP.includes(c), isPost = '^!%'.includes(c);
    if (st.just) {
      if ((isBin || isPost) && st.ans != null) st.expr = 'Ans'; else st.expr = '';
      st.just = false;
    }
    st.err = '';
    let e = st.expr;
    if (e.length > 200) return;
    const last = e.slice(-1);
    if (t === '.') {
      const num = e.match(/[0-9.]*$/)[0];
      if (num.includes('.')) return;
      if (num === '') e += '0';
    } else if (isBin) {
      if (e === '') { if (c === '−') { /* leading minus */ } else if (st.ans != null) e = 'Ans'; else return; }
      else if (OP.includes(last) && !(c === '−' && '×÷'.includes(last))) e = e.slice(0, -1);
      else if (last === '(' && c !== '−') return;
    } else if (isPost) {
      if (!/[0-9)πe!%s]$/.test(e)) return;
    } else if (t === ')') {
      const open = (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length;
      if (open <= 0 || !/[0-9)πe!%s]$/.test(e)) return;
    }
    st.expr = e + t;
    render();
  }

  // Clicks
  $('keys').addEventListener('click', ev => {
    const b = ev.target.closest('.key');
    if (b) press(b.dataset.in);
  });

  // Keyboard
  const KEYMAP = { '*': '×', '/': '÷', '-': '−', Enter: 'eq', '=': 'eq', Backspace: 'del', Delete: 'del', Escape: 'ac', p: 'π' };
  document.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key;
    let t = null;
    if (/^[0-9.+^()!%]$/.test(k)) t = k;
    else if (KEYMAP[k]) t = KEYMAP[k];
    else if (k === ',') t = '.';
    if (t == null) return;
    if (ev.target.closest && ev.target.closest('#history button') && k === 'Enter') return;
    ev.preventDefault();
    press(t);
    const b = document.querySelector('.key[data-in="' + t + '"]');
    if (b) { b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 110); }
  });

  // DEG / RAD
  function setMode() {
    document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.mode === 'deg') === st.deg)));
    store.set('agn-deg', st.deg ? '1' : '0');
    render();
  }
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { st.deg = b.dataset.mode === 'deg'; setMode(); }));

  // Theme
  $('theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('agn-theme', next);
  });

  // Copy
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); return true; } catch (e) {}
    const ta = document.createElement('textarea');
    ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }
  $('copy').addEventListener('click', async () => {
    let s = st.just ? st.res : '';
    if (!s && st.expr) { try { const v = evaluate(st.expr, opts()); s = v == null ? st.expr : format(v); } catch (e) { s = st.expr; } }
    const btn = $('copy');
    if (!s) return;
    btn.textContent = (await copyText(s)) ? 'Copied' : 'Copy failed';
    setTimeout(() => (btn.textContent = 'Copy'), 1400);
  });

  // History
  const panel = $('history'), hbtn = $('hist-btn');
  function toggleHistory(open) {
    panel.hidden = false;
    panel.classList.toggle('open', open);
    hbtn.setAttribute('aria-expanded', String(open));
    hbtn.textContent = open ? 'Close' : 'History';
  }
  hbtn.addEventListener('click', () => toggleHistory(!panel.classList.contains('open')));
  $('hist-clear').addEventListener('click', () => { st.hist = []; store.set('agn-hist', '[]'); renderHistory(); });

  function renderHistory() {
    const ul = $('hist-list');
    ul.textContent = '';
    if (!st.hist.length) {
      const p = document.createElement('li');
      p.className = 'empty';
      p.textContent = 'Your calculations will appear here.';
      ul.appendChild(p); return;
    }
    st.hist.forEach(h => {
      const li = document.createElement('li');
      const a = document.createElement('button'), r = document.createElement('button');
      a.type = r.type = 'button';
      a.className = 'h-e'; a.textContent = h.e + ' ='; a.title = 'Reuse expression';
      r.className = 'h-r'; r.textContent = h.r; r.title = 'Use result';
      a.addEventListener('click', () => { st.expr = h.e; st.just = false; st.err = ''; render(); toggleHistory(false); });
      r.addEventListener('click', () => {
        if (st.just) { st.expr = ''; st.just = false; }
        st.err = ''; st.expr += h.r; render(); toggleHistory(false);
      });
      li.append(a, r); ul.appendChild(li);
    });
  }

  panel.hidden = false;
  renderHistory();
  setMode();
})();
