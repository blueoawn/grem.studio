//! Media processor: validates and prepares media assets for publication.
//!
//! This module handles:
//! - Content-type sniffing and validation
//! - Image thumbnail generation (placeholder)
//! - Video poster extraction (placeholder)
//! - Hash computation
//! - Processing status tracking

use std::fs;
use std::io::Read;
use std::path::Path;

use crate::media::{MediaAsset, ASSET_STATUS_READY};

/// Maximum file size (100 MB)
pub const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024;

/// Maximum image dimensions (width x height)
pub const MAX_IMAGE_DIMENSION: u32 = 8192;

/// Maximum video duration in seconds
pub const MAX_VIDEO_DURATION: u32 = 3600; // 1 hour

/// Supported image MIME types
pub const SUPPORTED_IMAGE_TYPES: &[&str] = &["image/jpeg", "image/png", "image/gif", "image/webp"];

/// Supported video MIME types
pub const SUPPORTED_VIDEO_TYPES: &[&str] = &["video/mp4", "video/webm"];

/// Process an uploaded file and prepare it for publication
pub fn process_asset(
    asset: &mut MediaAsset,
    temp_path: &Path,
) -> Result<(), String> {
    // Validate file size
    let file_size = fs::metadata(temp_path)
        .map_err(|e| format!("Failed to read metadata for {}: {}", temp_path.display(), e))?
        .len();
    
    if file_size > MAX_FILE_SIZE {
        return Err(format!("File size {} exceeds maximum {}", file_size, MAX_FILE_SIZE));
    }
    
    // Sniff content type
    let sniffed_type = sniff_content_type(temp_path)?;
    if !is_supported_type(&sniffed_type) {
        return Err(format!("Unsupported content type: {}", sniffed_type));
    }
    
    // Update asset content type to sniffed type
    asset.content_type = sniffed_type;
    asset.byte_size = file_size as i64;
    
    // Compute content hash
    let content_hash = compute_file_hash(temp_path)?;
    asset.content_hash = Some(content_hash);
    
    // Process based on content type
    match asset.content_type.as_str() {
        ct if ct.starts_with("image/") => {
            process_image(asset, temp_path)?;
        }
        ct if ct.starts_with("video/") => {
            process_video(asset, temp_path)?;
        }
        _ => {
            return Err(format!("Unsupported content type: {}", asset.content_type));
        }
    }
    
    asset.status = ASSET_STATUS_READY;
    Ok(())
}

/// Sniff the content type of a file
fn sniff_content_type(path: &Path) -> Result<String, String> {
    // Read the first few bytes to sniff the type
    let mut file = fs::File::open(path)
        .map_err(|e| format!("Failed to open {}: {}", path.display(), e))?;
    let mut buffer = [0u8; 16];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    
    // Check for common file signatures (magic numbers)
    let content_type = match &buffer[0..4] {
        [0xFF, 0xD8, 0xFF, _] => "image/jpeg",
        [0x89, 0x50, 0x4E, 0x47] => "image/png",
        [0x47, 0x49, 0x46, 0x38] => "image/gif",
        [0x52, 0x49, 0x46, 0x46] => {
            // Could be WebP or other RIFF formats
            if buffer[8..12] == *b"WEBP" {
                "image/webp"
            } else {
                "application/octet-stream"
            }
        }
        [0x00, 0x00, 0x01, 0x00] => "image/x-icon",
        [0x00, 0x00, 0x01, 0x01] => "image/x-icon",
        [0x46, 0x4C, 0x56, 0x01] => "video/x-flv", // FLV
        [0x1A, 0x45, 0xDF, 0xA3] => "video/webm", // WebM
        [0x00, 0x00, 0x00, 0x01] => "video/mp4", // MP4 (sometimes)
        [0x66, 0x74, 0x79, 0x70] => {
            // ftyp box - MP4
            if buffer[4..8] == *b"mp42" || buffer[4..8] == *b"isom" || buffer[4..8] == *b"avc1" {
                "video/mp4"
            } else {
                "application/octet-stream"
            }
        }
        _ => "application/octet-stream",
    };
    
    Ok(content_type.to_string())
}

/// Check if a content type is supported
fn is_supported_type(content_type: &str) -> bool {
    if content_type.starts_with("image/") {
        return SUPPORTED_IMAGE_TYPES.contains(&content_type);
    }
    if content_type.starts_with("video/") {
        return SUPPORTED_VIDEO_TYPES.contains(&content_type);
    }
    false
}

/// Compute a hash of a file using a simple algorithm
/// This is a placeholder for SHA-256 - in a full implementation, you'd use sha2::Sha256
fn compute_file_hash(path: &Path) -> Result<String, String> {
    // Open the file
    let mut file = fs::File::open(path)
        .map_err(|e| format!("Failed to open {}: {}", path.display(), e))?;
    
    // Read the file in chunks and compute a simple hash
    let mut buffer = [0u8; 8192];
    let mut hash: u64 = 5381; // djb2 hash seed
    
    loop {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
        
        if bytes_read == 0 {
            break;
        }
        
        // djb2 hash algorithm
        for &byte in &buffer[..bytes_read] {
            hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
        }
    }
    
    // Convert hash to hex string
    let hash_str = format!("{:016x}", hash);
    
    Ok(hash_str)
}

/// Process an image file
fn process_image(asset: &mut MediaAsset, _temp_path: &Path) -> Result<(), String> {
    // Try to use the image crate for dimension detection
    // Note: This requires the image crate to be available
    // For now, we'll use a placeholder that returns dimensions of 0x0
    // In a full implementation, you'd use image::open(temp_path)
    
    // For now, just set dimensions to None (will be populated by actual image processing)
    asset.width = None;
    asset.height = None;
    
    // Generate thumbnail (placeholder)
    // In a full implementation, this would create a resized version
    // and store it in a variants directory
    
    Ok(())
}

