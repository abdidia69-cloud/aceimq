const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DB_FILE = path.join(ROOT, "videos.json");
const MAX_MB = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 200));
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");

for (const dir of [PUBLIC_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}\n", "utf8");

app.disable("x-powered-by");
// Hapus directive bawaan sebelum menimpanya agar Helmet tidak menerima style-src dua kali.
const cspDirectives = { ...helmet.contentSecurityPolicy.getDefaultDirectives() };
delete cspDirectives["style-src"];
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      ...cspDirectives,
      "style-src": ["'self'", "'unsafe-inline'"],
      "script-src": ["'self'"],
      "script-src-attr": ["'none'"],
      "media-src": ["'self'", "blob:"],
      "connect-src": ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
app.use("/uploads", express.static(UPLOAD_DIR, {
  fallthrough: true,
  setHeaders(res) {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));

function readVideos() {
  try {
    const value = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (error) {
    console.error("Gagal membaca videos.json:", error.message);
    return {};
  }
}
function writeVideos(videos) {
  const temp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(videos, null, 2) + "\n", "utf8");
  fs.renameSync(temp, DB_FILE);
}
function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
function getExistingVideo(id) {
  const video = readVideos()[id];
  if (!video || typeof video.filename !== "string") return null;
  const fullPath = path.resolve(UPLOAD_DIR, video.filename);
  if (!fullPath.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(fullPath)) return null;
  return video;
}

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan upload. Coba lagi beberapa menit." }
});

const allowedMime = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/ogg", "video/x-matroska"
]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext || ".video"}`);
  }
});
const uploader = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) {
      return cb(new Error("Format belum didukung. Gunakan MP4, WebM, MOV, OGG, atau MKV."));
    }
    cb(null, true);
  }
});

app.get("/api/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ maxUploadMb: MAX_MB });
});

app.post("/api/upload", uploadLimiter, (req, res) => {
  uploader.single("video")(req, res, (err) => {
    if (err) {
      const status = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ error: err.message || "Upload gagal." });
    }
    if (!req.file) return res.status(400).json({ error: "Pilih file video terlebih dahulu." });

    const affiliateTitle = String(req.body.affiliateTitle || "").trim().slice(0, 160);
    const affiliateDescription = String(req.body.affiliateDescription || "").trim().slice(0, 500);
    const affiliateUrl = String(req.body.affiliateUrl || "").trim().slice(0, 2048);

    if (affiliateUrl && !validHttpUrl(affiliateUrl)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Link affiliate harus diawali http:// atau https://." });
    }
    if (affiliateUrl && !affiliateTitle) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Isi judul affiliate jika menambahkan link affiliate." });
    }

    const id = crypto.randomBytes(9).toString("hex");
    const videos = readVideos();
    videos[id] = {
      id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      createdAt: new Date().toISOString(),
      affiliate: affiliateUrl
        ? { title: affiliateTitle, description: affiliateDescription, url: affiliateUrl }
        : null
    };

    try {
      writeVideos(videos);
    } catch (writeErr) {
      console.error("Gagal menyimpan metadata video:", writeErr);
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ error: "Metadata video gagal disimpan. Periksa izin tulis folder proyek." });
    }

    res.status(201).json({
      message: "Upload berhasil.",
      video: {
        id,
        url: `${PUBLIC_BASE_URL}/v/${id}`,
        mediaUrl: `/uploads/${encodeURIComponent(req.file.filename)}`,
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        hasAffiliate: Boolean(videos[id].affiliate)
      }
    });
  });
});

app.get("/api/videos/:id", (req, res) => {
  const video = getExistingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video tidak ditemukan. Mungkin file sudah dipindahkan atau tautannya salah." });
  res.setHeader("Cache-Control", "no-store");
  res.json({
    id: video.id,
    filename: video.originalName,
    mediaUrl: `/uploads/${encodeURIComponent(video.filename)}`,
    affiliate: video.affiliate || null
  });
});

app.get("/v/:id", (req, res) => {
  if (!getExistingVideo(req.params.id)) {
    return res.status(404).sendFile(path.join(PUBLIC_DIR, "not-found.html"));
  }
  res.sendFile(path.join(PUBLIC_DIR, "video.html"));
});

app.get("/health", (_req, res) => res.json({ ok: true, app: "aceimq" }));

app.use((err, _req, res, _next) => {
  console.error("Server error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Terjadi kesalahan pada server. Periksa log aplikasi." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aceimq berjalan pada port ${PORT}`);
  console.log(`Base URL untuk link publik: ${PUBLIC_BASE_URL}`);
});
