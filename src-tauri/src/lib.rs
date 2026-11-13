use std::fs::{self, File};
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

static QMUSIC_SUPPORT_CHILD: Mutex<Option<u32>> = Mutex::new(None);
static BILI_PROXY_PORT: AtomicU16 = AtomicU16::new(0);
static ISLAND_EXPANDED: AtomicBool = AtomicBool::new(false);
static POSITIONS_RESTORED: AtomicBool = AtomicBool::new(false);
static POSITIONS_DIRTY: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WindowPositions {
    pub main_x: Option<i32>,
    pub main_y: Option<i32>,
    pub island_x: Option<i32>,
    pub island_y: Option<i32>,
}

static WINDOW_POSITIONS: Mutex<Option<WindowPositions>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    #[serde(default = "default_true")]
    pub blur_enabled: bool,
    #[serde(default)]
    pub custom_color: String,
    #[serde(default)]
    pub custom_trans_color: String,
    #[serde(default)]
    pub custom_roma_color: String,
    #[serde(default = "default_false")]
    pub disable_subline_opacity: bool,
    #[serde(default = "default_false")]
    pub use_custom_color: bool,
    #[serde(default = "default_false")]
    pub always_on_top: bool,
    #[serde(default = "default_false")]
    pub auto_start: bool,
    #[serde(default = "default_false")]
    pub close_to_tray: bool,
    #[serde(default = "default_true")]
    pub island_enabled: bool,
    #[serde(default = "default_true")]
    pub auto_launch_island_with_qqmusic: bool,
    #[serde(default = "default_island_display_mode")]
    pub island_display_mode: String,
    #[serde(default = "default_true")]
    pub mv_mode_enabled: bool,
    #[serde(default = "default_true")]
    pub mv_video_bg_enabled: bool,
    #[serde(default = "default_true")]
    pub mv_blur_enabled: bool,
    #[serde(default = "default_blur_value")]
    pub mv_blur_value: u32,
    #[serde(default = "default_fit_mode")]
    pub mv_fit_mode: String,
    #[serde(default = "default_qn")]
    pub mv_quality: u32,
    #[serde(default = "default_false")]
    pub subtitle_mode: bool,
    #[serde(default = "default_subtitle_font_size")]
    pub subtitle_font_size: u32,
    #[serde(default = "default_false")]
    pub onboarding_completed: bool,
}

fn default_true() -> bool {
    true
}
fn default_false() -> bool {
    false
}
fn default_blur_value() -> u32 {
    18
}
fn default_fit_mode() -> String {
    "cover".to_string()
}
fn default_qn() -> u32 {
    32
}
fn default_subtitle_font_size() -> u32 {
    28
}
fn default_island_display_mode() -> String {
    "always".to_string()
}

static HIDE_ISLAND_ON_FULLSCREEN: AtomicBool = AtomicBool::new(false);
static ISLAND_ENABLED_CACHE: AtomicBool = AtomicBool::new(true);

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            blur_enabled: true,
            custom_color: String::new(),
            custom_trans_color: String::new(),
            custom_roma_color: String::new(),
            disable_subline_opacity: false,
            use_custom_color: false,
            always_on_top: false,
            auto_start: false,
            close_to_tray: true,
            island_enabled: true,
            auto_launch_island_with_qqmusic: true,
            island_display_mode: "always".to_string(),
            mv_mode_enabled: true,
            mv_video_bg_enabled: true,
            mv_blur_enabled: true,
            mv_blur_value: 18,
            mv_fit_mode: "cover".to_string(),
            mv_quality: 32,
            subtitle_mode: false,
            subtitle_font_size: 28,
            onboarding_completed: false,
        }
    }
}

fn get_app_dir() -> PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("QLyrix");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn get_config_file() -> PathBuf {
    get_app_dir().join("config.json")
}

fn get_mv_mappings_file() -> PathBuf {
    get_app_dir().join("mv_bindings.json")
}

fn get_bilibili_account_file() -> PathBuf {
    get_app_dir().join("bilibili_account.json")
}

