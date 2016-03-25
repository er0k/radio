<?php

$m = json_decode(file_get_contents('php://input'), true);

$cmd = isset($m['cmd']) ? $m['cmd'] : exit();
unset($m['cmd']);
ksort($m);
$args = array_values($m);

require_once('mpde.php');
$mpd = new mpde();

try {
    $result = call_user_func_array(array($mpd, $cmd), $args);
} catch (MPDException $e) {
    $result = array('error' => $e->getMessage());
}

header('Content-Type: application/json');
echo json_encode($result);

