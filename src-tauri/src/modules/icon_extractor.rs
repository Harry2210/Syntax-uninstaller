use std::collections::HashMap;
use std::ffi::OsStr;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static ICON_CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

#[repr(C)]
#[allow(non_snake_case)]
struct SHFILEINFOW {
    hIcon: *mut std::ffi::c_void,
    iIcon: i32,
    dwAttributes: u32,
    szDisplayName: [u16; 260],
    szTypeName: [u16; 80],
}

#[repr(C)]
#[allow(non_snake_case)]
struct ICONINFO {
    fIcon: i32,
    xHotspot: u32,
    yHotspot: u32,
    hbmMask: *mut std::ffi::c_void,
    hbmColor: *mut std::ffi::c_void,
}

#[repr(C)]
#[allow(non_snake_case)]
struct BITMAP {
    bmType: i32,
    bmWidth: i32,
    bmHeight: i32,
    bmWidthBytes: i32,
    bmPlanes: u16,
    bmBitsPixel: u16,
    bmBits: *mut std::ffi::c_void,
}

#[repr(C)]
#[allow(non_snake_case)]
struct BITMAPINFOHEADER {
    biSize: u32,
    biWidth: i32,
    biHeight: i32,
    biPlanes: u16,
    biBitCount: u16,
    biCompression: u32,
    biSizeImage: u32,
    biXPelsPerMeter: i32,
    biYPelsPerMeter: i32,
    biClrUsed: u32,
    biClrImportant: u32,
}

#[link(name = "shell32")]
extern "system" {
    fn SHGetFileInfoW(
        pszPath: *const u16,
        dwFileAttributes: u32,
        psfi: *mut SHFILEINFOW,
        cbFileInfo: u32,
        uFlags: u32,
    ) -> usize;

    fn ExtractIconExW(
        lpszFile: *const u16,
        nIconIndex: i32,
        phiconLarge: *mut *mut std::ffi::c_void,
        phiconSmall: *mut *mut std::ffi::c_void,
        nIcons: u32,
    ) -> u32;
}

#[link(name = "user32")]
extern "system" {
    fn GetIconInfo(hIcon: *mut std::ffi::c_void, piconinfo: *mut ICONINFO) -> i32;
    fn DestroyIcon(hIcon: *mut std::ffi::c_void) -> i32;
    fn GetDC(hWnd: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn ReleaseDC(hWnd: *mut std::ffi::c_void, hDC: *mut std::ffi::c_void) -> i32;
}

#[link(name = "gdi32")]
extern "system" {
    fn GetObjectW(
        hgdiobj: *mut std::ffi::c_void,
        cbBuffer: i32,
        lpvObject: *mut std::ffi::c_void,
    ) -> i32;
    fn DeleteObject(hObject: *mut std::ffi::c_void) -> i32;
    fn GetDIBits(
        hdc: *mut std::ffi::c_void,
        hbm: *mut std::ffi::c_void,
        start: u32,
        cLines: u32,
        lpvBits: *mut std::ffi::c_void,
        lpbmi: *mut BITMAPINFOHEADER,
        usage: u32,
    ) -> i32;
}

const SHGFI_ICON: u32 = 0x000000100;
const SHGFI_LARGEICON: u32 = 0x000000000;

/// Parse and clean a raw Windows DisplayIcon string, extracting the clean path and any icon index
pub fn parse_icon_target(raw: &str) -> (String, i32) {
    let mut s = raw.trim();

    // Strip outer quotes
    if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        s = &s[1..s.len() - 1];
    } else if s.starts_with('"') {
        if let Some(end_idx) = s[1..].find('"') {
            s = &s[1..=end_idx];
        }
    }

    let mut icon_index = 0i32;

    // Check for comma separator for icon index e.g. "C:\Path\app.exe,0" or ",-1"
    if let Some(comma_pos) = s.rfind(',') {
        let remainder = s[comma_pos + 1..].trim();
        if let Ok(idx) = remainder.parse::<i32>() {
            icon_index = idx;
            s = s[..comma_pos].trim();
        }
    }

    let expanded = expand_env_vars(s);
    (expanded, icon_index)
}

