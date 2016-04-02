<?php

$user = array(
    'user' => $_SERVER['PHP_AUTH_USER'],
    'pass' => $_SERVER['PHP_AUTH_PW']
);

header('Content-Type: application/json');
echo json_encode($user);