fn get_window_positions_file() -> PathBuf {
    get_app_dir().join("window_positions.json")
}

fn load_window_positions() -> WindowPositions {
    let file = get_window_positions_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(pos) = serde_json::from_str::<WindowPositions>(&content) {
                return pos;
            }
        }
    }
    WindowPositions::default()
}

fn save_window_positions(pos: &WindowPositions) {
    if let Ok(content) = serde_json::to_string_pretty(pos) {
        let _ = fs::write(get_window_positions_file(), content);
    }
}

fn is_position_on_screen(win: &tauri::WebviewWindow, x: i32, y: i32) -> bool {
    if x <= -10000 || y <= -10000 {
        return false;
    }
    if let Ok(monitors) = win.available_monitors() {
        for m in monitors {
            let m_pos = m.position();
            let m_size = m.size();
            let min_x = m_pos.x - 100;
            let max_x = m_pos.x + m_size.width as i32 - 80;
            let min_y = m_pos.y - 40;
            let max_y = m_pos.y + m_size.height as i32 - 40;
            if x >= min_x && x <= max_x && y >= min_y && y <= max_y {
                return true;
            }
        }
    }
    false
}

#[tauri::command]
fn get_app_config() -> AppConfig {
    let file = get_config_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(&content) {
                return cfg;
            }
        }
    }
    AppConfig::default()
}

#[tauri::command]
fn save_app_config(config: AppConfig) -> Result<(), String> {
    HIDE_ISLAND_ON_FULLSCREEN.store(
        config.island_display_mode == "hide_on_fullscreen",
        Ordering::Relaxed,
    );
    ISLAND_ENABLED_CACHE.store(config.island_enabled, Ordering::Relaxed);
    let file = get_config_file();
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(file, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_mv_mappings() -> serde_json::Value {
    let file = get_mv_mappings_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                return val;
            }
        }
    }
    serde_json::json!({})
}

#[tauri::command]
fn save_mv_mappings(mappings: serde_json::Value) -> Result<(), String> {
    let file = get_mv_mappings_file();
    let content = serde_json::to_string_pretty(&mappings).map_err(|e| e.to_string())?;
    fs::write(file, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_bilibili_account() -> serde_json::Value {
    let file = get_bilibili_account_file();
    if file.exists() {
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                return val;
            }
        }
    }
    serde_json::json!({
        "connected": false,
        "cookie": "",
        "mid": null,
        "uname": null,
        "face": null
    })
}

#[tauri::command]
fn save_bilibili_account(account: serde_json::Value) -> Result<(), String> {
    let file = get_bilibili_account_file();
    let content = serde_json::to_string_pretty(&account).map_err(|e| e.to_string())?;
    fs::write(file, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn toggle_window(app: AppHandle, label: String) {
    if let Some(win) = app.get_webview_window(&label) {
        if let Ok(visible) = win.is_visible() {
            if visible {
                let _ = win.hide();
            } else {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    }
}

#[tauri::command]
fn show_window(app: AppHandle, label: String) {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn hide_window(app: AppHandle, label: String) {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.hide();
    }
}

#[tauri::command]
fn set_window_always_on_top(app: AppHandle, label: String, on_top: bool) {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.set_always_on_top(on_top);
    }
}

fn find_qmusic_support_exe(app: Option<&AppHandle>) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    // 1. 用户配置目录下的更新组件优先
    candidates.push(get_app_dir().join("library/QMusicSupport/QMusicSupport.exe"));

    // 2. Tauri 打包的资源目录
    if let Some(handle) = app {
        if let Ok(res_dir) = handle.path().resource_dir() {
            candidates.push(res_dir.join("library/QMusicSupport/QMusicSupport.exe"));
            candidates.push(res_dir.join("_up_/library/QMusicSupport/QMusicSupport.exe"));
        }
    }

    // 3. 当前可执行文件所在目录（安装目录）及开发环境目录
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join("library/QMusicSupport/QMusicSupport.exe"));
            candidates.push(parent.join("resources/library/QMusicSupport/QMusicSupport.exe"));
            candidates.push(parent.join("_up_/library/QMusicSupport/QMusicSupport.exe"));
        }
    }

    candidates.push(PathBuf::from("library/QMusicSupport/QMusicSupport.exe"));
    candidates.push(PathBuf::from("../library/QMusicSupport/QMusicSupport.exe"));

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn is_process_running(exe_name: &str) -> bool {
    #[cfg(windows)]
    {
        if let Ok(output) = Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {}", exe_name), "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            let s = String::from_utf8_lossy(&output.stdout);
            return s.to_lowercase().contains(&exe_name.to_lowercase());
        }
    }
    false
}

