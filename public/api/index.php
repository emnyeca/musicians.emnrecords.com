<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
try {
    $runtime=getenv('MUSICIANS_SERVER_DIR') ?: dirname(__DIR__,3).'/musicians-private';
    if (!is_file($runtime.'/bootstrap.php')) {
        http_response_code(503);
        header('Content-Type: application/json');
        echo '{"ok":false,"error":"Service is not configured."}';
        exit;
    }
    foreach (['bootstrap','profile','store','discord','member','http'] as $file) require_once $runtime.'/'.$file.'.php';
    http_router(dirname(__DIR__));
} catch (Throwable $e) {
    $code=$e instanceof RequestError?$e->reason:'db_error';
    $status=$e instanceof RequestError?$e->status:503;
    if ($e instanceof PDOException && ($e->errorInfo[1] ?? 0)===1062) { $code='slug_conflict'; $status=409; }
    // No database DSN, passwords, tokens, request bodies or stack traces in responses/logs.
    error_log('musicians: '.$code);
    response(['ok'=>false,'error'=>error_text($code)],$status);
}
