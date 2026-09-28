<?php
declare(strict_types=1);

final class RequestError extends RuntimeException {
    public function __construct(public readonly string $reason, public readonly int $status = 400) {
        parent::__construct($reason);
    }
}

function config(): array {
    static $config;
    if ($config !== null) return $config;
    $path = getenv('MUSICIANS_CONFIG') ?: __DIR__ . '/config.php';
    if (!is_file($path)) throw new RequestError('service_not_configured', 503);
    $config = require $path;
    if (!is_array($config)) throw new RequestError('service_not_configured', 503);
    return $config;
}

function db(): PDO {
    static $db;
    if ($db) return $db;
    $c = config();
    $db = new PDO($c['db_dsn'], $c['db_user'], $c['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 2,
    ]);
    $db->exec("SET time_zone = '+00:00', SESSION innodb_lock_wait_timeout = 2");
    return $db;
}

function query(string $sql, array $params = []): PDOStatement {
    $s = db()->prepare($sql);
    $s->execute($params);
    return $s;
}

function transaction(callable $work): mixed {
    db()->beginTransaction();
    try { $result = $work(); db()->commit(); return $result; }
    catch (Throwable $e) { if (db()->inTransaction()) db()->rollBack(); throw $e; }
}

function json(array $value): string {
    return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function uuid(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 15) | 64);
    $bytes[8] = chr((ord($bytes[8]) & 63) | 128);
    $s = bin2hex($bytes);
    return substr($s, 0, 8).'-'.substr($s, 8, 4).'-'.substr($s, 12, 4).'-'.substr($s, 16, 4).'-'.substr($s, 20);
}

function response(array $body, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json($body);
}

function request_body(): string {
    $body = file_get_contents('php://input', false, null, 0, 65537);
    if ($body === false || strlen($body) > 65536) throw new RequestError('payload_too_large', 413);
    return $body;
}

function decode_body(string $raw): array {
    try { $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new RequestError('invalid_json'); }
    if (!is_array($data) || array_is_list($data)) throw new RequestError('invalid_json');
    return $data;
}

function rate_limit(string $key, int $limit, int $seconds): void {
    $bucket = hash('sha256', $key);
    query('INSERT INTO rate_limits (bucket,hits,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=IF(expires_at<=UTC_TIMESTAMP(),1,hits+1), expires_at=IF(expires_at<=UTC_TIMESTAMP(),VALUES(expires_at),expires_at)', [$bucket, gmdate('Y-m-d H:i:s', time()+$seconds)]);
    if ((int)query('SELECT hits FROM rate_limits WHERE bucket=?', [$bucket])->fetchColumn() > $limit) {
        throw new RequestError('rate_limited', 429);
    }
    if (random_int(1, 100) === 1) query('DELETE FROM rate_limits WHERE expires_at<UTC_TIMESTAMP() LIMIT 1000');
}

function error_text(string $code): string {
    return match ($code) {
        'invalid_image' => '画像は5MB以下のJPEG・PNG・WebPを選んでください（最大1600万画素）。',
        'member_link_invalid' => 'リンクは期限切れ、使用済み、または無効です。Discordのボタンから新しいリンクを開いてください。',
        'member_session_expired', 'member_access_changed' => '編集の有効期限または登録状況が変わりました。Discordのボタンからもう一度開いてください。入力中の内容はこの画面に残っています。',
        'discord_unavailable' => 'Discordでメンバー情報を確認できませんでした。少し待ってから再度お試しください。',
        'wrong_guild', 'missing_role', 'missing_operator_role' => 'この操作を行う権限がありません。',
        'representative_missing' => '代表者登録がありません。運営者へ連絡してください。',
        'musician_locked' => 'レコードはロック中です。運営者へ連絡してください。',
        'version_conflict' => '登録情報が変更されました。編集を最初からやり直してください。',
        'session_invalid', 'session_expired', 'session_consumed' => '確認画面が期限切れ、処理済み、または無効です。編集をやり直してください。',
        'duplicate_interaction' => 'この操作はすでに処理されています。',
        'musician_not_found' => '対象レコードが見つかりません。',
        'rate_limited' => '操作が続いています。少し待ってから再度お試しください。',
        'invalid_password', 'unauthorized' => '認証できませんでした。',
        'slug_conflict' => 'そのslugまたは代表者はすでに登録されています。',
        'invalid_input', 'unknown_field', 'invalid_url', 'payload_too_large' => '入力項目・文字数・URLの形式を確認してください。',
        'snapshot_not_restorable' => 'この監査ログの状態には復旧できません。',
        default => '処理できませんでした。時間をおいて再度お試しください。',
    };
}
