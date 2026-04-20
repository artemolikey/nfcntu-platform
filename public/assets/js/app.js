(function () {
  function parseReferenceData() {
    const source = document.getElementById('reference-data');
    if (!source) return null;
    try {
      return JSON.parse(source.textContent);
    } catch (error) {
      console.error('Не вдалося зчитати довідкові дані.', error);
      return null;
    }
  }

  function toggleDependentOptions(select, options, predicate) {
    if (!select) return;
    const currentValue = select.value;
    let hasVisibleSelection = false;

    options.forEach((option) => {
      if (!option.value) return;
      const shouldShow = predicate(option);
      option.hidden = !shouldShow;
      option.disabled = !shouldShow;
      if (shouldShow && option.value === currentValue) {
        hasVisibleSelection = true;
      }
    });

    if (!hasVisibleSelection) {
      select.value = '';
    }
  }

  function initDependentSelects() {
    const referenceData = parseReferenceData();
    if (!referenceData) return;

    document.querySelectorAll('[data-reference-context]').forEach((context) => {
      const specialtySelect = context.querySelector('[data-specialty-control]');
      if (!specialtySelect) return;

      const groupSelect = context.querySelector('[data-dependent-group]');
      const categorySelect = context.querySelector('[data-dependent-category]');
      const groupOptions = groupSelect ? Array.from(groupSelect.options) : [];
      const categoryOptions = categorySelect ? Array.from(categorySelect.options) : [];

      function sync() {
        const selectedSpecialty = specialtySelect.value;

        toggleDependentOptions(groupSelect, groupOptions, (option) => {
          const specialtyId = option.dataset.specialtyId;
          return !selectedSpecialty || specialtyId === selectedSpecialty;
        });

        toggleDependentOptions(categorySelect, categoryOptions, (option) => {
          const specialtyId = option.dataset.specialtyId;
          return !selectedSpecialty || !specialtyId || specialtyId === selectedSpecialty;
        });
      }

      specialtySelect.addEventListener('change', sync);
      sync();
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function initChatPolling() {
    const thread = document.querySelector('[data-chat-order-id]');
    if (!thread) return;

    const orderId = thread.dataset.chatOrderId;
    const currentUserId = thread.dataset.currentUserId;
    const list = thread.querySelector('[data-message-list]');
    if (!orderId || !list) return;

    let lastSignature = list.textContent.trim();

    async function refresh() {
      try {
        const response = await fetch(`/orders/${orderId}/messages`, {
          headers: { 'x-requested-with': 'fetch' }
        });
        if (!response.ok) return;
        const payload = await response.json();
        const nextMarkup = payload.messages.map((message) => {
          const ownClass = message.senderId === currentUserId ? ' is-own' : '';
          return `
            <article class="message-item${ownClass}">
              <div class="message-bubble">
                <strong>${escapeHtml(message.senderName)}</strong>
                <p>${escapeHtml(message.body)}</p>
                <small>${escapeHtml(formatDateTime(message.createdAt))}</small>
              </div>
            </article>
          `;
        }).join('');

        if (nextMarkup && nextMarkup !== lastSignature) {
          list.innerHTML = nextMarkup;
          lastSignature = nextMarkup;
          list.scrollTop = list.scrollHeight;
        }
      } catch (error) {
        console.error('Не вдалося оновити чат замовлення.', error);
      }
    }

    refresh();
    window.setInterval(refresh, 15000);
  }

  function initAutoDismissAlerts() {
    document.querySelectorAll('.alert').forEach((alert) => {
      window.setTimeout(() => {
        alert.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-6px)';
      }, 4800);
    });
  }

  function initBarAnimations() {
    const bars = document.querySelectorAll('.progress-bar span, .bar-track span');
    if (!bars.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bars.forEach((bar) => {
      const finalWidth = bar.style.width || '0%';
      if (reduceMotion) {
        bar.style.width = finalWidth;
        return;
      }
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.width = finalWidth;
        });
      });
    });
  }

  function initRevealAnimations() {
    const selectors = [
      '.hero-copy',
      '.hero-panel',
      '.stat-card',
      '.feature-card',
      '.performer-card',
      '.testimonial-card',
      '.section-card',
      '.order-card',
      '.profile-summary-card',
      '.auth-card',
      '.list-row',
      '.timeline-item',
      '.bar-item'
    ];

    const elements = Array.from(document.querySelectorAll(selectors.join(',')));
    if (!elements.length) return;

    document.body.classList.add('js-enhanced');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    elements.forEach((element, index) => {
      element.classList.add('reveal-on-scroll');
      element.style.transitionDelay = `${Math.min(index % 6, 5) * 55}ms`;
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    elements.forEach((element) => observer.observe(element));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDependentSelects();
    initChatPolling();
    initAutoDismissAlerts();
    initBarAnimations();
    initRevealAnimations();
  });
})();
