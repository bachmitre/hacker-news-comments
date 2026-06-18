// Render markdown inside an HN comment body.
//
// HN already escapes entities and inserts <p> (paragraph separators), <i> (italics),
// <a> (auto-links) and <pre><code> (indented code). Markdown that HN ignores
// (**bold**, `code`, [text](url), - lists, > quotes, # headings, ~~strike~~, tables)
// survives as literal text. We reconstruct a markdown source string from the existing
// DOM — preserving HN's links/code — then run it through marked + DOMPurify and swap
// the sanitized HTML back in.
window.hnxRenderMarkdown = function (el) {
  if (!el || el.dataset.hnxMd || typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    return;
  }

  const source = serialize(el).replace(/\n{3,}/g, '\n\n').trim();

  let html;
  try {
    html = marked.parse(source, { gfm: true, breaks: false });
  } catch (e) {
    return; // leave the original markup untouched on any parser error
  }

  el.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'a', 'b', 'strong', 'i', 'em', 'del', 's', 'code', 'pre',
      'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'
    ],
    ALLOWED_ATTR: ['href', 'title', 'align']
  });

  // Match the highlighter's behavior: comment links open in a new tab.
  el.querySelectorAll('a[href]').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  el.dataset.hnxMd = '1';
};

// Walk the existing comment DOM and emit a markdown-source string.
function serialize(node) {
  let out = '';
  node.childNodes.forEach((ch) => {
    if (ch.nodeType === Node.TEXT_NODE) {
      out += ch.nodeValue;
      return;
    }
    if (ch.nodeType !== Node.ELEMENT_NODE) return;

    const tag = ch.tagName.toLowerCase();
    if (tag === 'p') {
      out += '\n\n' + serialize(ch);
    } else if (tag === 'br') {
      out += '\n';
    } else if (tag === 'i' || tag === 'em') {
      out += '*' + serialize(ch) + '*';
    } else if (tag === 'b' || tag === 'strong') {
      out += '**' + serialize(ch) + '**';
    } else if (tag === 'a') {
      const href = ch.getAttribute('href') || '';
      const text = ch.textContent || '';
      // HN auto-links bare URLs and truncates the visible text with "...". When the
      // text is just (a prefix of) the URL, emit the bare href so marked re-links the
      // full URL; otherwise preserve an explicit [label](url).
      const stripped = text.replace(/[.…]+$/, '');
      out += (text && text !== href && href.indexOf(stripped) !== 0)
        ? '[' + text + '](' + href + ')'
        : href;
    } else if (tag === 'pre') {
      out += '\n\n```\n' + ch.textContent.replace(/\n+$/, '') + '\n```\n\n';
    } else if (tag === 'code') {
      out += '`' + ch.textContent + '`';
    } else {
      out += serialize(ch);
    }
  });
  return out;
}
