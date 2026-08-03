class LpBuyBox extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;

    this.initialized = true;
    this.mediaTrack = this.querySelector('[data-media-track]');
    this.mediaSlides = Array.from(this.querySelectorAll('[data-media-slide]'));
    this.mediaThumbs = Array.from(this.querySelectorAll('[data-media-thumb]'));
    this.quantityInput = this.querySelector('[data-quantity-input]');
    this.quantityRadios = Array.from(this.querySelectorAll('[data-quantity-radio]'));
    this.deliveryRadios = Array.from(this.querySelectorAll('[data-delivery-radio]'));
    this.prevButton = this.querySelector('[data-media-prev]');
    this.nextButton = this.querySelector('[data-media-next]');
    this.currentMedia = 0;

    if (this.mediaSlides.length < 2) {
      if (this.prevButton) this.prevButton.hidden = true;
      if (this.nextButton) this.nextButton.hidden = true;
    }

    if (this.prevButton) this.prevButton.addEventListener('click', () => { this.hasInteracted = true; this.step(-1); });
    if (this.nextButton) this.nextButton.addEventListener('click', () => { this.hasInteracted = true; this.step(1); });

    this.bindProductTabs();

    this.mediaThumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        this.hasInteracted = true;
        const index = Number(thumb.dataset.mediaIndex);
        const slide = this.mediaSlides[index];

        if (!slide) return;

        this.scrollTrackTo(this.mediaTrack, slide);
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

    this.deliveryRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) this.updateQuantitySavings(radio.value);
      });
    });
    const selectedDelivery = this.deliveryRadios.find((radio) => radio.checked);
    this.updateQuantitySavings(selectedDelivery?.value || 'monthly');

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
      const restoreFocus = this.contains(document.activeElement);
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
      if (restoreFocus) {
        this.querySelector(`[data-product-handle="${CSS.escape(handle)}"]`)?.focus({ preventScroll: true });
      }
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

  /**
   * scrollIntoView scrolls every scrollable ancestor, including the document — which on first
   * paint yanked the whole page down to the buy box. These carousels must only ever move
   * their own track, so the scrolling is done by hand on the container.
   */
  scrollTrackTo(container, child, smooth = true) {
    if (!container || !child) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const left = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  step(delta) {
    const count = this.mediaSlides.length;
    if (!count) return;

    const next = (this.currentMedia + delta + count) % count;
    const slide = this.mediaSlides[next];
    if (!slide) return;

    this.scrollTrackTo(this.mediaTrack, slide);
    this.setCurrentMedia(next);
  }

  setCurrentMedia(index) {
    this.currentMedia = index;
    this.mediaThumbs.forEach((thumb) => {
      thumb.setAttribute('aria-current', String(Number(thumb.dataset.mediaIndex) === index));
    });

    const currentThumb = this.mediaThumbs[index];
    const strip = this.querySelector('[data-media-thumbnails]');
    this.scrollTrackTo(strip, currentThumb, this.initialized === true && this.hasInteracted === true);
  }

  /**
   * Upsells add the real product through the Cart AJAX API — the same call Dawn makes. The
   * button confirms with a check for a moment rather than a toast, because the gift bar above
   * it is already the feedback that matters here: adding an upsell can be what unlocks it.
   */
  bindUpsells() {
    this.querySelectorAll('[data-upsell-add]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.variantId;
        if (!id || button.dataset.busy) return;

        button.dataset.busy = '1';
        button.classList.add('is-busy');
        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: [{ id: Number(id), quantity: 1 }] }),
          });
          if (!response.ok) throw new Error(String(response.status));
          button.classList.add('is-added');
          document.dispatchEvent(new CustomEvent('lp:cart:changed'));
          window.setTimeout(() => button.classList.remove('is-added'), 2200);
        } catch {
          button.classList.add('is-error');
          window.setTimeout(() => button.classList.remove('is-error'), 2200);
        } finally {
          delete button.dataset.busy;
          button.classList.remove('is-busy');
        }
      });
    });
  }

  /**
   * The free-gift bar tracks the real cart. Server-rendered copy is the no-JS truth; this
   * corrects it from /cart.js on load and whenever anything is added, so the page never
   * claims a distance it hasn't measured. Reading the cart is not touching it.
   */
  bindGiftProgress() {
    this.giftBar = this.querySelector('[data-gift-progress]');
    this.giftText = this.querySelector('[data-gift-text]');
    if (!this.giftBar) return;

    this.refreshGiftProgress();

    if (!LpBuyBox.cartListenerBound) {
      LpBuyBox.cartListenerBound = true;
      // any add-to-cart on the page, ours or Dawn's, goes through fetch to /cart/add
      const origFetch = window.fetch;
      window.fetch = function (...args) {
        const request = args[0];
        const url = typeof request === 'string' ? request : request && request.url;
        return origFetch.apply(this, args).then((response) => {
          if (url && /\/cart\/(add|change|update)/.test(url)) {
            document.dispatchEvent(new CustomEvent('lp:cart:changed'));
          }
          return response;
        });
      };
    }
    document.addEventListener('lp:cart:changed', () => this.refreshGiftProgress());
  }

  async refreshGiftProgress() {
    const bar = this.giftBar;
    if (!bar) return;

    const threshold = Number(bar.dataset.giftThreshold || 0);
    if (!threshold) return;

    let cart;
    try {
      cart = await (await fetch('/cart.js', { headers: { Accept: 'application/json' } })).json();
    } catch {
      return; // leave the server-rendered copy alone rather than show a wrong number
    }

    const total = (cart.total_price || 0) / 100;
    const remaining = Math.max(0, threshold - total);
    const pct = Math.min(100, threshold ? (total / threshold) * 100 : 0);

    const fill = bar.querySelector('.lp-buy-box__progress-fill');
    if (fill) fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(Math.min(total, threshold).toFixed(2)));
    bar.classList.toggle('is-unlocked', remaining === 0);

    if (this.giftText) {
      const money = new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: (cart.currency || 'USD'),
        maximumFractionDigits: remaining % 1 === 0 ? 0 : 2,
      }).format(remaining);
      if (remaining === 0) {
        // the original has no copy for the unlocked state, so none is invented: the filled
        // green bar carries it unless the operator supplied their own line
        const unlocked = bar.dataset.giftUnlockedText;
        this.giftText.hidden = !unlocked;
        if (unlocked) {
          this.giftText.textContent = unlocked;
          bar.setAttribute('aria-label', unlocked);
        }
      } else {
        const copy = (bar.dataset.giftAwayTemplate || '').replace('[amount]', money);
        if (copy) {
          this.giftText.hidden = false;
          this.giftText.textContent = copy;
          bar.setAttribute('aria-label', copy);
        }
      }
    }
  }

  updateQuantitySavings() {
    // Intentionally a no-op. The savings figures are transplanted from the original page,
    // which shows them for the subscription offer. A one-time equivalent would have to be
    // COMPUTED, i.e. invented — and invented prices are the one thing a rebuild must never
    // ship. Real per-plan pricing arrives with the selling plans (see docs/PLAN.md).
  }
}

if (!customElements.get('lp-buy-box')) {
  customElements.define('lp-buy-box', LpBuyBox);
}
