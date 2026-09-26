<?php
// Local preview only: php -S 127.0.0.1:8080 -t out scripts/router.php
declare(strict_types=1);
$root=dirname(__DIR__).'/out';
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH) ?: '/');
putenv('MUSICIANS_SERVER_DIR='.dirname(__DIR__).'/server');
if (!getenv('MUSICIANS_CONFIG')) putenv('MUSICIANS_CONFIG='.dirname(__DIR__).'/.local/config.php');
if (str_starts_with($path,'/api/') || preg_match('~^/musicians/[^/]+/?$~D',$path)) { require $root.'/api/index.php'; return true; }
$file=realpath($root.$path);
if ($file!==false && ($file===realpath($root) || str_starts_with($file,realpath($root).DIRECTORY_SEPARATOR)) && !str_contains($path,'/.')) {
    if (is_dir($file) && is_file($file.'/index.html')) { header('Content-Type: text/html; charset=utf-8'); readfile($file.'/index.html'); return true; }
    if (is_file($file) && pathinfo($file,PATHINFO_EXTENSION)!=='php') return false;
}
http_response_code(404); readfile($root.'/404.html');
