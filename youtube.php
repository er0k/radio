<?php

$req = json_decode(file_get_contents('php://input'), true);

$url = isset($req['url']) ? $req['url'] : '';
$shouldGetStream = isset($req['dl']) ? true : false;
$shouldGetInfo = isset($req['info']) ? true : false;

if (empty($url) || strstr($url,'youtube.com') === false) {
    die('not a youtube url');
}

$output = array();

$id = getVideoIDFromUrl($url);
$output['id'] = $id;

if ($shouldGetStream) {
    $output['stream'] = getStream($id);
}

if ($shouldGetInfo) {
    $output['info'] = getInfo($id);
}

$json = json_encode($output);

echo json_encode($output);

$filename = '/tmp/' . md5($output['stream']) . '.json';
file_put_contents($filename, $json);


function getVideoIDFromUrl($url)
{
    $query = array();
    $urlParts = parse_url($url);
    parse_str($urlParts['query'], $query);

    if (!isset($query['v'])) {
        return false;
    }

    return $query['v'];
}

function getStream($id)
{
    $stream = shell_exec("youtube-dl --prefer-insecure -g -f140 {$id}");

    return trim($stream);
}

function getInfo($id)
{
    $keys = json_decode(file_get_contents('/home/er0k/.www/keys.json'));
    $apiKey = $keys->youtube;

    $snippetUrl = sprintf('https://www.googleapis.com/youtube/v3/videos?id=%s&part=snippet&key=%s',
        $id,
        $apiKey
    );

    $contentDetailsUrl = sprintf('https://www.googleapis.com/youtube/v3/videos?id=%s&part=contentDetails&key=%s',
        $id,
        $apiKey
    );

    $snippet = json_decode(file_get_contents($snippetUrl), true);
    $contentDetails = json_decode(file_get_contents($contentDetailsUrl), true);

    $title = $snippet['items'][0]['snippet']['title'];
    $duration = $contentDetails['items'][0]['contentDetails']['duration'];

    $interval = new DateInterval($duration);
    $seconds = ($interval->format('%h') * 60 * 60) + ($interval->format('%i') * 60) + $interval->format('%s');

    $info = array(
        'title' => $title,
        'length' => $seconds,
    );

    return $info;
}
