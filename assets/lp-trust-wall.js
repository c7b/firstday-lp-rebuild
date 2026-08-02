class LpTrustWallPlayer extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;

    this.initialized = true;
    this.querySelectorAll('[data-trust-video-play]').forEach((button) => {
      const media = button.closest('.lp-trust-wall__media');
      const video = media && media.querySelector('[data-trust-video]');
      if (!video) return;

      button.addEventListener('click', async () => {
        video.muted = false;
        try {
          await video.play();
        } catch (error) {
          button.hidden = false;
        }
      });
      video.addEventListener('play', () => { button.hidden = true; });
      video.addEventListener('ended', () => { button.hidden = false; });
    });
  }
}

if (!customElements.get('lp-trust-wall-player')) {
  customElements.define('lp-trust-wall-player', LpTrustWallPlayer);
}
