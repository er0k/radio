var radio = angular.module('radio', ['ngAnimate','ui.bootstrap']);

radio.factory('mpd', function($http) {
    return {
        sendCommand: function(cmd, args) {
            args = args || [];
            var params = { cmd: cmd };
            for (var i = 0; i < args.length; i++) {
                var key = 'a' + i;
                params[key] = args[i];
            }
            return $http.post('m.php', params).then(function(response) {
                return response.data;
            });
        }
    }
});

radio.controller('modal', function ($scope, $uibModalInstance, items) {
    $scope.items = items;
    $scope.selected = {
        item: $scope.items[0]
    };

    $scope.ok = function () {
        $uibModalInstance.close($scope.selected.item);
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
});

radio.controller('dj', function ($scope, $http, $uibModal, $interval, mpd) {

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
    $scope.path = '';
    $scope.activeTab = 0;

    $scope.getStatus = function() {
        $http.get(statusFile).success(function(data) {
            $scope.status = data;
            lastSongId = songId;
            songId = $scope.status.songid;
            elapsedReal = $scope.status.elapsed;

            if ($scope.status.songid != lastSongId) {
                $scope.getCurrentSong();
                $scope.getPlaylist();
            }
        });
        i++;
    };

    $scope.browse = function (path) {
        path = path || '';
        $scope.path = path;
        $scope.pathParts = getPathParts(path);
        mpd.sendCommand('lsinfo', [path]).then(function(data) {
            $scope.directories = [];
            $scope.files = [];
            data.forEach(function(item) {
                if (item.directory != null) {
                    $scope.directories.push(item.directory);
                }
                if (item.file != null) {
                    $scope.files.push(item.file);
                }
            });
        });
    };

    $scope.browseSaved = function ()  {
        mpd.sendCommand('listplaylists').then(function(data) {
            $scope.lists = Object.keys(data);
        });
    };

    $scope.find = function (type, what) {
        var modalInstance = $uibModal.open({
            animation: false,
            size: 'lg',
            templateUrl: 'modal.html',
            controller: 'modal',
            resolve: {
                items: function () {
                    return mpd.sendCommand('find', [type, what]).then(function(data) {
                        return data;
                    });
                }
            }
        });

        modalInstance.result.then(function (selectedItem) {
            $scope.selected = selectedItem;
        }, function () {
            console.log('modal dismissed');
        });
    };

    $scope.search = function(type, what) {
        $scope.activeTab = 3;
        console.log(type);
        console.log(what);
        $scope.results = {};
        $scope.what = what;
        mpd.sendCommand('search', [type, what]).then(function(data) {
            console.log(data);
            $scope.results = data;
        });
    };

    $scope.searchSubmit = function(form) {
        console.log(form);
        var what = form.what.$modelValue;
        var type = form.type.$modelValue;
        console.log(type + ', ' + what);
        $scope.search(type, what);
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
    };

    $scope.addRandom = function(num) {
        mpd.sendCommand('addRandomSong', [num]);
        $scope.getPlaylist(1020);
    };

    $scope.add = function(item) {
        mpd.sendCommand('add', [item]);
        $scope.getPlaylist();
    };

    $scope.load = function(list) {
        mpd.sendCommand('load', [list]);
        $scope.getPlaylist(1000);
    };

    $scope.refresh = function() {
        $scope.count = 1;
        $scope.getStatus();
        $scope.getCurrentSong();
        $scope.getPlaylist();
        $scope.browse();
        $scope.results = {};
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

    $scope.getStatus();
    $scope.getProgress();
    $interval($scope.getStatus, statusTimeout);
    $interval($scope.getProgress, progressTimeout);

});
