(function () {
  var SID = 'docentic_sid';
  var sid = localStorage.getItem(SID);
  if (!sid) { sid = 'd_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(SID, sid); }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function ensureStyle() {
    if (document.getElementById('dctc-style')) return;
    var st = document.createElement('style');
    st.id = 'dctc-style';
    st.textContent =
      '.dctc{font:inherit}' +
      '.dctc [data-log]{max-height:20em;overflow-y:auto}' +
      '.dctc .dctc-head{margin:0 0 .8em}' +
      '.dctc .dctc-head img{height:1.9em;width:auto;display:block}' +
      '.dctc form{display:flex;gap:.6em;align-items:baseline;margin-top:1.2em}' +
      '.dctc input.q{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;color:inherit;background:transparent;border:1px solid currentColor;border-radius:0;padding:.5em .6em;outline:none}' +
      '.dctc input.q::placeholder{opacity:.4}' +
      '.dctc button{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:none;border:1px solid currentColor;border-radius:0;cursor:pointer;color:inherit;padding:.5em .8em}' +
      '.dctc button:hover{background:#111;color:#fff}' +
      '@media(prefers-color-scheme:dark){.dctc button:hover{background:#eee;color:#111}}' +
      '.dctc .msg{margin:1.1em 0;animation:dctc-in .4s ease}' +
      '.dctc .q-me{opacity:.5;font-style:italic}' +
      '.dctc .q-me::before{content:"— "}' +
      '.dctc .a{border-left:3px solid currentColor;padding-left:1em}' +
      '.dctc .a .who{display:block;font-style:italic;opacity:.5;font-size:.85em;margin-bottom:.2em}' +
      '.dctc .a .who img{height:1.35em;width:auto;vertical-align:-.25em;opacity:1;margin-bottom:.15em}' +
      '.dctc .a.streaming .body::after{content:"▌";animation:dctc-blink 1s steps(1) infinite;opacity:.6}' +
      '.dctc .a.loading .body{opacity:.55;font-style:italic}' +
      '@keyframes dctc-in{from{opacity:0;transform:translateY(.3em)}to{opacity:1;transform:none}}' +
      '@keyframes dctc-blink{50%{opacity:0}}';
    document.head.appendChild(st);
  }

  var SVG_SEARCH = '<svg viewBox="0 0 24 24" width="12" height="12" style="vertical-align:-1px" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
  var SVG_READ = '<svg viewBox="0 0 24 24" width="12" height="12" style="vertical-align:-1px" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>';
  function toolHtml(name, args) {
    if (name === 'search') return SVG_SEARCH + ' ' + (args && args.query ? '“' + esc(args.query) + '”' : '');
    if (name === 'read_page') return SVG_READ + ' ' + (args && args.page_id ? esc(String(args.page_id).replace(/\/$/, '').split('/').pop()) : '');
    return SVG_READ;
  }

  var GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽'];
  var FRAMES = GLYPHS.concat(GLYPHS.slice().reverse());

  // cfg: { endpoint, key, mode, mount, label, avatar, placeholder, verbs,
  //        title, nameLabel, emailLabel, messageLabel, sendLabel, emptyLabel, thanksLabel }
  function boot(cfg) {
    var endpoint = cfg.endpoint;
    if (!endpoint) return;
    var key = cfg.key || '';
    var mode = cfg.mode || 'floating';
    var label = cfg.label || 'assistant';
    var avatar = cfg.avatar || '';
    var placeholder = cfg.placeholder || 'Ask a question…';
    var VERBS = (cfg.verbs || 'Thinking,Pondering,Cogitating,Noodling,Percolating,Mulling,Puzzling,Brewing,Musing,Ruminating,Tinkering,Rummaging,Digging,Sifting,Scheming,Conjuring,Untangling,Deliberating').split(',');

    // --- Contact form mode ---
    if (mode === 'contact') {
      var host = cfg.mount && document.querySelector(cfg.mount);
      if (!host) return;
      var cIn = 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;color:inherit;background:transparent;border:1px solid currentColor;border-radius:0;padding:.5em .6em';
      host.innerHTML =
        '<form data-cform style="display:flex;flex-direction:column;gap:.7em;max-width:32em">' +
        '<input data-cname placeholder="' + esc(cfg.nameLabel || 'Adın (opsiyonel)') + '" style="' + cIn + '">' +
        '<input data-cmail type="email" placeholder="' + esc(cfg.emailLabel || 'E-posta (opsiyonel)') + '" style="' + cIn + '">' +
        '<textarea data-cmsg rows="3" placeholder="' + esc(cfg.messageLabel || 'Mesajın…') + '" style="' + cIn + ';resize:vertical"></textarea>' +
        '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
        '<div style="display:flex;gap:1em;align-items:center"><button style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:none;border:1px solid currentColor;border-radius:0;cursor:pointer;color:inherit;padding:.5em .8em">' + esc(cfg.sendLabel || 'gönder →') + '</button><span data-cnote style="opacity:.6;font-style:italic"></span></div>' +
        '</form>';
      var cf = host.querySelector('[data-cform]');
      var cnote = host.querySelector('[data-cnote]');
      cf.addEventListener('submit', async function (e) {
        e.preventDefault();
        var msg = host.querySelector('[data-cmsg]').value.trim();
        if (!msg) { cnote.textContent = cfg.emptyLabel || 'Mesaj boş.'; return; }
        cnote.textContent = '…';
        try {
          var res = await fetch(endpoint + '/contact', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sid, key: key,
              name: host.querySelector('[data-cname]').value.trim(),
              email: host.querySelector('[data-cmail]').value.trim(),
              message: msg, website: host.querySelector('[name=website]').value,
            }),
          });
          if (res.ok) { cf.innerHTML = '<p style="opacity:.7;font-style:italic">' + esc(cfg.thanksLabel || 'İletildi, teşekkürler.') + '</p>'; }
          else { cnote.textContent = 'Hata (' + res.status + ').'; }
        } catch (err) { cnote.textContent = 'Bağlantı hatası.'; }
      });
      return;
    }

    // --- Chat mode (inline or floating) ---
    var scope;
    if (mode === 'inline') {
      scope = cfg.mount && document.querySelector(cfg.mount);
      if (!scope) return;
      ensureStyle();
      scope.className = 'dctc';
      scope.innerHTML =
        (avatar ? '<div class="dctc-head"><img src="' + esc(avatar) + '" alt="' + esc(label) + '"></div>' : '') +
        '<div data-log></div>' +
        '<form data-form>' +
        '<input class="q" data-in>' +
        '<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
        '<button>sor →</button>' +
        '</form>';
    } else {
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
      scope.querySelector('[data-head]').textContent = cfg.title || 'Assistant';
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
        if (who === 'me') { d.className = 'msg q-me'; d.textContent = text; log.appendChild(d); return d; }
        d.className = 'msg a streaming';
        d.innerHTML = avatar ? '<span class="body"></span>' : '<span class="who"></span><span class="body"></span>';
        if (!avatar) d.querySelector('.who').textContent = label;
        d.querySelector('.body').textContent = text;
        log.appendChild(d);
        return d.querySelector('.body');
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
      var out = bubble('', 'bot'); var acc = '';
      var a = out.closest ? out.closest('.a') : null;

      var verb = VERBS[Math.floor(Math.random() * VERBS.length)].trim();
      var t0 = Date.now(); var frame = 0; var toolLine = '';
      if (a) a.classList.remove('streaming');
      var spin = setInterval(function () {
        frame++;
        var g = FRAMES[frame % FRAMES.length];
        var secs = Math.floor((Date.now() - t0) / 1000);
        out.innerHTML = esc(g + ' ') + (toolLine || esc(verb + '…')) + (secs > 0 ? esc(' · ' + secs + 's') : '');
        if (a) a.classList.add('loading');
      }, 120);
      function stopSpin() { if (spin) { clearInterval(spin); spin = null; } if (a) a.classList.remove('loading'); }

      try {
        var res = await fetch(endpoint + '/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sid, key: key, message: q, website: honey.value }),
        });
        if (!res.ok || !res.body) { stopSpin(); out.textContent = 'Server error (' + res.status + ').'; return; }
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
            if (ev === 'tool') { toolLine = toolHtml(data.name, data.args); }
            if (ev === 'delta') {
              if (spin) { stopSpin(); out.textContent = ''; if (a) a.classList.add('streaming'); }
              acc += data.text; out.textContent = acc;
              log.scrollTop = log.scrollHeight;
            }
            if (ev === 'error') { stopSpin(); out.textContent = 'Error: ' + data.message; }
          }
        }
        stopSpin();
        if (!acc) out.textContent = 'No response received.';
      } catch (err) { stopSpin(); out.textContent = 'Connection error.'; }
      if (a) a.classList.remove('streaming');
    });
  }

  function fromScript(s) {
    return {
      endpoint: s.getAttribute('data-endpoint'), key: s.getAttribute('data-key'),
      mode: s.getAttribute('data-mode'), mount: s.getAttribute('data-mount'),
      label: s.getAttribute('data-label'), avatar: s.getAttribute('data-avatar'),
      placeholder: s.getAttribute('data-placeholder'), verbs: s.getAttribute('data-verbs'),
      title: s.getAttribute('data-title'),
      nameLabel: s.getAttribute('data-name-label'), emailLabel: s.getAttribute('data-email-label'),
      messageLabel: s.getAttribute('data-message-label'), sendLabel: s.getAttribute('data-send-label'),
      emptyLabel: s.getAttribute('data-empty-label'), thanksLabel: s.getAttribute('data-thanks-label'),
    };
  }

  window.docentic = boot;
  var s = document.currentScript;
  if (s && s.getAttribute('data-endpoint')) boot(fromScript(s));
})();