pub fn clean_icon_path(raw: &str) -> String {
    let (path, _) = parse_icon_target(raw);
    path
}

fn expand_env_vars(path_str: &str) -> String {
    let mut result = path_str.to_string();
    if result.contains('%') {
        let vars = [
            (
                "ProgramFiles",
                std::env::var("ProgramFiles").unwrap_or_default(),
            ),
            (
                "ProgramFiles(x86)",
                std::env::var("ProgramFiles(x86)").unwrap_or_default(),
            ),
            (
                "ProgramW6432",
                std::env::var("ProgramW6432").unwrap_or_default(),
            ),
            (
                "SystemRoot",
                std::env::var("SystemRoot").unwrap_or_default(),
            ),
            ("windir", std::env::var("windir").unwrap_or_default()),
            ("APPDATA", std::env::var("APPDATA").unwrap_or_default()),
            (
                "LOCALAPPDATA",
                std::env::var("LOCALAPPDATA").unwrap_or_default(),
            ),
            (
                "USERPROFILE",
                std::env::var("USERPROFILE").unwrap_or_default(),
            ),
            (
                "CommonProgramFiles",
                std::env::var("CommonProgramFiles").unwrap_or_default(),
            ),
            ("PUBLIC", std::env::var("PUBLIC").unwrap_or_default()),
        ];
        for (k, v) in &vars {
            if !v.is_empty() {
                let needle = format!("%{}%", k);
                result = result.replace(&needle, v);
            }
        }
    }
    result
}

