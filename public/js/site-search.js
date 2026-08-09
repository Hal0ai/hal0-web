// Site search for marketing pages — the comp's ⌘K palette (01 Unified
// Chrome, spec 06) over the same Pagefind index Starlight builds. The
// one-header unification put a search button on every page; Starlight
// routes already have their (identically styled) Pagefind modal, so this
// covers the MarketingLayout half: a <dialog class="pal"> with mono
// result rows, source tags, and arrow-key selection. Pagefind's JS API
// (/pagefind/pagefind.js) loads lazily on first open — zero cost for
// visitors who never search. Styles: site.css "search palette" section.
(() => {
	const openers = document.querySelectorAll('[data-site-search-open]');
	if (!openers.length) return;

	const PREFIXES = [
		['/docs/', 'docs'],
		['/kb/', 'kb'],
		['/blog/', 'blog'],
		['/changelog', 'changelog'],
	];
	const tagFor = (url) => {
		try {
			const p = new URL(url, location.origin).pathname;
			for (const [prefix, tag] of PREFIXES) if (p.startsWith(prefix)) return tag;
		} catch {
			/* fall through */
		}
		return 'page';
	};

	let dialog, input, resultsEl, msgEl, pagefind;
	let rows = [];
	let sel = -1;

	const build = () => {
		dialog = document.createElement('dialog');
		dialog.className = 'pal';
		dialog.setAttribute('aria-label', 'Search');
		dialog.innerHTML =
			'<div class="pal-in">' +
			'<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>' +
			'<input type="search" placeholder="Search" autocomplete="off" spellcheck="false" />' +
			'<span class="k">esc</span>' +
			'</div>' +
			'<div class="pal-results" role="listbox"></div>';
		document.body.appendChild(dialog);
		input = dialog.querySelector('input');
		resultsEl = dialog.querySelector('.pal-results');

		input.addEventListener('input', () => search(input.value));
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) dialog.close();
		});
		dialog.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				if (!rows.length) return;
				sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
				rows.forEach((r, i) => r.classList.toggle('on', i === sel));
				rows[sel].scrollIntoView({ block: 'nearest' });
			} else if (e.key === 'Enter') {
				const target = sel >= 0 ? rows[sel] : rows[0];
				if (target) location.href = target.href;
			}
		});
	};

	const setMsg = (text) => {
		resultsEl.innerHTML = '';
		rows = [];
		sel = -1;
		if (text) {
			const m = document.createElement('div');
			m.className = 'pal-msg';
			m.textContent = text;
			resultsEl.appendChild(m);
		}
	};

	let seq = 0;
	const search = async (q) => {
		if (!q.trim()) return setMsg('');
		if (!pagefind) {
			setMsg('loading index…');
			try {
				pagefind = await import('/pagefind/pagefind.js');
				await pagefind.init();
			} catch {
				return setMsg('search index unavailable');
			}
		}
		const my = ++seq;
		const res = await pagefind.debouncedSearch(q);
		if (res === null || my !== seq) return; // superseded keystroke
		const top = await Promise.all(res.results.slice(0, 10).map((r) => r.data()));
		if (my !== seq) return;
		setMsg(`${res.results.length} result${res.results.length === 1 ? '' : 's'} for ${q}`);
		for (const d of top) {
			const a = document.createElement('a');
			a.className = 'pal-row';
			a.href = d.url;
			const t = document.createElement('span');
			t.className = 't';
			t.textContent = d.meta?.title || d.url;
			const x = document.createElement('span');
			x.className = 'x';
			x.innerHTML = d.excerpt || '';
			const src = document.createElement('span');
			src.className = 'src';
			src.textContent = tagFor(d.url);
			const head = document.createElement('span');
			head.style.cssText = 'display:flex;align-items:baseline;gap:10px;flex:1;min-width:0';
			head.append(t, src);
			const wrap = document.createElement('span');
			wrap.style.cssText = 'display:block;flex:1;min-width:0';
			wrap.append(head, x);
			a.appendChild(wrap);
			resultsEl.appendChild(a);
			rows.push(a);
		}
	};

	const open = () => {
		if (!dialog) build();
		dialog.showModal();
		input.value = '';
		setMsg('');
		input.focus();
	};

	openers.forEach((b) => b.addEventListener('click', open));
	document.addEventListener('keydown', (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			if (dialog?.open) dialog.close();
			else open();
		}
	});
})();
