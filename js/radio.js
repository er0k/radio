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

radio.controller('dj', function ($scope, $http, $uibModal, $q, mpd) {

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

    $scope.getPlaylist = function() {
        setTimeout(function() {
            mpd.sendCommand('playlistinfo').then(function(data) {
                $scope.playlist = data;
            });
        }, 500);
    }

    $scope.skip = function() {
        mpd.sendCommand('next');
        $scope.getStatus();
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
