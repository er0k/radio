<?php

require_once('MPD.php');

class mpde extends MPD 
{
    public function addRandomSong()
    {
        try {
            $this->add($this->getRandomSong());
        } catch (MPDException $e) {
            return false;
        }

        return true;
    }

    private function getRandomSong()
    {
        $db = $this->listall();

        $randKey = array_rand($db);
        while (is_array($db[$randKey])) {
            $randKey = array_rand($db);
        }

        $randomSong = $db[$randKey];

        return $randomSong;
    }
}
