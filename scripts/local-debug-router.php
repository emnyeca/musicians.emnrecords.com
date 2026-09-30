<?php
// Local debug preview only: php -S 0.0.0.0:8081 -t out scripts/local-debug-router.php
// Never packaged (scripts/package.mjs lists its files explicitly). Uses the real PHP API,
// sessions and a disposable local MySQL; only Discord member lookups are stubbed, so the
// member editor can be opened as any profile from /__debug/ without Discord.
declare(strict_types=1);
putenv('MUSICIANS_CONFIG='.__DIR__.'/local-debug-config.php');
require_once __DIR__.'/../server/bootstrap.php';
if (!preg_match('~^http://127\.0\.0\.1:\d+$~D',rtrim(config()['app_url'],'/'))) { http_response_code(503); exit('Local debug requires a loopback app_url.'); }

// Every debug member is a current guild member with the member role.
function local_debug_discord_get(string $path): array {
    if (!preg_match('~/members/(\d{17,20})$~D',$path,$match)) throw new RequestError('discord_unavailable',503);
    return ['user'=>['id'=>$match[1]],'roles'=>[config()['discord_member_role_id']]];
}

$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH) ?: '/');
if (!str_starts_with($path,'/__debug')) return require __DIR__.'/router.php';

foreach (['profile','store','discord','member'] as $file) require_once __DIR__.'/../server/'.$file.'.php';
$escape=fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');
if (rtrim($path,'/')==='/__debug/login') {
    // Assign a local fake Discord user and issue a real one-time member link.
    $slug=(string)($_GET['slug'] ?? '');
    $user=$slug==='' ? '89'.str_pad((string)random_int(0,10**16-1),16,'0',STR_PAD_LEFT) : null;
    if ($slug!=='') {
        $m=musician($slug);
        $user=query('SELECT discord_user_id FROM musician_representatives WHERE musician_id=?',[$m['id']])->fetchColumn()
            ?: '88'.substr(str_pad((string)hexdec(substr(hash('sha256',$m['id']),0,13)),16,'0',STR_PAD_LEFT),0,16);
        query('INSERT IGNORE INTO musician_representatives (musician_id,discord_user_id) VALUES (?,?)',[$m['id'],$user]);
    }
    $link=issue_member_link(['id'=>(string)random_int(10**17,10**18-1)],['user'=>$user]);
    header('Location: '.$link['data']['components'][0]['components'][0]['url'],true,302); return true;
}
$rows=query("SELECT id,slug,visibility,is_locked,is_suspicious,JSON_UNQUOTE(JSON_EXTRACT(profile,'$.display_name')) name FROM musicians ORDER BY visibility,slug")->fetchAll();
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local debug</title>';
echo '<body style="font:14px system-ui;max-width:48rem;margin:2rem auto;padding:0 1rem">';
echo '<h1>ローカルデバッグ</h1><p>このPCだけで動く確認用環境です。本番のDB・Discordには接続しません。データは起動時に本番の公開情報からコピーしたもので、ここでの変更は本番に反映されません。</p>';
echo '<p><a href="/">サイトを開く</a> ・ <a href="/admin/">管理画面</a>（パスワード: local-debug） ・ <a href="/__debug/login">未登録メンバーとして本人編集を開く</a></p>';
echo '<h2>本人編集をこの人として開く</h2><ul>';
foreach ($rows as $r) echo '<li><a href="/__debug/login?slug='.$escape(rawurlencode($r['slug'])).'">'.$escape($r['name']).'</a> <small>'.$escape($r['slug']).' · '.$escape($r['visibility']).($r['is_locked']?' · locked':'').($r['is_suspicious']?' · suspicious':'').'</small></li>';
echo '</ul><p><small>本人編集の有効期限は本番と同じ30分です。期限切れの確認にはリンクを開き直すか、DBの期限を短くしてください。</small></p></body>';
return true;
