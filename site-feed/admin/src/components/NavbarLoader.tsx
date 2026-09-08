import { useEffect } from "react";

export function NavbarLoader() {
  useEffect(() => {
    if (document.getElementById("navbar")) return;

    fetch("/navbar.php")
      .then((r) => r.text())
      .then((html) => {
        document.body.insertAdjacentHTML("afterbegin", html);
      })
      .catch((err) => console.error("Failed to load navbar:", err));
  }, []);

  return null;
}
