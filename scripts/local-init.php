<?php
declare(strict_types=1);
$dir=dirname(__DIR__).'/.local';
if (!is_dir($dir)) mkdir($dir,0700,true);
if (is_file($dir.'/config.php')) { echo "Local configuration already exists.\n"; exit; }
$c=require dirname(__DIR__).'/server/config.example.php';
$password=bin2hex(random_bytes(12));
$c['app_url']='http://127.0.0.1:8080';
$c['db_dsn']='mysql:host=db;dbname=musicians;charset=utf8mb4';
$c['db_user']='musicians'; $c['db_password']='local-development-only';
$c['admin_password_hash']=password_hash($password,PASSWORD_DEFAULT);
file_put_contents($dir.'/config.php',"<?php\nreturn ".var_export($c,true).";\n");
file_put_contents($dir.'/admin-password.txt',$password."\n");
echo "Local configuration ready. Admin password: .local/admin-password.txt\n";
