var radio = angular.module('radio', ['ngAnimate','ui.bootstrap','dndLists']);

radio.factory('mpd', function($http) {
    return {
        alerts: [],
        addAlert: function (type, msg, time) {
            type = type || 'info';
            msg = msg || 'o_O';
            time = time || 5000;
            var alert = { type: type, msg: msg, time: time };
            this.alerts.push(alert);
        },
        sendCommand: function (cmd, args) {
            args = args || [];
            var params = { cmd: cmd };
            for (var i = 0; i < args.length; i++) {
                var key = 'a' + i;
                params[key] = args[i];
            }
            var self = this;
            return $http.post('m.php', params).then(function(response) {
                // don't alert on these commands since they happen a lot
                var nope = ['status','idle','playlistinfo','listplaylists','lsinfo','search'];
                if (!nope.includes(cmd)) {
                    if (typeof response.data.error === 'undefined') {
                        if (response.data == true) {
                            self.addAlert('success', cmd + ': OK', 3000);
                        } else {
                            self.addAlert('warning', cmd + ': ' + response.data, 5000);
                        }
                    } else {
                        self.addAlert('danger', cmd + ': ' + response.data.error, 10000);
                    }
                }

                return response.data;
            });
        }
    }
});


radio.controller('dj', function ($scope, $window, $http, $interval, mpd) {

    var statusTimeout = 3000;
    var progressTimeout = 200;
    var songId = 0;
    var elapsed = 0;
    var timer;

    $scope.update = function(timeout) {
        timeout = timeout || 300;
        setTimeout(function() {
            $http.get('/radio/mpdj.json').success(function(data) {
                console.log(data)
                $scope.status = data.status;
                $scope.song = data.song;
                $scope.listeners = data.listeners;
                $scope.playlist = data.playlist;
                $scope.playlist.forEach(function(song, i) {
                    $scope.playlist[i]['pathParts'] = getPathParts(song.file);
                });
                updateTitle();
                $scope.xfadeStatus = $scope.status.xfade != null ? 1 : 0;
                $scope.total = parseInt($scope.song.time);
                $scope.startCountingAt($scope.status.elapsed);
                songId = $scope.status.songid;
            });
        }, timeout);
    };

    $scope.startCountingAt = function(time) {
        time = time || 0
        $interval.cancel(timer);
        $scope.elapsed = parseFloat(time);
        timer = $interval(count, progressTimeout);
    };

    function count() {
        $scope.elapsed += (progressTimeout / 1000);
        if (isNaN($scope.total) || $scope.elapsed > $scope.total) {
            $scope.total = $scope.elapsed;
        }
        $scope.hmElapsed = $scope.convertTime($scope.elapsed);
        $scope.hmTotal = $scope.convertTime($scope.total);
        $scope.percent = Math.round(($scope.elapsed / $scope.total) * 100);
    };

    $scope.refresh = function() {
        $scope.alerts = mpd.alerts;
        $scope.count = 1;
        $scope.activeTab = 0;
        $scope.stream = {};
        $scope.results = {};
        $scope.path = '';
        $scope.pathParts = getPathParts('');
        $scope.directories = [];
        $scope.files = [];
        $scope.searchFor = {};
        $scope.resultsCount = 0;
        $scope.save = {};

        $scope.update(0);
        $scope.getElapsed(1000);
        mpd.addAlert();
    };

    $scope.getElapsed = function(timeout) {
        timeout = timeout || 500;
        setTimeout(function() {
            mpd.sendCommand('status').then(function(data) {
                $scope.startCountingAt(data.elapsed);
            });
        }, timeout);
    };

    $scope.idle = function() {
        mpd.sendCommand('idle').then(function(data) {
            console.log(data);
            $scope.update();
            $scope.idle();
            // figure out the timeout
        });
    };

    $scope.browse = function (path) {
        path = path || '';
        mpd.addAlert('warning', 'loading...', 30000);
        $scope.activeTab = 2;
        $scope.path = path;
        $scope.pathParts = getPathParts(path);
        $scope.directories = [];
        $scope.files = [];
        mpd.sendCommand('lsinfo', [path]).then(function(data) {
            data.forEach(function(item) {
                if (item.directory != null) {
                    $scope.directories.push(prettifyFilepath(item.directory));
                }
                if (item.file != null) {
                    $scope.files.push(prettifyFilepath(item.file));
                }
            });
            $scope.closeAlert(0);
        });
    };

    $scope.browseSaved = function ()  {
        mpd.sendCommand('listplaylists').then(function(data) {
            $scope.lists = Object.keys(data);
        });
    };

    $scope.findRecent = function(interval) {
        var recent = new Date();
        recent.setDate(recent.getDate() - interval);
        var lastWeek = recent.toISOString().split('.')[0]+"Z";
        console.log(lastWeek);
        $scope.search('modified-since', lastWeek);
    };

    $scope.search = function(type, what) {
        type = type || 'any';
        what = what || '';
        mpd.addAlert('warning', 'loading...', 30000);
        $scope.activeTab = 3;
        $scope.results = {};
        $scope.resultsCount = '?';
        $scope.searchFor = { type: type, what: what };
        mpd.sendCommand('search', [type, what]).then(function(data) {
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
            $scope.closeAlert(0);
        });
    };

    $scope.addStream = function(stream) {
        var found = stream.match(/https:\/\/(soundcloud.com\/.*)/);
        if (found != null) {
            var scStream = 'soundcloud://url/' + found[1];
            mpd.sendCommand('load', [scStream]);
        } else if (stream.includes('youtube.com')) {
            var params = { url: stream, dl: true, info: true }
            $http.post('youtube.php', params).then(function(response) {
                if (response.data) {
                    // TODO: need to make sure stream is not empty!
                    // or else mpd will add EVERYTHING and crash and burn!
                    $scope.add(response.data.stream);
                    mpd.addAlert('success', response.data.info.title, 3000);
                    console.log(response.data.info);
                }
            });
        } else {
            $scope.add(stream);
        }
        $scope.stream = { url: '' };
    };

    $scope.savePlaylist = function(playlistName) {
        mpd.sendCommand('save', [playlistName]);
        $scope.save = {};
    };

    $scope.progress = function(event) {
        var totalWidth = angular.element(document.getElementById('progressbar')).prop('offsetWidth');
        var x = event.offsetX;
        var percentage = (x / totalWidth);
        var time = Math.round(percentage * $scope.song.time);

        mpd.sendCommand('seekcur', [time]).then(function() {
            $scope.elapsed = time;
        });
    };

    $scope.closeAlert = function(index) {
        mpd.alerts.splice(index, 1);
    };

    $scope.isCurrentSong = function(file) {
        if (file.id == songId) {
            return true;
        }
        return false;
    };

    $scope.nope = function() {
        if ($window.confirm('this song sucks?')) {
            mpd.sendCommand('next');
            mpd.sendCommand('log', [$scope.song.file]);
        }
    };

    $scope.skip = function() {
        mpd.sendCommand('next');
    };

    $scope.shuffle = function() {
        mpd.sendCommand('shuffle');
    };

    $scope.crop = function() {
        mpd.sendCommand('crop');
    };

    $scope.addRandom = function(num) {
        mpd.sendCommand('addRandomSong', [num]);
    };

    $scope.add = function(item) {
        mpd.sendCommand('add', [item]);
    };

    $scope.load = function(list) {
        mpd.sendCommand('load', [list]);
    };

    $scope.xfade = function() {
        var xfade = $scope.xfadeStatus * 10;
        mpd.sendCommand('crossfade', [xfade]);
    };

    $scope.move = function(pos, item) {
        oldPos = parseInt(item.pos);
        if (pos > oldPos) --pos;
        mpd.sendCommand('move', [oldPos, pos]);
        return false;
    }

    $scope.moveUp = function(pos) {
        // use 'moveid' here when I finally switch to dnd
        // moving by pos can cause problems with multiple clients
        mpd.sendCommand('move', [pos, parseInt(pos) - 1]);
    };

    $scope.moveDown = function(pos) {
        mpd.sendCommand('move', [pos, parseInt(pos) + 1]);
    };

    $scope.play = function(pos) {
        mpd.sendCommand('play', [pos]);
    };

    $scope.delete = function(pos) {
        mpd.sendCommand('delete', [pos]);
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

    $scope.convertTime = function(seconds) {
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
    };

    function prettifyFilepath(path) {
        var parts = path.split('/');
        var name = parts[parts.length - 1];

        return {path: path, name: name}
    }

    function updateTitle() {
        var title = '';
        if ('name' in $scope.song) {
            title = $scope.song.name;
        }
        if ('title' in $scope.song) {
            title = $scope.song.title;
        }
        if ('artist' in $scope.song) {
            title = $scope.song.artist + ' - ' + title;
        }
        document.title = title;
        // this doesn't seem to work for some reason
    }


    $scope.refresh();
    $scope.idle();
});
