var radio = angular.module('radio', ['ngAnimate','ui.bootstrap']);

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


radio.controller('dj', function ($scope, $http, $interval, mpd) {

    var statusTimeout = 3000;
    var progressTimeout = 1000;
    var songId = 0;
    var elapsed = 0;
    var timer;

    $scope.update = function(timeout) {
        timeout = timeout || 300;
        setTimeout(function() {
            $http.get('/radio/mpd.json').success(function(data) {
                console.log(data)
                $scope.status = data.status;
                $scope.song = data.song;
                $scope.listeners = data.listeners;
                $scope.playlist = data.playlist;
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
        timer = $interval(count, 1000);
    };

    function count() {
        $scope.elapsed += 1;
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

    $scope.refresh();
    $scope.idle();
});
