// HN Comments Reader — drill-down thread browser.
//
// Comments on Hacker News are a FLAT list of <tr.athing.comtr> rows in depth-first
// order; the depth of each row lives in <td.ind indent="N">. We reconstruct the tree
// from row order + indent and drive the whole UI by toggling the visibility of HN's
// own rows — never rebuilding them — so voting, reply links, usernames and timestamps
// keep working untouched.
(function () {
  const DEFAULTS = { drilldown: true, markdown: true, hideAddComment: true };

  chrome.storage.local.get(DEFAULTS, (cfg) => init(cfg));

  function init(cfg) {
    const renderMd = cfg.markdown && typeof window.hnxRenderMarkdown === 'function';

    // Story text (Ask HN / Show HN) can contain markdown too.
    if (renderMd) {
      const top = document.querySelector('.toptext');
      if (top) window.hnxRenderMarkdown(top);
    }

    const rows = Array.from(document.querySelectorAll('tr.athing.comtr'));
    if (rows.length) {
      const items = buildTree(rows);

      if (renderMd) {
        items.forEach((it) => {
          const body = it.row.querySelector('div.commtext');
          if (body) window.hnxRenderMarkdown(body);
        });
      }

      if (cfg.drilldown) setupDrilldown(items);
    }

    if (cfg.hideAddComment) setupAddCommentButton();
  }

  // Reconstruct the tree from the flat, depth-first row list + indent attribute.
  function buildTree(rows) {
    const items = rows.map((row, index) => {
      const ind = row.querySelector('td.ind');
      const depth = ind ? parseInt(ind.getAttribute('indent'), 10) || 0 : 0;
      return { row, index, depth, id: row.id };
    });
    items.forEach((it, i) => {
      // A subtree is the contiguous run of following rows deeper than this one.
      let j = i + 1;
      while (j < items.length && items[j].depth > it.depth) j++;
      it.descendants = items.slice(i + 1, j);
      it.directChildren = it.descendants.filter((d) => d.depth === it.depth + 1);
    });
    return items;
  }

  function setupDrilldown(items) {
    document.body.classList.add('hnx-drilldown');
    if (items[0]) items[0].row.classList.add('hnx-first-comment'); // separator above the comments

    items.forEach((it) => {
      // Tame HN's 40px-per-level indent so descended levels stay on screen.
      const img = it.row.querySelector('td.ind img');
      if (img) img.width = Math.min(it.depth, 8) * 20;

      // Start with everything below the top level hidden.
      if (it.depth > 0) it.row.classList.add('hnx-hidden');

      if (it.directChildren.length > 0) {
        it.expanded = false;
        it.row.classList.add('hnx-haschildren');
        addToggle(it); // appends the reply-count badge into the byline
      }

      // Read text first, byline (author/age + reply count) underneath.
      relocateMeta(it.row);
    });

    function addToggle(it) {
      const comhead = it.row.querySelector('span.comhead');
      if (!comhead || comhead.querySelector('.hnx-toggle')) return;

      const badge = document.createElement('a');
      badge.className = 'hnx-toggle';
      badge.href = 'javascript:void(0)';
      it.badge = badge;
      renderBadge(it);
      comhead.appendChild(badge);

      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(it);
      });

      // Clicking the comment itself drills in too — but never while following a link,
      // voting, replying, or selecting text.
      const cell = it.row.querySelector('td.default');
      if (cell) {
        cell.addEventListener('click', (e) => {
          if (e.target.closest('a, .votelinks, .reply')) return;
          if (!window.getSelection().isCollapsed) return;
          toggle(it);
        });
      }
    }

    function toggle(it) {
      if (it.expanded) collapse(it);
      else expand(it);
    }

    // Expand reveals DIRECT children only; their own subtrees stay hidden until clicked.
    function expand(it) {
      it.expanded = true;
      it.directChildren.forEach((c) => c.row.classList.remove('hnx-hidden'));
      renderBadge(it);
    }

    // Collapse hides the whole subtree and resets descendants back to collapsed.
    function collapse(it) {
      it.expanded = false;
      it.descendants.forEach((d) => {
        d.row.classList.add('hnx-hidden');
        if (d.expanded) {
          d.expanded = false;
          renderBadge(d);
        }
      });
      renderBadge(it);
    }

    function renderBadge(it) {
      if (!it.badge) return;
      const n = it.descendants.length;
      const label = n === 1 ? '1 reply' : n + ' replies';
      it.badge.textContent = (it.expanded ? '▾ ' : '▸ ') + label;
    }

    // Move the byline (author/age + the reply-count badge) from above the comment
    // text to directly below it.
    function relocateMeta(row) {
      const cell = row.querySelector('td.default');
      if (!cell) return;
      const comhead = cell.querySelector('span.comhead');
      const commtext = cell.querySelector('div.commtext');
      if (!comhead || !commtext) return;
      const wrapper = comhead.parentElement; // HN's <div style="margin-top:2px;...">
      if (!wrapper || wrapper.classList.contains('hnx-meta-below')) return;

      // Drop the <br> that used to separate the byline from the text.
      cell.querySelectorAll(':scope > br').forEach((br) => br.remove());
      wrapper.removeAttribute('style'); // clear HN's negative bottom margin
      wrapper.classList.add('hnx-meta-below');
      commtext.insertAdjacentElement('afterend', wrapper);

      // Move the upvote arrow out of its far-left column into the byline, to the
      // right of the reply count. Its id/href are preserved so voting still works.
      const up = row.querySelector('a[id^="up_"]');
      if (up) {
        up.classList.add('hnx-vote');
        comhead.appendChild(up);
      }
    }
  }

  // Hide HN's big always-open comment box; reveal it from a top-right button.
  function setupAddCommentButton() {
    const form = document.querySelector('form[action="comment"]');
    if (!form || document.querySelector('.hnx-addcomment-btn')) return;

    // Keep the real form (hidden parent/goto/hmac intact) so submitting still posts.
    const panel = document.createElement('div');
    panel.className = 'hnx-addcomment-panel hnx-hidden';
    form.parentNode.insertBefore(panel, form);
    panel.appendChild(form);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hnx-addcomment-btn';
    btn.textContent = '✎ Add comment';
    btn.addEventListener('click', () => panel.classList.toggle('hnx-hidden'));
    document.body.appendChild(btn);
  }
})();
