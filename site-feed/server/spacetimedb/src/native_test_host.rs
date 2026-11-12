//! Link-only host imports for native unit tests of pure Rust logic.
//!
//! SpacetimeDB provides these imports to deployed Wasm modules, not native test
//! executables. Never emulate successful database calls here: any host access
//! terminates the test process. Reducer/view behavior needs a real test server.
//! Signatures below follow the locked SpacetimeDB 1.12 ABI and are type-checked
//! against its raw declarations. This module is excluded from production builds.

use spacetimedb::sys::raw::{BytesSink, BytesSource, RowIter};
use spacetimedb_primitives::{ColId, IndexId, TableId};

macro_rules! unavailable_host {
    ($name:ident($($arg:ident: $ty:ty),* $(,)?) $(-> $result:ty)?) => {
        #[no_mangle]
        #[allow(unused_variables)]
        unsafe extern "C" fn $name($($arg: $ty),*) $(-> $result)? {
            eprintln!(
                "SpacetimeDB host call {} requires a running SpacetimeDB server",
                stringify!($name)
            );
            std::process::exit(101);
        }

        // Catch ABI drift when upgrading SpacetimeDB.
        const _: unsafe extern "C" fn($($ty),*) $(-> $result)? =
            spacetimedb::sys::raw::$name;
    };
}

#[test]
fn host_calls_fail_instead_of_simulating_a_database() {
    const CHILD: &str = "SITE_FEED_TEST_HOST_CHILD";
    if std::env::var_os(CHILD).is_some() {
        // No host exists to fill this output. The shim must terminate before
        // the wrapper can mistake uninitialized output for a database result.
        let _ = spacetimedb::sys::table_id_from_name("posts");
        panic!("host call unexpectedly returned");
    }

    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "native_test_host::host_calls_fail_instead_of_simulating_a_database",
            "--nocapture",
        ])
        .env(CHILD, "1")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(101));
    assert!(String::from_utf8_lossy(&output.stderr).contains(
        "SpacetimeDB host call table_id_from_name requires a running SpacetimeDB server"
    ));
}
unavailable_host!(table_id_from_name(name: *const u8, name_len: usize, out: *mut TableId) -> u16);
unavailable_host!(
    index_id_from_name(name_ptr: *const u8, name_len: usize, out: *mut IndexId) -> u16
);
unavailable_host!(datastore_table_row_count(table_id: TableId, out: *mut u64) -> u16);
unavailable_host!(datastore_table_scan_bsatn(table_id: TableId, out: *mut RowIter) -> u16);
unavailable_host!(
    datastore_index_scan_range_bsatn(
        index_id: IndexId,
        prefix_ptr: *const u8,
        prefix_len: usize,
        prefix_elems: ColId,
        rstart_ptr: *const u8,
        rstart_len: usize,
        rend_ptr: *const u8,
        rend_len: usize,
        out: *mut RowIter,
    ) -> u16
);
unavailable_host!(
    datastore_delete_by_index_scan_range_bsatn(
        index_id: IndexId,
        prefix_ptr: *const u8,
        prefix_len: usize,
        prefix_elems: ColId,
        rstart_ptr: *const u8,
        rstart_len: usize,
        rend_ptr: *const u8,
        rend_len: usize,
        out: *mut u32,
    ) -> u16
);
unavailable_host!(
    datastore_delete_all_by_eq_bsatn(
        table_id: TableId,
        rel_ptr: *const u8,
        rel_len: usize,
        out: *mut u32,
    ) -> u16
);
unavailable_host!(
    row_iter_bsatn_advance(iter: RowIter, buffer_ptr: *mut u8, buffer_len_ptr: *mut usize) -> i16
);
unavailable_host!(row_iter_bsatn_close(iter: RowIter) -> u16);
unavailable_host!(
    datastore_insert_bsatn(table_id: TableId, row_ptr: *mut u8, row_len_ptr: *mut usize) -> u16
);
unavailable_host!(
    datastore_update_bsatn(
        table_id: TableId,
        index_id: IndexId,
        row_ptr: *mut u8,
        row_len_ptr: *mut usize,
    ) -> u16
);
unavailable_host!(
    bytes_sink_write(sink: BytesSink, buffer_ptr: *const u8, buffer_len_ptr: *mut usize) -> u16
);
unavailable_host!(
    bytes_source_read(source: BytesSource, buffer_ptr: *mut u8, buffer_len_ptr: *mut usize) -> i16
);
unavailable_host!(
    console_log(
        level: u8,
        target_ptr: *const u8,
        target_len: usize,
        filename_ptr: *const u8,
        filename_len: usize,
        line_number: u32,
        message_ptr: *const u8,
        message_len: usize,
    )
);
unavailable_host!(console_timer_start(name_ptr: *const u8, name_len: usize) -> u32);
unavailable_host!(console_timer_end(timer_id: u32) -> u16);
unavailable_host!(identity(out_ptr: *mut u8));
unavailable_host!(bytes_source_remaining_length(source: BytesSource, out: *mut u32) -> i16);
unavailable_host!(get_jwt(connection_id_ptr: *const u8, bytes_source_id: *mut BytesSource) -> u16);
unavailable_host!(
    datastore_index_scan_point_bsatn(
        index_id: IndexId,
        point_ptr: *const u8,
        point_len: usize,
        out: *mut RowIter,
    ) -> u16
);
unavailable_host!(
    datastore_delete_by_index_scan_point_bsatn(
        index_id: IndexId,
        point_ptr: *const u8,
        point_len: usize,
        out: *mut u32,
    ) -> u16
);
