<?php
declare(strict_types=1);

const MEMBER_ENTRY_BUTTON = 'member:open';

function member_entry_message(): array {
    return ['content'=>'下のボタンから、名鑑プロフィールの確認・編集・新規登録ができます。',
        'allowed_mentions'=>['parse'=>[]],
        'components'=>[['type'=>1,'components'=>[['type'=>2,'style'=>1,'label'=>'自分のプロフィールを確認・編集','custom_id'=>MEMBER_ENTRY_BUTTON]]]]];
}

// Call only after signature validation and authorize(). The random ticket is never logged.
function issue_member_link(array $i, array $actor): array {
    $user=$actor['user'];
    rate_limit('member-link:'.$user,6,300);
    $token=bin2hex(random_bytes(32));
    $target=transaction(function() use ($user,$token,$i) {
        ensure_new_interaction($i['id']);
        $id=query('SELECT musician_id FROM musician_representatives WHERE discord_user_id=?',[$user])->fetchColumn() ?: null;
        query('INSERT INTO member_web_access (discord_user_id,token_hash,token_expires_at,musician_id) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE generation=generation+1,token_hash=VALUES(token_hash),token_expires_at=VALUES(token_expires_at),musician_id=VALUES(musician_id)',
            [$user,hash('sha256',$token),gmdate('Y-m-d H:i:s',time()+300),$id]);
        audit(null,$user,'self','member_link_issued',null,null,$i['id']);
        return $id;
    });
    $data=message_data($target?'自分のプロフィールを確認・編集できます。':'名鑑のプロフィールを作成できます。作成すると下書きとして保存され、あなたのDiscordアカウントに紐付きます。');
    $data['content'].="\nリンクは5分以内に開いてください。他の人へ共有しないでください。新しく発行すると以前のリンク・編集画面は無効になります。";
    $data['components']=[['type'=>1,'components'=>[['type'=>2,'style'=>5,'label'=>$target?'プロフィールを開く':'プロフィールを作成する','url'=>rtrim(config()['app_url'],'/').'/member/#token='.$token]]]];
    return ['type'=>4,'data'=>$data];
}

function member_session_start(): void {
    if (session_status()===PHP_SESSION_ACTIVE) return;
    session_name('emn_member');
    session_start(['use_strict_mode'=>1,'use_only_cookies'=>1,'cookie_httponly'=>1,
        'cookie_secure'=>str_starts_with(config()['app_url'],'https://'),'cookie_samesite'=>'Strict',
        'cookie_path'=>'/api/member','gc_maxlifetime'=>1800]);
}

function member_session_end(): void {
    $_SESSION=[];
    session_destroy();
    setcookie('emn_member','',['expires'=>time()-3600,'path'=>'/api/member','httponly'=>true,
        'secure'=>str_starts_with(config()['app_url'],'https://'),'samesite'=>'Strict']);
}

function require_current_member(string $user): void {
    $c=config();
    foreach (['discord_guild_id','discord_bot_token','discord_member_role_id','discord_operator_role_id'] as $key) if (empty($c[$key])) throw new RequestError('service_not_configured',503);
    try { $member=discord_get('/guilds/'.rawurlencode($c['discord_guild_id']).'/members/'.rawurlencode($user)); }
    catch (RequestError $e) { if ($e->reason==='discord_not_found') throw new RequestError('missing_role',403); throw $e; }
    $roles=$member['roles'] ?? [];
    if (($member['user']['id'] ?? '')!==$user || !is_array($roles) ||
        (!in_array($c['discord_member_role_id'],$roles,true) && !in_array($c['discord_operator_role_id'],$roles,true))) throw new RequestError('missing_role',403);
}

function consume_member_ticket(string $token): array {
    if (!preg_match('/^[a-f0-9]{64}$/D',$token)) throw new RequestError('member_link_invalid',401);
    $hash=hash('sha256',$token);
    // Network calls happen outside transactions; the ticket is rechecked under a lock.
    $candidate=query('SELECT discord_user_id FROM member_web_access WHERE token_hash=? AND token_expires_at>UTC_TIMESTAMP()',[$hash])->fetch();
    if (!$candidate) throw new RequestError('member_link_invalid',401);
    require_current_member($candidate['discord_user_id']);
    return redeem_member_ticket($hash);
}

