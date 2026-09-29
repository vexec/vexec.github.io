document.addEventListener("DOMContentLoaded", () => {
  const router = new Router({
    container: document.querySelector(".container"),
    defaultTitle: "Vexec – Write As Unknown",
  });

  router
    .get("/", "partials/home.html", "Vexec – Home")
    .get("/pv", "partials/pv.html", "Vexec – Messages")
    .get("/write", "partials/write.html", "Vexec – Write")
    .get("/saved", "partials/saved.html", "Vexec – Saved")
    .get("/profile", "partials/profile.html", "Vexec – Profile")
    .get("/my-posts", "partials/my_posts.html", "Vexec – My Whispers")
    .get("/register", "partials/register.html", "Vexec – Create Identity")
    .get("/login", "partials/login.html", "Vexec – Login")
    .get("/terms", "partials/terms.html", "Vexec – Terms of Service")
    .get("/information", "partials/information.html", "Vexec – About")
    .get("/info", "partials/information.html", "Vexec – About")
    .get("/about", "partials/information.html", "Vexec – About")
<<<<<<< HEAD
    .get("/tor-support", "partials/tor-support.html", "Vexec – Tor Support")
    .get("/pv", "partials/pv.html", "Vexec – Secret Inbox")
    .get("/pv/new", "partials/pv-new.html", "Vexec – Send Secret")
=======
<<<<<<< HEAD
    .get("/tor-support", "partials/tor-support.html", "Vexec – Tor Support")
    .get("/pv", "partials/pv.html", "Vexec – Secret Inbox")
    .get("/pv/new", "partials/pv-new.html", "Vexec – Send Secret")
=======
>>>>>>> fe5a5742073570dc4d4a912f3c8c1dc5ed31f50b
>>>>>>> 8eb15df9b261f9e522d88239c23f1213550675a3
    .get(
      "/u/:username",
      "partials/profile_view.html",
      (params) => `@${params.username} – Vexec`,
    );

  router.start();
});