fn start_qmusic_support_internal(app: Option<&AppHandle>) -> Result<bool, String> {
    let mut child_lock = QMUSIC_SUPPORT_CHILD.lock().unwrap();

    if is_process_running("QMusicSupport.exe") {
        return Ok(true);
    }

    *child_lock = None;

    let exe_path = match find_qmusic_support_exe(app) {
        Some(path) => path,
        None => return Err("未找到 QMusicSupport.exe 组件，请先下载更新组件。".to_string()),
    };

    #[cfg(windows)]
    {
        let mut cmd = Command::new(&exe_path);
        if let Some(parent) = exe_path.parent() {
            cmd.current_dir(parent);
        }
        cmd.creation_flags(CREATE_NO_WINDOW);
        match cmd.spawn() {
            Ok(child) => {
                *child_lock = Some(child.id());
                Ok(true)
            }
            Err(e) => Err(format!("启动 QMusicSupport 失败: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn start_qmusic_support(app: AppHandle) -> Result<bool, String> {
    start_qmusic_support_internal(Some(&app))
}

#[tauri::command]
fn stop_qmusic_support() {
    let mut child_lock = QMUSIC_SUPPORT_CHILD.lock().unwrap();
    *child_lock = None;
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "QMusicSupport.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
}

#[tauri::command]
async fn check_app_update(current_version: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("QLyrix-App")
        .build()
        .map_err(|e| e.to_string())?;

    let url = "https://api.github.com/repos/icecolaqaq/QLyrix/releases/latest";
    let resp = client.get(url).send().await.map_err(|e| format!("检查更新失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API 响应异常: {}", resp.status()));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let tag = json.get("tag_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let body = json.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let html_url = json.get("html_url").and_then(|v| v.as_str()).unwrap_or("https://github.com/icecolaqaq/QLyrix/releases").to_string();

    let clean_tag = tag.trim_start_matches('v');
    let clean_current = current_version.trim_start_matches('v');

    let has_update = !clean_tag.is_empty() && clean_tag != clean_current;

    Ok(serde_json::json!({
        "current_version": current_version,
        "latest_version": tag,
        "has_update": has_update,
        "release_notes": body,
        "download_url": html_url,
        "published_at": json.get("published_at").and_then(|v| v.as_str()).unwrap_or("")
    }))
}

#[tauri::command]
async fn check_component_update() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("QLyrix-App")
        .build()
        .map_err(|e| e.to_string())?;

    let url = "https://api.github.com/repos/icecolaqaq/QLyrix/releases";
    let resp = client.get(url).send().await.map_err(|e| format!("检查组件失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API 响应异常: {}", resp.status()));
    }

    let list: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

    let mut component_asset = None;
    let mut component_tag = String::new();

    for release in list {
        if let Some(assets) = release.get("assets").and_then(|a| a.as_array()) {
            for asset in assets {
                if let Some(name) = asset.get("name").and_then(|n| n.as_str()) {
                    if name.to_lowercase().contains("qmusicsupport") && name.ends_with(".zip") {
                        component_asset = Some(asset.clone());
                        component_tag = release.get("tag_name").and_then(|t| t.as_str()).unwrap_or("").to_string();
                        break;
                    }
                }
            }
        }
        if component_asset.is_some() {
            break;
        }
    }

    if let Some(asset) = component_asset {
        Ok(serde_json::json!({
            "has_component": true,
            "tag": component_tag,
            "name": asset.get("name"),
            "size": asset.get("size"),
            "browser_download_url": asset.get("browser_download_url")
        }))
    } else {
        Ok(serde_json::json!({
            "has_component": false,
            "msg": "未在 Releases 中发现 QMusicSupport 组件压缩包"
        }))
    }
}

#[tauri::command]
async fn download_and_update_component(app: AppHandle, download_url: String) -> Result<String, String> {
    stop_qmusic_support();

    let client = reqwest::Client::builder()
        .user_agent("QLyrix-App")
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("下载组件失败: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("读取组件数据失败: {}", e))?;

    let target_dir = get_app_dir().join("library/QMusicSupport");
    let _ = fs::create_dir_all(&target_dir);

    let reader = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("解压 Zip 失败: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            let _ = fs::create_dir_all(&outpath);
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    let _ = fs::create_dir_all(p);
                }
            }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    let _ = start_qmusic_support_internal(Some(&app));
    Ok("QMusicSupport 组件已成功更新！".to_string())
}

#[tauri::command]
async fn fetch_image_data_url(url: String) -> Result<String, String> {
    if url.trim().is_empty() || url.starts_with("data:") {
        return Ok(url);
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .header("Referer", "https://y.qq.com/")
        .send()
        .await
        .map_err(|e| format!("请求图片失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("图片请求响应异常: {}", resp.status()));
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .split(';')
        .next()
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, b64))
}

#[cfg(target_os = "windows")]
fn is_foreground_fullscreen() -> bool {
    #[repr(C)]
    #[derive(Default, Copy, Clone)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }
    #[repr(C)]
    struct MonitorInfo {
        cb_size: u32,
        rc_monitor: Rect,
        rc_work: Rect,
        dw_flags: u32,
    }
    extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetDesktopWindow() -> isize;
        fn GetShellWindow() -> isize;
        fn IsWindowVisible(hwnd: isize) -> i32;
        fn GetWindowRect(hwnd: isize, lp_rect: *mut Rect) -> i32;
        fn MonitorFromWindow(hwnd: isize, dw_flags: u32) -> isize;
        fn GetMonitorInfoW(h_monitor: isize, lpmi: *mut MonitorInfo) -> i32;
        fn GetClassNameW(hwnd: isize, lp_class_name: *mut u16, n_max_count: i32) -> i32;
    }
    unsafe {
        let fg = GetForegroundWindow();
        if fg == 0 || fg == GetDesktopWindow() || fg == GetShellWindow() {
            return false;
        }
        if IsWindowVisible(fg) == 0 {
            return false;
        }
        let mut class_buf = [0u16; 64];
        let class_len = GetClassNameW(fg, class_buf.as_mut_ptr(), class_buf.len() as i32);
        if class_len > 0 {
            let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
            if class_name == "Progman" || class_name == "WorkerW" {
                return false;
            }
        }
        let mut win_rect = Rect::default();
        if GetWindowRect(fg, &mut win_rect) == 0 {
            return false;
        }
        let hmon = MonitorFromWindow(fg, 2);
        if hmon == 0 {
            return false;
        }
        let mut mi = MonitorInfo {
            cb_size: std::mem::size_of::<MonitorInfo>() as u32,
            rc_monitor: Rect::default(),
            rc_work: Rect::default(),
            dw_flags: 0,
        };
        if GetMonitorInfoW(hmon, &mut mi) == 0 {
            return false;
        }
        win_rect.left <= mi.rc_monitor.left
            && win_rect.top <= mi.rc_monitor.top
            && win_rect.right >= mi.rc_monitor.right
            && win_rect.bottom >= mi.rc_monitor.bottom
    }
}

#[cfg(not(target_os = "windows"))]
fn is_foreground_fullscreen() -> bool {
    false
}

#[tauri::command]
fn set_island_expanded(_app: AppHandle, expanded: bool) {
    ISLAND_EXPANDED.store(expanded, Ordering::Relaxed);
}

#[tauri::command]
fn get_island_position(app: AppHandle) -> (i32, i32) {
    if let Some(win) = app.get_webview_window("island") {
        if let Ok(pos) = win.outer_position() {
            return (pos.x, pos.y);
        }
    }
    (0, 0)
}

#[tauri::command]
fn set_island_position(app: AppHandle, x: i32, y: i32) {
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
    }
}

fn center_island_top(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("island") {
        let scale = win.scale_factor().unwrap_or(1.0);
        let logical_w = 440.0;
        let phys_w = (logical_w * scale).round() as i32;

        if let Ok(Some(monitor)) = win.primary_monitor().or_else(|_| win.current_monitor()) {
            let m_pos = monitor.position();
            let m_size = monitor.size();
            let x = m_pos.x + ((m_size.width as i32 - phys_w) / 2).max(0);
            let y = m_pos.y + (24.0 * scale).round() as i32;
            let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
        }
    }
}

#[tauri::command]
fn reset_island_position(app: AppHandle) {
    center_island_top(&app);
    if let Ok(mut guard) = WINDOW_POSITIONS.lock() {
        let mut pos = guard.clone().unwrap_or_default();
        pos.island_x = None;
        pos.island_y = None;
        *guard = Some(pos);
        POSITIONS_DIRTY.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
fn get_bili_proxy_port() -> u16 {
    BILI_PROXY_PORT.load(Ordering::Relaxed)
}

fn start_bili_proxy() {
    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind("127.0.0.1:0").await {
            Ok(l) => l,
            Err(e) => {
                log::error!("Failed to bind Bilibili media proxy: {}", e);
                return;
            }
        };
        if let Ok(addr) = listener.local_addr() {
            BILI_PROXY_PORT.store(addr.port(), Ordering::Relaxed);
        }

        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default();

        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                continue;
            };
            let client = client.clone();

            tauri::async_runtime::spawn(async move {
                let (reader_half, mut writer_half) = socket.split();
                let mut buf_reader = BufReader::new(reader_half);
                let mut request_line = String::new();
                if buf_reader.read_line(&mut request_line).await.unwrap_or(0) == 0 {
                    return;
                }

                let mut range_header: Option<String> = None;
                loop {
                    let mut line = String::new();
                    if buf_reader.read_line(&mut line).await.unwrap_or(0) == 0 {
                        break;
                    }
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        break;
                    }
                    if let Some((k, v)) = trimmed.split_once(':') {
                        if k.trim().eq_ignore_ascii_case("range") {
                            range_header = Some(v.trim().to_string());
                        }
                    }
                }

                // Parse GET /proxy?b64=<base64url> HTTP/1.1
                let path = request_line.split_whitespace().nth(1).unwrap_or("");
                let b64_param = path
                    .split_once("b64=")
                    .map(|(_, r)| r.split('&').next().unwrap_or(""))
                    .unwrap_or("");

                use base64::Engine;
                let target_url = match base64::engine::general_purpose::URL_SAFE_NO_PAD
                    .decode(b64_param)
                    .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(b64_param))
                    .ok()
                    .and_then(|b| String::from_utf8(b).ok())
                {
                    Some(u) if u.starts_with("http://") || u.starts_with("https://") => u,
                    _ => {
                        let _ = writer_half
                            .write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
                            .await;
                        return;
                    }
                };

                if request_line.starts_with("OPTIONS ") {
                    let _ = writer_half
                        .write_all(
                            b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Range\r\n\r\n",
                        )
                        .await;
                    return;
                }

                let is_head = request_line.starts_with("HEAD ");
                let mut req = if is_head {
                    client.head(&target_url)
                } else {
                    client.get(&target_url)
                }
                .header("Referer", "https://www.bilibili.com/")
                .header("Origin", "https://www.bilibili.com");
                if let Some(r) = range_header {
                    req = req.header("Range", r);
                }

                let mut resp = match req.send().await {
                    Ok(r) => r,
                    Err(_) => {
                        let _ = writer_half
                            .write_all(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
                            .await;
                        return;
                    }
                };

                let status = resp.status();
                if !status.is_success() {
                    log::warn!("Bili proxy upstream {} for {}", status, target_url);
                }
                let status_line = format!(
                    "HTTP/1.1 {} {}\r\n",
                    status.as_u16(),
                    status.canonical_reason().unwrap_or("OK")
                );

                let mut headers_str = String::from(status_line);
                headers_str.push_str("Access-Control-Allow-Origin: *\r\n");
                headers_str.push_str("Connection: close\r\n");

                let mut has_content_type = false;
                for header_name in ["content-type", "content-length", "content-range", "accept-ranges"] {
                    if let Some(val) = resp.headers().get(header_name).and_then(|v| v.to_str().ok()) {
                        if header_name == "content-type" {
                            has_content_type = true;
                            if val == "application/octet-stream" && target_url.contains(".mp4") {
                                headers_str.push_str("content-type: video/mp4\r\n");
                                continue;
                            }
                        }
                        headers_str.push_str(&format!("{}: {}\r\n", header_name, val));
                    }
                }
                if !has_content_type && target_url.contains(".mp4") {
                    headers_str.push_str("content-type: video/mp4\r\n");
                }
                if !resp.headers().contains_key("accept-ranges") {
                    headers_str.push_str("accept-ranges: bytes\r\n");
                }
                headers_str.push_str("\r\n");

                if writer_half.write_all(headers_str.as_bytes()).await.is_err() {
                    return;
                }

                if !is_head {
                    while let Ok(Some(chunk)) = resp.chunk().await {
                        if writer_half.write_all(&chunk).await.is_err() {
                            break;
                        }
                    }
                }
            });
        }
    });
}

