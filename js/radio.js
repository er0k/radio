var radio = angular.module('radio', ['ngAnimate','ui.bootstrap']);

radio.factory('mpd', function($http) {
    return {
        sendCommand: function(cmd, args) {
            args = args || [];
            var params = { c: cmd };
            for (var i = 0; i < args.length; i++) {
                var key = 'a' + i;
                params[key] = args[i];
            }
            return $http.get('m.php', { params: params }).then(function(response) {
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

radio.controller('dj', function ($scope, $http, $uibModal, mpd) {

    var songId = 0;
    var statusFile = '/radio/mpd-status.json';
    var songFile = '/radio/mpd-song.json';
    var lastSongId;
    var songLength = 0;
    var songTime = 0;
    var i = 0;

    $scope.getStatus = function() {
        $http.get(statusFile).success(function(data) {
            $scope.status = data;
            lastSongId = songId;
            songId = $scope.status.songid;

            if ($scope.status.songid != lastSongId) {
                $scope.getCurrentSong();
                $scope.getPlaylist();
            }

            $scope.percent = $scope.getPercent();
        });
        i++;
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

    $scope.getPercent = function() {
        if ($scope.song != null && $scope.status != null) {
            return ($scope.status.elapsed / $scope.song.Time) * 100;
        }
        return 0;
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
        console.log(timeout);
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

    // @todo : this sucks and should be done on the backend
    $scope.crop = function() {
        if ($scope.status != null) {
            var pos = parseInt($scope.status.song);
            var length = parseInt($scope.status.playlistlength);

            if ((length - 1) - pos > 0) {
                // delete all songs after current
                var start = pos + 1;
                var end = length;
                if (end > start) {
                    var del = start + ':' + end;
                } else {
                    var del = end;
                }
                // delete songs before current
                if (pos == 1) {
                    var del2 = 0;
                } else if (pos > 1) {
                    var del2 = '0:' + pos;
                }
            }

            mpd.sendCommand('delete', [del]).then(function(data) {
                mpd.sendCommand('delete', [del2]).then(function(data) {
                });
            });

        }

        $scope.getPlaylist();
    };

    $scope.addRandom = function() {
        mpd.sendCommand('addRandomSong');
        $scope.getPlaylist(1020);
    };

    $scope.refresh = function() {
        $scope.getStatus();
        $scope.getPlaylist();
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

    $scope.getStatus();
    setInterval($scope.getStatus, 3000);

});