function redeem_member_ticket(string $hash): array {
    return transaction(function() use ($hash) {
        $row=query('SELECT * FROM member_web_access WHERE token_hash=? AND token_expires_at>UTC_TIMESTAMP() FOR UPDATE',[$hash])->fetch();
        if (!$row) throw new RequestError('member_link_invalid',401);
        $target=query('SELECT musician_id FROM musician_representatives WHERE discord_user_id=?',[$row['discord_user_id']])->fetchColumn() ?: null;
        if ($target!==$row['musician_id']) throw new RequestError('member_access_changed',401);
        query('UPDATE member_web_access SET token_hash=NULL WHERE discord_user_id=?',[$row['discord_user_id']]);
        return ['user'=>$row['discord_user_id'],'generation'=>(int)$row['generation'],'musician_id'=>$target,
            'expires'=>time()+1800,'csrf'=>bin2hex(random_bytes(32))];
    });
}

function member_access(array $session, bool $lock=false): array {
    if (($session['expires'] ?? 0)<=time() || !is_string($session['user'] ?? null)) throw new RequestError('member_session_expired',401);
    $row=query('SELECT * FROM member_web_access WHERE discord_user_id=?'.($lock?' FOR UPDATE':''),[$session['user']])->fetch();
    if (!$row || (int)$row['generation']!==($session['generation'] ?? null)) throw new RequestError('member_access_changed',401);
    return $row;
}

function member_target(array $session, bool $lock=false): ?array {
    $id=$session['musician_id'] ?? null;
    // Existing records follow the same lock ordering as Discord/admin mutations.
    $m=$id ? musician($id,$lock) : null;
    $current=query('SELECT musician_id FROM musician_representatives WHERE discord_user_id=?'.($lock?' FOR UPDATE':''),[$session['user']])->fetchColumn() ?: null;
    if ($current!==$id) throw new RequestError('member_access_changed',401);
    return $m;
}

function member_projection(?array $m): ?array {
    if (!$m) return null;
    $result=public_musician($m);
    $result['visibility']=$m['visibility'];
    $result['version']=(int)$m['version'];
    $result['isLocked']=(bool)$m['is_locked'];
    return $result;
}

function member_profile_fields(array $input, bool $creating): array {
    $map=['displayName'=>'display_name','nameJp'=>'name_jp','nameEn'=>'name_en','roles'=>'roles',
        'primarySnsUrl'=>'primary_sns_url','websiteUrl'=>'website_url','iconImageUrl'=>'icon_image_url','vrcName'=>'vrc_name','aliases'=>'aliases'];
    $allowed=array_merge(array_keys($map),['version','links','directoryCategories'],$creating?['slug']:[]);
    if (array_diff(array_keys($input),$allowed)) throw new RequestError('unknown_field');
    $values=[];
    foreach ($map as $camel=>$snake) $values[$snake]=$input[$camel] ?? '';
    $profile=validate_fields($values);
    $profile['directory_categories']=directory_categories($input['directoryCategories'] ?? []);
    $links=$input['links'] ?? [];
    if (!is_array($links) || !array_is_list($links) || count($links)>10) throw new RequestError('invalid_input');
    $profile['links']=[]; $seen=[];
    foreach ($links as $index=>$link) {
        if (!is_array($link) || array_diff(array_keys($link),['url','label'])) throw new RequestError('unknown_field');
        $op=validate_link(['url'=>$link['url'] ?? '', 'label'=>$link['label'] ?? '', 'display_order'=>(string)$index]);
        if (isset($seen[$op['url']])) continue;
        $seen[$op['url']]=true;
        $profile['links'][]=['id'=>uuid(),'url'=>$op['url'],'label'=>$op['label'],'platform'=>$op['platform'],'display_order'=>$index,'is_public'=>true];
    }
    if (mb_strlen(profile_summary($profile),'UTF-8')>5600) throw new RequestError('payload_too_large');
    return $profile;
}

