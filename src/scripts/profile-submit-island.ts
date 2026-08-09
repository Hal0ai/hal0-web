/**
 * profile-submit-island.ts — DOM wiring for /profiles/submit.
 *
 * All decision logic (TOML parse, shape checks, the four validation
 * states, the duplicate-slug edge state, the GitHub URL builder) lives in
 * src/lib/profile-validate.mjs and is unit tested there
 * (scripts/test/profile-validate.test.mjs). This file only reads DOM
 * state (upload/paste tab, textarea contents, the optional flag-override
 * field), calls those pure functions, and paints the result back into the
 * three-step rail — same split of responsibility as bench-island.ts.
 *
 * No sign-in step, no submit-on-your-behalf: the GitHub App/Worker that
 * would open a PR on the user's behalf doesn't exist yet (deliberate
 * scope cut, see the PR body). The final step instead opens GitHub's own
 * "new file" page, pre-filled via query params — GitHub handles
 * fork/branch/PR for non-writers, so no git commands run on our end.
 */
import { validateProfileToml, githubSubmitUrl } from '../lib/profile-validate.mjs';
import { renderProfileToml } from '../lib/profiles-join.mjs';
import { ROSTER } from '../data/model-roster.ts';
import profilesSnapshot from '../data/profiles.json';

const EXISTING_PROFILES = profilesSnapshot.profiles;

// profile-validate.mjs is plain JS with JSDoc, not .ts — astro check widens
// its discriminated-union return shapes to a bare `object`, so the state
// checks below (`result.state === '...'`) need an escape hatch rather than
// threading `as any` through every access site.
type ValidationResult = any;

