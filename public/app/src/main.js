const target = new URL("login.html", window.location.href);
if (window.location.search) target.search = window.location.search;
if (window.location.hash) target.hash = window.location.hash;
window.location.replace(target.toString());
