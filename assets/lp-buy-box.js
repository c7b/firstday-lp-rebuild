class LpBuyBox extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;

    this.initialized = true;
    this.mediaTrack = this.querySelector('[data-media-track]');
    this.mediaSlides = Array.from(this.querySelectorAll('[data-media-slide]'));
    this.mediaThumbs = Array.from(this.querySelectorAll('[data-media-thumb]'));
    this.quantityInput = this.querySelector('[data-quantity-input]');
    this.quantityRadios = Array.from(this.querySelectorAll('[data-quantity-radio]'));

    this.mediaThumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const index = Number(thumb.dataset.mediaIndex);
        const slide = this.mediaSlides[index];

        if (!slide) return;

        slide.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'start',
        });
        this.setCurrentMedia(index);
      });
    });

    this.quantityRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked || !this.quantityInput) return;

        this.quantityInput.value = radio.dataset.quantityValue;
        this.quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    if (this.mediaTrack && this.mediaSlides.length > 1 && 'IntersectionObserver' in window) {
      this.mediaObserver = new IntersectionObserver(
        (entries) => {
          const visibleEntry = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          if (!visibleEntry) return;

          this.setCurrentMedia(Number(visibleEntry.target.dataset.mediaIndex));
        },
        {
          root: this.mediaTrack,
          threshold: [0.55, 0.75, 0.95],
        }
      );

      this.mediaSlides.forEach((slide) => this.mediaObserver.observe(slide));
    }
  }

  disconnectedCallback() {
    if (this.mediaObserver) this.mediaObserver.disconnect();
  }

  setCurrentMedia(index) {
    this.mediaThumbs.forEach((thumb) => {
      thumb.setAttribute('aria-current', String(Number(thumb.dataset.mediaIndex) === index));
    });

    const currentThumb = this.mediaThumbs[index];
    if (currentThumb) currentThumb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

if (!customElements.get('lp-buy-box')) {
  customElements.define('lp-buy-box', LpBuyBox);
}