function save_member_profile(array $session, array $input, bool $confirm=false): array {
    return transaction(function() use ($session,$input,$confirm) {
        member_access($session,true); // Serializes registrations from this Discord user.
        $m=member_target($session,true);
        if ($m) {
            editable($m,$session['user']);
            if (!is_int($input['version'] ?? null) || $input['version']!==(int)$m['version']) throw new RequestError('version_conflict',409);
            $before=snapshot($m);
            if ($confirm) {
                if (array_diff(array_keys($input),['version'])) throw new RequestError('unknown_field');
            } else {
                $m['profile']=array_replace($m['profile'],member_profile_fields($input,false));
                $m['version']++;
                query('UPDATE musicians SET profile=?,version=? WHERE id=?',[json($m['profile']),$m['version'],$m['id']]);
                query('UPDATE profile_update_sessions SET consumed_at=COALESCE(consumed_at,UTC_TIMESTAMP()) WHERE musician_id=?',[$m['id']]);
            }
            audit($m['id'],$session['user'],'self',$confirm?'profile_confirmed':'profile_update',$before,snapshot($m),null);
            return $m;
        }
        if ($confirm || ($input['version'] ?? null)!==null) throw new RequestError('member_access_changed',409);
        $profile=member_profile_fields($input,true);
        $slug=text_value($input['slug'] ?? '',100);
        if ($slug==='') {
            $base=trim(preg_replace('/[^a-z0-9]+/','-',strtolower($profile['name_en'])),'-') ?: 'member';
            $slug=substr($base,0,80).'-'.bin2hex(random_bytes(3));
        }
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$slug)) throw new RequestError('invalid_input');
        $id=uuid();
        query("INSERT INTO musicians (id,slug,profile,visibility) VALUES (?,?,?,'draft')",[$id,$slug,json($profile)]);
        query('INSERT INTO musician_representatives (musician_id,discord_user_id) VALUES (?,?)',[$id,$session['user']]);
        query('UPDATE member_web_access SET musician_id=? WHERE discord_user_id=?',[$id,$session['user']]);
        $m=musician($id);
        $after=snapshot($m); $after['representative']=$session['user'];
        audit($id,$session['user'],'self','profile_created',null,$after,null);
        audit($id,$session['user'],'self','profile_confirmed',$after,$after,null);
        return $m;
    });
}

function member_http(string $path, string $method): void {
    header('Cache-Control: no-store'); header('Referrer-Policy: no-referrer');
    member_session_start();
    if ($path==='/api/member/session' && $method==='POST') {
        same_origin();
        rate_limit('member-exchange:'.($_SERVER['REMOTE_ADDR'] ?? ''),20,300);
        $body=decode_body(request_body());
        if (array_diff(array_keys($body),['token'])) throw new RequestError('unknown_field');
        $session=consume_member_ticket(text_value($body['token'] ?? '',64,true));
        session_regenerate_id(true); $_SESSION=$session;
        response(['ok'=>true]); return;
    }
    if ($path==='/api/member/session' && $method==='DELETE') {
        same_origin(); member_session_end(); response(['ok'=>true]); return;
    }
    if (!in_array($path,['/api/member/profile','/api/member/confirm'],true)) throw new RequestError('not_found',404);
    member_access($_SESSION);
    rate_limit('member-api:'.$_SESSION['user'],30,60);
    require_current_member($_SESSION['user']); // Never extend Discord authorization by trusting a stale role list.
    if ($path==='/api/member/profile' && $method==='GET') {
        response(['musician'=>member_projection(member_target($_SESSION)),'csrf'=>$_SESSION['csrf'],'expiresAt'=>$_SESSION['expires']]); return;
    }
    if ($method!=='POST') throw new RequestError('method_not_allowed',405);
    same_origin();
    if (!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) throw new RequestError('forbidden_origin',403);
    $confirm=$path==='/api/member/confirm';
    $m=save_member_profile($_SESSION,decode_body(request_body()),$confirm);
    $_SESSION['musician_id']=$m['id'];
    $user=$_SESSION['user']; session_write_close();
    notify_audit($confirm?'profile_confirmed':'profile_update',$m,$user);
    response(['ok'=>true,'musician'=>member_projection($m)]);
}
