(function () {
  var s = document.currentScript;
  var endpoint = s.getAttribute('data-endpoint');
  var key = s.getAttribute('data-key') || '';
  var title = s.getAttribute('data-title') || 'Assistant';
  var placeholder = s.getAttribute('data-placeholder') || 'Ask a question…';
  var mode = s.getAttribute('data-mode') || 'floating';
  var mount = s.getAttribute('data-mount');

  var SID = 'docentic_sid';
  var sid = localStorage.getItem(SID);
  if (!sid) { sid = 'd_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(SID, sid); }

  var scope; // the element that holds [data-log], [data-form], [name=website]

  if (mode === 'inline') {
    // Render into the page flow; inherit the site's own typography.
    scope = mount && document.querySelector(mount);
    if (!scope) return;
    scope.innerHTML =
      '<div data-log style="margin:1em 0"></div>' +
      '<form data-form style="display:flex;gap:.5em;align-items:baseline">' +
      '<input data-in style="flex:1;font:inherit;padding:.3em;border:1px solid currentColor;background:transparent;color:inherit">' +
      '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      '<button style="font:inherit;padding:.3em .9em;cursor:pointer">Sor</button>' +
      '</form>';
  } else {
    // Floating corner box with its own minimal styling.
    scope = document.createElement('div');
    scope.style.cssText = 'position:fixed;right:20px;bottom:20px;width:340px;max-width:90vw;font:14px/1.5 system-ui,sans-serif;border:1px solid #ccc;border-radius:8px;background:#fff;color:#111;box-shadow:0 4px 24px rgba(0,0,0,.12);z-index:99999';
    scope.innerHTML =
      '<div data-head style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600"></div>' +
      '<div data-log style="padding:12px;max-height:320px;overflow:auto"></div>' +
      '<form data-form style="display:flex;gap:6px;padding:10px;border-top:1px solid #eee">' +
      '<input data-in style="flex:1;padding:8px;border:1px solid #ccc;border-radius:6px;font:inherit">' +
      '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      '<button style="padding:8px 12px;border:0;border-radius:6px;background:#111;color:#fff;cursor:pointer">Ask</button>' +
      '</form>';
    scope.querySelector('[data-head]').textContent = title;
    document.body.appendChild(scope);
  }

  var log = scope.querySelector('[data-log]');
  var form = scope.querySelector('[data-form]');
  var input = scope.querySelector('[data-in]');
  var honey = scope.querySelector('[name=website]');
  input.setAttribute('placeholder', placeholder);

  function bubble(text, who) {
    var d = document.createElement('div');
    if (mode === 'inline') {
      d.style.cssText = who === 'me'
        ? 'margin:.7em 0;opacity:.55'
        : 'margin:.7em 0;border-left:2px solid currentColor;padding-left:.8em';
      d.textContent = text;
      log.appendChild(d);
      return d;
    }
    d.style.cssText = 'margin:8px 0;' + (who === 'me' ? 'text-align:right' : '');
    var span = document.createElement('span');
    span.style.cssText = 'display:inline-block;padding:6px 10px;border-radius:8px;background:' + (who === 'me' ? '#111' : '#f2f2f2') + ';color:' + (who === 'me' ? '#fff' : '#111');
    span.textContent = text;
    d.appendChild(span);
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return span;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var q = input.value.trim(); if (!q) return;
    bubble(q, 'me'); input.value = '';
    var out = bubble('…', 'bot'); var acc = '';
    try {
      var res = await fetch(endpoint + '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, key: key, message: q, website: honey.value }),
      });
      if (!res.ok || !res.body) { out.textContent = 'Server error (' + res.status + ').'; return; }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      for (;;) {
        var r = await reader.read(); if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          var block = buf.slice(0, i); buf = buf.slice(i + 2);
          var ev = (block.match(/event: (.*)/) || [])[1];
          var dm = block.match(/data: (.*)/);
          if (!dm) continue;
          var data = JSON.parse(dm[1]);
          if (ev === 'delta') { acc += data.text; out.textContent = acc; if (mode !== 'inline') log.scrollTop = log.scrollHeight; }
          if (ev === 'error') { out.textContent = 'Error: ' + data.message; }
        }
      }
      if (!acc) out.textContent = 'No response received.';
    } catch (err) { out.textContent = 'Connection error.'; }
  });
})();
