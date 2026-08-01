class LpScienceTabs extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;

    this.initialized = true;
    this.tabs = Array.from(this.querySelectorAll('[role="tab"]'));
    this.panels = Array.from(this.querySelectorAll('[role="tabpanel"]'));
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.handleReducedMotion = this.handleReducedMotion.bind(this);

    this.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.activate(index));
      tab.addEventListener('keydown', (event) => this.handleKeydown(event, index));
    });

    this.reducedMotion.addEventListener('change', this.handleReducedMotion);
    this.activate(this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
  }

  disconnectedCallback() {
    if (this.reducedMotion) this.reducedMotion.removeEventListener('change', this.handleReducedMotion);
  }

  handleKeydown(event, index) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    let nextIndex = index;

    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + this.tabs.length) % this.tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % this.tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = this.tabs.length - 1;

    this.activate(nextIndex);
    this.tabs[nextIndex].focus();
  }

  handleReducedMotion() {
    const selectedIndex = this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    this.activate(selectedIndex);
  }

  activate(index) {
    if (index < 0 || !this.tabs[index]) return;

    this.tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      tab.classList.toggle('lp-science-tabs__tab--active', selected);
    });

    this.panels.forEach((panel, panelIndex) => {
      const selected = panelIndex === index;
      panel.hidden = !selected;

      const video = panel.querySelector('video');
      if (!video) return;

      video.preload = selected ? 'metadata' : 'none';
      if (!selected || this.reducedMotion.matches) {
        video.pause();
        video.removeAttribute('autoplay');
      } else {
        video.setAttribute('autoplay', '');
        video.play().catch(() => {});
      }
    });
  }
}

if (!customElements.get('lp-science-tabs')) {
  customElements.define('lp-science-tabs', LpScienceTabs);
}
