document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (form.classList.contains('is-loading')) {
      event.preventDefault();
      return;
    }
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

document.querySelectorAll('form[data-loading-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (event.defaultPrevented || !form.checkValidity()) return;
    if (form.classList.contains('is-loading')) {
      event.preventDefault();
      return;
    }
    form.classList.add('is-loading');
    form.setAttribute('aria-busy', 'true');
    // Keep the submitter enabled so its name/value remains in the native POST.
    form.querySelectorAll('button[type="submit"]:not(:disabled)').forEach((button) => {
      button.dataset.loadingAriaDisabled = button.getAttribute('aria-disabled') ?? '';
      button.setAttribute('aria-disabled', 'true');
    });
  });
});

window.addEventListener('pageshow', () => {
  document.querySelectorAll('form[data-loading-form].is-loading').forEach((form) => {
    form.classList.remove('is-loading');
    form.removeAttribute('aria-busy');
    form.querySelectorAll('[data-loading-aria-disabled]').forEach((button) => {
      const original = button.dataset.loadingAriaDisabled;
      if (original) button.setAttribute('aria-disabled', original);
      else button.removeAttribute('aria-disabled');
      delete button.dataset.loadingAriaDisabled;
    });
  });
});
