(function () {
  const input = document.getElementById('helpSearchInput');
  const button = document.getElementById('helpSearchButton');
  const sections = Array.from(document.querySelectorAll('[data-help-section]'));
  const empty = document.getElementById('helpEmptyState');

  const originals = new Map(sections.map((section) => [section, section.innerHTML]));

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function clearHighlights() {
    sections.forEach((section) => {
      section.innerHTML = originals.get(section);
      section.hidden = false;
    });
    empty.hidden = true;
  }

  function runSearch() {
    const keyword = input.value.trim();
    clearHighlights();
    if (!keyword) return;

    const regex = new RegExp(escapeRegExp(keyword), 'gi');
    let visibleCount = 0;

    sections.forEach((section) => {
      const text = section.textContent || '';
      const matched = text.toLowerCase().includes(keyword.toLowerCase());
      section.hidden = !matched;
      if (matched) {
        visibleCount += 1;
        section.innerHTML = originals.get(section).replace(regex, (match) => `<mark class="help-mark">${match}</mark>`);
      }
    });

    empty.hidden = visibleCount > 0;
  }

  button.addEventListener('click', runSearch);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });
})();
