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

    this.querySelectorAll('[data-video]').forEach((video) => {
      const panel = video.closest('[role="tabpanel"]');
      const toggle = panel && panel.querySelector('[data-video-toggle]');
      const toggleVideo = () => this.toggleVideo(video);

      video.addEventListener('click', toggleVideo);
      video.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleVideo();
      });
      if (toggle) toggle.addEventListener('click', toggleVideo);
      video.addEventListener('play', () => this.updateVideoToggle(video));
      video.addEventListener('pause', () => this.updateVideoToggle(video));
      this.updateVideoToggle(video);
    });

    // These loops start on their own. If the browser (power saver, background tab, blocked
    // autoplay) stops one, resume it when visible unless the user explicitly paused it.
    this.resumeObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !this.reducedMotion.matches) this.ensurePlaying(entry.target);
      });
    }, { threshold: 0.2 });
    this.querySelectorAll('video').forEach((video) => this.resumeObserver.observe(video));

    this.handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      this.panels.forEach((panel, i) => {
        if (!panel.hidden) this.ensurePlaying(panel.querySelector('video'));
      });
    };
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.reducedMotion.addEventListener('change', this.handleReducedMotion);
    this.activate(this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
  }

  ensurePlaying(video) {
    if (!video || video.offsetParent === null || this.reducedMotion.matches || video.dataset.userPaused === 'true') return;
    video.muted = true;
    video.playsInline = true;
    if (video.paused) video.play().catch(() => {});
  }

  toggleVideo(video) {
    if (!video) return;

    if (video.paused) {
      video.dataset.userPaused = 'false';
      video.play().catch(() => this.updateVideoToggle(video));
    } else {
      video.dataset.userPaused = 'true';
      video.pause();
    }
    this.updateVideoToggle(video);
  }

  updateVideoToggle(video) {
    const panel = video && video.closest('[role="tabpanel"]');
    const toggle = panel && panel.querySelector('[data-video-toggle]');
    if (!toggle) return;

    const paused = video.paused;
    toggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} video`);
    const playIcon = toggle.querySelector('.lp-science-tabs__play-icon');
    const pauseIcon = toggle.querySelector('.lp-science-tabs__pause-icon');
    if (playIcon) playIcon.hidden = !paused;
    if (pauseIcon) pauseIcon.hidden = paused;
  }

  disconnectedCallback() {
    if (this.resumeObserver) this.resumeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibility);
    if (this.playObserver) this.playObserver.disconnect();
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

      if (!selected) {
        video.pause();
        video.removeAttribute('autoplay');
        return;
      }

      // muted must be set as a PROPERTY (not just the attribute) or Chrome rejects
      // programmatic play with NotAllowedError; preload none never fetches the data.
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      if (this.reducedMotion.matches) {
        video.pause();
        return;
      }

      if (video.dataset.userPaused === 'true') {
        video.pause();
        this.updateVideoToggle(video);
        return;
      }

      video.setAttribute('autoplay', '');
      const attempt = video.play();
      if (attempt && attempt.catch) {
        attempt.catch(() => {
          // autoplay blocked (data saver, battery saver): load the frames anyway and
          // retry once the panel is actually on screen
          video.load();
          if (!this.playObserver) {
            this.playObserver = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) this.ensurePlaying(entry.target);
              });
            }, { threshold: 0.25 });
          }
          this.playObserver.observe(video);
        });
      }
    });
  }
}

if (!customElements.get('lp-science-tabs')) {
  customElements.define('lp-science-tabs', LpScienceTabs);
}