const root = document.querySelector<HTMLElement>('[data-submit-root]');
if (root) {
  const rail = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-submit-rail] button'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-step-panel]'));
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode-tab]'));
  const dropzone = root.querySelector<HTMLElement>('[data-dropzone]');
  const fileInput = root.querySelector<HTMLInputElement>('[data-file-input]');
  const textarea = root.querySelector<HTMLTextAreaElement>('[data-toml-input]');
  const flagOverride = root.querySelector<HTMLInputElement>('[data-flag-override]');
  const filenameBadge = root.querySelector<HTMLElement>('[data-filename-badge]');
  const validateBtn = root.querySelector<HTMLButtonElement>('[data-validate-btn]');
  const revalidateBtn = root.querySelector<HTMLButtonElement>('[data-revalidate-btn]');
  const continueBtn = root.querySelector<HTMLButtonElement>('[data-continue-btn]');
  const backToStep0 = root.querySelector<HTMLButtonElement>('[data-back-0]');
  const backToStep1 = root.querySelector<HTMLButtonElement>('[data-back-1]');
  const liveRegion = root.querySelector<HTMLElement>('[data-validation-live]');
  const vpanels = new Map(
    Array.from(root.querySelectorAll<HTMLElement>('[data-vpanel]')).map((el) => [
      el.dataset.vpanel ?? '',
      el,
    ])
  );
  const githubBtn = root.querySelector<HTMLAnchorElement>('[data-github-btn]');
  const githubFallback = root.querySelector<HTMLElement>('[data-github-fallback]');
  const copyTomlBtn = root.querySelector<HTMLButtonElement>('[data-copy-toml]');
  const confirmSummary = root.querySelector<HTMLElement>('[data-confirm-summary]');
  const acceptBumpBtn = root.querySelector<HTMLButtonElement>('[data-accept-bump]');
  const renameHintBtn = root.querySelector<HTMLButtonElement>('[data-rename-hint]');

  let mode: 'upload' | 'paste' = 'paste';
  let step = 0;
  let lastResult: ValidationResult | null = null;
  // Slug the user explicitly acknowledged as an intentional version bump —
  // once set, that one slug no longer trips the duplicate-slug edge state.
  let acknowledgedDupSlug: string | null = null;

  function setStep(next: number) {
    step = next;
    for (const panel of panels) {
      panel.hidden = Number(panel.dataset.stepPanel) !== step;
    }
    for (const btn of rail) {
      const i = Number(btn.dataset.step);
      btn.classList.toggle('on', i === step);
      btn.classList.toggle('done', i < step);
      btn.setAttribute('aria-current', i === step ? 'step' : 'false');
    }
    const heading = panels[step]?.querySelector<HTMLElement>('h2, h3');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  }

  function setMode(next: 'upload' | 'paste') {
    mode = next;
    for (const tab of tabs) {
      const on = tab.dataset.modeTab === mode;
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (dropzone) dropzone.hidden = mode !== 'upload';
    if (textarea) textarea.hidden = mode !== 'paste';
  }

  function currentToml(): string {
    let text = textarea?.value ?? '';
    const override = flagOverride?.value.trim();
    if (override) {
      if (/^\s*raw\s*=/m.test(text)) {
        text = text.replace(/^(\s*raw\s*=\s*).*$/m, (_m, p1) => `${p1}${JSON.stringify(override)}`);
      }
    }
    return text;
  }

  function renderVstate(result: ValidationResult) {
    for (const [key, el] of vpanels) {
      el.hidden = key !== result.state;
    }
    const panel = vpanels.get(result.state);
    if (!panel) return;

    if (result.state === 'pass') {
      const s = (result as any).summary;
      panel.querySelector('[data-v-slug]')!.textContent = s.slug;
      panel.querySelector('[data-v-intent]')!.textContent = s.intent;
      panel.querySelector('[data-v-model]')!.textContent = s.modelId;
      const chip = panel.querySelector<HTMLElement>('[data-v-model-chip]')!;
      chip.textContent = s.modelKnown ? 'in roster' : 'unverified';
      chip.className = `chip ${s.modelKnown ? 'ok' : 'warn'}`;
      panel.querySelector('[data-v-lane]')!.textContent = s.lane + (s.minBuild ? ` · ${s.minBuild}` : '');
      panel.querySelector('[data-v-flags]')!.textContent = String(s.flagCount);
      panel.querySelector('[data-v-runs]')!.textContent = String(s.linkedRuns);
      if (liveRegion)
        liveRegion.textContent = `Valid. ${s.slug}, ${s.intent}, ${s.modelKnown ? 'model in roster' : 'model unverified'}.`;
    } else if (result.state === 'schema-error') {
      const r = result as any;
      const headline = r.parseError
        ? r.message
        : `${r.primary.path} — ${r.primary.message}`;
      panel.querySelector('[data-v-headline]')!.textContent = headline;
      const codeline = panel.querySelector<HTMLElement>('[data-v-codeline]')!;
      codeline.innerHTML = '';
      if (typeof r.line === 'number' && textarea) {
        const lines = textarea.value.split('\n');
        const from = Math.max(0, r.line - 3);
        const to = Math.min(lines.length, r.line + 1);
        for (let i = from; i < to; i++) {
          const isBad = i + 1 === r.line;
          const ln = document.createElement('span');
          ln.className = 'ln';
          if (isBad) ln.style.color = 'var(--err)';
          ln.textContent = String(i + 1);
          const code = document.createElement('span');
          if (isBad) code.className = 'bad';
          code.textContent = lines[i] ?? '';
          codeline.append(ln, code);
        }
      }
      panel.querySelector('[data-v-cause]')!.textContent = r.parseError
        ? `${r.cause} ${r.recovery}`
        : 'Cause then recovery: the field above does not match the shape hal0-profiles expects. Fix it in the file and re-validate.';
      if (liveRegion) liveRegion.textContent = `Schema error. ${headline}`;
    } else if (result.state === 'missing-fields') {
      const r = result as any;
      const list = panel.querySelector<HTMLElement>('[data-v-missing-list]')!;
      list.innerHTML = '';
      for (const m of r.missing) {
        const li = document.createElement('li');
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = m.key;
        const why = document.createElement('span');
        why.className = 'why';
        why.textContent = ` — ${m.why}`;
        li.append(key, why);
        list.append(li);
      }
      if (liveRegion)
        liveRegion.textContent = `${r.missing.length} required field${r.missing.length === 1 ? '' : 's'} missing: ${r.missing.map((m: any) => m.key).join(', ')}.`;
    } else if (result.state === 'warning') {
      const s = (result as any).summary;
      panel.querySelector('[data-v-warn-model]')!.textContent = s.modelId;
      if (liveRegion)
        liveRegion.textContent = `Warning, not blocking: ${s.modelId} is not in the roster yet. Profile will show unverified.`;
    } else if (result.state === 'duplicate-slug') {
      const r = result as any;
      panel.querySelector('[data-v-dup-slug]')!.textContent = r.slug;
      panel.querySelector('[data-v-dup-author]')!.textContent = r.author;
      panel.querySelector('[data-v-dup-version]')!.textContent = String(r.currentVersion);
      panel.querySelector('[data-v-dup-next]')!.textContent = String(r.nextVersion);
      if (liveRegion)
        liveRegion.textContent = `${r.slug} already exists, published by @${r.author}, currently at v${r.currentVersion}.`;
    }
  }

  function runValidation() {
    const text = currentToml();
    const existingProfiles = acknowledgedDupSlug
      ? EXISTING_PROFILES.filter((p: any) => p.profile.slug !== acknowledgedDupSlug)
      : EXISTING_PROFILES;
    const result: ValidationResult = validateProfileToml(text, { rosterRows: ROSTER, existingProfiles });
    lastResult = result;
    renderVstate(result);
    if (continueBtn) continueBtn.disabled = Boolean(result.blocking);
    if (continueBtn) continueBtn.textContent = result.state === 'warning' ? 'continue anyway' : 'continue';
    return result;
  }

  function prepareConfirmStep() {
    const result = lastResult;
    if (!result || result.blocking) return;
    const text = currentToml();
    const slug = (result as any).summary?.slug ?? 'profile';
    const { url, fallbackUrl, tooLong, length } = githubSubmitUrl(slug, text);
    if (confirmSummary) {
      confirmSummary.querySelector('[data-confirm-slug]')!.textContent = slug;
      confirmSummary.querySelector('[data-confirm-file]')!.textContent = `profiles/${slug}.toml`;
    }
    if (tooLong) {
      if (githubBtn) githubBtn.hidden = true;
      if (githubFallback) {
        githubFallback.hidden = false;
        const link = githubFallback.querySelector<HTMLAnchorElement>('[data-fallback-link]');
        if (link) link.href = fallbackUrl;
      }
    } else {
      if (githubBtn) {
        githubBtn.hidden = false;
        githubBtn.href = url;
      }
      if (githubFallback) githubFallback.hidden = true;
    }
    if (copyTomlBtn) {
      copyTomlBtn.onclick = async () => {
        const original = copyTomlBtn.textContent;
        let delay = 1400;
        try {
          await navigator.clipboard.writeText(text);
          copyTomlBtn.textContent = 'copied';
        } catch {
          // Clipboard access can fail silently (permissions, insecure
          // context, older browsers) — surface it rather than leaving the
          // button reading "copy TOML" while nothing happened.
          copyTomlBtn.textContent = "couldn't copy — select the text and copy it manually";
          delay = 2600;
        }
        setTimeout(() => {
          copyTomlBtn.textContent = original;
        }, delay);
      };
    }
    void length;
  }

  // ── file upload ──────────────────────────────────────────────
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target === fileInput) return;
      fileInput.click();
    });
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('hot');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('hot'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('hot');
      const file = e.dataTransfer?.files?.[0];
      if (file) void loadFile(file);
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) void loadFile(file);
    });
  }
  async function loadFile(file: File) {
    const text = await file.text();
    if (textarea) textarea.value = text;
    if (filenameBadge) filenameBadge.textContent = file.name;
  }

  // ── tabs ─────────────────────────────────────────────────────
  for (const tab of tabs) {
    tab.addEventListener('click', () => setMode((tab.dataset.modeTab as 'upload' | 'paste') ?? 'paste'));
  }

  // ── rail / step nav — the rail only ever lets you go back to a step
  // you have already completed; forward motion is gated behind the
  // validate/continue buttons so a broken file can't be skipped past.
  for (const btn of rail) {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.step);
      if (i <= step) setStep(i);
    });
  }

  validateBtn?.addEventListener('click', () => {
    setStep(1);
    runValidation();
  });
  revalidateBtn?.addEventListener('click', () => {
    runValidation();
  });
  continueBtn?.addEventListener('click', () => {
    if (!lastResult || lastResult.blocking) return;
    setStep(2);
    prepareConfirmStep();
  });
  backToStep0?.addEventListener('click', () => setStep(0));
  backToStep1?.addEventListener('click', () => setStep(1));

  acceptBumpBtn?.addEventListener('click', () => {
    if (!lastResult || lastResult.state !== 'duplicate-slug' || !textarea) return;
    const r = lastResult as any;
    // Best effort: re-render the parsed record with a fresh history entry
    // on top, bumping the version. The date/note are left for the author
    // to fill in — this only saves them the boilerplate.
    try {
      const parsedResult: ValidationResult = validateProfileToml(currentToml(), {
        rosterRows: ROSTER,
        existingProfiles: [],
      });
      if (parsedResult.state === 'pass' || parsedResult.state === 'warning') {
        const record = (parsedResult as any).parsed ?? null;
        if (record) {
          const bumped = {
            ...record,
            history: [
              { v: r.nextVersion, date: new Date().toISOString().slice(0, 10), note: 'describe what changed' },
              ...(record.history ?? []),
            ],
          };
          textarea.value = renderProfileToml(bumped);
        }
      }
    } catch {
      // If re-rendering fails for any reason, leave the textarea as-is —
      // the author can still bump the history entry by hand.
    }
    acknowledgedDupSlug = r.slug;
    runValidation();
  });
  renameHintBtn?.addEventListener('click', () => {
    textarea?.focus();
    if (liveRegion) liveRegion.textContent = 'Edit the slug field in the pasted TOML, then re-validate.';
  });

  setMode('paste');
  setStep(0);
}
