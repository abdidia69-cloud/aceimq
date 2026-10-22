(() => {
  "use strict";

  const player = document.getElementById("videoPlayer");
  const title = document.getElementById("videoTitle");
  const hint = document.getElementById("videoHint");
  const errorBox = document.getElementById("error");
  const affiliateCard = document.getElementById("affiliateCard");
  const affiliateTitle = document.getElementById("affiliateTitle");
  const affiliateLink = document.getElementById("affiliateLink");

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
    hint.textContent = "";
  }

  function getVideoId() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts.length === 2 && parts[0] === "v" ? parts[1] : null;
  }

  async function init() {
    const id = getVideoId();
    if (!id) {
      showError("Tautan video tidak valid. Gunakan tautan halaman video lengkap dari hasil upload.");
      return;
    }

    try {
      const response = await fetch(`/api/videos/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Video tidak ditemukan (HTTP ${response.status}).`);
      if (!data.mediaUrl) throw new Error("Server tidak memberikan alamat file video.");

      title.textContent = data.filename || "Video Aceimq";
      player.src = data.mediaUrl;
      player.load();

      player.addEventListener("loadedmetadata", () => {
        hint.textContent = "";
      }, { once: true });

      player.addEventListener("error", () => {
        showError("Data video ditemukan, tetapi file tidak dapat diputar. Coba MP4 (H.264/AAC), dan pastikan folder uploads ikut terunggah ke hosting.");
      });

      hint.textContent = "Video siap dimuat. Tekan tombol putar jika belum mulai.";
      if (data.affiliate && typeof data.affiliate.url === "string" &&
          /^https?:\/\//i.test(data.affiliate.url)) {
        // Polos: tanpa tulisan overlay. Hitung 10 detik saat video benar-benar diputar.
        let secondsLeft = 10;
        let timer = null;
        player.addEventListener("playing", () => {
          if (timer || secondsLeft <= 0) return;
          timer = window.setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
              window.clearInterval(timer);
              timer = null;
              window.location.href = data.affiliate.url;
            }
          }, 1000);
        });
        player.addEventListener("pause", () => {
          if (timer) { window.clearInterval(timer); timer = null; }
        });
        player.addEventListener("ended", () => {
          if (timer) window.clearInterval(timer);
          timer = null;
        });
      }
    } catch (error) {
      console.error("Aceimq video error:", error);
      showError(error.message || "Video gagal dimuat. Coba muat ulang halaman.");
    }
  }

  init();
})();
