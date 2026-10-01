<?php
declare(strict_types=1);
require_once __DIR__.'/roles.php';

const BASIC_FIELDS = ['display_name','name_jp','name_en','roles','primary_sns_url'];
const OPTIONAL_FIELDS = ['website_url','icon_image_url','vrc_name','aliases'];
const LINK_FIELDS = ['url','platform','label','display_order','delete'];

function directory_categories(mixed $value): array {
    if (!is_array($value) || !array_is_list($value) || count($value) < 1 || count($value) > 2) throw new RequestError('invalid_input');
    foreach ($value as $category) if (!in_array($category,['musician','creator/staff'],true)) throw new RequestError('invalid_input');
    return array_values(array_unique($value));
}

function text_value(mixed $value, int $max = 80, bool $required = false): string {
    if (!is_string($value)) throw new RequestError('invalid_input');
    $value = trim($value);
    if (($required && $value === '') || mb_strlen($value, 'UTF-8') > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $value)) throw new RequestError('invalid_input');
    return $value;
}

function url_value(mixed $value, bool $required = false): string {
    $value = text_value($value, 300, $required);
    if ($value === '') return '';
    if (!preg_match('~^[a-z][a-z0-9+.-]*:~i', $value)) $value = 'https://' . $value;
    $parts = parse_url($value);
    if (!$parts || !in_array(strtolower($parts['scheme'] ?? ''), ['http','https'], true)
        || !str_contains($parts['host'] ?? '', '.') || isset($parts['user']) || isset($parts['pass'])
        || preg_match('/[\s<>"\\\\]/u', $value) || strlen($value) > 1200) throw new RequestError('invalid_url');
    return $value;
}

function list_value(mixed $value, int $maxLength, bool $required = false, int $maxItems = 10): array {
    if (!is_array($value)) $value = preg_split('/[\n,、]/u', text_value($value, 800));
    if (!array_is_list($value) || count($value) > $maxItems) throw new RequestError('invalid_input');
    $items = array_values(array_unique(array_filter(array_map(fn($v) => text_value($v, $maxLength), $value), fn($v) => $v !== '')));
    if ($required && !$items) throw new RequestError('invalid_input');
    return $items;
}

function validate_fields(array $fields): array {
    if (array_diff(array_keys($fields), array_merge(BASIC_FIELDS, OPTIONAL_FIELDS))) throw new RequestError('unknown_field');
    foreach ($fields as $k => $v) {
        $fields[$k] = match ($k) {
            'roles' => list_value($v, 40, true,30),
            'aliases' => list_value($v, 80),
            'primary_sns_url','website_url','icon_image_url' => url_value($v),
            default => text_value($v, 80, in_array($k, ['display_name','name_en'], true)),
        };
    }
    return $fields;
}

function platform(string $url): string {
    $host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
    foreach (['x.com'=>'x','twitter.com'=>'x','youtube.com'=>'youtube','youtu.be'=>'youtube','twitch.tv'=>'twitch','instagram.com'=>'instagram','soundcloud.com'=>'soundcloud','booth.pm'=>'booth'] as $domain=>$name) {
        if ($host === $domain || str_ends_with($host, '.'.$domain)) return $name;
    }
    return 'website';
}

function validate_link(array $input): array {
    if (array_diff(array_keys($input), LINK_FIELDS)) throw new RequestError('unknown_field');
    $url = url_value($input['url'] ?? '', true);
    $delete = strtolower(text_value($input['delete'] ?? '', 10));
    if (!in_array($delete, ['', '削除','delete','yes'], true)) throw new RequestError('invalid_input');
    if ($delete !== '') return ['op'=>'delete','url'=>$url];
    $platform = strtolower(text_value($input['platform'] ?? '', 20)) ?: platform($url);
    if (!in_array($platform, ['x','youtube','twitch','instagram','soundcloud','booth','website','other'], true)) throw new RequestError('invalid_input');
    $order = text_value($input['display_order'] ?? '', 3);
    if ($order !== '' && !preg_match('/^\d{1,3}$/D', $order)) throw new RequestError('invalid_input');
    return ['op'=>'upsert','url'=>$url,'platform'=>$platform,'label'=>text_value($input['label'] ?? ''),'display_order'=>(int)$order];
}

function validate_payload(array $payload): array {
    if (array_diff(array_keys($payload), ['fields','link_ops']) || !is_array($payload['fields'] ?? null) || !is_array($payload['link_ops'] ?? null) || count($payload['link_ops']) > 10 || strlen(json($payload)) > 16000) throw new RequestError('invalid_input');
    $fields = validate_fields($payload['fields']);
    $ops = [];
    foreach ($payload['link_ops'] as $op) {
        if (!is_array($op) || array_diff(array_keys($op), ['op','url','platform','label','display_order']) || !in_array($op['op'] ?? '', ['upsert','delete'], true)) throw new RequestError('invalid_input');
        $ops[] = validate_link(['url'=>$op['url'] ?? '', 'delete'=>$op['op']==='delete'?'delete':'', 'platform'=>$op['platform'] ?? '', 'label'=>$op['label'] ?? '', 'display_order'=>(string)($op['display_order'] ?? 0)]);
    }
    return ['fields'=>$fields, 'link_ops'=>$ops];
}