#[tauri::command]
async fn qqmusic_get_lyric(song_id: i64) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let payload = serde_json::json!({
        "comm": {
            "cv": 13020508,
            "v": 13020508,
            "QIMEI36": "35f21e7473442374591e560510001c71730b",
            "ct": "11",
            "tmeAppID": "qqmusic",
            "format": "json",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "uid": "3931641530"
        },
        "music.musichallSong.PlayLyricInfo.GetPlayLyricInfo": {
            "module": "music.musichallSong.PlayLyricInfo",
            "method": "GetPlayLyricInfo",
            "param": {
                "crypt": 1,
                "ct": 11,
                "cv": 13020508,
                "lrc_t": 0,
                "qrc": 1,
                "qrc_t": 0,
                "roma": 1,
                "roma_t": 0,
                "trans": 1,
                "trans_t": 0,
                "type": 1,
                "songId": song_id
            }
        }
    });

    let resp = client
        .post("https://u.y.qq.com/cgi-bin/musicu.fcg")
        .header("Referer", "https://y.qq.com/")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("请求 QQ 音乐歌词接口失败: {}", e))?;

    let json: serde_json::Value = resp.json().await.map_err(|e| format!("解析 QQ 音乐响应失败: {}", e))?;
    Ok(json)
}

#[tauri::command]
async fn save_binary_file(path: String, base64_data: String) -> Result<(), String> {
    use std::io::Write;
    let data = match base64_data.split(',').last() {
        Some(d) => d,
        None => &base64_data,
    };
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;
    let mut file = File::create(&path).map_err(|e| format!("创建文件失败: {}", e))?;
    file.write_all(&bytes).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| format!("写入文本失败: {}", e))
}
#[tauri::command]
async fn bilibili_request(
    url: String,
    method: Option<String>,
    cookie: Option<String>,
    referer: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
    let mut req = if method.as_deref().unwrap_or("GET").to_uppercase() == "POST" {
        client.post(&url)
    } else {
        client.get(&url)
    };

    req = req.header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    if let Some(ref_url) = referer {
        req = req.header("Referer", ref_url);
    } else {
        req = req.header("Referer", "https://www.bilibili.com/");
    }

    if let Some(c) = cookie {
        if !c.is_empty() {
            req = req.header("Cookie", c);
        }
    }

    let resp = req.send().await.map_err(|e| format!("请求 B 站接口失败: {}", e))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("解析 JSON 失败: {}", e))?;
    Ok(json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            // Build system tray
            let toggle_main_i = MenuItem::with_id(app, "toggle_main", "显示/隐藏主窗口", true, None::<&str>)?;
            let toggle_island_i = MenuItem::with_id(app, "toggle_island", "显示/隐藏灵动岛", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出 QLyrix", true, None::<&str>)?;

            let tray_menu = Menu::with_items(
                app,
                &[
                    &toggle_main_i,
                    &toggle_island_i,
                    &settings_i,
                    &quit_i,
                ],
            )?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("QLyrix - 外置歌词播放器")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle_main" => {
                        toggle_window(app.clone(), "main".to_string());
                    }
                    "toggle_island" => {
                        toggle_window(app.clone(), "island".to_string());
                    }
                    "settings" => {
                        show_window(app.clone(), "settings".to_string());
                    }
                    "quit" => {
                        stop_qmusic_support();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        toggle_window(app.clone(), "main".to_string());
                    }
                })
                .build(app)?;

            // Start Bilibili local media stream proxy
            start_bili_proxy();

            // Restore saved window positions or center windows by default
            let saved_pos = load_window_positions();
            if let Ok(mut guard) = WINDOW_POSITIONS.lock() {
                *guard = Some(saved_pos.clone());
            }
            if let Some(main_win) = app.get_webview_window("main") {
                if let (Some(x), Some(y)) = (saved_pos.main_x, saved_pos.main_y) {
                    if is_position_on_screen(&main_win, x, y) {
                        let _ = main_win.set_position(tauri::PhysicalPosition::new(x, y));
                    } else {
                        let _ = main_win.center();
                    }
                } else {
                    let _ = main_win.center();
                }
            }
            if let Some(settings_win) = app.get_webview_window("settings") {
                let _ = settings_win.center();
            }
            if let Some(island_win) = app.get_webview_window("island") {
                if let (Some(x), Some(y)) = (saved_pos.island_x, saved_pos.island_y) {
                    if is_position_on_screen(&island_win, x, y) {
                        let _ = island_win.set_position(tauri::PhysicalPosition::new(x, y));
                    } else {
                        center_island_top(&app.handle());
                    }
                } else {
                    center_island_top(&app.handle());
                }
            } else {
                center_island_top(&app.handle());
            }
            POSITIONS_RESTORED.store(true, Ordering::Relaxed);

            // Hit-test thread for Dynamic Island click-through outside the pill/card
            let island_hit_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_ignore: Option<bool> = None;
                loop {
                    if let Some(win) = island_hit_handle.get_webview_window("island") {
                        if win.is_visible().unwrap_or(false) {
                            if let (Ok(cursor), Ok(pos)) =
                                (island_hit_handle.cursor_position(), win.outer_position())
                            {
                                let scale = win.scale_factor().unwrap_or(1.0);
                                let lx = (cursor.x - pos.x as f64) / scale;
                                let ly = (cursor.y - pos.y as f64) / scale;
                                let expanded = ISLAND_EXPANDED.load(Ordering::Relaxed);
                                let inside = if expanded {
                                    (14.0..=426.0).contains(&lx) && (2.0..=214.0).contains(&ly)
                                } else {
                                    (124.0..=316.0).contains(&lx) && (2.0..=56.0).contains(&ly)
                                };
                                let should_ignore = !inside;
                                if last_ignore != Some(should_ignore) {
                                    let _ = win.set_ignore_cursor_events(should_ignore);
                                    last_ignore = Some(should_ignore);
                                }
                            }
                        }
                    }
                    std::thread::sleep(std::time::Duration::from_millis(40));
                }
            });

            // Apply initial always_on_top and island display mode settings
            let initial_cfg = get_app_config();
            HIDE_ISLAND_ON_FULLSCREEN.store(
                initial_cfg.island_display_mode == "hide_on_fullscreen",
                Ordering::Relaxed,
            );
            ISLAND_ENABLED_CACHE.store(initial_cfg.island_enabled, Ordering::Relaxed);
            if initial_cfg.always_on_top {
                if let Some(main_win) = app.get_webview_window("main") {
                    let _ = main_win.set_always_on_top(true);
                }
            }

            // Monitor fullscreen state to hide/restore Dynamic Island when configured
            let fullscreen_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut hidden_by_fullscreen = false;
                loop {
                    let hide_on_fs = HIDE_ISLAND_ON_FULLSCREEN.load(Ordering::Relaxed);
                    let main_fs = fullscreen_handle
                        .get_webview_window("main")
                        .and_then(|w| w.is_fullscreen().ok())
                        .unwrap_or(false);
                    let fs_active = main_fs || is_foreground_fullscreen();

                    if let Some(island_win) = fullscreen_handle.get_webview_window("island") {
                        let visible = island_win.is_visible().unwrap_or(false);
                        if hide_on_fs && fs_active {
                            if visible {
                                let _ = island_win.hide();
                                hidden_by_fullscreen = true;
                            }
                        } else if hidden_by_fullscreen {
                            if ISLAND_ENABLED_CACHE.load(Ordering::Relaxed) && !visible {
                                let _ = island_win.show();
                            }
                            hidden_by_fullscreen = false;
                        }
                    }
                    if POSITIONS_DIRTY.swap(false, Ordering::Relaxed) {
                        if let Ok(guard) = WINDOW_POSITIONS.lock() {
                            if let Some(ref pos) = *guard {
                                save_window_positions(pos);
                            }
                        }
                    }
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            });

            // Start QMusicSupport in background
            let app_handle = app.handle().clone();
            let _ = start_qmusic_support_internal(Some(&app_handle));

            // Monitor QQMusic.exe to auto-launch Dynamic Island when QQ Music starts
            std::thread::spawn(move || {
                let mut was_running = false;
                loop {
                    let is_running = is_process_running("QQMusic.exe");
                    if is_running && !was_running {
                        let cfg = get_app_config();
                        if cfg.auto_launch_island_with_qqmusic {
                            if let Some(island_win) = app_handle.get_webview_window("island") {
                                if !island_win.is_visible().unwrap_or(false) {
                                    let _ = island_win.show();
                                }
                            }
                        }
                    }
                    was_running = is_running;
                    std::thread::sleep(std::time::Duration::from_secs(3));
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Moved(pos) = event {
                if !POSITIONS_RESTORED.load(Ordering::Relaxed) {
                    return;
                }
                if pos.x <= -10000 || pos.y <= -10000 {
                    return;
                }
                if window.is_minimized().unwrap_or(false)
                    || window.is_maximized().unwrap_or(false)
                    || window.is_fullscreen().unwrap_or(false)
                {
                    return;
                }
                let label = window.label();
                if label != "main" && label != "island" {
                    return;
                }
                if let Ok(mut guard) = WINDOW_POSITIONS.lock() {
                    let mut saved = guard.clone().unwrap_or_default();
                    if label == "main" {
                        saved.main_x = Some(pos.x);
                        saved.main_y = Some(pos.y);
                    } else {
                        saved.island_x = Some(pos.x);
                        saved.island_y = Some(pos.y);
                    }
                    *guard = Some(saved);
                    POSITIONS_DIRTY.store(true, Ordering::Relaxed);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            save_app_config,
            get_mv_mappings,
            save_mv_mappings,
            get_bilibili_account,
            save_bilibili_account,
            toggle_window,
            show_window,
            hide_window,
            set_window_always_on_top,
            set_island_expanded,
            get_island_position,
            set_island_position,
            reset_island_position,
            get_bili_proxy_port,
            start_qmusic_support,
            stop_qmusic_support,
            check_app_update,
            check_component_update,
            download_and_update_component,
            bilibili_request,
            qqmusic_get_lyric,
            fetch_image_data_url,
            save_binary_file,
            save_text_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if POSITIONS_DIRTY.swap(false, Ordering::Relaxed) {
                    if let Ok(guard) = WINDOW_POSITIONS.lock() {
                        if let Some(ref pos) = *guard {
                            save_window_positions(pos);
                        }
                    }
                }
                stop_qmusic_support();
            }
        });
}
