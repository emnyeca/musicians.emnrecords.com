<?php
/**
 * Plugin Name: EMN Musicians Assets
 * Description: Custom REST endpoint for EMN Records Musician Directory (musicians.emnrecords.com). Receives standing asset uploads (PNG/JPEG/WebP, up to 20MB) directly from the browser, stores them in the Media Library and writes metadata to Supabase. Uploads do NOT pass through Vercel.
 * Version: 0.1.0
 * Author: EMN Records
 *
 * Required wp-config.php constants (never commit real values):
 *   define('EMN_MUSICIANS_UPLOAD_PASSWORD_HASH', '<sha256 hex of the upload password>');
 *   define('EMN_MUSICIANS_SUPABASE_URL', 'https://xxxx.supabase.co');
 *   define('EMN_MUSICIANS_SUPABASE_SECRET_KEY', '<Supabase secret / service_role key>');
 *
 * Optional constants:
 *   define('EMN_MUSICIANS_ALLOWED_ORIGINS', 'https://musicians.emnrecords.com,http://localhost:3000');
 *   define('EMN_MUSICIANS_MAX_FILE_BYTES', 20971520);          // default 20MB
 *   define('EMN_MUSICIANS_MAX_ASSETS_PER_MUSICIAN', 5);        // default 5
 *
 * Endpoint:
 *   POST /wp-json/emn-musicians/v1/standing-assets/upload
 *
 * Security model:
 * - Auth is a shared operational upload password (posted as a form field and
 *   compared against its sha256 hash with hash_equals). It is shared in the
 *   members-only Discord and can be rotated by changing the constant.
 * - The Supabase secret key never leaves this server.
 * - Allowlist-only file validation: MIME + extension + magic number.
 * - If the Supabase metadata insert fails, the Media Library attachment is
 *   deleted so no orphan files remain.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('EMN_MUSICIANS_REST_NS', 'emn-musicians/v1');

function emn_musicians_max_file_bytes() {
    return defined('EMN_MUSICIANS_MAX_FILE_BYTES')
        ? (int) EMN_MUSICIANS_MAX_FILE_BYTES
        : 20 * 1024 * 1024;
}

function emn_musicians_max_assets_per_musician() {
    return defined('EMN_MUSICIANS_MAX_ASSETS_PER_MUSICIAN')
        ? (int) EMN_MUSICIANS_MAX_ASSETS_PER_MUSICIAN
        : 5;
}

function emn_musicians_allowed_origins() {
    if (defined('EMN_MUSICIANS_ALLOWED_ORIGINS') && EMN_MUSICIANS_ALLOWED_ORIGINS !== '') {
        return array_filter(array_map('trim', explode(',', EMN_MUSICIANS_ALLOWED_ORIGINS)));
    }
    return array('https://musicians.emnrecords.com', 'http://localhost:3000');
}

/**
 * CORS for this namespace only: allow the directory app origins, never "*".
 * Replaces WordPress's default reflect-any-origin behavior for these routes
 * (runs after rest_send_cors_headers). Also covers OPTIONS preflight, which
 * WordPress core serves through the same pipeline.
 */
