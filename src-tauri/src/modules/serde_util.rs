//! Serde helpers for JSON produced by PowerShell.
//!
//! `ConvertTo-Json` happily emits `null` for properties that happen to be empty
//! on a single object (a service with no start type, a task with no author…).
//! `#[serde(default)]` only covers *missing* keys, so one null used to fail the
//! parse of the entire list and the page looked empty. These deserializers turn
//! null (and missing) into a sensible default.

use serde::{Deserialize, Deserializer};

/// Accepts a JSON string, `null`, or a missing value and yields a `String`.
pub fn string_or_default<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(Option::<String>::deserialize(deserializer)?.unwrap_or_default())
}

/// Accepts a JSON boolean, `null`, or a missing value and yields a `bool`.
pub fn bool_or_default<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(Option::<bool>::deserialize(deserializer)?.unwrap_or(false))
}