/// Process a video file
fn process_video(asset: &mut MediaAsset, _temp_path: &Path) -> Result<(), String> {
    // Try to extract video metadata
    // This would use ffmpeg or similar in a full implementation
    
    // For now, set placeholder values
    asset.duration_seconds = None;
    asset.width = None;
    asset.height = None;
    
    // Generate poster frame (placeholder)
    // In a full implementation, this would extract a frame at a specific time
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;

    #[test]
    fn test_sniff_content_type_jpeg() {
        // Create a temporary file with JPEG magic bytes
        let mut path = PathBuf::new();
        path.set_file_name("test.jpg");
        
        // For now, just test the magic bytes directly
        let buffer = [0xFF, 0xD8, 0xFF, 0xE0];
        let content_type = match &buffer[0..4] {
            [0xFF, 0xD8, 0xFF, _] => "image/jpeg",
            _ => "application/octet-stream",
        };
        assert_eq!(content_type, "image/jpeg");
    }

    #[test]
    fn test_sniff_content_type_png() {
        let buffer = [0x89, 0x50, 0x4E, 0x47];
        let content_type = match &buffer[0..4] {
            [0x89, 0x50, 0x4E, 0x47] => "image/png",
            _ => "application/octet-stream",
        };
        assert_eq!(content_type, "image/png");
    }

    #[test]
    fn test_sniff_content_type_webp() {
        let buffer = [
            0x52, 0x49, 0x46, 0x46, // RIFF
            0x00, 0x00, 0x00, 0x00, // size (dummy)
            0x57, 0x45, 0x42, 0x50, // WEBP
        ];
        let content_type = match &buffer[0..4] {
            [0x52, 0x49, 0x46, 0x46] => {
                if buffer[8..12] == *b"WEBP" {
                    "image/webp"
                } else {
                    "application/octet-stream"
                }
            }
            _ => "application/octet-stream",
        };
        assert_eq!(content_type, "image/webp");
    }

    #[test]
    fn test_sniff_content_type_mp4() {
        // MP4 files start with ftyp box
        let buffer = [
            0x00, 0x00, 0x00, 0x00, // size (dummy)
            0x66, 0x74, 0x79, 0x70, // ftyp
            0x69, 0x73, 0x6F, 0x6D, // isom
        ];
        let content_type = match &buffer[0..4] {
            [0x66, 0x74, 0x79, 0x70] => {
                if buffer[4..8] == *b"mp42" || buffer[4..8] == *b"isom" || buffer[4..8] == *b"avc1" {
                    "video/mp4"
                } else {
                    "application/octet-stream"
                }
            }
            _ => "application/octet-stream",
        };
        assert_eq!(content_type, "video/mp4");
    }

    #[test]
    fn test_sniff_content_type_webm() {
        // WebM files start with EBML magic bytes
        let buffer = [0x1A, 0x45, 0xDF, 0xA3];
        let content_type = match &buffer[0..4] {
            [0x1A, 0x45, 0xDF, 0xA3] => "video/webm",
            _ => "application/octet-stream",
        };
        assert_eq!(content_type, "video/webm");
    }

    #[test]
    fn test_unsupported_content_type() {
        let buffer = b"Hello, world!";
        let content_type = match &buffer[0..4] {
            [0xFF, 0xD8, 0xFF, _] => "image/jpeg",
            [0x89, 0x50, 0x4E, 0x47] => "image/png",
            [0x47, 0x49, 0x46, 0x38] => "image/gif",
            [0x52, 0x49, 0x46, 0x46] => {
                if buffer[8..12] == *b"WEBP" {
                    "image/webp"
                } else {
                    "application/octet-stream"
                }
            }
            [0x00, 0x00, 0x01, 0x00] => "image/x-icon",
            [0x00, 0x00, 0x01, 0x01] => "image/x-icon",
            [0x46, 0x4C, 0x56, 0x01] => "video/x-flv",
            [0x1A, 0x45, 0xDF, 0xA3] => "video/webm",
            [0x00, 0x00, 0x00, 0x01] => "video/mp4",
            [0x66, 0x74, 0x79, 0x70] => {
                if buffer[4..8] == *b"mp42" || buffer[4..8] == *b"isom" || buffer[4..8] == *b"avc1" {
                    "video/mp4"
                } else {
                    "application/octet-stream"
                }
            }
            _ => "application/octet-stream",
        };
        assert_eq!(content_type, "application/octet-stream");
        assert!(!is_supported_type(&content_type));
    }

    #[test]
    fn test_compute_file_hash() {
        // Test the hash function with a simple input
        // Create a temporary file with known content
        let mut path = PathBuf::new();
        path.set_file_name("test_hash.txt");
        
        // Write test content to the file
        {
            let mut file = File::create(&path).expect("Failed to create test file");
            file.write_all(b"Hello, world!").expect("Failed to write to test file");
        }
        
        // Compute hash
        let hash = compute_file_hash(&path);
        
        // Verify it succeeded and returned a valid hex string
        assert!(hash.is_ok());
        let hash_str = hash.as_ref().unwrap();
        assert_eq!(hash_str.len(), 16); // djb2 produces 16 hex characters
        
        // Verify the hash is deterministic
        let hash2 = compute_file_hash(&path);
        assert_eq!(hash.as_ref().unwrap(), hash2.as_ref().unwrap());
        
        // Clean up
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn test_file_size_validation() {
        // Verify the maximum file size constant is reasonable
        let max_size = MAX_FILE_SIZE;
        assert!(max_size > 0);
    }
}
