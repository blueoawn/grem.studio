# Rust module tests

From `site-feed/server/spacetimedb`, run:

```sh
cargo check --locked
cargo test --locked
cargo build --locked --target wasm32-unknown-unknown
```

Native unit tests exercise pure Rust validation and serialization. SpacetimeDB
1.12 normally imports database, logging, and byte-stream functions from its Wasm
host. Its SDK does not supply native implementations, so the native test binary
otherwise fails to link (LNK2019/LNK1120 on Windows).

`src/native_test_host.rs` supplies link-only symbols under
`cfg(all(test, not(target_arch = "wasm32")))`. Every call prints a diagnostic and
exits unsuccessfully. These functions do not simulate a database and cannot make
an authorization or persistence test pass. Reducer and view integration tests
must run against a disposable SpacetimeDB server. The subprocess regression test
checks that an accidental database call fails. Function signatures are checked
against the SDK ABI; review these shims when upgrading SpacetimeDB.

Production native checks and deployed Wasm builds exclude the shims. No tables,
reducers, data, or migration behavior change. The primitives dev dependency
uses the same version already in the lockfile.
