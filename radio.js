var radio = angular.module('radio', ['ngAnimate','ui.bootstrap']);

radio.factory('mpd', function($http) {
    return {
        alerts: [],
        sendCommand: function (cmd, args) {
            args = args || [];
            var params = { cmd: cmd };
            for (var i = 0; i < args.length; i++) {
                var key = 'a' + i;
                params[key] = args[i];
            }
            alerts = this.alerts;
            return $http.post('m.php', params).then(function(response) {
                // console.log(cmd, args, response.data);
                // don't alert on these commands since they happen a lot
                var nope = ['playlistinfo','listplaylists','lsinfo','search'];
                if (!nope.includes(cmd)) {
                    if (typeof response.data.error === 'undefined') {
                        if (response.data == true) {
                            var type = 'success';
                            var msg = 'OK';
                        } else {
                            var type = 'warning';
                            var msg = response.data;
                        }
                        var alert = { type: type, msg: cmd + ': ' + msg, time: 3000 };
                    } else {
                        var alert = { type: 'danger', msg: response.data.error, time: 10000 };
                    }
                    this.alerts.push(alert);
                }

                return response.data;
            });
        }
    }
});


radio.controller('dj', function ($scope, $http, $interval, mpd) {

    var statusTimeout = 3000;
    var progressTimeout = 1000;
    var songId = 0;
    var statusFile = '/radio/mpd-status.json';
    var songFile = '/radio/mpd-song.json';
    var lastSongId;
    var songLength = 0;
    var songTime = 0;
    var i = 0;
    var elapsedGuess = 0;
    var elapsedReal = 0;
    var elapsed = 0;

    $scope.count = 1;
    $scope.activeTab = 0;
    $scope.stream = {};
    $scope.alerts = mpd.alerts;
    $scope.searchFor = {};
    $scope.resultsCount = 0;
    $scope.save = {};

    $scope.getStatus = function() {
        $http.get(statusFile).success(function(data) {
            $scope.status = data;
            lastSongId = songId;
            songId = $scope.status.songid;
            elapsedReal = $scope.status.elapsed;

            $scope.xfadeStatus = $scope.status.xfade != null ? 1 : 0;

            if ($scope.status.songid != lastSongId) {
                $scope.getCurrentSong();
                $scope.getPlaylist();
            }
        });
        i++;
    };

    $scope.browse = function (path) {
        path = path || '';
        $scope.addAlert('warning', 'loading...', 30000);
        $scope.activeTab = 2;
        $scope.path = path;
        $scope.pathParts = getPathParts(path);
        $scope.directories = [];
        $scope.files = [];
        mpd.sendCommand('lsinfo', [path]).then(function(data) {
            $scope.closeAlert(0);
            data.forEach(function(item) {
                if (item.directory != null) {
                    $scope.directories.push(prettifyFilepath(item.directory));
                }
                if (item.file != null) {
                    $scope.files.push(prettifyFilepath(item.file));
                }
            });
        });
    };

    $scope.browseSaved = function ()  {
        mpd.sendCommand('listplaylists').then(function(data) {
            $scope.lists = Object.keys(data);
        });
    };

    $scope.search = function(type, what) {
        type = type || 'Artist';
        what = what || '';
        $scope.addAlert('warning', 'loading...', 30000);
        $scope.activeTab = 3;
        $scope.results = {};
        $scope.searchFor = { type: type, what: what };
        mpd.sendCommand('search', [type, what]).then(function(data) {
            $scope.closeAlert(0);
            var searchResults = [];
            if (data.length > 0) {
                data.forEach(function(item) {
                    if (typeof item.file !== 'undefined') {
                        var searchPathParts = getPathParts(item.file);
                        var results = { path: item.file, parts: searchPathParts };
                        searchResults.push(results);
                    }
                });
            }
            $scope.resultsCount = data.length;
            $scope.results = searchResults;
        });
    };

    $scope.addStream = function(stream) {
        var found = stream.match(/https:\/\/(soundcloud.com\/.*)/);
        if (found != null) {
            var scStream = 'soundcloud://url/' + found[1];
            mpd.sendCommand('load', [scStream]);
        } else {
            $scope.add(stream);
        }
        $scope.stream = { url: '' };
        $scope.getPlaylist(1000);
    };

    $scope.savePlaylist = function(playlistName) {
        mpd.sendCommand('save', [playlistName]);
        $scope.save = {};
    };

    $scope.progress = function(event) {
        var totalWidth = angular.element(document.getElementById('progressbar')).prop('offsetWidth');
        var x = event.offsetX;
        var percentage = (x / totalWidth);
        var time = Math.round(percentage * $scope.song.Time);

        $scope.elapsed = time;
        elapsedReal = time;

        mpd.sendCommand('seekcur', [time]);
    };

    $scope.getProgress = function() {
        var total = 0;
        var percent = 0;
        if (elapsedReal > 0) {
            elapsedGuess = elapsedReal;
            elapsedReal = 0;
        } else {
            elapsedGuess = parseFloat(elapsed) + (progressTimeout / 1000);
        }
        elapsed = elapsedGuess;
        if ($scope.song != null) {
            total = parseInt($scope.song.Time);
            if (isNaN(total)) {
                total = elapsed;
            }
            percent = (elapsed / total) * 100;
        }

        $scope.hmElapsed = convertTime(elapsed);
        $scope.hmTotal = convertTime(total);

        $scope.elapsed = elapsed;
        $scope.total = total;
        $scope.percent = Math.round(percent);
    };

    $scope.addAlert = function(type, msg, time) {
        mpd.alerts.push({ type: type, msg: msg, time: time });
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    $scope.isCurrentSong = function(file) {
        if (file.Id == songId) {
            return true;
        }
        return false;
    };

    $scope.getCurrentSong = function () {
        $http.get(songFile).success(function(data) {
            $scope.song = data;
        });
    };

    $scope.getPlaylist = function(timeout) {
        timeout = timeout || 500;
        setTimeout(function() {
            mpd.sendCommand('playlistinfo').then(function(data) {
                $scope.playlist = data;
            });
        }, timeout);
    }

    $scope.skip = function() {
        mpd.sendCommand('next');
        $scope.getStatus();
    };

    $scope.shuffle = function() {
        mpd.sendCommand('shuffle');
        $scope.getPlaylist();
    };

    $scope.crop = function() {
        mpd.sendCommand('crop');
        $scope.getPlaylist();
        $scope.getPlaylist(3500);
    };

    $scope.addRandom = function(num) {
        mpd.sendCommand('addRandomSong', [num]);
        $scope.getPlaylist(2000);
    };

    $scope.add = function(item) {
        mpd.sendCommand('add', [item]);
        $scope.getPlaylist(1000);
    };

    $scope.load = function(list) {
        mpd.sendCommand('load', [list]);
        $scope.getPlaylist(1000);
    };

    $scope.xfade = function() {
        var xfade = $scope.xfadeStatus * 10;
        mpd.sendCommand('crossfade', [xfade]);
    };

    $scope.refresh = function() {
        $scope.count = 1;
        $scope.getStatus();
        $scope.getCurrentSong();
        $scope.getPlaylist();
        $scope.getProgress();
        $scope.results = {};
        $scope.path = '';
        $scope.pathParts = getPathParts('');
        $scope.directories = [];
        $scope.files = [];
        $scope.searchFor = {};
        $scope.resultsCount = 0;
        $scope.save = {};
    };

    $scope.moveUp = function(pos) {
        mpd.sendCommand('move', [pos, parseInt(pos) - 1]);
        $scope.getPlaylist();
    };

    $scope.moveDown = function(pos) {
        mpd.sendCommand('move', [pos, parseInt(pos) + 1]);
        $scope.getPlaylist();
    };

    $scope.play = function(pos) {
        mpd.sendCommand('play', [pos]);
        $scope.getStatus();
    };

    $scope.delete = function(pos) {
        mpd.sendCommand('delete', [pos]);
        $scope.getPlaylist();
        $scope.getPlaylist(3500);
    };

    function getPathParts(path) {
        var parts = [{name: 'Music', link: ''}];
        if (path != '') {
            var tmpParts = path.split('/');
            var link = '';
            tmpParts.forEach(function(part, i) {
                var newPart = {};
                newPart['name'] = part;
                if (i != 0) {
                    link += '/';
                }
                link += part;
                newPart['link'] = link;
                parts.push(newPart);
            });
        }

        return parts;
    }

    function convertTime(seconds) {
        if (isNaN(seconds)) {
            return '00:00';
        }
        var date = new Date(null);
        date.setSeconds(seconds);
        if (seconds > 3600) {
            return date.toISOString().substr(11, 8);
        } else {
            return date.toISOString().substr(14, 5);
        }
    }

    function prettifyFilepath(path) {
        var parts = path.split('/');
        var name = parts[parts.length - 1];

        return {path: path, name: name}
    }

    $scope.getStatus();
    $scope.getProgress();

    $interval($scope.getStatus, statusTimeout);
    $interval($scope.getProgress, progressTimeout);

});
