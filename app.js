(() => {
  "use strict";

  const input = document.getElementById("fileInput");
  const drop = document.getElementById("drop");
  const progressWrap = document.getElementById("progressWrap");
  const bar = document.getElementById("bar");
  const status = document.getElementById("status");
  const result = document.getElementById("result");
  const errorBox = document.getElementById("error");
  const maxMbLabel = document.getElementById("limit");
  const uploadButton = document.querySelector('label[for="fileInput"]');
  let maxMb = 200;
  let busy = false;

  const formatSize = bytes => bytes < 1048576
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
  }
  function hideError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }
  function resetUploadUi() {
    busy = false;
    input.disabled = false;
    if (uploadButton) uploadButton.style.pointerEvents = "";
    progressWrap.style.display = "none";
  }

  async function loadConfig() {
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok) throw new Error("config");
      const config = await response.json();
      maxMb = Number(config.maxUploadMb) || 200;
      maxMbLabel.textContent = `Format MP4, WebM, MOV, OGG, atau MKV · Maksimum ${maxMb} MB`;
    } catch {
      maxMbLabel.textContent = "Server belum terhubung. Pastikan aplikasi sudah dijalankan.";
      showError("Tidak dapat terhubung ke server. Jalankan `npm install`, lalu `npm start` di folder proyek.");
    }
  }

  function upload(file) {
    hideError();
    if (busy) return;
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      showError("File yang dipilih tidak dikenali sebagai video. Coba pilih MP4 atau WebM.");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      showError(`Ukuran file melewati batas upload ${maxMb} MB.`);
      return;
    }

    const affiliateUrl = document.getElementById("affiliateUrl").value.trim();
    const affiliateTitle = document.getElementById("affiliateTitle").value.trim();
    const affiliateDescription = document.getElementById("affiliateDescription").value.trim();

    if (affiliateUrl) {
      try {
        const parsed = new URL(affiliateUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        showError("URL afiliasi harus valid dan diawali http:// atau https://.");
        return;
      }
      if (!affiliateTitle) {
        showError("Isi judul afiliasi jika menambahkan URL afiliasi.");
        return;
      }
    } else if (affiliateTitle || affiliateDescription) {
      showError("Kosongkan judul/deskripsi afiliasi jika URL afiliasi tidak diisi.");
      return;
    }

    busy = true;
    input.disabled = true;
    if (uploadButton) uploadButton.style.pointerEvents = "none";
    drop.style.display = "none";
    result.style.display = "none";
    progressWrap.style.display = "block";
    bar.style.width = "0%";
    status.textContent = `Mengunggah ${file.name} (${formatSize(file.size)})…`;

    const formData = new FormData();
    formData.append("video", file);
    formData.append("affiliateTitle", affiliateTitle);
    formData.append("affiliateDescription", affiliateDescription);
    formData.append("affiliateUrl", affiliateUrl);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        bar.style.width = `${percent}%`;
        status.textContent = `Mengunggah… ${percent}%`;
      }
    };
    xhr.onload = () => {
      try {
        let body;
        try { body = JSON.parse(xhr.responseText); }
        catch { throw new Error("Server memberikan respons yang tidak terbaca. Periksa log server."); }
        if (xhr.status < 200 || xhr.status >= 300) {
          throw new Error(body.error || `Upload gagal (HTTP ${xhr.status}).`);
        }
        if (!body.video || !body.video.url || !body.video.mediaUrl) {
          throw new Error("Upload selesai, tetapi server tidak mengirim tautan video.");
        }

        const videoPreview = document.getElementById("video");
        videoPreview.src = body.video.mediaUrl;
        videoPreview.load();
        document.getElementById("videoLink").value = body.video.url;
        document.getElementById("openLink").href = body.video.url;
        document.getElementById("affiliateResult").textContent = body.video.hasAffiliate
          ? "Link afiliasi tersimpan. Penonton dapat membukanya melalui tombol di halaman video."
          : "Video ini tidak menggunakan link afiliasi.";
        result.style.display = "block";
        input.value = "";
        status.textContent = "Upload selesai.";
      } catch (error) {
        drop.style.display = "block";
        showError(error.message || "Upload gagal.");
      } finally {
        resetUploadUi();
      }
    };
    xhr.onerror = () => {
      drop.style.display = "block";
      showError("Koneksi terputus saat upload. Periksa koneksi dan status server, lalu coba lagi.");
      resetUploadUi();
    };
    xhr.onabort = () => {
      drop.style.display = "block";
      showError("Upload dibatalkan.");
      resetUploadUi();
    };
    xhr.send(formData);
  }

  input.addEventListener("change", event => upload(event.target.files[0]));
  ["dragenter", "dragover"].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.remove("drag");
  }));
  drop.addEventListener("drop", event => upload(event.dataTransfer.files[0]));

  document.getElementById("copyLink").addEventListener("click", async () => {
    const field = document.getElementById("videoLink");
    if (!field.value) return;
    try {
      await navigator.clipboard.writeText(field.value);
    } catch {
      field.select();
      document.execCommand("copy");
    }
    const button = document.getElementById("copyLink");
    button.textContent = "Tersalin!";
    window.setTimeout(() => { button.textContent = "Salin tautan"; }, 1600);
  });

  loadConfig();
})();
