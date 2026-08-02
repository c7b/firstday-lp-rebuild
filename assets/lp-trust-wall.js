/**
 * Testimonial video playback.
 *
 * UX contract (why it behaves this way):
 *  - At rest the card shows its poster and one big play badge. No native controls yet: on a
 *    marketing wall a full control bar over a portrait poster is visual noise.
 *  - Clicking the badge (or the video surface) starts playback with sound and turns the native
 *    controls on, because once someone is watching they want scrub / volume / fullscreen.
 *  - While playing, the badge steps back. It reappears as a PAUSE affordance on hover or
 *    keyboard focus, so a mouse user never has to hunt for the control bar, and it returns
 *    permanently the moment the video is paused or ends — the state is always readable.
 *  - Only one testimonial plays at a time.
 *
 * Badge state is driven by CSS classes rather than the `hidden` attribute on purpose:
 * `[hidden]` only sets `display:none` in the UA stylesheet, so any author `display` rule
 * (this button is `display:grid`) silently wins and the badge never disappears. That was the
 * bug — clicking play left a dead play icon sitting on top of a playing video.
 */
const PLAYERS = new Set();

class LpTrustWallPlayer extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    PLAYERS.add(this);

    this.pairs = [];
    this.querySelectorAll('[data-trust-video-play]').forEach((button) => {
      const media = button.closest('.lp-trust-wall__media');
      const video = media && media.querySelector('[data-trust-video]');
      if (!video) return;

      const pair = { button, video, media, label: (button.getAttribute('aria-label') || 'video').replace(/^(Play|Pause)\s+/i, '') };
      this.pairs.push(pair);

      button.addEventListener('click', (event) => {
        event.preventDefault();
        this.toggle(pair);
      });

      // the video surface is the biggest target; on touch it is the natural one
      video.addEventListener('click', () => {
        if (!video.controls) this.toggle(pair);
      });

      video.addEventListener('play', () => {
        this.pauseOthers(video);
        video.controls = true;
        media.classList.add('is-playing');
        this.setButtonState(pair, true);
      });
      video.addEventListener('pause', () => {
        media.classList.remove('is-playing');
        this.setButtonState(pair, false);
      });
      video.addEventListener('ended', () => {
        media.classList.remove('is-playing');
        video.controls = false;
        video.currentTime = 0;
        this.setButtonState(pair, false);
      });
    });
  }

  disconnectedCallback() {
    PLAYERS.delete(this);
  }

  setButtonState({ button, label }, playing) {
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${label}`);
  }

  async toggle(pair) {
    const { video } = pair;
    if (video.paused) {
      video.muted = false;
      try {
        await video.play();
      } catch {
        // sound blocked before any gesture is registered: play muted rather than do nothing
        video.muted = true;
        video.play().catch(() => this.setButtonState(pair, false));
      }
    } else {
      video.pause();
    }
  }

  pauseOthers(current) {
    PLAYERS.forEach((player) => {
      player.pairs.forEach(({ video }) => {
        if (video !== current && !video.paused) video.pause();
      });
    });
  }
}

if (!customElements.get('lp-trust-wall-player')) {
  customElements.define('lp-trust-wall-player', LpTrustWallPlayer);
}
