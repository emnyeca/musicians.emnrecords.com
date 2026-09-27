<?php
declare(strict_types=1);
function icon_root(): string { return config()['icon_storage_dir'] ?? __DIR__.'/icon-storage'; }
function icon_url(string $key): string { return rtrim(config()['app_url'],'/').'/api/icons/'.$key; }
function store_icon_upload(string $user, array $file): string {
    if (!extension_loaded('gd')) throw new RequestError('service_not_configured',503);
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || ($file['size'] ?? 0)>5*1024*1024 || !is_uploaded_file($file['tmp_name'] ?? '')) throw new RequestError('invalid_image');
    $info=@getimagesize($file['tmp_name']);
    if (!$info || !in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true) || $info[0]<1 || $info[1]<1 || $info[0]>8192 || $info[1]>8192 || $info[0]*$info[1]>16000000) throw new RequestError('invalid_image');
    $source=@imagecreatefromstring(file_get_contents($file['tmp_name']));
    if (!$source) throw new RequestError('invalid_image');
    $side=min($info[0],$info[1]); $size=min(512,$side);
    $image=imagecreatetruecolor($size,$size); imagealphablending($image,false); imagesavealpha($image,true);
    imagecopyresampled($image,$source,0,0,(int)(($info[0]-$side)/2),(int)(($info[1]-$side)/2),$size,$size,$side,$side);
    $owner=hash('sha256',$user); $dir=icon_root().'/'.$owner;
    if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) throw new RequestError('service_unavailable',503);
    $key=$owner.'/'.bin2hex(random_bytes(16)).'.png';
    if (!imagepng($image,icon_root().'/'.$key,6)) throw new RequestError('service_unavailable',503);
    chmod(icon_root().'/'.$key,0600);
    return $key;
}
function serve_icon(string $key, ?string $user=null, bool $admin=false): void {
    if (!preg_match('~^[a-f0-9]{64}/[a-f0-9]{32}\.png$~D',$key)) throw new RequestError('not_found',404);
    $owner=explode('/',$key)[0];
    if (!$admin && ($user===null || !hash_equals(hash('sha256',$user),$owner))) {
        if (!query("SELECT id FROM musicians WHERE visibility='public' AND JSON_UNQUOTE(JSON_EXTRACT(profile,'$.icon_image_url'))=? LIMIT 1",[icon_url($key)])->fetchColumn()) throw new RequestError('not_found',404);
    }
    $path=icon_root().'/'.$key;
    if (!is_file($path)) throw new RequestError('not_found',404);
    header('Content-Type: image/png'); header('X-Content-Type-Options: nosniff'); header('Cache-Control: no-store');
    readfile($path);
}
