<?php
declare(strict_types=1);

function same_origin(): void {
    $origin=$_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin!==rtrim(config()['app_url'],'/') || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '')==='cross-site') throw new RequestError('forbidden_origin',403);
}

function admin_session(): void {
    if (session_status()===PHP_SESSION_ACTIVE) return;
    $secure=str_starts_with(config()['app_url'],'https://');
    session_name('emn_admin');
    session_start(['use_strict_mode'=>1,'use_only_cookies'=>1,'cookie_httponly'=>1,'cookie_secure'=>$secure,'cookie_samesite'=>'Strict','cookie_path'=>'/api/','gc_maxlifetime'=>3600]);
}

function admin_authorized(): bool {
    admin_session();
    $hash=config()['admin_password_hash'] ?? '';
    return $hash!=='' && ($_SESSION['expires'] ?? 0)>time() && hash_equals(hash('sha256',$hash),$_SESSION['credential'] ?? '');
}

function admin_access(string $method): void {
    admin_session();
    if ($method==='GET') { response(['authorized'=>admin_authorized()]); return; }
    same_origin();
    if ($method==='DELETE') {
        $_SESSION=[];
        session_destroy();
        setcookie('emn_admin','',['expires'=>time()-3600,'path'=>'/api/','httponly'=>true,'secure'=>str_starts_with(config()['app_url'],'https://'),'samesite'=>'Strict']);
        response(['ok'=>true]); return;
    }
    if ($method!=='POST') throw new RequestError('method_not_allowed',405);
    $hash=config()['admin_password_hash'] ?? '';
    if (!$hash) throw new RequestError('service_not_configured',503);
    rate_limit('login:'.($_SERVER['REMOTE_ADDR'] ?? ''),10,900);
    $body=decode_body(request_body());
    $password=text_value($body['password'] ?? '',1024,true);
    if (!password_verify($password,$hash)) throw new RequestError('invalid_password',401);
    session_regenerate_id(true);
    $_SESSION=['expires'=>time()+3600,'credential'=>hash('sha256',$hash)];
    response(['ok'=>true]);
}

function serve_profile(string $slug, string $root): void {
    try {
        $m=musician($slug);
        if ($m['visibility']!=='public') throw new RequestError('musician_not_found',404);
    } catch (RequestError $e) {
        if ($e->status!==404) throw $e;
        http_response_code(404); header('Content-Type: text/html; charset=utf-8');
        readfile($root.'/404.html'); return;
    }
    $html=file_get_contents($root.'/profile/index.html');
    if ($html===false) throw new RequestError('service_unavailable',503);
    $escape=fn($v)=>htmlspecialchars($v,ENT_QUOTES | ENT_SUBSTITUTE,'UTF-8');
    $title=$m['profile']['display_name'].' | EMN Records Musicians';
    $description=$m['profile']['name_en'].' — '.implode(' / ',$m['profile']['roles']);
    $html=preg_replace_callback('~<title>.*?</title>~s',fn()=>'<title>'.$escape($title).'</title>',$html);
    $html=preg_replace('~<meta name="description" content="[^"]*"\s*/?>~','',$html);
    $url=rtrim(config()['app_url'],'/').'/musicians/'.$m['slug'];
    $tags='<meta name="description" content="'.$escape($description).'"/><link rel="canonical" href="'.$escape($url).'"/>';
    foreach (['og:title'=>$title,'og:description'=>$description,'og:url'=>$url,'og:type'=>'profile'] as $k=>$v) $tags.='<meta property="'.$k.'" content="'.$escape($v).'"/>';
    if (!empty($m['profile']['icon_image_url'])) $tags.='<meta property="og:image" content="'.$escape($m['profile']['icon_image_url']).'"/>';
    header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
    echo str_replace('</head>',$tags.'</head>',$html);
}

function http_router(string $root): void {
    $path=rtrim(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH) ?: '/','/');
    $method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($path==='/api/discord/interactions') { discord_endpoint(); return; }
    if ($path==='/api/admin-access') { admin_access($method); return; }
    if ($path==='/api/admin/musicians') {
        if (!admin_authorized()) throw new RequestError('unauthorized',401);
        if ($method==='GET') {
            $rows=query("SELECT * FROM musicians ORDER BY visibility,COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.sort_name')),''),JSON_UNQUOTE(JSON_EXTRACT(profile,'$.display_name'))),slug")->fetchAll();
            response(['musicians'=>array_map('admin_musician',$rows)]); return;
        }
        if ($method!=='POST') throw new RequestError('method_not_allowed',405);
        same_origin();
        $m=create_musician(decode_body(request_body()));
        $created=admin_musician($m); $created['url']='/musicians/'.$m['slug'];
        response(['ok'=>true,'musician'=>$created],201); return;
    }
    if (preg_match('~^/api/admin/musicians/([a-f0-9-]{36})$~D',$path,$match)) {
        if ($method!=='PATCH') throw new RequestError('method_not_allowed',405);
        same_origin();
        if (!admin_authorized()) throw new RequestError('unauthorized',401);
        $m=update_musician($match[1],decode_body(request_body()));
        response(['ok'=>true,'musician'=>admin_musician($m)]); return;
    }
    if ($path==='/api/musicians') {
        if ($method!=='GET') throw new RequestError('method_not_allowed',405);
        $slug=$_GET['slug'] ?? null;
        if ($slug!==null) {
            $slug=text_value($slug,100,true);
            $rows=query("SELECT * FROM musicians WHERE visibility='public' AND slug=?",[$slug])->fetchAll();
        } else $rows=query("SELECT * FROM musicians WHERE visibility='public' ORDER BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile,'$.sort_name')),''),JSON_UNQUOTE(JSON_EXTRACT(profile,'$.name_en'))),slug")->fetchAll();
        response(['musicians'=>array_map('public_musician',$rows)]); return;
    }
    if ($method==='GET' && preg_match('~^/musicians/([a-z0-9]+(?:-[a-z0-9]+)*)$~D',$path,$match)) { serve_profile($match[1],$root); return; }
    throw new RequestError('not_found',404);
}
