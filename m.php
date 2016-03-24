<?php

$cmd = isset($_REQUEST['c']) ? $_REQUEST['c'] : exit();
unset($_REQUEST['c']);
ksort($_REQUEST);
$args = array_values($_REQUEST);

require_once('mpde.php');
$mpd = new mpde();

try {
    $result = call_user_func_array(array($mpd, $cmd), $args);
} catch (MPDException $e) {
    $result = array('error' => $e->getMessage());
}

header('Content-Type: application/json');
echo json_encode($result);
