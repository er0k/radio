<?php

require_once('MPD.php');

class mpde extends MPD 
{

    const MUSIC_DIR = '/Music/';

    private $db;

    public function addRandomSong($num = 1)
    {
        for (; $num > 0; $num--) {
            $this->add($this->getRandomSong());
        }

        return true;
    }

    public function crop()
    {
        $status = $this->status();

        $pos = $status['song'];
        $length = $status['playlistlength'];

        if ($length > 0) {
            for ($length--; $length >= 0; $length--) {
                if ($length != $this->getPosition()) {
                    $this->delete($length);
                }
            }
        }

        return true;
    }

    public function log($msg, $type = 'nope')
    {
        return error_log($msg . "\n", 3, sprintf('/etc/mpdj/%s', $type));
    }

    private function getPosition()
    {
        $status = $this->status();

        return $status['song'];
    }

    private function getRandomSong()
    {
        $db = $this->getDb();

        $randomSong = $db[array_rand($db)];
        while (!$this->isFile($randomSong) && !$this->isGood($randomSong)) {
            $randomSong = $db[array_rand($db)];
        }

        return $randomSong;
    }

    private function isGood($song)
    {
        $badSongs = file('/etc/mpdj/bad');
        foreach ($badSongs as $badSong) {
            if (strpos($badSong, $song) !== false) {
                return false;
            }
        }

        $nopeSongs = file('/etc/mpdj/nope');
        foreach ($nopeSongs as $nope) {
            if (strpos($nopeSong, $song) !== false) {
                return false;
            }
        }

        return true;
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
