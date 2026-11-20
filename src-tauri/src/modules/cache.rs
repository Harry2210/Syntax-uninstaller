//! Small in-memory TTL cache for expensive system queries.
//!
//! Why: the dashboard, the sidebar and individual pages can all ask for the
//! same inventory (Windows services, scheduled tasks) within a second of each
//! other — including React StrictMode's double effect in development. Each of
//! those calls used to spawn a fresh `powershell.exe`. A short TTL keeps the
//! UI instant and stops the app from firing bursts of child processes, while
//! mutations invalidate the affected entry so nothing stale is shown.

use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

fn store() -> &'static Mutex<HashMap<String, (Instant, String)>> {
    static STORE: OnceLock<Mutex<HashMap<String, (Instant, String)>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn read(key: &str, ttl: Duration) -> Option<String> {
    let mut guard = store().lock().ok()?;
    match guard.get(key) {
        Some((stored_at, value)) if stored_at.elapsed() <= ttl => Some(value.clone()),
        Some(_) => {
            // Drop expired entries as they are encountered so a long session
            // that scans many folders does not grow the map forever.
            guard.remove(key);
            None
        }
        None => None,
    }
}

fn write(key: &str, value: &str) {
    if let Ok(mut guard) = store().lock() {
        if guard.len() >= 64 {
            guard.retain(|_, (stored_at, _)| stored_at.elapsed() < Duration::from_secs(300));
        }
        guard.insert(key.to_string(), (Instant::now(), value.to_string()));
    }
}

/// Returns a cached value if it is younger than `ttl`.
///
/// Exposed separately from [`cached`] for callers that need to attach a
/// progress callback to the expensive computation: they can check the cache
/// first and only then start a scan.
pub fn get<T: DeserializeOwned>(key: &str, ttl: Duration) -> Option<T> {
    let raw = read(key, ttl)?;
    serde_json::from_str::<T>(&raw).ok()
}

/// Stores a value in the in-memory TTL cache.
pub fn put<T: Serialize>(key: &str, value: &T) {
    if let Ok(raw) = serde_json::to_string(value) {
        write(key, &raw);
    }
}

/// Returns the cached value for `key`, or computes, stores and returns a fresh one.
pub fn cached<T, F>(key: &str, ttl: Duration, compute: F) -> T
where
    T: Serialize + DeserializeOwned,
    F: FnOnce() -> T,
{
    if let Some(value) = get(key, ttl) {
        return value;
    }

    let value = compute();
    put(key, &value);
    value
}

/// Drops every cached entry whose key starts with `prefix`.
pub fn invalidate(prefix: &str) {
    if let Ok(mut guard) = store().lock() {
        guard.retain(|key, _| !key.starts_with(prefix));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_reads_and_invalidates_by_prefix() {
        let key = format!("cache-test:{}", uuid::Uuid::new_v4());
        put(&key, &vec![1u32, 2, 3]);
        assert_eq!(
            get::<Vec<u32>>(&key, Duration::from_secs(5)),
            Some(vec![1, 2, 3])
        );

        invalidate(&key);
        assert_eq!(get::<Vec<u32>>(&key, Duration::from_secs(5)), None);
    }
}
