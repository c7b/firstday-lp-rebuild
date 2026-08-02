class LpBuyBox extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;

    this.initialized = true;
    this.mediaTrack = this.querySelector('[data-media-track]');
    this.mediaSlides = Array.from(this.querySelectorAll('[data-media-slide]'));
    this.mediaThumbs = Array.from(this.querySelectorAll('[data-media-thumb]'));
    this.quantityInput = this.querySelector('[data-quantity-input]');
    this.quantityRadios = Array.from(this.querySelectorAll('[data-quantity-radio]'));
    this.prevButton = this.querySelector('[data-media-prev]');
    this.nextButton = this.querySelector('[data-media-next]');
    this.currentMedia = 0;

    if (this.mediaSlides.length < 2) {
      if (this.prevButton) this.prevButton.hidden = true;
      if (this.nextButton) this.nextButton.hidden = true;
    }

    if (this.prevButton) this.prevButton.addEventListener('click', () => this.step(-1));
    if (this.nextButton) this.nextButton.addEventListener('click', () => this.step(1));

    this.bindProductTabs();

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

  /**
   * Age-group tabs swap the product in place. The markup stays a real <a> to the sibling LP so
   * it works without JS and is crawlable; with JS we intercept and re-render just this section
   * through Shopify's Section Rendering API — no navigation, no flash of an empty page.
   */
  bindProductTabs() {
    this.querySelectorAll('[data-product-handle]').forEach((tab) => {
      tab.addEventListener('click', async (event) => {
        const handle = tab.dataset.productHandle;
        if (!handle || handle === this.dataset.currentHandle) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        await this.swapProduct(handle, tab);
      });
    });
  }

  async swapProduct(handle, tab) {
    const sectionId = this.dataset.sectionId;
    if (!sectionId || this.swapping) return;

    this.swapping = true;
    this.classList.add('is-swapping');
    try {
      const response = await fetch(`/products/${handle}?section_id=${encodeURIComponent(sectionId)}`);
      if (!response.ok) throw new Error(`section render ${response.status}`);

      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const fresh = doc.querySelector('lp-buy-box') || doc.querySelector('[data-section-id]');
      if (!fresh) throw new Error('no buy box in response');

      const scrollBefore = this.getBoundingClientRect().top;
      this.innerHTML = fresh.innerHTML;
      this.dataset.currentHandle = handle;

      // the re-rendered markup carries the section's own tab state, so re-apply the choice
      this.querySelectorAll('[data-product-handle]').forEach((t) => {
        const isCurrent = t.dataset.productHandle === handle;
        t.classList.toggle('is-active', isCurrent);
        if (isCurrent) t.setAttribute('aria-current', 'page');
        else t.removeAttribute('aria-current');
      });

      this.initialized = false;
      this.connectedCallback();
      window.history.replaceState({}, '', tab.getAttribute('href') || window.location.pathname);
      // keep the module visually anchored where the user was looking
      const scrollAfter = this.getBoundingClientRect().top;
      window.scrollBy(0, scrollAfter - scrollBefore);
    } catch (error) {
      // never leave the user stuck: fall back to the link the tab already points at
      const href = tab.getAttribute('href');
      if (href) window.location.assign(href);
    } finally {
      this.swapping = false;
      this.classList.remove('is-swapping');
    }
  }

  step(delta) {
    const count = this.mediaSlides.length;
    if (!count) return;

    const next = (this.currentMedia + delta + count) % count;
    const slide = this.mediaSlides[next];
    if (!slide) return;

    slide.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start',
    });
    this.setCurrentMedia(next);
  }

  setCurrentMedia(index) {
    this.currentMedia = index;
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
