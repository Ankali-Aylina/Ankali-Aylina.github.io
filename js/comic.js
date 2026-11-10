/* COMIC SUPPLEMENT / reader progress */
(function () {
  'use strict';
  var stage = document.querySelector('[data-comic-stage]');
  if (!stage) return;

  var cuts = Array.prototype.slice.call(stage.querySelectorAll('.comic-cut'));
  var count = document.querySelector('[data-comic-count]');
  if (!cuts.length) return;

  var current = -1;
  var queued = false;

  function pad(value) { return String(value).padStart(2, '0'); }

  function update() {
    queued = false;
    var marker = window.scrollY + window.innerHeight * 0.38;
    var next = 0;
    for (var i = 0; i < cuts.length; i++) {
      var top = cuts[i].getBoundingClientRect().top + window.scrollY;
      if (top <= marker) next = i + 1;
      else break;
    }
    if (next === current) return;
    current = next;
    if (count) count.textContent = pad(Math.max(1, current));
  }

  function requestUpdate() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
})();
