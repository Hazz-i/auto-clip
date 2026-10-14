# Folder Font Kustom Server Cliper

Direktori ini digunakan untuk menyimpan berkas font nyata (`.ttf` atau `.otf`) yang akan digunakan oleh FFmpeg saat membakar takarir karaoke (`libass`).

## Batasan Saat Ini
Font kustom yang diunggah melalui antarmuka Web Dashboard saat ini disimpan di `localStorage` peramban untuk pratinjau canvas lokal dan **BELUM disinkronkan ke server**.

## Cara Menggunakan Font Kustom di Server
1. Taruh berkas font berformat `.ttf` atau `.otf` (contoh: `Montserrat-Bold.ttf`, `Anton-Regular.ttf`) langsung di dalam folder ini (`apps/api/fonts/`).
2. Gunakan nama keluarga font (Fontname) yang sesuai pada payload render `captionStyle.fontFamily` (contoh: `"Montserrat"`).
3. Backend Cliper otomatis meneruskan parameter `:fontsdir=apps/api/fonts` ke filter `ass` FFmpeg sehingga font di folder ini langsung terbaca tanpa instalasi font sistem.
