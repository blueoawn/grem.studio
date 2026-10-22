(function () {
  if (document.getElementById("navbar")) return;
  fetch("/navbar.html")
    .then(function (r) { return r.text(); })
    .then(function (html) { document.body.insertAdjacentHTML("afterbegin", html); })
    .catch(function (err) { console.error("Failed to load navbar:", err); });
})();
