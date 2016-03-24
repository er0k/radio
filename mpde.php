<?php

require_once('MPD.php');

class mpde extends MPD 
{

    const MUSIC_DIR = '/Music/';

    private $db;

    public function addRandomSong($num = 1)
    {
        for (; $num > 0; $num--) {
            try {
                $this->add($this->getRandomSong());
            } catch (MPDException $e) {
                return false;
            }
        }

        return true;
    }

    private function getRandomSong()
    {
        $db = $this->getDb();

        $randomSong = $db[array_rand($db)];
        while (!$this->isFile($randomSong)) {
            $randomSong = $db[array_rand($db)];
        }

        return $randomSong;
    }

    private function isFile(&$song)
    {
        if (is_file(self::MUSIC_DIR . $song)) {
            return true;
        }

        if (
            is_array($song)
            && isset($song['file'])
            && is_file(self::MUSIC_DIR . $song['file'])
        ) {
            $song = $song['file'];
            return true;
        }

        return false;
    }

    private function getDb()
    {
        if (!$this->db) {
            $this->db = $this->listall();
        }

        return $this->db;
    }
}