add_filter('rest_pre_serve_request', 'emn_musicians_cors_headers', 15, 4);
function emn_musicians_cors_headers($served, $result, $request, $server) {
    $route = $request->get_route();
    if (strpos($route, '/' . EMN_MUSICIANS_REST_NS . '/') !== 0) {
        return $served;
    }
    header_remove('Access-Control-Allow-Origin');
    header_remove('Access-Control-Allow-Credentials');
    $origin = get_http_origin();
    if ($origin && in_array($origin, emn_musicians_allowed_origins(), true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
        header('Access-Control-Max-Age: 600');
        header('Vary: Origin', false);
    }
    return $served;
}

add_action('rest_api_init', 'emn_musicians_register_routes');
function emn_musicians_register_routes() {
    register_rest_route(EMN_MUSICIANS_REST_NS, '/standing-assets/upload', array(
        'methods'  => 'POST',
        'callback' => 'emn_musicians_handle_upload',
        // Auth is the shared upload password, verified inside the handler.
        'permission_callback' => '__return_true',
    ));
}

function emn_musicians_error($message, $status) {
    return new WP_REST_Response(array('ok' => false, 'error' => $message), $status);
}

/**
 * Media filters used around wp_handle_upload / attachment metadata so the
 * original file is kept as-is (no "-scaled" copy, no intermediate sizes).
 * Always pair emn_musicians_add_media_filters() with
 * emn_musicians_remove_media_filters() on every exit path.
 */
function emn_musicians_add_media_filters() {
    add_filter('big_image_size_threshold', '__return_false');
    add_filter('intermediate_image_sizes_advanced', '__return_empty_array');
}

function emn_musicians_remove_media_filters() {
    remove_filter('big_image_size_threshold', '__return_false');
    remove_filter('intermediate_image_sizes_advanced', '__return_empty_array');
}

function emn_musicians_handle_upload(WP_REST_Request $request) {
    if (!defined('EMN_MUSICIANS_UPLOAD_PASSWORD_HASH') || EMN_MUSICIANS_UPLOAD_PASSWORD_HASH === '') {
        return emn_musicians_error('Upload endpoint is not configured (EMN_MUSICIANS_UPLOAD_PASSWORD_HASH missing).', 503);
    }
    if (
        !defined('EMN_MUSICIANS_SUPABASE_URL') || EMN_MUSICIANS_SUPABASE_URL === '' ||
        !defined('EMN_MUSICIANS_SUPABASE_SECRET_KEY') || EMN_MUSICIANS_SUPABASE_SECRET_KEY === ''
    ) {
        return emn_musicians_error('Upload endpoint is not configured (Supabase constants missing).', 503);
    }

    // --- Rate limit on failed password attempts (10 / 10 minutes per IP). ---
    $client_ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
    $rate_key  = 'emn_mus_attempts_' . md5($client_ip);
    $attempts  = (int) get_transient($rate_key);
    if ($attempts >= 10) {
        return emn_musicians_error('Too many attempts. Try again later.', 429);
    }

    // --- Shared upload password (timing-safe compare against sha256 hash). ---
    $password = (string) $request->get_param('password');
    $expected = strtolower(trim((string) EMN_MUSICIANS_UPLOAD_PASSWORD_HASH));
    if ($password === '' || !hash_equals($expected, hash('sha256', $password))) {
        set_transient($rate_key, $attempts + 1, 10 * MINUTE_IN_SECONDS);
        return emn_musicians_error('Invalid upload password.', 401);
    }
    delete_transient($rate_key);

    // --- Required fields. ---
    if ((string) $request->get_param('consent') !== 'true') {
        return emn_musicians_error('Rights/permission consent is required.', 400);
    }
    $musician_id   = sanitize_text_field((string) $request->get_param('musician_id'));
    $musician_slug = sanitize_title((string) $request->get_param('musician_slug'));
    $title         = sanitize_text_field((string) $request->get_param('title'));
    if ($musician_id === '' || strlen($musician_id) > 64 || $title === '' || strlen($title) > 200) {
        return emn_musicians_error('musician_id and title are required (title max 200 chars).', 400);
    }
    $visibility = (string) $request->get_param('visibility');
    if ($visibility !== 'public') {
        $visibility = 'members_only';
    }

    // --- File presence / PHP-level upload errors. ---
    $files = $request->get_file_params();
    if (empty($files['file']) || !is_array($files['file'])) {
        return emn_musicians_error('No file was uploaded.', 400);
    }
    $file = $files['file'];
    if (isset($file['error']) && (int) $file['error'] !== UPLOAD_ERR_OK) {
        return emn_musicians_error(
            'File upload failed (PHP upload error ' . (int) $file['error'] . '). ' .
            'Check upload_max_filesize / post_max_size on the server.',
            400
        );
    }
    $tmp_path = isset($file['tmp_name']) ? (string) $file['tmp_name'] : '';
    if ($tmp_path === '' || !is_uploaded_file($tmp_path)) {
        return emn_musicians_error('Invalid upload.', 400);
    }
    $original_filename = sanitize_file_name((string) (isset($file['name']) ? $file['name'] : ''));

    // --- Size (allowlist bounds). ---
    $size = (int) filesize($tmp_path);
    if ($size <= 0) {
        return emn_musicians_error('File is empty.', 400);
    }
    if ($size > emn_musicians_max_file_bytes()) {
        return emn_musicians_error(
            'File is too large (max ' . round(emn_musicians_max_file_bytes() / (1024 * 1024)) . 'MB).',
            400
        );
    }

    // --- MIME + extension + magic number validation (allowlist only). ---
    $validated = emn_musicians_validate_image(
        $tmp_path,
        (string) (isset($file['type']) ? $file['type'] : ''),
        $original_filename
    );
    if (!$validated['ok']) {
        return emn_musicians_error($validated['reason'], 400);
    }

    // --- Per-musician asset limit (soft: skipped when the count fails). ---
    $count = emn_musicians_supabase_count_assets($musician_id);
    if ($count !== null && $count >= emn_musicians_max_assets_per_musician()) {
        return emn_musicians_error(
            'This musician already has the maximum number of assets (' .
            emn_musicians_max_assets_per_musician() . '). Deactivate old assets first.',
            400
        );
    }

    // --- Server-side filename: slug + timestamp + random suffix. ---
    $base = $musician_slug !== '' ? $musician_slug : 'asset';
    $stored_filename = strtolower(sprintf(
        '%s-%s-%s.%s',
        $base,
        gmdate('YmdHis'),
        wp_generate_password(6, false, false),
        $validated['extension']
    ));

    // --- Store into the Media Library. ---
    // Standing assets are downloaded as-is: keep the original file, skip the
    // "-scaled" copy and intermediate sizes (also saves memory/disk for 20MB
    // images on shared hosting). The filters are removed on every exit path.
    emn_musicians_add_media_filters();

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';

    $file['name'] = $stored_filename;
    $moved = wp_handle_upload($file, array(
        'test_form' => false,
        'mimes'     => array(
            'png'      => 'image/png',
            'jpg|jpeg' => 'image/jpeg',
            'webp'     => 'image/webp',
        ),
    ));
    if (!is_array($moved) || isset($moved['error'])) {
        emn_musicians_remove_media_filters();
        $detail = (is_array($moved) && isset($moved['error'])) ? $moved['error'] : 'unknown error';
        return emn_musicians_error('Could not store the file: ' . $detail, 500);
    }

    $attachment_id = wp_insert_attachment(
        array(
            'post_mime_type' => $moved['type'],
            'post_title'     => $title . ' (standing asset)',
            'post_content'   => '',
            'post_status'    => 'inherit',
        ),
        $moved['file']
    );
    if (is_wp_error($attachment_id) || !$attachment_id) {
        emn_musicians_remove_media_filters();
        @unlink($moved['file']);
        return emn_musicians_error('Could not register the attachment.', 500);
    }
    wp_update_attachment_metadata(
        $attachment_id,
        wp_generate_attachment_metadata($attachment_id, $moved['file'])
    );
    emn_musicians_remove_media_filters();

    $file_url = wp_get_attachment_url($attachment_id);
    if (!$file_url) {
        $file_url = $moved['url'];
    }

    // --- Supabase metadata insert (server-side only; secret never leaves). ---
    $record = array(
        'musician_id'            => $musician_id,
        'title'                  => $title,
        'description'            => emn_musicians_text_param($request, 'description'),
        'file_url'               => $file_url,
        'storage_backend'        => 'wordpress_media',
        'wp_media_id'            => (int) $attachment_id,
        'original_filename'      => $original_filename !== '' ? $original_filename : null,
        'stored_filename'        => $stored_filename,
        'mime_type'              => $validated['mime'],
        'file_size_bytes'        => $size,
        'visibility'             => $visibility,
        'access_note'            => emn_musicians_text_param($request, 'access_note'),
        'allow_credit_use'       => emn_musicians_bool_param($request, 'allow_credit_use', true),
        'allow_thumbnail_use'    => emn_musicians_bool_param($request, 'allow_thumbnail_use', true),
        'allow_cropping'         => emn_musicians_bool_param($request, 'allow_cropping', true),
        'allow_color_adjustment' => emn_musicians_bool_param($request, 'allow_color_adjustment', false),
        'require_credit'         => emn_musicians_bool_param($request, 'require_credit', false),
        'credit_text'            => emn_musicians_text_param($request, 'credit_text'),
        'usage_terms'            => emn_musicians_text_param($request, 'usage_terms'),
        'is_active'              => true,
    );

    $insert = emn_musicians_supabase_insert_asset($record);
    if (!$insert['ok']) {
        // No orphan files: remove the attachment when metadata cannot be saved.
        wp_delete_attachment($attachment_id, true);
        return emn_musicians_error(
            'Metadata save failed (' . $insert['error'] . '). The uploaded file has been removed. Please try again.',
            502
        );
    }

    return new WP_REST_Response(array(
        'ok'              => true,
        'asset_id'        => $insert['id'],
        'file_url'        => $file_url,
        'wp_media_id'     => (int) $attachment_id,
        'stored_filename' => $stored_filename,
    ), 200);
}

/**
 * Allowlist validation: claimed MIME, filename extension and the actual
 * file magic number must all agree on PNG / JPEG / WebP.
 * Everything else (SVG, HTML, ZIP, PDF, PSD, CLIP, unknown) is rejected.
 *
 * @return array{ok: bool, reason?: string, extension?: string, mime?: string}
 */
function emn_musicians_validate_image($tmp_path, $claimed_mime, $original_name) {
    $claimed_mime = strtolower(trim($claimed_mime));
    $allowed = array(
        'image/png'  => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
    );
    if (!isset($allowed[$claimed_mime])) {
        return array('ok' => false, 'reason' => 'File type not allowed. Only PNG / JPEG / WebP are accepted.');
    }

    $ext = strtolower((string) pathinfo($original_name, PATHINFO_EXTENSION));
    if (!in_array($ext, array('png', 'jpg', 'jpeg', 'webp'), true)) {
        return array('ok' => false, 'reason' => 'File extension not allowed. Only .png / .jpg / .jpeg / .webp are accepted.');
    }

    $fh = fopen($tmp_path, 'rb');
    if (!$fh) {
        return array('ok' => false, 'reason' => 'Could not read the uploaded file.');
    }
    $head = (string) fread($fh, 12);
    fclose($fh);

    $magic_mime = '';
    if (strncmp($head, "\x89PNG\r\n\x1a\n", 8) === 0) {
        $magic_mime = 'image/png';
    } elseif (strncmp($head, "\xFF\xD8\xFF", 3) === 0) {
        $magic_mime = 'image/jpeg';
    } elseif (strncmp($head, 'RIFF', 4) === 0 && substr($head, 8, 4) === 'WEBP') {
        $magic_mime = 'image/webp';
    }
    if ($magic_mime === '' || $magic_mime !== $claimed_mime) {
        return array('ok' => false, 'reason' => 'File content does not match an allowed image type (PNG / JPEG / WebP).');
    }

    // Extension must match the magic number as well.
    if ($magic_mime === 'image/jpeg') {
        if (!in_array($ext, array('jpg', 'jpeg'), true)) {
            return array('ok' => false, 'reason' => 'File extension does not match the file content.');
        }
    } elseif ($ext !== $allowed[$magic_mime]) {
        return array('ok' => false, 'reason' => 'File extension does not match the file content.');
    }

    return array('ok' => true, 'extension' => $allowed[$magic_mime], 'mime' => $magic_mime);
}

function emn_musicians_text_param(WP_REST_Request $request, $key) {
    $value = sanitize_textarea_field((string) $request->get_param($key));
    return $value === '' ? null : $value;
}

function emn_musicians_bool_param(WP_REST_Request $request, $key, $default) {
    $value = $request->get_param($key);
    if ($value === null || $value === '') {
        return (bool) $default;
    }
    return (string) $value === 'true';
}

function emn_musicians_supabase_headers() {
    return array(
        'apikey'        => EMN_MUSICIANS_SUPABASE_SECRET_KEY,
        'Authorization' => 'Bearer ' . EMN_MUSICIANS_SUPABASE_SECRET_KEY,
        'Content-Type'  => 'application/json',
    );
}

/**
 * Active asset count for a musician via Supabase REST.
 * Returns null when the count cannot be determined (soft limit).
 */
function emn_musicians_supabase_count_assets($musician_id) {
    $url = rtrim(EMN_MUSICIANS_SUPABASE_URL, '/')
        . '/rest/v1/standing_assets?select=id'
        . '&musician_id=eq.' . rawurlencode($musician_id)
        . '&is_active=eq.true';
    $response = wp_remote_get($url, array(
        'timeout' => 10,
        'headers' => array_merge(emn_musicians_supabase_headers(), array(
            'Prefer' => 'count=exact',
            'Range'  => '0-0',
        )),
    ));
    if (is_wp_error($response)) {
        return null;
    }
    $range = (string) wp_remote_retrieve_header($response, 'content-range');
    $slash = strpos($range, '/');
    if ($slash === false) {
        return null;
    }
    $total = substr($range, $slash + 1);
    return is_numeric($total) ? (int) $total : null;
}

/**
 * Inserts standing asset metadata into Supabase (service key, server-side).
 *
 * @return array{ok: bool, id?: string|null, error?: string}
 */
function emn_musicians_supabase_insert_asset(array $record) {
    $url = rtrim(EMN_MUSICIANS_SUPABASE_URL, '/') . '/rest/v1/standing_assets';
    $response = wp_remote_post($url, array(
        'timeout' => 15,
        'headers' => array_merge(emn_musicians_supabase_headers(), array(
            'Prefer' => 'return=representation',
        )),
        'body'    => wp_json_encode($record),
    ));
    if (is_wp_error($response)) {
        return array('ok' => false, 'error' => $response->get_error_message());
    }
    $code = (int) wp_remote_retrieve_response_code($response);
    if ($code !== 201) {
        // Details go to the server log only; the client gets the status code.
        error_log('[emn-musicians-assets] Supabase insert failed HTTP ' . $code . ': '
            . substr((string) wp_remote_retrieve_body($response), 0, 500));
        return array('ok' => false, 'error' => 'Supabase returned HTTP ' . $code);
    }
    $decoded = json_decode((string) wp_remote_retrieve_body($response), true);
    $id = (is_array($decoded) && isset($decoded[0]['id'])) ? (string) $decoded[0]['id'] : null;
    return array('ok' => true, 'id' => $id);
}