function merged_profile(array $profile, array $payload): array {
    $payload = validate_payload($payload);
    $rolesChanged=isset($payload['fields']['roles']) && $payload['fields']['roles']!==($profile['roles'] ?? []);
    $profile = array_replace($profile, $payload['fields']);
    if ($rolesChanged) unset($profile['role_choices'],$profile['other_role']);
    $links = $profile['links'] ?? [];
    foreach ($payload['link_ops'] as $op) {
        $links = array_values(array_filter($links, fn($l) => $l['url'] !== $op['url']));
        if ($op['op'] === 'upsert') $links[] = ['id'=>uuid(),'url'=>$op['url'],'platform'=>$op['platform'],'label'=>$op['label'],'display_order'=>$op['display_order'],'is_public'=>true];
    }
    if (count($links) > 10) throw new RequestError('invalid_input');
    usort($links, fn($a,$b) => $a['display_order'] <=> $b['display_order']);
    $profile['links'] = $links;
    return $profile;
}

function musician(string $key, bool $lock = false): array {
    $row = query('SELECT * FROM musicians WHERE id=? OR slug=?' . ($lock ? ' FOR UPDATE' : ''), [$key,$key])->fetch();
    if (!$row) throw new RequestError('musician_not_found', 404);
    $row['profile'] = json_decode($row['profile'], true, 32, JSON_THROW_ON_ERROR);
    return $row;
}

function require_representative(string $id, string $user): void {
    if (!query('SELECT musician_id FROM musician_representatives WHERE musician_id=? AND discord_user_id=?', [$id,$user])->fetch()) throw new RequestError('representative_missing', 403);
}

function own_musician(string $user): array {
    $id = query('SELECT musician_id FROM musician_representatives WHERE discord_user_id=?', [$user])->fetchColumn();
    if (!$id) throw new RequestError('representative_missing', 403);
    return musician($id);
}

function snapshot(array $m): array {
    return ['slug'=>$m['slug'],'profile'=>$m['profile'],'visibility'=>$m['visibility'],'is_suspicious'=>(bool)$m['is_suspicious'],'version'=>(int)$m['version'],'is_locked'=>(bool)$m['is_locked']];
}

function audit(?string $id, ?string $actor, string $kind, string $action, ?array $before, ?array $after, ?string $interaction, string $result = 'succeeded', ?string $error = null): string {
    $logId = uuid();
    query('INSERT INTO musician_audit_logs (id,musician_id,actor_discord_user_id,actor_kind,action,before_snapshot,after_snapshot,interaction_id,result,error_code) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [$logId,$id,$actor,$kind,$action,$before===null?null:json($before),$after===null?null:json($after),$interaction,$result,$error]);
    return $logId;
}

function failure_audit(array $i, string $code): void {
    $operator=($i['data']['name'] ?? '')==='emn-admin' || str_starts_with((string)($i['data']['custom_id'] ?? ''),'audit:');
    try { audit(null,$i['member']['user']['id'] ?? null,$operator?'operator':'self','profile_update_failed',null,null,$i['id'] ?? null,'rejected',$code); }
    catch (Throwable) { error_log('musicians: failure audit unavailable or duplicate'); }
}

function ensure_new_interaction(string $id): void {
    if (query('SELECT id FROM musician_audit_logs WHERE interaction_id=?', [$id])->fetch()) throw new RequestError('duplicate_interaction');
}

function public_musician(array $m): array {
    $p = is_string($m['profile']) ? json_decode($m['profile'], true, 32, JSON_THROW_ON_ERROR) : $m['profile'];
    $result = ['id'=>$m['id'],'slug'=>$m['slug'],'visibility'=>'public','iconStoragePath'=>null,'iconImageSource'=>empty($p['icon_image_url'])?'none':'external_url'];
    foreach (['display_name'=>'displayName','name_jp'=>'nameJp','name_en'=>'nameEn','canonical_name'=>'canonicalName','sort_name'=>'sortName','primary_sns_url'=>'primarySnsUrl','website_url'=>'websiteUrl','icon_image_url'=>'iconImageUrl','vrc_name'=>'vrcName','discord_name'=>'discordName'] as $key=>$name) $result[$name] = $p[$key] ?? null;
    $result['roles'] = $p['roles'] ?? [];
    $result['roleChoices']=$p['role_choices'] ?? null;
    $result['otherRole']=$p['other_role'] ?? '';
    $result['roleTags']=$p['role_choices'] ?? role_tags($result['roles']);
    $result['directoryCategories'] = $p['directory_categories'] ?? ['musician'];
    $result['aliases'] = $p['aliases'] ?? [];
    $result['links'] = array_map(fn($l) => ['id'=>$l['id'],'musicianId'=>$m['id'],'platform'=>$l['platform'],'label'=>$l['label'] ?: null,'url'=>$l['url'],'displayOrder'=>$l['display_order'],'isPublic'=>true], array_values(array_filter($p['links'] ?? [], fn($l) => ($l['is_public'] ?? false) === true)));
    return $result;
}

function admin_musician(array $m): array {
    $public=public_musician($m);
    $public['visibility']=$m['visibility'];
    $public['version']=(int)$m['version'];
    $public['isLocked']=(bool)$m['is_locked'];
    $public['isSuspicious']=(bool)$m['is_suspicious'];
    $public['lockedReason']=$m['locked_reason'];
    $public['representativeDiscordUserId']=query('SELECT discord_user_id FROM musician_representatives WHERE musician_id=?',[$m['id']])->fetchColumn() ?: null;
    return $public;
}
