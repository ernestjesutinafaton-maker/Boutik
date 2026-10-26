// Petit script du site vitrine : menu mobile, apparitions au défilement,
// compteurs animés, et mise en avant du téléchargement adapté à l'appareil.
(function () {
  document.documentElement.classList.add('js');

  document.addEventListener('DOMContentLoaded', function () {
    // Menu sur téléphone
    var button = document.querySelector('.menu-btn');
    var menu = document.getElementById('menu');
    if (button && menu) {
      button.addEventListener('click', function () {
        var open = menu.classList.toggle('open');
        button.setAttribute('aria-expanded', String(open));
      });
      menu.addEventListener('click', function (event) {
        if (event.target.tagName === 'A') menu.classList.remove('open');
      });
    }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Apparitions et compteurs, quand l'élément entre à l'écran
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
          entry.target.querySelectorAll('[data-count-to]').forEach(count);
          if (entry.target.hasAttribute('data-count-to')) count(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    document.querySelectorAll('.reveal, [data-count-to]').forEach(function (el) {
      observer.observe(el);
    });

    // Sécurité : tout ce qui est déjà passé à l'écran (défilement rapide) apparaît aussi
    function revealPassed() {
      document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('visible');
          el.querySelectorAll('[data-count-to]').forEach(count);
        }
      });
    }
    window.addEventListener('scroll', revealPassed, { passive: true });
    revealPassed();

    function count(el) {
      if (reduce || el.dataset.counted) return;
      el.dataset.counted = '1';
      var target = Number(el.getAttribute('data-count-to'));
      var start = performance.now();
      function step(now) {
        var t = Math.min(1, (now - start) / 1100);
        var value = Math.round(target * (1 - Math.pow(1 - t, 3)));
        el.textContent = value.toLocaleString('fr-FR');
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // Mettre en avant la version qui correspond à l'appareil du visiteur
    var ua = navigator.userAgent;
    var platform = /Android/i.test(ua)
      ? 'android'
      : /Windows/i.test(ua)
        ? 'windows'
        : /Linux/i.test(ua) && !/Android/i.test(ua)
          ? 'linux'
          : /iPhone|iPad|Macintosh/i.test(ua)
            ? 'web'
            : null;
    if (platform) {
      document.querySelectorAll('[data-platform="' + platform + '"]').forEach(function (el) {
        el.classList.add('suggested');
      });
      var main = document.querySelector('[data-download-main]');
      var link = document.querySelector('.dl[data-platform="' + platform + '"]');
      var names = { android: 'Android', windows: 'Windows', linux: 'Linux', web: 'le web' };
      if (main && link) {
        main.textContent = 'Télécharger pour ' + names[platform];
        main.setAttribute('href', link.getAttribute('href'));
      }
    }
  });
})();