/// Extract authentic Windows application icon into a high-res base64 data URL
pub fn extract_icon_as_base64(raw_path: &str) -> Option<String> {
    if raw_path.trim().is_empty() {
        return None;
    }

    // Direct data URL passthrough
    if raw_path.starts_with("data:image/") || raw_path.starts_with("http") {
        return Some(raw_path.to_string());
    }

    let (clean_path, icon_index) = parse_icon_target(raw_path);
    if clean_path.is_empty() {
        return None;
    }

    let cache_key = format!("{}:{}", clean_path, icon_index);

    // 1. Check in-memory cache
    {
        // Recover from a poisoned mutex instead of panicking: an earlier panic
        // during icon decoding must not permanently break every later lookup.
        let mut guard = ICON_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        if guard.is_none() {
            *guard = Some(HashMap::new());
        }
        if let Some(cache) = guard.as_ref() {
            if let Some(cached) = cache.get(&cache_key) {
                return Some(cached.clone());
            }
        }
    }

    let path = Path::new(&clean_path);
    if !path.exists() {
        return None;
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // 2. Direct .ico file read
    if ext == "ico" {
        if let Ok(bytes) = fs::read(path) {
            let encoded = base64_encode(&bytes);
            let data_url = format!("data:image/x-icon;base64,{}", encoded);
            cache_icon(cache_key, data_url.clone());
            return Some(data_url);
        }
    }

    // 3. Direct .png or .jpg file
    if ext == "png" || ext == "jpg" || ext == "jpeg" {
        if let Ok(bytes) = fs::read(path) {
            let mime = if ext == "png" {
                "image/png"
            } else {
                "image/jpeg"
            };
            let encoded = base64_encode(&bytes);
            let data_url = format!("data:{};base64,{}", mime, encoded);
            cache_icon(cache_key, data_url.clone());
            return Some(data_url);
        }
    }

    // 4. Ultra-Fast Native Win32 Extract for PE binaries (.exe, .dll) & Shortcuts (.lnk)
    if ext == "exe" || ext == "dll" || ext == "lnk" || ext.is_empty() {
        if let Some(bmp_data_url) = extract_native_win32_icon(&clean_path, icon_index) {
            cache_icon(cache_key, bmp_data_url.clone());
            return Some(bmp_data_url);
        }
    }

    None
}

/// Native Win32 extraction: calls ExtractIconExW / SHGetFileInfoW directly in memory
fn extract_native_win32_icon(clean_path: &str, icon_index: i32) -> Option<String> {
    let wide: Vec<u16> = OsStr::new(clean_path)
        .encode_wide()
        .chain(Some(0))
        .collect();

    let mut large_icon: *mut std::ffi::c_void = std::ptr::null_mut();

    // Try ExtractIconExW first (supports index like 0, 1, -1)
    let extracted = unsafe {
        ExtractIconExW(
            wide.as_ptr(),
            icon_index,
            &mut large_icon,
            std::ptr::null_mut(),
            1,
        )
    };

    let hicon = if extracted > 0 && !large_icon.is_null() {
        large_icon
    } else {
        // Fall back to universal SHGetFileInfoW
        let mut sfi: SHFILEINFOW = unsafe { std::mem::zeroed() };
        let res = unsafe {
            SHGetFileInfoW(
                wide.as_ptr(),
                0,
                &mut sfi,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON | SHGFI_LARGEICON,
            )
        };
        if res != 0 && !sfi.hIcon.is_null() {
            sfi.hIcon
        } else {
            std::ptr::null_mut()
        }
    };

    if hicon.is_null() {
        return None;
    }

    let bmp_bytes = hicon_to_bmp_bytes(hicon);
    unsafe {
        DestroyIcon(hicon);
    }

    bmp_bytes.map(|bytes| {
        let b64 = base64_encode(&bytes);
        format!("data:image/bmp;base64,{}", b64)
    })
}

/// Convert a Windows HICON handle into a complete 32-bit BMP byte buffer
fn hicon_to_bmp_bytes(hicon: *mut std::ffi::c_void) -> Option<Vec<u8>> {
    let mut icon_info: ICONINFO = unsafe { std::mem::zeroed() };
    if unsafe { GetIconInfo(hicon, &mut icon_info) } == 0 {
        return None;
    }

    let hbm = if !icon_info.hbmColor.is_null() {
        icon_info.hbmColor
    } else {
        icon_info.hbmMask
    };

    let mut bm: BITMAP = unsafe { std::mem::zeroed() };
    if unsafe {
        GetObjectW(
            hbm,
            std::mem::size_of::<BITMAP>() as i32,
            &mut bm as *mut _ as *mut _,
        )
    } == 0
    {
        unsafe {
            if !icon_info.hbmColor.is_null() {
                DeleteObject(icon_info.hbmColor);
            }
            if !icon_info.hbmMask.is_null() {
                DeleteObject(icon_info.hbmMask);
            }
        }
        return None;
    }

    let width = bm.bmWidth;
    let height = bm.bmHeight;
    let img_size = (width * height * 4) as usize;

    let mut bmi: BITMAPINFOHEADER = unsafe { std::mem::zeroed() };
    bmi.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bmi.biWidth = width;
    bmi.biHeight = height; // bottom-up
    bmi.biPlanes = 1;
    bmi.biBitCount = 32;
    bmi.biCompression = 0; // BI_RGB
    bmi.biSizeImage = img_size as u32;

    let hdc = unsafe { GetDC(std::ptr::null_mut()) };
    let mut pixels = vec![0u8; img_size];

    let lines = unsafe {
        GetDIBits(
            hdc,
            hbm,
            0,
            height as u32,
            pixels.as_mut_ptr() as *mut _,
            &mut bmi,
            0, // DIB_RGB_COLORS
        )
    };

    unsafe {
        ReleaseDC(std::ptr::null_mut(), hdc);
        if !icon_info.hbmColor.is_null() {
            DeleteObject(icon_info.hbmColor);
        }
        if !icon_info.hbmMask.is_null() {
            DeleteObject(icon_info.hbmMask);
        }
    }

    if lines == 0 {
        return None;
    }

    // Normalize alpha channel: if icon has no transparent pixels (all alpha == 0),
    // set all alpha bytes to 255 so the icon is completely opaque and visible in browsers.
    let has_non_zero_alpha = pixels.chunks(4).any(|p| p.len() == 4 && p[3] > 0);
    if !has_non_zero_alpha {
        for chunk in pixels.chunks_mut(4) {
            if chunk.len() == 4 {
                chunk[3] = 255;
            }
        }
    }

    // Build standard 32-bit BMP
    let file_header_size = 14usize;
    let info_header_size = 40usize;
    let total_file_size = file_header_size + info_header_size + img_size;

    let mut bmp_data = Vec::with_capacity(total_file_size);
    // 14 bytes BITMAPFILEHEADER
    bmp_data.extend_from_slice(b"BM");
    bmp_data.extend_from_slice(&(total_file_size as u32).to_le_bytes());
    bmp_data.extend_from_slice(&[0u8; 4]); // reserved
    let offset = (file_header_size + info_header_size) as u32;
    bmp_data.extend_from_slice(&offset.to_le_bytes());

    // 40 bytes BITMAPINFOHEADER
    bmp_data.extend_from_slice(&40u32.to_le_bytes());
    bmp_data.extend_from_slice(&width.to_le_bytes());
    bmp_data.extend_from_slice(&height.to_le_bytes());
    bmp_data.extend_from_slice(&1u16.to_le_bytes());
    bmp_data.extend_from_slice(&32u16.to_le_bytes());
    bmp_data.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    bmp_data.extend_from_slice(&(img_size as u32).to_le_bytes());
    bmp_data.extend_from_slice(&2835u32.to_le_bytes()); // ~72 DPI
    bmp_data.extend_from_slice(&2835u32.to_le_bytes());
    bmp_data.extend_from_slice(&0u32.to_le_bytes());
    bmp_data.extend_from_slice(&0u32.to_le_bytes());

    // Pixel bits
    bmp_data.extend_from_slice(&pixels);

    Some(bmp_data)
}

/// Extract authentic PNG logo for modern Windows Store / UWP packages
pub fn extract_appx_icon(install_location: &str) -> Option<String> {
    if install_location.trim().is_empty() {
        return None;
    }

    let p = Path::new(install_location);
    if !p.exists() {
        return None;
    }

    let assets_dir = p.join("Assets");
    let search_dir = if assets_dir.exists() {
        assets_dir
    } else {
        p.to_path_buf()
    };

    // Find best PNG matching AppList or Logo
    if let Ok(entries) = fs::read_dir(&search_dir) {
        let mut candidates: Vec<(PathBuf, u32)> = Vec::new();

        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("png"))
                .unwrap_or(false)
            {
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                // Skip high-contrast or tiny 16px assets
                if file_name.contains("contrast")
                    || file_name.contains("targetsize-16")
                    || file_name.contains("targetsize-24")
                {
                    continue;
                }

                let mut score = 0u32;
                if file_name.contains("applist") {
                    score += 100;
                }
                if file_name.contains("square44x44") {
                    score += 80;
                }
                if file_name.contains("logo") {
                    score += 60;
                }
                if file_name.contains("scale-200") {
                    score += 40;
                } else if file_name.contains("scale-150") || file_name.contains("scale-100") {
                    score += 20;
                }
                if file_name.contains("targetsize-48") || file_name.contains("targetsize-256") {
                    score += 30;
                }

                candidates.push((path, score));
            }
        }

        candidates.sort_by(|a, b| b.1.cmp(&a.1));
        if let Some((best_path, _)) = candidates.first() {
            if let Ok(bytes) = fs::read(best_path) {
                let encoded = base64_encode(&bytes);
                return Some(format!("data:image/png;base64,{}", encoded));
            }
        }
    }

    None
}

fn cache_icon(path: String, data_url: String) {
    let mut guard = ICON_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(cache) = guard.as_mut() {
        cache.insert(path, data_url);
    }
}

pub fn base64_encode(input: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((input.len() + 2) / 3 * 4);

    for chunk in input.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

        result.push(CHARSET[((n >> 18) & 63) as usize] as char);
        result.push(CHARSET[((n >> 12) & 63) as usize] as char);

        if chunk.len() > 1 {
            result.push(CHARSET[((n >> 6) & 63) as usize] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(CHARSET[(n & 63) as usize] as char);
        } else {
            result.push('=');
        }
    }

    result
}
