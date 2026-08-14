document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

document.querySelectorAll('form[data-loading-form]').forEach((form) => {
  form.addEventListener('submit', () => {
    if (form.checkValidity()) {
      form.classList.add('is-loading');
      form.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = true; });
    }
  });
});
