/* Agnoritus math engine: tokenizer + recursive-descent parser (no eval). */
(function (root) {
  'use strict';
  class MathErr extends Error {}
  const NAMES = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'cbrt', 'abs', 'ans', 'pi', 'e'];
  const OPS = { '+': '+', '-': '-', '−': '-', '×': '*', '*': '*', '÷': '/', '/': '/', '^': '^', '!': '!', '%': '%', '(': '(', ')': ')' };

  function tokenize(s, ans) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const t = s.slice(i, j);
        if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) throw new MathErr('Syntax error');
        out.push({ t: 'n', v: parseFloat(t) }); i = j; continue;
      }
      if (c === 'π') { out.push({ t: 'n', v: Math.PI }); i++; continue; }
      if (c === '√') { out.push({ t: 'f', v: 'sqrt' }); i++; continue; }
      if (c === '∛') { out.push({ t: 'f', v: 'cbrt' }); i++; continue; }
      if (/[a-z]/i.test(c)) {
        const rest = s.slice(i).toLowerCase();
        const n = NAMES.find(x => rest.startsWith(x));
        if (!n) throw new MathErr('Unknown symbol');
        if (n === 'pi') out.push({ t: 'n', v: Math.PI });
        else if (n === 'e') out.push({ t: 'n', v: Math.E });
        else if (n === 'ans') out.push({ t: 'n', v: ans == null ? 0 : ans });
        else out.push({ t: 'f', v: n });
        i += n.length; continue;
      }
      if (OPS[c]) { out.push({ t: 'o', v: OPS[c] }); i++; continue; }
      throw new MathErr('Unknown symbol');
    }
    return out;
  }

  function fact(n) {
    if (n < 0 || !Number.isInteger(n)) throw new MathErr('Factorial needs a whole number ≥ 0');
    if (n > 170) throw new MathErr('Result too large');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function evaluate(src, opt) {
    opt = opt || {};
    const deg = opt.deg !== false;
    if (!src || !src.trim()) return null;
    if (src.length > 400) throw new MathErr('Expression too long');
    const open = (src.match(/\(/g) || []).length, close = (src.match(/\)/g) || []).length;
    if (close > open) throw new MathErr('Unbalanced parentheses');
    const T = tokenize(src + ')'.repeat(open - close), opt.ans);
    let p = 0;
    const rad = x => (deg ? x * Math.PI / 180 : x);
    const out = x => (deg ? x * 180 / Math.PI : x);
    const snap = v => (Math.abs(v) < 1e-14 ? 0 : v);
    const need = (ok, m) => { if (!ok) throw new MathErr(m || 'Invalid input'); };
    const F = {
      sin: x => (deg && x % 180 === 0 ? 0 : snap(Math.sin(rad(x)))),
      cos: x => (deg && (x - 90) % 180 === 0 ? 0 : snap(Math.cos(rad(x)))),
      tan: x => {
        need(deg ? (x - 90) % 180 !== 0 : Math.abs(Math.cos(x)) > 1e-15, 'tan is undefined here');
        return snap(Math.tan(rad(x)));
      },
      asin: x => { need(Math.abs(x) <= 1, 'sin⁻¹ needs a value from −1 to 1'); return out(Math.asin(x)); },
      acos: x => { need(Math.abs(x) <= 1, 'cos⁻¹ needs a value from −1 to 1'); return out(Math.acos(x)); },
      atan: x => out(Math.atan(x)),
      log: x => { need(x > 0, 'log needs a positive value'); return Math.log10(x); },
      ln: x => { need(x > 0, 'ln needs a positive value'); return Math.log(x); },
      sqrt: x => { need(x >= 0, 'Square root of a negative number'); return Math.sqrt(x); },
      cbrt: Math.cbrt,
      abs: Math.abs
    };
    const isO = v => T[p] && T[p].t === 'o' && T[p].v === v;
    const expect = () => { if (!isO(')')) throw new MathErr('Syntax error'); p++; };

    function expr() {
      let l = term();
      while (isO('+') || isO('-')) { const o = T[p++].v; const r = term(); l = o === '+' ? l + r : l - r; }
      return l;
    }
    function term() {
      let l = unary();
      for (;;) {
        const t = T[p];
        if (!t) break;
        if (isO('*')) { p++; l *= unary(); }
        else if (isO('/')) { p++; const r = unary(); if (r === 0) throw new MathErr('Cannot divide by zero'); l /= r; }
        else if (t.t === 'n' || t.t === 'f' || isO('(')) l *= unary(); // implicit multiplication
        else break;
      }
      return l;
    }
    function unary() {
      if (isO('-')) { p++; return -unary(); }
      if (isO('+')) { p++; return unary(); }
      return power();
    }
    function power() {
      const b = postfix();
      if (!isO('^')) return b;
      p++;
      const e = unary();
      if (b === 0 && e < 0) throw new MathErr('Cannot divide by zero');
      const r = Math.pow(b, e);
      if (Number.isNaN(r)) throw new MathErr('Invalid power');
      return r;
    }
    function postfix() {
      let v = primary();
      while (isO('!') || isO('%')) v = T[p++].v === '!' ? fact(v) : v / 100;
      return v;
    }
    function primary() {
      const t = T[p++];
      if (!t) throw new MathErr('Incomplete expression');
      if (t.t === 'n') return t.v;
      if (t.t === 'f') {
        if (!isO('(')) throw new MathErr('Syntax error');
        p++; const a = expr(); expect();
        return F[t.v](a);
      }
      if (t.v === '(') { const a = expr(); expect(); return a; }
      throw new MathErr(t.v === ')' ? 'Empty parentheses' : 'Incomplete expression');
    }

    const v = expr();
    if (p < T.length) throw new MathErr('Syntax error');
    if (Number.isNaN(v)) throw new MathErr('Undefined result');
    if (!Number.isFinite(v)) throw new MathErr('Result too large');
    return v;
  }

  function format(v) {
    if (Object.is(v, -0) || v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e15 || a < 1e-6) {
      const [m, e] = v.toExponential(9).split('e');
      return m.replace(/\.?0+$/, '') + '×10^' + e.replace('+', '').replace('-', '−');
    }
    return String(parseFloat(v.toPrecision(12)));
  }

  const api = { evaluate, format, MathErr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgnoritusEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
